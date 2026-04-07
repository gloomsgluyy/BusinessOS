import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
    try {
        const users = await prisma.user.findMany();
        console.log("Users in DB:", users.length);
        if (users.length > 0) {
            console.log("First user:", users[0].id, users[0].email);
            // test audit log
            const log = await prisma.auditLog.create({
                data: {
                    userId: users[0].id,
                    userName: users[0].name || "Test",
                    action: "TEST",
                    entity: "TEST",
                    entityId: "123"
                }
            });
            console.log("Audit log success:", log.id);
            await prisma.auditLog.delete({ where: { id: log.id } });
        } else {
            console.log("NO USERS IN DB!");
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
test();
