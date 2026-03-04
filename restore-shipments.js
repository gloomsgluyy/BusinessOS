const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    console.log("🚀 Starting Full Data Restoration (Deals + Shipments)...");

    // 1. Seed Sales Deals
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
            createdBy: 'usr-003',
            shippingTerms: 'FOB'
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
            createdBy: 'usr-001',
            shippingTerms: 'FOB'
        }
    ];

    console.log("Injecting Sales Deals...");
    for (const d of deals) {
        await prisma.salesDeal.upsert({
            where: { dealNumber: d.dealNumber },
            update: d,
            create: d
        });
        console.log(`- Deal: ${d.dealNumber} restored.`);
    }

    // 2. Map Deal IDs for Shipments
    const dbDeals = await prisma.salesDeal.findMany();
    const dealMap = {};
    dbDeals.forEach(d => dealMap[d.dealNumber] = d.id);

    // 3. Seed Shipments
    const shipments = [
        {
            shipmentNumber: "SHP-2024-001",
            dealId: dealMap["SD-2024-001"],
            status: "loading",
            buyer: "Global Energy Corp",
            supplier: "Tambang Hasnur Block A",
            isBlending: false,
            iupOp: "IUP-KS-2021-1234",
            vesselName: "MV Kalimantan Star",
            bargeName: "BG Nusantara 01",
            loadingPort: "Trisakti Port, Banjarmasin",
            dischargePort: "Caofeidian Port, Hebei",
            quantityLoaded: 55000,
            blDate: new Date("2026-03-01"),
            eta: new Date("2026-03-15"),
            salesPrice: 82.5,
            marginMt: 12.5,
            picName: "Budi Santoso",
            type: "export",
            milestones: JSON.stringify([
                { event: "PO Signed", date: "2026-02-20", done: true },
                { event: "Vessel Arrived", date: "2026-03-01", done: true },
                { event: "Loading", date: "2026-03-02", done: true },
            ]),
        },
        {
            shipmentNumber: "SHP-2024-002",
            dealId: dealMap["SD-2024-003"],
            status: "waiting_loading",
            buyer: "PLN Persero",
            supplier: "Sungai Berau Block C",
            isBlending: false,
            iupOp: "IUP-KT-2020-0892",
            vesselName: "MV Pacific Merchant",
            bargeName: null,
            loadingPort: "Berau Coal Jetty",
            dischargePort: "Cilegon",
            quantityLoaded: 25000,
            blDate: null,
            eta: new Date("2026-03-20"),
            salesPrice: 65.0,
            marginMt: 8.5,
            picName: "Raka Aditya",
            type: "local",
            milestones: JSON.stringify([
                { event: "Contract Signed", date: "2026-02-25", done: true },
                { event: "Vessel Nomination", date: "2026-03-01", done: true },
            ]),
        }
    ];

    console.log("Injecting Shipments...");
    for (const s of shipments) {
        await prisma.shipmentDetail.upsert({
            where: { shipmentNumber: s.shipmentNumber },
            update: s,
            create: s
        });
        console.log(`- Shipment: ${s.shipmentNumber} restored.`);
    }

    console.log("✅ Full Restoration Complete!");
    console.log("Next: Go to /api/maintenance/sync to push these to Google Sheets.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
