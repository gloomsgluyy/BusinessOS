import { PrismaClient } from '@prisma/client';

export async function seedMarketPrice(prisma: PrismaClient) {
  console.log('Seeding MarketPrice...');
  const data = Array.from({ length: 10 }).map((_, i) => ({
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * i),
    ici1: 100 + i,
    ici2: 90 + i,
    ici3: 80 + i,
    ici4: 70 + i,
    ici5: 60 + i,
    newcastle: 150 + i,
    hba: 120 + i,
  }));
  for (const item of data) {
    await prisma.marketPrice.create({ data: item });
  }
  console.log('MarketPrice seeded successfully.');
}
