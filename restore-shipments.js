const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    console.log("Restoring missing shipment data...");

    // Helper to find Deal ID from dealNumber
    const findDeal = async (num) => {
        const d = await prisma.salesDeal.findUnique({ where: { dealNumber: num } });
        return d ? d.id : null;
    };

    const shipments = [
        {
            shipmentNumber: "SHP-2024-001",
            dealId: await findDeal("SD-2024-001"),
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
            dealId: await findDeal("SD-2024-003"),
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

    for (const s of shipments) {
        await prisma.shipmentDetail.upsert({
            where: { shipmentNumber: s.shipmentNumber },
            update: s,
            create: s
        });
        console.log(`- Restored Shipment: ${s.shipmentNumber} (Linked to Deal: ${s.dealId || "None"})`);
    }

    console.log("✅ Shipment restoration complete!");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
