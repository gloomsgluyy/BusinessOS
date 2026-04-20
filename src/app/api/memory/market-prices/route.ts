import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { PushService } from "@/lib/push-to-sheets";
import { v4 as uuidv4 } from 'uuid';

async function triggerPush() {
    PushService.debouncedPush("marketPrice").catch(err => console.error("Optional Sheet push failed:", err));
}

/** Best-effort audit log — never throws, so FK issues won't crash the main operation */
async function tryAuditLog(userId: string, userName: string, action: string, entityId: string, details: string) {
    try {
        await prisma.auditLog.create({
            data: { userId, userName, action, entity: "MarketPrice", entityId, details }
        });
    } catch (err: any) {
        console.warn("[AuditLog] Skipped — user not found in DB (stale session?):", err?.code);
    }
}
import { parsePaginationParams, buildPaginationMeta } from "@/lib/pagination";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const url = new URL(req.url);
        const pagination = parsePaginationParams(url.searchParams);
        const where = { isDeleted: false };

        if (pagination) {
            const [prices, totalItems] = await Promise.all([
                prisma.marketPrice.findMany({ where, orderBy: { date: pagination.sortOrder }, skip: pagination.skip, take: pagination.take }),
                prisma.marketPrice.count({ where }),
            ]);
            const meta = buildPaginationMeta(totalItems, pagination.page, pagination.pageSize);
            return NextResponse.json({ success: true, prices, meta });
        }

        // DATABASE-FIRST: Read directly from database
        const prices = await prisma.marketPrice.findMany({
            where,
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
        const inputDate = data.date ? new Date(data.date) : new Date();
        const dateStr = inputDate.toISOString().split("T")[0];
        const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
        const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);

        const priceFields = {
            ici1: parseFloat((data.ici1 ?? data.ici_1 ?? 0).toString()) || 0,
            ici2: parseFloat((data.ici2 ?? data.ici_2 ?? 0).toString()) || 0,
            ici3: parseFloat((data.ici3 ?? data.ici_3 ?? 0).toString()) || 0,
            ici4: parseFloat((data.ici4 ?? data.ici_4 ?? 0).toString()) || 0,
            ici5: parseFloat((data.ici5 ?? data.ici_5 ?? 0).toString()) || 0,
            newcastle: parseFloat((data.newcastle ?? 0).toString()) || 0,
            hba: parseFloat((data.hba ?? 0).toString()) || 0,
            hbaI: parseFloat((data.hba1 ?? data.hba_1 ?? 0).toString()) || 0,
            hbaII: parseFloat((data.hba2 ?? data.hba_2 ?? 0).toString()) || 0,
            hbaIII: parseFloat((data.hba3 ?? data.hba_3 ?? 0).toString()) || 0,
            source: data.source || "Manual Entry"
        };

        // UPSERT by date: if a record already exists for today, update it — no duplicates
        const existing = await prisma.marketPrice.findFirst({
            where: { date: { gte: dayStart, lte: dayEnd }, isDeleted: false }
        });

        let result;
        if (existing) {
            result = await prisma.marketPrice.update({ where: { id: existing.id }, data: priceFields });
            await tryAuditLog(session.user.id, session.user.name || "Unknown", "UPDATE", result.id, JSON.stringify(priceFields));
        } else {
            result = await prisma.marketPrice.create({ data: { id: uuidv4(), date: new Date(dateStr), ...priceFields } });
            await tryAuditLog(session.user.id, session.user.name || "Unknown", "CREATE", result.id, JSON.stringify(result));
        }

        await triggerPush();

        return NextResponse.json({ success: true, price: result, updated: !!existing });
    } catch (error) {
        console.error("POST /api/memory/market-prices error:", error);
        return NextResponse.json({ error: "Failed to create market price", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const data = await req.json();
        if (!data.id) return NextResponse.json({ error: "ID missing" }, { status: 400 });

        const userRole = session.user.role?.toLowerCase() || "";
        if (!["ceo", "director", "manager"].includes(userRole)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const inputDate = data.date ? new Date(data.date) : new Date();
        const dateStr = inputDate.toISOString().split("T")[0];

        // DATABASE-FIRST: Update market price (no auditLog in transaction)
        const updatedPrice = await prisma.marketPrice.update({
            where: { id: data.id },
            data: {
                date: new Date(dateStr),
                ici1: parseFloat((data.ici1 ?? data.ici_1 ?? 0).toString()) || 0,
                ici2: parseFloat((data.ici2 ?? data.ici_2 ?? 0).toString()) || 0,
                ici3: parseFloat((data.ici3 ?? data.ici_3 ?? 0).toString()) || 0,
                ici4: parseFloat((data.ici4 ?? data.ici_4 ?? 0).toString()) || 0,
                ici5: parseFloat((data.ici5 ?? data.ici_5 ?? 0).toString()) || 0,
                newcastle: parseFloat((data.newcastle ?? 0).toString()) || 0,
                hba: parseFloat((data.hba ?? 0).toString()) || 0,
                hbaI: parseFloat((data.hba1 ?? data.hba_1 ?? 0).toString()) || 0,
                hbaII: parseFloat((data.hba2 ?? data.hba_2 ?? 0).toString()) || 0,
                hbaIII: parseFloat((data.hba3 ?? data.hba_3 ?? 0).toString()) || 0,
                source: data.source
            }
        });

        // Best-effort audit log
        await tryAuditLog(
            session.user.id,
            session.user.name || "Unknown",
            "UPDATE",
            updatedPrice.id,
            JSON.stringify(data)
        );

        // Optional push to Sheets for backup/export
        await triggerPush();

        return NextResponse.json({ success: true, price: updatedPrice });
    } catch (error) {
        console.error("PUT /api/memory/market-prices error:", error);
        return NextResponse.json({ error: "Failed to update market price", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const url = new URL(req.url);
        const id = url.searchParams.get("id");
        if (!id) return NextResponse.json({ error: "ID missing" }, { status: 400 });

        const userRole = session.user.role?.toLowerCase() || "";
        if (!["ceo", "director", "manager"].includes(userRole)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        // DATABASE-FIRST: Delete from database
        await prisma.marketPrice.update({ where: { id }, data: { isDeleted: true } });

        // Best-effort audit log
        await tryAuditLog(
            session.user.id,
            session.user.name || "Unknown",
            "DELETE",
            id,
            JSON.stringify({ isDeleted: true })
        );

        // Optional push to Sheets for backup/export
        await triggerPush();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/memory/market-prices error:", error);
        return NextResponse.json({ error: "Failed to delete", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}
