
const prisma = require('./src/lib/prisma').default;
const fs = require('fs');
async function run() {
    try {
        const data = await prisma.shipmentDetail.findMany({
            where: { isDeleted: false },
            select: { id: true, shipmentNumber: true, buyer: true }
        });
        fs.writeFileSync('db_check.json', JSON.stringify(data, null, 2));
        console.log("Done");
    } catch (e: any) {
        fs.writeFileSync('db_check.json', e.stack || String(e));
    }
    process.exit(0);
}
run();
