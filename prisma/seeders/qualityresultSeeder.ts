import { PrismaClient } from '@prisma/client';

export async function seedQualityResult(prisma: PrismaClient) {
  console.log('Seeding QualityResult...');
  const data = Array.from({ length: 10 }).map((_, i) => ({
    cargoId: 'cargo-' + i,
    cargoName: 'Cargo ' + (i + 1),
    surveyor: 'Surveyor ' + (1 + (i % 2)),
    gar: 4000 + (i * 100),
    ts: 0.5 + (i * 0.1),
    ash: 5 + i,
    tm: 30 - i,
  }));
  for (const item of data) {
    await prisma.qualityResult.create({ data: item });
  }
  console.log('QualityResult seeded successfully.');
}
