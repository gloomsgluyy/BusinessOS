// @ts-nocheck
require("dotenv").config({ path: ".env.local" });
require("dotenv").config();
const { PrismaClient } = require('@prisma/client');
const { google } = require('googleapis');

const prisma = new PrismaClient();

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

async function fetchTab(tabName) {
    const sheets = getSheets();
    try {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${tabName}!A:Z`,
        });
        return res.data.values || [];
    } catch (e) {
        console.error(`Error fetching Tab ${tabName}:`, e.message || e);
        return [];
    }
}

function parseDate(dStr) {
    if (!dStr) return null;
    const d = new Date(dStr);
    return isNaN(d.getTime()) ? null : d;
}

function parseFloatSafe(nStr) {
    if (!nStr) return 0;
    const n = parseFloat(nStr.replace(/[^0-9.-]+/g, ""));
    return isNaN(n) ? 0 : n;
}

async function syncMeetings() {
    console.log("Syncing Meetings (Meetings)...");
    const rows = await fetchTab("Meetings");
    if (rows.length <= 1) return;
    const headers = rows[0];

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const obj = {};
        headers.forEach((h, idx) => { obj[h] = row[idx] || ""; });

        if (!obj['ID']) continue;

        await prisma.meetingItem.upsert({
            where: { id: obj['ID'] },
            update: {
                title: obj['Title'],
                date: parseDate(obj['Date']),
                time: obj['Time'],
                location: obj['Location'],
                status: obj['Status'] || "scheduled",
                attendees: obj['Attendees'],
                createdByName: obj['Created By'],
                createdBy: "system"
            },
            create: {
                id: obj['ID'],
                title: obj['Title'] || "Untitled",
                date: parseDate(obj['Date']),
                time: obj['Time'],
                location: obj['Location'],
                status: obj['Status'] || "scheduled",
                attendees: obj['Attendees'],
                createdByName: obj['Created By'],
                createdBy: "system"
            }
        });
    }
}

async function syncTasks() {
    console.log("Syncing Tasks (Tasks)...");
    const rows = await fetchTab("Tasks");
    if (rows.length <= 1) return;
    const headers = rows[0];

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const obj = {};
        headers.forEach((h, idx) => { obj[h] = row[idx] || ""; });

        if (!obj['ID']) continue;

        await prisma.taskItem.upsert({
            where: { id: obj['ID'] },
            update: {
                title: obj['Title'],
                description: obj['Description'],
                status: obj['Status'] || "todo",
                priority: obj['Priority'] || "medium",
                assigneeName: obj['Assignee'],
                dueDate: parseDate(obj['Due Date']),
            },
            create: {
                id: obj['ID'],
                title: obj['Title'] || "Untitled",
                description: obj['Description'],
                status: obj['Status'] || "todo",
                priority: obj['Priority'] || "medium",
                assigneeName: obj['Assignee'],
                dueDate: parseDate(obj['Due Date']),
                createdBy: "system"
            }
        });
    }
}

async function syncSalesOrders() {
    console.log("Syncing Sales Orders (Sales)...");
    const rows = await fetchTab("Sales");
    if (rows.length <= 1) return;
    const headers = rows[0];

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const obj = {};
        headers.forEach((h, idx) => { obj[h] = row[idx] || ""; });

        if (!obj['ID']) continue;

        await prisma.salesOrder.upsert({
            where: { orderNumber: obj['Order #'] || obj['ID'] },
            update: {
                client: obj['Client'],
                description: obj['Description'],
                amount: parseFloatSafe(obj['Amount']),
                priority: obj['Priority'] || "medium",
                status: obj['Status'] || "pending",
                imageUrl: obj['Image Preview'],
                createdByName: obj['Created By']
            },
            create: {
                id: obj['ID'],
                orderNumber: obj['Order #'] || obj['ID'],
                client: obj['Client'] || "Unknown",
                description: obj['Description'],
                amount: parseFloatSafe(obj['Amount']),
                priority: obj['Priority'] || "medium",
                status: obj['Status'] || "pending",
                imageUrl: obj['Image Preview'],
                createdByName: obj['Created By'],
                createdBy: "system"
            }
        });
    }
}

async function syncPurchaseRequests() {
    console.log("Syncing Purchases (Expenses)...");
    const rows = await fetchTab("Expenses");
    if (rows.length <= 1) return;
    const headers = rows[0];

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const obj = {};
        headers.forEach((h, idx) => { obj[h] = row[idx] || ""; });

        if (!obj['ID']) continue;

        await prisma.purchaseRequest.upsert({
            where: { requestNumber: obj['Request #'] || obj['ID'] },
            update: {
                category: obj['Category'],
                supplier: obj['Supplier'],
                description: obj['Description'],
                amount: parseFloatSafe(obj['Amount']),
                priority: obj['Priority'] || "medium",
                status: obj['Status'] || "pending",
                imageUrl: obj['Image Preview'],
                createdByName: obj['Created By']
            },
            create: {
                id: obj['ID'],
                requestNumber: obj['Request #'] || obj['ID'],
                category: obj['Category'] || "General",
                supplier: obj['Supplier'],
                description: obj['Description'],
                amount: parseFloatSafe(obj['Amount']),
                priority: obj['Priority'] || "medium",
                status: obj['Status'] || "pending",
                imageUrl: obj['Image Preview'],
                createdByName: obj['Created By'],
                createdBy: "system"
            }
        });
    }
}

async function main() {
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
