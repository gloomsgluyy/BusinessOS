import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { syncPartnersToSheet } from "@/app/actions/sheet-actions";

import { PushService } from "@/lib/push-to-sheets";

async function triggerPush() {
    PushService.debouncedPush("partner").catch(err => console.error("Push failed:", err));
}

function cleanText(v: unknown): string | null {
    if (v === null || v === undefined) return null;
    const t = String(v).replace(/\s+/g, " ").trim();
    return t || null;
}

function normalizeKey(v: unknown): string {
    return (cleanText(v) || "").toUpperCase();
}

function isMeaningfulName(v: unknown): boolean {
    const name = cleanText(v);
    if (!name) return false;
    const n = normalizeKey(name);
    if (n.length < 3) return false;
    if (["-", "N/A", "NA", "UNKNOWN", "TBA", "TBD", "NULL", "NONE"].includes(n)) return false;
    if (/^BUYER\s+\d+$/i.test(name)) return false;
    return true;
}

function isExportShipment(sh: { type?: string | null; exportDmo?: string | null }): boolean {
    const t = normalizeKey(sh.type);
    const expDmo = normalizeKey(sh.exportDmo);
    if (t.includes("LOCAL") || t.includes("DMO") || t.includes("DOMESTIC")) return false;
    if (expDmo.includes("LOCAL") || expDmo.includes("DMO") || expDmo.includes("DOMESTIC")) return false;
    return true;
}

function inferBuyerFromFlow(flow: unknown): string | null {
    const raw = cleanText(flow);
    if (!raw) return null;
    const stopwords = new Set(["MSE", "MKLS", "CMD", "BAC", "LJT", "BUYER", "SUPPLIER", "OPS", "FLOW", "I/O", "IO", "AND", "OR"]);
    const tokens = raw
        .split(/[-–>/,|]+/)
        .map((t) => cleanText(t))
        .filter((t): t is string => Boolean(t));
    for (let i = tokens.length - 1; i >= 0; i--) {
        const token = tokens[i];
        const norm = normalizeKey(token);
        if (!norm || stopwords.has(norm) || norm.length < 3) continue;
        return token;
    }
    return null;
}

