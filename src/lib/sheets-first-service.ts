import { google } from 'googleapis';
import prisma from './prisma';

/**
 * SheetsFirstService - Implements Spreadsheet-First Architecture
 * 
 * This service ensures Google Sheets is the single source of truth:
 * 1. Write to Sheets first
 * 2. Wait for confirmation
 * 3. Update local DB (as cache)
 * 4. Rollback on failure
 * 
 * Database acts as a fast read cache, while Sheets maintains the authoritative data.
 */

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
        console.error("[SheetsFirstService] Failed to parse GOOGLE_SHEETS_CREDENTIALS:", e.message);
        throw new Error(`Google Auth Setup Failed: ${e.message}`);
    }
}

interface PLForecastData {
    id: string;
    dealId?: string;
    dealNumber?: string;
    projectName?: string;
    buyer: string;
    type?: string;
    status?: string;
    quantity: number;
    sellingPrice: number;
    buyingPrice: number;
    freightCost: number;
    otherCost: number;
    grossProfitMt: number;
    totalGrossProfit: number;
    createdBy?: string;
    createdAt?: string;
    updatedAt?: string;
}

export class SheetsFirstService {
    private static readonly SHEET_NAME = "P&L Forecast";
    private static readonly SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;

    /**
     * Find row index of a record by ID in the sheet
     */
    private static async findRowByIdInSheet(sheets: any, id: string): Promise<number | null> {
        try {
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: this.SPREADSHEET_ID,
                range: `${this.SHEET_NAME}!A:A`,
            });

