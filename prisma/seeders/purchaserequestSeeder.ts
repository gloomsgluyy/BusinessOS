import { PrismaClient } from '@prisma/client';

export async function seedPurchaseRequest(prisma: PrismaClient) {
  console.log('Seeding PurchaseRequest...');
  const data = Array.from({ length: 10 }).map((_, i) => ({
    requestNumber: 'PR-' + 1000 + i,
    category: 'Equipment',
    supplier: 'Supplier ' + (i + 1),
    description: 'Purchase request description ' + (i + 1),
    amount: (i + 1) * 500,
    createdBy: 'user1',
  }));
  for (const item of data) {
    await prisma.purchaseRequest.upsert({
      where: { requestNumber: item.requestNumber },
      update: item,
      create: item,
    });
  }
  console.log('PurchaseRequest seeded successfully.');
}
