import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { PushService } from "@/lib/push-to-sheets";
import { v4 as uuidv4 } from 'uuid';
import { canWriteModuleForRole } from "@/lib/role-access";

async function triggerPush() {
    PushService.debouncedPush("qualityResult").catch(err => console.error("Optional Sheet push failed:", err));
}
import { parsePaginationParams, buildPaginationMeta } from "@/lib/pagination";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type QualitySpecPayload = {
    gar?: number | null;
    ts?: number | null;
    ash?: number | null;
    tm?: number | null;
};

let qualityWorkflowColumnsReady = false;
let qualityWorkflowColumnsPromise: Promise<void> | null = null;

async function ensureQualityWorkflowColumns() {
    if (qualityWorkflowColumnsReady) return;
    if (qualityWorkflowColumnsPromise) return qualityWorkflowColumnsPromise;
    qualityWorkflowColumnsPromise = (async () => {
    await prisma.$executeRawUnsafe(`ALTER TABLE "QualityResult" ADD COLUMN IF NOT EXISTS "contractSpec" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "QualityResult" ADD COLUMN IF NOT EXISTS "sourceEstimate" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "QualityResult" ADD COLUMN IF NOT EXISTS "qcResult" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "QualityResult" ADD COLUMN IF NOT EXISTS "qcDocumentId" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "QualityResult" ADD COLUMN IF NOT EXISTS "psiResult" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "QualityResult" ADD COLUMN IF NOT EXISTS "psiDocumentId" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "QualityResult" ADD COLUMN IF NOT EXISTS "coaPolResult" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "QualityResult" ADD COLUMN IF NOT EXISTS "coaPolDocumentId" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "QualityResult" ADD COLUMN IF NOT EXISTS "coaPodResult" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "QualityResult" ADD COLUMN IF NOT EXISTS "coaPodDocumentId" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "QualityResult" ADD COLUMN IF NOT EXISTS "comparisonStatus" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "QualityResult" ADD COLUMN IF NOT EXISTS "warningNotes" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "QualityResult" ADD COLUMN IF NOT EXISTS "reviewedBy" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "QualityResult" ADD COLUMN IF NOT EXISTS "reviewedByName" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "QualityResult" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);`);
    qualityWorkflowColumnsReady = true;
    })().finally(() => {
        qualityWorkflowColumnsPromise = null;
    });
    return qualityWorkflowColumnsPromise;
}

