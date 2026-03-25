/**
 * Sheet Data Mappers
 * Convert between database models and Google Sheets row format
 */

type MeetingData = {
    id: string;
    title: string | null;
    date: Date | null;
    time: string | null;
    location: string | null;
    status: string | null;
    attendees: string | null; // JSON string or comma-separated
    voiceNoteUrl: string | null;
    momContent: string | null;
    aiSummary: string | null;
    createdByName: string | null;
    updatedAt: Date;
};

/**
 * Convert MeetingItem from DB to Sheet row format
 */
export function meetingToSheetRow(meeting: MeetingData): any[] {
    // Headers: ["ID", "Title", "Date", "Time", "Location", "Status", "Attendees", "Voice Note URL", "MoM Content", "AI Summary", "Created By", "Updated At"]
    
    let attendeesStr = "";
    if (meeting.attendees) {
        try {
            const parsed = JSON.parse(meeting.attendees);
            attendeesStr = Array.isArray(parsed) ? parsed.join(", ") : String(parsed);
        } catch {
            attendeesStr = meeting.attendees;
        }
    }

    return [
        meeting.id || "",
        meeting.title || "",
        meeting.date ? new Date(meeting.date).toISOString().split('T')[0] : "",
        meeting.time || "",
        meeting.location || "",
        meeting.status || "",
        attendeesStr,
        meeting.voiceNoteUrl || "",
        meeting.momContent || "",
        meeting.aiSummary || "",
        meeting.createdByName || "",
        meeting.updatedAt ? new Date(meeting.updatedAt).toISOString() : new Date().toISOString()
    ];
}

/**
 * Convert Sheet row to MeetingItem DB format
 */
export function sheetRowToMeeting(row: any[]): Partial<MeetingData> {
    // Headers: ["ID", "Title", "Date", "Time", "Location", "Status", "Attendees", "Voice Note URL", "MoM Content", "AI Summary", "Created By", "Updated At"]
    
    const attendeesStr = row[6] || "";
    let attendeesJson = null;
    if (attendeesStr) {
        try {
            // Try to parse as array, otherwise split by comma
            const attendeesArray = attendeesStr.includes(',') 
                ? attendeesStr.split(',').map((a: string) => a.trim()).filter(Boolean)
                : [attendeesStr];
            attendeesJson = JSON.stringify(attendeesArray);
        } catch {
            attendeesJson = JSON.stringify([attendeesStr]);
        }
    }

    return {
        id: row[0] || "",
        title: row[1] || null,
        date: row[2] ? new Date(row[2]) : null,
        time: row[3] || null,
        location: row[4] || null,
        status: row[5] || null,
        attendees: attendeesJson,
        voiceNoteUrl: row[7] || null,
        momContent: row[8] || null,
        aiSummary: row[9] || null,
        createdByName: row[10] || null,
        updatedAt: row[11] ? new Date(row[11]) : new Date()
    };
}

// TODO: Add mappers for other entities (Tasks, Sales, Purchases, etc.)
// Follow the same pattern:
// 1. {entity}ToSheetRow - converts DB model to array matching sheet headers
// 2. sheetRowTo{Entity} - converts sheet row array to DB model format
