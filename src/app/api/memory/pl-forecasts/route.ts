import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { SheetsFirstService } from "@/lib/sheets-first-service";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // Check if sync is requested (via query parameter)
        const url = new URL(req.url);
        const shouldSync = url.searchParams.has('sync') || url.searchParams.has('t');

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
        const forecasts = await SheetsFirstService.listPLForecasts();

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
        const quantity = data.quantity ? parseFloat(data.quantity.toString()) : 0;
        const sellingPrice = data.selling_price ? parseFloat(data.selling_price.toString()) : 0;
        const buyingPrice = data.buying_price ? parseFloat(data.buying_price.toString()) : 0;
        const freightCost = data.freight_cost ? parseFloat(data.freight_cost.toString()) : 0;
        const otherCost = data.other_cost ? parseFloat(data.other_cost.toString()) : 0;

        const grossProfitMt = sellingPrice - buyingPrice - freightCost - otherCost;
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
        
        const userRole = session.user.role?.toLowerCase() || "";
        if (existingRecord.createdBy !== session.user.id && !["ceo", "director", "manager"].includes(userRole)) {
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
        if (data.otherCost !== undefined) updateData.otherCost = parseFloat(data.otherCost.toString());

        // Calculate GP (will be recalculated in service)
        const quantity = updateData.quantity !== undefined ? updateData.quantity : existingRecord.quantity;
        const sellingPrice = updateData.sellingPrice !== undefined ? updateData.sellingPrice : existingRecord.sellingPrice;
        const buyingPrice = updateData.buyingPrice !== undefined ? updateData.buyingPrice : existingRecord.buyingPrice;
        const freightCost = updateData.freightCost !== undefined ? updateData.freightCost : existingRecord.freightCost;
        const otherCost = updateData.otherCost !== undefined ? updateData.otherCost : existingRecord.otherCost;
        
        updateData.grossProfitMt = sellingPrice - buyingPrice - freightCost - otherCost;
        updateData.totalGrossProfit = updateData.grossProfitMt * quantity;
        updateData.quantity = quantity;
        updateData.sellingPrice = sellingPrice;
        updateData.buyingPrice = buyingPrice;
        updateData.freightCost = freightCost;
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
        
        const userRole = session.user.role?.toLowerCase() || "";
        if (existingRecord.createdBy !== session.user.id && !["ceo", "director", "manager"].includes(userRole)) {
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
