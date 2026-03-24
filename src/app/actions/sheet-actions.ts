"use server";

import { google } from "googleapis";
import { Task, TaskStatus, TaskPriority } from "@/types";

// Sheet Names
const SHEET_TASKS = "Tasks";
const SHEET_SALES = "Sales";
const SHEET_EXPENSES = "Expenses";
const SHEET_SHIPMENTS = "Shipments";
const SHEET_SOURCES = "Sources";
const SHEET_QUALITY = "Quality";
const SHEET_MARKET_PRICE = "Market Price";
const SHEET_MEETINGS = "Meetings";
const SHEET_PL_FORECAST = "P&L Forecast";
const SHEET_PROJECTS = "Projects";
const SHEET_PARTNERS = "Partners";
const SHEET_BLENDING = "Blending";

// Headers — EVERY header ends with "Updated At" so sync can track timestamps
const TASK_HEADERS = ["ID", "Title", "Description", "Status", "Priority", "Assignee", "Due Date", "Image Preview", "Updated At"];
const SALES_HEADERS = ["ID", "Order #", "Date", "Client", "Description", "Amount", "Priority", "Status", "Created By", "Image Preview", "Updated At"];
const EXPENSE_HEADERS = ["ID", "Request #", "Date", "Category", "Supplier", "Description", "Amount", "Priority", "Status", "Created By", "Image Preview", "Updated At"];

const SHIPMENT_HEADERS = ["ID", "Shipment #", "Deal ID", "Status", "Buyer", "Supplier", "Is Blending", "IUP OP", "Vessel Name", "Barge Name", "Loading Port", "Discharge Port", "Qty Loaded (MT)", "BL Date", "ETA", "Sales Price", "Margin/MT", "PIC", "Type", "Milestones", "Created At", "Updated At"];
const SOURCE_HEADERS = ["ID", "Name", "Region", "Calorie Range", "GAR", "TS", "Ash", "TM", "Jetty Port", "Anchorage", "Stock Available", "Min Stock Alert", "KYC Status", "PSI Status", "FOB Barge Only", "Price Linked Index", "FOB Barge Price (USD)", "Contract Type", "PIC", "IUP Number", "Updated At"];
const QUALITY_HEADERS = ["ID", "Cargo ID", "Cargo Name", "Surveyor", "Sampling Date", "GAR", "TS", "Ash", "TM", "Status", "Updated At"];
const MARKET_PRICE_HEADERS = ["ID", "Date", "ICI 1", "ICI 2", "ICI 3", "ICI 4", "ICI 5", "Newcastle", "HBA", "Source", "Updated At"];
const MEETING_HEADERS = ["ID", "Title", "Date", "Time", "Location", "Status", "Attendees", "Created By", "Updated At"];
const PL_FORECAST_HEADERS = ["ID", "Project / Buyer", "Quantity", "Selling Price", "Buying Price", "Freight Cost", "Other Cost", "Gross Profit / MT", "Total Gross Profit", "Updated At"];
const PROJECT_HEADERS = ["ID", "Buyer", "Country", "Type", "Quantity (MT)", "Price/MT", "Total Value", "Status", "Vessel", "Laycan Start", "Laycan End", "PIC", "Updated At"];
const PARTNERS_HEADERS = ["ID", "Name", "Type", "Category", "Contact Person", "Phone", "Email", "Address", "City", "Country", "Tax ID", "Status", "Notes", "Updated At"];
const BLENDING_HEADERS = ["ID", "Inputs", "Total Qty", "Result GAR", "Result TS", "Result Ash", "Result TM", "Created By", "Created At"];

