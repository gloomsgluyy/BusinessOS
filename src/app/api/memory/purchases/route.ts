import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { syncAllPurchasesToSheet } from "@/app/actions/sheet-actions";

import { PushService } from "@/lib/push-to-sheets";

async function triggerPush() {
    PushService.debouncedPush("purchaseRequest").catch(err => console.error("Push failed:", err));
}

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

        const purchase = await prisma.$transaction(async (tx) => {
            const newPurchase = await tx.purchaseRequest.create({
                data: {
                    requestNumber: data.requestNumber || `PR-${Date.now()}`,
                    category: data.category || "Other",
                    supplier: data.supplier,
                    description: data.description,
                    amount: data.amount ? parseFloat(data.amount.toString()) : 0,
                    priority: data.priority || "medium",
                    status: data.status || "pending",
                    imageUrl: data.imageUrl,
                    createdByName: session.user.name,
                    createdBy: session.user.id,
                    notes: data.notes,
                    isAnomaly: data.isAnomaly || false,
                    anomalyReason: data.anomalyReason,
                    ocrData: data.ocrData ? JSON.stringify(data.ocrData) : null
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "CREATE",
                    entity: "PurchaseRequest",
                    entityId: newPurchase.id,
                    details: JSON.stringify(newPurchase)
                }
            });

            return newPurchase;
        });

        await triggerPush();

        return NextResponse.json({ success: true, purchase });
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

        const purchase = await prisma.$transaction(async (tx) => {
            const updatedPurchase = await tx.purchaseRequest.update({
                where: { id: data.id },
                data: {
                    category: data.category,
                    supplier: data.supplier,
                    description: data.description,
                    amount: data.amount ? parseFloat(data.amount.toString()) : undefined,
                    priority: data.priority,
                    status: data.status,
                    imageUrl: data.imageUrl,
                    notes: data.notes,
                    approvedBy: data.approvedBy,
                    isAnomaly: data.isAnomaly,
                    anomalyReason: data.anomalyReason,
                    ocrData: data.ocrData ? JSON.stringify(data.ocrData) : undefined
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "UPDATE",
                    entity: "PurchaseRequest",
                    entityId: updatedPurchase.id,
                    details: JSON.stringify(data)
                }
            });

            return updatedPurchase;
        });

        await triggerPush();

        return NextResponse.json({ success: true, purchase });
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

        await prisma.$transaction(async (tx) => {
            await tx.purchaseRequest.update({
                where: { id },
                data: { isDeleted: true }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "DELETE",
                    entity: "PurchaseRequest",
                    entityId: id,
                    details: JSON.stringify({ isDeleted: true })
                }
            });
        });

        await triggerPush();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/memory/purchases error:", error);
        return NextResponse.json({ error: "Failed to delete purchase" }, { status: 500 });
    }
}
