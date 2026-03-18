import { PrismaClient } from '@prisma/client';

export async function seedBlendingSimulation(prisma: PrismaClient) {
  console.log('Seeding BlendingSimulation...');
  const data = Array.from({ length: 10 }).map((_, i) => ({
    inputs: JSON.stringify([{name: 'Coal A', quantity: 1000, gar: 4000}]),
    totalQuantity: 1000,
    resultGar: 4000,
    createdBy: 'user1',
  }));
  for (const item of data) {
    await prisma.blendingSimulation.create({ data: item });
  }
  console.log('BlendingSimulation seeded successfully.');
}
