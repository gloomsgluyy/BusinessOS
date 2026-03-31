import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { syncProjectsFromSheet } from "@/app/actions/sheet-actions";
import { appendRow, updateRow, deleteRow, findRowIndex } from "@/lib/google-sheets";

const SHEET_NAME = "Projects";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // 1. Fetch from source of truth (Sheet) FIRST
        const sheetRes = await syncProjectsFromSheet();

        if (!sheetRes.success || !sheetRes.projects) {
            // Fallback if sheets API fails
            const deals = await prisma.salesDeal.findMany({
                where: { isDeleted: false },
                orderBy: { createdAt: "desc" }
            });
            return NextResponse.json({ success: true, deals });
        }

        // 2. Fetch local DB to merge additional specs & fields not tracked in Sheet
        const dbDeals = await prisma.salesDeal.findMany({
            where: { isDeleted: false }
        });
        const dbMap = new Map(dbDeals.map(d => [d.id, d]));

        // 3. Map sheet data overriding DB data to construct the final response
        const mergedDeals = sheetRes.projects.map(sp => {
            const db = dbMap.get(sp.id);
            return {
                id: sp.id,
                dealNumber: db?.dealNumber || sp.id,
                status: sp.status,
                buyer: sp.buyer,
                buyerCountry: sp.buyer_country,
                type: sp.type,
                shippingTerms: db?.shippingTerms || "FOB",
                quantity: sp.quantity,
                pricePerMt: sp.price_per_mt,
                totalValue: sp.total_value,
                laycanStart: sp.laycan_start ? new Date(sp.laycan_start).toISOString() : null,
                laycanEnd: sp.laycan_end ? new Date(sp.laycan_end).toISOString() : null,
                vesselName: sp.vessel_name,
                gar: db?.gar || null,
                ts: db?.ts || null,
                ash: db?.ash || null,
                tm: db?.tm || null,
                projectId: db?.projectId || null,
                picId: db?.picId || null,
                picName: sp.pic_name,
                createdAt: db?.createdAt || new Date().toISOString(),
                updatedAt: sp.updated_at || new Date().toISOString()
            };
        });

        // 4. Asynchronous Reconciliation (Sync Sheet changes to DB)
        Promise.resolve().then(async () => {
            try {
                const sheetIds = new Set(sheetRes.projects!.map(p => p.id));

                // Update or create DB records from Sheet data
                for (const p of sheetRes.projects!) {
                    const existing = dbMap.get(p.id);
                    if (existing) {
                        await prisma.salesDeal.update({
                            where: { id: p.id },
                            data: {
                                buyer: p.buyer,
                                buyerCountry: p.buyer_country,
                                type: p.type,
                                quantity: p.quantity,
                                pricePerMt: p.price_per_mt,
                                totalValue: p.total_value,
                                status: p.status,
                                vesselName: p.vessel_name,
                                laycanStart: p.laycan_start ? new Date(p.laycan_start) : null,
                                laycanEnd: p.laycan_end ? new Date(p.laycan_end) : null,
                                picName: p.pic_name,
                                isDeleted: false
                            }
                        });
                    } else {
                        await prisma.salesDeal.create({
                            data: {
                                id: p.id,
                                dealNumber: p.id,
                                buyer: p.buyer,
                                buyerCountry: p.buyer_country,
                                type: p.type,
                                quantity: p.quantity,
                                pricePerMt: p.price_per_mt,
                                totalValue: p.total_value,
                                status: p.status,
                                vesselName: p.vessel_name,
                                laycanStart: p.laycan_start ? new Date(p.laycan_start) : null,
                                laycanEnd: p.laycan_end ? new Date(p.laycan_end) : null,
                                picName: p.pic_name,
                                createdBy: "system",
                                createdByName: "System",
                                shippingTerms: "FOB"
                            }
                        });
                    }
                }

                // Track deletions
                const toDelete = dbDeals.filter(d => !sheetIds.has(d.id));
                for (const d of toDelete) {
                    await prisma.salesDeal.update({
                        where: { id: d.id },
                        data: { isDeleted: true }
                    });
                }
            } catch (e) {
                console.error("Reconciliation error in Projects:", e);
            }
        });

        return NextResponse.json({ success: true, deals: mergedDeals });
    } catch (error) {
        console.error("GET /api/memory/sales-deals error:", error);
        return NextResponse.json({ error: "Failed to fetch sales deals" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const data = await req.json();
        const id = `SD-${Date.now()}`;
        const dealNumber = data.deal_number || data.dealNumber || id;

        // SpreadSheet First: Push to Sheet
        const rowData = [
            id,
            data.buyer || "-",
            data.buyer_country || data.buyerCountry || "-",
            data.type || "export",
            data.quantity || 0,
            data.price_per_mt || data.pricePerMt || 0,
            data.total_value || data.totalValue || 0,
            data.status || "confirmed",
            data.vessel_name || data.vesselName || "-",
            data.laycan_start || data.laycanStart || "-",
            data.laycan_end || data.laycanEnd || "-",
            data.pic_name || data.picName || session.user.name,
            new Date().toISOString()
        ];

        await appendRow(SHEET_NAME, rowData);

        // Then update DB
        const deal = await prisma.$transaction(async (tx) => {
            const newDeal = await tx.salesDeal.create({
                data: {
                    id: id,
                    dealNumber: dealNumber,
                    status: data.status || "confirmed",
                    buyer: data.buyer,
                    buyerCountry: data.buyer_country || data.buyerCountry,
                    type: data.type || "export",
                    shippingTerms: data.shipping_terms || data.shippingTerms || "FOB",
                    quantity: (data.quantity !== undefined) ? parseFloat(data.quantity.toString()) : 0,
                    pricePerMt: (data.price_per_mt !== undefined) ? parseFloat(data.price_per_mt.toString()) : (data.pricePerMt ? parseFloat(data.pricePerMt.toString()) : null),
                    totalValue: (data.total_value !== undefined) ? parseFloat(data.total_value.toString()) : (data.totalValue ? parseFloat(data.totalValue.toString()) : null),
                    laycanStart: (data.laycan_start || data.laycanStart) ? new Date(data.laycan_start || data.laycanStart) : null,
                    laycanEnd: (data.laycan_end || data.laycanEnd) ? new Date(data.laycan_end || data.laycanEnd) : null,
                    vesselName: data.vessel_name || data.vesselName,
                    gar: data.spec?.gar ? parseFloat(data.spec.gar.toString()) : null,
                    ts: data.spec?.ts ? parseFloat(data.spec.ts.toString()) : null,
                    ash: data.spec?.ash ? parseFloat(data.spec.ash.toString()) : null,
                    tm: data.spec?.tm ? parseFloat(data.spec.tm.toString()) : null,
                    projectId: data.project_id || data.projectId,
                    picId: data.pic_id || data.picId,
                    picName: data.pic_name || data.picName || session.user.name,
                    createdByName: session.user.name,
                    createdBy: session.user.id
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "CREATE",
                    entity: "SalesDeal",
                    entityId: newDeal.id,
                    details: JSON.stringify(newDeal)
                }
            });

            return newDeal;
        });

        // The Frontend maps from `deal` returned, format it explicitly or trust the Prisma formatting.
        return NextResponse.json({ success: true, deal });
    } catch (error) {
        console.error("POST /api/memory/sales-deals error:", error);
        return NextResponse.json({ error: "Failed to create sales deal" }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const data = await req.json();
        if (!data.id) return NextResponse.json({ error: "Sales Deal ID missing" }, { status: 400 });

        const existingRecord = await prisma.salesDeal.findUnique({ where: { id: data.id } });
        if (!existingRecord || existingRecord.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const userRole = session.user.role?.toLowerCase() || "";
        if (existingRecord.createdBy !== session.user.id && !["ceo", "director", "manager"].includes(userRole)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Spreadsheet First: Update Sheet
        const rowIndex = await findRowIndex(SHEET_NAME, 0, data.id);
        if (rowIndex > 0) {
            const sheetRes = await syncProjectsFromSheet();
            const existingSheet = sheetRes.projects?.find(p => p.id === data.id);
            const rowData = [
                data.id,
                data.buyer ?? existingSheet?.buyer ?? "-",
                data.buyer_country ?? data.buyerCountry ?? existingSheet?.buyer_country ?? "-",
                data.type ?? existingSheet?.type ?? "export",
                data.quantity ?? existingSheet?.quantity ?? 0,
                data.price_per_mt ?? data.pricePerMt ?? existingSheet?.price_per_mt ?? 0,
                data.total_value ?? data.totalValue ?? existingSheet?.total_value ?? 0,
                data.status ?? existingSheet?.status ?? "confirmed",
                data.vessel_name ?? data.vesselName ?? existingSheet?.vessel_name ?? "-",
                data.laycan_start ?? data.laycanStart ?? existingSheet?.laycan_start ?? "-",
                data.laycan_end ?? data.laycanEnd ?? existingSheet?.laycan_end ?? "-",
                data.pic_name ?? data.picName ?? existingSheet?.pic_name ?? session.user.name,
                new Date().toISOString()
            ];
            await updateRow(SHEET_NAME, rowIndex, rowData);
        }

        const deal = await prisma.$transaction(async (tx) => {
            const updatedDeal = await tx.salesDeal.update({
                where: { id: data.id },
                data: {
                    status: data.status,
                    buyer: data.buyer,
                    buyerCountry: data.buyer_country || data.buyerCountry,
                    type: data.type,
                    shippingTerms: data.shipping_terms || data.shippingTerms,
                    quantity: (data.quantity !== undefined) ? parseFloat(data.quantity.toString()) : undefined,
                    pricePerMt: (data.price_per_mt !== undefined) ? parseFloat(data.price_per_mt.toString()) : (data.pricePerMt !== undefined ? parseFloat(data.pricePerMt.toString()) : undefined),
                    totalValue: (data.total_value !== undefined) ? parseFloat(data.total_value.toString()) : (data.totalValue !== undefined ? parseFloat(data.totalValue.toString()) : undefined),
                    laycanStart: (data.laycan_start || data.laycanStart) ? new Date(data.laycan_start || data.laycanStart) : undefined,
                    laycanEnd: (data.laycan_end || data.laycanEnd) ? new Date(data.laycan_end || data.laycanEnd) : undefined,
                    vesselName: data.vessel_name || data.vesselName,
                    gar: data.spec?.gar ? parseFloat(data.spec.gar.toString()) : undefined,
                    ts: data.spec?.ts ? parseFloat(data.spec.ts.toString()) : undefined,
                    ash: data.spec?.ash ? parseFloat(data.spec.ash.toString()) : undefined,
                    tm: data.spec?.tm ? parseFloat(data.spec.tm.toString()) : undefined,
                    projectId: data.project_id || data.projectId,
                    picId: data.pic_id || data.picId,
                    picName: data.pic_name || data.picName
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "UPDATE",
                    entity: "SalesDeal",
                    entityId: updatedDeal.id,
                    details: JSON.stringify(data)
                }
            });

            return updatedDeal;
        });

        return NextResponse.json({ success: true, deal });
    } catch (error) {
        console.error("PUT /api/memory/sales-deals error:", error);
        return NextResponse.json({ error: "Failed to update sales deal" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const url = new URL(req.url);
        const id = url.searchParams.get("id");
        if (!id) return NextResponse.json({ error: "Sales Deal ID missing" }, { status: 400 });

        const existingRecord = await prisma.salesDeal.findUnique({ where: { id } });
        if (!existingRecord || existingRecord.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const userRole = session.user.role?.toLowerCase() || "";
        if (existingRecord.createdBy !== session.user.id && !["ceo", "director", "manager"].includes(userRole)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Spreadsheet First: Delete Row
        const rowIndex = await findRowIndex(SHEET_NAME, 0, id);
        if (rowIndex > 0) {
            await deleteRow(SHEET_NAME, rowIndex);
        }

        await prisma.$transaction(async (tx) => {
            await tx.salesDeal.update({
                where: { id },
                data: { isDeleted: true }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "DELETE",
                    entity: "SalesDeal",
                    entityId: id,
                    details: JSON.stringify({ isDeleted: true })
                }
            });
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/memory/sales-deals error:", error);
        return NextResponse.json({ error: "Failed to delete sales deal" }, { status: 500 });
    }
}
