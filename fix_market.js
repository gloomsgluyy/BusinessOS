const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function run() {
    console.log('Menghapus data harga market Error 100x ...');
    const deleted = await p.marketPrice.deleteMany({
        where: { ici1: { gt: 1000 } }
    });
    console.log(`Berhasil menghapus ${deleted.count} baris market price yang error/ter-inflate dari database!`);
}
run().catch(console.error).finally(() => p.$disconnect());
