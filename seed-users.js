const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

const users = [
    { name: "Raka Aditya", email: "raka@coaltrading.com", role: "CEO", title: "Chief Executive Officer", dept: "Executive" },
    { name: "Diana Putri", email: "diana@coaltrading.com", role: "ASSISTANT_CEO", title: "Assistant CEO", dept: "Executive" },
    { name: "Sangkara P", email: "ceo@company.com", role: "CEO", title: "System Administrator", dept: "Executive" },
    { name: "Budi Santoso", email: "budi@coaltrading.com", role: "MANAGER", title: "Marketing Manager", dept: "Sales" },
    { name: "Rina Wijaya", email: "rina@coaltrading.com", role: "STAFF", title: "Purchasing Staff", dept: "Purchasing" },
];

async function seed() {
    console.log("Seeding base users into Memory B...");
    for (const u of users) {
        const exists = await prisma.user.findUnique({ where: { email: u.email } });
        if (!exists) {
            const hashedPassword = await bcrypt.hash("admin123", 10);
            await prisma.user.create({
                data: {
                    name: u.name,
                    email: u.email,
                    role: u.role,
                    password: hashedPassword,
                    job_title: u.title,
                    department: u.dept
                }
            });
            console.log(`Created: ${u.email}`);
        } else {
            console.log(`Skipped (Exists): ${u.email}`);
        }
    }
    console.log("Done seeding users.");
}

seed()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
