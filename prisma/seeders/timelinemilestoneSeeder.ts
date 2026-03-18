import { PrismaClient } from '@prisma/client';

export async function seedTimelineMilestone(prisma: PrismaClient) {
  console.log('Seeding TimelineMilestone...');
  const shipments = await prisma.shipmentDetail.findMany({ take: 10 });
  if (shipments.length === 0) return;
  const data = Array.from({ length: 10 }).map((_, i) => ({
    shipmentId: shipments[i % shipments.length].id,
    title: 'Milestone ' + (i + 1),
    date: new Date(),
    description: 'Description for milestone ' + (i + 1),
  }));
  for (const item of data) {
    await prisma.timelineMilestone.create({ data: item });
  }
  console.log('TimelineMilestone seeded successfully.');
}
