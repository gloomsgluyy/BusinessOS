import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { PushService } from "@/lib/push-to-sheets";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/pagination";

async function triggerPush() {
    PushService.debouncedPush("sourceSupplier").catch(err => console.error("Optional Sheet push failed:", err));
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const url = new URL(req.url);
        const pagination = parsePaginationParams(url.searchParams);
        const where = { isDeleted: false };

        const formatSource = (s: any) => ({
            ...s,
            spec: { gar: s.gar, ts: s.ts, ash: s.ash, tm: s.tm, im: s.im, fc: s.fc, nar: s.nar, adb: s.adb }
        });

        if (pagination) {
            const [sources, totalItems] = await Promise.all([
                prisma.sourceSupplier.findMany({ where, orderBy: { createdAt: pagination.sortOrder }, skip: pagination.skip, take: pagination.take }),
                prisma.sourceSupplier.count({ where }),
            ]);
            const meta = buildPaginationMeta(totalItems, pagination.page, pagination.pageSize);
            const response = NextResponse.json({ success: true, sources: sources.map(formatSource), meta });
            response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            return response;
        }

        // DATABASE-FIRST: Read directly from database
        const sources = await prisma.sourceSupplier.findMany({
            where,
            orderBy: { createdAt: "desc" }
        });

        const response = NextResponse.json({ success: true, sources: sources.map(formatSource) });
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        return response;
    } catch (error) {
        console.error("GET /api/memory/sources error:", error);
        return NextResponse.json({ error: "Failed to fetch sources" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const data = await req.json();
        const crypto = require("crypto");
        const newId = crypto.randomUUID();

        // DATABASE-FIRST: Write to database as primary source
        const source = await prisma.$transaction(async (tx) => {
            const newSource = await tx.sourceSupplier.create({
                data: {
                    id: newId,
                    name: data.name,
                    region: data.region,
                    calorieRange: data.calorieRange,
                    gar: data.spec?.gar !== undefined && data.spec?.gar !== null ? parseFloat(data.spec.gar.toString()) : null,
                    ts: data.spec?.ts !== undefined && data.spec?.ts !== null ? parseFloat(data.spec.ts.toString()) : null,
                    ash: data.spec?.ash !== undefined && data.spec?.ash !== null ? parseFloat(data.spec.ash.toString()) : null,
                    tm: data.spec?.tm !== undefined && data.spec?.tm !== null ? parseFloat(data.spec.tm.toString()) : null,
                    im: data.spec?.im !== undefined && data.spec?.im !== null ? parseFloat(data.spec.im.toString()) : null,
                    fc: data.spec?.fc !== undefined && data.spec?.fc !== null ? parseFloat(data.spec.fc.toString()) : null,
                    nar: data.spec?.nar !== undefined && data.spec?.nar !== null ? parseFloat(data.spec.nar.toString()) : null,
                    adb: data.spec?.adb !== undefined && data.spec?.adb !== null ? parseFloat(data.spec.adb.toString()) : null,
                    jettyPort: data.jettyPort,
                    anchorage: data.anchorage,
                    stockAvailable: data.stockAvailable !== undefined && data.stockAvailable !== null ? parseFloat(data.stockAvailable.toString()) : 0,
                    minStockAlert: data.minStockAlert !== undefined && data.minStockAlert !== null ? parseFloat(data.minStockAlert.toString()) : null,
                    kycStatus: data.kycStatus || "not_started",
                    psiStatus: data.psiStatus || "not_started",
                    fobBargeOnly: data.fobBargeOnly || false,
                    priceLinkedIndex: data.priceLinkedIndex,
                    fobBargePriceUsd: data.fobBargePriceUsd !== undefined && data.fobBargePriceUsd !== null ? parseFloat(data.fobBargePriceUsd.toString()) : null,
                    contractType: data.contractType,
                    picName: data.picName || session.user.name,
                    iupNumber: data.iupNumber
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "CREATE",
                    entity: "SourceSupplier",
                    entityId: newSource.id,
                    details: JSON.stringify(newSource)
                }
            });

            return newSource;
        });

        // Optional push to Sheets for backup/export
        await triggerPush();

        return NextResponse.json({ success: true, source });
    } catch (error) {
        console.error("POST /api/memory/sources error:", error);
        return NextResponse.json({ error: "Failed to create source" }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const data = await req.json();
        if (!data.id) return NextResponse.json({ error: "Source ID missing" }, { status: 400 });

        const existingRecord = await prisma.sourceSupplier.findUnique({ where: { id: data.id } });
        if (!existingRecord || existingRecord.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const userRole = session.user.role?.toLowerCase() || "";
        if (!["ceo", "director", "manager"].includes(userRole)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // DATABASE-FIRST: Update database as primary source
        const source = await prisma.$transaction(async (tx) => {
            const updatedSource = await tx.sourceSupplier.update({
                where: { id: data.id },
                data: {
                    name: data.name,
                    region: data.region,
                    calorieRange: data.calorieRange,
                    gar: data.spec?.gar !== undefined && data.spec?.gar !== null ? parseFloat(data.spec.gar.toString()) : undefined,
                    ts: data.spec?.ts !== undefined && data.spec?.ts !== null ? parseFloat(data.spec.ts.toString()) : undefined,
                    ash: data.spec?.ash !== undefined && data.spec?.ash !== null ? parseFloat(data.spec.ash.toString()) : undefined,
                    tm: data.spec?.tm !== undefined && data.spec?.tm !== null ? parseFloat(data.spec.tm.toString()) : undefined,
                    im: data.spec?.im !== undefined && data.spec?.im !== null ? parseFloat(data.spec.im.toString()) : undefined,
                    fc: data.spec?.fc !== undefined && data.spec?.fc !== null ? parseFloat(data.spec.fc.toString()) : undefined,
                    nar: data.spec?.nar !== undefined && data.spec?.nar !== null ? parseFloat(data.spec.nar.toString()) : undefined,
                    adb: data.spec?.adb !== undefined && data.spec?.adb !== null ? parseFloat(data.spec.adb.toString()) : undefined,
                    jettyPort: data.jettyPort !== undefined ? data.jettyPort : undefined,
                    anchorage: data.anchorage !== undefined ? data.anchorage : undefined,
                    stockAvailable: data.stockAvailable !== undefined && data.stockAvailable !== null ? parseFloat(data.stockAvailable.toString()) : undefined,
                    minStockAlert: data.minStockAlert !== undefined && data.minStockAlert !== null ? parseFloat(data.minStockAlert.toString()) : undefined,
                    kycStatus: data.kycStatus,
                    psiStatus: data.psiStatus,
                    fobBargeOnly: data.fobBargeOnly,
                    priceLinkedIndex: data.priceLinkedIndex,
                    fobBargePriceUsd: data.fobBargePriceUsd !== undefined && data.fobBargePriceUsd !== null ? parseFloat(data.fobBargePriceUsd.toString()) : undefined,
                    contractType: data.contractType,
                    picName: data.picName,
                    iupNumber: data.iupNumber
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "UPDATE",
                    entity: "SourceSupplier",
                    entityId: updatedSource.id,
                    details: JSON.stringify(data)
                }
            });

            return updatedSource;
        });

        // Optional push to Sheets for backup/export
        await triggerPush();

        return NextResponse.json({ success: true, source });
    } catch (error) {
        console.error("PUT /api/memory/sources error:", error);
        return NextResponse.json({ error: "Failed to update source" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const url = new URL(req.url);
        const id = url.searchParams.get("id");
        if (!id) return NextResponse.json({ error: "Source ID missing" }, { status: 400 });

        const existingRecord = await prisma.sourceSupplier.findUnique({ where: { id } });
        if (!existingRecord || existingRecord.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const userRole = session.user.role?.toLowerCase() || "";
        if (!["ceo", "director", "manager"].includes(userRole)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // DATABASE-FIRST: Delete from database as primary source
        await prisma.$transaction(async (tx) => {
            await tx.sourceSupplier.update({
                where: { id },
                data: { isDeleted: true }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "DELETE",
                    entity: "SourceSupplier",
                    entityId: id,
                    details: JSON.stringify({ isDeleted: true })
                }
            });
        });

        // Optional push to Sheets for backup/export
        await triggerPush();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/memory/sources error:", error);
        return NextResponse.json({ error: "Failed to delete source" }, { status: 500 });
    }
}
