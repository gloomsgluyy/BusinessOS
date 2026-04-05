import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { PushService } from "@/lib/push-to-sheets";

// DATABASE-FIRST: Optional push to Sheets for backup/export
async function triggerPush() {
    PushService.debouncedPush("taskItem").catch(err => console.error("Optional Sheet push failed:", err));
}

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // DATABASE-FIRST: Read directly from database
        const tasks = await prisma.taskItem.findMany({
            where: { isDeleted: false },
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json({ success: true, tasks });
    } catch (error) {
        console.error("GET /api/memory/tasks error:", error);
        return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const data = await req.json();

        // DATABASE-FIRST: Write to database as primary source
        const task = await prisma.$transaction(async (tx) => {
            const newTask = await tx.taskItem.create({
                data: {
                    title: data.title,
                    description: data.description,
                    status: data.status || "todo",
                    priority: data.priority || "medium",
                    assigneeId: data.assigneeId,
                    assigneeName: data.assigneeName,
                    dueDate: data.dueDate ? new Date(data.dueDate) : null,
                    createdBy: session.user.id
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "CREATE",
                    entity: "TaskItem",
                    entityId: newTask.id,
                    details: JSON.stringify(newTask)
                }
            });

            return newTask;
        });

        // Optional push to Sheets for backup/export
        await triggerPush();

        return NextResponse.json({ success: true, task });
    } catch (error) {
        console.error("POST /api/memory/tasks error:", error);
        return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const data = await req.json();
        if (!data.id) return NextResponse.json({ error: "Task ID missing" }, { status: 400 });

        const existingRecord = await prisma.taskItem.findUnique({ where: { id: data.id } });
        if (!existingRecord || existingRecord.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const userRole = session.user.role?.toLowerCase() || "";
        if (existingRecord.createdBy !== session.user.id && !["ceo", "director", "manager"].includes(userRole)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // DATABASE-FIRST: Update database as primary source
        const task = await prisma.$transaction(async (tx) => {
            const updatedTask = await tx.taskItem.update({
                where: { id: data.id },
                data: {
                    title: data.title,
                    description: data.description,
                    status: data.status,
                    priority: data.priority,
                    assigneeId: data.assigneeId,
                    assigneeName: data.assigneeName,
                    dueDate: data.dueDate ? new Date(data.dueDate) : null,
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "UPDATE",
                    entity: "TaskItem",
                    entityId: updatedTask.id,
                    details: JSON.stringify(data)
                }
            });

            return updatedTask;
        });

        // Optional push to Sheets for backup/export
        await triggerPush();

        return NextResponse.json({ success: true, task });
    } catch (error) {
        console.error("PUT /api/memory/tasks error:", error);
        return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const url = new URL(req.url);
        const id = url.searchParams.get("id");
        if (!id) return NextResponse.json({ error: "Task ID missing" }, { status: 400 });

        const existingRecord = await prisma.taskItem.findUnique({ where: { id } });
        if (!existingRecord || existingRecord.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const userRole = session.user.role?.toLowerCase() || "";
        if (existingRecord.createdBy !== session.user.id && !["ceo", "director", "manager"].includes(userRole)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // DATABASE-FIRST: Delete from database as primary source
        await prisma.$transaction(async (tx) => {
            await tx.taskItem.update({
                where: { id },
                data: { isDeleted: true }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "DELETE",
                    entity: "TaskItem",
                    entityId: id,
                    details: JSON.stringify({ isDeleted: true })
                }
            });
        });

        // Optional push to Sheets for backup/export
        await triggerPush();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/memory/tasks error:", error);
        return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
    }
}
