import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { syncQualityFromSheet } from "@/app/actions/sheet-actions";
import { appendRow, upsertRow, deleteRow, findRowIndex } from "@/lib/google-sheets";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // 1. PULL DARI GOOGLE SHEETS DULU (Primary Source of Truth)
        try {
            const sheetData = await syncQualityFromSheet();
            if (sheetData.success && sheetData.qualityResults) {

                // Upsert ke DB sebagai backup
                const upsertPromises = sheetData.qualityResults.map(q =>
                    prisma.qualityResult.upsert({
                        where: { id: q.id },
                        update: {
                            cargoId: q.cargo_id,
                            cargoName: q.cargo_name,
                            surveyor: q.surveyor,
                            samplingDate: q.sampling_date ? new Date(q.sampling_date) : null,
                            gar: q.spec_result?.gar ?? null,
                            ts: q.spec_result?.ts ?? null,
                            ash: q.spec_result?.ash ?? null,
                            tm: q.spec_result?.tm ?? null,
                            status: q.status || "pending",
                        },
                        create: {
                            id: q.id,
                            cargoId: q.cargo_id || "",
                            cargoName: q.cargo_name || "",
                            surveyor: q.surveyor,
                            samplingDate: q.sampling_date ? new Date(q.sampling_date) : null,
                            gar: q.spec_result?.gar ?? null,
                            ts: q.spec_result?.ts ?? null,
                            ash: q.spec_result?.ash ?? null,
                            tm: q.spec_result?.tm ?? null,
                            status: q.status || "pending",
                        }
                    })
                );
                await Promise.allSettled(upsertPromises);

                // --- REKONSILIASI PENGHAPUSAN ---
                const remoteIds = new Set(sheetData.qualityResults.map(q => q.id));
                const localRecords = await prisma.qualityResult.findMany({
                    where: { isDeleted: false },
                    select: { id: true }
                });

                const deletePromises = localRecords
                    .filter(loc => !remoteIds.has(loc.id))
                    .map(loc =>
                        prisma.qualityResult.update({
                            where: { id: loc.id },
                            data: { isDeleted: true }
                        })
                    );

                if (deletePromises.length > 0) {
                    await Promise.allSettled(deletePromises);
                    console.log(`[Sync] Removing ${deletePromises.length} local quality results not found in Google Sheets.`);
                }

                // --- KEMBALIKAN DATA DARI SHEET DALAM FORMAT CAMELCASE KE UI ---
                const formattedRemote = sheetData.qualityResults.map(q => ({
                    id: q.id,
                    cargoId: q.cargo_id,
                    cargoName: q.cargo_name,
                    surveyor: q.surveyor,
                    samplingDate: q.sampling_date || null,
                    gar: q.spec_result?.gar ?? null,
                    ts: q.spec_result?.ts ?? null,
                    ash: q.spec_result?.ash ?? null,
                    tm: q.spec_result?.tm ?? null,
                    status: q.status || "pending",
                    createdAt: q.created_at || new Date().toISOString(),
                    updatedAt: q.created_at || new Date().toISOString(),
                    isDeleted: false,
                }));

                return NextResponse.json({ success: true, quality: formattedRemote });
            }
        } catch (e) {
            console.error("Failed to pull quality from sheets, falling back to DB:", e);
        }

        // Fallback ke DB jika sheet gagal
        const quality = await prisma.qualityResult.findMany({
            where: { isDeleted: false },
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json({ success: true, quality });
    } catch (error) {
        console.error("GET /api/memory/quality error:", error);
        return NextResponse.json({ error: "Failed to fetch quality results" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const data = await req.json();

        // 1. SIMPAN KE DATABASE (Capture DB)
        const quality = await prisma.qualityResult.create({
            data: {
                cargoId: data.cargoId,
                cargoName: data.cargoName,
                surveyor: data.surveyor,
                samplingDate: data.samplingDate ? new Date(data.samplingDate) : null,
                gar: data.specResult?.gar ? parseFloat(data.specResult.gar.toString()) : null,
                ts: data.specResult?.ts ? parseFloat(data.specResult.ts.toString()) : null,
                ash: data.specResult?.ash ? parseFloat(data.specResult.ash.toString()) : null,
                tm: data.specResult?.tm ? parseFloat(data.specResult.tm.toString()) : null,
                status: data.status || "pending"
            }
        });

        try {
            await prisma.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "CREATE",
                    entity: "QualityResult",
                    entityId: quality.id,
                    details: JSON.stringify(quality)
                }
            });
        } catch (auditErr) {
            console.warn("Audit log skipped (user FK missing):", auditErr);
        }

        // 2. TULIS KE GOOGLE SHEETS (Primary Source of Truth)
        try {
            const rowValues = [
                quality.id,
                quality.cargoId || "",
                quality.cargoName || "",
                quality.surveyor || "-",
                quality.samplingDate ? quality.samplingDate.toISOString().split("T")[0] : "-",
                quality.gar ?? 0,
                quality.ts ?? 0,
                quality.ash ?? 0,
                quality.tm ?? 0,
                quality.status || "pending",
                quality.updatedAt ? quality.updatedAt.toISOString() : new Date().toISOString()
            ];
            await appendRow("Quality", rowValues);
        } catch (sheetErr) {
            console.error("Failed writing to Google Sheets in POST /quality:", sheetErr);
        }

        return NextResponse.json({ success: true, quality });
    } catch (error) {
        console.error("POST /api/memory/quality error:", error);
        return NextResponse.json({ error: "Failed to create quality result" }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const data = await req.json();
        if (!data.id) return NextResponse.json({ error: "Quality ID missing" }, { status: 400 });

        const existingRecord = await prisma.qualityResult.findUnique({ where: { id: data.id } });
        if (!existingRecord || existingRecord.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const userRole = session.user.role?.toLowerCase() || "";
        if (!["ceo", "director", "manager"].includes(userRole)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // 1. UPDATE DI DATABASE
        const quality = await prisma.qualityResult.update({
            where: { id: data.id },
            data: {
                cargoId: data.cargoId,
                cargoName: data.cargoName,
                surveyor: data.surveyor,
                samplingDate: data.samplingDate ? new Date(data.samplingDate) : undefined,
                gar: data.specResult?.gar ? parseFloat(data.specResult.gar.toString()) : undefined,
                ts: data.specResult?.ts ? parseFloat(data.specResult.ts.toString()) : undefined,
                ash: data.specResult?.ash ? parseFloat(data.specResult.ash.toString()) : undefined,
                tm: data.specResult?.tm ? parseFloat(data.specResult.tm.toString()) : undefined,
                status: data.status
            }
        });

        try {
            await prisma.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "UPDATE",
                    entity: "QualityResult",
                    entityId: quality.id,
                    details: JSON.stringify(data)
                }
            });
        } catch (auditErr) {
            console.warn("Audit log skipped (user FK missing):", auditErr);
        }

        // 2. UPDATE DI GOOGLE SHEETS
        try {
            const rowValues = [
                quality.id,
                quality.cargoId || "",
                quality.cargoName || "",
                quality.surveyor || "-",
                quality.samplingDate ? quality.samplingDate.toISOString().split("T")[0] : "-",
                quality.gar ?? 0,
                quality.ts ?? 0,
                quality.ash ?? 0,
                quality.tm ?? 0,
                quality.status || "pending",
                quality.updatedAt ? quality.updatedAt.toISOString() : new Date().toISOString()
            ];
            await upsertRow("Quality", 0, quality.id, rowValues);
        } catch (sheetErr) {
            console.error("Failed modifying Google Sheets in PUT /quality:", sheetErr);
        }

        return NextResponse.json({ success: true, quality });
    } catch (error) {
        console.error("PUT /api/memory/quality error:", error);
        return NextResponse.json({ error: "Failed to update quality result" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const url = new URL(req.url);
        const id = url.searchParams.get("id");
        if (!id) return NextResponse.json({ error: "Quality ID missing" }, { status: 400 });

        const existingRecord = await prisma.qualityResult.findUnique({ where: { id } });
        if (!existingRecord || existingRecord.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const userRole = session.user.role?.toLowerCase() || "";
        if (!["ceo", "director", "manager"].includes(userRole)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // 1. SOFT DELETE DI DATABASE
        await prisma.qualityResult.update({
            where: { id },
            data: { isDeleted: true }
        });

        try {
            await prisma.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "DELETE",
                    entity: "QualityResult",
                    entityId: id,
                    details: JSON.stringify({ isDeleted: true })
                }
            });
        } catch (auditErr) {
            console.warn("Audit log skipped (user FK missing):", auditErr);
        }

        // 2. HAPUS DARI GOOGLE SHEETS
        try {
            const rowIndex = await findRowIndex("Quality", 0, id);
            if (rowIndex > 0) {
                await deleteRow("Quality", rowIndex);
            }
        } catch (sheetErr) {
            console.error("Failed deleting from Google Sheets in DELETE /quality:", sheetErr);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/memory/quality error:", error);
        return NextResponse.json({ error: "Failed to delete quality result" }, { status: 500 });
    }
}
