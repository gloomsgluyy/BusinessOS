import { PrismaClient } from '@prisma/client';
import { syncSourcesFromSheet } from '../src/app/actions/sheet-actions';

const prisma = new PrismaClient();

async function run() {
    console.log("Fetching from Sheets...");
    const sheetData = await syncSourcesFromSheet();
    console.log(`Found ${sheetData.sources?.length} in sheets.`);

    const remoteIds = new Set(sheetData.sources?.map((s: { id: string }) => s.id) || []);
    console.log("Remote IDs:", Array.from(remoteIds).slice(0, 5), "...");

    const localRecords = await prisma.sourceSupplier.findMany({
        where: { isDeleted: false },
        select: { id: true }
    });
    console.log(`Found ${localRecords.length} active local records.`);

    const toDelete = localRecords.filter(loc => !remoteIds.has(loc.id));
    console.log(`Need to delete ${toDelete.length} local records.`);

    if (toDelete.length > 0) {
        console.log("IDs to delete:", toDelete.map(t => t.id));
    }
}

run().catch(console.error).finally(() => prisma.$disconnect());
