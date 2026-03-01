// @ts-nocheck
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const { google } = require('googleapis');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getSheets() {
    let credentials = process.env.GOOGLE_SHEETS_CREDENTIALS;
    if (!credentials) throw new Error("GOOGLE_SHEETS_CREDENTIALS not set in .env");
    credentials = credentials.trim().replace(/^'([\s\S]*)'$/, '$1').replace(/^"([\s\S]*)"$/, '$1');
    const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(credentials),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    return google.sheets({ version: "v4", auth });
}

async function fetchTab(sheets, spreadsheetId, tabName) {
    try {
        const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${tabName}!A1:Z500` });
        return res.data.values || [];
    } catch (e) {
        console.error(`  [!] Error pulling ${tabName}:`, e.message);
        return [];
    }
}

function mapRow(headers, row) {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] || null; });
    return obj;
}

const parseDate = (d) => { if (!d) return null; const p = new Date(d); return isNaN(p) ? null : p; };
const num = (s) => {
    if (!s) return 0;
    let str = String(s).trim();
    if (/^[\d.]+,[\d]+$/.test(str)) {
        str = str.replace(/\./g, '').replace(',', '.');
    } else {
        str = str.replace(/,/g, '');
    }
    const c = parseFloat(str);
    return isNaN(c) ? 0 : c;
};

async function syncAll() {
    console.log("=========================================");
    console.log("Memory B FULL Sync (Google Sheets)");
    console.log("=========================================");

    const sheets = await getSheets();
    const sid = process.env.GOOGLE_SHEETS_ID;

    // ─── 1. TASKS ────────────────────────────────────────
    console.log("Syncing Tasks...");
    const tRows = await fetchTab(sheets, sid, "Tasks");
    if (tRows.length > 1) {
        const h = tRows[0];
        for (let i = 1; i < tRows.length; i++) {
            const r = mapRow(h, tRows[i]);
            if (!r['ID']) continue;
            await prisma.taskItem.upsert({
                where: { id: r['ID'] },
                update: { title: r['Title'] || "Untitled", description: r['Description'], status: r['Status'] || "todo", priority: r['Priority'] || "medium", assigneeName: r['Assignee'], dueDate: parseDate(r['Due Date']) },
                create: { id: r['ID'], title: r['Title'] || "Untitled", description: r['Description'], status: r['Status'] || "todo", priority: r['Priority'] || "medium", assigneeId: "usr-001", assigneeName: r['Assignee'], dueDate: parseDate(r['Due Date']), createdBy: "system" }
            }).catch(() => { });
        }
    }

    // ─── 2. SALES ORDERS ─────────────────────────────────
    console.log("Syncing Sales Orders (Sales)...");
    const soRows = await fetchTab(sheets, sid, "Sales");
    if (soRows.length > 1) {
        const h = soRows[0];
        for (let i = 1; i < soRows.length; i++) {
            const r = mapRow(h, soRows[i]);
            if (!r['ID']) continue;
            await prisma.salesOrder.upsert({
                where: { orderNumber: r['Order #'] || `SO-${r['ID']}` },
                update: { client: r['Client'] || "Unknown", description: r['Description'], amount: num(r['Amount']), priority: r['Priority'] || "medium", status: r['Status'] || "pending" },
                create: { id: r['ID'], orderNumber: r['Order #'] || `SO-${r['ID']}`, client: r['Client'] || "Unknown", description: r['Description'], amount: num(r['Amount']), priority: r['Priority'] || "medium", status: r['Status'] || "pending", createdBy: "system", createdByName: r['Created By'] }
            }).catch(() => { });
        }
    }

    // ─── 3. SHIPMENTS ────────────────────────────────────
    console.log("Syncing Shipments...");
    const shRows = await fetchTab(sheets, sid, "Shipments");
    if (shRows.length > 1) {
        const h = shRows[0];
        for (let i = 1; i < shRows.length; i++) {
            const r = mapRow(h, shRows[i]);
            if (!r['ID']) continue;
            await prisma.shipmentDetail.upsert({
                where: { shipmentNumber: r['Shipment #'] || `SHP-${r['ID']}` },
                update: { status: r['Status'] || "draft", buyer: r['Buyer'] || "Unknown", supplier: r['Supplier'], vesselName: r['Vessel Name'], bargeName: r['Barge Name'], loadingPort: r['Loading Port'], dischargePort: r['Discharge Port'], quantityLoaded: num(r['Qty Loaded (MT)']), blDate: parseDate(r['BL Date']), eta: parseDate(r['ETA']), salesPrice: num(r['Sales Price']), marginMt: num(r['Margin/MT']), picName: r['PIC'], type: r['Type'] || "export" },
                create: { id: r['ID'], shipmentNumber: r['Shipment #'] || `SHP-${r['ID']}`, status: r['Status'] || "draft", buyer: r['Buyer'] || "Unknown", supplier: r['Supplier'], vesselName: r['Vessel Name'], bargeName: r['Barge Name'], loadingPort: r['Loading Port'], dischargePort: r['Discharge Port'], quantityLoaded: num(r['Qty Loaded (MT)']), blDate: parseDate(r['BL Date']), eta: parseDate(r['ETA']), salesPrice: num(r['Sales Price']), marginMt: num(r['Margin/MT']), picName: r['PIC'], type: r['Type'] || "export" }
            }).catch(() => { });
        }
    }

    // ─── 4. SOURCES ──────────────────────────────────────
    console.log("Syncing Sources...");
    const srcRows = await fetchTab(sheets, sid, "Sources");
    if (srcRows.length > 1) {
        const h = srcRows[0];
        for (let i = 1; i < srcRows.length; i++) {
            const r = mapRow(h, srcRows[i]);
            if (!r['ID']) continue;
            await prisma.sourceSupplier.upsert({
                where: { id: r['ID'] },
                update: { name: r['Name'] || "Unknown", region: r['Region'] || "Unknown", calorieRange: r['Calorie Range'], gar: num(r['GAR']), ts: num(r['TS']), ash: num(r['Ash']), tm: num(r['TM']), jettyPort: r['Jetty Port'], anchorage: r['Anchorage'], stockAvailable: num(r['Stock Available']), minStockAlert: num(r['Min Stock Alert']), kycStatus: r['KYC Status'] || "pending", psiStatus: r['PSI Status'] || "not_started", fobBargeOnly: r['FOB Barge Only'] === 'TRUE', priceLinkedIndex: r['Price Linked Index'], fobBargePriceUsd: num(r['FOB Barge Price (USD)']), contractType: r['Contract Type'], picName: r['PIC'], iupNumber: r['IUP Number'] },
                create: { id: r['ID'], name: r['Name'] || "Unknown", region: r['Region'] || "Unknown", calorieRange: r['Calorie Range'], gar: num(r['GAR']), ts: num(r['TS']), ash: num(r['Ash']), tm: num(r['TM']), jettyPort: r['Jetty Port'], anchorage: r['Anchorage'], stockAvailable: num(r['Stock Available']), minStockAlert: num(r['Min Stock Alert']), kycStatus: r['KYC Status'] || "pending", psiStatus: r['PSI Status'] || "not_started", fobBargeOnly: r['FOB Barge Only'] === 'TRUE', priceLinkedIndex: r['Price Linked Index'], fobBargePriceUsd: num(r['FOB Barge Price (USD)']), contractType: r['Contract Type'], picName: r['PIC'], iupNumber: r['IUP Number'] }
            }).catch(() => { });
        }
    }

    // ─── 5. QUALITY ──────────────────────────────────────
    console.log("Syncing Quality...");
    const qRows = await fetchTab(sheets, sid, "Quality");
    if (qRows.length > 1) {
        const h = qRows[0];
        for (let i = 1; i < qRows.length; i++) {
            const r = mapRow(h, qRows[i]);
            if (!r['ID']) continue;
            await prisma.qualityResult.upsert({
                where: { id: r['ID'] },
                update: { cargoName: r['Cargo Name'] || "Unknown", surveyor: r['Surveyor'], samplingDate: parseDate(r['Sampling Date']), gar: num(r['GAR']), ts: num(r['TS']), ash: num(r['Ash']), tm: num(r['TM']), status: r['Status'] || "pending" },
                create: { id: r['ID'], cargoId: r['Cargo ID'] || r['ID'], cargoName: r['Cargo Name'] || "Unknown", surveyor: r['Surveyor'], samplingDate: parseDate(r['Sampling Date']), gar: num(r['GAR']), ts: num(r['TS']), ash: num(r['Ash']), tm: num(r['TM']), status: r['Status'] || "pending" }
            }).catch(() => { });
        }
    }

    // ─── 6. MARKET PRICE ─────────────────────────────────
    console.log("Syncing Market Price...");
    const mpRows = await fetchTab(sheets, sid, "Market Price");
    if (mpRows.length > 1) {
        const h = mpRows[0];
        for (let i = 1; i < mpRows.length; i++) {
            const r = mapRow(h, mpRows[i]);
            if (!r['ID']) continue;
            await prisma.marketPrice.upsert({
                where: { id: r['ID'] },
                update: { date: parseDate(r['Date']) || new Date(), ici1: num(r['ICI 1']) || null, ici2: num(r['ICI 2']) || null, ici3: num(r['ICI 3']) || null, ici4: num(r['ICI 4']) || null, newcastle: num(r['Newcastle']) || null, hba: num(r['HBA']) || null, source: r['Source'] },
                create: { id: r['ID'], date: parseDate(r['Date']) || new Date(), ici1: num(r['ICI 1']) || null, ici2: num(r['ICI 2']) || null, ici3: num(r['ICI 3']) || null, ici4: num(r['ICI 4']) || null, newcastle: num(r['Newcastle']) || null, hba: num(r['HBA']) || null, source: r['Source'] }
            }).catch(() => { });
        }
    }

    // ─── 7. MEETINGS ─────────────────────────────────────
    console.log("Syncing Meetings...");
    const mtgRows = await fetchTab(sheets, sid, "Meetings");
    if (mtgRows.length > 1) {
        const h = mtgRows[0];
        for (let i = 1; i < mtgRows.length; i++) {
            const r = mapRow(h, mtgRows[i]);
            if (!r['ID']) continue;
            await prisma.meetingItem.upsert({
                where: { id: r['ID'] },
                update: { title: r['Title'] || "Untitled", date: parseDate(r['Date']), time: r['Time'], location: r['Location'], status: r['Status'] || "scheduled", attendees: r['Attendees'] ? JSON.stringify(r['Attendees'].split(',').map((a) => a.trim())) : null },
                create: { id: r['ID'], title: r['Title'] || "Untitled", date: parseDate(r['Date']), time: r['Time'], location: r['Location'], status: r['Status'] || "scheduled", attendees: r['Attendees'] ? JSON.stringify(r['Attendees'].split(',').map((a) => a.trim())) : null, createdBy: "system" }
            }).catch(() => { });
        }
    }

    // ─── 8. EXPENSES (PURCHASES) ─────────────────────────
    console.log("Syncing Expenses (Purchases)...");
    const expRows = await fetchTab(sheets, sid, "Expenses");
    if (expRows.length > 1) {
        const h = expRows[0];
        for (let i = 1; i < expRows.length; i++) {
            const r = mapRow(h, expRows[i]);
            if (!r['ID']) continue;
            await prisma.purchaseRequest.upsert({
                where: { requestNumber: r['Request #'] || `PR-${r['ID']}` },
                update: { category: r['Category'] || "Other", supplier: r['Supplier'], description: r['Description'], amount: num(r['Amount']), priority: r['Priority'] || "medium", status: r['Status'] || "pending" },
                create: { id: r['ID'], requestNumber: r['Request #'] || `PR-${r['ID']}`, category: r['Category'] || "Other", supplier: r['Supplier'], description: r['Description'], amount: num(r['Amount']), priority: r['Priority'] || "medium", status: r['Status'] || "pending", createdBy: "system", createdByName: r['Created By'] }
            }).catch(() => { });
        }
    }

    // ─── 9. P&L FORECASTS ────────────────────────────────
    console.log("Syncing P&L Forecast...");
    const plRows = await fetchTab(sheets, sid, "P&L Forecast");
    if (plRows.length > 1) {
        const h = plRows[0];
        for (let i = 1; i < plRows.length; i++) {
            const r = mapRow(h, plRows[i]);
            if (!r['ID']) continue;
            await prisma.pLForecast.upsert({
                where: { id: r['ID'] },
                update: { buyer: r['Project / Buyer'], quantity: num(r['Quantity']), sellingPrice: num(r['Selling Price']), buyingPrice: num(r['Buying Price']), freightCost: num(r['Freight Cost']), otherCost: num(r['Other Cost']), grossProfitMt: num(r['Gross Profit / MT']), totalGrossProfit: num(r['Total Gross Profit']) },
                create: { id: r['ID'], buyer: r['Project / Buyer'], quantity: num(r['Quantity']), sellingPrice: num(r['Selling Price']), buyingPrice: num(r['Buying Price']), freightCost: num(r['Freight Cost']), otherCost: num(r['Other Cost']), grossProfitMt: num(r['Gross Profit / MT']), totalGrossProfit: num(r['Total Gross Profit']) }
            }).catch(() => { });
        }
    }

    // ─── 10. PROJECTS / DEALS ────────────────────────────
    console.log("Syncing Projects (Deals)...");
    const sdRows = await fetchTab(sheets, sid, "Projects");
    if (sdRows.length > 1) {
        const h = sdRows[0];
        for (let i = 1; i < sdRows.length; i++) {
            const r = mapRow(h, sdRows[i]);
            if (!r['ID']) continue;
            await prisma.salesDeal.upsert({
                where: { dealNumber: `DEAL-${r['ID']}` },
                update: { status: r['Status'] || "pre_sale", buyer: r['Buyer'] || "Unknown", buyerCountry: r['Country'], type: r['Type'] || "export", quantity: num(r['Quantity (MT)']), pricePerMt: num(r['Price/MT']), totalValue: num(r['Total Value']), laycanStart: parseDate(r['Laycan Start']), laycanEnd: parseDate(r['Laycan End']), picName: r['PIC'] },
                create: { id: r['ID'], dealNumber: `DEAL-${r['ID']}`, status: r['Status'] || "pre_sale", buyer: r['Buyer'] || "Unknown", buyerCountry: r['Country'], type: r['Type'] || "export", quantity: num(r['Quantity (MT)']), pricePerMt: num(r['Price/MT']), totalValue: num(r['Total Value']), laycanStart: parseDate(r['Laycan Start']), laycanEnd: parseDate(r['Laycan End']), picName: r['PIC'], createdBy: "system" }
            }).catch(() => { });
        }
    }

    // ─── 11. PARTNERS ────────────────────────────────────
    console.log("Syncing Partners...");
    const ptnRows = await fetchTab(sheets, sid, "Partners");
    if (ptnRows.length > 1) {
        const h = ptnRows[0];
        for (let i = 1; i < ptnRows.length; i++) {
            const r = mapRow(h, ptnRows[i]);
            if (!r['ID']) continue;
            await prisma.partner.upsert({
                where: { id: r['ID'] },
                update: { name: r['Name'] || "Unknown", type: r['Type'] || "buyer", category: r['Category'], contactPerson: r['Contact Person'], phone: r['Phone'], email: r['Email'], address: r['Address'], city: r['City'], country: r['Country'], taxId: r['Tax ID'], status: r['Status'] || "active", notes: r['Notes'] },
                create: { id: r['ID'], name: r['Name'] || "Unknown", type: r['Type'] || "buyer", category: r['Category'], contactPerson: r['Contact Person'], phone: r['Phone'], email: r['Email'], address: r['Address'], city: r['City'], country: r['Country'], taxId: r['Tax ID'], status: r['Status'] || "active", notes: r['Notes'] }
            }).catch(() => { });
        }
    }

    console.log("-----------------------------------------");
    console.log("DONE: All 11 tabs synced to Memory B!");
    console.log("-----------------------------------------");
}

syncAll().catch(e => { console.error("Sync failed:", e); }).finally(() => { prisma.$disconnect(); });
