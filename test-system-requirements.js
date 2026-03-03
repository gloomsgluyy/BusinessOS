require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

async function testIntegration() {
    console.log("=== STARTING INTEGRATION TEST (FIXED) ===");

    try {
        // Dynamic imports for ESM modules
        const { ScrapeService } = await import('./src/lib/scrape-service.js');
        const { PushService } = await import('./src/lib/push-to-sheets.js');

        // 1. Test Scraping
        console.log("\nStep 1: Testing ScrapeService...");
        const prices = await ScrapeService.scrapePrices(1);
        console.log("Scraped Prices:", JSON.stringify(prices, null, 2));

        // 2. Test DB Saving
        console.log("\nStep 2: Saving to Local Database (Memory B)...");
        const saved = await ScrapeService.saveToDatabase(prices);
        console.log("Saved Record ID:", saved.id);

        // 3. Test Push to Sheets
        console.log("\nStep 3: Pushing to Google Sheets...");
        await PushService.pushAllToSheets();
        console.log("✅ Push successful.");

        console.log("\n=== INTEGRATION TEST SUCCESSFUL ===");
    } catch (err) {
        console.error("\n❌ INTEGRATION TEST FAILED:", err.message);
        process.exit(1);
    }
}

testIntegration();
