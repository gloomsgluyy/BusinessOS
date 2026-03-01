require("dotenv").config({ path: ".env.local" });
require("dotenv").config();
const { PrismaClient } = require('@prisma/client');
const { google } = require('googleapis');

const prisma = new PrismaClient();

// Standalone Auth for CLI script
function getSheets() {
    const credentials = process.env.GOOGLE_SHEETS_CREDENTIALS;
    if (!credentials) throw new Error("GOOGLE_SHEETS_CREDENTIALS not set in .env");

    const parsed = JSON.parse(credentials);
    const auth = new google.auth.GoogleAuth({
        credentials: parsed,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    return google.sheets({ version: "v4", auth });
}

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID || "";

async function fetchTab(tabName: string) {
    const sheets = getSheets();
    try {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${tabName}!A:Z`,
        });
        return res.data.values || [];
    } catch (e) {
        console.warn(`Tab ${tabName} not found or empty.`);
        return [];
    }
}

function parseDate(dStr?: string) {
    if (!dStr) return null;
    const d = new Date(dStr);
    return isNaN(d.getTime()) ? null : d;
}

function parseFloatSafe(nStr?: string) {
    if (!nStr) return 0;
    const n = parseFloat(nStr);
    return isNaN(n) ? 0 : n;
}

async function syncMeetings() {
    console.log("Syncing Meetings (DB_Meetings)...");
    const rows = await fetchTab("DB_Meetings");
    if (rows.length <= 1) return;
    const headers = rows[0];

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const obj: any = {};
        headers.forEach((h: string, idx: number) => { obj[h] = row[idx] || ""; });

        if (!obj.id) continue;

        await prisma.meetingItem.upsert({
            where: { id: obj.id },
            update: {
                title: obj.title,
                date: parseDate(obj.date),
                time: obj.time,
                location: obj.location,
                status: obj.status || "scheduled",
                attendees: obj.attendees,
                createdByName: obj.created_by_name,
                createdBy: obj.created_by || "system"
            },
            create: {
                id: obj.id,
                title: obj.title || "Untitled",
                date: parseDate(obj.date),
                time: obj.time,
                location: obj.location,
                status: obj.status || "scheduled",
                attendees: obj.attendees,
                createdByName: obj.created_by_name,
                createdBy: obj.created_by || "system",
                createdAt: parseDate(obj.created_at) || new Date()
            }
        });
    }
}

async function syncTasks() {
    console.log("Syncing Tasks (DB_Tasks)...");
    const rows = await fetchTab("DB_Tasks");
    if (rows.length <= 1) return;
    const headers = rows[0];

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const obj: any = {};
        headers.forEach((h: string, idx: number) => { obj[h] = row[idx] || ""; });

        if (!obj.id) continue;

        await prisma.taskItem.upsert({
            where: { id: obj.id },
            update: {
                title: obj.title,
                description: obj.description,
                status: obj.status || "todo",
                priority: obj.priority || "medium",
                assigneeId: obj.assignee_id,
                assigneeName: obj.assignee_name,
                dueDate: parseDate(obj.due_date),
            },
            create: {
                id: obj.id,
                title: obj.title || "Untitled",
                description: obj.description,
                status: obj.status || "todo",
                priority: obj.priority || "medium",
                assigneeId: obj.assignee_id,
                assigneeName: obj.assignee_name,
                dueDate: parseDate(obj.due_date),
                createdBy: obj.created_by || "system",
                createdAt: parseDate(obj.created_at) || new Date()
            }
        });
    }
}

async function syncSalesOrders() {
    console.log("Syncing Sales Orders (DB_Sales)...");
    const rows = await fetchTab("DB_Sales");
    if (rows.length <= 1) return;
    const headers = rows[0];

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const obj: any = {};
        headers.forEach((h: string, idx: number) => { obj[h] = row[idx] || ""; });

        if (!obj.id) continue;

        await prisma.salesOrder.upsert({
            where: { orderNumber: obj.order_number || obj.id },
            update: {
                client: obj.client,
                description: obj.description,
                amount: parseFloatSafe(obj.amount),
                priority: obj.priority || "medium",
                status: obj.status || "pending",
                imageUrl: obj.image_url,
                createdByName: obj.created_by_name,
                approvedBy: obj.approved_by,
                notes: obj.notes,
            },
            create: {
                id: obj.id,
                orderNumber: obj.order_number || obj.id,
                client: obj.client || "Unknown",
                description: obj.description,
                amount: parseFloatSafe(obj.amount),
                priority: obj.priority || "medium",
                status: obj.status || "pending",
                imageUrl: obj.image_url,
                createdByName: obj.created_by_name,
                createdBy: obj.created_by || "system",
                approvedBy: obj.approved_by,
                notes: obj.notes,
                createdAt: parseDate(obj.created_at) || new Date()
            }
        });
    }
}

async function syncPurchaseRequests() {
    console.log("Syncing Purchases (DB_Purchases)...");
    const rows = await fetchTab("DB_Purchases");
    if (rows.length <= 1) return;
    const headers = rows[0];

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const obj: any = {};
        headers.forEach((h: string, idx: number) => { obj[h] = row[idx] || ""; });

        if (!obj.id) continue;

        await prisma.purchaseRequest.upsert({
            where: { requestNumber: obj.request_number || obj.id },
            update: {
                category: obj.category,
                supplier: obj.supplier,
                description: obj.description,
                amount: parseFloatSafe(obj.amount),
                priority: obj.priority || "medium",
                status: obj.status || "pending",
                imageUrl: obj.image_url,
                createdByName: obj.created_by_name,
                approvedBy: obj.approved_by,
                notes: obj.notes,
            },
            create: {
                id: obj.id,
                requestNumber: obj.request_number || obj.id,
                category: obj.category || "General",
                supplier: obj.supplier,
                description: obj.description,
                amount: parseFloatSafe(obj.amount),
                priority: obj.priority || "medium",
                status: obj.status || "pending",
                imageUrl: obj.image_url,
                createdByName: obj.created_by_name,
                createdBy: obj.created_by || "system",
                approvedBy: obj.approved_by,
                notes: obj.notes,
                createdAt: parseDate(obj.created_at) || new Date()
            }
        });
    }
}

async function main() {
    require("dotenv").config();
    console.log("=========================================");
    console.log("Memory B Base Downloader (Google Sheets)");
    console.log("=========================================");

    await syncTasks();
    await syncMeetings();
    await syncSalesOrders();
    await syncPurchaseRequests();

    console.log("-----------------------------------------");
    console.log("Done syncing Google Sheets to Memory B!");
    console.log("-----------------------------------------");
}

main()
    .catch(e => {
        console.error("Critical Sync Error:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
