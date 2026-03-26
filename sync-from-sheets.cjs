// @ts-nocheck
const { google } = require('googleapis');
const { PrismaClient } = require('@prisma/client');

// Dedicated Prisma instance for the sync worker
const prisma = new PrismaClient();

async function getSheets() {
    let credentials = process.env.GOOGLE_SHEETS_CREDENTIALS;
    if (!credentials) throw new Error("GOOGLE_SHEETS_CREDENTIALS not set in .env");

    credentials = credentials.trim();
    // Strip outer quotes
    if ((credentials.startsWith("'") && credentials.endsWith("'")) ||
        (credentials.startsWith('"') && credentials.endsWith('"'))) {
        credentials = credentials.substring(1, credentials.length - 1);
    }

    // Attempt to parse, and if it fails, try to fix common issues
    let credsJson;
    try {
        credsJson = JSON.parse(credentials);
    } catch (e) {
        // Fix literal newlines and carriage returns
        let sanitized = credentials.replace(/\r/g, '').replace(/\n/g, '\\n');
        // Fix illegal backslash escapes (e.g. \F, \X, etc)
        sanitized = sanitized.replace(/\\([^"\\\/bfnrtu])/g, '\\\\$1');
        credsJson = JSON.parse(sanitized);
    }

    const auth = new google.auth.GoogleAuth({
        credentials: credsJson,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    return google.sheets({ version: "v4", auth });
}

/**
 * Normalizes headers: Trims and converts to Uppercase to survive "id" vs "ID" vs "ID " issues.
 */
function mapRow(headers, row) {
    const obj = {};
    headers.forEach((h, i) => {
        if (!h) return;
        // Normalize: trim, uppercase, and replace multiple spaces with single space
        const normalizedKey = String(h).trim().toUpperCase().replace(/\s+/g, ' ');
        obj[normalizedKey] = row[i] || null;
    });
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

const VALID_SHIPMENT_STATUSES = ["draft", "confirmed", "waiting_loading", "loading", "in_transit", "anchorage", "discharging", "completed", "cancelled"];
function normalizeShipmentStatus(val) {
    const s = String(val || "draft").trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (s === "waiting_for_loading" || s === "waiting") return "waiting_loading";
    if (s === "intransit" || s === "transit") return "in_transit";
    if (s === "discharged" || s === "discharge") return "discharging";
    if (s === "complete" || s === "done") return "completed";
    if (s === "cancel" || s === "canceled") return "cancelled";
    if (VALID_SHIPMENT_STATUSES.includes(s)) return s;
    return "draft";
}

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

class PullService {
    static async syncAll() {
        console.log("=========================================");
        console.log(`[${new Date().toISOString()}] Memory B PULL: Sheets -> Local DB`);
        console.log("=========================================");

        const sheets = await getSheets();
        const sid = process.env.GOOGLE_SHEETS_ID;
        if (!sid) throw new Error("GOOGLE_SHEETS_ID not set");

        const syncTabs = [
            { name: "Tasks", model: "taskItem", map: (r) => ({ title: r['TITLE'] || "Untitled", description: r['DESCRIPTION'], status: r['STATUS'] || "todo", priority: r['PRIORITY'] || "medium", assigneeName: r['ASSIGNEE'], dueDate: parseDate(r['DUE DATE']) }), create: (r) => ({ createdBy: "system", assigneeId: "usr-001" }) },
            { name: "Sales", model: "salesDeal", key: "dealNumber", keyValue: (r) => r['ORDER #'] || r['ID'], map: (r) => ({ dealNumber: r['ORDER #'], buyer: r['CLIENT'] || "Unknown", quantity: num(r['AMOUNT']), status: r['STATUS'] || "pre_sale", picName: r['CREATED BY'] }), create: (r) => ({ createdBy: "system" }) },
            { name: "Shipments", model: "shipmentDetail", key: "shipmentNumber", keyValue: (r) => r['SHIPMENT #'] || r['ID'], map: (r) => ({ shipmentNumber: r['SHIPMENT #'], status: normalizeShipmentStatus(r['STATUS']), buyer: r['BUYER'] || "Unknown", supplier: r['SUPPLIER'], vesselName: r['VESSEL NAME'], bargeName: r['BARGE NAME'], loadingPort: r['LOADING PORT'], dischargePort: r['DISCHARGE PORT'], quantityLoaded: num(r['QTY LOADED (MT)']), blDate: parseDate(r['BL DATE']), eta: parseDate(r['ETA']), salesPrice: num(r['SALES PRICE']), marginMt: num(r['MARGIN/MT']), picName: r['PIC'], type: r['TYPE'] || "export" }) },
            { name: "Sources", model: "sourceSupplier", map: (r) => ({ name: r['NAME'] || "Unknown", region: r['REGION'] || "Unknown", calorieRange: r['CALORIE RANGE'], gar: num(r['GAR']), ts: num(r['TS']), ash: num(r['ASH']), tm: num(r['TM']), jettyPort: r['JETTY PORT'], anchorage: r['ANCHORAGE'], stockAvailable: num(r['STOCK AVAILABLE']), minStockAlert: num(r['MIN STOCK ALERT']), kycStatus: r['KYC STATUS'] || "pending", psiStatus: r['PSI STATUS'] || "not_started", fobBargeOnly: r['FOB BARGE ONLY'] === 'TRUE', priceLinkedIndex: r['PRICE LINKED INDEX'], fobBargePriceUsd: num(r['FOB BARGE PRICE (USD)']), contractType: r['CONTRACT TYPE'], picName: r['PIC'], iupNumber: r['IUP NUMBER'] }) },
            { name: "Quality", model: "qualityResult", map: (r) => ({ cargoName: r['CARGO NAME'] || "Unknown", surveyor: r['SURVEYOR'], samplingDate: parseDate(r['SAMPLING DATE']), gar: num(r['GAR']), ts: num(r['TS']), ash: num(r['ASH']), tm: num(r['TM']), status: r['STATUS'] || "pending" }), create: (r) => ({ cargoId: r['CARGO ID'] || r['ID'] }) },
            { name: "Market Price", model: "marketPrice", map: (r) => ({ date: parseDate(r['DATE']) || new Date(), ici1: num(r['ICI 1']), ici2: num(r['ICI 2']), ici3: num(r['ICI 3']), ici4: num(r['ICI 4']), ici5: num(r['ICI 5']), newcastle: num(r['NEWCASTLE']), hba: num(r['HBA']), source: r['SOURCE'] }) },
            { name: "Meetings", model: "meetingItem", map: (r) => ({ title: r['TITLE'] || "Untitled", date: parseDate(r['DATE']), time: r['TIME'], location: r['LOCATION'], status: r['STATUS'] || "scheduled", attendees: r['ATTENDEES'] }), create: (r) => ({ createdBy: "system" }) },
            { name: "Expenses", model: "purchaseRequest", key: "requestNumber", keyValue: (r) => r['REQUEST #'] || r['ID'], map: (r) => ({ requestNumber: r['REQUEST #'], category: r['CATEGORY'] || "Other", supplier: r['SUPPLIER'], description: r['DESCRIPTION'], amount: num(r['AMOUNT']), priority: r['PRIORITY'] || "medium", status: r['STATUS'] || "pending" }), create: (r) => ({ createdBy: "system", createdByName: r['CREATED BY'] }) },
            { name: "P&L Forecast", model: "pLForecast", map: (r) => ({ 
                buyer: r['PROJECT / BUYER'] || r['BUYER'] || 'Unknown', 
                quantity: num(r['QUANTITY']), 
                sellingPrice: num(r['SELLING PRICE']), 
                buyingPrice: num(r['BUYING PRICE']), 
                freightCost: num(r['FREIGHT COST']), 
                otherCost: num(r['OTHER COST']), 
                grossProfitMt: num(r['GROSS PROFIT / MT']), 
                totalGrossProfit: num(r['TOTAL GROSS PROFIT']) 
            }) },
            { name: "Projects", model: "salesDeal", key: "dealNumber", keyValue: (r) => r['ID'], map: (r) => ({ dealNumber: r['ID'] ? (r['ID'].startsWith('DEAL-') ? r['ID'] : `DEAL-${r['ID']}`) : undefined, status: r['STATUS'] || "confirmed", buyer: r['BUYER'] || "Unknown", buyerCountry: r['COUNTRY'], type: r['TYPE'] || "export", quantity: num(r['QUANTITY (MT)']), pricePerMt: num(r['PRICE/MT']), totalValue: num(r['TOTAL VALUE']), laycanStart: parseDate(r['LAYCAN START']), laycanEnd: parseDate(r['LAYCAN END']), picName: r['PIC'] }), create: (r) => ({ createdBy: "system" }) },
            { name: "Partners", model: "partner", map: (r) => ({ name: r['NAME'] || "Unknown", type: r['TYPE'] || "buyer", category: r['CATEGORY'], contactPerson: r['CONTACT PERSON'], phone: r['PHONE'], email: r['EMAIL'], address: r['ADDRESS'], city: r['CITY'], country: r['COUNTRY'], taxId: r['TAX ID'], status: r['STATUS'] || "active", notes: r['NOTES'] }) },
        ];

        for (const tab of syncTabs) {
            console.log(`Syncing ${tab.name}...`);
            let rows = [];
            try {
                const res = await sheets.spreadsheets.values.get({ spreadsheetId: sid, range: `${tab.name}!A1:Z1000` });
                rows = res.data.values || [];
            } catch (e) {
                if (e.message.includes("Quota exceeded")) {
                    console.warn(`  [!] Quota hit on ${tab.name}. Stopping current sync cycle.`);
                    return;
                }
                console.error(`  [!] Error pulling ${tab.name}:`, e.message);
                continue;
            }

            const headers = rows[0] || [];
            const dataRows = rows.slice(1).filter(r => r && r.length > 0);
            const remoteIds = new Set();

            // ✅ CRITICAL SAFETY: Only process data AND run deletion reconciliation
            // if the Sheet tab has at least 1 data row.
            // This prevents wiping the local DB when a Sheet is empty (e.g. due to a failed push cycle).
            if (dataRows.length > 0) {
                for (const rawRow of dataRows) {
                    const r = mapRow(headers, rawRow);
                    const rowId = r['ID'];
                    if (!rowId) continue;

                    const data = tab.map(r);
                    const extra = tab.create ? tab.create(r) : {};
                    const keyValue = tab.key ? tab.keyValue(r) : rowId;

                    // --- ID HEALING LOGIC ---
                    let targetId = rowId;
                    if (tab.key && keyValue) {
                        try {
                            const existingByKey = await prisma[tab.model].findUnique({
                                where: { [tab.key]: keyValue }
                            });
                            if (existingByKey) targetId = existingByKey.id;
                        } catch (err) { /* ignore find errors */ }
                    }

                    if (tab.key && !data[tab.key]) {
                        data[tab.key] = keyValue;
                    }

                    const createData = { id: targetId, ...data, ...extra };
                    if (tab.key) createData[tab.key] = keyValue;

                    await prisma[tab.model].upsert({
                        where: { id: targetId },
                        update: data,
                        create: createData
                    }).catch(e => console.error(`  [!] Failed upsert for ${tab.name} ID ${targetId}:`, e.message));

                    remoteIds.add(targetId);
                }

                // --- DELETION RECONCILIATION ---
                if (tab.model !== 'marketPrice' && tab.model !== 'syncState') {
                    try {
                        const localRecords = await prisma[tab.model].findMany({
                            where: {
                                isDeleted: false,
                                // Safety buffer: Don't delete records created in the last 5 minutes
                                createdAt: { lt: new Date(Date.now() - 5 * 60 * 1000) }
                            },
                            select: { id: true }
                        });

                        for (const local of localRecords) {
                            if (!remoteIds.has(local.id)) {
                                console.log(`  [-] Removing ${tab.name} ID ${local.id} (not found in Sheets)`);
                                await prisma[tab.model].update({
                                    where: { id: local.id },
                                    data: { isDeleted: true }
                                });
                            }
                        }
                    } catch (e) {
                        console.error(`  [!] Deletion sync failed for ${tab.name}:`, e.message);
                    }
                }
            } else {
                // Sheet is empty — skip deletion to protect local data
                console.log(`  [SKIP] ${tab.name} sheet has no data rows. Skipping deletion reconciliation to protect local DB.`);
            }

            await sleep(1000); // Prevent quota hit
        }

        console.log("✅ Sync All complete.");
    }
}

module.exports = { PullService };
