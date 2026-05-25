import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { SheetsFirstService } from "@/lib/sheets-first-service";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/pagination";
import { canModifyOwnedRecord } from "@/lib/role-access";

const parseMoney = (value: unknown): number => {
    if (value === null || value === undefined || value === "") return 0;
    const parsed = parseFloat(value.toString());
    return Number.isFinite(parsed) ? parsed : 0;
};

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // Sync only when explicitly requested: ?sync or ?sync=1 / true / yes
        // Normal cache-busting params like ?t=... must NOT trigger sync.
        const url = new URL(req.url);
        const syncRaw = url.searchParams.get('sync');
        const shouldSync =
            url.searchParams.has('sync') &&
            (syncRaw === null ||
                syncRaw === '' ||
                ['1', 'true', 'yes'].includes(syncRaw.toLowerCase()));

        // Sync from Google Sheets if requested (to get latest data)
        if (shouldSync) {
            try {
                await SheetsFirstService.syncPLForecastsFromSheet();
            } catch (syncError) {
                console.error("Sync from Sheet failed (non-critical):", syncError);
                // Continue to read from DB cache even if sync fails
            }
        }

        // Read from DB cache (fast read path)
        let forecasts = await SheetsFirstService.listPLForecasts();

        // Apply pagination after all sync/heal operations
        const pagination = parsePaginationParams(url.searchParams);
        if (pagination) {
            const totalItems = forecasts.length;
            const meta = buildPaginationMeta(totalItems, pagination.page, pagination.pageSize);
            const paginated = forecasts.slice(pagination.skip, pagination.skip + pagination.take);
            return NextResponse.json({ success: true, forecasts: paginated, meta });
        }

        return NextResponse.json({ success: true, forecasts });
    } catch (error) {
        console.error("GET /api/memory/pl-forecasts error:", error);
        return NextResponse.json({ error: "Failed to fetch PL Forecasts" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const data = await req.json();

        // Auto calculate GP
        const quantity = parseMoney(data.quantity);
        const sellingPrice = parseMoney(data.sellingPrice ?? data.selling_price);
        const buyingPrice = parseMoney(data.buyingPrice ?? data.buying_price);
        const freightCost = parseMoney(data.freightCost ?? data.freight_cost);
        const royaltyCost = parseMoney(data.royaltyCost ?? data.royalty_cost);
        const taxCost = parseMoney(data.taxCost ?? data.tax_cost);
        const surveyCost = parseMoney(data.surveyCost ?? data.survey_cost);
        const paymentCost = parseMoney(data.paymentCost ?? data.payment_cost);
        const otherCost = parseMoney(data.otherCost ?? data.other_cost);

        const grossProfitMt = sellingPrice - buyingPrice - freightCost - royaltyCost - taxCost - surveyCost - paymentCost - otherCost;
        const totalGrossProfit = grossProfitMt * quantity;

        // SHEETS-FIRST WRITE: Write to Sheets, then DB
        const forecast = await SheetsFirstService.createPLForecast({
            dealId: data.deal_id,
            dealNumber: data.deal_number,
            projectName: data.project_name || data.deal_number,
            buyer: data.buyer,
            type: data.type || "export",
            status: data.status || "forecast",
            quantity,
            sellingPrice,
            buyingPrice,
            freightCost,
            royaltyCost,
            taxCost,
            surveyCost,
            paymentCost,
            otherCost,
            grossProfitMt,
            totalGrossProfit,
            createdBy: data.created_by || session.user.id
        });

        // Audit log (separate transaction)
        try {
            await prisma.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "CREATE",
                    entity: "PLForecast",
                    entityId: forecast.id,
                    details: JSON.stringify(forecast)
                }
            });
        } catch (auditError) {
            console.error("Audit log failed (non-critical):", auditError);
        }

        return NextResponse.json({ success: true, forecast });
    } catch (error: any) {
        console.error("POST /api/memory/pl-forecasts error:", error);
        return NextResponse.json({ error: error.message || "Failed to create PL Forecast" }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const data = await req.json();
        console.log('[API PUT] Received data:', JSON.stringify(data, null, 2));

        if (!data.id) return NextResponse.json({ error: "Forecast ID missing" }, { status: 400 });

        const existingRecord = await prisma.pLForecast.findUnique({ where: { id: data.id } });
        if (!existingRecord || existingRecord.isDeleted) {
            console.log('[API PUT] Record not found or deleted:', data.id);
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        console.log('[API PUT] Existing record:', JSON.stringify(existingRecord, null, 2));

        if (!canModifyOwnedRecord({
            role: session.user.role,
            userId: session.user.id,
            createdBy: existingRecord.createdBy,
            moduleName: "PL_SALES",
        })) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Prepare update data (with type conversions)
        const updateData: any = {};
        if (data.dealId !== undefined) updateData.dealId = data.dealId;
        if (data.dealNumber !== undefined) updateData.dealNumber = data.dealNumber;
        if (data.projectName !== undefined) updateData.projectName = data.projectName;
        if (data.buyer !== undefined) updateData.buyer = data.buyer;
        if (data.type !== undefined) updateData.type = data.type;
        if (data.status !== undefined) updateData.status = data.status;
        if (data.quantity !== undefined) updateData.quantity = parseFloat(data.quantity.toString());
        if (data.sellingPrice !== undefined) updateData.sellingPrice = parseFloat(data.sellingPrice.toString());
        if (data.buyingPrice !== undefined) updateData.buyingPrice = parseFloat(data.buyingPrice.toString());
        if (data.freightCost !== undefined) updateData.freightCost = parseFloat(data.freightCost.toString());
        if (data.royaltyCost !== undefined) updateData.royaltyCost = parseFloat(data.royaltyCost.toString());
        if (data.taxCost !== undefined) updateData.taxCost = parseFloat(data.taxCost.toString());
        if (data.surveyCost !== undefined) updateData.surveyCost = parseFloat(data.surveyCost.toString());
        if (data.paymentCost !== undefined) updateData.paymentCost = parseFloat(data.paymentCost.toString());
        if (data.otherCost !== undefined) updateData.otherCost = parseFloat(data.otherCost.toString());

        // Calculate GP (will be recalculated in service)
        const quantity = updateData.quantity !== undefined ? updateData.quantity : existingRecord.quantity;
        const sellingPrice = updateData.sellingPrice !== undefined ? updateData.sellingPrice : existingRecord.sellingPrice;
        const buyingPrice = updateData.buyingPrice !== undefined ? updateData.buyingPrice : existingRecord.buyingPrice;
        const freightCost = updateData.freightCost !== undefined ? updateData.freightCost : existingRecord.freightCost;
        const royaltyCost = updateData.royaltyCost !== undefined ? updateData.royaltyCost : existingRecord.royaltyCost;
        const taxCost = updateData.taxCost !== undefined ? updateData.taxCost : existingRecord.taxCost;
        const surveyCost = updateData.surveyCost !== undefined ? updateData.surveyCost : existingRecord.surveyCost;
        const paymentCost = updateData.paymentCost !== undefined ? updateData.paymentCost : existingRecord.paymentCost;
        const otherCost = updateData.otherCost !== undefined ? updateData.otherCost : existingRecord.otherCost;

        updateData.grossProfitMt = sellingPrice - buyingPrice - freightCost - royaltyCost - taxCost - surveyCost - paymentCost - otherCost;
        updateData.totalGrossProfit = updateData.grossProfitMt * quantity;
        updateData.quantity = quantity;
        updateData.sellingPrice = sellingPrice;
        updateData.buyingPrice = buyingPrice;
        updateData.freightCost = freightCost;
        updateData.royaltyCost = royaltyCost;
        updateData.taxCost = taxCost;
        updateData.surveyCost = surveyCost;
        updateData.paymentCost = paymentCost;
        updateData.otherCost = otherCost;

        console.log('[API PUT] Update data prepared:', JSON.stringify(updateData, null, 2));

        // SHEETS-FIRST UPDATE: Update Sheets, then DB
        const forecast = await SheetsFirstService.updatePLForecast(data.id, updateData);

        // Audit log (separate transaction)
        try {
            await prisma.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "UPDATE",
                    entity: "PLForecast",
                    entityId: forecast.id,
                    details: JSON.stringify(data)
                }
            });
        } catch (auditError) {
            console.error("Audit log failed (non-critical):", auditError);
        }

        return NextResponse.json({ success: true, forecast });
    } catch (error: any) {
        console.error("PUT /api/memory/pl-forecasts error:", error);
        return NextResponse.json({ error: error.message || "Failed to update PL Forecast" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const url = new URL(req.url);
        const id = url.searchParams.get("id");
        if (!id) return NextResponse.json({ error: "Forecast ID missing" }, { status: 400 });

        const existingRecord = await prisma.pLForecast.findUnique({ where: { id } });
        if (!existingRecord || existingRecord.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

        if (!canModifyOwnedRecord({
            role: session.user.role,
            userId: session.user.id,
            createdBy: existingRecord.createdBy,
            moduleName: "PL_SALES",
        })) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // SHEETS-FIRST DELETE: Delete from Sheets, then mark deleted in DB
        await SheetsFirstService.deletePLForecast(id);

        // Audit log (separate transaction)
        try {
            await prisma.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "DELETE",
                    entity: "PLForecast",
                    entityId: id,
                    details: JSON.stringify({ isDeleted: true })
                }
            });
        } catch (auditError) {
            console.error("Audit log failed (non-critical):", auditError);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("DELETE /api/memory/pl-forecasts error:", error);
        return NextResponse.json({ error: error.message || "Failed to delete PL Forecast" }, { status: 500 });
    }
}
