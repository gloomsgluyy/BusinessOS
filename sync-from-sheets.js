// @ts-nocheck
const { google } = require('googleapis');
const prisma = require('./src/lib/prisma').default || require('./src/lib/prisma');

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
        console.log("Memory B FULL Sync (Google Sheets -> Local DB)");
        console.log("=========================================");

        const sheets = await getSheets();
        const sid = process.env.GOOGLE_SHEETS_ID;
        if (!sid) throw new Error("GOOGLE_SHEETS_ID not set");

        const syncTabs = [
            { name: "Tasks", model: "taskItem", map: (r) => ({ title: r['Title'] || "Untitled", description: r['Description'], status: r['Status'] || "todo", priority: r['Priority'] || "medium", assigneeName: r['Assignee'], dueDate: parseDate(r['Due Date']) }), create: (r) => ({ createdBy: "system", assigneeId: "usr-001" }) },
            { name: "Sales", model: "salesDeal", key: "dealNumber", keyValue: (r) => r['Order #'] || r['ID'], map: (r) => ({ dealNumber: r['Order #'], buyer: r['Client'] || "Unknown", quantity: num(r['Amount']), status: r['Status'] || "pre_sale", picName: r['Created By'] }), create: (r) => ({ createdBy: "system" }) },
            { name: "Shipments", model: "shipmentDetail", key: "shipmentNumber", keyValue: (r) => r['Shipment #'] || r['ID'], map: (r) => ({ shipmentNumber: r['Shipment #'], status: normalizeShipmentStatus(r['Status']), buyer: r['Buyer'] || "Unknown", supplier: r['Supplier'], vesselName: r['Vessel Name'], bargeName: r['Barge Name'], loadingPort: r['Loading Port'], dischargePort: r['Discharge Port'], quantityLoaded: num(r['Qty Loaded (MT)']), blDate: parseDate(r['BL Date']), eta: parseDate(r['ETA']), salesPrice: num(r['Sales Price']), marginMt: num(r['Margin/MT']), picName: r['PIC'], type: r['Type'] || "export" }) },
            { name: "Sources", model: "sourceSupplier", map: (r) => ({ name: r['Name'] || "Unknown", region: r['Region'] || "Unknown", calorieRange: r['Calorie Range'], gar: num(r['GAR']), ts: num(r['TS']), ash: num(r['Ash']), tm: num(r['TM']), jettyPort: r['Jetty Port'], anchorage: r['Anchorage'], stockAvailable: num(r['Stock Available']), minStockAlert: num(r['Min Stock Alert']), kycStatus: r['KYC Status'] || "pending", psiStatus: r['PSI Status'] || "not_started", fobBargeOnly: r['FOB Barge Only'] === 'TRUE', priceLinkedIndex: r['Price Linked Index'], fobBargePriceUsd: num(r['FOB Barge Price (USD)']), contractType: r['Contract Type'], picName: r['PIC'], iupNumber: r['IUP Number'] }) },
            { name: "Quality", model: "qualityResult", map: (r) => ({ cargoName: r['Cargo Name'] || "Unknown", surveyor: r['Surveyor'], samplingDate: parseDate(r['Sampling Date']), gar: num(r['GAR']), ts: num(r['TS']), ash: num(r['Ash']), tm: num(r['TM']), status: r['Status'] || "pending" }), create: (r) => ({ cargoId: r['Cargo ID'] || r['ID'] }) },
            { name: "Market Price", model: "marketPrice", map: (r) => ({ date: parseDate(r['Date']) || new Date(), ici1: num(r['ICI 1']), ici2: num(r['ICI 2']), ici3: num(r['ICI 3']), ici4: num(r['ICI 4']), ici5: num(r['ICI 5']), newcastle: num(r['Newcastle']), hba: num(r['HBA']), source: r['Source'] }) },
            { name: "Meetings", model: "meetingItem", map: (r) => ({ title: r['Title'] || "Untitled", date: parseDate(r['Date']), time: r['Time'], location: r['Location'], status: r['Status'] || "scheduled", attendees: r['Attendees'] }), create: (r) => ({ createdBy: "system" }) },
            { name: "Expenses", model: "purchaseRequest", key: "requestNumber", keyValue: (r) => r['Request #'] || r['ID'], map: (r) => ({ requestNumber: r['Request #'], category: r['Category'] || "Other", supplier: r['Supplier'], description: r['Description'], amount: num(r['Amount']), priority: r['Priority'] || "medium", status: r['Status'] || "pending" }), create: (r) => ({ createdBy: "system", createdByName: r['Created By'] }) },
            { name: "P&L Forecast", model: "pLForecast", map: (r) => ({ dealNumber: r['ID'] ? r['ID'].split('-')[0] : undefined, buyer: r['Project / Buyer'], quantity: num(r['Quantity']), sellingPrice: num(r['Selling Price']), buyingPrice: num(r['Buying Price']), freightCost: num(r['Freight Cost']), otherCost: num(r['Other Cost']), grossProfitMt: num(r['Gross Profit / MT']), totalGrossProfit: num(r['Total Gross Profit']) }) },
            { name: "Projects", model: "salesDeal", key: "dealNumber", keyValue: (r) => r['ID'], map: (r) => ({ dealNumber: r['ID'] ? (r['ID'].startsWith('DEAL-') ? r['ID'] : `DEAL-${r['ID']}`) : undefined, status: r['Status'] || "confirmed", buyer: r['Buyer'] || "Unknown", buyerCountry: r['Country'], type: r['Type'] || "export", quantity: num(r['Quantity (MT)']), pricePerMt: num(r['Price/MT']), totalValue: num(r['Total Value']), laycanStart: parseDate(r['Laycan Start']), laycanEnd: parseDate(r['Laycan End']), picName: r['PIC'] }), create: (r) => ({ createdBy: "system" }) },
            { name: "Partners", model: "partner", map: (r) => ({ name: r['Name'] || "Unknown", type: r['Type'] || "buyer", category: r['Category'], contactPerson: r['Contact Person'], phone: r['Phone'], email: r['Email'], address: r['Address'], city: r['City'], country: r['Country'], taxId: r['Tax ID'], status: r['Status'] || "active", notes: r['Notes'] }) },
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
                    return; // Stop the whole sync cycle to wait for next interval
                }
                console.error(`  [!] Error pulling ${tab.name}:`, e.message);
                continue;
            }

            const headers = rows[0] || [];
            const remoteIds = new Set();
            if (rows.length > 1) {
                for (let i = 1; i < rows.length; i++) {
                    const r = mapRow(headers, rows[i]);
                    if (!r['ID']) continue;

                    const data = tab.map(r);
                    const extra = tab.create ? tab.create(r) : {};
                    const keyValue = tab.key ? tab.keyValue(r) : r['ID'];

                    // --- ID HEALING LOGIC ---
                    let targetId = r['ID'];
                    if (tab.key && keyValue) {
                        const existingByKey = await prisma[tab.model].findUnique({
                            where: { [tab.key]: keyValue }
                        }).catch(() => null);

                        if (existingByKey) {
                            targetId = existingByKey.id;
                        }
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
                    }).catch(e => console.error(`Failed upsert for ${tab.name} ID ${targetId}:`, e.message));

                    remoteIds.add(targetId);
                }
            }

            // --- DELETION RECONCILIATION ---
            // If a record exists in DB but NOT in the Google Sheet, mark it as isDeleted: true
            if (tab.model !== 'marketPrice' && tab.model !== 'syncState') { // Skip models that don't use soft delete or are singletons
                try {
                    const localRecords = await prisma[tab.model].findMany({
                        where: { isDeleted: false },
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

            // Wait 1 second between tabs to prevent hitting quota too fast
            await sleep(1000);
        }

        console.log("✅ Sync All complete.");
    }
}

module.exports = { PullService };
