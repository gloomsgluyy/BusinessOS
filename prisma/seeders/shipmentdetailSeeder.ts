import { PrismaClient } from '@prisma/client';

export async function seedShipmentDetail(prisma: PrismaClient) {
  console.log('Seeding ShipmentDetail...');
  const data = Array.from({ length: 10 }).map((_, i) => ({
    no: i + 1,
    exportDmo: i % 2 === 0 ? 'EXPORT' : 'DMO',
    status: 'upcoming',
    origin: ['KALSEL', 'KALTIM', 'SUMSEL'][i % 3],
    mvProjectName: 'MV Project ' + (i + 1),
    source: ['BME', 'GAT01', 'SERELO'][i % 3],
    iupOp: 'PT Coal Mining ' + (i + 1),
    qtyPlan: (i + 1) * 10000,
    year: 2026,
  }));
  for (const item of data) {
    await prisma.shipmentDetail.create({
      data: item,
    });
  }
  console.log('ShipmentDetail seeded successfully.');
}
