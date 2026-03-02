import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { syncAllShipmentsToSheet } from "@/app/actions/sheet-actions";

async function pushToSheets() {
    try {
        const shipments = await prisma.shipmentDetail.findMany({
            where: { isDeleted: false },
            orderBy: { createdAt: "desc" }
        });
        const formatted = shipments.map((s: any) => ({
            id: s.id, shipment_number: s.shipmentNumber, deal_id: s.dealId, status: s.status,
            buyer: s.buyer, supplier: s.supplier, is_blending: s.isBlending ? "Yes" : "No",
            iup_op: s.iupOp, vessel_name: s.vesselName, barge_name: s.bargeName,
            loading_port: s.loadingPort, discharge_port: s.dischargePort,
            quantity_loaded: s.quantityLoaded, bl_date: s.blDate ? s.blDate.toISOString().split('T')[0] : "",
            eta: s.eta ? s.eta.toISOString().split('T')[0] : "", sales_price: s.salesPrice,
            margin_mt: s.marginMt, pic_name: s.picName, type: s.type,
            created_at: s.createdAt.toISOString(), updated_at: s.updatedAt.toISOString()
        }));
        await syncAllShipmentsToSheet(formatted);
    } catch (err) {
        console.error("Failed to sync Shipments to sheets:", err);
    }
}

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const shipments = await prisma.shipmentDetail.findMany({
            where: { isDeleted: false },
            orderBy: { createdAt: "desc" }
        });

        const formatted = shipments.map(s => {
            let milestones: any[] = [];
            if (s.milestones) {
                try { milestones = JSON.parse(s.milestones); } catch { milestones = []; }
            }
            return { ...s, milestones };
        });

        return NextResponse.json({ success: true, shipments: formatted });
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
                    shipmentNumber: data.shipmentNumber || `SH-${Date.now()}`,
                    dealId: data.dealId,
                    status: data.status || "draft",
                    buyer: data.buyer,
                    supplier: data.supplier,
                    isBlending: data.isBlending || false,
                    iupOp: data.iupOp,
                    vesselName: data.vesselName,
                    bargeName: data.bargeName,
                    loadingPort: data.loadingPort,
                    dischargePort: data.dischargePort,
                    quantityLoaded: data.quantityLoaded ? parseFloat(data.quantityLoaded.toString()) : null,
                    blDate: data.blDate ? new Date(data.blDate) : null,
                    eta: data.eta ? new Date(data.eta) : null,
                    salesPrice: data.salesPrice ? parseFloat(data.salesPrice.toString()) : null,
                    marginMt: data.marginMt ? parseFloat(data.marginMt.toString()) : null,
                    picName: data.picName || session.user.name,
                    type: data.type || "export",
                    milestones: data.milestones ? JSON.stringify(data.milestones) : null
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "CREATE",
                    entity: "ShipmentDetail",
                    entityId: newShipment.id,
                    details: JSON.stringify(newShipment)
                }
            });

            return newShipment;
        });

        await pushToSheets();

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
        if (!data.id) return NextResponse.json({ error: "Shipment ID missing" }, { status: 400 });

        const shipment = await prisma.$transaction(async (tx) => {
            const updatedShipment = await tx.shipmentDetail.update({
                where: { id: data.id },
                data: {
                    status: data.status,
                    buyer: data.buyer,
                    supplier: data.supplier,
                    isBlending: data.isBlending,
                    iupOp: data.iupOp,
                    vesselName: data.vesselName,
                    bargeName: data.bargeName,
                    loadingPort: data.loadingPort,
                    dischargePort: data.dischargePort,
                    quantityLoaded: data.quantityLoaded ? parseFloat(data.quantityLoaded.toString()) : undefined,
                    blDate: data.blDate ? new Date(data.blDate) : undefined,
                    eta: data.eta ? new Date(data.eta) : undefined,
                    salesPrice: data.salesPrice ? parseFloat(data.salesPrice.toString()) : undefined,
                    marginMt: data.marginMt ? parseFloat(data.marginMt.toString()) : undefined,
                    picName: data.picName,
                    type: data.type,
                    milestones: data.milestones ? JSON.stringify(data.milestones) : undefined
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "UPDATE",
                    entity: "ShipmentDetail",
                    entityId: updatedShipment.id,
                    details: JSON.stringify(data)
                }
            });

            return updatedShipment;
        });

        await pushToSheets();

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
        if (!id) return NextResponse.json({ error: "Shipment ID missing" }, { status: 400 });

        await prisma.$transaction(async (tx) => {
            await tx.shipmentDetail.update({
                where: { id },
                data: { isDeleted: true }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "DELETE",
                    entity: "ShipmentDetail",
                    entityId: id,
                    details: JSON.stringify({ isDeleted: true })
                }
            });
        });

        await pushToSheets();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/memory/shipments error:", error);
        return NextResponse.json({ error: "Failed to delete shipment" }, { status: 500 });
    }
}
