/**
 * Manual Sync Test - Pull data from Google Sheets
 * 
 * This script will manually trigger a sync from Google Sheets to Database
 * to verify that existing data in Sheets is being read correctly
 */

require('dotenv').config();
const { PullService } = require('./sync-from-sheets.cjs');

async function testManualSync() {
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║  MANUAL SYNC TEST: Google Sheets → Database              ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    console.log('📊 This will:');
    console.log('1. Read all data from Google Sheets');
    console.log('2. Update the local database cache');
    console.log('3. Show you what data was synced\n');

    console.log('⏳ Starting sync from Google Sheets...\n');

    try {
        await PullService.syncAll();
        
        console.log('\n✅ SYNC COMPLETED SUCCESSFULLY!\n');
        console.log('📋 Next steps:');
        console.log('1. Check your application - data should now appear');
        console.log('2. Refresh the P&L Forecast page in your browser');
        console.log('3. Verify the data matches what\'s in Google Sheets\n');

    } catch (error) {
        console.error('\n❌ SYNC FAILED!');
        console.error('Error:', error.message);
        console.error('\nTroubleshooting:');
        console.error('1. Check GOOGLE_SHEETS_ID in .env');
        console.error('2. Check GOOGLE_SHEETS_CREDENTIALS in .env');
        console.error('3. Verify tab name is exactly "P&L Forecast"');
        console.error('4. Check column headers match: ID, Project / Buyer, Quantity, etc.\n');
        process.exit(1);
    }
}

// Verify environment variables
console.log('🔍 Checking environment configuration...\n');

if (!process.env.GOOGLE_SHEETS_ID) {
    console.error('❌ ERROR: GOOGLE_SHEETS_ID not found in .env');
    process.exit(1);
}

if (!process.env.GOOGLE_SHEETS_CREDENTIALS) {
    console.error('❌ ERROR: GOOGLE_SHEETS_CREDENTIALS not found in .env');
    process.exit(1);
}

console.log('✅ Environment variables found');
console.log(`📄 Spreadsheet ID: ${process.env.GOOGLE_SHEETS_ID.substring(0, 20)}...`);
console.log('🔑 Credentials: Configured\n');

// Run sync
testManualSync()
    .then(() => {
        console.log('✅ Test completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    });
