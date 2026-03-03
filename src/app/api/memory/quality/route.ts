import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { syncAllQualityToSheet } from "@/app/actions/sheet-actions";

import { PushService } from "@/lib/push-to-sheets";

async function triggerPush() {
    try {
        await PushService.pushAllToSheets();
    } catch (err) {
        console.error("Failed to push Quality Results to sheets:", err);
    }
}

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

        const quality = await prisma.$transaction(async (tx) => {
            const newQuality = await tx.qualityResult.create({
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

            return newQuality;
        });

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

            return updatedQuality;
        });

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

        await prisma.$transaction(async (tx) => {
            await tx.qualityResult.update({
                where: { id },
                data: { isDeleted: true }
            });

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
        });

        await triggerPush();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/memory/quality error:", error);
        return NextResponse.json({ error: "Failed to delete quality result" }, { status: 500 });
    }
}
