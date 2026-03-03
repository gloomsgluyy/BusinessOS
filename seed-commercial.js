const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Starting Sales Monitor data seeding...');

    // Seed ONLY Sales Deals as requested
    const deals = [
        {
            dealNumber: 'SD-2024-001',
            status: 'confirmed',
            buyer: 'Global Energy Corp',
            buyerCountry: 'Vietnam',
            type: 'export',
            quantity: 55000,
            pricePerMt: 82.5,
            totalValue: 4537500,
            gar: 4200,
            ts: 0.8,
            ash: 6,
            tm: 34,
            picName: 'Budi Santoso',
            createdBy: 'usr-003'
        },
        {
            dealNumber: 'SD-2024-002',
            status: 'pre_sale',
            buyer: 'Siam Power Ltd',
            buyerCountry: 'Thailand',
            type: 'export',
            quantity: 38000,
            pricePerMt: 78.0,
            totalValue: 2964000,
            gar: 3800,
            ts: 0.6,
            ash: 5,
            tm: 38,
            picName: 'Budi Santoso',
            createdBy: 'usr-003'
        },
        {
            dealNumber: 'SD-2024-003',
            status: 'confirmed',
            buyer: 'PLN Persero',
            buyerCountry: 'Indonesia',
            type: 'local',
            quantity: 25000,
            pricePerMt: 65.0,
            totalValue: 1625000,
            gar: 4200,
            ts: 0.8,
            ash: 8,
            tm: 32,
            picName: 'Raka Aditya',
            createdBy: 'usr-001'
        },
        {
            dealNumber: 'SD-2024-004',
            status: 'on_going',
            buyer: 'Manila Electric',
            buyerCountry: 'Philippines',
            type: 'export',
            quantity: 42000,
            pricePerMt: 80.2,
            totalValue: 3368400,
            gar: 4000,
            ts: 0.7,
            ash: 7,
            tm: 36,
            picName: 'Budi Santoso',
            createdBy: 'usr-003'
        }
    ];

    for (const d of deals) {
        await prisma.salesDeal.upsert({
            where: { dealNumber: d.dealNumber },
            update: d,
            create: d
        });
        console.log(`- Seeded Deal: ${d.dealNumber} for ${d.buyer}`);
    }

    console.log('Sales Monitor seeding finished successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
