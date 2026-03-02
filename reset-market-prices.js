const { PrismaClient } = require("@prisma/client");
const { google } = require('googleapis');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const prisma = new PrismaClient();

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

async function reset() {
    console.log("=== RESETTING MARKET PRICE DATA ===");

    try {
        // 1. Delete from Prisma
        console.log("Deleting MarketPrice records from database...");
        const deleted = await prisma.marketPrice.deleteMany({});
        console.log(`Deleted ${deleted.count} records from Prisma.`);

        // 2. Clear Google Sheet
        console.log("Clearing 'Market Price' tab in Google Sheets...");
        const sheets = await getSheets();
        const sid = process.env.GOOGLE_SHEETS_ID;
        await sheets.spreadsheets.values.clear({
            spreadsheetId: sid,
            range: "Market Price!A2:K1000"
        });
        console.log("Google Sheet 'Market Price' cleared.");

        console.log("=== RESET COMPLETE ===");
    } catch (err) {
        console.error("Reset Error:", err);
    } finally {
        await prisma.$disconnect();
    }
}

reset();
