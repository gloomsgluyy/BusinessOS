import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { syncExpensesFromSheet } from "@/app/actions/sheet-actions";
import { appendRow, upsertRow, deleteRow, findRowIndex } from "@/lib/google-sheets";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // 1. PULL DARI GOOGLE SHEETS DULU (Primary Source of Truth)
        try {
            const sheetData = await syncExpensesFromSheet();
            if (sheetData.success && sheetData.purchases) {
                // Upsert ke lokal DB sbg backup menangkap data
                const upsertPromises = sheetData.purchases.map(p =>
                    prisma.purchaseRequest.upsert({
                        where: { id: p.id },
                        update: {
                            requestNumber: p.request_number, category: p.category,
                            supplier: p.supplier, description: p.description,
                            amount: p.amount, priority: p.priority, status: p.status,
                        },
                        create: {
                            id: p.id,
                            requestNumber: p.request_number || `PR-${Math.floor(Date.now() / 1000)}`,
                            category: p.category || "Other",
                            supplier: p.supplier, description: p.description,
                            amount: p.amount || 0, priority: p.priority || "medium",
                            status: p.status || "pending",
                            createdByName: "System", createdBy: "system"
                        }
                    })
                );
                await Promise.allSettled(upsertPromises);

                // --- REKONSILIASI PENGHAPUSAN (DELETION) ---
                // Jika dari Google Sheets ada baris yg dihapus manual, kita harus menghapusnya di database lokal
                const remoteIds = new Set(sheetData.purchases.map(p => p.id));
                const localRecords = await prisma.purchaseRequest.findMany({
                    where: { isDeleted: false },
                    select: { id: true }
                });

                const deletePromises = localRecords
                    .filter(loc => !remoteIds.has(loc.id))
                    .map(loc =>
                        prisma.purchaseRequest.update({
                            where: { id: loc.id },
                            data: { isDeleted: true }
                        })
                    );

                if (deletePromises.length > 0) {
                    await Promise.allSettled(deletePromises);
                    console.log(`[Sync] Menghapus ${deletePromises.length} local purchase requests karena tidak ditemukan di Google Sheets.`);
                }

                // --- KEMBALIKAN DATA LANGSUNG DARI GOOGLE SHEETS UNTUK UI ---
                const formattedRemote = sheetData.purchases.map(p => ({
                    id: p.id,
                    requestNumber: p.request_number,
                    category: p.category,
                    supplier: p.supplier,
                    description: p.description,
                    amount: p.amount,
                    priority: p.priority,
                    status: p.status,
                    ocrData: undefined, // OCR data is not synced to sheet in detail
                    createdAt: new Date(),
                    updatedAt: p.updated_at ? new Date(p.updated_at) : new Date()
                }));

                return NextResponse.json({ success: true, purchases: formattedRemote });
            }
        } catch (e) {
            console.error("Failed to pull from sheets", e);
        }

        // 2. Fetch data dari DB utk ditampilkan ke UI jika gagal
        const purchases = await prisma.purchaseRequest.findMany({
            where: { isDeleted: false },
            orderBy: { createdAt: "desc" }
        });

        // Parse OCR back to JSON for UI
        const formatted = purchases.map(p => {
            let ocrData: any = undefined;
            if (p.ocrData) {
                try { ocrData = JSON.parse(p.ocrData); } catch { ocrData = undefined; }
            }
            return { ...p, ocrData };
        });

        return NextResponse.json({ success: true, purchases: formatted });
    } catch (error) {
        console.error("GET /api/memory/purchases error:", error);
        return NextResponse.json({ error: "Failed to fetch purchases" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const data = await req.json();
        const requestNumber = data.requestNumber || `PR-${Math.floor(Date.now() / 1000)}`;
        const amountNum = data.amount ? parseFloat(data.amount.toString()) : 0;

        let ocrDataObj = null;
        if (data.ocrData) ocrDataObj = JSON.stringify(data.ocrData);

        // CREATE IN DATABASE (Capture DB)
        const newPurchase = await prisma.$transaction(async (tx) => {
            const created = await tx.purchaseRequest.create({
                data: {
                    requestNumber: requestNumber,
                    category: data.category || "Other",
                    supplier: data.supplier,
                    description: data.description,
                    amount: amountNum,
                    priority: data.priority || "medium",
                    status: data.status || "pending",
                    imageUrl: data.imageUrl,
                    createdByName: session.user.name,
                    createdBy: session.user.id,
                    notes: data.notes,
                    isAnomaly: data.isAnomaly || false,
                    anomalyReason: data.anomalyReason,
                    ocrData: ocrDataObj
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id, userName: session.user.name || "Unknown",
                    action: "CREATE", entity: "PurchaseRequest", entityId: created.id,
                    details: JSON.stringify(created)
                }
            });

            return created;
        });

        // WRITE DIRECTLY TO SPREADSHEET (Primary Source of truth)
        try {
            const dateStr = newPurchase.createdAt.toISOString().split('T')[0];
            const updatedStr = newPurchase.updatedAt.toISOString();

            const rowValues = [
                newPurchase.id,
                newPurchase.requestNumber,
                dateStr,
                newPurchase.category,
                newPurchase.supplier || "-",
                newPurchase.description || "-",
                newPurchase.amount.toString(),
                newPurchase.priority,
                newPurchase.status,
                newPurchase.createdByName || "System",
                newPurchase.imageUrl || "",
                updatedStr
            ];

            await appendRow("Expenses", rowValues);
        } catch (sheetErr) {
            console.error("Failed writing to Google Sheets in POST /purchases", sheetErr);
        }

        return NextResponse.json({ success: true, purchase: newPurchase });
    } catch (error) {
        console.error("POST /api/memory/purchases error:", error);
        return NextResponse.json({ error: "Failed to create purchase" }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const data = await req.json();
        if (!data.id) return NextResponse.json({ error: "Purchase ID missing" }, { status: 400 });

        const existingRecord = await prisma.purchaseRequest.findUnique({ where: { id: data.id } });
        if (!existingRecord || existingRecord.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const userRole = session.user.role?.toLowerCase() || "";
        if (existingRecord.createdBy !== session.user.id && !["ceo", "director", "manager"].includes(userRole)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // UPDATE IN DATABASE (Capture DB)
        const updatedPurchase = await prisma.$transaction(async (tx) => {
            let ocrDataUp;
            if (data.ocrData) ocrDataUp = JSON.stringify(data.ocrData);

            const updated = await tx.purchaseRequest.update({
                where: { id: data.id },
                data: {
                    category: data.category, supplier: data.supplier,
                    description: data.description,
                    amount: data.amount ? parseFloat(data.amount.toString()) : undefined,
                    priority: data.priority, status: data.status,
                    imageUrl: data.imageUrl, notes: data.notes,
                    approvedBy: data.approvedBy,
                    isAnomaly: data.isAnomaly, anomalyReason: data.anomalyReason,
                    ocrData: ocrDataUp
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id, userName: session.user.name || "Unknown",
                    action: "UPDATE", entity: "PurchaseRequest", entityId: updated.id,
                    details: JSON.stringify(data)
                }
            });

            return updated;
        });

        // UPDATE DIRECTLY TO SPREADSHEET (Primary Source of truth)
        try {
            const dateStr = updatedPurchase.createdAt.toISOString().split('T')[0];
            const updatedStr = updatedPurchase.updatedAt.toISOString();

            const rowValues = [
                updatedPurchase.id,
                updatedPurchase.requestNumber,
                dateStr,
                updatedPurchase.category,
                updatedPurchase.supplier || "-",
                updatedPurchase.description || "-",
                updatedPurchase.amount.toString(),
                updatedPurchase.priority,
                updatedPurchase.status,
                updatedPurchase.createdByName || "System",
                updatedPurchase.imageUrl || "",
                updatedStr
            ];

            await upsertRow("Expenses", 0, updatedPurchase.id, rowValues);
        } catch (sheetErr) {
            console.error("Failed modifying Google Sheets in PUT /purchases", sheetErr);
        }

        return NextResponse.json({ success: true, purchase: updatedPurchase });
    } catch (error) {
        console.error("PUT /api/memory/purchases error:", error);
        return NextResponse.json({ error: "Failed to update purchase" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const url = new URL(req.url);
        const id = url.searchParams.get("id");
        if (!id) return NextResponse.json({ error: "Purchase ID missing" }, { status: 400 });

        const existingRecord = await prisma.purchaseRequest.findUnique({ where: { id } });
        if (!existingRecord || existingRecord.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const userRole = session.user.role?.toLowerCase() || "";
        if (existingRecord.createdBy !== session.user.id && !["ceo", "director", "manager"].includes(userRole)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // DEL IN DATABASE (Capture DB)
        await prisma.$transaction(async (tx) => {
            await tx.purchaseRequest.update({
                where: { id },
                data: { isDeleted: true }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id, userName: session.user.name || "Unknown",
                    action: "DELETE", entity: "PurchaseRequest", entityId: id,
                    details: JSON.stringify({ isDeleted: true })
                }
            });
        });

        // DEL FROM SPREADSHEETS DIRECTLY (Primary Source of truth)
        try {
            const rowIndex = await findRowIndex("Expenses", 0, id);
            if (rowIndex > 0) {
                await deleteRow("Expenses", rowIndex);
            }
        } catch (sheetErr) {
            console.error("Failed deleting from Google Sheets in DELETE /purchases", sheetErr);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/memory/purchases error:", error);
        return NextResponse.json({ error: "Failed to delete purchase" }, { status: 500 });
    }
}
