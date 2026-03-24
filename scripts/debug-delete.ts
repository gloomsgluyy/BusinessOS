import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
    // 1. Create a dummy source
    const dummy = await prisma.sourceSupplier.create({
        data: {
            id: "dummy-delete-test",
            name: "Dummy Source",
            region: "Test Region",
        }
    });

    console.log("Created dummy source:", dummy.id);

    // 2. Fetch local records before delete
    const localRecordsBefore = await prisma.sourceSupplier.findMany({
        where: { isDeleted: false },
        select: { id: true }
    });
    console.log("Active records before:", localRecordsBefore.map(r => r.id).includes(dummy.id));

    // 3. Mock remoteIds without dummy-delete-test
    const remoteIds = new Set(localRecordsBefore.map(r => r.id).filter(id => id !== dummy.id));

    // 4. Run the exact deletion logic from the route
    const deletePromises = localRecordsBefore
        .filter(loc => !remoteIds.has(loc.id))
        .map(loc =>
            prisma.sourceSupplier.update({
                where: { id: loc.id },
                data: { isDeleted: true }
            })
        );

    if (deletePromises.length > 0) {
        console.log(`Attempting to delete ${deletePromises.length} records`);
        const results = await Promise.allSettled(deletePromises);
        console.log("Delete results:", results);
    }

    // 5. Verify the state again
    const localRecordsAfter = await prisma.sourceSupplier.findMany({
        where: { isDeleted: false },
        select: { id: true }
    });
    console.log("Active records after:", localRecordsAfter.map(r => r.id).includes(dummy.id));

    const checkDummy = await prisma.sourceSupplier.findUnique({
        where: { id: dummy.id }
    });
    console.log("Dummy isDeleted flag:", checkDummy?.isDeleted);

    // Cleanup
    await prisma.sourceSupplier.delete({ where: { id: dummy.id } });
}

run().catch(console.error).finally(() => prisma.$disconnect());
