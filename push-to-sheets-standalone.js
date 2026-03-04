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
    try {
        return JSON.parse(credentials);
    } catch (e) {
        let sanitized = credentials.replace(/\r/g, '').replace(/\n/g, '\\n');
        sanitized = sanitized.replace(/\\([^"\\\/bfnrtu])/g, '\\\\$1');
        return JSON.parse(sanitized);
    }
}

// Fix: convert literal \n to real newlines in private_key (needed by Google Auth / OpenSSL)
function fixPrivateKey(creds) {
    if (creds && creds.private_key) {
        creds.private_key = creds.private_key.replace(/\\n/g, '\n');
    }
    return creds;
}

async function getSheets() {
    const auth = new google.auth.GoogleAuth({
        credentials: fixPrivateKey(parseCredentials()),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    return google.sheets({ version: "v4", auth });
}

// ── Push all models to Sheets ──────────────────────────────────
async function pushAllToSheets() {
    const sheets = await getSheets();
    const sid = process.env.GOOGLE_SHEETS_ID;
    if (!sid) throw new Error("GOOGLE_SHEETS_ID not set");

    console.log("🚀 Starting full push to Google Sheets...\n");

    // 1. Sales Deals
    try {
        const deals = await prisma.salesDeal.findMany({ where: { isDeleted: false } });
        console.log(`📊 Sales Deals: ${deals.length} records`);
        if (deals.length > 0) {
            const rows = deals.map(d => [d.id, d.dealNumber, d.createdAt.toISOString(), d.buyer, d.vesselName || "-", d.quantity, "high", d.status, d.picName || "System", "", d.updatedAt.toISOString()]);
            await sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "Sales!A2:K1000" });
            await sheets.spreadsheets.values.update({ spreadsheetId: sid, range: "Sales!A2", valueInputOption: "USER_ENTERED", requestBody: { values: rows } });
            console.log("  ✅ Sales pushed");
            await sleep(1000);

            // Also update Projects tab
            const projectRows = deals.map(d => [d.id, d.buyer, d.buyerCountry, d.type, d.quantity, d.pricePerMt, d.totalValue, d.status, d.vesselName, d.laycanStart ? d.laycanStart.toISOString() : "", d.laycanEnd ? d.laycanEnd.toISOString() : "", d.picName, d.updatedAt.toISOString()]);
            await sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "Projects!A2:M1000" });
            await sheets.spreadsheets.values.update({ spreadsheetId: sid, range: "Projects!A2", valueInputOption: "USER_ENTERED", requestBody: { values: projectRows } });
            console.log("  ✅ Projects pushed");
        }
    } catch (e) { console.error("  ❌ Sales error:", e.message); }
    await sleep(1500);

    // 2. Shipments
    try {
        const shipments = await prisma.shipmentDetail.findMany({ where: { isDeleted: false } });
        console.log(`🚢 Shipments: ${shipments.length} records`);
        if (shipments.length > 0) {
            const rows = shipments.map(s => [s.id, s.shipmentNumber, s.createdAt.toISOString(), s.buyer, s.supplier || "-", s.vesselName || "-", s.bargeName || "-", s.loadingPort || "-", s.dischargePort || "-", s.quantityLoaded || 0, s.blDate ? s.blDate.toISOString() : "", s.eta ? s.eta.toISOString() : "", s.salesPrice || 0, s.marginMt || 0, s.status, s.picName || "System", s.type || "export", s.updatedAt.toISOString()]);
            await sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "Shipments!A2:R1000" });
            await sheets.spreadsheets.values.update({ spreadsheetId: sid, range: "Shipments!A2", valueInputOption: "USER_ENTERED", requestBody: { values: rows } });
            console.log("  ✅ Shipments pushed");
        }
    } catch (e) { console.error("  ❌ Shipments error:", e.message); }
    await sleep(1500);

    // 3. Meetings
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
    await sleep(1500);

    // 4. Sources
    try {
        const sources = await prisma.sourceSupplier.findMany({ where: { isDeleted: false } });
        console.log(`⛏️ Sources: ${sources.length} records`);
        if (sources.length > 0) {
            const rows = sources.map(s => [s.id, s.name, s.region, s.calorieRange, s.gar, s.ts, s.ash, s.tm, s.jettyPort, s.fobBargePriceUsd, s.stockAvailable, s.kycStatus, s.psiStatus, s.contractType, s.picName, s.iupNumber, s.updatedAt.toISOString()]);
            await sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "Sources!A2:Q1000" });
            await sheets.spreadsheets.values.update({ spreadsheetId: sid, range: "Sources!A2", valueInputOption: "USER_ENTERED", requestBody: { values: rows } });
            console.log("  ✅ Sources pushed");
        }
    } catch (e) { console.error("  ❌ Sources error:", e.message); }
    await sleep(1500);

    // 5. Quality
    try {
        const quality = await prisma.qualityResult.findMany({ where: { isDeleted: false } });
        console.log(`🔬 Quality: ${quality.length} records`);
        if (quality.length > 0) {
            const rows = quality.map(q => [q.id, q.cargoId, q.cargoName, q.surveyor, q.samplingDate ? q.samplingDate.toISOString() : "", q.gar, q.ts, q.ash, q.tm, q.status, q.createdAt.toISOString()]);
            await sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "Quality!A2:K1000" });
            await sheets.spreadsheets.values.update({ spreadsheetId: sid, range: "Quality!A2", valueInputOption: "USER_ENTERED", requestBody: { values: rows } });
            console.log("  ✅ Quality pushed");
        }
    } catch (e) { console.error("  ❌ Quality error:", e.message); }
    await sleep(1500);

    // 6. Market Prices
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
    await sleep(1500);

    // 7. Partners
    try {
        const partners = await prisma.partner.findMany({ where: { isDeleted: false } });
        console.log(`🤝 Partners: ${partners.length} records`);
        if (partners.length > 0) {
            const rows = partners.map(p => [p.id, p.name, p.type, p.category, p.contactPerson, p.phone, p.email, p.address, p.city, p.country, p.status, p.updatedAt.toISOString()]);
            await sheets.spreadsheets.values.clear({ spreadsheetId: sid, range: "Partners!A2:L1000" });
            await sheets.spreadsheets.values.update({ spreadsheetId: sid, range: "Partners!A2", valueInputOption: "USER_ENTERED", requestBody: { values: rows } });
            console.log("  ✅ Partners pushed");
        }
    } catch (e) { console.error("  ❌ Partners error:", e.message); }
    await sleep(1500);

    // 8. Purchase Requests
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

    console.log("\n✅ Push complete!");
}

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

pushAllToSheets()
    .catch(e => { console.error("❌ Fatal error:", e); process.exit(1); })
    .finally(() => prisma.$disconnect());
