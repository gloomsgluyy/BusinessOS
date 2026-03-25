/**
 * SheetWriteService
 * Handles immediate write operations to Google Sheets (Sheets-First Architecture)
 * 
 * Flow: User action → Write to Sheets → Update DB cache → Return to user
 */

import { google } from 'googleapis';
import prisma from './prisma';

// Sheet Names
const SHEET_NAMES = {
    TASKS: "Tasks",
    SALES: "Sales", 
    EXPENSES: "Expenses",
    SHIPMENTS: "Shipments",
    SOURCES: "Sources",
    QUALITY: "Quality",
    MARKET_PRICE: "Market Price",
    MEETINGS: "Meetings",
    PL_FORECAST: "P&L Forecast",
    PROJECTS: "Projects",
    PARTNERS: "Partners",
    BLENDING: "Blending"
};

// Sheet Headers Mapping
const SHEET_HEADERS: Record<string, string[]> = {
    [SHEET_NAMES.MEETINGS]: ["ID", "Title", "Date", "Time", "Location", "Status", "Attendees", "Voice Note URL", "MoM Content", "AI Summary", "Created By", "Updated At"],
    [SHEET_NAMES.TASKS]: ["ID", "Title", "Description", "Status", "Priority", "Assignee", "Due Date", "Image Preview", "Updated At"],
    [SHEET_NAMES.SALES]: ["ID", "Order #", "Date", "Client", "Description", "Amount", "Priority", "Status", "Created By", "Image Preview", "Updated At"],
    [SHEET_NAMES.EXPENSES]: ["ID", "Request #", "Date", "Category", "Supplier", "Description", "Amount", "Priority", "Status", "Created By", "Image Preview", "Updated At"],
    [SHEET_NAMES.SHIPMENTS]: ["ID", "Shipment #", "Deal ID", "Status", "Buyer", "Supplier", "Is Blending", "IUP OP", "Vessel Name", "Barge Name", "Loading Port", "Discharge Port", "Qty Loaded (MT)", "BL Date", "ETA", "Sales Price", "Margin/MT", "PIC", "Type", "Milestones", "Created At", "Updated At"],
    [SHEET_NAMES.SOURCES]: ["ID", "Name", "Region", "Calorie Range", "GAR", "TS", "Ash", "TM", "Jetty Port", "Anchorage", "Stock Available", "Min Stock Alert", "KYC Status", "PSI Status", "FOB Barge Only", "Price Linked Index", "FOB Barge Price (USD)", "Contract Type", "PIC", "IUP Number", "Updated At"],
    [SHEET_NAMES.QUALITY]: ["ID", "Cargo ID", "Cargo Name", "Surveyor", "Sampling Date", "GAR", "TS", "Ash", "TM", "Status", "Updated At"],
    [SHEET_NAMES.MARKET_PRICE]: ["ID", "Date", "ICI 1", "ICI 2", "ICI 3", "ICI 4", "ICI 5", "Newcastle", "HBA", "Source", "Updated At"],
    [SHEET_NAMES.PL_FORECAST]: ["ID", "Project / Buyer", "Quantity", "Selling Price", "Buying Price", "Freight Cost", "Other Cost", "Gross Profit / MT", "Total Gross Profit", "Updated At"],
    [SHEET_NAMES.PROJECTS]: ["ID", "Buyer", "Country", "Type", "Quantity (MT)", "Price/MT", "Total Value", "Status", "Vessel", "Laycan Start", "Laycan End", "PIC", "Updated At"],
    [SHEET_NAMES.PARTNERS]: ["ID", "Name", "Type", "Category", "Contact Person", "Phone", "Email", "Address", "City", "Country", "Tax ID", "Status", "Notes", "Updated At"],
    [SHEET_NAMES.BLENDING]: ["ID", "Inputs", "Total Qty", "Result GAR", "Result TS", "Result Ash", "Result TM", "Created By", "Created At"]
};

