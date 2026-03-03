
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testForecast() {
    console.log('--- Testing P&L Forecast Backend Logic ---');

    try {
        // 1. Create a dummy forecast with camelCase fields (simulating fixed API body)
        const testData = {
            dealId: 'test-deal-id',
            dealNumber: 'SD-TEST-001',
            projectName: 'Test Project',
            buyer: 'Test Buyer',
            type: 'export',
            status: 'forecast',
            quantity: 50000,
            sellingPrice: 75.5,
            buyingPrice: 60.0,
            freightCost: 10.0,
            otherCost: 2.5,
            grossProfitMt: 3.0,
            totalGrossProfit: 150000,
            createdBy: 'system-test'
        };

        console.log('Creating test forecast...');
        const created = await prisma.pLForecast.create({
            data: testData
        });

        console.log('Created ID:', created.id);
        console.log('Verifying fields...');

        if (created.buyingPrice === 60.0 && created.freightCost === 10.0 && created.otherCost === 2.5) {
            console.log('✅ Fields saved correctly (buyingPrice, freightCost, otherCost)');
        } else {
            console.error('❌ Field mismatch!', {
                buyingPrice: created.buyingPrice,
                freightCost: created.freightCost,
                otherCost: created.otherCost
            });
        }

        // 2. Test Update (simulating PUT request)
        console.log('Updating test forecast costs...');
        const updated = await prisma.pLForecast.update({
            where: { id: created.id },
            data: {
                buyingPrice: 62.0,
                freightCost: 11.0,
                otherCost: 3.0,
                grossProfitMt: -0.5, // 75.5 - 62 - 11 - 3
                totalGrossProfit: -25000
            }
        });

        if (updated.buyingPrice === 62.0 && updated.totalGrossProfit === -25000) {
            console.log('✅ Update persisted correctly');
        } else {
            console.error('❌ Update failed!');
        }

        // Cleanup
        await prisma.pLForecast.delete({ where: { id: created.id } });
        console.log('Cleanup complete.');
        console.log('--- Backend Verification SUCCESS ---');

    } catch (err) {
        console.error('--- Backend Verification FAILED ---');
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

testForecast();