function toNum(value: unknown) {
    if (value === "" || value === null || value === undefined) return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

function cleanSpec(value: unknown): QualitySpecPayload | null {
    const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const spec: QualitySpecPayload = {
        gar: toNum(raw.gar),
        ts: toNum(raw.ts),
        ash: toNum(raw.ash),
        tm: toNum(raw.tm),
    };
    return Object.values(spec).some((item) => item !== null) ? spec : null;
}

function compareQuality(contract: QualitySpecPayload | null, finalSpec: QualitySpecPayload | null) {
    if (!contract || !finalSpec) {
        return { status: "pending", notes: "Contract spec or final quality result is still incomplete." };
    }

    const warnings: string[] = [];
    const claims: string[] = [];
    if (contract.gar != null && finalSpec.gar != null && finalSpec.gar < contract.gar) {
        const diff = Math.round(contract.gar - finalSpec.gar);
        (diff >= 100 ? claims : warnings).push(`GAR below contract by ${diff}`);
    }
    for (const key of ["ts", "ash", "tm"] as const) {
        const limit = contract[key];
        const actual = finalSpec[key];
        if (limit != null && actual != null && actual > limit) {
            const diff = Math.round((actual - limit) * 100) / 100;
            (diff >= 0.25 ? claims : warnings).push(`${key.toUpperCase()} above contract by ${diff}`);
        }
    }

    if (claims.length) return { status: "claim_potential", notes: claims.join("; ") };
    if (warnings.length) return { status: "warning", notes: warnings.join("; ") };
    return { status: "passed", notes: "Final quality is within contract limits." };
}

function hasOwn(data: any, camel: string, snake?: string) {
    return Object.prototype.hasOwnProperty.call(data, camel) || Boolean(snake && Object.prototype.hasOwnProperty.call(data, snake));
}

function incoming(data: any, camel: string, snake: string) {
    if (Object.prototype.hasOwnProperty.call(data, camel)) return data[camel];
    if (Object.prototype.hasOwnProperty.call(data, snake)) return data[snake];
    return undefined;
}

function buildQualityWorkflowData(data: any, session: any) {
    const contractSpec = cleanSpec(data.contractSpec);
    const sourceEstimate = cleanSpec(data.sourceEstimate);
    const qcResult = cleanSpec(data.qcResult);
    const psiResult = cleanSpec(data.psiResult);
    const coaPolResult = cleanSpec(data.coaPolResult);
    const coaPodResult = cleanSpec(data.coaPodResult);
    const finalSpec = coaPodResult || coaPolResult || psiResult || qcResult || cleanSpec(data.specResult);
    const comparison = compareQuality(contractSpec, finalSpec);
    const comparisonStatus = data.comparisonStatus || comparison.status;
    const warningNotes = data.warningNotes || comparison.notes;

    const payload: Record<string, any> = {
        comparisonStatus,
        warningNotes,
        reviewedBy: session.user.id,
        reviewedByName: session.user.name || "Unknown",
        reviewedAt: new Date(),
    };
    if (hasOwn(data, "contractSpec")) payload.contractSpec = contractSpec ? JSON.stringify(contractSpec) : null;
    if (hasOwn(data, "sourceEstimate")) payload.sourceEstimate = sourceEstimate ? JSON.stringify(sourceEstimate) : null;
    if (hasOwn(data, "qcResult")) payload.qcResult = qcResult ? JSON.stringify(qcResult) : null;
    if (hasOwn(data, "qcDocumentId", "qc_document_id")) payload.qcDocumentId = incoming(data, "qcDocumentId", "qc_document_id") || null;
    if (hasOwn(data, "psiResult")) payload.psiResult = psiResult ? JSON.stringify(psiResult) : null;
    if (hasOwn(data, "psiDocumentId", "psi_document_id")) payload.psiDocumentId = incoming(data, "psiDocumentId", "psi_document_id") || null;
    if (hasOwn(data, "coaPolResult")) payload.coaPolResult = coaPolResult ? JSON.stringify(coaPolResult) : null;
    if (hasOwn(data, "coaPolDocumentId", "coa_pol_document_id")) payload.coaPolDocumentId = incoming(data, "coaPolDocumentId", "coa_pol_document_id") || null;
    if (hasOwn(data, "coaPodResult")) payload.coaPodResult = coaPodResult ? JSON.stringify(coaPodResult) : null;
    if (hasOwn(data, "coaPodDocumentId", "coa_pod_document_id")) payload.coaPodDocumentId = incoming(data, "coaPodDocumentId", "coa_pod_document_id") || null;
    return payload;
}

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        await ensureQualityWorkflowColumns();

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
        await ensureQualityWorkflowColumns();

        const data = await req.json();
        const qualityId = uuidv4();
        const workflowData = buildQualityWorkflowData(data, session);

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
                    ...workflowData,
                    status: data.status || workflowData.comparisonStatus || "pending"
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
        await ensureQualityWorkflowColumns();

        const data = await req.json();
        if (!data.id) return NextResponse.json({ error: "Quality ID missing" }, { status: 400 });

        const existingRecord = await prisma.qualityResult.findUnique({ where: { id: data.id } });
        if (!existingRecord || existingRecord.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

        if (!canWriteModuleForRole(session.user.role, "QUALITY_BLENDING")) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // DATABASE-FIRST: Update database as primary source
        const workflowData = buildQualityWorkflowData(data, session);
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
                    ...workflowData,
                    status: data.status || workflowData.comparisonStatus
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
        await ensureQualityWorkflowColumns();

        const url = new URL(req.url);
        const id = url.searchParams.get("id");
        if (!id) return NextResponse.json({ error: "Quality ID missing" }, { status: 400 });

        const existingRecord = await prisma.qualityResult.findUnique({ where: { id } });
        if (!existingRecord || existingRecord.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

        if (!canWriteModuleForRole(session.user.role, "QUALITY_BLENDING")) {
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
