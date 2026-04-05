import { NextResponse } from "next/server";
import { PushService } from "@/lib/push-to-sheets";

export const dynamic = "force-dynamic";

/**
 * Manual Export/Sync to Google Sheets (DATABASE-FIRST Mode)
 * Exports current database state to Sheets (one-way: DB → Sheets)
 * Requires: MAINTENANCE_SYNC_SECRET bearer token OR ENABLE_SHEETS_SYNC=true
 */
export async function GET(req: Request) {
    const authHeader = req.headers.get("authorization");
    const SYNC_SECRET = process.env.MAINTENANCE_SYNC_SECRET;

    if (!SYNC_SECRET || authHeader !== `Bearer ${SYNC_SECRET}`) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if Sheets export is enabled
    if (process.env.ENABLE_SHEETS_SYNC !== 'true') {
        return NextResponse.json(
            {
                error: "Sheets export is disabled",
                message: "DATABASE-FIRST mode active. Set ENABLE_SHEETS_SYNC=true to enable optional export."
            },
            { status: 400 }
        );
    }

    console.log("🛠️  [Maintenance] Manual DB → Sheets Export Triggered (Database-First Mode)...");

    try {
        // Export all data from database to Sheets
        await PushService.pushAllToSheets();

        return NextResponse.json({
            success: true,
            message: "All data exported from Database to Google Sheets successfully."
        });
    } catch (error: any) {
        console.error("[Maintenance] Export Error:", error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
