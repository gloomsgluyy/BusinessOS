const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Starting full commercial data seeding (Sales + Market Price)...');

    // 1. Seed Sales Deals (Bapak's request)
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
        }
    ];

    for (const d of deals) {
        await prisma.salesDeal.upsert({
            where: { dealNumber: d.dealNumber },
            update: d,
            create: d
        });
        console.log(`- Seeded Deal: ${d.dealNumber}`);
    }

    // 2. Seed Market Prices (Fixing the $0.00 issue)
    console.log('Cleaning old Market Price data and injecting correct values...');
    await prisma.marketPrice.deleteMany(); // Reset to avoid zero-value duplicates

    const historicalData = [
        { date: new Date('2026-03-03'), ici1: 132.15, ici2: 97.42, ici3: 75.19, ici4: 53.91, ici5: 40.27, newcastle: 124.21, hba: 106.19 },
        { date: new Date('2026-03-02'), ici1: 132.10, ici2: 97.35, ici3: 75.10, ici4: 53.85, ici5: 40.20, newcastle: 124.15, hba: 106.10 },
        { date: new Date('2026-02-24'), ici1: 131.80, ici2: 96.90, ici3: 74.80, ici4: 56.82, ici5: 39.90, newcastle: 132.90, hba: 124.08 },
        { date: new Date('2026-02-17'), ici1: 132.05, ici2: 97.10, ici3: 75.00, ici4: 56.96, ici5: 40.10, newcastle: 132.96, hba: 123.04 },
        { date: new Date('2026-02-10'), ici1: 132.20, ici2: 97.30, ici3: 75.20, ici4: 56.22, ici5: 40.30, newcastle: 133.12, hba: 122.24 },
        // 2025 Data for historical view
        { date: new Date('2025-02-24'), ici1: 31.50, ici2: 40.10, ici3: 45.20, ici4: 72.00, ici5: 84.00, newcastle: 108.50, hba: 89.00 },
        { date: new Date('2025-02-17'), ici1: 30.80, ici2: 39.00, ici3: 44.20, ici4: 70.80, ici5: 82.40, newcastle: 106.50, hba: 87.90 },
        { date: new Date('2025-02-10'), ici1: 31.20, ici2: 39.50, ici3: 44.80, ici4: 71.20, ici5: 83.10, newcastle: 107.30, hba: 88.20 },
    ];

    for (const mp of historicalData) {
        await prisma.marketPrice.create({
            data: {
                ...mp,
                source: 'Argus/Coalindo'
            }
        });
    }

    console.log('Seeding finished! Sales & Market Price are now correct.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
