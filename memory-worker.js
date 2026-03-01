// @ts-nocheck
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const { google } = require('googleapis');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Incremental worker to pull Google Sheets into Memory B without hitting 429 Too Many Requests
// Interval set to 30 seconds to safely stay under the 60req/min Google Quota for 5 tabs.

let isSyncing = false;

async function getSheets() {
    const creds = process.env.GOOGLE_SHEETS_CREDENTIALS;
    if (!creds) throw new Error("GOOGLE_SHEETS_CREDENTIALS missing");
    const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(creds),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    return google.sheets({ version: "v4", auth });
}

const parseDate = (d) => { if (!d) return null; const p = new Date(d); return isNaN(p) ? null : p; };
const parseFloatStr = (s) => { if (!s) return 0; const c = parseFloat(String(s).replace(/,/g, '')); return isNaN(c) ? 0 : c; };

function mapRow(headers, row) {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] || null; });
    return obj;
}

async function fetchTab(sheets, spreadsheetId, tabName) {
    try {
        const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${tabName}!A1:Z500` });
        return res.data.values || [];
    } catch (error) {
        console.error(`[Worker] Failed pulling ${tabName}:`, error.message);
        return [];
    }
}

async function runIncrementalSync() {
    if (isSyncing) return;
    isSyncing = true;
    const startTime = Date.now();
    console.log(`[${new Date().toISOString()}] Memory B Worker: Starting Incremental Pull...`);

    try {
        const sheets = await getSheets();
        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

        // 1. SHIPMENTS
        const shRows = await fetchTab(sheets, spreadsheetId, "Shipments");
        if (shRows.length > 1) {
            const h = shRows[0];
            for (let i = 1; i < shRows.length; i++) {
                const r = mapRow(h, shRows[i]);
                if (!r['ID']) continue;
                await prisma.shipmentDetail.upsert({
                    where: { shipmentNumber: r['Shipment #'] || `SH-${r['ID']}` },
                    update: { status: r['Status'] || "draft", buyer: r['Buyer'], quantityLoaded: parseFloatStr(r['Qty Loaded (MT)']), salesPrice: parseFloatStr(r['Sales Price']), marginMt: parseFloatStr(r['Margin/MT']), eta: parseDate(r['ETA']), blDate: parseDate(r['BL Date']) },
                    create: { id: r['ID'], shipmentNumber: r['Shipment #'] || `SH-${r['ID']}`, status: r['Status'] || "draft", buyer: r['Buyer'] || "Unknown", quantityLoaded: parseFloatStr(r['Qty Loaded (MT)']), salesPrice: parseFloatStr(r['Sales Price']), marginMt: parseFloatStr(r['Margin/MT']), eta: parseDate(r['ETA']), blDate: parseDate(r['BL Date']) }
                }).catch(() => { });
            }
        }

        // 2. SOURCES
        const srcRows = await fetchTab(sheets, spreadsheetId, "Sources");
        if (srcRows.length > 1) {
            const h = srcRows[0];
            for (let i = 1; i < srcRows.length; i++) {
                const r = mapRow(h, srcRows[i]);
                if (!r['ID']) continue;
                await prisma.sourceSupplier.upsert({
                    where: { id: r['ID'] },
                    update: { name: r['Name'], region: r['Region'], stockAvailable: parseFloatStr(r['Stock Available']) },
                    create: { id: r['ID'], name: r['Name'] || "Local", region: r['Region'] || "Local", stockAvailable: parseFloatStr(r['Stock Available']) }
                }).catch(() => { });
            }
        }

        // 3. PROJECTS / DEALS
        const dlRows = await fetchTab(sheets, spreadsheetId, "Projects");
        if (dlRows.length > 1) {
            const h = dlRows[0];
            for (let i = 1; i < dlRows.length; i++) {
                const r = mapRow(h, dlRows[i]);
                if (!r['ID']) continue;
                await prisma.salesDeal.upsert({
                    where: { dealNumber: `DEAL-${r['ID']}` },
                    update: { status: r['Status'] || "pre_sale", buyer: r['Buyer'] || "Unknown", quantity: parseFloatStr(r['Quantity (MT)']), totalValue: parseFloatStr(r['Total Value']) },
                    create: { id: r['ID'], dealNumber: `DEAL-${r['ID']}`, status: r['Status'] || "pre_sale", buyer: r['Buyer'] || "Unknown", type: "export", quantity: parseFloatStr(r['Quantity (MT)']), totalValue: parseFloatStr(r['Total Value']) }
                }).catch(() => { });
            }
        }

        // 4. TASKS
        const tRows = await fetchTab(sheets, spreadsheetId, "Tasks");
        if (tRows.length > 1) {
            const h = tRows[0];
            for (let i = 1; i < tRows.length; i++) {
                const r = mapRow(h, tRows[i]);
                if (!r['ID']) continue;
                await prisma.taskItem.upsert({
                    where: { id: r['ID'] },
                    update: { title: r['Title'] || "Untitled", status: r['Status'] || "todo", priority: r['Priority'] || "medium" },
                    create: { id: r['ID'], title: r['Title'] || "Untitled", status: r['Status'] || "todo", priority: r['Priority'] || "medium", createdBy: "system", assigneeId: "usr-01", assigneeName: r['Assignee'] }
                }).catch(() => { });
            }
        }

        console.log(`[${new Date().toISOString()}] Memory B Worker: Pull Success in ${(Date.now() - startTime)}ms`);
    } catch (err) {
        console.error("[Worker] Critical Error:", err.message);
    } finally {
        isSyncing = false;
    }
}

// Start incremental sync every 30 seconds
console.log("=========================================");
console.log("Memory B Auto-Worker Initialized (PM2)");
console.log("Frequency: Every 30 seconds");
console.log("=========================================");
runIncrementalSync();
setInterval(runIncrementalSync, 30000);
