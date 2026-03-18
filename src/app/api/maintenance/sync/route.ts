import { NextResponse } from "next/server";
import { PushService } from "@/lib/push-to-sheets";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const authHeader = req.headers.get("authorization");
    const SYNC_SECRET = process.env.MAINTENANCE_SYNC_SECRET;

    if (!SYNC_SECRET || authHeader !== `Bearer ${SYNC_SECRET}`) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.log("🛠️  [Maintenance] Manual Sync Triggered...");

    try {
        // Trigger push for all major models
        const models = [
            'shipmentdetail',
            'salesdeal',
            'sourcesupplier',
            'qualityresult',
            'marketprice',
            'meetingitem',
            'purchaserequest'
        ];

        for (const model of models) {
            console.log(`[Maintenance] Pushing ${model}...`);
            await (PushService as any).pushModelToSheets(model);
        }

        return NextResponse.json({
            success: true,
            message: "All models pushed to Google Sheets successfully."
        });
    } catch (error: any) {
        console.error("[Maintenance] Sync Error:", error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
