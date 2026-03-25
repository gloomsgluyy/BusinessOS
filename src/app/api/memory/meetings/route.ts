/**
 * SHEETS-FIRST ARCHITECTURE
 * Flow: User action → Write to Sheets → Update DB cache → Return to user
 * Sheets = Source of Truth, DB = Cache
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { SheetWriteService, SHEET_NAMES } from "@/lib/sheet-write-service";
import { meetingToSheetRow, sheetRowToMeeting } from "@/lib/sheet-mappers";

/**
 * GET - Read from Sheets (Source of Truth)
 * Flow: Read from Sheets → Update DB cache → Return Sheets data
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        console.log("[GET /api/memory/meetings] Reading from Sheets (source of truth)");

        // 1. Read from Sheets
        const sheetRows = await SheetWriteService.readAll(SHEET_NAMES.MEETINGS);
        
        // 2. Convert sheet rows to meeting objects
        const meetings = sheetRows
            .filter(row => row && row[0]) // Has ID
            .map(row => {
                const meetingData = sheetRowToMeeting(row);
                
                // Parse attendees back to array for response
                let attendees: string[] = [];
                if (meetingData.attendees) {
                    try {
                        const parsed = JSON.parse(meetingData.attendees);
                        attendees = Array.isArray(parsed) ? parsed : [String(parsed)];
                    } catch {
                        attendees = meetingData.attendees.split(',').map((a: string) => a.trim()).filter(Boolean);
                    }
                }

                return {
                    ...meetingData,
                    attendees,
                    momContent: meetingData.momContent || null,
                    voiceNoteUrl: meetingData.voiceNoteUrl || null,
                    aiSummary: meetingData.aiSummary || null,
                };
            });

        // 3. Update DB cache in background (don't await)
        updateDBCache(meetings).catch(err => 
            console.error("[GET /api/memory/meetings] Failed to update DB cache:", err)
        );

        console.log(`[GET /api/memory/meetings] Returning ${meetings.length} meetings from Sheets`);
        return NextResponse.json({ success: true, meetings });
    } catch (error) {
        console.error("GET /api/memory/meetings error:", error);
        return NextResponse.json({ error: "Failed to fetch meetings" }, { status: 500 });
    }
}

/**
 * Helper: Update DB cache from Sheets data
 */
async function updateDBCache(meetings: any[]) {
    try {
        for (const meeting of meetings) {
            await prisma.meetingItem.upsert({
                where: { id: meeting.id },
                update: {
                    title: meeting.title,
                    date: meeting.date,
                    time: meeting.time,
                    location: meeting.location,
                    status: meeting.status,
                    attendees: typeof meeting.attendees === 'string' ? meeting.attendees : JSON.stringify(meeting.attendees),
                    voiceNoteUrl: meeting.voiceNoteUrl,
                    momContent: meeting.momContent,
                    aiSummary: meeting.aiSummary,
                    createdByName: meeting.createdByName,
                    updatedAt: meeting.updatedAt || new Date()
                },
                create: {
                    id: meeting.id,
                    title: meeting.title,
                    date: meeting.date,
                    time: meeting.time,
                    location: meeting.location,
                    status: meeting.status || "scheduled",
                    attendees: typeof meeting.attendees === 'string' ? meeting.attendees : JSON.stringify(meeting.attendees),
                    voiceNoteUrl: meeting.voiceNoteUrl,
                    momContent: meeting.momContent,
                    aiSummary: meeting.aiSummary,
                    createdByName: meeting.createdByName || "Unknown",
                    createdBy: "SHEET_SYNC",
                    isDeleted: false
                }
            });
        }
        console.log(`[updateDBCache] Synced ${meetings.length} meetings to DB`);
    } catch (error) {
        console.error("[updateDBCache] Error:", error);
    }
}

/**
 * POST - Create new meeting
 * Flow: Write to Sheets FIRST → Then update DB cache → Return
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const data = await req.json();
        
        // Generate ID for new meeting
        const meetingId = `MEET-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date();

        const meetingData = {
            id: meetingId,
            title: data.title,
            date: data.date ? new Date(data.date) : null,
            time: data.time,
            location: data.location,
            status: data.status || "scheduled",
            attendees: data.attendees ? JSON.stringify(data.attendees) : null,
            voiceNoteUrl: null,
            momContent: null,
            aiSummary: null,
            createdByName: session.user.name || null,
            updatedAt: now
        };

        console.log("[POST /api/memory/meetings] Writing to Sheets first...");

        // 1. Write to Sheets FIRST (source of truth)
        const sheetRow = meetingToSheetRow(meetingData);
        await SheetWriteService.appendRow(SHEET_NAMES.MEETINGS, sheetRow);

        console.log("[POST /api/memory/meetings] Sheets updated, now updating DB cache...");

        // 2. Then update DB cache (in transaction with audit log)
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

        console.log("[POST /api/memory/meetings] Success! Meeting created:", meetingId);
        return NextResponse.json({ success: true, meeting });
    } catch (error) {
        console.error("POST /api/memory/meetings error:", error);
        return NextResponse.json({ error: "Failed to create meeting" }, { status: 500 });
    }
}

/**
 * PUT - Update existing meeting
 * Flow: Write to Sheets FIRST → Then update DB cache → Return
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

        const now = new Date();
        const meetingData = {
            id: data.id,
            title: data.title,
            date: data.date ? new Date(data.date) : existingRecord.date,
            time: data.time !== undefined ? data.time : existingRecord.time,
            location: data.location !== undefined ? data.location : existingRecord.location,
            status: data.status !== undefined ? data.status : existingRecord.status,
            attendees: data.attendees ? JSON.stringify(data.attendees) : existingRecord.attendees,
            voiceNoteUrl: data.voiceNoteUrl !== undefined ? data.voiceNoteUrl : existingRecord.voiceNoteUrl,
            momContent: data.momContent !== undefined ? data.momContent : existingRecord.momContent,
            aiSummary: data.aiSummary !== undefined ? data.aiSummary : existingRecord.aiSummary,
            createdByName: existingRecord.createdByName,
            updatedAt: now
        };

        console.log("[PUT /api/memory/meetings] Updating Sheets first...");

        // 1. Update Sheets FIRST (source of truth)
        const sheetRow = meetingToSheetRow(meetingData);
        await SheetWriteService.updateRow(SHEET_NAMES.MEETINGS, data.id, sheetRow);

        console.log("[PUT /api/memory/meetings] Sheets updated, now updating DB cache...");

        // 2. Then update DB cache
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

        console.log("[PUT /api/memory/meetings] Success! Meeting updated:", data.id);
        return NextResponse.json({ success: true, meeting });
    } catch (error) {
        console.error("PUT /api/memory/meetings error:", error);
        return NextResponse.json({ error: "Failed to update meeting" }, { status: 500 });
    }
}

/**
 * DELETE - Delete meeting
 * Flow: Delete from Sheets FIRST → Then update DB cache (soft delete) → Return
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

        console.log("[DELETE /api/memory/meetings] Deleting from Sheets first...");

        // 1. Delete from Sheets FIRST (source of truth)
        await SheetWriteService.deleteRow(SHEET_NAMES.MEETINGS, id);

        console.log("[DELETE /api/memory/meetings] Sheets updated, now marking as deleted in DB cache...");

        // 2. Then soft delete in DB cache
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

        console.log("[DELETE /api/memory/meetings] Success! Meeting deleted:", id);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/memory/meetings error:", error);
        return NextResponse.json({ error: "Failed to delete meeting" }, { status: 500 });
    }
}
