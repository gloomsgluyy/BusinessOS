import { PrismaClient } from '@prisma/client';

export async function seedPartner(prisma: PrismaClient) {
  console.log('Seeding Partner...');
  const data = Array.from({ length: 10 }).map((_, i) => ({
    name: 'Partner ' + (i + 1),
    type: i % 2 === 0 ? 'buyer' : 'vendor',
    contactPerson: 'Contact ' + (i + 1),
    email: 'contact' + (i + 1) + '@partner.com',
  }));
  for (const item of data) {
    await prisma.partner.create({ data: item });
  }
  console.log('Partner seeded successfully.');
}