// Helper to get Auth
function getAuth() {
    const credentials = process.env.GOOGLE_SHEETS_CREDENTIALS;
    if (!credentials) throw new Error("GOOGLE_SHEETS_CREDENTIALS not set");
    return new google.auth.GoogleAuth({
        credentials: JSON.parse(credentials),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
}

/**
 * Universal Sheet Setup & Formatting
 */
async function setupSheet(sheetName: string, headers: string[]) {
    try {
        const auth = getAuth();
        const sheets = google.sheets({ version: "v4", auth });
        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

        // 1. Check if sheet exists or create it
        const meta = await sheets.spreadsheets.get({ spreadsheetId });
        let sheetId = meta.data.sheets?.find(s => s.properties?.title === sheetName)?.properties?.sheetId;

        if (sheetId === undefined) {
            const res = await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: { requests: [{ addSheet: { properties: { title: sheetName } } }] }
            });
            sheetId = res.data.replies?.[0]?.addSheet?.properties?.sheetId;
        }

        if (sheetId === undefined) throw new Error(`Could not find or create sheet ${sheetName}`);

        // 2. Write Headers
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${sheetName}!A1`,
            valueInputOption: "USER_ENTERED",
            requestBody: { values: [headers] }
        });

        // 3. Format Headers and Columns (Universal Style)
        const requests: any[] = [
            // Header Style
            {
                repeatCell: {
                    range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
                    cell: {
                        userEnteredFormat: {
                            backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 },
                            textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true },
                            horizontalAlignment: "CENTER"
                        }
                    },
                    fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)"
                }
            },
            // Resize all to 150
            { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: headers.length }, properties: { pixelSize: 150 }, fields: "pixelSize" } },
        ];

        // Specific Column Widths
        if (sheetName === SHEET_TASKS) {
            requests.push({ updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 1, endIndex: 3 }, properties: { pixelSize: 300 }, fields: "pixelSize" } }); // Title, Desc
            // Status Dropdown (Col D = Index 3)
            requests.push({
                setDataValidation: {
                    range: { sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 3, endColumnIndex: 4 },
                    rule: { condition: { type: "ONE_OF_LIST", values: [{ userEnteredValue: "todo" }, { userEnteredValue: "in_progress" }, { userEnteredValue: "review" }, { userEnteredValue: "done" }] }, showCustomUi: true }
                }
            });
        } else if (sheetName === SHEET_SALES) {
            requests.push({ updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 4, endIndex: 5 }, properties: { pixelSize: 250 }, fields: "pixelSize" } }); // Desc
            // Status Dropdown (Col H = Index 7)
            requests.push({
                setDataValidation: {
                    range: { sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 7, endColumnIndex: 8 },
                    rule: { condition: { type: "ONE_OF_LIST", values: [{ userEnteredValue: "draft" }, { userEnteredValue: "pending" }, { userEnteredValue: "approved" }, { userEnteredValue: "rejected" }] }, showCustomUi: true }
                }
            });
        } else if (sheetName === SHEET_EXPENSES) {
            requests.push({ updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 5, endIndex: 6 }, properties: { pixelSize: 250 }, fields: "pixelSize" } }); // Desc
            // Status Dropdown (Col I = Index 8)
            requests.push({
                setDataValidation: {
                    range: { sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 8, endColumnIndex: 9 },
                    rule: { condition: { type: "ONE_OF_LIST", values: [{ userEnteredValue: "draft" }, { userEnteredValue: "pending" }, { userEnteredValue: "approved" }, { userEnteredValue: "rejected" }] }, showCustomUi: true }
                }
            });
        } else if (sheetName === SHEET_SHIPMENTS) {
            // Status Dropdown (Col D = Index 3)
            requests.push({
                setDataValidation: {
                    range: { sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 3, endColumnIndex: 4 },
                    rule: { condition: { type: "ONE_OF_LIST", values: [{ userEnteredValue: "draft" }, { userEnteredValue: "confirmed" }, { userEnteredValue: "waiting_loading" }, { userEnteredValue: "loading" }, { userEnteredValue: "in_transit" }, { userEnteredValue: "discharging" }, { userEnteredValue: "completed" }] }, showCustomUi: true }
                }
            });
        } else if (sheetName === SHEET_SOURCES) {
            // KYC Status Dropdown (Col M = Index 12)
            requests.push({
                setDataValidation: {
                    range: { sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 12, endColumnIndex: 13 },
                    rule: { condition: { type: "ONE_OF_LIST", values: [{ userEnteredValue: "not_started" }, { userEnteredValue: "in_progress" }, { userEnteredValue: "verified" }, { userEnteredValue: "rejected" }] }, showCustomUi: true }
                }
            });
            // PSI Status Dropdown (Col N = Index 13)
            requests.push({
                setDataValidation: {
                    range: { sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 13, endColumnIndex: 14 },
                    rule: { condition: { type: "ONE_OF_LIST", values: [{ userEnteredValue: "not_started" }, { userEnteredValue: "scheduled" }, { userEnteredValue: "passed" }, { userEnteredValue: "failed" }] }, showCustomUi: true }
                }
            });
        } else if (sheetName === SHEET_QUALITY) {
            // Status Dropdown (Col J = Index 9)
            requests.push({
                setDataValidation: {
                    range: { sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 9, endColumnIndex: 10 },
                    rule: { condition: { type: "ONE_OF_LIST", values: [{ userEnteredValue: "pending" }, { userEnteredValue: "passed" }, { userEnteredValue: "failed" }] }, showCustomUi: true }
                }
            });
        } else if (sheetName === SHEET_MEETINGS) {
            // Status Dropdown (Col F = Index 5)
            requests.push({
                setDataValidation: {
                    range: { sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 5, endColumnIndex: 6 },
                    rule: { condition: { type: "ONE_OF_LIST", values: [{ userEnteredValue: "scheduled" }, { userEnteredValue: "completed" }, { userEnteredValue: "cancelled" }] }, showCustomUi: true }
                }
            });
        }

        // Conditional Formatting for Status (Shared Logic)
        const statusColIndex = sheetName === SHEET_TASKS ? 3 : (sheetName === SHEET_SALES ? 7 : 8);
        const statusRules = [
            { val: "done", color: { red: 0.8, green: 1, blue: 0.8 } },
            { val: "approved", color: { red: 0.8, green: 1, blue: 0.8 } },
            { val: "in_progress", color: { red: 0.8, green: 0.9, blue: 1 } },
            { val: "pending", color: { red: 1, green: 0.9, blue: 0.7 } },
            { val: "todo", color: { red: 0.9, green: 0.9, blue: 0.9 } },
            { val: "rejected", color: { red: 1, green: 0.8, blue: 0.8 } },
        ];

        statusRules.forEach(rule => {
            requests.push({
                addConditionalFormatRule: {
                    rule: {
                        ranges: [{ sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: statusColIndex, endColumnIndex: statusColIndex + 1 }],
                        booleanRule: {
                            condition: { type: "TEXT_EQ", values: [{ userEnteredValue: rule.val }] },
                            format: { backgroundColor: rule.color }
                        }
                    },
                    index: 0
                }
            });
        });

        await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
        return { success: true };
    } catch (e) {
        console.error(`Setup ${sheetName} Sheet Error:`, e);
        return { success: false, error: e };
    }
}

/**
 * Public Setup Functions
 */
export async function setupTaskSheet() { return setupSheet(SHEET_TASKS, TASK_HEADERS); }
export async function setupSalesSheet() { return setupSheet(SHEET_SALES, SALES_HEADERS); }
export async function setupExpensesSheet() { return setupSheet(SHEET_EXPENSES, EXPENSE_HEADERS); }
export async function setupShipmentsSheet() { return setupSheet(SHEET_SHIPMENTS, SHIPMENT_HEADERS); }
export async function setupSourcesSheet() { return setupSheet(SHEET_SOURCES, SOURCE_HEADERS); }
export async function setupQualitySheet() { return setupSheet(SHEET_QUALITY, QUALITY_HEADERS); }
export async function setupMarketPriceSheet() { return setupSheet(SHEET_MARKET_PRICE, MARKET_PRICE_HEADERS); }
export async function setupMeetingsSheet() { return setupSheet(SHEET_MEETINGS, MEETING_HEADERS); }
export async function setupPLForecastSheet() { return setupSheet(SHEET_PL_FORECAST, PL_FORECAST_HEADERS); }
export async function setupProjectsSheet() { return setupSheet(SHEET_PROJECTS, PROJECT_HEADERS); }
export async function setupPartnersSheet() { return setupSheet(SHEET_PARTNERS, PARTNERS_HEADERS); }

/**
 * 2. Sync All Tasks TO Sheet (Overwrite)
 */
export async function syncTasksToSheet(tasks: Task[]) {
    try {
        const auth = getAuth();
        const sheets = google.sheets({ version: "v4", auth });
        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

        const rows = tasks.map(t => [
            t.id, t.title, t.description, t.status, t.priority, t.assignee_id,
            t.due_date ? new Date(t.due_date).toISOString().split('T')[0] : "",
            `=IMAGE("https://picsum.photos/seed/${t.id}/200/200")`,
            t.updated_at || new Date().toISOString()
        ]);

        await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${SHEET_TASKS}!A2:I1000` });
        if (rows.length > 0) {
            await sheets.spreadsheets.values.update({
                spreadsheetId, range: `${SHEET_TASKS}!A2`, valueInputOption: "USER_ENTERED", requestBody: { values: rows }
            });
        }
        return { success: true };
    } catch (e) {
        console.error("Sync Tasks To Sheet Error:", e);
        return { success: false };
    }
}

