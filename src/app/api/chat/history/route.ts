import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { canUseAiAssistant } from "@/lib/role-access";

const MAX_HISTORY_CONTENT = 8000;
const ALLOWED_HISTORY_ROLES = new Set(["user", "assistant"]);

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canUseAiAssistant(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    try {
        const history = await prisma.chatHistory.findMany({
            where: { userId: session.user.id },
            orderBy: { createdAt: 'asc' },
        });
        return NextResponse.json(history);
    } catch (error: any) {
        console.error("Chat history fetch error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canUseAiAssistant(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    try {
        const body = await req.json();
        const { role, content } = body;
        const safeRole = ALLOWED_HISTORY_ROLES.has(String(role)) ? String(role) : "user";
        const safeContent = String(content || "").slice(0, MAX_HISTORY_CONTENT);

        if (!safeContent.trim()) {
            return NextResponse.json({ error: "Content is required" }, { status: 400 });
        }

        const newChat = await prisma.chatHistory.create({
            data: {
                userId: session.user.id,
                role: safeRole,
                content: safeContent,
            }
        });

        return NextResponse.json(newChat);
    } catch (error: any) {
        console.error("Chat history save error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
