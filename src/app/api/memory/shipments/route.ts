import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { syncShipmentsFromSheet } from "@/app/actions/sheet-actions";
import { appendRow, upsertRow, deleteRow, findRowIndex } from "@/lib/google-sheets";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // 1. PULL DARI GOOGLE SHEETS DULU (Primary Source of Truth)
        try {
            const sheetData = await syncShipmentsFromSheet();
            if (sheetData.success && sheetData.shipments) {
                // Upsert ke lokal DB sbg backup dlm db
                const upsertPromises = sheetData.shipments.map(s =>
                    prisma.shipmentDetail.upsert({
                        where: { id: s.id },
                        update: {
                            shipmentNumber: s.shipment_number,
                            dealId: s.deal_id,
                            status: s.status,
                            buyer: s.buyer,
                            supplier: s.supplier,
                            isBlending: s.is_blending,
                            iupOp: s.iup_op,
                            vesselName: s.vessel_name,
                            bargeName: s.barge_name,
                            loadingPort: s.loading_port,
                            dischargePort: s.discharge_port,
                            quantityLoaded: s.quantity_loaded,
                            blDate: s.bl_date ? new Date(s.bl_date) : null,
                            eta: s.eta ? new Date(s.eta) : null,
                            salesPrice: s.sales_price,
                            marginMt: s.margin_mt,
                            picName: s.pic_name,
                            type: s.type,
                            milestones: s.milestones ? (typeof s.milestones === 'string' ? s.milestones : JSON.stringify(s.milestones)) : null
                        },
                        create: {
                            id: s.id || "",
                            shipmentNumber: s.shipment_number || `SH-${Date.now()}`,
                            dealId: s.deal_id,
                            status: s.status || "draft",
                            buyer: s.buyer || "-",
                            supplier: s.supplier,
                            isBlending: s.is_blending || false,
                            iupOp: s.iup_op,
                            vesselName: s.vessel_name,
                            bargeName: s.barge_name,
                            loadingPort: s.loading_port,
                            dischargePort: s.discharge_port,
                            quantityLoaded: s.quantity_loaded,
                            blDate: s.bl_date ? new Date(s.bl_date) : null,
                            eta: s.eta ? new Date(s.eta) : null,
                            salesPrice: s.sales_price,
                            marginMt: s.margin_mt,
                            picName: s.pic_name,
                            type: s.type || "export",
                            milestones: s.milestones ? (typeof s.milestones === 'string' ? s.milestones : JSON.stringify(s.milestones)) : null
                        }
                    })
                );
                await Promise.allSettled(upsertPromises);

                // --- REKONSILIASI PENGHAPUSAN (DELETION) ---
                const remoteIds = new Set(sheetData.shipments.map(s => s.id));
                const localRecords = await prisma.shipmentDetail.findMany({
                    where: { isDeleted: false },
                    select: { id: true }
                });

                const deletePromises = localRecords
                    .filter(loc => !remoteIds.has(loc.id))
                    .map(loc =>
                        prisma.shipmentDetail.update({
                            where: { id: loc.id },
                            data: { isDeleted: true }
                        })
                    );

                if (deletePromises.length > 0) {
                    await Promise.allSettled(deletePromises);
                    console.log(`[Sync] Menghapus ${deletePromises.length} local shipments karena tidak ditemukan di Google Sheets.`);
                }

                // --- KEMBALIKAN DATA LANGSUNG DARI GOOGLE SHEETS UNTUK UI ---
                const formattedRemote = sheetData.shipments.map(s => {
                    let parsedMilestones: any[] = [];
                    if (s.milestones) {
                        try {
                            parsedMilestones = typeof s.milestones === 'string' ? JSON.parse(s.milestones) : s.milestones;
                        } catch {
                            parsedMilestones = [];
                        }
                    }

                    return {
                        id: s.id,
                        shipmentNumber: s.shipment_number,
                        dealId: s.deal_id,
                        status: s.status,
                        buyer: s.buyer,
                        supplier: s.supplier,
                        isBlending: s.is_blending,
                        iupOp: s.iup_op,
                        vesselName: s.vessel_name,
                        bargeName: s.barge_name,
                        loadingPort: s.loading_port,
                        dischargePort: s.discharge_port,
                        quantityLoaded: s.quantity_loaded,
                        blDate: s.bl_date ? new Date(s.bl_date) : null,
                        eta: s.eta ? new Date(s.eta) : null,
                        salesPrice: s.sales_price,
                        marginMt: s.margin_mt,
                        picName: s.pic_name,
                        type: s.type,
                        milestones: parsedMilestones,
                        createdAt: s.created_at ? new Date(s.created_at) : new Date(),
                        updatedAt: s.updated_at ? new Date(s.updated_at) : new Date()
                    };
                });

                return NextResponse.json({ success: true, shipments: formattedRemote });
            }
        } catch (e) {
            console.error("Failed to pull shipments from sheets", e);
        }

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

        // CREATE IN DATABASE (Capture DB)
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

        // WRITE DIRECTLY TO SPREADSHEET (Primary Source of truth)
        try {
            const rowValues = [
                shipment.id,
                shipment.shipmentNumber || "",
                shipment.dealId || "",
                shipment.status || "draft",
                shipment.buyer || "-",
                shipment.supplier || "-",
                shipment.isBlending ? "Yes" : "No",
                shipment.iupOp || "-",
                shipment.vesselName || "-",
                shipment.bargeName || "-",
                shipment.loadingPort || "-",
                shipment.dischargePort || "-",
                shipment.quantityLoaded || 0,
                shipment.blDate ? shipment.blDate.toISOString().split('T')[0] : "-",
                shipment.eta ? shipment.eta.toISOString().split('T')[0] : "-",
                shipment.salesPrice || 0,
                shipment.marginMt || 0,
                shipment.picName || "-",
                shipment.type || "export",
                shipment.milestones ? shipment.milestones : "",
                shipment.createdAt ? shipment.createdAt.toISOString() : new Date().toISOString(),
                shipment.updatedAt ? shipment.updatedAt.toISOString() : new Date().toISOString()
            ];

            await appendRow("Shipments", rowValues);
        } catch (sheetErr) {
            console.error("Failed writing to Google Sheets in POST /shipments", sheetErr);
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
        if (!data.id) return NextResponse.json({ error: "Shipment ID missing" }, { status: 400 });

        const existingRecord = await prisma.shipmentDetail.findUnique({ where: { id: data.id } });
        if (!existingRecord || existingRecord.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const userRole = session.user.role?.toLowerCase() || "";
        if (!["ceo", "director", "manager"].includes(userRole)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // UPDATE IN DATABASE (Capture DB)
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
                    quantityLoaded: data.quantityLoaded ? parseFloat(data.quantityLoaded.toString()) : null,
                    blDate: data.blDate ? new Date(data.blDate) : null,
                    eta: data.eta ? new Date(data.eta) : null,
                    salesPrice: data.salesPrice ? parseFloat(data.salesPrice.toString()) : null,
                    marginMt: data.marginMt ? parseFloat(data.marginMt.toString()) : null,
                    picName: data.picName,
                    type: data.type,
                    milestones: data.milestones ? JSON.stringify(data.milestones) : null
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

        // UPDATE DIRECTLY TO SPREADSHEET (Primary Source of truth)
        try {
            const rowValues = [
                shipment.id,
                shipment.shipmentNumber || "",
                shipment.dealId || "",
                shipment.status || "draft",
                shipment.buyer || "-",
                shipment.supplier || "-",
                shipment.isBlending ? "Yes" : "No",
                shipment.iupOp || "-",
                shipment.vesselName || "-",
                shipment.bargeName || "-",
                shipment.loadingPort || "-",
                shipment.dischargePort || "-",
                shipment.quantityLoaded || 0,
                shipment.blDate ? shipment.blDate.toISOString().split('T')[0] : "-",
                shipment.eta ? shipment.eta.toISOString().split('T')[0] : "-",
                shipment.salesPrice || 0,
                shipment.marginMt || 0,
                shipment.picName || "-",
                shipment.type || "export",
                shipment.milestones ? shipment.milestones : "",
                shipment.createdAt ? shipment.createdAt.toISOString() : new Date().toISOString(),
                shipment.updatedAt ? shipment.updatedAt.toISOString() : new Date().toISOString()
            ];

            await upsertRow("Shipments", 0, shipment.id, rowValues);
        } catch (sheetErr) {
            console.error("Failed modifying Google Sheets in PUT /shipments", sheetErr);
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
        if (!id) return NextResponse.json({ error: "Shipment ID missing" }, { status: 400 });

        const existingRecord = await prisma.shipmentDetail.findUnique({ where: { id } });
        if (!existingRecord || existingRecord.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const userRole = session.user.role?.toLowerCase() || "";
        if (!["ceo", "director", "manager"].includes(userRole)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // DEL IN DATABASE (Capture DB)
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

        // DEL FROM SPREADSHEETS DIRECTLY
        try {
            const rowIndex = await findRowIndex("Shipments", 0, id);
            if (rowIndex > 0) {
                await deleteRow("Shipments", rowIndex);
            }
        } catch (sheetErr) {
            console.error("Failed deleting from Google Sheets in DELETE /shipments", sheetErr);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/memory/shipments error:", error);
        return NextResponse.json({ error: "Failed to delete shipment" }, { status: 500 });
    }
}