/**
 * Sync All Sales TO Sheet
 */
export async function syncAllSalesToSheet(orders: any[]) {
    try {
        const auth = getAuth();
        const sheets = google.sheets({ version: "v4", auth });
        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

        const rows = orders.map(o => {
            let dateStr = "";
            try {
                dateStr = new Date(o.created_at || Date.now()).toISOString().split('T')[0];
            } catch (e) {
                dateStr = new Date().toISOString().split('T')[0];
            }

            return [
                o.id,
                o.order_number || "",
                dateStr,
                o.client || "-",
                o.description || "-",
                o.amount || 0,
                o.priority || "medium",
                o.status || "pending",
                o.created_by_name || "System",
                o.image_url || "",
                o.updated_at || new Date().toISOString()
            ];
        });

        await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${SHEET_SALES}!A2:K1000` });
        if (rows.length > 0) {
            await sheets.spreadsheets.values.update({
                spreadsheetId, range: `${SHEET_SALES}!A2`, valueInputOption: "USER_ENTERED", requestBody: { values: rows }
            });
        }
        console.log(`Pushed ${rows.length} sales orders to sheet.`);
        return { success: true };
    } catch (e) {
        console.error("Sync Sales To Sheet Error:", e);
        return { success: false };
    }
}

/**
 * Sync All Shipments TO Sheet
 */
export async function syncAllShipmentsToSheet(shipments: any[]) {
    try {
        const auth = getAuth();
        const sheets = google.sheets({ version: "v4", auth });
        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

        const rows = shipments.map(s => [
            s.id, s.shipment_number || "", s.deal_id || "", s.status || "draft",
            s.buyer || "-", s.supplier || "-", s.is_blending ? "Yes" : "No", s.iup_op || "-",
            s.vessel_name || "-", s.barge_name || "-", s.loading_port || "-", s.discharge_port || "-",
            s.quantity_loaded || 0, s.bl_date || "-", s.eta || "-", s.sales_price || 0, s.margin_mt || 0, s.pic_name || "-",
            s.type || "export", s.milestones ? JSON.stringify(s.milestones) : "",
            s.created_at || new Date().toISOString(), s.updated_at || new Date().toISOString()
        ]);

        await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${SHEET_SHIPMENTS}!A2:V1000` });
        if (rows.length > 0) {
            await sheets.spreadsheets.values.update({
                spreadsheetId, range: `${SHEET_SHIPMENTS}!A2`, valueInputOption: "USER_ENTERED", requestBody: { values: rows }
            });
        }
        console.log(`Pushed ${rows.length} shipments to sheet.`);
        return { success: true };
    } catch (e) {
        console.error("Sync Shipments To Sheet Error:", e);
        return { success: false };
    }
}

/**
 * Sync All Sources TO Sheet
 */
export async function syncAllSourcesToSheet(sources: any[]) {
    try {
        const auth = getAuth();
        const sheets = google.sheets({ version: "v4", auth });
        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

        const rows = sources.map(s => [
            s.id, s.name || "", s.region || "", s.calorie_range || "",
            s.spec?.gar || 0, s.spec?.ts || 0, s.spec?.ash || 0, s.spec?.tm || 0,
            s.jetty_port || "-", s.anchorage || "-", s.stock_available || 0, s.min_stock_alert || 0,
            s.kyc_status || "not_started", s.psi_status || "not_started",
            s.fob_barge_only ? "Yes" : "No", s.price_linked_index || "-", s.fob_barge_price_usd || 0,
            s.contract_type || "-", s.pic_name || "-", s.iup_number || "-",
            s.updated_at || new Date().toISOString()
        ]);

        await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${SHEET_SOURCES}!A2:U1000` });
        if (rows.length > 0) {
            await sheets.spreadsheets.values.update({
                spreadsheetId, range: `${SHEET_SOURCES}!A2`, valueInputOption: "USER_ENTERED", requestBody: { values: rows }
            });
        }
        console.log(`Pushed ${rows.length} sources to sheet.`);
        return { success: true };
    } catch (e) {
        console.error("Sync Sources To Sheet Error:", e);
        return { success: false };
    }
}

/**
 * Sync All Quality TO Sheet
 */
export async function syncAllQualityToSheet(qualityResults: any[]) {
    try {
        const auth = getAuth();
        const sheets = google.sheets({ version: "v4", auth });
        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

        const rows = qualityResults.map(q => [
            q.id, q.cargo_id || "", q.cargo_name || "", q.surveyor || "-",
            q.sampling_date || "-", q.spec_result?.gar || 0, q.spec_result?.ts || 0,
            q.spec_result?.ash || 0, q.spec_result?.tm || 0, q.status || "pending",
            q.created_at || new Date().toISOString()
        ]);

        await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${SHEET_QUALITY}!A2:K1000` });
        if (rows.length > 0) {
            await sheets.spreadsheets.values.update({
                spreadsheetId, range: `${SHEET_QUALITY}!A2`, valueInputOption: "USER_ENTERED", requestBody: { values: rows }
            });
        }
        console.log(`Pushed ${rows.length} quality results to sheet.`);
        return { success: true };
    } catch (e) {
        console.error("Sync Quality To Sheet Error:", e);
        return { success: false };
    }
}

