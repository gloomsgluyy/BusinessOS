import { NextRequest, NextResponse } from "next/server";
import { getSheetData, appendRow, updateRow, deleteRow, rowToObject } from "@/lib/google-sheets";

const TAB = "DB_Tasks";
const HEADERS = [
    "id", "title", "description", "status", "priority",
    "assignee_id", "assignee_name", "due_date", "created_by",
    "created_at", "updated_at",
];

export async function GET() {
    try {
        const rows = await getSheetData(TAB);
        if (rows.length <= 1) return NextResponse.json([]);

        const headers = rows[0];
        const tasks = rows.slice(1).map((row) => rowToObject(headers, row));
        return NextResponse.json(tasks);
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Failed to fetch tasks" },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const task = await req.json();
        const values = HEADERS.map((h) => String(task[h] || ""));
        await appendRow(TAB, values);
        return NextResponse.json({ success: true, task });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Failed to create task" },
            { status: 500 }
        );
    }
}

export async function PUT(req: NextRequest) {
    try {
        const { id, ...updates } = await req.json();
        const rows = await getSheetData(TAB);
        const headers = rows[0];
        const idCol = headers.indexOf("id");
        const rowIndex = rows.findIndex((row) => row[idCol] === id);

        if (rowIndex === -1) {
            return NextResponse.json({ error: "Task not found" }, { status: 404 });
        }

        const currentRow = rows[rowIndex];
        const updated = headers.map((h, i) =>
            updates[h] !== undefined ? String(updates[h]) : currentRow[i] || ""
        );
        await updateRow(TAB, rowIndex + 1, updated);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Failed to update task" },
            { status: 500 }
        );
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { id } = await req.json();
        const rows = await getSheetData(TAB);
        const headers = rows[0];
        const idCol = headers.indexOf("id");
        const rowIndex = rows.findIndex((row) => row[idCol] === id);

        if (rowIndex === -1) {
            return NextResponse.json({ error: "Task not found" }, { status: 404 });
        }

        await deleteRow(TAB, rowIndex + 1);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Failed to delete task" },
            { status: 500 }
        );
    }
}
