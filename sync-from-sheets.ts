// @ts-nocheck
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const { google } = require('googleapis');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getSheets() {
    const credentials = process.env.GOOGLE_SHEETS_CREDENTIALS;
    if (!credentials) throw new Error("GOOGLE_SHEETS_CREDENTIALS not set in .env");
    const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(credentials),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    return google.sheets({ version: "v4", auth });
}

async function fetchTab(tabName) {
    const sheets = await getSheets();
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    try {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${tabName}!A1:Z1000`,
        });
        return res.data.values || [];
    } catch (error) {
        console.error(`Error fetching tab ${tabName}:`, error.message);
        return [];
    }
}

// Map Array row to object using Headers
function mapRow(headers, row) {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] || null; });
    return obj;
}

const parseDate = (d) => { if (!d) return null; const p = new Date(d); return isNaN(p) ? null : p; };
const parseFloatStr = (s) => { if (!s) return 0; const c = parseFloat(String(s).replace(/,/g, '')); return isNaN(c) ? 0 : c; };

async function syncAll() {
    console.log("=========================================");
    console.log("Memory B Base Downloader (Google Sheets)");
    console.log("=========================================");

    // 1. Sync Shipments (Shipments -> ShipmentDetail)
    console.log("Syncing Shipments (Shipments)...");
    const shRows = await fetchTab("Shipments");
    if (shRows.length > 1) {
        const headers = shRows[0];
        for (let i = 1; i < shRows.length; i++) {
            const row = mapRow(headers, shRows[i]);
            if (!row['ID']) continue;
            try {
                await prisma.shipmentDetail.upsert({
                    where: { shipmentNumber: row['Shipment #'] || `SHP-${row['ID']}` },
                    update: {
                        status: row['Status'] || "draft",
                        buyer: row['Buyer'] || "Unknown",
                        supplier: row['Supplier'],
                        isBlending: row['Is Blending'] === 'TRUE',
                        iupOp: row['IUP OP'],
                        vesselName: row['Vessel Name'],
                        bargeName: row['Barge Name'],
                        loadingPort: row['Loading Port'],
                        dischargePort: row['Discharge Port'],
                        quantityLoaded: parseFloatStr(row['Qty Loaded (MT)']),
                        blDate: parseDate(row['BL Date']),
                        eta: parseDate(row['ETA']),
                        salesPrice: parseFloatStr(row['Sales Price']),
                        marginMt: parseFloatStr(row['Margin/MT']),
                        picName: row['PIC'],
                        type: row['Type'] || "export"
                    },
                    create: {
                        id: row['ID'] || undefined,
                        shipmentNumber: row['Shipment #'] || `SHP-${row['ID']}`,
                        status: row['Status'] || "draft",
                        buyer: row['Buyer'] || "Unknown",
                        supplier: row['Supplier'],
                        isBlending: row['Is Blending'] === 'TRUE',
                        iupOp: row['IUP OP'],
                        vesselName: row['Vessel Name'],
                        bargeName: row['Barge Name'],
                        loadingPort: row['Loading Port'],
                        dischargePort: row['Discharge Port'],
                        quantityLoaded: parseFloatStr(row['Qty Loaded (MT)']),
                        blDate: parseDate(row['BL Date']),
                        eta: parseDate(row['ETA']),
                        salesPrice: parseFloatStr(row['Sales Price']),
                        marginMt: parseFloatStr(row['Margin/MT']),
                        picName: row['PIC'],
                        type: row['Type'] || "export"
                    }
                });
            } catch (e) {
                console.error("Error upserting Shipment", row['ID'], e.message);
            }
        }
    }

    // 2. Sync Sources (Sources -> SourceSupplier)
    console.log("Syncing Sources (Sources)...");
    const srcRows = await fetchTab("Sources");
    if (srcRows.length > 1) {
        const headers = srcRows[0];
        for (let i = 1; i < srcRows.length; i++) {
            const row = mapRow(headers, srcRows[i]);
            if (!row['ID']) continue;
            try {
                await prisma.sourceSupplier.upsert({
                    where: { id: row['ID'] },
                    update: {
                        name: row['Name'] || "Unknown",
                        region: row['Region'] || "Unknown",
                        calorieRange: row['Calorie Range'],
                        gar: parseFloatStr(row['GAR']),
                        ts: parseFloatStr(row['TS']),
                        ash: parseFloatStr(row['Ash']),
                        tm: parseFloatStr(row['TM']),
                        jettyPort: row['Jetty Port'],
                        anchorage: row['Anchorage'],
                        stockAvailable: parseFloatStr(row['Stock Available']),
                        minStockAlert: parseFloatStr(row['Min Stock Alert']),
                        kycStatus: row['KYC Status'] || "pending",
                        psiStatus: row['PSI Status'] || "not_started",
                        fobBargeOnly: row['FOB Barge Only'] === 'TRUE',
                        priceLinkedIndex: row['Price Linked Index'],
                        fobBargePriceUsd: parseFloatStr(row['FOB Barge Price (USD)']),
                        contractType: row['Contract Type'],
                        picName: row['PIC'],
                        iupNumber: row['IUP Number']
                    },
                    create: {
                        id: row['ID'],
                        name: row['Name'] || "Unknown",
                        region: row['Region'] || "Unknown",
                        calorieRange: row['Calorie Range'],
                        gar: parseFloatStr(row['GAR']),
                        ts: parseFloatStr(row['TS']),
                        ash: parseFloatStr(row['Ash']),
                        tm: parseFloatStr(row['TM']),
                        jettyPort: row['Jetty Port'],
                        anchorage: row['Anchorage'],
                        stockAvailable: parseFloatStr(row['Stock Available']),
                        minStockAlert: parseFloatStr(row['Min Stock Alert']),
                        kycStatus: row['KYC Status'] || "pending",
                        psiStatus: row['PSI Status'] || "not_started",
                        fobBargeOnly: row['FOB Barge Only'] === 'TRUE',
                        priceLinkedIndex: row['Price Linked Index'],
                        fobBargePriceUsd: parseFloatStr(row['FOB Barge Price (USD)']),
                        contractType: row['Contract Type'],
                        picName: row['PIC'],
                        iupNumber: row['IUP Number']
                    }
                });
            } catch (e) { console.error("Error upserting Source", row['ID'], e.message); }
        }
    }

    // 3. Sync Market Price (Market Price -> MarketPrice)
    console.log("Syncing Market Price (Market Price)...");
    const mpRows = await fetchTab("Market Price");
    if (mpRows.length > 1) {
        const headers = mpRows[0];
        for (let i = 1; i < mpRows.length; i++) {
            const row = mapRow(headers, mpRows[i]);
            if (!row['ID']) continue;
            try {
                await prisma.marketPrice.upsert({
                    where: { id: row['ID'] },
                    update: {
                        date: parseDate(row['Date']) || new Date(),
                        ici1: parseFloatStr(row['ICI 1']),
                        ici2: parseFloatStr(row['ICI 2']),
                        ici3: parseFloatStr(row['ICI 3']),
                        ici4: parseFloatStr(row['ICI 4']),
                        newcastle: parseFloatStr(row['Newcastle']),
                        hba: parseFloatStr(row['HBA']),
                        source: row['Source']
                    },
                    create: {
                        id: row['ID'],
                        date: parseDate(row['Date']) || new Date(),
                        ici1: parseFloatStr(row['ICI 1']),
                        ici2: parseFloatStr(row['ICI 2']),
                        ici3: parseFloatStr(row['ICI 3']),
                        ici4: parseFloatStr(row['ICI 4']),
                        newcastle: parseFloatStr(row['Newcastle']),
                        hba: parseFloatStr(row['HBA']),
                        source: row['Source']
                    }
                });
            } catch (e) { }
        }
    }

    // 4. Sync Sales Deals (Projects -> SalesDeal)
    console.log("Syncing Projects (SalesDeal)...");
    const sdRows = await fetchTab("Projects");
    if (sdRows.length > 1) {
        const headers = sdRows[0];
        for (let i = 1; i < sdRows.length; i++) {
            const row = mapRow(headers, sdRows[i]);
            if (!row['ID']) continue;
            try {
                await prisma.salesDeal.upsert({
                    where: { dealNumber: `DEAL-${row['ID']}` },
                    update: {
                        status: row['Status'] || "pre_sale",
                        buyer: row['Buyer'] || "Unknown",
                        buyerCountry: row['Country'],
                        type: row['Type'] || "export",
                        quantity: parseFloatStr(row['Quantity (MT)']),
                        pricePerMt: parseFloatStr(row['Price/MT']),
                        totalValue: parseFloatStr(row['Total Value']),
                        laycanStart: parseDate(row['Laycan Start']),
                        laycanEnd: parseDate(row['Laycan End']),
                        picName: row['PIC']
                    },
                    create: {
                        id: row['ID'],
                        dealNumber: `DEAL-${row['ID']}`,
                        status: row['Status'] || "pre_sale",
                        buyer: row['Buyer'] || "Unknown",
                        buyerCountry: row['Country'],
                        type: row['Type'] || "export",
                        quantity: parseFloatStr(row['Quantity (MT)']),
                        pricePerMt: parseFloatStr(row['Price/MT']),
                        totalValue: parseFloatStr(row['Total Value']),
                        laycanStart: parseDate(row['Laycan Start']),
                        laycanEnd: parseDate(row['Laycan End']),
                        picName: row['PIC']
                    }
                });
            } catch (e) { }
        }
    }

    // We will rerun Tasks just in case we need to
    console.log("Syncing Tasks (Tasks)...");
    const tRows = await fetchTab("Tasks");
    if (tRows.length > 1) {
        const headers = tRows[0];
        for (let i = 1; i < tRows.length; i++) {
            const row = mapRow(headers, tRows[i]);
            if (!row['ID']) continue;
            try {
                await prisma.taskItem.upsert({
                    where: { id: row['ID'] },
                    update: {
                        title: row['Title'] || "Untitled",
                        description: row['Description'],
                        status: row['Status'] || "todo",
                        priority: row['Priority'] || "medium",
                        assigneeId: "usr-001",
                        assigneeName: row['Assignee'],
                        dueDate: parseDate(row['Due Date']),
                    },
                    create: {
                        id: row['ID'],
                        title: row['Title'] || "Untitled",
                        description: row['Description'],
                        status: row['Status'] || "todo",
                        priority: row['Priority'] || "medium",
                        assigneeId: "usr-001",
                        assigneeName: row['Assignee'],
                        dueDate: parseDate(row['Due Date']),
                        createdBy: "system"
                    }
                });
            } catch (e) { }
        }
    }

    console.log("-----------------------------------------");
    console.log("Done syncing ALL Tabs from Google Sheets to Memory B!");
    console.log("-----------------------------------------");
}

syncAll().catch(e => {
    console.error("Failed:", e);
}).finally(() => {
    prisma.$disconnect();
});
