import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { appendRow, upsertRow, deleteRow, findRowIndex } from "@/lib/google-sheets";

export const dynamic = "force-dynamic";

const SHEET_TAB = "MV Barge";

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

function fmtDate(d: Date | null): string {
    return d ? d.toISOString().split('T')[0] : "";
}

// Build row values array matching the MV Barge sheet columns
function toSheetRow(s: any): any[] {
    return [
        s.id, s.no ?? "", s.exportDmo ?? "", s.status ?? "upcoming", s.origin ?? "",
        s.mvProjectName ?? "", s.source ?? "", s.iupOp ?? "", s.shipmentFlow ?? "",
        s.jettyLoadingPort ?? "", s.laycan ?? "", s.nomination ?? "",
        s.qtyPlan ?? "", s.qtyCob ?? "", s.remarks ?? "",
        s.hargaActualFob ?? "", s.hargaActualFobMv ?? "", s.hpb ?? "",
        s.statusHpb ?? "", s.shipmentStatus ?? "", s.issueNotes ?? "",
        fmtDate(s.blDate), s.pic ?? "", s.kuotaExport ?? "", s.surveyorLhv ?? "",
        fmtDate(s.completelyLoaded), fmtDate(s.lhvTerbit),
        s.lossGainCargo ?? "", s.sp ?? "", s.deadfreight ?? "",
        s.jarak ?? "", s.shippingTerm ?? "", s.shippingRate ?? "",
        s.priceFreight ?? "", s.allowance ?? "", s.demm ?? "",
        s.noSpal ?? "", s.noSi ?? "", fmtDate(s.coaDate), s.resultGar ?? "",
        s.year ?? new Date().getFullYear(), s.updatedAt ? s.updatedAt.toISOString() : new Date().toISOString()
    ];
}

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const shipments = await prisma.shipmentDetail.findMany({
            where: { isDeleted: false },
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json({ success: true, shipments });
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
                    coaDate: parseDate(data.coaDate),
                    resultGar: parseNum(data.resultGar),
                    year: data.year || new Date().getFullYear(),
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

        try { await appendRow(SHEET_TAB, toSheetRow(shipment)); } catch (e) {
            console.error("Failed writing to Sheet in POST /shipments", e);
        }

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
                    coaDate: data.coaDate !== undefined ? parseDate(data.coaDate) : undefined,
                    resultGar: data.resultGar !== undefined ? parseNum(data.resultGar) : undefined,
                    year: data.year,
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

        try { await upsertRow(SHEET_TAB, 0, shipment.id, toSheetRow(shipment)); } catch (e) {
            console.error("Failed modifying Sheet in PUT /shipments", e);
        }

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

        try {
            const rowIndex = await findRowIndex(SHEET_TAB, 0, id);
            if (rowIndex > 0) await deleteRow(SHEET_TAB, rowIndex);
        } catch (e) {
            console.error("Failed deleting from Sheet in DELETE /shipments", e);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/memory/shipments error:", error);
        return NextResponse.json({ error: "Failed to delete shipment" }, { status: 500 });
    }
}
