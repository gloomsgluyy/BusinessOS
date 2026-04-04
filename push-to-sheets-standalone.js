require("dotenv").config();
const { google } = require('googleapis');
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// ── Helper: Parse credentials robustly ────────────────────────
function parseCredentials() {
    let credentials = process.env.GOOGLE_SHEETS_CREDENTIALS;
    if (!credentials) throw new Error("GOOGLE_SHEETS_CREDENTIALS not set in .env");
    credentials = credentials.trim();
    if ((credentials.startsWith("'") && credentials.endsWith("'")) ||
        (credentials.startsWith('"') && credentials.endsWith('"'))) {
        credentials = credentials.substring(1, credentials.length - 1);
    }
    let creds;
    try {
        creds = JSON.parse(credentials);
    } catch (e) {
        let s = credentials.replace(/\r/g, '').replace(/\n/g, '\\n').replace(/\\F/g, '\\n');
        s = s.replace(/\\([^"\\\/bfnrtu])/g, '\\\\$1');
        creds = JSON.parse(s);
    }
    // Fix private_key: ensure real newlines for OpenSSL
    if (creds && creds.private_key) {
        creds.private_key = creds.private_key.replace(/\\n/g, '\n');
    }
    return creds;
}

async function getSheets() {
    const auth = new google.auth.GoogleAuth({
        credentials: parseCredentials(),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    return google.sheets({ version: "v4", auth });
}

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

async function pushAllToSheets() {
    const sheets = await getSheets();
    const sid = process.env.GOOGLE_SHEETS_ID;
    if (!sid) throw new Error("GOOGLE_SHEETS_ID not set");
    console.log("🚀 Starting full push to Google Sheets...\n");

    // 1. Market Prices
    try {
        const prices = await prisma.marketPrice.findMany({ where: { isDeleted: false }, orderBy: { date: 'desc' } });
        console.log(`💹 Market Prices: ${prices.length} records`);
        if (prices.length > 0) {
            const rows = prices.map(p => [p.id, p.date.toISOString(), p.ici1, p.ici2, p.ici3, p.ici4, p.ici5, p.newcastle, p.hba, p.source, p.updatedAt.toISOString()]);
            await sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "Market Price!A2:K1000" });
            await sheets.spreadsheets.values.update({ spreadsheetId: sid, range: "Market Price!A2", valueInputOption: "USER_ENTERED", requestBody: { values: rows } });
            console.log("  ✅ Market Prices pushed");
        }
    } catch (e) { console.error("  ❌ Market Prices error:", e.message); }
    await sleep(1200);

    // 2. Tasks
    try {
        const tasks = await prisma.taskItem.findMany({ where: { isDeleted: false } });
        console.log(`✅ Tasks: ${tasks.length} records`);
        if (tasks.length > 0) {
            const rows = tasks.map(t => [t.id, t.title, t.description, t.status, t.priority, t.assigneeName, t.dueDate ? t.dueDate.toISOString() : "", "", t.updatedAt.toISOString()]);
            await sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "Tasks!A2:I1000" });
            await sheets.spreadsheets.values.update({ spreadsheetId: sid, range: "Tasks!A2", valueInputOption: "USER_ENTERED", requestBody: { values: rows } });
            console.log("  ✅ Tasks pushed");
        }
    } catch (e) { console.error("  ❌ Tasks error:", e.message); }
    await sleep(1200);

    // 3. Shipments — EXACT column order matching push-to-sheets.ts
    // Columns: ID | SHIPMENT # | DEAL ID | STATUS | BUYER | SUPPLIER | IS BLENDING | IUP OP | VESSEL NAME | BARGE NAME | LOADING PORT | DISCHARGE PORT | QTY LOADED (MT) | BL DATE | ETA | SALES PRICE | MARGIN/MT | PIC | TYPE | MILESTONES | CREATED AT | UPDATED AT
    try {
        const shipments = await prisma.shipmentDetail.findMany({ where: { isDeleted: false } });
        console.log(`🚢 Shipments: ${shipments.length} records`);
        if (shipments.length > 0) {
            const rows = shipments.map(s => [
                s.id, s.shipmentNumber, s.dealId, s.status, s.buyer, s.supplier, s.isBlending ? "Yes" : "No", s.iupOp,
                s.vesselName, s.bargeName, s.loadingPort, s.dischargePort, s.quantityLoaded,
                s.blDate ? s.blDate.toISOString() : "", s.eta ? s.eta.toISOString() : "",
                s.salesPrice, s.marginMt, s.picName, s.type, s.milestones,
                s.createdAt.toISOString(), s.updatedAt.toISOString()
            ]);
            await sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "Shipments!A2:V1000" });
            await sheets.spreadsheets.values.update({ spreadsheetId: sid, range: "Shipments!A2", valueInputOption: "USER_ENTERED", requestBody: { values: rows } });
            console.log("  ✅ Shipments pushed");
        }
    } catch (e) { console.error("  ❌ Shipments error:", e.message); }
    await sleep(1200);

    // 4. Sales Orders (Sales Tab)
    try {
        const sales = await prisma.salesOrder.findMany({ where: { isDeleted: false } });
        console.log(`🛒 Sales Orders: ${sales.length} records`);
        if (sales.length > 0) {
            const rows = sales.map(s => [s.id, s.orderNumber, s.createdAt.toISOString(), s.client, s.description, s.amount, s.priority, s.status, s.createdByName, s.imageUrl, s.updatedAt.toISOString()]);
            await sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "Sales!A2:K1000" });
            await sheets.spreadsheets.values.update({ spreadsheetId: sid, range: "Sales!A2", valueInputOption: "USER_ENTERED", requestBody: { values: rows } });
            console.log("  ✅ Sales Orders pushed");
        }
    } catch (e) { console.error("  ❌ Sales Orders error:", e.message); }
    await sleep(1200);

    // 5. Sources
    try {
        const sources = await prisma.sourceSupplier.findMany({ where: { isDeleted: false } });
        console.log(`⛏️ Sources: ${sources.length} records`);
        if (sources.length > 0) {
            const rows = sources.map(s => [
                s.id, s.name, s.region, s.calorieRange, s.gar, s.ts, s.ash, s.tm, s.jettyPort, s.anchorage,
                s.stockAvailable, s.minStockAlert, s.kycStatus, s.psiStatus, s.fobBargeOnly ? "TRUE" : "FALSE",
                s.priceLinkedIndex, s.fobBargePriceUsd, s.contractType, s.picName, s.iupNumber, s.updatedAt.toISOString()
            ]);
            await sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "Sources!A2:U1000" });
            await sheets.spreadsheets.values.update({ spreadsheetId: sid, range: "Sources!A2", valueInputOption: "USER_ENTERED", requestBody: { values: rows } });
            console.log("  ✅ Sources pushed");
        }
    } catch (e) { console.error("  ❌ Sources error:", e.message); }
    await sleep(1200);

    // 6. Quality
    try {
        const quality = await prisma.qualityResult.findMany({ where: { isDeleted: false } });
        console.log(`🔬 Quality: ${quality.length} records`);
        if (quality.length > 0) {
            const rows = quality.map(q => [q.id, q.cargoId, q.cargoName, q.surveyor, q.samplingDate ? q.samplingDate.toISOString() : "", q.gar, q.ts, q.ash, q.tm, q.status, q.updatedAt.toISOString()]);
            await sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "Quality!A2:K1000" });
            await sheets.spreadsheets.values.update({ spreadsheetId: sid, range: "Quality!A2", valueInputOption: "USER_ENTERED", requestBody: { values: rows } });
            console.log("  ✅ Quality pushed");
        }
    } catch (e) { console.error("  ❌ Quality error:", e.message); }
    await sleep(1200);

    // 7. Meetings
    try {
        const meetings = await prisma.meetingItem.findMany({ where: { isDeleted: false } });
        console.log(`📅 Meetings: ${meetings.length} records`);
        if (meetings.length > 0) {
            const rows = meetings.map(m => [m.id, m.title, m.date ? m.date.toISOString() : "", m.time, m.location, m.status, m.attendees, m.createdByName, m.updatedAt.toISOString()]);
            await sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "Meetings!A2:I1000" });
            await sheets.spreadsheets.values.update({ spreadsheetId: sid, range: "Meetings!A2", valueInputOption: "USER_ENTERED", requestBody: { values: rows } });
            console.log("  ✅ Meetings pushed");
        }
    } catch (e) { console.error("  ❌ Meetings error:", e.message); }
    await sleep(1200);

    // 8. Purchase Requests (Expenses Tab)
    try {
        const purchases = await prisma.purchaseRequest.findMany({ where: { isDeleted: false } });
        console.log(`💰 Purchase Requests: ${purchases.length} records`);
        if (purchases.length > 0) {
            const rows = purchases.map(p => [p.id, p.requestNumber, p.createdAt.toISOString(), p.category, p.supplier, p.description, p.amount, p.priority, p.status, p.createdByName, p.imageUrl, p.updatedAt.toISOString()]);
            await sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "Expenses!A2:L1000" });
            await sheets.spreadsheets.values.update({ spreadsheetId: sid, range: "Expenses!A2", valueInputOption: "USER_ENTERED", requestBody: { values: rows } });
            console.log("  ✅ Purchase Requests pushed");
        }
    } catch (e) { console.error("  ❌ Purchase Requests error:", e.message); }
    await sleep(1200);

    // 9. P&L Forecast
    try {
        const forecasts = await prisma.pLForecast.findMany({ where: { isDeleted: false } });
        console.log(`📈 P&L Forecasts: ${forecasts.length} records`);
        if (forecasts.length > 0) {
            const rows = forecasts.map(p => [p.id, p.buyer, p.quantity, p.sellingPrice, p.buyingPrice, p.freightCost, p.otherCost, p.grossProfitMt, p.totalGrossProfit, p.updatedAt.toISOString()]);
            await sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "P&L Forecast!A2:J1000" });
            await sheets.spreadsheets.values.update({ spreadsheetId: sid, range: "P&L Forecast!A2", valueInputOption: "USER_ENTERED", requestBody: { values: rows } });
            console.log("  ✅ P&L Forecasts pushed");
        }
    } catch (e) { console.error("  ❌ P&L Forecasts error:", e.message); }
    await sleep(1200);

    // 10. Sales Deals → Projects Tab
    try {
        const deals = await prisma.salesDeal.findMany({ where: { isDeleted: false } });
        console.log(`📊 Sales Deals (Projects): ${deals.length} records`);
        if (deals.length > 0) {
            const rows = deals.map(d => [d.id, d.buyer, d.buyerCountry, d.type, d.quantity, d.pricePerMt, d.totalValue, d.status, d.vesselName, d.laycanStart ? d.laycanStart.toISOString() : "", d.laycanEnd ? d.laycanEnd.toISOString() : "", d.picName, d.updatedAt.toISOString()]);
            await sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "Projects!A2:M1000" });
            await sheets.spreadsheets.values.update({ spreadsheetId: sid, range: "Projects!A2", valueInputOption: "USER_ENTERED", requestBody: { values: rows } });
            console.log("  ✅ Projects (Sales Deals) pushed");
        }
    } catch (e) { console.error("  ❌ Projects error:", e.message); }

    console.log("\n✅ Push complete!");
}

pushAllToSheets()
    .catch(e => { console.error("❌ Fatal error:", e.message); process.exit(1); })
    .finally(() => prisma.$disconnect());