/**
 * Sync All Market Price TO Sheet
 */
export async function syncAllMarketPriceToSheet(prices: any[]) {
    try {
        const auth = getAuth();
        const sheets = google.sheets({ version: "v4", auth });
        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

        const rows = prices.map(m => [
            m.id, m.date || "-", m.ici_1 || 0, m.ici_2 || 0, m.ici_3 || 0, m.ici_4 || 0, m.ici_5 || 0,
            m.newcastle || 0, m.hba || 0, m.source || "-",
            m.updated_at || new Date().toISOString()
        ]);

        await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${SHEET_MARKET_PRICE}!A2:K1000` });
        if (rows.length > 0) {
            await sheets.spreadsheets.values.update({
                spreadsheetId, range: `${SHEET_MARKET_PRICE}!A2`, valueInputOption: "USER_ENTERED", requestBody: { values: rows }
            });
        }
        console.log(`Pushed ${rows.length} market prices to sheet.`);
        return { success: true };
    } catch (e) {
        console.error("Sync Market Price To Sheet Error:", e);
        return { success: false };
    }
}

/**
 * Sync All Meetings TO Sheet
 */
export async function syncAllMeetingsToSheet(meetings: any[]) {
    try {
        const auth = getAuth();
        const sheets = google.sheets({ version: "v4", auth });
        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

        const rows = meetings.map(m => [
            m.id, m.title || "-", m.date || "-", m.time || "-", m.location || "-",
            m.status || "scheduled", m.attendees?.join(", ") || "", m.created_by_name || "-",
            m.updated_at || new Date().toISOString()
        ]);

        await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${SHEET_MEETINGS}!A2:I1000` });
        if (rows.length > 0) {
            await sheets.spreadsheets.values.update({
                spreadsheetId, range: `${SHEET_MEETINGS}!A2`, valueInputOption: "USER_ENTERED", requestBody: { values: rows }
            });
        }
        console.log(`Pushed ${rows.length} meetings to sheet.`);
        return { success: true };
    } catch (e) {
        console.error("Sync Meetings To Sheet Error:", e);
        return { success: false };
    }
}

/**
 * Sync All PL Forecast TO Sheet
 */
export async function syncAllPLForecastToSheet(forecasts: any[]) {
    try {
        const auth = getAuth();
        const sheets = google.sheets({ version: "v4", auth });
        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

        const rows = forecasts.map(p => [
            p.id, p.project_name || p.buyer || "-", p.quantity || 0, p.selling_price || 0,
            p.buying_price || 0, p.freight_cost || 0, p.other_cost || 0,
            p.gross_profit_mt || 0, p.total_gross_profit || 0,
            p.updated_at || new Date().toISOString()
        ]);

        await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${SHEET_PL_FORECAST}!A2:J1000` });
        if (rows.length > 0) {
            await sheets.spreadsheets.values.update({
                spreadsheetId, range: `${SHEET_PL_FORECAST}!A2`, valueInputOption: "USER_ENTERED", requestBody: { values: rows }
            });
        }
        console.log(`Pushed ${rows.length} P&L forecasts to sheet.`);
        return { success: true };
    } catch (e) {
        console.error("Sync PL Forecast To Sheet Error:", e);
        return { success: false };
    }
}

/**
 * Sync All Purchases TO Sheet
 */
export async function syncAllPurchasesToSheet(purchases: any[]) {
    try {
        const auth = getAuth();
        const sheets = google.sheets({ version: "v4", auth });
        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

        const rows = purchases.map(p => {
            let dateStr = "";
            try {
                dateStr = new Date(p.created_at || Date.now()).toISOString().split('T')[0];
            } catch (e) {
                dateStr = new Date().toISOString().split('T')[0];
            }

            return [
                p.id,
                p.request_number || "",
                dateStr,
                p.category || "Other",
                p.supplier || "-",
                p.description || "-",
                p.amount || 0,
                p.priority || "medium",
                p.status || "pending",
                p.created_by_name || "System",
                p.image_url || "",
                p.updated_at || new Date().toISOString()
            ];
        });

        await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${SHEET_EXPENSES}!A2:L1000` });
        if (rows.length > 0) {
            await sheets.spreadsheets.values.update({
                spreadsheetId, range: `${SHEET_EXPENSES}!A2`, valueInputOption: "USER_ENTERED", requestBody: { values: rows }
            });
        }
        console.log(`Pushed ${rows.length} purchases to sheet.`);
        return { success: true };
    } catch (e) {
        console.error("Sync Purchases To Sheet Error:", e);
        return { success: false };
    }
}

/**
 * Sync All Blending TO Sheet
 */
