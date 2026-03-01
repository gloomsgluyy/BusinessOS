require("dotenv").config({ path: ".env.local" });
require("dotenv").config();
const { google } = require('googleapis');

async function main() {
    console.log("Fetching additional tabs...");
    const credentials = process.env.GOOGLE_SHEETS_CREDENTIALS;
    if (!credentials) return;
    const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;

    const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(credentials),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    const tabsToInspect = ["Shipments", "Sources", "Market Price", "P&L Forecast", "Projects"];

    for (const tab of tabsToInspect) {
        try {
            const res = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${tab}!1:1`,
            });
            console.log(`\n--- ${tab} ---`);
            console.log(res.data.values ? res.data.values[0] : "Empty");
        } catch (e) {
            console.error(`Error for ${tab}:`, e.message);
        }
    }
}
main();
