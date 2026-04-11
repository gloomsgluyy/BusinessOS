const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    console.log('--- Database Verification Report ---');
    const partners = await prisma.partner.count();
    const shipments = await prisma.shipmentDetail.count();
    const deals = await prisma.salesDeal.count();
    const delivery = await prisma.dailyDelivery.count();
    const revenue = await prisma.salesDeal.aggregate({
        _sum: { totalValue: true }
    });

    console.log({
        partners,
        shipments,
        deals, // Each unique SD-YEAR-NO
        delivery, // From recap file
        totalRevenue: revenue._sum.totalValue
    });

    // Check a few samples
    const sampleDeal = await prisma.salesDeal.findFirst({
        where: { status: 'confirmed' }
    });
    console.log('\nSample SalesDeal:', sampleDeal);

    const sampleShipment = await prisma.shipmentDetail.findFirst();
    console.log('\nSample ShipmentDetail:', sampleShipment);

    await prisma.$disconnect();
}

check().catch(console.error);
