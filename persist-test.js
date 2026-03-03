
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setupTestData() {
    console.log('--- Setting up Clean Test Data ---');

    try {
        // 1. Create a valid Sales Deal
        const deal = await prisma.salesDeal.create({
            data: {
                dealNumber: 'QA-' + Date.now(),
                buyer: 'QA Test Buyer',
                buyerCountry: 'Indonesia',
                type: 'export',
                quantity: 100,
                pricePerMt: 120,
                totalValue: 12000,
                status: 'confirmed',
                picName: 'QA Tester',
                createdBy: 'qa-tester'
            }
        });
        console.log('Created Deal:', deal.id);

        // 2. Create a Forecast linked to it
        const forecast = await prisma.pLForecast.create({
            data: {
                dealId: deal.id,
                dealNumber: deal.dealNumber,
                projectName: 'QA Project ' + deal.dealNumber,
                buyer: deal.buyer,
                quantity: deal.quantity,
                sellingPrice: deal.pricePerMt,
                buyingPrice: 80,
                freightCost: 10,
                otherCost: 5,
                grossProfitMt: 25, // 120 - 80 - 10 - 5
                totalGrossProfit: 2500, // 25 * 100
                status: 'forecast',
                type: 'export',
                createdBy: 'qa-tester'
            }
        });
        console.log('Created Forecast:', forecast.id);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

setupTestData();
