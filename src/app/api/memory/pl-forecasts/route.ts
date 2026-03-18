import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { syncAllPLForecastToSheet } from "@/app/actions/sheet-actions";

import { PushService } from "@/lib/push-to-sheets";

async function triggerPush() {
    PushService.debouncedPush("plForecast").catch(err => console.error("Push failed:", err));
}

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const forecasts = await prisma.pLForecast.findMany({
            where: { isDeleted: false },
            orderBy: { createdAt: "desc" }
        });

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

        const forecast = await prisma.$transaction(async (tx) => {
            const newForecast = await tx.pLForecast.create({
                data: {
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
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "CREATE",
                    entity: "PLForecast",
                    entityId: newForecast.id,
                    details: JSON.stringify(newForecast)
                }
            });

            return newForecast;
        });

        triggerPush();

        return NextResponse.json({ success: true, forecast });
    } catch (error) {
        console.error("POST /api/memory/pl-forecasts error:", error);
        return NextResponse.json({ error: "Failed to create PL Forecast" }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const data = await req.json();
        if (!data.id) return NextResponse.json({ error: "Forecast ID missing" }, { status: 400 });

        const existingRecord = await prisma.pLForecast.findUnique({ where: { id: data.id } });
        if (!existingRecord || existingRecord.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const userRole = session.user.role?.toLowerCase() || "";
        if (existingRecord.createdBy !== session.user.id && !["ceo", "director", "manager"].includes(userRole)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const existing = await prisma.pLForecast.findUnique({ where: { id: data.id } });
        if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

        // Auto calculate GP
        const quantity = data.quantity !== undefined ? parseFloat(data.quantity.toString()) : existing.quantity;
        const sellingPrice = data.selling_price !== undefined ? parseFloat(data.selling_price.toString()) : existing.sellingPrice;
        const buyingPrice = data.buying_price !== undefined ? parseFloat(data.buying_price.toString()) : existing.buyingPrice;
        const freightCost = data.freight_cost !== undefined ? parseFloat(data.freight_cost.toString()) : existing.freightCost;
        const otherCost = data.other_cost !== undefined ? parseFloat(data.other_cost.toString()) : existing.otherCost;

        const grossProfitMt = sellingPrice - buyingPrice - freightCost - otherCost;
        const totalGrossProfit = grossProfitMt * quantity;

        const forecast = await prisma.$transaction(async (tx) => {
            const updatedForecast = await tx.pLForecast.update({
                where: { id: data.id },
                data: {
                    dealId: data.deal_id,
                    dealNumber: data.deal_number,
                    projectName: data.project_name,
                    buyer: data.buyer,
                    type: data.type,
                    status: data.status,
                    quantity,
                    sellingPrice,
                    buyingPrice,
                    freightCost,
                    otherCost,
                    grossProfitMt,
                    totalGrossProfit
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "UPDATE",
                    entity: "PLForecast",
                    entityId: updatedForecast.id,
                    details: JSON.stringify(data)
                }
            });

            return updatedForecast;
        });

        triggerPush();

        return NextResponse.json({ success: true, forecast });
    } catch (error) {
        console.error("PUT /api/memory/pl-forecasts error:", error);
        return NextResponse.json({ error: "Failed to update PL Forecast" }, { status: 500 });
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

        await prisma.$transaction(async (tx) => {
            await tx.pLForecast.update({
                where: { id },
                data: { isDeleted: true }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "DELETE",
                    entity: "PLForecast",
                    entityId: id,
                    details: JSON.stringify({ isDeleted: true })
                }
            });
        });

        triggerPush();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/memory/pl-forecasts error:", error);
        return NextResponse.json({ error: "Failed to delete PL Forecast" }, { status: 500 });
    }
}