export async function syncAllBlendingToSheet(simulations: any[]) {
    try {
        const auth = getAuth();
        const sheets = google.sheets({ version: "v4", auth });
        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

        const rows = simulations.map(s => [
            s.id, s.inputs || "[]", s.totalQuantity || 0, s.resultGar || 0,
            s.resultTs || 0, s.resultAsh || 0, s.resultTm || 0,
            s.createdBy || "-", s.createdAt || new Date().toISOString()
        ]);

        await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${SHEET_BLENDING}!A2:I1000` });
        if (rows.length > 0) {
            await sheets.spreadsheets.values.update({
                spreadsheetId, range: `${SHEET_BLENDING}!A2`, valueInputOption: "USER_ENTERED", requestBody: { values: rows }
            });
        }
        console.log(`Pushed ${rows.length} blending simulations to sheet.`);
        return { success: true };
    } catch (e) {
        console.error("Sync Blending To Sheet Error:", e);
        return { success: false };
    }
}

/**
 * Helper: Clean Number from String (e.g. "Rp 1.000.000" -> 1000000)
 * Robustly handles dots as thousand separators if followed by 3 digits.
 */
function cleanAmount(val: any): number {
    if (typeof val === "number") return val;
    if (!val) return 0;
    let str = String(val).trim();

    // Remove Currency Symbols & non-numeric junk except dots and commas
    str = str.replace(/[^\d.,-]/g, "");

    // Handle thousand separators (e.g. 1.000.000 or 1,000,000)
    // If there are multiple dots OR a dot followed by 3 digits at the end/middle, it's likely a separator.
    if ((str.match(/\./g) || []).length > 1 || /\.\d{3}/.test(str)) {
        str = str.replace(/\./g, "");
    }
    // Convert Indonesian/European comma to dot
    if (str.includes(",") && !str.includes(".")) {
        str = str.replace(/,/g, ".");
    } else if (str.includes(",") && str.includes(".")) {
        // Mixed: 1,000.00 -> remove comma
        str = str.replace(/,/g, "");
    }

    return parseFloat(str) || 0;
}

/**
 * Safely parse a date value from Google Sheets.
 * Handles: serial numbers (e.g. 46086), ISO strings, "YYYY-MM-DD", or locale date strings.
 * Returns "YYYY-MM-DD" or empty string.
 */
function cleanDate(val: any): string {
    if (val === null || val === undefined || val === "" || val === "-") return "";
    // If it's a number, treat as Google Sheets serial date (days since 1899-12-30)
    if (typeof val === "number" || (!isNaN(Number(val)) && String(val).match(/^\d{4,6}(\.\d+)?$/))) {
        const serial = Number(val);
        if (serial > 25569 && serial < 100000) { // Sheets serial range (after 1970 and before 2173)
            const ms = (serial - 25569) * 86400000; // 25569 = days from 1899-12-30 to 1970-01-01
            const d = new Date(ms);
            return d.toISOString().split("T")[0];
        }
    }
    // Try parsing as regular date string
    const str = String(val).trim();
    if (!str) return "";
    // Already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    // Try to parse
    const d = new Date(str);
    if (!isNaN(d.getTime()) && d.getFullYear() > 1970 && d.getFullYear() < 2100) {
        return d.toISOString().split("T")[0];
    }
    return str; // Return the raw string if nothing works
}

/**
 * Safely parse a time value from Google Sheets.
 * Handles: serial fractions (e.g. 0.5833 = 14:00), "HH:MM" strings.
 * Returns "HH:MM" or empty string.
 */
function cleanTime(val: any): string {
    if (val === null || val === undefined || val === "" || val === "-") return "";
    // If it's a number, it's a serial fraction (or shifted integer due to locale bugs)
    if (typeof val === "number" || (!isNaN(Number(val)) && Number(val) > 0)) {
        let frac = Number(val);
        // Correct integer shift bug where 0.375 becomes 375
        while (frac > 1) {
            frac /= 10;
        }
        if (frac >= 0 && frac < 1) {
            const totalMinutes = Math.round(frac * 1440); // 1440 minutes in a day
            const hours = Math.floor(totalMinutes / 60);
            const mins = totalMinutes % 60;
            return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
        }
    }
    const str = String(val).trim();
    // Already in HH:MM format
    if (/^\d{1,2}:\d{2}$/.test(str)) return str;
    return str;
}

/** Normalize shipment status from sheet to valid app values */
const VALID_SHIPMENT_STATUSES = ["draft", "waiting_loading", "loading", "in_transit", "anchorage", "discharging", "completed", "cancelled"];
function normalizeShipmentStatus(val: any): string {
    const s = String(val || "draft").trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (s === "waiting_for_loading" || s === "waiting") return "waiting_loading";
    if (s === "intransit" || s === "transit") return "in_transit";
    if (s === "discharged" || s === "discharge") return "discharging";
    if (s === "complete" || s === "done") return "completed";
    if (s === "cancel" || s === "canceled") return "cancelled";
    if (VALID_SHIPMENT_STATUSES.includes(s)) return s;
    return "draft";
}

/**
 * Sync Tasks FROM Sheet (Merge)
 */
export async function syncTasksFromSheet(): Promise<{ success: boolean, tasks?: Partial<Task>[] }> {
    try {
        const auth = getAuth();
        const sheets = google.sheets({ version: "v4", auth });
        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

        const res = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${SHEET_TASKS}!A:I`,
            valueRenderOption: "UNFORMATTED_VALUE",
        });

        const rows = res.data.values || [];
        const dataRows = rows.slice(1);

        const tasks: Partial<Task>[] = dataRows.map(row => {
            const title = String(row[1] || "").trim();
            if (!title) return null as any; // Treat cleared row as deleted

            return {
                id: String(row[0]).trim(),
                title,
                description: String(row[2] || "").trim(),
                status: (String(row[3] || "todo").trim().toLowerCase()) as TaskStatus,
                priority: (String(row[4] || "medium").trim().toLowerCase()) as TaskPriority,
                assignee_id: String(row[5] || "").trim(),
                due_date: row[6] ? cleanDate(row[6]) : undefined,
                updated_at: row[8] ? String(row[8]).trim() : undefined,
            };
        }).filter(t => t && t.id && t.id.toLowerCase() !== "undefined");

        return { success: true, tasks };
    } catch (e) {
        console.error("Sync Tasks From Sheet Error:", e);
        return { success: false };
    }
}

/**
 * Sync Sales FROM Sheet
 */
