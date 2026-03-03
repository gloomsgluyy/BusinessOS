export { };
const { PullService } = require('./sync-from-sheets');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const startSyncManager = async () => {
    console.log("🚀 STARTING MEMORY B SYNC MANAGER (CJS Mode)...");

    // 1. Initial Pull
    try {
        await PullService.syncAll();
    } catch (e) {
        console.error("Initial Sync failed:", e);
    }

    // 2. Start Polling (PULL every 30 seconds by default to stay within quota)
    const SYNC_INTERVAL = parseInt(process.env.SYNC_INTERVAL_MS || "30000");

    setInterval(async () => {
        try {
            await PullService.syncAll();
        } catch (e) {
            console.error("Interval Pull failed:", e);
        }
    }, SYNC_INTERVAL);

    console.log(`Memory B Sync Manager is now running (Interval: ${SYNC_INTERVAL / 1000}s). Press Ctrl+C to stop.`);
};

startSyncManager().catch(err => {
    console.error("Sync Manager crashed:", err);
});
