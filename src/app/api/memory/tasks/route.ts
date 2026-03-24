import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { syncTasksFromSheet } from "@/app/actions/sheet-actions";
import { appendRow, upsertRow, deleteRow, findRowIndex } from "@/lib/google-sheets";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // 1. PULL DARI GOOGLE SHEETS DULU (Primary Source of Truth)
        try {
            const sheetData = await syncTasksFromSheet();
            if (sheetData.success && sheetData.tasks) {
                // Upsert ke lokal DB sbg backup dlm db
                const upsertPromises = sheetData.tasks.map(t =>
                    prisma.taskItem.upsert({
                        where: { id: t.id },
                        update: {
                            title: t.title,
                            description: t.description,
                            status: t.status,
                            priority: t.priority,
                            assigneeName: t.assignee_id,
                            dueDate: t.due_date ? new Date(t.due_date) : null,
                        },
                        create: {
                            id: t.id || "",
                            title: t.title || "Untitled Task",
                            description: t.description,
                            status: t.status || "todo",
                            priority: t.priority || "medium",
                            assigneeName: t.assignee_id,
                            dueDate: t.due_date ? new Date(t.due_date) : null,
                            createdBy: "system"
                        }
                    })
                );
                await Promise.allSettled(upsertPromises);

                // --- REKONSILIASI PENGHAPUSAN (DELETION) ---
                const remoteIds = new Set(sheetData.tasks.map(t => t.id));
                const localRecords = await prisma.taskItem.findMany({
                    where: { isDeleted: false },
                    select: { id: true }
                });

                const deletePromises = localRecords
                    .filter(loc => !remoteIds.has(loc.id))
                    .map(loc =>
                        prisma.taskItem.update({
                            where: { id: loc.id },
                            data: { isDeleted: true }
                        })
                    );

                if (deletePromises.length > 0) {
                    await Promise.allSettled(deletePromises);
                    console.log(`[Sync] Menghapus ${deletePromises.length} local tasks karena tidak ditemukan di Google Sheets.`);
                }

                // --- KEMBALIKAN DATA LANGSUNG DARI GOOGLE SHEETS UNTUK UI ---
                const formattedRemote = sheetData.tasks.map(t => ({
                    id: t.id,
                    title: t.title,
                    description: t.description,
                    status: t.status,
                    priority: t.priority,
                    assigneeId: t.assignee_id, // Map for UI if needed, usually we just need assigneeName
                    assigneeName: t.assignee_id,
                    dueDate: t.due_date ? new Date(t.due_date) : null,
                    createdAt: new Date(),
                    updatedAt: t.updated_at ? new Date(t.updated_at) : new Date()
                }));

                return NextResponse.json({ success: true, tasks: formattedRemote });
            }
        } catch (e) {
            console.error("Failed to pull tasks from sheets", e);
        }

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

        // CREATE IN DATABASE (Capture DB)
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

        // WRITE DIRECTLY TO SPREADSHEET (Primary Source of truth)
        try {
            const dateStr = task.dueDate ? task.dueDate.toISOString().split('T')[0] : "";
            const updatedStr = task.updatedAt ? task.updatedAt.toISOString() : new Date().toISOString();

            const rowValues = [
                task.id,
                task.title,
                task.description || "-",
                task.status,
                task.priority,
                task.assigneeName || "-",
                dateStr,
                `=IMAGE("https://picsum.photos/seed/${task.id}/200/200")`,
                updatedStr
            ];

            await appendRow("Tasks", rowValues);
        } catch (sheetErr) {
            console.error("Failed writing to Google Sheets in POST /tasks", sheetErr);
        }

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

        // UPDATE IN DATABASE (Capture DB)
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

        // UPDATE DIRECTLY TO SPREADSHEET (Primary Source of truth)
        try {
            const dateStr = task.dueDate ? task.dueDate.toISOString().split('T')[0] : "";
            const updatedStr = task.updatedAt ? task.updatedAt.toISOString() : new Date().toISOString();

            const rowValues = [
                task.id,
                task.title,
                task.description || "-",
                task.status,
                task.priority,
                task.assigneeName || "-",
                dateStr,
                `=IMAGE("https://picsum.photos/seed/${task.id}/200/200")`,
                updatedStr
            ];

            await upsertRow("Tasks", 0, task.id, rowValues);
        } catch (sheetErr) {
            console.error("Failed modifying Google Sheets in PUT /tasks", sheetErr);
        }

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

        // DEL IN DATABASE (Capture DB)
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

        // DEL FROM SPREADSHEETS DIRECTLY (Primary Source of truth)
        try {
            const rowIndex = await findRowIndex("Tasks", 0, id);
            if (rowIndex > 0) {
                await deleteRow("Tasks", rowIndex);
            }
        } catch (sheetErr) {
            console.error("Failed deleting from Google Sheets in DELETE /tasks", sheetErr);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/memory/tasks error:", error);
        return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
    }
}