export async function syncSalesFromSheet(): Promise<{ success: boolean, orders?: any[] }> {
    try {
        const auth = getAuth();
        const sheets = google.sheets({ version: "v4", auth });
        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

        const res = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${SHEET_SALES}!A:K`,
            valueRenderOption: "UNFORMATTED_VALUE"
        });
        const rows = res.data.values || [];
        const dataRows = rows.slice(1);

        const orders = dataRows.map(row => {
            const id = String(row[0] || "").trim();
            if (!id || id.toLowerCase() === "undefined") return null;

            const order_number = String(row[1] || "").trim();
            if (!order_number) return null; // Treat cleared row as deleted

            return {
                id,
                order_number,
                client: String(row[3] || "").trim(),
                description: String(row[4] || "").trim(),
                amount: cleanAmount(row[5]),
                priority: String(row[6] || "medium").trim().toLowerCase(),
                status: String(row[7] || "pending").trim().toLowerCase(),
                updated_at: row[10] ? String(row[10]).trim() : undefined,
            };
        }).filter(o => o !== null);

        console.log(`Synced ${orders.length} orders from sheet.`);
        return { success: true, orders };
    } catch (e) {
        console.error("Sync Sales From Sheet Error:", e);
        return { success: false };
    }
}

/**
 * Sync Expenses FROM Sheet
 */
export async function syncExpensesFromSheet(): Promise<{ success: boolean, purchases?: any[] }> {
    try {
        const auth = getAuth();
        const sheets = google.sheets({ version: "v4", auth });
        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

        const res = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${SHEET_EXPENSES}!A:J`, // Extended
            valueRenderOption: "UNFORMATTED_VALUE"
        });
        const rows = res.data.values || [];
        const dataRows = rows.slice(1);

        const purchases = dataRows.map(row => {
            const id = String(row[0] || "").trim();
            if (!id || id.toLowerCase() === "undefined") return null;

            const request_number = String(row[1] || "").trim();
            if (!request_number) return null; // Treat cleared row as deleted

            return {
                id,
                request_number,
                category: String(row[3] || "").trim(),
                supplier: String(row[4] || "").trim(),
                description: String(row[5] || "").trim(),
                amount: cleanAmount(row[6]),
                priority: String(row[7] || "medium").trim().toLowerCase(),
                status: String(row[8] || "pending").trim().toLowerCase(),
                updated_at: row[11] ? String(row[11]).trim() : undefined,
            };
        }).filter(p => p !== null);

        console.log(`Synced ${purchases.length} purchases from sheet.`);
        return { success: true, purchases };
    } catch (e) {
        console.error("Sync Expenses From Sheet Error:", e);
        return { success: false };
    }
}

/**
 * Sync Shipments FROM Sheet
 */
export async function syncShipmentsFromSheet(): Promise<{ success: boolean, shipments?: any[] }> {
    try {
        const auth = getAuth();
        const sheets = google.sheets({ version: "v4", auth });
        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

        const res = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${SHEET_SHIPMENTS}!A:V`,
            valueRenderOption: "UNFORMATTED_VALUE"
        });
        const rows = res.data.values || [];
        const dataRows = rows.slice(1);

        const shipments = dataRows.map(row => {
            const id = String(row[0] || "").trim();
            if (!id || id.toLowerCase() === "undefined") return null;

            const shipment_number = String(row[1] || "").trim();
            if (!shipment_number) return null; // Treat cleared row as deleted

            let parsedMilestones;
            try {
                if (row[19]) parsedMilestones = JSON.parse(String(row[19]));
            } catch (e) {
                parsedMilestones = undefined;
            }

            return {
                id,
                shipment_number,
                deal_id: String(row[2] || "").trim(),
                status: normalizeShipmentStatus(row[3]),
                buyer: String(row[4] || "").trim(),
                supplier: String(row[5] || "").trim(),
                is_blending: String(row[6] || "").toLowerCase() === "yes",
                iup_op: String(row[7] || "").trim(),
                vessel_name: String(row[8] || "").trim(),
                barge_name: String(row[9] || "").trim(),
                loading_port: String(row[10] || "").trim(),
                discharge_port: String(row[11] || "").trim(),
                quantity_loaded: cleanAmount(row[12]),
                bl_date: cleanDate(row[13]),
                eta: cleanDate(row[14]),
                sales_price: cleanAmount(row[15]),
                margin_mt: cleanAmount(row[16]),
                pic_name: String(row[17] || "").trim(),
                type: String(row[18] || "export").trim().toLowerCase(),
                milestones: parsedMilestones,
                created_at: row[20] ? cleanDate(row[20]) : undefined,
                updated_at: row[21] ? String(row[21]).trim() : undefined,
            };
        }).filter(s => s !== null);

        console.log(`Synced ${shipments.length} shipments from sheet.`);
        return { success: true, shipments };
    } catch (e) {
        console.error("Sync Shipments From Sheet Error:", e);
        return { success: false };
    }
}

/**
 * Sync Sources FROM Sheet
 */
export async function syncSourcesFromSheet(): Promise<{ success: boolean, sources?: any[] }> {
    try {
        const auth = getAuth();
        const sheets = google.sheets({ version: "v4", auth });
        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

        const res = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${SHEET_SOURCES}!A:Y`,
            valueRenderOption: "UNFORMATTED_VALUE"
        });
        const rows = res.data.values || [];
        const dataRows = rows.slice(1);

        const sources = dataRows.map(row => {
            const id = String(row[0] || "").trim();
            if (!id || id.toLowerCase() === "undefined") return null;

            const name = String(row[1] || "").trim();
            if (!name) return null; // Treat cleared row as deleted

            return {
                id,
                name,
                region: String(row[2] || "").trim(),
                calorie_range: String(row[3] || "").trim(),
                spec: {
                    gar: cleanAmount(row[4]),
                    ts: cleanAmount(row[5]),
                    ash: cleanAmount(row[6]),
                    tm: cleanAmount(row[7]),
                    im: cleanAmount(row[21]),
                    fc: cleanAmount(row[22]),
                    nar: cleanAmount(row[23]),
                    adb: cleanAmount(row[24]),
                },
                jetty_port: String(row[8] || "").trim(),
                anchorage: String(row[9] || "").trim(),
                stock_available: cleanAmount(row[10]),
                min_stock_alert: cleanAmount(row[11]),
                kyc_status: String(row[12] || "not_started").trim().toLowerCase(),
                psi_status: String(row[13] || "not_started").trim().toLowerCase(),
                fob_barge_only: String(row[14] || "").toLowerCase() === "yes",
                price_linked_index: String(row[15] || "").trim(),
                fob_barge_price_usd: cleanAmount(row[16]),
                contract_type: String(row[17] || "").trim(),
                pic_name: String(row[18] || "").trim(),
                iup_number: String(row[19] || "").trim(),
                updated_at: row[20] ? String(row[20]).trim() : undefined,
            };
        }).filter(s => s !== null);

        console.log(`Synced ${sources.length} sources from sheet.`);
        return { success: true, sources };
    } catch (e) {
        console.error("Sync Sources From Sheet Error:", e);
        return { success: false };
    }
}

