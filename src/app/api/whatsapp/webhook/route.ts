import { NextRequest, NextResponse } from "next/server";
import { parseInboundMessage } from "@/lib/whatsapp";
import { appendRow } from "@/lib/google-sheets";
import twilio from "twilio";

export async function POST(req: NextRequest) {
    try {
        const body = await req.text();
        const signature = req.headers.get("x-twilio-signature") || "";
        const originalUrl = req.url; // Ensure this matches exactly the webhook URL Twilio reaches

        const params = new URLSearchParams(body);
        const paramsObject = Object.fromEntries(params);

        const isValid = twilio.validateRequest(
            process.env.TWILIO_AUTH_TOKEN || "",
            signature,
            originalUrl,
            paramsObject
        );

        if (!isValid) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        const messageBody = params.get("Body") || "";
        const from = params.get("From") || "";

        const parsed = parseInboundMessage(messageBody);

        if (!parsed) {
            return new NextResponse(
                '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Invalid format. Use: Sales#Amount#Note or Purchase#Amount#Note</Message></Response>',
                { status: 200, headers: { "Content-Type": "text/xml" } }
            );
        }

        const id = `wa-${Date.now()}`;
        const now = new Date().toISOString();

        await appendRow("DB_Transactions", [
            id,
            parsed.type,
            "other",
            String(parsed.amount),
            parsed.note,
            "pending",
            "whatsapp",
            `WA: ${from}`,
            "",
            now,
            now,
        ]);

        return new NextResponse(
            `<?xml version="1.0" encoding="UTF-8"?><Response><Message>Success: ${parsed.type === "sales" ? "Income" : "Expense"} of $${parsed.amount} recorded as Pending. Note: ${parsed.note}</Message></Response>`,
            { status: 200, headers: { "Content-Type": "text/xml" } }
        );
    } catch (error: any) {
        console.error("WhatsApp webhook error:", error);
        return new NextResponse(
            '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Error processing your message. Please try again.</Message></Response>',
            { status: 200, headers: { "Content-Type": "text/xml" } }
        );
    }
}

// Twilio validation GET for webhook setup
export async function GET() {
    return NextResponse.json({ status: "WhatsApp webhook is active" });
}
