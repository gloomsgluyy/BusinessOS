import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { syncAllMarketPriceToSheet } from "@/app/actions/sheet-actions";

async function pushToSheets() {
    try {
        const prices = await prisma.marketPrice.findMany({
            where: { isDeleted: false },
            orderBy: { date: "desc" }
        });
        const formatted = prices.map((m: any) => ({
            id: m.id, date: m.date ? m.date.toISOString().split('T')[0] : "",
            ici_1: m.ici1, ici_2: m.ici2, ici_3: m.ici3, ici_4: m.ici4,
            newcastle: m.newcastle, hba: m.hba, source: m.source
        }));
        await syncAllMarketPriceToSheet(formatted);
    } catch (err) {
        console.error("Failed to sync Market Prices to sheets:", err);
    }
}

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const prices = await prisma.marketPrice.findMany({
            where: { isDeleted: false },
            orderBy: { date: "desc" }
        });

        return NextResponse.json({ success: true, prices });
    } catch (error) {
        console.error("GET /api/memory/market-prices error:", error);
        return NextResponse.json({ error: "Failed to fetch market prices" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const data = await req.json();

        const price = await prisma.$transaction(async (tx) => {
            const newPrice = await tx.marketPrice.create({
                data: {
                    date: data.date ? new Date(data.date) : new Date(),
                    ici1: (data.ici1 !== undefined && data.ici1 !== null) ? parseFloat(data.ici1.toString()) : ((data.ici_1 !== undefined && data.ici_1 !== null) ? parseFloat(data.ici_1.toString()) : null),
                    ici2: (data.ici2 !== undefined && data.ici2 !== null) ? parseFloat(data.ici2.toString()) : ((data.ici_2 !== undefined && data.ici_2 !== null) ? parseFloat(data.ici_2.toString()) : null),
                    ici3: (data.ici3 !== undefined && data.ici3 !== null) ? parseFloat(data.ici3.toString()) : ((data.ici_3 !== undefined && data.ici_3 !== null) ? parseFloat(data.ici_3.toString()) : null),
                    ici4: (data.ici4 !== undefined && data.ici4 !== null) ? parseFloat(data.ici4.toString()) : ((data.ici_4 !== undefined && data.ici_4 !== null) ? parseFloat(data.ici_4.toString()) : null),
                    newcastle: data.newcastle ? parseFloat(data.newcastle.toString()) : null,
                    hba: data.hba ? parseFloat(data.hba.toString()) : null,
                    source: data.source || "Manual Entry"
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "CREATE",
                    entity: "MarketPrice",
                    entityId: newPrice.id,
                    details: JSON.stringify(newPrice)
                }
            });

            return newPrice;
        });

        // Trigger Google Sheets Sync in background
        pushToSheets();

        return NextResponse.json({ success: true, price });
    } catch (error) {
        console.error("POST /api/memory/market-prices error:", error);
        return NextResponse.json({ error: "Failed to create market price" }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const data = await req.json();
        if (!data.id) return NextResponse.json({ error: "Market Price ID missing" }, { status: 400 });

        const price = await prisma.$transaction(async (tx) => {
            const updatedPrice = await tx.marketPrice.update({
                where: { id: data.id },
                data: {
                    date: data.date ? new Date(data.date) : undefined,
                    ici1: (data.ici1 !== undefined && data.ici1 !== null) ? parseFloat(data.ici1.toString()) : ((data.ici_1 !== undefined && data.ici_1 !== null) ? parseFloat(data.ici_1.toString()) : undefined),
                    ici2: (data.ici2 !== undefined && data.ici2 !== null) ? parseFloat(data.ici2.toString()) : ((data.ici_2 !== undefined && data.ici_2 !== null) ? parseFloat(data.ici_2.toString()) : undefined),
                    ici3: (data.ici3 !== undefined && data.ici3 !== null) ? parseFloat(data.ici3.toString()) : ((data.ici_3 !== undefined && data.ici_3 !== null) ? parseFloat(data.ici_3.toString()) : undefined),
                    ici4: (data.ici4 !== undefined && data.ici4 !== null) ? parseFloat(data.ici4.toString()) : ((data.ici_4 !== undefined && data.ici_4 !== null) ? parseFloat(data.ici_4.toString()) : undefined),
                    newcastle: data.newcastle ? parseFloat(data.newcastle.toString()) : undefined,
                    hba: data.hba ? parseFloat(data.hba.toString()) : undefined,
                    source: data.source
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "UPDATE",
                    entity: "MarketPrice",
                    entityId: updatedPrice.id,
                    details: JSON.stringify(data)
                }
            });

            return updatedPrice;
        });

        // Trigger Google Sheets Sync in background
        pushToSheets();

        return NextResponse.json({ success: true, price });
    } catch (error) {
        console.error("PUT /api/memory/market-prices error:", error);
        return NextResponse.json({ error: "Failed to update market price" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const url = new URL(req.url);
        const id = url.searchParams.get("id");
        if (!id) return NextResponse.json({ error: "Market Price ID missing" }, { status: 400 });

        await prisma.$transaction(async (tx) => {
            await tx.marketPrice.update({
                where: { id },
                data: { isDeleted: true }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "DELETE",
                    entity: "MarketPrice",
                    entityId: id,
                    details: JSON.stringify({ isDeleted: true })
                }
            });
        });

        // Trigger Google Sheets Sync in background
        pushToSheets();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/memory/market-prices error:", error);
        return NextResponse.json({ error: "Failed to delete market price" }, { status: 500 });
    }
}