/**
 * Sync Quality FROM Sheet
 */
export async function syncQualityFromSheet(): Promise<{ success: boolean, qualityResults?: any[] }> {
    try {
        const auth = getAuth();
        const sheets = google.sheets({ version: "v4", auth });
        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

        const res = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${SHEET_QUALITY}!A:K`,
            valueRenderOption: "UNFORMATTED_VALUE"
        });
        const rows = res.data.values || [];
        const dataRows = rows.slice(1);

        const qualityResults = dataRows.map(row => {
            const id = String(row[0] || "").trim();
            if (!id || id.toLowerCase() === "undefined") return null;

            return {
                id,
                cargo_id: String(row[1] || "").trim(),
                cargo_name: String(row[2] || "").trim(),
                surveyor: String(row[3] || "").trim(),
                sampling_date: cleanDate(row[4]),
                spec_result: {
                    gar: cleanAmount(row[5]),
                    ts: cleanAmount(row[6]),
                    ash: cleanAmount(row[7]),
                    tm: cleanAmount(row[8]),
                },
                status: String(row[9] || "pending").trim().toLowerCase(),
                created_at: row[10] ? String(row[10]).trim() : undefined,
            };
        }).filter(q => q !== null);

        console.log(`Synced ${qualityResults.length} quality results from sheet.`);
        return { success: true, qualityResults };
    } catch (e) {
        console.error("Sync Quality From Sheet Error:", e);
        return { success: false };
    }
}

/**
 * Sync Market Price FROM Sheet
 */
export async function syncMarketPriceFromSheet(): Promise<{ success: boolean, prices?: any[] }> {
    try {
        const auth = getAuth();
        const sheets = google.sheets({ version: "v4", auth });
        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

        const res = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${SHEET_MARKET_PRICE}!A:J`,
            valueRenderOption: "UNFORMATTED_VALUE"
        });
        const rows = res.data.values || [];
        const dataRows = rows.slice(1);

        const prices = dataRows.map(row => {
            const id = String(row[0] || "").trim();
            if (!id || id.toLowerCase() === "undefined") return null;

            return {
                id,
                date: cleanDate(row[1]),
                ici_1: cleanAmount(row[2]),
                ici_2: cleanAmount(row[3]),
                ici_3: cleanAmount(row[4]),
                ici_4: cleanAmount(row[5]),
                newcastle: cleanAmount(row[6]),
                hba: cleanAmount(row[7]),
                source: String(row[8] || "").trim(),
                updated_at: row[9] ? String(row[9]).trim() : undefined,
            };
        }).filter(p => p !== null);

        console.log(`Synced ${prices.length} market prices from sheet.`);
        return { success: true, prices };
    } catch (e) {
        console.error("Sync Market Price From Sheet Error:", e);
        return { success: false };
    }
}

/**
 * Sync Meetings FROM Sheet
 */
export async function syncMeetingsFromSheet(): Promise<{ success: boolean, meetings?: any[] }> {
    try {
        const auth = getAuth();
        const sheets = google.sheets({ version: "v4", auth });
        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

        const res = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${SHEET_MEETINGS}!A:I`,
            valueRenderOption: "UNFORMATTED_VALUE"
        });
        const rows = res.data.values || [];
        const dataRows = rows.slice(1);

        const meetings = dataRows.map(row => {
            const id = String(row[0] || "").trim();
            if (!id || id.toLowerCase() === "undefined") return null;

            return {
                id,
                title: String(row[1] || "").trim(),
                date: cleanDate(row[2]),
                time: cleanTime(row[3]),
                location: String(row[4] || "").trim(),
                status: String(row[5] || "scheduled").trim().toLowerCase(),
                attendees: String(row[6] || "").split(",").map(a => a.trim()).filter(a => a !== ""),
                updated_at: row[8] ? String(row[8]).trim() : undefined,
            };
        }).filter(m => m !== null);

        console.log(`Synced ${meetings.length} meetings from sheet.`);
        return { success: true, meetings };
    } catch (e) {
        console.error("Sync Meetings From Sheet Error:", e);
        return { success: false };
    }
}

/**
 * Sync PL Forecast FROM Sheet
 */
export async function syncPLForecastFromSheet(): Promise<{ success: boolean, forecasts?: any[] }> {
    try {
        const auth = getAuth();
        const sheets = google.sheets({ version: "v4", auth });
        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

        const res = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${SHEET_PL_FORECAST}!A:J`,
            valueRenderOption: "UNFORMATTED_VALUE"
        });
        const rows = res.data.values || [];
        const dataRows = rows.slice(1);

        const forecasts = dataRows.map(row => {
            const id = String(row[0] || "").trim();
            if (!id || id.toLowerCase() === "undefined") return null;

            return {
                id,
                buyer: String(row[1] || "").trim(),
                project_name: String(row[1] || "").trim(),
                quantity: cleanAmount(row[2]),
                selling_price: cleanAmount(row[3]),
                buying_price: cleanAmount(row[4]),
                freight_cost: cleanAmount(row[5]),
                other_cost: cleanAmount(row[6]),
                gross_profit_mt: cleanAmount(row[7]),
                total_gross_profit: cleanAmount(row[8]),
                updated_at: row[9] ? String(row[9]).trim() : undefined,
            };
        }).filter(f => f !== null);

        console.log(`Synced ${forecasts.length} PL Forecasts from sheet.`);
        return { success: true, forecasts };
    } catch (e) {
        console.error("Sync PL Forecast From Sheet Error:", e);
        return { success: false };
    }
}

/**
 * Force Overwrite Sheets with Local Demo Data
 * This is useful for "resetting" the source of truth if it gets corrupted.
 */
