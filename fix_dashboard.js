const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function run() {
    console.log('Menghapus data Sales Deal & Shipment Error 100x (Dashboard Cleanup)...');

    // Clean up Sales Deals with inflated prices
    const deletedDeals = await p.salesDeal.deleteMany({
        where: { OR: [{ pricePerMt: { gt: 1000 } }, { totalValue: { gt: 10000000 } }] }
    });
    console.log(`Berhasil menghapus ${deletedDeals.count} baris Sales Deal yang error (inflasi)!`);

    // Clean up Shipments with inflated margins
    const deletedShipments = await p.shipmentDetail.deleteMany({
        where: { OR: [{ marginMt: { gt: 1000 } }, { salesPrice: { gt: 1000 } }] }
    });
    console.log(`Berhasil menghapus ${deletedShipments.count} baris Shipment yang error (inflasi)!`);
}
run().catch(console.error).finally(() => p.$disconnect());
