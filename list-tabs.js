require("dotenv").config({ path: ".env.local" });
require("dotenv").config();
const { google } = require('googleapis');

async function main() {
    const credentials = process.env.GOOGLE_SHEETS_CREDENTIALS;
    if (!credentials) throw new Error("GOOGLE_SHEETS_CREDENTIALS not set in .env");

    const parsed = JSON.parse(credentials);
    const auth = new google.auth.GoogleAuth({
        credentials: parsed,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID || "";
    const res = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });

    console.log("Found the following tabs in the spreadsheet:");
    res.data.sheets.forEach(s => {
        console.log("- " + s.properties.title);
    });
}
main().catch(console.error);
