const fs = require('fs');

const content = `import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { syncMarketPriceFromSheet } from "@/app/actions/sheet-actions";
import { appendRow, upsertRow, deleteRow, findRowIndex } from "@/lib/google-sheets";
import { v4 as uuidv4 } from 'uuid';

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // 1. PULL DARI GOOGLE SHEETS DULU (Primary Source of Truth)
        try {
            const sheetData = await syncMarketPriceFromSheet();
            if (sheetData.success && sheetData.prices) {
                const formattedRemote = sheetData.prices.map(p => ({
                    id: p.id,
                    date: p.date,
                    ici1: p.ici_1,
                    ici2: p.ici_2,
                    ici3: p.ici_3,
                    ici4: p.ici_4,
                    ici5: p.ici_5,
                    newcastle: p.newcastle,
                    hba: p.hba,
                    source: p.source,
                    createdAt: p.updated_at || new Date().toISOString(),
                    updatedAt: p.updated_at || new Date().toISOString(),
                    isDeleted: false,
                }));

                // Upsert ke DB agar sync, tapi respons API langsung data Spreadsheet.
                const upsertPromises = formattedRemote.map(p => 
                    prisma.marketPrice.upsert({
                        where: { id: p.id },
                        update: {
                            date: p.date ? new Date(p.date) : new Date(),
                            ici1: p.ici1, ici2: p.ici2, ici3: p.ici3, ici4: p.ici4, ici5: p.ici5,
                            newcastle: p.newcastle, hba: p.hba, source: p.source
                        },
                        create: {
                            id: p.id,
                            date: p.date ? new Date(p.date) : new Date(),
                            ici1: p.ici1, ici2: p.ici2, ici3: p.ici3, ici4: p.ici4, ici5: p.ici5,
                            newcastle: p.newcastle, hba: p.hba, source: p.source
                        }
                    })
                );
                Promise.allSettled(upsertPromises).catch(err => console.error("Backup DB MarketPrice failed:", err));

                return NextResponse.json({ success: true, prices: formattedRemote });
            }
        } catch (e) {
            console.error("Failed to pull market prices from sheets, falling back to DB:", e);
        }

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
            source: data.source || "Manual Entry"
        };
        
        // 1. TULIS KE GOOGLE SHEETS DAHULU
        try {
            const rowValues = [
                priceData.id, dateStr,
                priceData.ici1, priceData.ici2, priceData.ici3, priceData.ici4, priceData.ici5,
                priceData.newcastle, priceData.hba, priceData.source, new Date().toISOString()
            ];
            await appendRow("Market Price", rowValues);
        } catch (sheetErr) {
            console.error("Gagal simpan ke Sheets:", sheetErr);
            return NextResponse.json({ error: "Gagal menyimpan ke Google Sheets" }, { status: 500 });
        }

        // 2. SIMPAN KE DATABASE
        const result = await prisma.marketPrice.create({ data: priceData });
        try { await prisma.auditLog.create({ data: { userId: session.user.id, userName: session.user.name||"Unknown", action: "CREATE", entity: "MarketPrice", entityId: result.id, details: JSON.stringify(result) } }); } catch(e){}

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

        // 1. UPDATE GOOGLE SHEETS
        try {
            const rowValues = [
                data.id, dateStr,
                data.ici1 ?? data.ici_1 ?? 0,
                data.ici2 ?? data.ici_2 ?? 0,
                data.ici3 ?? data.ici_3 ?? 0,
                data.ici4 ?? data.ici_4 ?? 0,
                data.ici5 ?? data.ici_5 ?? 0,
                data.newcastle ?? 0, data.hba ?? 0, data.source || "Manual Entry", new Date().toISOString()
            ];
            await upsertRow("Market Price", 0, data.id, rowValues);
        } catch (sheetErr) {
            return NextResponse.json({ error: "Gagal update Google Sheets" }, { status: 500 });
        }

        // 2. UPDATE DATABASE
        const updatedPrice = await prisma.marketPrice.update({
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
                source: data.source
            }
        });
        try { await prisma.auditLog.create({ data: { userId: session.user.id, userName: session.user.name||"Unknown", action: "UPDATE", entity: "MarketPrice", entityId: updatedPrice.id, details: JSON.stringify(data) } }); } catch(e){}

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

        // 1. DELETE FROM GOOGLE SHEETS
        try {
            const rowIndex = await findRowIndex("Market Price", 0, id);
            if (rowIndex > 0) await deleteRow("Market Price", rowIndex);
        } catch (sheetErr) {
            return NextResponse.json({ error: "Gagal menghapus dari Google Sheets" }, { status: 500 });
        }

        // 2. SOFT DELETE DATABASE
        await prisma.marketPrice.update({ where: { id }, data: { isDeleted: true } });
        try { await prisma.auditLog.create({ data: { userId: session.user.id, userName: session.user.name||"Unknown", action: "DELETE", entity: "MarketPrice", entityId: id, details: JSON.stringify({ isDeleted: true }) } }); } catch(e){}

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }
}
`;
fs.writeFileSync('src/app/api/memory/market-prices/route.ts', content);
