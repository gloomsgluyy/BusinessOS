import { NextRequest, NextResponse } from "next/server";
import { getSheetData, appendRow, updateRow, rowToObject } from "@/lib/google-sheets";

const TAB = "DB_Users";
const HEADERS = ["id", "name", "email", "role", "phone", "avatar", "created_at"];

export async function GET() {
    try {
        const rows = await getSheetData(TAB);
        if (rows.length <= 1) return NextResponse.json([]);

        const headers = rows[0];
        const users = rows.slice(1).map((row) => rowToObject(headers, row));
        return NextResponse.json(users);
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Failed to fetch users" },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await req.json();
        const values = HEADERS.map((h) => String((user as any)[h] || ""));
        await appendRow(TAB, values);
        return NextResponse.json({ success: true, user });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Failed to create user" },
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
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const currentRow = rows[rowIndex];
        const updated = headers.map((h, i) =>
            updates[h] !== undefined ? String(updates[h]) : currentRow[i] || ""
        );
        await updateRow(TAB, rowIndex + 1, updated);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Failed to update user" },
            { status: 500 }
        );
    }
}
