import { PrismaClient } from '@prisma/client';

export async function seedVerificationToken(prisma: PrismaClient) {
  console.log('Seeding VerificationToken...');
  const data = Array.from({ length: 10 }).map((_, i) => ({
    identifier: 'user' + (i + 1) + '@example.com',
    token: 'verify-token-' + i,
    expires: new Date(Date.now() + 1000 * 60 * 60 * 24),
  }));
  for (const item of data) {
    await prisma.verificationToken.upsert({
      where: { token: item.token },
      update: item,
      create: item,
    });
  }
  console.log('VerificationToken seeded successfully.');
}