async function getSheets() {
    let credentials = process.env.GOOGLE_SHEETS_CREDENTIALS;
    if (!credentials) throw new Error("GOOGLE_SHEETS_CREDENTIALS not set in .env");

    try {
        credentials = credentials.trim();
        if ((credentials.startsWith("'") && credentials.endsWith("'")) ||
            (credentials.startsWith('"') && credentials.endsWith('"'))) {
            credentials = credentials.substring(1, credentials.length - 1);
        }

        let sanitized = credentials;
        try {
            JSON.parse(sanitized);
        } catch (initialError: any) {
            sanitized = sanitized.trim().replace(/\r/g, '').replace(/\n/g, '\\n');
            if ((sanitized.startsWith("'") && sanitized.endsWith("'")) ||
                (sanitized.startsWith('"') && sanitized.endsWith('"'))) {
                sanitized = sanitized.substring(1, sanitized.length - 1);
            }
            sanitized = sanitized.replace(/\\([^"\\\/bfnrtu])/g, '\\\\$1');
            if (sanitized.endsWith('\\') && !sanitized.endsWith('\\\\')) {
                sanitized += '\\';
            }
        }

        const credsJson = JSON.parse(sanitized);
        const auth = new google.auth.GoogleAuth({
            credentials: credsJson,
            scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });
        return google.sheets({ version: "v4", auth });
    } catch (e: any) {
        console.error("[SheetWriteService] Failed to parse GOOGLE_SHEETS_CREDENTIALS:", e.message);
        throw new Error(`Google Auth Setup Failed: ${e.message}`);
    }
}

export class SheetWriteService {
    
    /**
     * Add a new row to specified sheet
     */
    static async appendRow(sheetName: string, rowData: any[]): Promise<void> {
        try {
            const sheets = await getSheets();
            const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
            
            if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_ID not set");

            console.log(`[SheetWriteService] Appending row to ${sheetName}`);
            
            await sheets.spreadsheets.values.append({
                spreadsheetId,
                range: `${sheetName}!A2`, // Start from row 2 (after header)
                valueInputOption: "USER_ENTERED",
                requestBody: {
                    values: [rowData]
                }
            });

            console.log(`[SheetWriteService] Successfully appended row to ${sheetName}`);
        } catch (error: any) {
            console.error(`[SheetWriteService] Failed to append row to ${sheetName}:`, error.message);
            throw new Error(`Failed to write to Google Sheets: ${error.message}`);
        }
    }

    /**
     * Update an existing row by ID
     */
    static async updateRow(sheetName: string, id: string, rowData: any[]): Promise<void> {
        try {
            const sheets = await getSheets();
            const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
            
            if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_ID not set");

            // 1. Find the row with this ID
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `${sheetName}!A:A` // Get all IDs from column A
            });

            const rows = response.data.values || [];
            const rowIndex = rows.findIndex((row: any) => row[0] === id);

            if (rowIndex === -1) {
                throw new Error(`Row with ID ${id} not found in ${sheetName}`);
            }

            // Row index is 0-based, but sheet rows are 1-based and include header
            const sheetRowNumber = rowIndex + 1;

            console.log(`[SheetWriteService] Updating row ${sheetRowNumber} in ${sheetName} (ID: ${id})`);

            // 2. Update the row
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${sheetName}!A${sheetRowNumber}`,
                valueInputOption: "USER_ENTERED",
                requestBody: {
                    values: [rowData]
                }
            });

            console.log(`[SheetWriteService] Successfully updated row in ${sheetName}`);
        } catch (error: any) {
            console.error(`[SheetWriteService] Failed to update row in ${sheetName}:`, error.message);
            throw new Error(`Failed to update Google Sheets: ${error.message}`);
        }
    }

    /**
     * Delete a row by ID (actually just marks it or removes it)
     */
    static async deleteRow(sheetName: string, id: string): Promise<void> {
        try {
            const sheets = await getSheets();
            const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
            
            if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_ID not set");

            // 1. Find the row with this ID
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `${sheetName}!A:A`
            });

            const rows = response.data.values || [];
            const rowIndex = rows.findIndex((row: any) => row[0] === id);

            if (rowIndex === -1) {
                console.warn(`[SheetWriteService] Row with ID ${id} not found in ${sheetName}, nothing to delete`);
                return;
            }

            const sheetRowNumber = rowIndex + 1;

            console.log(`[SheetWriteService] Deleting row ${sheetRowNumber} from ${sheetName} (ID: ${id})`);

            // 2. Get sheet ID
            const metadata = await sheets.spreadsheets.get({ spreadsheetId });
            const sheet = metadata.data.sheets?.find(s => s.properties?.title === sheetName);
            const sheetId = sheet?.properties?.sheetId;

            if (sheetId === undefined) {
                throw new Error(`Sheet ${sheetName} not found`);
            }

            // 3. Delete the row using batchUpdate
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: {
                    requests: [{
                        deleteDimension: {
                            range: {
                                sheetId,
                                dimension: "ROWS",
                                startIndex: rowIndex, // 0-based for API
                                endIndex: rowIndex + 1
                            }
                        }
                    }]
                }
            });

            console.log(`[SheetWriteService] Successfully deleted row from ${sheetName}`);
        } catch (error: any) {
            console.error(`[SheetWriteService] Failed to delete row from ${sheetName}:`, error.message);
            throw new Error(`Failed to delete from Google Sheets: ${error.message}`);
        }
    }

    /**
     * Read all rows from a sheet (for GET operations)
     */
    static async readAll(sheetName: string): Promise<any[]> {
        try {
            const sheets = await getSheets();
            const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
            
            if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_ID not set");

            const response = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `${sheetName}!A2:Z1000` // Read from row 2 onwards (skip header)
            });

            const rows = response.data.values || [];
            return rows;
        } catch (error: any) {
            console.error(`[SheetWriteService] Failed to read from ${sheetName}:`, error.message);
            throw new Error(`Failed to read from Google Sheets: ${error.message}`);
        }
    }

    /**
     * Get headers for a specific sheet
     */
    static getHeaders(sheetName: string): string[] {
        return SHEET_HEADERS[sheetName] || [];
    }
}

export { SHEET_NAMES };
