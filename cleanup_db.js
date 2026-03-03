
const prisma = require('./src/lib/prisma').default;

async function run() {
    try {
        console.log("Cleaning up corrupted records...");

        // --- 1. Shipments ---
        const shipments = await prisma.shipmentDetail.findMany({ where: { isDeleted: false } });
        for (const s of shipments) {
            if (s.id.startsWith('SH-') || s.id.startsWith('SHP-')) {
                console.log(`Deleting corrupted Shipment: ${s.id}`);
                await prisma.shipmentDetail.delete({ where: { id: s.id } });
            }
        }

        // --- 2. Projects (SalesDeal) ---
        const deals = await prisma.salesDeal.findMany({ where: { isDeleted: false } });
        for (const d of deals) {
            if (d.id.startsWith('DEAL-')) {
                console.log(`Deleting corrupted Deal: ${d.id}`);
                await prisma.salesDeal.delete({ where: { id: d.id } });
            }
        }

        // --- 3. SalesOrders ---
        const orders = await prisma.salesOrder.findMany({ where: { isDeleted: false } });
        for (const o of orders) {
            if (o.id.startsWith('SO-')) {
                console.log(`Deleting corrupted Sales Order: ${o.id}`);
                await prisma.salesOrder.delete({ where: { id: o.id } });
            }
        }

        console.log("Cleanup complete.");
    } catch (e) {
        console.error("Cleanup failed:", e);
    }
    process.exit(0);
}

run();
