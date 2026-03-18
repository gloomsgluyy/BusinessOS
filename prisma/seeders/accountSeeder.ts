import { PrismaClient } from '@prisma/client';

export async function seedAccount(prisma: PrismaClient) {
  console.log('Seeding Account...');
  const users = await prisma.user.findMany({ take: 10 });
  if (users.length === 0) { console.log('No users found, skipping Account seeding.'); return; }
  const data = users.map((u, i) => ({
    userId: u.id,
    type: 'oauth',
    provider: 'google',
    providerAccountId: 'prov-acc-' + u.id,
  }));
  for (const item of data) {
    const existing = await prisma.account.findFirst({ where: { providerAccountId: item.providerAccountId } });
    if(!existing) await prisma.account.create({ data: item });
  }
  console.log('Account seeded successfully.');
}