async function bootstrapPartnersFromOperationalData() {
    const [shipments, deals] = await Promise.all([
        prisma.shipmentDetail.findMany({
            where: { isDeleted: false },
            select: {
                buyer: true,
                supplier: true,
                source: true,
                iupOp: true,
                shipmentFlow: true,
                vesselName: true,
                mvProjectName: true,
                nomination: true,
                type: true,
                exportDmo: true,
                origin: true,
            },
        }),
        prisma.salesDeal.findMany({
            where: { isDeleted: false },
            select: { buyer: true, buyerCountry: true, type: true },
        }),
    ]);

    const buyerVotesByGroup = new Map<string, Map<string, number>>();
    for (const s of shipments) {
        const groupKey = normalizeKey(s.vesselName || s.mvProjectName || s.nomination);
        const buyer = cleanText(s.buyer);
        if (!groupKey || !buyer) continue;
        const votes = buyerVotesByGroup.get(groupKey) || new Map<string, number>();
        votes.set(buyer, (votes.get(buyer) || 0) + 1);
        buyerVotesByGroup.set(groupKey, votes);
    }

    const consensusBuyerByGroup = new Map<string, string>();
    buyerVotesByGroup.forEach((votes, groupKey) => {
        let winner = "";
        let maxVote = -1;
        votes.forEach((vote, candidate) => {
            if (vote > maxVote) {
                winner = candidate;
                maxVote = vote;
            }
        });
        if (winner) consensusBuyerByGroup.set(groupKey, winner);
    });

    const seen = new Set<string>();
    const toCreate: Array<{
        name: string;
        type: "buyer" | "vendor" | "fleet";
        city?: string | null;
        country?: string | null;
        status: "active" | "under_review" | "inactive";
        notes?: string;
    }> = [];

    const pushCandidate = (nameRaw: unknown, type: "buyer" | "vendor", regionRaw?: unknown, note?: string) => {
        const name = cleanText(nameRaw);
        if (!isMeaningfulName(name)) return;
        const key = `${type}::${normalizeKey(name)}`;
        if (seen.has(key)) return;
        seen.add(key);
        const region = cleanText(regionRaw);
        const [city, country] = region ? region.split(",").map((x) => x.trim()) : [undefined, undefined];
        toCreate.push({
            name: name!,
            type,
            city: city || null,
            country: country || null,
            status: "active",
            notes: note || "Auto-generated from shipment/deal data",
        });
    };

    deals.forEach((d) => {
        pushCandidate(d.buyer, "buyer", d.buyerCountry, "Auto-generated from sales deals");
    });

    shipments.forEach((s) => {
        const groupKey = normalizeKey(s.vesselName || s.mvProjectName || s.nomination);
        const inferredBuyer =
            cleanText(s.buyer) ||
            consensusBuyerByGroup.get(groupKey) ||
            inferBuyerFromFlow(s.shipmentFlow);
        const inferredVendor = cleanText(s.source) || cleanText(s.supplier) || cleanText(s.iupOp);

        if (isExportShipment(s)) {
            pushCandidate(inferredBuyer, "buyer", s.origin, "Auto-generated from export shipment");
            pushCandidate(inferredVendor, "vendor", s.origin, "Auto-generated from export shipment source");
        } else {
            pushCandidate(inferredVendor, "vendor", s.origin, "Auto-generated from local/domestic shipment");
            pushCandidate(inferredBuyer, "buyer", s.origin, "Auto-generated from local/domestic shipment");
        }
    });

    if (toCreate.length === 0) return 0;
    await prisma.partner.createMany({ data: toCreate });
    return toCreate.length;
}

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        let partners = await prisma.partner.findMany({
            where: { isDeleted: false },
            orderBy: { createdAt: "desc" }
        });

        if (partners.length === 0) {
            try {
                const created = await bootstrapPartnersFromOperationalData();
                if (created > 0) {
                    partners = await prisma.partner.findMany({
                        where: { isDeleted: false },
                        orderBy: { createdAt: "desc" }
                    });
                }
            } catch (bootstrapError) {
                console.error("Partner bootstrap failed (non-critical):", bootstrapError);
            }
        }

        return NextResponse.json({ success: true, partners });
    } catch (error) {
        console.error("GET /api/memory/partners error:", error);
        return NextResponse.json({ error: "Failed to fetch partners" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const data = await req.json();

        const partner = await prisma.$transaction(async (tx) => {
            const newPartner = await tx.partner.create({
                data: {
                    name: data.name,
                    type: data.type || "buyer",
                    category: data.category,
                    contactPerson: data.pic || data.contactPerson,
                    phone: data.phone,
                    email: data.email,
                    city: data.region?.split(',')[0]?.trim(),
                    country: data.region?.split(',')[1]?.trim() || data.country,
                    taxId: data.taxId,
                    status: data.status || "active",
                    notes: data.notes
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "CREATE",
                    entity: "Partner",
                    entityId: newPartner.id,
                    details: JSON.stringify(newPartner)
                }
            });

            return newPartner;
        });

        await triggerPush();

        return NextResponse.json({ success: true, partner });
    } catch (error) {
        console.error("POST /api/memory/partners error:", error);
        return NextResponse.json({ error: "Failed to create partner" }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const data = await req.json();
        if (!data.id) return NextResponse.json({ error: "Partner ID missing" }, { status: 400 });

        const existingRecord = await prisma.partner.findUnique({ where: { id: data.id } });
        if (!existingRecord || existingRecord.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const userRole = session.user.role?.toLowerCase() || "";
        if (!["ceo", "director", "manager"].includes(userRole)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const partner = await prisma.$transaction(async (tx) => {
            const updatedPartner = await tx.partner.update({
                where: { id: data.id },
                data: {
                    name: data.name,
                    type: data.type,
                    category: data.category,
                    contactPerson: data.pic || data.contactPerson,
                    phone: data.phone,
                    email: data.email,
                    city: data.region?.split(',')[0]?.trim(),
                    country: data.region?.split(',')[1]?.trim() || data.country,
                    taxId: data.taxId,
                    status: data.status,
                    notes: data.notes
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "UPDATE",
                    entity: "Partner",
                    entityId: updatedPartner.id,
                    details: JSON.stringify(data)
                }
            });

            return updatedPartner;
        });

        await triggerPush();

        return NextResponse.json({ success: true, partner });
    } catch (error) {
        console.error("PUT /api/memory/partners error:", error);
        return NextResponse.json({ error: "Failed to update partner" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const url = new URL(req.url);
        const id = url.searchParams.get("id");
        if (!id) return NextResponse.json({ error: "Partner ID missing" }, { status: 400 });

        const existingRecord = await prisma.partner.findUnique({ where: { id } });
        if (!existingRecord || existingRecord.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const userRole = session.user.role?.toLowerCase() || "";
        if (!["ceo", "director", "manager"].includes(userRole)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await prisma.$transaction(async (tx) => {
            await tx.partner.update({
                where: { id },
                data: { isDeleted: true }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "DELETE",
                    entity: "Partner",
                    entityId: id,
                    details: JSON.stringify({ isDeleted: true })
                }
            });
        });

        await triggerPush();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/memory/partners error:", error);
        return NextResponse.json({ error: "Failed to delete partner" }, { status: 500 });
    }
}
