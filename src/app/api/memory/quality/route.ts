import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { PushService } from "@/lib/push-to-sheets";
import { v4 as uuidv4 } from 'uuid';

async function triggerPush() {
    PushService.debouncedPush("qualityResult").catch(err => console.error("Optional Sheet push failed:", err));
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
            const [quality, totalItems] = await Promise.all([
                prisma.qualityResult.findMany({ where, orderBy: { createdAt: pagination.sortOrder }, skip: pagination.skip, take: pagination.take }),
                prisma.qualityResult.count({ where }),
            ]);
            const meta = buildPaginationMeta(totalItems, pagination.page, pagination.pageSize);
            return NextResponse.json({ success: true, quality, meta });
        }

        // DATABASE-FIRST: Read directly from database
        const quality = await prisma.qualityResult.findMany({
            where,
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
        const qualityId = uuidv4();

        // DATABASE-FIRST: Write to database as primary source
        const quality = await prisma.$transaction(async (tx) => {
            const newQuality = await tx.qualityResult.create({
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

            const dbUser = await tx.user.findUnique({ where: { id: session.user.id } });
            if (dbUser) {
                await tx.auditLog.create({
                    data: {
                        userId: session.user.id,
                        userName: session.user.name || "Unknown",
                        action: "CREATE",
                        entity: "QualityResult",
                        entityId: newQuality.id,
                        details: JSON.stringify(newQuality)
                    }
                });
            }

            return newQuality;
        });

        // Optional push to Sheets for backup/export
        await triggerPush();

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

        // DATABASE-FIRST: Update database as primary source
        const quality = await prisma.$transaction(async (tx) => {
            const updatedQuality = await tx.qualityResult.update({
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

            const dbUser = await tx.user.findUnique({ where: { id: session.user.id } });
            if (dbUser) {
                await tx.auditLog.create({
                    data: {
                        userId: session.user.id,
                        userName: session.user.name || "Unknown",
                        action: "UPDATE",
                        entity: "QualityResult",
                        entityId: updatedQuality.id,
                        details: JSON.stringify(data)
                    }
                });
            }

            return updatedQuality;
        });

        // Optional push to Sheets for backup/export
        await triggerPush();

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

        // DATABASE-FIRST: Delete from database as primary source
        await prisma.$transaction(async (tx) => {
            await tx.qualityResult.update({
                where: { id },
                data: { isDeleted: true }
            });

            const dbUser = await tx.user.findUnique({ where: { id: session.user.id } });
            if (dbUser) {
                await tx.auditLog.create({
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
        });

        // Optional push to Sheets for backup/export
        await triggerPush();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/memory/quality error:", error);
        return NextResponse.json({ error: "Failed to delete quality result" }, { status: 500 });
    }
}
