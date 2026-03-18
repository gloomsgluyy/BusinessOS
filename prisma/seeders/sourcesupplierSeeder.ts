import { PrismaClient } from '@prisma/client';

export async function seedSourceSupplier(prisma: PrismaClient) {
  console.log('Seeding SourceSupplier...');
  const data = Array.from({ length: 10 }).map((_, i) => ({
    name: 'Supplier ' + (i + 1),
    region: 'Region ' + (1 + (i % 3)),
    stockAvailable: (i + 1) * 1000,
  }));
  for (const item of data) {
    await prisma.sourceSupplier.create({ data: item });
  }
  console.log('SourceSupplier seeded successfully.');
}
