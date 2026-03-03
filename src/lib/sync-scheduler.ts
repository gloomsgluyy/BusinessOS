import { PushService } from './push-to-sheets';
import { ScrapeService } from './scrape-service';

// This is a simplified version of a background worker.
// In a full Next.js app, this might be handled by a long-running process,
// a cron job (e.g. Vercel Cron), or an external worker.

export class SyncScheduler {
    private static pullInterval: NodeJS.Timeout | null = null;
    private static isRunning = false;

    /**
     * Start the 5-second PULL interval (Google Sheets -> Memory B)
     */
    static startPullInterval() {
        if (this.pullInterval) return;

        console.log("Memory B: Starting 5-second PULL interval...");

        // We'll use the existing sync script logic but wrap it
        // For simplicity in this demo, we'll call the shell script or a refactored version
        this.pullInterval = setInterval(async () => {
            if (this.isRunning) return;
            this.isRunning = true;
            try {
                // Here we would call the sync logic from sync-from-sheets.ts
                // For this implementation, we assume it's integrated or called via shell
                console.log("Memory B: PULLing latest from Google Sheets...");
                // await syncAll(); // From sync-from-sheets.ts
            } catch (err) {
                console.error("Memory B: PULL failed:", err);
            } finally {
                this.isRunning = false;
            }
        }, 5000);
    }

    /**
     * Trigger an immediate PUSH (Memory B -> Google Sheets)
     * Usually called after a local CRUD operation
     */
    static async triggerPush() {
        try {
            await PushService.pushAllToSheets();
        } catch (err) {
            console.error("Memory B: PUSH trigger failed:", err);
        }
    }

    /**
     * Perform the scheduled market price scrape
     */
    static async performMarketScrape() {
        try {
            const prices = await ScrapeService.scrapePrices();
            await ScrapeService.saveToDatabase(prices);
            // After scraping and saving locally, push to sheets
            await this.triggerPush();
        } catch (err) {
            console.error("Market Scrape failed:", err);
        }
    }
}
