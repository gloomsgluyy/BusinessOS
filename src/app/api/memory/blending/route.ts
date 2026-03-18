import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { syncAllBlendingToSheet } from "@/app/actions/sheet-actions";

import { PushService } from "@/lib/push-to-sheets";

async function triggerPush() {
    try {
        await PushService.pushAllToSheets();
    } catch (err) {
        console.error("Failed to push Blending to sheets:", err);
    }
}

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const simulations = await prisma.blendingSimulation.findMany({
            where: { isDeleted: false },
            orderBy: { createdAt: "desc" }
        });

        // Parse inputs JSON
        const formatted = simulations.map(s => {
            let inputs: any[] = [];
            try { inputs = JSON.parse(s.inputs); } catch { inputs = []; }
            return { ...s, inputs };
        });

        return NextResponse.json({ success: true, blendingHistory: formatted });
    } catch (error) {
        console.error("GET /api/memory/blending error:", error);
        return NextResponse.json({ error: "Failed to fetch blending simulations" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const data = await req.json();

        const simulation = await prisma.$transaction(async (tx) => {
            const newSim = await tx.blendingSimulation.create({
                data: {
                    inputs: JSON.stringify(data.inputs || []),
                    totalQuantity: parseFloat(data.totalQuantity?.toString() || "0"),
                    resultGar: parseFloat(data.resultGar?.toString() || "0"),
                    resultTs: parseFloat(data.resultTs?.toString() || "0"),
                    resultAsh: parseFloat(data.resultAsh?.toString() || "0"),
                    resultTm: parseFloat(data.resultTm?.toString() || "0"),
                    createdBy: session.user.id
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "CREATE",
                    entity: "BlendingSimulation",
                    entityId: newSim.id,
                    details: JSON.stringify(newSim)
                }
            });

            return newSim;
        });

        await triggerPush();

        return NextResponse.json({ success: true, simulation });
    } catch (error) {
        console.error("POST /api/memory/blending error:", error);
        return NextResponse.json({ error: "Failed to create blending simulation" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const url = new URL(req.url);
        const id = url.searchParams.get("id");
        if (!id) return NextResponse.json({ error: "ID missing" }, { status: 400 });

        const existingRecord = await prisma.blendingSimulation.findUnique({ where: { id } });
        if (!existingRecord || existingRecord.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const userRole = session.user.role?.toLowerCase() || "";
        if (existingRecord.createdBy !== session.user.id && !["ceo", "director", "manager"].includes(userRole)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await prisma.$transaction(async (tx) => {
            await tx.blendingSimulation.update({
                where: { id },
                data: { isDeleted: true }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "DELETE",
                    entity: "BlendingSimulation",
                    entityId: id,
                    details: JSON.stringify({ isDeleted: true })
                }
            });
        });

        await triggerPush();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/memory/blending error:", error);
        return NextResponse.json({ error: "Failed to delete blending simulation" }, { status: 500 });
    }
}
