import { NextRequest, NextResponse } from "next/server";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
