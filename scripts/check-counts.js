const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const tables = [
    'shipmentDetail', 'dailyDelivery', 'marketPrice',
    'outstandingPayment', 'sourceSupplier', 'qualityResult',
    'salesDeal', 'salesOrder', 'purchaseRequest',
    'pLForecast', 'partner', 'blendingSimulation'
  ];
  
  console.log('=== CURRENT DB COUNTS ===');
  for (const t of tables) {
    try {
      const c = await p[t].count();
      console.log(`  ${t}: ${c}`);
    } catch (e) {
      console.log(`  ${t}: ERROR - ${e.message.substring(0, 50)}`);
    }
  }
  await p.$disconnect();
}

main();
