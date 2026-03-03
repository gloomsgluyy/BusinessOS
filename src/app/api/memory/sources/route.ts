import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { syncAllSourcesToSheet } from "@/app/actions/sheet-actions";

import { PushService } from "@/lib/push-to-sheets";

async function triggerPush(model: string = "sourceSupplier") {
    // Non-blocking trigger
    PushService.pushModelToSheets(model).catch(err => {
        console.error(`Failed to push ${model} to sheets:`, err);
    });
}

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const sources = await prisma.sourceSupplier.findMany({
            where: { isDeleted: false },
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json({ success: true, sources });
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

        const source = await prisma.$transaction(async (tx) => {
            const newSource = await tx.sourceSupplier.create({
                data: {
                    name: data.name,
                    region: data.region,
                    calorieRange: data.calorieRange,
                    gar: data.spec?.gar ? parseFloat(data.spec.gar.toString()) : null,
                    ts: data.spec?.ts ? parseFloat(data.spec.ts.toString()) : null,
                    ash: data.spec?.ash ? parseFloat(data.spec.ash.toString()) : null,
                    tm: data.spec?.tm ? parseFloat(data.spec.tm.toString()) : null,
                    jettyPort: data.jettyPort,
                    anchorage: data.anchorage,
                    stockAvailable: data.stockAvailable ? parseFloat(data.stockAvailable.toString()) : 0,
                    minStockAlert: data.minStockAlert ? parseFloat(data.minStockAlert.toString()) : null,
                    kycStatus: data.kycStatus || "not_started",
                    psiStatus: data.psiStatus || "not_started",
                    fobBargeOnly: data.fobBargeOnly || false,
                    priceLinkedIndex: data.priceLinkedIndex,
                    fobBargePriceUsd: data.fobBargePriceUsd ? parseFloat(data.fobBargePriceUsd.toString()) : null,
                    contractType: data.contractType,
                    picName: data.picName,
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

        await triggerPush();

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

        const source = await prisma.$transaction(async (tx) => {
            const updatedSource = await tx.sourceSupplier.update({
                where: { id: data.id },
                data: {
                    name: data.name,
                    region: data.region,
                    calorieRange: data.calorieRange,
                    gar: data.spec?.gar ? parseFloat(data.spec.gar.toString()) : undefined,
                    ts: data.spec?.ts ? parseFloat(data.spec.ts.toString()) : undefined,
                    ash: data.spec?.ash ? parseFloat(data.spec.ash.toString()) : undefined,
                    tm: data.spec?.tm ? parseFloat(data.spec.tm.toString()) : undefined,
                    jettyPort: data.jettyPort,
                    anchorage: data.anchorage,
                    stockAvailable: data.stockAvailable ? parseFloat(data.stockAvailable.toString()) : undefined,
                    minStockAlert: data.minStockAlert ? parseFloat(data.minStockAlert.toString()) : undefined,
                    kycStatus: data.kycStatus,
                    psiStatus: data.psiStatus,
                    fobBargeOnly: data.fobBargeOnly,
                    priceLinkedIndex: data.priceLinkedIndex,
                    fobBargePriceUsd: data.fobBargePriceUsd ? parseFloat(data.fobBargePriceUsd.toString()) : undefined,
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

        await triggerPush();

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

        await triggerPush();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/memory/sources error:", error);
        return NextResponse.json({ error: "Failed to delete source" }, { status: 500 });
    }
}
