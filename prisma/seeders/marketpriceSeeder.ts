import { PrismaClient } from '@prisma/client';

export async function seedMarketPrice(prisma: PrismaClient) {
  console.log('Seeding MarketPrice...');
  const data = Array.from({ length: 30 }).map((_, i) => ({
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * i),
    ici1: 130.5 - (i * 0.5),
    ici2: 95.0 - (i * 0.3),
    ici3: 75.2 - (i * 0.2),
    ici4: 55.4 - (i * 0.1),
    ici5: 40.1 - (i * 0.05),
    newcastle: 135.0 - (i * 0.4),
    hba: 110.0 - (i * 0.3),
    hbaI: 105.0 - (i * 0.25),
    hbaII: 85.0 - (i * 0.2),
    hbaIII: 55.0 - (i * 0.15),
    source: "Seeder (Realistic Dummy)"
  }));
  for (const item of data) {
    await prisma.marketPrice.create({ data: item });
  }
  console.log(`MarketPrice seeded successfully with ${data.length} records.`);
}