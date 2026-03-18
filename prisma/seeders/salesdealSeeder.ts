import { PrismaClient } from '@prisma/client';

export async function seedSalesDeal(prisma: PrismaClient) {
  console.log('Seeding SalesDeal...');
  const data = Array.from({ length: 10 }).map((_, i) => ({
    dealNumber: 'SD-' + 1000 + i,
    status: 'pre_sale',
    buyer: 'Buyer ' + (i + 1),
    shippingTerms: 'FOB',
    quantity: 50000 * (i + 1),
    createdBy: 'user1',
  }));
  for (const item of data) {
    await prisma.salesDeal.upsert({
      where: { dealNumber: item.dealNumber },
      update: item,
      create: item,
    });
  }
  console.log('SalesDeal seeded successfully.');
}
