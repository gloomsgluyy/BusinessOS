import { NextRequest, NextResponse } from "next/server";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

export async function POST(req: NextRequest) {
    try {
        const { to, message, type } = await req.json();

        if (!to || !message) {
            return NextResponse.json(
                { error: "Missing required fields: to, message" },
                { status: 400 }
            );
        }

        await sendWhatsAppMessage(to, message);

        return NextResponse.json({
            success: true,
            notification: { to, type, sent_at: new Date().toISOString() },
        });
    } catch (error: any) {
        console.error("WhatsApp send error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to send WhatsApp notification" },
            { status: 500 }
        );
    }
}
