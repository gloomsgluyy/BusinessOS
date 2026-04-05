const { PullService } = require('./sync-from-sheets.cjs');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const startSyncManager = async () => {
    // DATABASE-FIRST MODE: Auto-sync is now DISABLED by default
    // Set ENABLE_SHEETS_SYNC=true in .env to enable sync (for migration/backup purposes only)
    const ENABLE_SYNC = process.env.ENABLE_SHEETS_SYNC === 'true';
    
    if (!ENABLE_SYNC) {
        console.log("⚠️  SHEETS SYNC DISABLED - Database-First Mode Active");
        console.log("📊 Database is now the source of truth");
        console.log("💡 To enable sync temporarily, set ENABLE_SHEETS_SYNC=true in .env");
        console.log("🛑 Sync Manager will not start. Exiting...");
        return;
    }

    console.log("🚀 STARTING MEMORY B SYNC MANAGER (CJS Mode)...");
    console.log("⚠️  WARNING: Sheets sync is ENABLED - only use for migration/export");

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