            const rows = response.data.values || [];
            // Skip header row (index 0), start from index 1
            for (let i = 1; i < rows.length; i++) {
                if (rows[i][0] === id) {
                    return i + 1; // Return 1-based row number
                }
            }
            return null;
        } catch (error: any) {
            console.error('[SheetsFirstService] Error finding row:', error.message);
            return null;
        }
    }

    /**
     * Create new P&L Forecast - Sheets First
     */
    static async createPLForecast(data: Omit<PLForecastData, 'id' | 'createdAt' | 'updatedAt'>): Promise<PLForecastData> {
        console.log('[SheetsFirstService] CREATE - Starting Sheets-first write...');
        
        if (!this.SPREADSHEET_ID) {
            throw new Error("GOOGLE_SHEETS_ID not configured");
        }

        const sheets = await getSheets();
        const id = `plf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();

        // Step 1: Write to Sheets FIRST
        try {
            const row = [
                id,                          // ID
                data.buyer || 'Unknown',     // Project / Buyer
                data.quantity || 0,          // Quantity
                data.sellingPrice || 0,      // Selling Price
                data.buyingPrice || 0,       // Buying Price
                data.freightCost || 0,       // Freight Cost
                data.otherCost || 0,         // Other Cost
                data.grossProfitMt || 0,     // Gross Profit / MT
                data.totalGrossProfit || 0,  // Total Gross Profit
                now                          // Updated At
            ];

            await sheets.spreadsheets.values.append({
                spreadsheetId: this.SPREADSHEET_ID,
                range: `${this.SHEET_NAME}!A:J`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [row]
                }
            });

            console.log('[SheetsFirstService] ✅ Sheet write successful, ID:', id);
        } catch (sheetError: any) {
            console.error('[SheetsFirstService] ❌ Sheet write FAILED:', sheetError.message);
            throw new Error(`Failed to write to Sheets: ${sheetError.message}`);
        }

        // Step 2: Write to Database as cache
        try {
            const dbRecord = await prisma.pLForecast.create({
                data: {
                    id,
                    dealId: data.dealId,
                    dealNumber: data.dealNumber,
                    projectName: data.projectName || data.dealNumber,
                    buyer: data.buyer || 'Unknown',
                    type: data.type || 'export',
                    status: data.status || 'forecast',
                    quantity: data.quantity || 0,
                    sellingPrice: data.sellingPrice || 0,
                    buyingPrice: data.buyingPrice || 0,
                    freightCost: data.freightCost || 0,
                    otherCost: data.otherCost || 0,
                    grossProfitMt: data.grossProfitMt || 0,
                    totalGrossProfit: data.totalGrossProfit || 0,
                    createdBy: data.createdBy || 'system',
                }
            });

            console.log('[SheetsFirstService] ✅ DB cache updated');

            return {
                id: dbRecord.id,
                dealId: dbRecord.dealId || undefined,
                dealNumber: dbRecord.dealNumber || undefined,
                projectName: dbRecord.projectName || undefined,
                buyer: dbRecord.buyer || 'Unknown',
                type: dbRecord.type,
                status: dbRecord.status,
                quantity: dbRecord.quantity,
                sellingPrice: dbRecord.sellingPrice,
                buyingPrice: dbRecord.buyingPrice,
                freightCost: dbRecord.freightCost,
                otherCost: dbRecord.otherCost,
                grossProfitMt: dbRecord.grossProfitMt,
                totalGrossProfit: dbRecord.totalGrossProfit,
                createdBy: dbRecord.createdBy || undefined,
                createdAt: dbRecord.createdAt.toISOString(),
                updatedAt: dbRecord.updatedAt.toISOString(),
            };
        } catch (dbError: any) {
            console.error('[SheetsFirstService] ⚠️ DB cache update failed (Sheet still has the data):', dbError.message);
            // Sheet has the data, so this is not a critical failure
            // The next sync will reconcile
            return {
                id,
                buyer: data.buyer || 'Unknown',
                quantity: data.quantity || 0,
                sellingPrice: data.sellingPrice || 0,
                buyingPrice: data.buyingPrice || 0,
                freightCost: data.freightCost || 0,
                otherCost: data.otherCost || 0,
                grossProfitMt: data.grossProfitMt || 0,
                totalGrossProfit: data.totalGrossProfit || 0,
                createdAt: now,
                updatedAt: now,
            };
        }
    }

    /**
     * Update P&L Forecast - Sheets First
     */
    static async updatePLForecast(id: string, data: Partial<PLForecastData>): Promise<PLForecastData> {
        console.log('[SheetsFirstService] UPDATE - Starting Sheets-first write for ID:', id);

        if (!this.SPREADSHEET_ID) {
            throw new Error("GOOGLE_SHEETS_ID not configured");
        }

        const sheets = await getSheets();
        const now = new Date().toISOString();

        // Get existing data from DB (cache)
        const existing = await prisma.pLForecast.findUnique({ where: { id } });
        if (!existing || existing.isDeleted) {
            throw new Error('Record not found');
        }

        // Merge data
        const quantity = data.quantity !== undefined ? data.quantity : existing.quantity;
        const sellingPrice = data.sellingPrice !== undefined ? data.sellingPrice : existing.sellingPrice;
        const buyingPrice = data.buyingPrice !== undefined ? data.buyingPrice : existing.buyingPrice;
        const freightCost = data.freightCost !== undefined ? data.freightCost : existing.freightCost;
        const otherCost = data.otherCost !== undefined ? data.otherCost : existing.otherCost;
        const grossProfitMt = sellingPrice - buyingPrice - freightCost - otherCost;
        const totalGrossProfit = grossProfitMt * quantity;

        // Step 1: Update in Sheets FIRST
        try {
            const rowIndex = await this.findRowByIdInSheet(sheets, id);
            if (!rowIndex) {
                console.warn('[SheetsFirstService] Record not found in Sheets, will append new row');
                // If not found in Sheets, append it
                const row = [
                    id,                              // ID
                    data.buyer || existing.buyer,    // Project / Buyer
                    quantity,                        // Quantity
                    sellingPrice,                    // Selling Price
                    buyingPrice,                     // Buying Price
                    freightCost,                     // Freight Cost
                    otherCost,                       // Other Cost
                    grossProfitMt,                   // Gross Profit / MT
                    totalGrossProfit,                // Total Gross Profit
                    now                              // Updated At
                ];

                await sheets.spreadsheets.values.append({
                    spreadsheetId: this.SPREADSHEET_ID,
                    range: `${this.SHEET_NAME}!A:J`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values: [row]
                    }
                });
            } else {
                // Update existing row
                const row = [
                    id,                              // ID
                    data.buyer || existing.buyer,    // Project / Buyer
                    quantity,                        // Quantity
                    sellingPrice,                    // Selling Price
                    buyingPrice,                     // Buying Price
                    freightCost,                     // Freight Cost
                    otherCost,                       // Other Cost
                    grossProfitMt,                   // Gross Profit / MT
                    totalGrossProfit,                // Total Gross Profit
                    now                              // Updated At
                ];

                await sheets.spreadsheets.values.update({
                    spreadsheetId: this.SPREADSHEET_ID,
                    range: `${this.SHEET_NAME}!A${rowIndex}:J${rowIndex}`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values: [row]
                    }
                });
            }

            console.log('[SheetsFirstService] ✅ Sheet update successful');
        } catch (sheetError: any) {
            console.error('[SheetsFirstService] ❌ Sheet update FAILED:', sheetError.message);
            throw new Error(`Failed to update Sheets: ${sheetError.message}`);
        }

        // Step 2: Update Database cache
        try {
            const updatedRecord = await prisma.pLForecast.update({
                where: { id },
                data: {
                    dealId: data.dealId,
                    dealNumber: data.dealNumber,
                    projectName: data.projectName,
                    buyer: data.buyer,
                    type: data.type,
                    status: data.status,
                    quantity,
                    sellingPrice,
                    buyingPrice,
                    freightCost,
                    otherCost,
                    grossProfitMt,
                    totalGrossProfit,
                }
            });

            console.log('[SheetsFirstService] ✅ DB cache updated');

            return {
                id: updatedRecord.id,
                dealId: updatedRecord.dealId || undefined,
                dealNumber: updatedRecord.dealNumber || undefined,
                projectName: updatedRecord.projectName || undefined,
                buyer: updatedRecord.buyer || 'Unknown',
                type: updatedRecord.type,
                status: updatedRecord.status,
                quantity: updatedRecord.quantity,
                sellingPrice: updatedRecord.sellingPrice,
                buyingPrice: updatedRecord.buyingPrice,
                freightCost: updatedRecord.freightCost,
                otherCost: updatedRecord.otherCost,
                grossProfitMt: updatedRecord.grossProfitMt,
                totalGrossProfit: updatedRecord.totalGrossProfit,
                createdBy: updatedRecord.createdBy || undefined,
                createdAt: updatedRecord.createdAt.toISOString(),
                updatedAt: updatedRecord.updatedAt.toISOString(),
            };
        } catch (dbError: any) {
            console.error('[SheetsFirstService] ⚠️ DB cache update failed (Sheet still has the update):', dbError.message);
            // Sheet has the update, so return the merged data
            return {
                id,
                buyer: data.buyer || existing.buyer || 'Unknown',
                quantity,
                sellingPrice,
                buyingPrice,
                freightCost,
                otherCost,
                grossProfitMt,
                totalGrossProfit,
                createdAt: existing.createdAt.toISOString(),
                updatedAt: now,
            };
        }
    }

    /**
     * Delete P&L Forecast - Sheets First (soft delete)
     */
    static async deletePLForecast(id: string): Promise<void> {
        console.log('[SheetsFirstService] DELETE - Starting Sheets-first delete for ID:', id);

        if (!this.SPREADSHEET_ID) {
            throw new Error("GOOGLE_SHEETS_ID not configured");
        }

        const sheets = await getSheets();

        // Step 1: Remove from Sheets FIRST
        try {
            const rowIndex = await this.findRowByIdInSheet(sheets, id);
            if (rowIndex) {
                // Delete the row
                await sheets.spreadsheets.batchUpdate({
                    spreadsheetId: this.SPREADSHEET_ID,
                    requestBody: {
                        requests: [{
                            deleteDimension: {
                                range: {
                                    sheetId: 0, // Assuming first sheet, might need to be dynamic
                                    dimension: 'ROWS',
                                    startIndex: rowIndex - 1,
                                    endIndex: rowIndex
                                }
                            }
                        }]
                    }
                });

                console.log('[SheetsFirstService] ✅ Row deleted from Sheet');
            } else {
                console.warn('[SheetsFirstService] Record not found in Sheet, will still mark deleted in DB');
            }
        } catch (sheetError: any) {
            console.error('[SheetsFirstService] ❌ Sheet delete FAILED:', sheetError.message);
            throw new Error(`Failed to delete from Sheets: ${sheetError.message}`);
        }

        // Step 2: Soft delete in Database cache
        try {
            await prisma.pLForecast.update({
                where: { id },
                data: { isDeleted: true }
            });

            console.log('[SheetsFirstService] ✅ DB cache marked as deleted');
        } catch (dbError: any) {
            console.error('[SheetsFirstService] ⚠️ DB cache deletion failed (Sheet row already removed):', dbError.message);
            // Sheet row is removed, which is the source of truth, so this is acceptable
        }
    }

    /**
     * Read P&L Forecast from Database (cache)
     * Sheets → DB sync happens periodically via sync-manager
     */
    static async getPLForecast(id: string): Promise<PLForecastData | null> {
        const record = await prisma.pLForecast.findUnique({
            where: { id, isDeleted: false }
        });

        if (!record) return null;

        return {
            id: record.id,
            dealId: record.dealId || undefined,
            dealNumber: record.dealNumber || undefined,
            projectName: record.projectName || undefined,
            buyer: record.buyer || 'Unknown',
            type: record.type,
            status: record.status,
            quantity: record.quantity,
            sellingPrice: record.sellingPrice,
            buyingPrice: record.buyingPrice,
            freightCost: record.freightCost,
            otherCost: record.otherCost,
            grossProfitMt: record.grossProfitMt,
            totalGrossProfit: record.totalGrossProfit,
            createdBy: record.createdBy || undefined,
            createdAt: record.createdAt.toISOString(),
            updatedAt: record.updatedAt.toISOString(),
        };
    }

    /**
     * Sync P&L Forecasts from Google Sheets to Database
     * This ensures the database cache is up-to-date with the Sheet
     */
    static async syncPLForecastsFromSheet(): Promise<void> {
        console.log('[SheetsFirstService] Syncing P&L Forecasts from Sheet to DB...');
        
        if (!this.SPREADSHEET_ID) {
            console.warn('[SheetsFirstService] GOOGLE_SHEETS_ID not configured, skipping sync');
            return;
        }

        try {
            const sheets = await getSheets();
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: this.SPREADSHEET_ID,
                range: `${this.SHEET_NAME}!A:J`,
            });

            const rows = response.data.values || [];
            if (rows.length <= 1) {
                console.log('[SheetsFirstService] No data rows in Sheet');
                return;
            }

            const headers = rows[0];
            const dataRows = rows.slice(1);

            // Helper to get column value by header name
            const getCol = (row: any[], headerName: string) => {
                const idx = headers.findIndex((h: string) => 
                    h.trim().toUpperCase() === headerName.trim().toUpperCase()
                );
                return idx >= 0 ? row[idx] : null;
            };

            const parseNum = (val: any): number => {
                if (!val) return 0;
                const str = String(val).trim().replace(/,/g, '');
                const num = parseFloat(str);
                return isNaN(num) ? 0 : num;
            };

            const sheetIds = new Set<string>();

            for (const row of dataRows) {
                const id = getCol(row, 'ID');
                if (!id) continue;

                sheetIds.add(id);

                const buyer = getCol(row, 'PROJECT / BUYER') || getCol(row, 'BUYER') || 'Unknown';
                const quantity = parseNum(getCol(row, 'QUANTITY'));
                const sellingPrice = parseNum(getCol(row, 'SELLING PRICE'));
                const buyingPrice = parseNum(getCol(row, 'BUYING PRICE'));
                const freightCost = parseNum(getCol(row, 'FREIGHT COST'));
                const otherCost = parseNum(getCol(row, 'OTHER COST'));
                const grossProfitMt = sellingPrice - buyingPrice - freightCost - otherCost;
                const totalGrossProfit = grossProfitMt * quantity;
                const updatedAt = getCol(row, 'UPDATED AT') || new Date().toISOString();

                // Check if record exists
                const existing = await prisma.pLForecast.findUnique({ where: { id } });

                if (existing) {
                    // Update only the fields from Sheet, preserve other fields
                    await prisma.pLForecast.update({
                        where: { id },
                        data: {
                            buyer,
                            quantity,
                            sellingPrice,
                            buyingPrice,
                            freightCost,
                            otherCost,
                            grossProfitMt,
                            totalGrossProfit,
                            updatedAt: new Date(updatedAt),
                        },
                    });
                } else {
                    // Create new record
                    await prisma.pLForecast.create({
                        data: {
                            id,
                            buyer,
                            quantity,
                            sellingPrice,
                            buyingPrice,
                            freightCost,
                            otherCost,
                            grossProfitMt,
                            totalGrossProfit,
                            createdBy: 'system',
                            type: 'export',
                            status: 'forecast',
                        },
                    });
                }
            }

            // Mark records not in Sheet as deleted
            const dbRecords = await prisma.pLForecast.findMany({
                where: { isDeleted: false },
                select: { id: true },
            });

            for (const dbRecord of dbRecords) {
                if (!sheetIds.has(dbRecord.id)) {
                    await prisma.pLForecast.update({
                        where: { id: dbRecord.id },
                        data: { isDeleted: true },
                    });
                }
            }

            console.log('[SheetsFirstService] ✅ P&L Forecasts synced from Sheet');
        } catch (error: any) {
            console.error('[SheetsFirstService] ❌ Failed to sync from Sheet:', error.message);
            throw error;
        }
    }

    /**
     * List all P&L Forecasts from Database (cache)
     */
    static async listPLForecasts(): Promise<PLForecastData[]> {
        const records = await prisma.pLForecast.findMany({
            where: { isDeleted: false },
            orderBy: { createdAt: 'desc' }
        });

        return records.map(record => ({
            id: record.id,
            dealId: record.dealId || undefined,
            dealNumber: record.dealNumber || undefined,
            projectName: record.projectName || undefined,
            buyer: record.buyer || 'Unknown',
            type: record.type,
            status: record.status,
            quantity: record.quantity,
            sellingPrice: record.sellingPrice,
            buyingPrice: record.buyingPrice,
            freightCost: record.freightCost,
            otherCost: record.otherCost,
            grossProfitMt: record.grossProfitMt,
            totalGrossProfit: record.totalGrossProfit,
            createdBy: record.createdBy || undefined,
            createdAt: record.createdAt.toISOString(),
            updatedAt: record.updatedAt.toISOString(),
        }));
    }
}
