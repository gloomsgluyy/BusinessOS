import { PrismaClient } from '@prisma/client';

export async function seedSyncState(prisma: PrismaClient) {
  console.log('Seeding SyncState...');
  const existing = await prisma.syncState.findFirst({ where: { id: 'singleton' } });
  if (!existing) {
    await prisma.syncState.create({
      data: {
        id: 'singleton',
        lastSyncTime: new Date()
      }
    });
  }
  console.log('SyncState seeded successfully.');
}
