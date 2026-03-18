import { PrismaClient } from '@prisma/client';

export async function seedSalesOrder(prisma: PrismaClient) {
  console.log('Seeding SalesOrder...');
  const data = Array.from({ length: 10 }).map((_, i) => ({
    orderNumber: 'SO-' + 1000 + i,
    client: 'Client ' + (i + 1),
    description: 'Sales order description ' + (i + 1),
    amount: (i + 1) * 1000,
    priority: i % 2 === 0 ? 'medium' : 'high',
    status: 'pending',
    createdBy: 'user1',
  }));
  for (const item of data) {
    await prisma.salesOrder.upsert({
      where: { orderNumber: item.orderNumber },
      update: item,
      create: item,
    });
  }
  console.log('SalesOrder seeded successfully.');
}
