const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Starting commercial data seeding...');

    // 1. Clear existing data (Optional: remove if you want to keep logs)
    // await prisma.shipmentDetail.deleteMany();
    // await prisma.salesDeal.deleteMany();
    // await prisma.sourceSupplier.deleteMany();
    // await prisma.marketPrice.deleteMany();
    // await prisma.partner.deleteMany();

    // 2. Seed Partners (Buyers & Vendors)
    const partners = [
        { name: 'Global Energy Corp', type: 'buyer', country: 'Vietnam', status: 'active' },
        { name: 'Siam Power Ltd', type: 'buyer', country: 'Thailand', status: 'active' },
        { name: 'Manila Electric', type: 'buyer', country: 'Philippines', status: 'active' },
        { name: 'Indo Mining Source', type: 'vendor', country: 'Indonesia', status: 'active' },
        { name: 'Kalimantan Coal Hub', type: 'vendor', country: 'Indonesia', status: 'active' },
    ];

    for (const p of partners) {
        await prisma.partner.upsert({
            where: { id: `partner-${p.name.replace(/\s+/g, '-').toLowerCase()}` },
            update: {},
            create: {
                id: `partner-${p.name.replace(/\s+/g, '-').toLowerCase()}`,
                ...p
            }
        });
    }

    // 3. Seed Sales Deals
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
    }

    // 4. Seed Shipment Details
    const shipments = [
        {
            shipmentNumber: 'SH-2024-001',
            dealId: 'SD-2024-001',
            status: 'in_transit',
            buyer: 'Global Energy Corp',
            vesselName: 'MV OCEAN TRADER',
            bargeName: 'BG LUCKY 3001',
            loadingPort: 'Taboneo Anchorage',
            dischargePort: 'Go Dau Port',
            quantityLoaded: 54850,
            salesPrice: 82.5,
            type: 'export',
            blDate: new Date('2024-02-28'),
            eta: new Date('2024-03-05')
        },
        {
            shipmentNumber: 'SH-2024-002',
            dealId: 'SD-2024-003',
            status: 'loading',
            buyer: 'PLN Persero',
            vesselName: 'MV INDO POWER',
            bargeName: 'BG JAYA 270',
            loadingPort: 'Bunati',
            dischargePort: 'Paiton',
            quantityLoaded: 24900,
            salesPrice: 65.0,
            type: 'local',
            blDate: new Date('2024-03-02'),
            eta: new Date('2024-03-04')
        }
    ];

    for (const s of shipments) {
        await prisma.shipmentDetail.upsert({
            where: { shipmentNumber: s.shipmentNumber },
            update: s,
            create: s
        });
    }

    // 5. Seed Source Suppliers
    const suppliers = [
        {
            name: 'Musi Mitra Jaya',
            region: 'South Sumatra',
            calorieRange: '3400 - 3600',
            gar: 3400,
            stockAvailable: 125000,
            kycStatus: 'verified',
            psiStatus: 'passed',
            picName: 'Rina Wijaya'
        },
        {
            name: 'Bukit Asam Tbk',
            region: 'South Sumatra',
            calorieRange: '4200 - 5000',
            gar: 4800,
            stockAvailable: 450000,
            kycStatus: 'verified',
            psiStatus: 'passed',
            picName: 'Rina Wijaya'
        }
    ];

    for (const sup of suppliers) {
        await prisma.sourceSupplier.upsert({
            where: { id: `sup-${sup.name.replace(/\s+/g, '-').toLowerCase()}` },
            update: sup,
            create: {
                id: `sup-${sup.name.replace(/\s+/g, '-').toLowerCase()}`,
                ...sup
            }
        });
    }

    // 6. Seed Market Prices (Last 4 weeks)
    const marketPrices = [];
    for (let i = 0; i < 4; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (i * 7));
        marketPrices.push({
            date: date,
            ici4: 55.42 + (Math.random() * 2),
            newcastle: 128.50 + (Math.random() * 5),
            hba: 121.30 + (Math.random() * 3),
            source: 'Weekly Index'
        });
    }

    for (const mp of marketPrices) {
        await prisma.marketPrice.create({ data: mp });
    }

    console.log('Seeding completed successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
