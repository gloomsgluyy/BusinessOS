import { PrismaClient } from '@prisma/client';

export async function seedUser(prisma: PrismaClient) {
  console.log('Seeding User...');
  const data = Array.from({ length: 10 }).map((_, i) => ({
    name: 'User ' + (i + 1),
    email: 'user' + (i + 1) + '@example.com',
    role: i === 0 ? 'CEO' : i === 1 ? 'MANAGER' : 'STAFF'
  }));
  for (const item of data) {
    await prisma.user.upsert({
      where: { email: item.email },
      update: item,
      create: item,
    });
  }
  console.log('User seeded successfully.');
}
