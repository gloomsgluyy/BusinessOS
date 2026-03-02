const { PrismaClient } = require('@prisma/client');
const { google } = require('googleapis');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const prisma = new PrismaClient();

async function syncMarketPricesOnly() {
    console.log("=== SYNCING MARKET PRICES TO GOOGLE SHEETS ===");

    try {
        const prices = await prisma.marketPrice.findMany({
            where: { isDeleted: false },
            orderBy: { date: 'desc' }
        });

        console.log(`Found ${prices.length} market price records.`);

        const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS);
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
        const SHEET_NAME = "Market Price";

        const rows = prices.map(m => [
            m.id,
            m.date.toISOString().split('T')[0],
            m.ici1 || 0,
            m.ici2 || 0,
            m.ici3 || 0,
            m.ici4 || 0,
            m.ici5 || 0,
            m.newcastle || 0,
            m.hba || 0,
            m.source || "-",
            m.updatedAt.toISOString()
        ]);

        // Clear first
        await sheets.spreadsheets.values.clear({
            spreadsheetId,
            range: `${SHEET_NAME}!A2:K1000`
        });

        if (rows.length > 0) {
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${SHEET_NAME}!A2`,
                valueInputOption: "USER_ENTERED",
                requestBody: { values: rows }
            });
            console.log(`✅ Successfully synced ${rows.length} rows to '${SHEET_NAME}'.`);
        } else {
            console.log("No rows to sync.");
        }

    } catch (err) {
        console.error("Sync Error:", err);
    } finally {
        await prisma.$disconnect();
    }
}

syncMarketPricesOnly();
