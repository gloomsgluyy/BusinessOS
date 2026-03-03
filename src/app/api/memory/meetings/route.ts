import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { syncAllMeetingsToSheet } from "@/app/actions/sheet-actions";

import { PushService } from "@/lib/push-to-sheets";

async function triggerPush() {
    try {
        await PushService.pushAllToSheets();
    } catch (err) {
        console.error("Failed to push Meetings to sheets:", err);
    }
}

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const meetings = await prisma.meetingItem.findMany({
            where: { isDeleted: false },
            orderBy: { createdAt: "desc" }
        });

        const formatted = meetings.map(m => {
            let attendees: string[] = [];
            if (m.attendees) {
                try {
                    const parsed = JSON.parse(m.attendees);
                    attendees = Array.isArray(parsed) ? parsed : [String(parsed)];
                } catch {
                    // If it's a comma-separated string from Sheets, split it
                    attendees = m.attendees.split(',').map((a: string) => a.trim()).filter(Boolean);
                }
            }
            return {
                ...m,
                attendees,
                momContent: m.momContent || null,
                voiceNoteUrl: m.voiceNoteUrl || null,
                aiSummary: m.aiSummary || null,
            };
        });

        return NextResponse.json({ success: true, meetings: formatted });
    } catch (error) {
        console.error("GET /api/memory/meetings error:", error);
        return NextResponse.json({ error: "Failed to fetch meetings" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const data = await req.json();

        const meeting = await prisma.$transaction(async (tx) => {
            const newMeeting = await tx.meetingItem.create({
                data: {
                    title: data.title,
                    date: data.date ? new Date(data.date) : null,
                    time: data.time,
                    location: data.location,
                    status: data.status || "scheduled",
                    attendees: data.attendees ? JSON.stringify(data.attendees) : null,
                    createdByName: session.user.name,
                    createdBy: session.user.id
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "CREATE",
                    entity: "MeetingItem",
                    entityId: newMeeting.id,
                    details: JSON.stringify(newMeeting)
                }
            });

            return newMeeting;
        });

        await triggerPush();

        return NextResponse.json({ success: true, meeting });
    } catch (error) {
        console.error("POST /api/memory/meetings error:", error);
        return NextResponse.json({ error: "Failed to create meeting" }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const data = await req.json();
        if (!data.id) return NextResponse.json({ error: "Meeting ID missing" }, { status: 400 });

        const meeting = await prisma.$transaction(async (tx) => {
            const updatedMeeting = await tx.meetingItem.update({
                where: { id: data.id },
                data: {
                    title: data.title,
                    date: data.date ? new Date(data.date) : undefined,
                    time: data.time,
                    location: data.location,
                    status: data.status,
                    attendees: data.attendees ? JSON.stringify(data.attendees) : undefined,
                    momContent: data.momContent !== undefined ? data.momContent : undefined,
                    voiceNoteUrl: data.voiceNoteUrl !== undefined ? data.voiceNoteUrl : undefined,
                    aiSummary: data.aiSummary !== undefined ? data.aiSummary : undefined,
                }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "UPDATE",
                    entity: "MeetingItem",
                    entityId: updatedMeeting.id,
                    details: JSON.stringify(data)
                }
            });

            return updatedMeeting;
        });

        await triggerPush();

        return NextResponse.json({ success: true, meeting });
    } catch (error) {
        console.error("PUT /api/memory/meetings error:", error);
        return NextResponse.json({ error: "Failed to update meeting" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const url = new URL(req.url);
        const id = url.searchParams.get("id");
        if (!id) return NextResponse.json({ error: "Meeting ID missing" }, { status: 400 });

        await prisma.$transaction(async (tx) => {
            await tx.meetingItem.update({
                where: { id },
                data: { isDeleted: true }
            });

            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    userName: session.user.name || "Unknown",
                    action: "DELETE",
                    entity: "MeetingItem",
                    entityId: id,
                    details: JSON.stringify({ isDeleted: true })
                }
            });
        });

        await triggerPush();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/memory/meetings error:", error);
        return NextResponse.json({ error: "Failed to delete meeting" }, { status: 500 });
    }
}
