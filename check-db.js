const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- MEMORY B DATABASE CHECK ---");

    const users = await prisma.user.count();
    console.log(`Users: ${users}`);

    const tasks = await prisma.taskItem.count();
    console.log(`Tasks: ${tasks}`);

    const sales = await prisma.salesOrder.count();
    console.log(`Sales Orders: ${sales}`);

    const meetings = await prisma.meetingItem.count();
    console.log(`Meetings: ${meetings}`);

    const purchases = await prisma.purchaseRequest.count();
    console.log(`Purchases/Expenses: ${purchases}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
