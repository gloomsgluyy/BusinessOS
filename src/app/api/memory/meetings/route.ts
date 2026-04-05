/**
 * DATABASE-FIRST ARCHITECTURE
 * Flow: User action → Write to DB → Trigger optional push to Sheets → Return to user
 * Database = Source of Truth, Sheets = Backup/Export
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { PushService } from "@/lib/push-to-sheets";

async function triggerPush() {
    PushService.debouncedPush("meetingItem").catch(err => console.error("Optional Sheet push failed:", err));
}

/**
 * GET - Read from Database (Source of Truth)
 * Flow: Read from DB → Return DB data
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        console.log("[GET /api/memory/meetings] Reading from database (source of truth)");

        const meetings = await prisma.meetingItem.findMany({
            where: { isDeleted: false },
            orderBy: { createdAt: "desc" }
        });

        const formattedMeetings = meetings.map(meeting => {
            let attendees: string[] = [];
            if (meeting.attendees) {
                try {
                    const parsed = JSON.parse(meeting.attendees);
                    attendees = Array.isArray(parsed) ? parsed : [String(parsed)];
                } catch {
                    attendees = meeting.attendees.split(',').map((a: string) => a.trim()).filter(Boolean);
                }
            }

            return {
                ...meeting,
                attendees,
            };
        });

        console.log(`[GET /api/memory/meetings] Returning ${formattedMeetings.length} meetings from database`);
        return NextResponse.json({ success: true, meetings: formattedMeetings });
    } catch (error) {
        console.error("GET /api/memory/meetings error:", error);
        return NextResponse.json({ error: "Failed to fetch meetings" }, { status: 500 });
    }
}

/**
 * POST - Create new meeting
 * Flow: Write to DB FIRST → Trigger optional push to Sheets → Return
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const data = await req.json();
        
        const meetingId = `MEET-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        console.log("[POST /api/memory/meetings] Writing to database (source of truth)...");

        const meeting = await prisma.$transaction(async (tx) => {
            const newMeeting = await tx.meetingItem.create({
                data: {
                    id: meetingId,
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

        console.log("[POST /api/memory/meetings] Success! Meeting created:", meetingId);
        return NextResponse.json({ success: true, meeting });
    } catch (error) {
        console.error("POST /api/memory/meetings error:", error);
        return NextResponse.json({ error: "Failed to create meeting" }, { status: 500 });
    }
}

/**
 * PUT - Update existing meeting
 * Flow: Update DB FIRST → Trigger optional push to Sheets → Return
 */
export async function PUT(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const data = await req.json();
        if (!data.id) return NextResponse.json({ error: "Meeting ID missing" }, { status: 400 });

        const existingRecord = await prisma.meetingItem.findUnique({ where: { id: data.id } });
        if (!existingRecord || existingRecord.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
        
        const userRole = session.user.role?.toLowerCase() || "";
        if (existingRecord.createdBy !== session.user.id && !["ceo", "director", "manager"].includes(userRole)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        console.log("[PUT /api/memory/meetings] Updating database (source of truth)...");

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

        console.log("[PUT /api/memory/meetings] Success! Meeting updated:", data.id);
        return NextResponse.json({ success: true, meeting });
    } catch (error) {
        console.error("PUT /api/memory/meetings error:", error);
        return NextResponse.json({ error: "Failed to update meeting" }, { status: 500 });
    }
}

/**
 * DELETE - Delete meeting
 * Flow: Delete from DB FIRST (soft delete) → Trigger optional push to Sheets → Return
 */
export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const url = new URL(req.url);
        const id = url.searchParams.get("id");
        if (!id) return NextResponse.json({ error: "Meeting ID missing" }, { status: 400 });

        const existingRecord = await prisma.meetingItem.findUnique({ where: { id } });
        if (!existingRecord || existingRecord.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
        
        const userRole = session.user.role?.toLowerCase() || "";
        if (existingRecord.createdBy !== session.user.id && !["ceo", "director", "manager"].includes(userRole)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        console.log("[DELETE /api/memory/meetings] Deleting from database (source of truth)...");

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

        console.log("[DELETE /api/memory/meetings] Success! Meeting deleted:", id);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/memory/meetings error:", error);
        return NextResponse.json({ error: "Failed to delete meeting" }, { status: 500 });
    }
}
