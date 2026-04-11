const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const deals = await prisma.salesDeal.count();
    const shipments = await prisma.shipmentDetail.count();
    const activeDeals = await prisma.salesDeal.findMany({
      where: { status: 'confirmed', isDeleted: false },
      take: 5
    });
    
    console.log('--- DB Stats ---');
    console.log('Total SalesDeal:', deals);
    console.log('Total ShipmentDetail:', shipments);
    console.log('Active Confirmed Deals Sample:', JSON.stringify(activeDeals, null, 2));

    const totalQty = activeDeals.reduce((sum, d) => sum + (d.quantity || 0), 0);
    console.log('Qty Sample Sum:', totalQty);
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
