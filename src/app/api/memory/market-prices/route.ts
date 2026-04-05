import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { PushService } from "@/lib/push-to-sheets";
import { v4 as uuidv4 } from 'uuid';

async function triggerPush() {
    PushService.debouncedPush("marketPrice").catch(err => console.error("Optional Sheet push failed:", err));
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // DATABASE-FIRST: Read directly from database
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
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const dbUser = await prisma.user.findUnique({ where: { id: session.user.id } });
        if (!dbUser) return NextResponse.json({ error: "User session invalid." }, { status: 401 });

        const data = await req.json();
        const inputDate = data.date ? new Date(data.date) : new Date();
        const dateStr = inputDate.toISOString().split("T")[0];
        
        const newId = uuidv4();
        const priceData = {
            id: newId,
            date: new Date(dateStr),
            ici1: data.ici1 ?? data.ici_1 ?? 0,
            ici2: data.ici2 ?? data.ici_2 ?? 0,
            ici3: data.ici3 ?? data.ici_3 ?? 0,
            ici4: data.ici4 ?? data.ici_4 ?? 0,
            ici5: data.ici5 ?? data.ici_5 ?? 0,
            newcastle: data.newcastle ?? 0,
            hba: data.hba ?? 0,
            hbaI: data.hba1 ?? data.hba_1 ?? 0,
            hbaII: data.hba2 ?? data.hba_2 ?? 0,
            hbaIII: data.hba3 ?? data.hba_3 ?? 0,
            source: data.source || "Manual Entry"
        };
        
        // DATABASE-FIRST: Write to database as primary source
        const result = await prisma.$transaction(async (tx) => {
            const newPrice = await tx.marketPrice.create({ data: priceData });
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

        // Optional push to Sheets for backup/export
        await triggerPush();

        return NextResponse.json({ success: true, price: result });
    } catch (error) {
        return NextResponse.json({ error: "Failed to create market price" }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const dbUser = await prisma.user.findUnique({ where: { id: session.user.id } });
        if (!dbUser) return NextResponse.json({ error: "User session invalid." }, { status: 401 });

        const data = await req.json();
        if (!data.id) return NextResponse.json({ error: "ID missing" }, { status: 400 });

        const userRole = session.user.role?.toLowerCase() || "";
        if (!["ceo", "director", "manager"].includes(userRole)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const inputDate = data.date ? new Date(data.date) : new Date();
        const dateStr = inputDate.toISOString().split("T")[0];

        // DATABASE-FIRST: Update database as primary source
        const updatedPrice = await prisma.$transaction(async (tx) => {
            const updated = await tx.marketPrice.update({
                where: { id: data.id },
                data: {
                    date: new Date(dateStr),
                    ici1: data.ici1 ?? data.ici_1 ?? 0,
                    ici2: data.ici2 ?? data.ici_2 ?? 0,
                    ici3: data.ici3 ?? data.ici_3 ?? 0,
                    ici4: data.ici4 ?? data.ici_4 ?? 0,
                    ici5: data.ici5 ?? data.ici_5 ?? 0,
                    newcastle: data.newcastle ?? 0,
                    hba: data.hba ?? 0,
                    hbaI: data.hba1 ?? data.hba_1 ?? 0,
                    hbaII: data.hba2 ?? data.hba_2 ?? 0,
                    hbaIII: data.hba3 ?? data.hba_3 ?? 0,
                    source: data.source
                }
            });
            await tx.auditLog.create({ 
                data: { 
                    userId: session.user.id, 
                    userName: session.user.name || "Unknown", 
                    action: "UPDATE", 
                    entity: "MarketPrice", 
                    entityId: updated.id, 
                    details: JSON.stringify(data) 
                } 
            });
            return updated;
        });

        // Optional push to Sheets for backup/export
        await triggerPush();

        return NextResponse.json({ success: true, price: updatedPrice });
    } catch (error) {
        return NextResponse.json({ error: "Failed to update market price" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const url = new URL(req.url);
        const id = url.searchParams.get("id");
        if (!id) return NextResponse.json({ error: "ID missing" }, { status: 400 });

        const userRole = session.user.role?.toLowerCase() || "";
        if (!["ceo", "director", "manager"].includes(userRole)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        // DATABASE-FIRST: Delete from database as primary source
        await prisma.$transaction(async (tx) => {
            await tx.marketPrice.update({ where: { id }, data: { isDeleted: true } });
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

        // Optional push to Sheets for backup/export
        await triggerPush();

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }
}
