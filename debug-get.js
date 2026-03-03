
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugGetForecasts() {
    console.log('--- Debugging GET /api/memory/pl-forecasts ---');
    try {
        const forecasts = await prisma.pLForecast.findMany({
            where: { isDeleted: false },
            orderBy: { createdAt: 'desc' }
        });
        console.log('Successfully fetched forecasts:', forecasts.length);
        console.log('Sample forecast:', JSON.stringify(forecasts[0], null, 2));
    } catch (err) {
        console.error('Prisma Error:', err);
    } finally {
        await prisma.$disconnect();
    }
}

debugGetForecasts();
