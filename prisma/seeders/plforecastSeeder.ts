import { PrismaClient } from '@prisma/client';

export async function seedPLForecast(prisma: PrismaClient) {
  console.log('Seeding PLForecast...');
  const data = Array.from({ length: 10 }).map((_, i) => ({
    dealId: 'deal-' + i,
    dealNumber: 'DL-' + 1000 + i,
    projectName: 'Project ' + (i + 1),
    buyer: 'Buyer ' + (i + 1),
    quantity: 50000 + (i * 5000),
    sellingPrice: 80 + i,
    buyingPrice: 60 + i,
    freightCost: 10 + i,
    otherCost: 2 + i,
    grossProfitMt: 8,
    totalGrossProfit: 8 * (50000 + (i * 5000)),
  }));
  for (const item of data) {
    await prisma.pLForecast.create({ data: item });
  }
  console.log('PLForecast seeded successfully.');
}
