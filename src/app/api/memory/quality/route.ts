import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { syncQualityFromSheet } from "@/app/actions/sheet-actions";
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
            const sheetData = await syncQualityFromSheet();
            if (sheetData.success && sheetData.qualityResults) {
                // Return data directly from Sheets immediately for maximum performance and truthfulness
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

                // Upsert ke DB sebagai backup secara asinkron (tanpa await / memblokir return UI)
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
                
                Promise.allSettled(upsertPromises).catch(err => console.error("Backup DB Quality failed:", err));

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

        // 1. TULIS KE GOOGLE SHEETS DAHULU (Acuan Utama)
        const qualityId = uuidv4();
        const nowStr = new Date().toISOString();
        const sdStr = data.samplingDate ? new Date(data.samplingDate).toISOString().split("T")[0] : "-";
        
        const rowValues = [
            qualityId,
            data.cargoId || "",
            data.cargoName || "",
            data.surveyor || "-",
            sdStr,
            data.specResult?.gar ?? 0,
            data.specResult?.ts ?? 0,
            data.specResult?.ash ?? 0,
            data.specResult?.tm ?? 0,
            data.status || "pending",
            nowStr
        ];

        try {
            await appendRow("Quality", rowValues);
        } catch (sheetErr) {
            console.error("Gagal update Google Sheets:", sheetErr);
            return NextResponse.json({ error: "Gagal menyimpan ke Google Sheets" }, { status: 500 });
        }

        // 2. JIKA BERHASIL, SIMPAN SEBAGAI BACKUP KE DATABASE
        const quality = await prisma.qualityResult.create({
            data: {
                id: qualityId,
                cargoId: data.cargoId || "",
                cargoName: data.cargoName || "",
                surveyor: data.surveyor || "-",
                samplingDate: data.samplingDate ? new Date(data.samplingDate) : null,
                gar: data.specResult?.gar ? parseFloat(data.specResult.gar.toString()) : null,
                ts: data.specResult?.ts ? parseFloat(data.specResult.ts.toString()) : null,
                ash: data.specResult?.ash ? parseFloat(data.specResult.ash.toString()) : null,
                tm: data.specResult?.tm ? parseFloat(data.specResult.tm.toString()) : null,
                status: data.status || "pending"
            }
        });

        try {
            const dbUser = await prisma.user.findUnique({ where: { id: session.user.id } });
            if (dbUser) {
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
            }
        } catch (auditErr) {
            console.warn("Audit log skipped:", auditErr);
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

        // 1. UPDATE DI GOOGLE SHEETS DAHULU
        const nowStr = new Date().toISOString();
        const sdStr = data.samplingDate ? new Date(data.samplingDate).toISOString().split("T")[0] : "-";

        const rowValues = [
            data.id,
            data.cargoId || "",
            data.cargoName || "",
            data.surveyor || "-",
            sdStr,
            data.specResult?.gar ?? 0,
            data.specResult?.ts ?? 0,
            data.specResult?.ash ?? 0,
            data.specResult?.tm ?? 0,
            data.status || "pending",
            nowStr
        ];

        try {
            await upsertRow("Quality", 0, data.id, rowValues);
        } catch (sheetErr) {
            console.error("Gagal modifikasi Google Sheets di PUT /quality:", sheetErr);
            return NextResponse.json({ error: "Gagal update Google Sheets" }, { status: 500 });
        }

        // 2. JIKA SHEET BERHASIL, BARU UPDATE DB SEBAGAI BACKUP/HISTORY
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
            const dbUser = await prisma.user.findUnique({ where: { id: session.user.id } });
            if (dbUser) {
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
            }
        } catch (auditErr) {
            console.warn("Audit log skipped:", auditErr);
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

        // 1. HAPUS DARI GOOGLE SHEETS DAHULU
        try {
            const rowIndex = await findRowIndex("Quality", 0, id);
            if (rowIndex > 0) {
                await deleteRow("Quality", rowIndex);
            }
        } catch (sheetErr) {
            console.error("Gagal menghapus dari Google Sheets di DELETE /quality:", sheetErr);
            return NextResponse.json({ error: "Gagal menghapus dari Google Sheets" }, { status: 500 });
        }

        // 2. SOFT DELETE DI DATABASE JIKA SHEET BERHASIL
        await prisma.qualityResult.update({
            where: { id },
            data: { isDeleted: true }
        });

        try {
            const dbUser = await prisma.user.findUnique({ where: { id: session.user.id } });
            if (dbUser) {
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
            }
        } catch (auditErr) {
            console.warn("Audit log skipped:", auditErr);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/memory/quality error:", error);
        return NextResponse.json({ error: "Failed to delete quality result" }, { status: 500 });
    }
}
