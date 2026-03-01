import twilio from "twilio";

const client = () => {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) throw new Error("Twilio credentials not configured");
    return twilio(sid, token);
};

const FROM = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

export async function sendWhatsAppMessage(to: string, body: string): Promise<void> {
    const twilioClient = client();
    await twilioClient.messages.create({
        from: FROM,
        to: to.startsWith("whatsapp:") ? to : `whatsapp:${to}`,
        body,
    });
}

export interface ParsedInboundMessage {
    type: "sales" | "purchase";
    amount: number;
    note: string;
}

export function parseInboundMessage(body: string): ParsedInboundMessage | null {
    // Expected format: Sales#Amount#Note or Purchase#Amount#Note
    const parts = body.split("#").map((p) => p.trim());
    if (parts.length < 3) return null;

    const type = parts[0].toLowerCase();
    if (type !== "sales" && type !== "purchase") return null;

    const amount = parseFloat(parts[1]);
    if (isNaN(amount) || amount <= 0) return null;

    return {
        type: type as "sales" | "purchase",
        amount,
        note: parts.slice(2).join(" "),
    };
}
