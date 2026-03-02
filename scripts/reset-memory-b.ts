import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("Starting Reset of Memory B (Business Data)...");

    try {
        // Order of deletion to avoid foreign key issues (though many use cuid/strings without formal relations)
        const tables = [
            'blendingSimulation',
            'partner',
            'salesDeal',
            'pLForecast',
            'meetingItem',
            'marketPrice',
            'qualityResult',
            'sourceSupplier',
            'shipmentDetail',
            'purchaseRequest',
            'salesOrder',
            'taskItem',
            'auditLog',
            'syncState',
            'timelineMilestone',
            'chatHistory'
        ];

        for (const table of tables) {
            console.log(`Clearing table: ${table}...`);
            // @ts-ignore - dynamic access to model
            await prisma[table].deleteMany({});
        }

        console.log("Memory B Reset Successful!");
    } catch (error) {
        console.error("Error during reset:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
