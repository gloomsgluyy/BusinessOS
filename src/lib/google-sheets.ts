import { google } from "googleapis";

function getAuth() {
    const credentials = process.env.GOOGLE_SHEETS_CREDENTIALS;
    if (!credentials) throw new Error("GOOGLE_SHEETS_CREDENTIALS not set");

    const parsed = JSON.parse(credentials);
    return new google.auth.GoogleAuth({
        credentials: parsed,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
}

function getSheets() {
    return google.sheets({ version: "v4", auth: getAuth() });
}

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID || "";

export async function getSheetData(tab: string): Promise<string[][]> {
    const sheets = getSheets();
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${tab}!A:Z`,
    });
    return (res.data.values as string[][]) || [];
}

export async function appendRow(tab: string, values: any[]): Promise<void> {
    const sheets = getSheets();
    await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${tab}!A:Z`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [values] },
    });
}

export async function updateRow(tab: string, rowIndex: number, values: any[]): Promise<void> {
    const sheets = getSheets();
    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${tab}!A${rowIndex}:Z${rowIndex}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [values] },
    });
}

export async function deleteRow(tab: string, rowIndex: number): Promise<void> {
    const sheets = getSheets();
    const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
    });
    const sheet = spreadsheet.data.sheets?.find((s) => s.properties?.title === tab);
    if (!sheet?.properties?.sheetId && sheet?.properties?.sheetId !== 0) return;

    await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
            requests: [
                {
                    deleteDimension: {
                        range: {
                            sheetId: sheet.properties.sheetId,
                            dimension: "ROWS",
                            startIndex: rowIndex - 1,
                            endIndex: rowIndex,
                        },
                    },
                },
            ],
        },
    });
}

export function rowToObject<T>(headers: string[], row: string[]): T {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
        obj[h] = row[i] || "";
    });
    return obj as unknown as T;
}

export async function findRowIndex(tab: string, columnIndex: number, value: string): Promise<number> {
    const data = await getSheetData(tab);
    // data is array of rows. columnIndex is 0-based.
    // Returns 1-based row index for Google Sheets API (or -1 if not found)
    const index = data.findIndex((row) => row[columnIndex] === value);
    return index === -1 ? -1 : index + 1;
}

export async function upsertRow(tab: string, keyColumnIndex: number, keyValue: string, values: any[]): Promise<void> {
    const rowIndex = await findRowIndex(tab, keyColumnIndex, keyValue);
    if (rowIndex > 0) {
        await updateRow(tab, rowIndex, values);
    } else {
        await appendRow(tab, values);
    }
}

export async function setupSheetValidation(tab: string, statusColumnIndex: number): Promise<void> {
    const sheets = getSheets();
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheet = spreadsheet.data.sheets?.find((s) => s.properties?.title === tab);
    if (!sheet?.properties?.sheetId) return;

    const sheetId = sheet.properties.sheetId;

    await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
            requests: [
                {
                    setDataValidation: {
                        range: {
                            sheetId: sheetId,
                            startRowIndex: 1, // Skip header
                            startColumnIndex: statusColumnIndex,
                            endColumnIndex: statusColumnIndex + 1,
                        },
                        rule: {
                            condition: {
                                type: "ONE_OF_LIST",
                                values: [
                                    { userEnteredValue: "draft" },
                                    { userEnteredValue: "pending" },
                                    { userEnteredValue: "approved" },
                                    { userEnteredValue: "rejected" },
                                    { userEnteredValue: "todo" },
                                    { userEnteredValue: "in_progress" },
                                    { userEnteredValue: "review" },
                                    { userEnteredValue: "done" },
                                ],
                            },
                            showCustomUi: true,
                            strict: false,
                        },
                    },
                },
            ],
        },
    });
}
