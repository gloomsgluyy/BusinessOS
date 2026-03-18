import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    try {
        const body = await req.json();
        const { role, content } = body;

        const newChat = await prisma.chatHistory.create({
            data: {
                userId: session.user.id,
                role: role,
                content: content,
            }
        });

        return NextResponse.json(newChat);
    } catch (error: any) {
        console.error("Chat history save error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
