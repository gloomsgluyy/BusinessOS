import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { syncAllMarketPriceToSheet } from "@/app/actions/sheet-actions";

import { PushService } from "@/lib/push-to-sheets";

async function triggerPush() {
    PushService.debouncedPush("marketPrice").catch(err => console.error("Push failed:", err));
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

        // Normalize date to start of day (YYYY-MM-DD) for uniqueness
        const inputDate = data.date ? new Date(data.date) : new Date();
        const dateStr = inputDate.toISOString().split("T")[0];
        const normalizedDate = new Date(dateStr);

        const price = await prisma.$transaction(async (tx) => {
            // Find existing entry for this date to support upsert
            const existing = await tx.marketPrice.findFirst({
                where: {
                    date: normalizedDate,
                    isDeleted: false
                }
            });

            const priceData = {
                date: normalizedDate,
                ici1: (data.ici1 !== undefined && data.ici1 !== null) ? parseFloat(data.ici1.toString()) : ((data.ici_1 !== undefined && data.ici_1 !== null) ? parseFloat(data.ici_1.toString()) : undefined),
                ici2: (data.ici2 !== undefined && data.ici2 !== null) ? parseFloat(data.ici2.toString()) : ((data.ici_2 !== undefined && data.ici_2 !== null) ? parseFloat(data.ici_2.toString()) : undefined),
                ici3: (data.ici3 !== undefined && data.ici3 !== null) ? parseFloat(data.ici3.toString()) : ((data.ici_3 !== undefined && data.ici_3 !== null) ? parseFloat(data.ici_3.toString()) : undefined),
                ici4: (data.ici4 !== undefined && data.ici4 !== null) ? parseFloat(data.ici4.toString()) : ((data.ici_4 !== undefined && data.ici_4 !== null) ? parseFloat(data.ici_4.toString()) : undefined),
                ici5: (data.ici5 !== undefined && data.ici5 !== null) ? parseFloat(data.ici5.toString()) : ((data.ici_5 !== undefined && data.ici_5 !== null) ? parseFloat(data.ici_5.toString()) : undefined),
                newcastle: data.newcastle ? parseFloat(data.newcastle.toString()) : undefined,
                hba: data.hba ? parseFloat(data.hba.toString()) : undefined,
                source: data.source || "Manual Entry"
            };

            let result;
            if (existing) {
                // Update existing
                result = await tx.marketPrice.update({
                    where: { id: existing.id },
                    data: priceData
                });
            } else {
                // Create new
                result = await tx.marketPrice.create({
                    data: {
                        ...priceData,
                        ici1: priceData.ici1 || null,
                        ici2: priceData.ici2 || null,
                        ici3: priceData.ici3 || null,
                        ici4: priceData.ici4 || null,
                        ici5: priceData.ici5 || null,
                    }
                });
            }

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: existing ? "UPDATE" : "CREATE",
                    entity: "MarketPrice",
                    entityId: result.id,
                    details: JSON.stringify(result)
                }
            });

            return result;
        });

        // Trigger Google Sheets Sync in background
        await triggerPush();

        return NextResponse.json({ success: true, price });
    } catch (error) {
        console.error("POST /api/memory/market-prices error:", error);
        return NextResponse.json({ error: "Failed to create/update market price" }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const data = await req.json();
        if (!data.id) return NextResponse.json({ error: "Market Price ID missing" }, { status: 400 });

        const existingRecord = await prisma.marketPrice.findUnique({ where: { id: data.id } });
        if (!existingRecord || existingRecord.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const userRole = session.user.role?.toLowerCase() || "";
        if (!["ceo", "director", "manager"].includes(userRole)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const price = await prisma.$transaction(async (tx) => {
            const updatedPrice = await tx.marketPrice.update({
                where: { id: data.id },
                data: {
                    date: data.date ? new Date(data.date) : undefined,
                    ici1: (data.ici1 !== undefined && data.ici1 !== null) ? parseFloat(data.ici1.toString()) : ((data.ici_1 !== undefined && data.ici_1 !== null) ? parseFloat(data.ici_1.toString()) : undefined),
                    ici2: (data.ici2 !== undefined && data.ici2 !== null) ? parseFloat(data.ici2.toString()) : ((data.ici_2 !== undefined && data.ici_2 !== null) ? parseFloat(data.ici_2.toString()) : undefined),
                    ici3: (data.ici3 !== undefined && data.ici3 !== null) ? parseFloat(data.ici3.toString()) : ((data.ici_3 !== undefined && data.ici_3 !== null) ? parseFloat(data.ici_3.toString()) : undefined),
                    ici4: (data.ici4 !== undefined && data.ici4 !== null) ? parseFloat(data.ici4.toString()) : ((data.ici_4 !== undefined && data.ici_4 !== null) ? parseFloat(data.ici_4.toString()) : undefined),
                    ici5: (data.ici5 !== undefined && data.ici5 !== null) ? parseFloat(data.ici5.toString()) : ((data.ici_5 !== undefined && data.ici_5 !== null) ? parseFloat(data.ici_5.toString()) : undefined),
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
        await triggerPush();

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

        const existingRecord = await prisma.marketPrice.findUnique({ where: { id } });
        if (!existingRecord || existingRecord.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const userRole = session.user.role?.toLowerCase() || "";
        if (!["ceo", "director", "manager"].includes(userRole)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

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
        await triggerPush();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/memory/market-prices error:", error);
        return NextResponse.json({ error: "Failed to delete market price" }, { status: 500 });
    }
}
