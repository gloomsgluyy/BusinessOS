import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { syncAllSalesToSheet } from "@/app/actions/sheet-actions";

import { PushService } from "@/lib/push-to-sheets";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/pagination";

async function triggerPush() {
    PushService.debouncedPush("salesOrder").catch(err => console.error("Push failed:", err));
}

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const url = new URL(req.url);
        const pagination = parsePaginationParams(url.searchParams);
        const where = { isDeleted: false };

        if (pagination) {
            const [orders, totalItems] = await Promise.all([
                prisma.salesOrder.findMany({ where, orderBy: { createdAt: pagination.sortOrder }, skip: pagination.skip, take: pagination.take }),
                prisma.salesOrder.count({ where }),
            ]);
            const meta = buildPaginationMeta(totalItems, pagination.page, pagination.pageSize);
            return NextResponse.json({ success: true, orders, meta });
        }

        const orders = await prisma.salesOrder.findMany({
            where,
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json({ success: true, orders });
    } catch (error) {
        console.error("GET /api/memory/sales-orders error:", error);
        return NextResponse.json({ error: "Failed to fetch sales orders" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const data = await req.json();

        const order = await prisma.$transaction(async (tx) => {
            const newOrder = await tx.salesOrder.create({
                data: {
                    orderNumber: data.orderNumber || `SO-${Date.now()}`,
                    client: data.client,
                    description: data.description,
                    amount: data.amount ? parseFloat(data.amount.toString()) : 0,
                    priority: data.priority || "medium",
                    status: data.status || "pending",
                    imageUrl: data.imageUrl,
                    createdByName: session.user.name,
                    createdBy: session.user.id,
                    notes: data.notes
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "CREATE",
                    entity: "SalesOrder",
                    entityId: newOrder.id,
                    details: JSON.stringify(newOrder)
                }
            });

            return newOrder;
        });

        await triggerPush();

        return NextResponse.json({ success: true, order });
    } catch (error) {
        console.error("POST /api/memory/sales-orders error:", error);
        return NextResponse.json({ error: "Failed to create sales order" }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const data = await req.json();
        if (!data.id) return NextResponse.json({ error: "Order ID missing" }, { status: 400 });

        const existingRecord = await prisma.salesOrder.findUnique({ where: { id: data.id } });
        if (!existingRecord || existingRecord.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const userRole = session.user.role?.toLowerCase() || "";
        if (existingRecord.createdBy !== session.user.id && !["ceo", "director", "manager"].includes(userRole)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const order = await prisma.$transaction(async (tx) => {
            const updatedOrder = await tx.salesOrder.update({
                where: { id: data.id },
                data: {
                    client: data.client,
                    description: data.description,
                    amount: data.amount ? parseFloat(data.amount.toString()) : undefined,
                    priority: data.priority,
                    status: data.status,
                    imageUrl: data.imageUrl,
                    notes: data.notes,
                    approvedBy: data.approvedBy
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "UPDATE",
                    entity: "SalesOrder",
                    entityId: updatedOrder.id,
                    details: JSON.stringify(data)
                }
            });

            return updatedOrder;
        });

        await triggerPush();

        return NextResponse.json({ success: true, order });
    } catch (error) {
        console.error("PUT /api/memory/sales-orders error:", error);
        return NextResponse.json({ error: "Failed to update sales order" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const url = new URL(req.url);
        const id = url.searchParams.get("id");
        if (!id) return NextResponse.json({ error: "Order ID missing" }, { status: 400 });

        const existingRecord = await prisma.salesOrder.findUnique({ where: { id } });
        if (!existingRecord || existingRecord.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const userRole = session.user.role?.toLowerCase() || "";
        if (existingRecord.createdBy !== session.user.id && !["ceo", "director", "manager"].includes(userRole)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await prisma.$transaction(async (tx) => {
            await tx.salesOrder.update({
                where: { id },
                data: { isDeleted: true }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "DELETE",
                    entity: "SalesOrder",
                    entityId: id,
                    details: JSON.stringify({ isDeleted: true })
                }
            });
        });

        await triggerPush();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/memory/sales-orders error:", error);
        return NextResponse.json({ error: "Failed to delete sales order" }, { status: 500 });
    }
}
