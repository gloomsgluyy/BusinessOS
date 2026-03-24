import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { syncSourcesFromSheet } from "@/app/actions/sheet-actions";
import { appendRow, upsertRow, deleteRow, findRowIndex } from "@/lib/google-sheets";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // 1. PULL DARI GOOGLE SHEETS DULU (Primary Source of Truth)
        try {
            const sheetData = await syncSourcesFromSheet();
            if (sheetData.success && sheetData.sources) {
                // Upsert ke lokal DB sbg backup dlm db
                const upsertPromises = sheetData.sources.map(s =>
                    prisma.sourceSupplier.upsert({
                        where: { id: s.id },
                        update: {
                            name: s.name,
                            region: s.region,
                            calorieRange: s.calorie_range,
                            gar: s.spec?.gar,
                            ts: s.spec?.ts,
                            ash: s.spec?.ash,
                            tm: s.spec?.tm,
                            im: s.spec?.im,
                            fc: s.spec?.fc,
                            nar: s.spec?.nar,
                            adb: s.spec?.adb,
                            jettyPort: s.jetty_port,
                            anchorage: s.anchorage,
                            stockAvailable: s.stock_available,
                            minStockAlert: s.min_stock_alert,
                            kycStatus: s.kyc_status,
                            psiStatus: s.psi_status,
                            fobBargeOnly: s.fob_barge_only,
                            priceLinkedIndex: s.price_linked_index,
                            fobBargePriceUsd: s.fob_barge_price_usd,
                            contractType: s.contract_type,
                            picName: s.pic_name,
                            iupNumber: s.iup_number
                        },
                        create: {
                            id: s.id || "",
                            name: s.name,
                            region: s.region,
                            calorieRange: s.calorie_range,
                            gar: s.spec?.gar,
                            ts: s.spec?.ts,
                            ash: s.spec?.ash,
                            tm: s.spec?.tm,
                            jettyPort: s.jetty_port,
                            anchorage: s.anchorage,
                            stockAvailable: s.stock_available,
                            minStockAlert: s.min_stock_alert,
                            kycStatus: s.kyc_status || "not_started",
                            psiStatus: s.psi_status || "not_started",
                            fobBargeOnly: s.fob_barge_only || false,
                            priceLinkedIndex: s.price_linked_index,
                            fobBargePriceUsd: s.fob_barge_price_usd,
                            contractType: s.contract_type,
                            picName: s.pic_name,
                            iupNumber: s.iup_number
                        }
                    })
                );
                await Promise.allSettled(upsertPromises);

                // --- REKONSILIASI PENGHAPUSAN (DELETION) ---
                const remoteIds = new Set(sheetData.sources.map(s => s.id));
                const localRecords = await prisma.sourceSupplier.findMany({
                    where: { isDeleted: false },
                    select: { id: true }
                });

                const deletePromises = localRecords
                    .filter(loc => !remoteIds.has(loc.id))
                    .map(loc =>
                        prisma.sourceSupplier.update({
                            where: { id: loc.id },
                            data: { isDeleted: true }
                        })
                    );

                if (deletePromises.length > 0) {
                    await Promise.allSettled(deletePromises);
                    console.log(`[Sync] Menghapus ${deletePromises.length} local sources karena tidak ditemukan di Google Sheets.`);
                }

                // --- KEMBALIKAN DATA LANGSUNG DARI GOOGLE SHEETS UNTUK UI ---
                const formattedRemote = sheetData.sources.map(s => {
                    return {
                        id: s.id,
                        name: s.name,
                        region: s.region,
                        calorieRange: s.calorie_range,
                        spec: {
                            gar: s.spec?.gar,
                            ts: s.spec?.ts,
                            ash: s.spec?.ash,
                            tm: s.spec?.tm,
                            im: s.spec?.im,
                            fc: s.spec?.fc,
                            nar: s.spec?.nar,
                            adb: s.spec?.adb,
                        },
                        jettyPort: s.jetty_port,
                        anchorage: s.anchorage,
                        stockAvailable: s.stock_available,
                        minStockAlert: s.min_stock_alert,
                        kycStatus: s.kyc_status,
                        psiStatus: s.psi_status,
                        fobBargeOnly: s.fob_barge_only,
                        priceLinkedIndex: s.price_linked_index,
                        fobBargePriceUsd: s.fob_barge_price_usd,
                        contractType: s.contract_type,
                        iupNumber: s.iup_number,
                        picName: s.pic_name,
                        createdAt: s.created_at ? new Date(s.created_at) : new Date(),
                        updatedAt: s.updated_at ? new Date(s.updated_at) : new Date()
                    };
                });

                const response = NextResponse.json({ success: true, sources: formattedRemote });
                response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
                response.headers.set('Pragma', 'no-cache');
                response.headers.set('Expires', '0');
                response.headers.set('Surrogate-Control', 'no-store');
                return response;
            }
        } catch (e) {
            console.error("Failed to pull sources from sheets", e);
        }

        const sources = await prisma.sourceSupplier.findMany({
            where: { isDeleted: false },
            orderBy: { createdAt: "desc" }
        });

        const formatted = sources.map(s => {
            return {
                ...s,
                spec: { gar: s.gar, ts: s.ts, ash: s.ash, tm: s.tm, im: s.im, fc: s.fc, nar: s.nar, adb: s.adb }
            };
        });

        const response = NextResponse.json({ success: true, sources: formatted });
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        return response;
    } catch (error) {
        console.error("GET /api/memory/sources error:", error);
        return NextResponse.json({ error: "Failed to fetch sources" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const data = await req.json();
        const crypto = require("crypto");
        const newId = crypto.randomUUID();

        // WRITE DIRECTLY TO SPREADSHEET (Primary Source of truth)
        try {
            const rowValues = [
                newId,
                data.name || "",
                data.region || "",
                data.calorieRange || "",
                data.spec?.gar !== undefined && data.spec?.gar !== null ? parseFloat(data.spec.gar.toString()) : 0,
                data.spec?.ts !== undefined && data.spec?.ts !== null ? parseFloat(data.spec.ts.toString()) : 0,
                data.spec?.ash !== undefined && data.spec?.ash !== null ? parseFloat(data.spec.ash.toString()) : 0,
                data.spec?.tm !== undefined && data.spec?.tm !== null ? parseFloat(data.spec.tm.toString()) : 0,
                data.jettyPort || "-",
                data.anchorage || "-",
                data.stockAvailable !== undefined && data.stockAvailable !== null ? parseFloat(data.stockAvailable.toString()) : 0,
                data.minStockAlert !== undefined && data.minStockAlert !== null ? parseFloat(data.minStockAlert.toString()) : 0,
                data.kycStatus || "not_started",
                data.psiStatus || "not_started",
                data.fobBargeOnly ? "Yes" : "No",
                data.priceLinkedIndex || "-",
                data.fobBargePriceUsd !== undefined && data.fobBargePriceUsd !== null ? parseFloat(data.fobBargePriceUsd.toString()) : 0,
                data.contractType || "-",
                data.picName || session.user.name || "-",
                data.iupNumber || "-",
                new Date().toISOString(),
                data.spec?.im !== undefined && data.spec?.im !== null ? parseFloat(data.spec.im.toString()) : 0,
                data.spec?.fc !== undefined && data.spec?.fc !== null ? parseFloat(data.spec.fc.toString()) : 0,
                data.spec?.nar !== undefined && data.spec?.nar !== null ? parseFloat(data.spec.nar.toString()) : 0,
                data.spec?.adb !== undefined && data.spec?.adb !== null ? parseFloat(data.spec.adb.toString()) : 0
            ];

            await appendRow("Sources", rowValues);
        } catch (sheetErr) {
            console.error("Failed writing to Google Sheets in POST /sources", sheetErr);
            return NextResponse.json({ error: "Failed to create source in spreadsheet" }, { status: 500 });
        }

        // CREATE IN DATABASE (Capture DB)
        const source = await prisma.$transaction(async (tx) => {
            const newSource = await tx.sourceSupplier.create({
                data: {
                    id: newId,
                    name: data.name,
                    region: data.region,
                    calorieRange: data.calorieRange,
                    gar: data.spec?.gar !== undefined && data.spec?.gar !== null ? parseFloat(data.spec.gar.toString()) : null,
                    ts: data.spec?.ts !== undefined && data.spec?.ts !== null ? parseFloat(data.spec.ts.toString()) : null,
                    ash: data.spec?.ash !== undefined && data.spec?.ash !== null ? parseFloat(data.spec.ash.toString()) : null,
                    tm: data.spec?.tm !== undefined && data.spec?.tm !== null ? parseFloat(data.spec.tm.toString()) : null,
                    im: data.spec?.im !== undefined && data.spec?.im !== null ? parseFloat(data.spec.im.toString()) : null,
                    fc: data.spec?.fc !== undefined && data.spec?.fc !== null ? parseFloat(data.spec.fc.toString()) : null,
                    nar: data.spec?.nar !== undefined && data.spec?.nar !== null ? parseFloat(data.spec.nar.toString()) : null,
                    adb: data.spec?.adb !== undefined && data.spec?.adb !== null ? parseFloat(data.spec.adb.toString()) : null,
                    jettyPort: data.jettyPort,
                    anchorage: data.anchorage,
                    stockAvailable: data.stockAvailable !== undefined && data.stockAvailable !== null ? parseFloat(data.stockAvailable.toString()) : 0,
                    minStockAlert: data.minStockAlert !== undefined && data.minStockAlert !== null ? parseFloat(data.minStockAlert.toString()) : null,
                    kycStatus: data.kycStatus || "not_started",
                    psiStatus: data.psiStatus || "not_started",
                    fobBargeOnly: data.fobBargeOnly || false,
                    priceLinkedIndex: data.priceLinkedIndex,
                    fobBargePriceUsd: data.fobBargePriceUsd !== undefined && data.fobBargePriceUsd !== null ? parseFloat(data.fobBargePriceUsd.toString()) : null,
                    contractType: data.contractType,
                    picName: data.picName || session.user.name,
                    iupNumber: data.iupNumber
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "CREATE",
                    entity: "SourceSupplier",
                    entityId: newSource.id,
                    details: JSON.stringify(newSource)
                }
            });

            return newSource;
        });

        return NextResponse.json({ success: true, source });
    } catch (error) {
        console.error("POST /api/memory/sources error:", error);
        return NextResponse.json({ error: "Failed to create source" }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const data = await req.json();
        if (!data.id) return NextResponse.json({ error: "Source ID missing" }, { status: 400 });

        const existingRecord = await prisma.sourceSupplier.findUnique({ where: { id: data.id } });
        if (!existingRecord || existingRecord.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const userRole = session.user.role?.toLowerCase() || "";
        if (!["ceo", "director", "manager"].includes(userRole)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // UPDATE DIRECTLY TO SPREADSHEET (Primary Source of truth)
        try {
            const rowValues = [
                data.id,
                data.name || "",
                data.region || "",
                data.calorieRange || "",
                data.spec?.gar !== undefined && data.spec?.gar !== null ? parseFloat(data.spec.gar.toString()) : 0,
                data.spec?.ts !== undefined && data.spec?.ts !== null ? parseFloat(data.spec.ts.toString()) : 0,
                data.spec?.ash !== undefined && data.spec?.ash !== null ? parseFloat(data.spec.ash.toString()) : 0,
                data.spec?.tm !== undefined && data.spec?.tm !== null ? parseFloat(data.spec.tm.toString()) : 0,
                data.jettyPort || "-",
                data.anchorage || "-",
                data.stockAvailable !== undefined && data.stockAvailable !== null ? parseFloat(data.stockAvailable.toString()) : 0,
                data.minStockAlert !== undefined && data.minStockAlert !== null ? parseFloat(data.minStockAlert.toString()) : 0,
                data.kycStatus || "not_started",
                data.psiStatus || "not_started",
                data.fobBargeOnly ? "Yes" : "No",
                data.priceLinkedIndex || "-",
                data.fobBargePriceUsd !== undefined && data.fobBargePriceUsd !== null ? parseFloat(data.fobBargePriceUsd.toString()) : 0,
                data.contractType || "-",
                data.picName || existingRecord.picName || "-",
                data.iupNumber || "-",
                new Date().toISOString(),
                data.spec?.im !== undefined && data.spec?.im !== null ? parseFloat(data.spec.im.toString()) : 0,
                data.spec?.fc !== undefined && data.spec?.fc !== null ? parseFloat(data.spec.fc.toString()) : 0,
                data.spec?.nar !== undefined && data.spec?.nar !== null ? parseFloat(data.spec.nar.toString()) : 0,
                data.spec?.adb !== undefined && data.spec?.adb !== null ? parseFloat(data.spec.adb.toString()) : 0
            ];

            await upsertRow("Sources", 0, data.id, rowValues);
        } catch (sheetErr) {
            console.error("Failed modifying Google Sheets in PUT /sources", sheetErr);
            return NextResponse.json({ error: "Failed to update source in spreadsheet" }, { status: 500 });
        }

        // UPDATE IN DATABASE (Capture DB)
        const source = await prisma.$transaction(async (tx) => {
            const updatedSource = await tx.sourceSupplier.update({
                where: { id: data.id },
                data: {
                    name: data.name,
                    region: data.region,
                    calorieRange: data.calorieRange,
                    gar: data.spec?.gar !== undefined && data.spec?.gar !== null ? parseFloat(data.spec.gar.toString()) : undefined,
                    ts: data.spec?.ts !== undefined && data.spec?.ts !== null ? parseFloat(data.spec.ts.toString()) : undefined,
                    ash: data.spec?.ash !== undefined && data.spec?.ash !== null ? parseFloat(data.spec.ash.toString()) : undefined,
                    tm: data.spec?.tm !== undefined && data.spec?.tm !== null ? parseFloat(data.spec.tm.toString()) : undefined,
                    im: data.spec?.im !== undefined && data.spec?.im !== null ? parseFloat(data.spec.im.toString()) : undefined,
                    fc: data.spec?.fc !== undefined && data.spec?.fc !== null ? parseFloat(data.spec.fc.toString()) : undefined,
                    nar: data.spec?.nar !== undefined && data.spec?.nar !== null ? parseFloat(data.spec.nar.toString()) : undefined,
                    adb: data.spec?.adb !== undefined && data.spec?.adb !== null ? parseFloat(data.spec.adb.toString()) : undefined,
                    jettyPort: data.jettyPort !== undefined ? data.jettyPort : undefined,
                    anchorage: data.anchorage !== undefined ? data.anchorage : undefined,
                    stockAvailable: data.stockAvailable !== undefined && data.stockAvailable !== null ? parseFloat(data.stockAvailable.toString()) : undefined,
                    minStockAlert: data.minStockAlert !== undefined && data.minStockAlert !== null ? parseFloat(data.minStockAlert.toString()) : undefined,
                    kycStatus: data.kycStatus,
                    psiStatus: data.psiStatus,
                    fobBargeOnly: data.fobBargeOnly,
                    priceLinkedIndex: data.priceLinkedIndex,
                    fobBargePriceUsd: data.fobBargePriceUsd !== undefined && data.fobBargePriceUsd !== null ? parseFloat(data.fobBargePriceUsd.toString()) : undefined,
                    contractType: data.contractType,
                    picName: data.picName,
                    iupNumber: data.iupNumber
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "UPDATE",
                    entity: "SourceSupplier",
                    entityId: updatedSource.id,
                    details: JSON.stringify(data)
                }
            });

            return updatedSource;
        });

        return NextResponse.json({ success: true, source });
    } catch (error) {
        console.error("PUT /api/memory/sources error:", error);
        return NextResponse.json({ error: "Failed to update source" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const url = new URL(req.url);
        const id = url.searchParams.get("id");
        if (!id) return NextResponse.json({ error: "Source ID missing" }, { status: 400 });

        const existingRecord = await prisma.sourceSupplier.findUnique({ where: { id } });
        if (!existingRecord || existingRecord.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const userRole = session.user.role?.toLowerCase() || "";
        if (!["ceo", "director", "manager"].includes(userRole)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // DEL FROM SPREADSHEETS DIRECTLY FIRST
        try {
            const rowIndex = await findRowIndex("Sources", 0, id);
            if (rowIndex > 0) {
                await deleteRow("Sources", rowIndex);
            } else {
                console.warn(`Row for source ${id} not found in Google Sheets. Removing from local DB anyway.`);
            }
        } catch (sheetErr) {
            console.error("Failed deleting from Google Sheets in DELETE /sources", sheetErr);
            return NextResponse.json({ error: "Failed to delete from spreadsheet" }, { status: 500 });
        }

        // DEL IN DATABASE (Capture DB)
        await prisma.$transaction(async (tx) => {
            await tx.sourceSupplier.update({
                where: { id },
                data: { isDeleted: true }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "DELETE",
                    entity: "SourceSupplier",
                    entityId: id,
                    details: JSON.stringify({ isDeleted: true })
                }
            });
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/memory/sources error:", error);
        return NextResponse.json({ error: "Failed to delete source" }, { status: 500 });
    }
}
