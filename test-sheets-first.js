/**
 * Test Script: Spreadsheet-First Architecture
 * 
 * This script tests the new Sheet-first write pattern for P&L Forecasts
 */

require('dotenv').config();
const { SheetsFirstService } = require('./src/lib/sheets-first-service.ts');

async function testCreate() {
    console.log('\n=== TEST 1: Create P&L Forecast ===');
    try {
        const testData = {
            buyer: 'Test Buyer - Sheet First Architecture',
            quantity: 10000,
            sellingPrice: 75.50,
            buyingPrice: 65.00,
            freightCost: 3.50,
            otherCost: 1.00,
            grossProfitMt: 6.00,
            totalGrossProfit: 60000,
            type: 'export',
            status: 'forecast',
            createdBy: 'test-user'
        };

        console.log('Creating forecast with data:', testData);
        const result = await SheetsFirstService.createPLForecast(testData);
        console.log('✅ CREATE SUCCESS');
        console.log('Result:', result);
        return result.id;
    } catch (error) {
        console.error('❌ CREATE FAILED:', error.message);
        throw error;
    }
}

async function testUpdate(id) {
    console.log('\n=== TEST 2: Update P&L Forecast ===');
    try {
        const updateData = {
            buyingPrice: 66.50,  // Update buying price
            freightCost: 3.75,   // Update freight cost
        };

        console.log(`Updating forecast ${id} with:`, updateData);
        const result = await SheetsFirstService.updatePLForecast(id, updateData);
        console.log('✅ UPDATE SUCCESS');
        console.log('Result:', result);
        return true;
    } catch (error) {
        console.error('❌ UPDATE FAILED:', error.message);
        throw error;
    }
}

async function testRead(id) {
    console.log('\n=== TEST 3: Read P&L Forecast ===');
    try {
        console.log(`Reading forecast ${id}...`);
        const result = await SheetsFirstService.getPLForecast(id);
        console.log('✅ READ SUCCESS');
        console.log('Result:', result);
        return true;
    } catch (error) {
        console.error('❌ READ FAILED:', error.message);
        throw error;
    }
}

async function testDelete(id) {
    console.log('\n=== TEST 4: Delete P&L Forecast ===');
    try {
        console.log(`Deleting forecast ${id}...`);
        await SheetsFirstService.deletePLForecast(id);
        console.log('✅ DELETE SUCCESS');
        return true;
    } catch (error) {
        console.error('❌ DELETE FAILED:', error.message);
        throw error;
    }
}

async function testList() {
    console.log('\n=== TEST 5: List P&L Forecasts ===');
    try {
        console.log('Fetching all forecasts...');
        const results = await SheetsFirstService.listPLForecasts();
        console.log(`✅ LIST SUCCESS - Found ${results.length} forecasts`);
        if (results.length > 0) {
            console.log('Sample:', results[0]);
        }
        return true;
    } catch (error) {
        console.error('❌ LIST FAILED:', error.message);
        throw error;
    }
}

async function runTests() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  SPREADSHEET-FIRST ARCHITECTURE - INTEGRATION TESTS       ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    let testId = null;
    let passedTests = 0;
    const totalTests = 5;

    try {
        // Test 1: Create
        testId = await testCreate();
        passedTests++;

        // Wait a bit for Sheet to be updated
        console.log('\n⏳ Waiting 2 seconds for Sheet propagation...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test 2: Update
        await testUpdate(testId);
        passedTests++;

        // Wait a bit for Sheet to be updated
        console.log('\n⏳ Waiting 2 seconds for Sheet propagation...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test 3: Read
        await testRead(testId);
        passedTests++;

        // Test 4: List
        await testList();
        passedTests++;

        // Test 5: Delete
        await testDelete(testId);
        passedTests++;

        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log(`║  TEST RESULTS: ${passedTests}/${totalTests} PASSED ${passedTests === totalTests ? '✅' : '⚠️'}                      ║`);
        console.log('╚════════════════════════════════════════════════════════════╝');

        if (passedTests === totalTests) {
            console.log('\n🎉 ALL TESTS PASSED! Spreadsheet-First Architecture is working!');
        } else {
            console.log('\n⚠️  Some tests failed. Check the logs above.');
        }

    } catch (error) {
        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log(`║  TEST RESULTS: ${passedTests}/${totalTests} PASSED ❌                      ║`);
        console.log('╚════════════════════════════════════════════════════════════╝');
        console.error('\n❌ TEST SUITE FAILED');
        console.error('Error:', error.message);
        process.exit(1);
    }
}

// Verification Instructions
console.log('\n📋 MANUAL VERIFICATION STEPS:');
console.log('1. After running this test, open your Google Sheet');
console.log('2. Verify that a test record was created and then deleted');
console.log('3. Check the "P&L Forecast" tab for the operations');
console.log('4. The test data should appear briefly, then be removed');
console.log('5. This confirms Sheet-first writes are working!\n');

// Run tests
runTests()
    .then(() => {
        console.log('\n✅ Test execution completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Test execution failed:', error);
        process.exit(1);
    });
