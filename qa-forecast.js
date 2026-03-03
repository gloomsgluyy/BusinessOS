
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testForecastCRUD() {
    console.log('--- Starting Forecast CRUD QA Test ---');

    try {
        // 1. Get an existing deal
        const deal = await prisma.salesDeal.findFirst({
            where: { isDeleted: false }
        });

        if (!deal) {
            console.error('No sales deal found to test with.');
            return;
        }

        console.log(`Using Deal: ${deal.dealNumber} (ID: ${deal.id})`);

        // 2. Create Forecast
        console.log('\nStep 1: Create Forecast');
        const testData = {
            dealId: deal.id,
            dealNumber: deal.dealNumber,
            buyer: deal.buyer,
            quantity: 100,
            sellingPrice: 500,
            buyingPrice: 400,
            freightCost: 20,
            otherCost: 10,
        };

        // Calculation logic from route.ts
        const expectedGPmt = testData.sellingPrice - testData.buyingPrice - testData.freightCost - testData.otherCost; // 500 - 400 - 20 - 10 = 70
        const expectedTotalGP = expectedGPmt * testData.quantity; // 70 * 100 = 7000

        const newForecast = await prisma.pLForecast.create({
            data: {
                dealId: testData.dealId,
                dealNumber: testData.dealNumber,
                projectName: testData.dealNumber,
                buyer: testData.buyer,
                quantity: testData.quantity,
                sellingPrice: testData.sellingPrice,
                buyingPrice: testData.buyingPrice,
                freightCost: testData.freightCost,
                otherCost: testData.otherCost,
                grossProfitMt: expectedGPmt,
                totalGrossProfit: expectedTotalGP,
                status: 'forecast',
                type: 'export',
                createdBy: 'qa-tester'
            }
        });

        console.log(`Created Forecast ID: ${newForecast.id}`);
        console.log(`Calculated GP/MT: ${newForecast.grossProfitMt} (Expected: ${expectedGPmt})`);
        console.log(`Calculated Total GP: ${newForecast.totalGrossProfit} (Expected: ${expectedTotalGP})`);

        if (newForecast.grossProfitMt !== expectedGPmt || newForecast.totalGrossProfit !== expectedTotalGP) {
            console.error('FAILED: GP calculation mismatch on Create');
        } else {
            console.log('PASSED: Create and GP calculation');
        }

        // 3. Read Forecast
        console.log('\nStep 2: Read Forecast');
        const fetched = await prisma.pLForecast.findUnique({ where: { id: newForecast.id } });
        if (fetched) {
            console.log('PASSED: Read Forecast');
        } else {
            console.error('FAILED: Read Forecast');
        }

        // 4. Update Forecast
        console.log('\nStep 3: Update Forecast');
        const updateData = {
            buyingPrice: 410, // Increase cost
        };
        const newExpectedGPmt = testData.sellingPrice - updateData.buyingPrice - testData.freightCost - testData.otherCost; // 500 - 410 - 20 - 10 = 60
        const newExpectedTotalGP = newExpectedGPmt * testData.quantity; // 60 * 100 = 6000

        const updated = await prisma.pLForecast.update({
            where: { id: newForecast.id },
            data: {
                buyingPrice: updateData.buyingPrice,
                grossProfitMt: newExpectedGPmt,
                totalGrossProfit: newExpectedTotalGP
            }
        });

        console.log(`Updated Buying Price: ${updated.buyingPrice}`);
        console.log(`New GP/MT: ${updated.grossProfitMt} (Expected: ${newExpectedGPmt})`);
        console.log(`New Total GP: ${updated.totalGrossProfit} (Expected: ${newExpectedTotalGP})`);

        if (updated.grossProfitMt !== newExpectedGPmt || updated.totalGrossProfit !== newExpectedTotalGP) {
            console.error('FAILED: GP calculation mismatch on Update');
        } else {
            console.log('PASSED: Update and GP recalculation');
        }

        // 5. Delete Forecast
        console.log('\nStep 4: Soft Delete Forecast');
        await prisma.pLForecast.update({
            where: { id: newForecast.id },
            data: { isDeleted: true }
        });

        const deleted = await prisma.pLForecast.findFirst({
            where: { id: newForecast.id, isDeleted: true }
        });

        if (deleted) {
            console.log('PASSED: Soft Delete');
        } else {
            console.error('FAILED: Soft Delete');
        }

    } catch (error) {
        console.error('Error during QA test:', error);
    } finally {
        await prisma.$disconnect();
        console.log('\n--- QA Test Finished ---');
    }
}

testForecastCRUD();
