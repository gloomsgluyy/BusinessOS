import { PrismaClient } from '@prisma/client';

export async function seedSession(prisma: PrismaClient) {
  console.log('Seeding Session...');
  const users = await prisma.user.findMany({ take: 10 });
  if (users.length === 0) return;
  const data = users.map((u, i) => ({
    sessionToken: 'sess-token-' + u.id + '-' + i,
    userId: u.id,
    expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
  }));
  for (const item of data) {
    await prisma.session.upsert({
      where: { sessionToken: item.sessionToken },
      update: item,
      create: item,
    });
  }
  console.log('Session seeded successfully.');
}
