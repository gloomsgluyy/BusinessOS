import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { PushService } from "@/lib/push-to-sheets";

export const dynamic = "force-dynamic";

async function triggerPush() {
    PushService.debouncedPush("shipmentDetail").catch(err => console.error("Optional Sheet push failed:", err));
}

function parseNum(v: any): number | null {
    if (v === null || v === undefined || v === "") return null;
    const n = parseFloat(String(v));
    return isNaN(n) ? null : n;
}

function parseDate(v: any): Date | null {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
}

function cleanText(v: unknown): string | null {
    if (v === null || v === undefined) return null;
    const text = String(v).replace(/\s+/g, " ").trim();
    return text || null;
}

function normalizeKey(v: unknown): string {
    return (cleanText(v) || "").toUpperCase();
}

function isExportShipment(s: any): boolean {
    const type = normalizeKey(s?.type);
    const expDmo = normalizeKey(s?.exportDmo);
    if (type.includes("LOCAL") || type.includes("DMO") || type.includes("DOMESTIC")) return false;
    if (expDmo.includes("DMO") || expDmo.includes("LOCAL") || expDmo.includes("DOMESTIC")) return false;
    return true;
}

function inferBuyerFromFlow(flow: unknown): string | null {
    const raw = cleanText(flow);
    if (!raw) return null;
    const stopwords = new Set([
        "MSE", "MKLS", "CMD", "BAC", "LJT", "BUYER", "SUPPLIER", "OPS", "FLOW", "I/O", "IO", "AND", "OR"
    ]);
    const tokens = raw
        .split(/[-–>/,|]+/)
        .map((t) => cleanText(t))
        .filter((t): t is string => Boolean(t));
    for (let i = tokens.length - 1; i >= 0; i--) {
        const token = tokens[i];
        const norm = normalizeKey(token);
        if (!norm || stopwords.has(norm)) continue;
        if (norm.length <= 2) continue;
        return token;
    }
    return null;
}

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { searchParams } = new URL(req.url);
        const lite = ["1", "true", "yes"].includes((searchParams.get("lite") || "").toLowerCase());
        const includeTimeline = ["1", "true", "yes"].includes((searchParams.get("timeline") || "").toLowerCase());

        // DATABASE-FIRST: Read directly from database
        const shipments = await prisma.shipmentDetail.findMany({
            where: { isDeleted: false },
            orderBy: { createdAt: "desc" },
            ...(lite
                ? {
                    select: {
                        id: true,
                        no: true,
                        exportDmo: true,
                        status: true,
                        origin: true,
                        mvProjectName: true,
                        source: true,
                        iupOp: true,
                        shipmentFlow: true,
                        jettyLoadingPort: true,
                        laycan: true,
                        nomination: true,
                        qtyPlan: true,
                        qtyCob: true,
                        hargaActualFob: true,
                        hargaActualFobMv: true,
                        hpb: true,
                        shipmentStatus: true,
                        blDate: true,
                        pic: true,
                        sp: true,
                        year: true,
                        quantityLoaded: true,
                        salesPrice: true,
                        marginMt: true,
                        buyer: true,
                        supplier: true,
                        vesselName: true,
                        bargeName: true,
                        loadingPort: true,
                        dischargePort: true,
                        type: true,
                        createdAt: true,
                        updatedAt: true,
                        isDeleted: true,
                    }
                }
                : {})
        });

        const shipmentIds = shipments.map((s) => s.id);
        const timeline = includeTimeline && !lite && shipmentIds.length
            ? await prisma.timelineMilestone.findMany({
                where: { shipmentId: { in: shipmentIds } },
                orderBy: { date: "asc" }
            })
            : [];

        const timelineByShipment = new Map<string, typeof timeline>();
        for (const item of timeline) {
            const existing = timelineByShipment.get(item.shipmentId) || [];
            existing.push(item);
            timelineByShipment.set(item.shipmentId, existing);
        }

        // Build buyer consensus by mother-vessel/project group
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

        const enriched = shipments.map((s) => {
            const milestones = timelineByShipment.get(s.id) || [];
            const groupKey = normalizeKey(s.vesselName || s.mvProjectName || s.nomination);
            const inferredBuyer =
                cleanText(s.buyer) ||
                consensusBuyerByGroup.get(groupKey) ||
                inferBuyerFromFlow(s.shipmentFlow) ||
                null;
            const inferredSupplier =
                cleanText(s.supplier) ||
                cleanText(s.source) ||
                cleanText(s.iupOp) ||
                null;
            const exportShipment = isExportShipment(s);
            const counterpartyRole = exportShipment ? "buyer" : "vendor";
            const counterparty = exportShipment
                ? (inferredBuyer || inferredSupplier || "TBA Buyer")
                : (inferredSupplier || inferredBuyer || "TBA Vendor");

            return {
                ...s,
                buyer: inferredBuyer,
                supplier: inferredSupplier,
                counterpartyRole,
                counterparty,
                milestones: includeTimeline
                    ? milestones.map((m) => ({
                        title: m.title,
                        subtitle: `${m.date.toISOString().slice(0, 10)}${m.description ? ` - ${m.description}` : ""}`,
                        status: "completed",
                        date: m.date
                    }))
                    : []
            };
        });

        return NextResponse.json({ success: true, shipments: enriched });
    } catch (error) {
        console.error("GET /api/memory/shipments error:", error);
        return NextResponse.json({ error: "Failed to fetch shipments" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const data = await req.json();

        // DATABASE-FIRST: Write to database as primary source
        const shipment = await prisma.$transaction(async (tx) => {
            const newShipment = await tx.shipmentDetail.create({
                data: {
                    no: data.no ? parseInt(data.no) : null,
                    exportDmo: data.exportDmo,
                    status: data.status || "upcoming",
                    origin: data.origin,
                    mvProjectName: data.mvProjectName,
                    source: data.source,
                    iupOp: data.iupOp,
                    shipmentFlow: data.shipmentFlow,
                    jettyLoadingPort: data.jettyLoadingPort,
                    laycan: data.laycan,
                    nomination: data.nomination,
                    qtyPlan: parseNum(data.qtyPlan),
                    qtyCob: parseNum(data.qtyCob),
                    remarks: data.remarks,
                    hargaActualFob: parseNum(data.hargaActualFob),
                    hargaActualFobMv: parseNum(data.hargaActualFobMv),
                    hpb: parseNum(data.hpb),
                    statusHpb: data.statusHpb,
                    shipmentStatus: data.shipmentStatus,
                    issueNotes: data.issueNotes,
                    blDate: parseDate(data.blDate),
                    pic: data.pic || session.user.name,
                    kuotaExport: data.kuotaExport,
                    surveyorLhv: data.surveyorLhv,
                    completelyLoaded: parseDate(data.completelyLoaded),
                    lhvTerbit: parseDate(data.lhvTerbit),
                    lossGainCargo: parseNum(data.lossGainCargo),
                    sp: parseNum(data.sp),
                    deadfreight: parseNum(data.deadfreight),
                    jarak: parseNum(data.jarak),
                    shippingTerm: data.shippingTerm,
                    shippingRate: parseNum(data.shippingRate),
                    priceFreight: parseNum(data.priceFreight),
                    allowance: data.allowance,
                    demm: data.demm,
                    noSpal: data.noSpal,
                    noSi: data.noSi,
                    sentToSupplier: data.sentToSupplier,
                    sentToBargeOwner: data.sentToBargeOwner,
                    noInvoiceMkls: data.noInvoiceMkls,
                    coaDate: parseDate(data.coaDate),
                    resultGar: parseNum(data.resultGar),
                    year: data.year || new Date().getFullYear(),
                    // Detailed/Unified fields
                    quantityLoaded: parseNum(data.quantity_loaded),
                    salesPrice: parseNum(data.sales_price),
                    marginMt: parseNum(data.margin_mt),
                    buyer: data.buyer,
                    vesselName: data.vessel_name,
                    bargeName: data.barge_name,
                    loadingPort: data.loading_port,
                    dischargePort: data.discharge_port,
                    product: data.product,
                    analysisMethod: data.analysis_method,
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "CREATE",
                    entity: "ShipmentDetail",
                    entityId: newShipment.id,
                    details: JSON.stringify({ mvProjectName: newShipment.mvProjectName, status: newShipment.status })
                }
            });

            return newShipment;
        });

        // Optional push to Sheets for backup/export
        await triggerPush();

        return NextResponse.json({ success: true, shipment });
    } catch (error) {
        console.error("POST /api/memory/shipments error:", error);
        return NextResponse.json({ error: "Failed to create shipment" }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const data = await req.json();
        if (!data.id) return NextResponse.json({ error: "ID missing" }, { status: 400 });

        const existing = await prisma.shipmentDetail.findUnique({ where: { id: data.id } });
        if (!existing || existing.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

        // DATABASE-FIRST: Update database as primary source
        const shipment = await prisma.$transaction(async (tx) => {
            const updated = await tx.shipmentDetail.update({
                where: { id: data.id },
                data: {
                    no: data.no !== undefined ? (data.no ? parseInt(data.no) : null) : undefined,
                    exportDmo: data.exportDmo, status: data.status, origin: data.origin,
                    mvProjectName: data.mvProjectName, source: data.source, iupOp: data.iupOp,
                    shipmentFlow: data.shipmentFlow, jettyLoadingPort: data.jettyLoadingPort,
                    laycan: data.laycan, nomination: data.nomination,
                    qtyPlan: data.qtyPlan !== undefined ? parseNum(data.qtyPlan) : undefined,
                    qtyCob: data.qtyCob !== undefined ? parseNum(data.qtyCob) : undefined,
                    remarks: data.remarks, hargaActualFob: data.hargaActualFob !== undefined ? parseNum(data.hargaActualFob) : undefined,
                    hargaActualFobMv: data.hargaActualFobMv !== undefined ? parseNum(data.hargaActualFobMv) : undefined,
                    hpb: data.hpb !== undefined ? parseNum(data.hpb) : undefined,
                    statusHpb: data.statusHpb, shipmentStatus: data.shipmentStatus, issueNotes: data.issueNotes,
                    blDate: data.blDate !== undefined ? parseDate(data.blDate) : undefined,
                    pic: data.pic, kuotaExport: data.kuotaExport, surveyorLhv: data.surveyorLhv,
                    completelyLoaded: data.completelyLoaded !== undefined ? parseDate(data.completelyLoaded) : undefined,
                    lhvTerbit: data.lhvTerbit !== undefined ? parseDate(data.lhvTerbit) : undefined,
                    lossGainCargo: data.lossGainCargo !== undefined ? parseNum(data.lossGainCargo) : undefined,
                    sp: data.sp !== undefined ? parseNum(data.sp) : undefined,
                    deadfreight: data.deadfreight !== undefined ? parseNum(data.deadfreight) : undefined,
                    jarak: data.jarak !== undefined ? parseNum(data.jarak) : undefined,
                    shippingTerm: data.shippingTerm, shippingRate: data.shippingRate !== undefined ? parseNum(data.shippingRate) : undefined,
                    priceFreight: data.priceFreight !== undefined ? parseNum(data.priceFreight) : undefined,
                    allowance: data.allowance, demm: data.demm, noSpal: data.noSpal, noSi: data.noSi,
                    sentToSupplier: data.sentToSupplier,
                    sentToBargeOwner: data.sentToBargeOwner,
                    noInvoiceMkls: data.noInvoiceMkls,
                    coaDate: data.coaDate !== undefined ? parseDate(data.coaDate) : undefined,
                    resultGar: data.resultGar !== undefined ? parseNum(data.resultGar) : undefined,
                    year: data.year,
                    // Detailed/Unified fields
                    quantityLoaded: data.quantity_loaded !== undefined ? parseNum(data.quantity_loaded) : undefined,
                    salesPrice: data.sales_price !== undefined ? parseNum(data.sales_price) : undefined,
                    marginMt: data.margin_mt !== undefined ? parseNum(data.margin_mt) : undefined,
                    buyer: data.buyer,
                    vesselName: data.vessel_name,
                    bargeName: data.barge_name,
                    loadingPort: data.loading_port,
                    dischargePort: data.discharge_port,
                    product: data.product,
                    analysisMethod: data.analysis_method,
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id, userName: session.user.name || "Unknown",
                    action: "UPDATE", entity: "ShipmentDetail", entityId: updated.id,
                    details: JSON.stringify(data)
                }
            });

            return updated;
        });

        // Optional push to Sheets for backup/export
        await triggerPush();

        return NextResponse.json({ success: true, shipment });
    } catch (error) {
        console.error("PUT /api/memory/shipments error:", error);
        return NextResponse.json({ error: "Failed to update shipment" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const url = new URL(req.url);
        const id = url.searchParams.get("id");
        if (!id) return NextResponse.json({ error: "ID missing" }, { status: 400 });

        const existing = await prisma.shipmentDetail.findUnique({ where: { id } });
        if (!existing || existing.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

        // DATABASE-FIRST: Delete from database as primary source
        await prisma.$transaction(async (tx) => {
            await tx.shipmentDetail.update({ where: { id }, data: { isDeleted: true } });
            await tx.auditLog.create({
                data: {
                    userId: session.user.id, userName: session.user.name || "Unknown",
                    action: "DELETE", entity: "ShipmentDetail", entityId: id,
                    details: JSON.stringify({ isDeleted: true })
                }
            });
        });

        // Optional push to Sheets for backup/export
        await triggerPush();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/memory/shipments error:", error);
        return NextResponse.json({ error: "Failed to delete shipment" }, { status: 500 });
    }
}
