import { PrismaClient } from '@prisma/client';

export async function seedShipmentDetail(prisma: PrismaClient) {
  console.log('Seeding ShipmentDetail...');
  const data = Array.from({ length: 10 }).map((_, i) => ({
    shipmentNumber: 'SHP-' + 1000 + i,
    status: 'draft',
    buyer: 'Buyer ' + (i + 1),
    supplier: 'Supplier ' + (i + 1),
    quantityLoaded: (i + 1) * 10000,
  }));
  for (const item of data) {
    await prisma.shipmentDetail.upsert({
      where: { shipmentNumber: item.shipmentNumber },
      update: item,
      create: item,
    });
  }
  console.log('ShipmentDetail seeded successfully.');
}
