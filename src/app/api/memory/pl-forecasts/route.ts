import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { syncAllPLForecastToSheet } from "@/app/actions/sheet-actions";

async function pushToSheets() {
    try {
        const forecasts = await prisma.pLForecast.findMany({
            where: { isDeleted: false },
            orderBy: { createdAt: "desc" }
        });
        const formatted = forecasts.map((f: any) => ({
            id: f.id, project_name: f.projectName, buyer: f.buyer, quantity: f.quantity,
            selling_price: f.sellingPrice, buying_price: f.buyingPrice,
            freight_cost: f.freightCost, other_cost: f.otherCost,
            gross_profit_mt: f.grossProfitMt, total_gross_profit: f.totalGrossProfit,
            updated_at: f.updatedAt.toISOString()
        }));
        await syncAllPLForecastToSheet(formatted);
    } catch (err) {
        console.error("Failed to sync PL Forecast to sheets:", err);
    }
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
        const sellingPrice = data.sellingPrice ? parseFloat(data.sellingPrice.toString()) : 0;
        const buyingPrice = data.buyingPrice ? parseFloat(data.buyingPrice.toString()) : 0;
        const freightCost = data.freightCost ? parseFloat(data.freightCost.toString()) : 0;
        const otherCost = data.otherCost ? parseFloat(data.otherCost.toString()) : 0;

        const grossProfitMt = sellingPrice - buyingPrice - freightCost - otherCost;
        const totalGrossProfit = grossProfitMt * quantity;

        const forecast = await prisma.$transaction(async (tx) => {
            const newForecast = await tx.pLForecast.create({
                data: {
                    projectName: data.project_name,
                    buyer: data.buyer,
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
                    action: "CREATE",
                    entity: "PLForecast",
                    entityId: newForecast.id,
                    details: JSON.stringify(newForecast)
                }
            });

            return newForecast;
        });

        await pushToSheets();

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

        const existing = await prisma.pLForecast.findUnique({ where: { id: data.id } });
        if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

        // Auto calculate GP
        const quantity = data.quantity !== undefined ? parseFloat(data.quantity.toString()) : existing.quantity;
        const sellingPrice = data.sellingPrice !== undefined ? parseFloat(data.sellingPrice.toString()) : existing.sellingPrice;
        const buyingPrice = data.buyingPrice !== undefined ? parseFloat(data.buyingPrice.toString()) : existing.buyingPrice;
        const freightCost = data.freightCost !== undefined ? parseFloat(data.freightCost.toString()) : existing.freightCost;
        const otherCost = data.otherCost !== undefined ? parseFloat(data.otherCost.toString()) : existing.otherCost;

        const grossProfitMt = sellingPrice - buyingPrice - freightCost - otherCost;
        const totalGrossProfit = grossProfitMt * quantity;

        const forecast = await prisma.$transaction(async (tx) => {
            const updatedForecast = await tx.pLForecast.update({
                where: { id: data.id },
                data: {
                    projectName: data.project_name,
                    buyer: data.buyer,
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

        await pushToSheets();

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

        pushToSheets();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/memory/pl-forecasts error:", error);
        return NextResponse.json({ error: "Failed to delete PL Forecast" }, { status: 500 });
    }
}
