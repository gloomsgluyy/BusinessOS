require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const xlsx = require("xlsx");
const { google } = require("googleapis");
const path = require("path");

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;
const CREDS = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS || "{}");

const mvFile = path.join(__dirname, "../Contoh_Excel/00. MV_Barge&Source 2021,2022, 2023,2024-7-19.xlsx");
const dailyFile = path.join(__dirname, "../Contoh_Excel/10.Daily Delivery Report (Recap Shipment) 2020, 2021, 2022, 2023, 2024, 2025, 2026.xlsx");

// Use only tabs from 2024 onwards
const mvTabs = ['MV_Barge&Source 2024', 'MV_Barge&Source 2025', ' MV_Barge&Source 2026'];
const dailyTabs = ['DOMESTIK KLT, KALSEL SUMSEL 20', 'DOM_EXPORT SUMSEL KALSEL 2025', 'DOM_EXPORT SUMSEL KALSEL 2026'];

async function main() {
    console.log("🚀 Starting BusinessOS 2026 Excel Data Migrator");

    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: CREDS.client_email,
            private_key: CREDS.private_key,
        },
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    
    const sheets = google.sheets({ version: "v4", auth });

    // Step 1: Clear old target sheets
    console.log("🧹 Clearing old Google Sheets data...");
    try {
        await sheets.spreadsheets.values.clear({
            spreadsheetId: SPREADSHEET_ID,
            range: "MV Barge!A2:AN",
        });
        await sheets.spreadsheets.values.clear({
            spreadsheetId: SPREADSHEET_ID,
            range: "Daily Delivery!A2:BT",
        });
        console.log("✅ Target sheets cleared.");
    } catch(e) {
        console.log("⚠️ Could not clear sheets (Might not exist or different name).", e.message);
    }

    // Step 2: Read Excel and format payload
    console.log("📖 Reading Excel Files...");
    
    let mvPayload = [];
    try {
        const mvWb = xlsx.readFile(mvFile);
        mvTabs.forEach(t => {
            if (mvWb.Sheets[t]) {
                const data = xlsx.utils.sheet_to_json(mvWb.Sheets[t], { header: 1 });
                // Skip headers, take rows
                for(let i=2; i<data.length; i++) {
                    if (data[i] && data[i].length > 0 && data[i][0]) {
                        // Normalize 40 columns
                        let row = new Array(40).fill("");
                        for(let j=0; j<Math.min(data[i].length, 40); j++) {
                            row[j] = data[i][j] ? String(data[i][j]) : "";
                        }
                        mvPayload.push(row);
                    }
                }
            }
        });
        console.log(`✅ Extracted ${mvPayload.length} rows for MV Barge.`);
    } catch(e) {
        console.error("❌ Failed to parse MV file", e.message);
    }

    let dailyPayload = [];
    try {
        const dailyWb = xlsx.readFile(dailyFile);
        dailyTabs.forEach(t => {
            if (dailyWb.Sheets[t]) {
                const data = xlsx.utils.sheet_to_json(dailyWb.Sheets[t], { header: 1 });
                for(let i=2; i<data.length; i++) {
                    if (data[i] && data[i].length > 0 && data[i][0]) {
                        let row = new Array(70).fill(""); // Up to BT
                        for(let j=0; j<Math.min(data[i].length, 70); j++) {
                            row[j] = data[i][j] ? String(data[i][j]) : "";
                        }
                        dailyPayload.push(row);
                    }
                }
            }
        });
        console.log(`✅ Extracted ${dailyPayload.length} rows for Daily Delivery.`);
    } catch(e) {
        console.error("❌ Failed to parse Daily file", e.message);
    }

    // Step 3: Append to Google Sheets
    console.log("📤 Appending data to Google Sheets (MV Barge)...");
    if (mvPayload.length > 0) {
        try {
            await sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: "MV Barge!A2",
                valueInputOption: "USER_ENTERED",
                resource: { values: mvPayload }
            });
            console.log("✅ Synced MV Barge");
        } catch(e) {
            console.error("❌ Failed sending MV Barge data - it might need format adjustment.", e.message);
        }
    }

    console.log("📤 Appending data to Google Sheets (Daily Delivery)...");
    if (dailyPayload.length > 0) {
        try {
            await sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: "Daily Delivery!A2",
                valueInputOption: "USER_ENTERED",
                resource: { values: dailyPayload }
            });
            console.log("✅ Synced Daily Delivery");
        } catch(e) {
            console.error("❌ Failed sending Daily Delivery data.", e.message);
        }
    }

    console.log("🎉 Migration Script Finished!");
    console.log("Backend Sync Engine will now pick up the changes and upsert to Neon DB.");
}

main().catch(console.error);
