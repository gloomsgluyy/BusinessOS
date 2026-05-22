import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { PushService } from "@/lib/push-to-sheets";
import { v4 as uuidv4 } from 'uuid';
import { canWriteModuleForRole } from "@/lib/role-access";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/pagination";

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

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

let marketPriceColumnsReady = false;
const MARKET_PRICE_TIME_ZONE = "Asia/Jakarta";

async function ensureMarketPriceColumns() {
    if (marketPriceColumnsReady) return;
    await prisma.$executeRawUnsafe(`ALTER TABLE "MarketPrice" ADD COLUMN IF NOT EXISTS "updatedBy" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "MarketPrice" ADD COLUMN IF NOT EXISTS "updatedByName" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "MarketPrice" ADD COLUMN IF NOT EXISTS "history" TEXT;`);
    marketPriceColumnsReady = true;
}

function parseHistory(value: unknown) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value !== "string") return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function marketDateKey(value = new Date()) {
    const parts = new Intl.DateTimeFormat("en", {
        timeZone: MARKET_PRICE_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(value);
    const year = parts.find((part) => part.type === "year")?.value || "1970";
    const month = parts.find((part) => part.type === "month")?.value || "01";
    const day = parts.find((part) => part.type === "day")?.value || "01";
    return `${year}-${month}-${day}`;
}

function inputDateKey(value: unknown) {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    if (value instanceof Date && !Number.isNaN(value.getTime())) return marketDateKey(value);
    if (value) {
        const parsed = new Date(String(value));
        if (!Number.isNaN(parsed.getTime())) return marketDateKey(parsed);
    }
    return marketDateKey();
}

function dateRangeForMarketDay(dateKey: string) {
    return {
        start: new Date(`${dateKey}T00:00:00.000+07:00`),
        end: new Date(`${dateKey}T23:59:59.999+07:00`),
    };
}

function buildHistoryEntry(params: {
    userId: string;
    userName: string;
    source: string;
    prices: Record<string, number | string>;
    action: "manual_update" | "auto_scrape" | "create" | "update";
}) {
    return {
        id: uuidv4(),
        at: new Date().toISOString(),
        by: params.userId,
        byName: params.userName,
        source: params.source || "Manual Entry",
        action: params.action,
        prices: {
            ici_1: Number(params.prices.ici1 || 0),
            ici_2: Number(params.prices.ici2 || 0),
            ici_3: Number(params.prices.ici3 || 0),
            ici_4: Number(params.prices.ici4 || 0),
            ici_5: Number(params.prices.ici5 || 0),
            newcastle: Number(params.prices.newcastle || 0),
            hba: Number(params.prices.hba || 0),
            hba_1: Number(params.prices.hbaI || 0),
            hba_2: Number(params.prices.hbaII || 0),
            hba_3: Number(params.prices.hbaIII || 0),
        },
    };
}

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        await ensureMarketPriceColumns();

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
        if (!canWriteModuleForRole(session.user.role, "MARKET_PRICE")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        await ensureMarketPriceColumns();

        const data = await req.json();
        const dateStr = inputDateKey(data.date);
        const todayStr = marketDateKey();
        const requestedSource = String(data.source || "Manual Entry");
        const isManual = requestedSource.toLowerCase().includes("manual");
        if (isManual && dateStr !== todayStr) {
            return NextResponse.json({ error: "Manual price updates are only allowed for today" }, { status: 400 });
        }
        const { start: dayStart, end: dayEnd } = dateRangeForMarketDay(dateStr);

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
            source: requestedSource
        };

        // UPSERT by date: if a record already exists for today, update it — no duplicates
        const existing = await prisma.marketPrice.findFirst({
            where: { date: { gte: dayStart, lte: dayEnd }, isDeleted: false }
        });

        let result;
        if (existing) {
            const history = [
                ...parseHistory((existing as any).history),
                buildHistoryEntry({
                    userId: session.user.id,
                    userName: session.user.name || session.user.email || "Unknown",
                    source: priceFields.source,
                    prices: priceFields,
                    action: isManual ? "manual_update" : "auto_scrape",
                }),
            ].slice(-50);
            result = await prisma.marketPrice.update({
                where: { id: existing.id },
                data: {
                    ...priceFields,
                    updatedBy: session.user.id,
                    updatedByName: session.user.name || session.user.email || "Unknown",
                    history: JSON.stringify(history),
                },
            });
            await tryAuditLog(session.user.id, session.user.name || "Unknown", "UPDATE", result.id, JSON.stringify(priceFields));
        } else {
            const history = [
                buildHistoryEntry({
                    userId: session.user.id,
                    userName: session.user.name || session.user.email || "Unknown",
                    source: priceFields.source,
                    prices: priceFields,
                    action: isManual ? "manual_update" : "create",
                }),
            ];
            result = await prisma.marketPrice.create({
                data: {
                    id: uuidv4(),
                    date: dayStart,
                    ...priceFields,
                    updatedBy: session.user.id,
                    updatedByName: session.user.name || session.user.email || "Unknown",
                    history: JSON.stringify(history),
                },
            });
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
        await ensureMarketPriceColumns();

        const data = await req.json();
        if (!data.id) return NextResponse.json({ error: "ID missing" }, { status: 400 });

        if (!canWriteModuleForRole(session.user.role, "MARKET_PRICE")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const dateStr = inputDateKey(data.date);
        const todayStr = marketDateKey();
        if (dateStr !== todayStr) {
            return NextResponse.json({ error: "Market price updates are only allowed for today" }, { status: 400 });
        }
        const existing = await prisma.marketPrice.findUnique({ where: { id: data.id } });
        if (!existing || existing.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
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
            source: data.source || "Manual Entry",
        };
        const history = [
            ...parseHistory((existing as any).history),
            buildHistoryEntry({
                userId: session.user.id,
                userName: session.user.name || session.user.email || "Unknown",
                source: priceFields.source,
                prices: priceFields,
                action: "manual_update",
            }),
        ].slice(-50);

        // DATABASE-FIRST: Update market price (no auditLog in transaction)
        const updatedPrice = await prisma.marketPrice.update({
            where: { id: data.id },
            data: {
                date: dateRangeForMarketDay(dateStr).start,
                ...priceFields,
                updatedBy: session.user.id,
                updatedByName: session.user.name || session.user.email || "Unknown",
                history: JSON.stringify(history),
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
        await ensureMarketPriceColumns();

        const url = new URL(req.url);
        const id = url.searchParams.get("id");
        if (!id) return NextResponse.json({ error: "ID missing" }, { status: 400 });

        if (!canWriteModuleForRole(session.user.role, "MARKET_PRICE")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