export async function populateSheetsWithDemo(tasks: any[], sales: any[], expenses: any[], shipments?: any[], sources?: any[], quality?: any[], marketPrices?: any[], meetings?: any[], forecasts?: any[]) {
    try {
        console.log("Starting force population of sheets...");
        await setupTaskSheet();
        await setupSalesSheet();
        await setupExpensesSheet();
        await setupShipmentsSheet();
        await setupSourcesSheet();
        await setupQualitySheet();
        await setupMarketPriceSheet();
        await setupMeetingsSheet();
        await setupPLForecastSheet();

        await syncTasksToSheet(tasks);
        await syncAllSalesToSheet(sales);
        await syncAllPurchasesToSheet(expenses);
        if (shipments) await syncAllShipmentsToSheet(shipments);
        if (sources) await syncAllSourcesToSheet(sources);
        if (quality) await syncAllQualityToSheet(quality);
        if (marketPrices) await syncAllMarketPriceToSheet(marketPrices);
        if (meetings) await syncAllMeetingsToSheet(meetings);
        if (forecasts) await syncAllPLForecastToSheet(forecasts);

        console.log("Successfully populated all sheets with demo data.");
        return { success: true };
    } catch (e) {
        console.error("Populate Sheets Error:", e);
        return { success: false, error: String(e) };
    }
}

/**
 * Sync All Projects TO Sheet (Confirmed Deals)
 */
export async function syncAllProjectsToSheet(projects: any[]) {
    try {
        const auth = getAuth();
        const sheets = google.sheets({ version: "v4", auth });
        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

        const rows = projects.map(p => [
            p.id, p.buyer || "-", p.buyer_country || "-", p.type || "-",
            p.quantity || 0, p.price_per_mt || 0, p.total_value || 0,
            p.status || "confirmed", p.vessel_name || "-",
            p.laycan_start || "-", p.laycan_end || "-", p.pic_name || "-",
            p.updated_at || new Date().toISOString()
        ]);

        await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${SHEET_PROJECTS}!A2:M1000` });
        if (rows.length > 0) {
            await sheets.spreadsheets.values.update({
                spreadsheetId, range: `${SHEET_PROJECTS}!A2`, valueInputOption: "USER_ENTERED", requestBody: { values: rows }
            });
        }
        console.log(`Pushed ${rows.length} projects to sheet.`);
        return { success: true };
    } catch (e) {
        console.error("Sync Projects To Sheet Error:", e);
        return { success: false };
    }
}

/**
 * Sync Projects FROM Sheet
 */
export async function syncProjectsFromSheet(): Promise<{ success: boolean, projects?: any[] }> {
    try {
        const auth = getAuth();
        const sheets = google.sheets({ version: "v4", auth });
        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

        const res = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${SHEET_PROJECTS}!A:M`,
            valueRenderOption: "UNFORMATTED_VALUE"
        });
        const rows = res.data.values || [];
        const dataRows = rows.slice(1);

        const projects = dataRows.map(row => {
            const id = String(row[0] || "").trim();
            if (!id || id.toLowerCase() === "undefined") return null;

            return {
                id,
                buyer: String(row[1] || "").trim(),
                buyer_country: String(row[2] || "").trim(),
                type: String(row[3] || "").trim(),
                quantity: cleanAmount(row[4]),
                price_per_mt: cleanAmount(row[5]),
                total_value: cleanAmount(row[6]),
                status: String(row[7] || "confirmed").trim().toLowerCase(),
                vessel_name: String(row[8] || "").trim(),
                laycan_start: cleanDate(row[9]),
                laycan_end: cleanDate(row[10]),
                pic_name: String(row[11] || "").trim(),
                updated_at: row[12] ? String(row[12]).trim() : undefined,
            };
        }).filter(p => p !== null);

        console.log(`Synced ${projects.length} projects from sheet.`);
        return { success: true, projects };
    } catch (e) {
        console.error("Sync Projects From Sheet Error:", e);
        return { success: false };
    }
}

/**
 * Sync Partners FROM Sheet
 */
export async function syncPartnersFromSheet() {
    try {
        const auth = getAuth();
        const sheets = google.sheets({ version: "v4", auth });
        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

        const res = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${SHEET_PARTNERS}!A:Z`,
        });
        const rows = res.data.values || [];
        const dataRows = rows.slice(1);

        const partners = dataRows.map(row => {
            const id = String(row[0] || "").trim();
            if (!id || id.toLowerCase() === "undefined") return null;

            return {
                id,
                name: String(row[1] || "").trim(),
                type: String(row[2] || "buyer").trim().toLowerCase(),
                category: String(row[3] || "").trim(),
                pic: String(row[4] || "").trim(), // Contact Person maps to pic
                phone: String(row[5] || "").trim(),
                email: String(row[6] || "").trim(),
                region: String(row[8] || "").trim() + (row[9] ? `, ${row[9]}` : ""), // City, Country as region
                tax_id: String(row[10] || "").trim(),
                status: String(row[11] || "active").trim().toLowerCase(),
                notes: String(row[12] || "").trim(),
                updated_at: row[13] ? String(row[13]).trim() : undefined,
            };
        }).filter(p => p !== null);

        console.log(`Synced ${partners.length} partners from sheet`);
        return { success: true, partners };
    } catch (e) {
        console.error("Sync Partners From Sheet Error:", e);
        return { success: false };
    }
}

/**
 * Sync Partners TO Sheet (full overwrite)
 */
export async function syncPartnersToSheet(partners: any[]) {
    try {
        const dataToSave = partners.map(p => [
            p.id,
            p.name || "",
            p.type || "buyer",
            p.category || "",
            p.pic || "",
            p.phone || "",
            p.email || "",
            p.region ? p.region.split(",")[0] : "", // City approximation
            p.region ? p.region.split(",")[1]?.trim() : "", // Country approximation
            '', // Address placeholder
            p.tax_id || "",
            p.status || "active",
            p.notes || "",
            p.updated_at || new Date().toISOString()
        ]);
        const auth = getAuth();
        const sheets = google.sheets({ version: "v4", auth });
        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

        await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${SHEET_PARTNERS}!A2:N1000` });
        if (dataToSave.length > 0) {
            await sheets.spreadsheets.values.update({
                spreadsheetId, range: `${SHEET_PARTNERS}!A2`, valueInputOption: "USER_ENTERED", requestBody: { values: dataToSave }
            });
        }
        console.log(`Synced ${partners.length} partners to sheet`);
        return { success: true };
    } catch (e) {
        console.error("Sync Partners To Sheet Error:", e);
        return { success: false };
    }
}

