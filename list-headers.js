require("dotenv").config({ path: ".env.local" });
require("dotenv").config();
const { google } = require('googleapis');

async function main() {
    const credentials = process.env.GOOGLE_SHEETS_CREDENTIALS;
    const parsed = JSON.parse(credentials);
    const auth = new google.auth.GoogleAuth({
        credentials: parsed,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });
    const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;

    const tabs = ["Sales", "Expenses", "Tasks", "Meetings"];
    for (const tab of tabs) {
        try {
            const res = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${tab}!1:1`,
            });
            console.log(`Headers for ${tab}:`, res.data.values ? res.data.values[0] : "Empty");
        } catch (e) {
            console.error(`Error for ${tab}:`, e.message);
        }
    }
}
main().catch(console.error);
