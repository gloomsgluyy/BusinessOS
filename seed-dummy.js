/**
 * Seed Dummy Data Script for 11GAWE Business OS
 * Injects realistic coal trading data across all 13 modules
 * Run: node seed-dummy.js
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const CREATED_BY = "seed-user";
const CREATED_BY_NAME = "System Admin";

async function clearExistingDummy() {
    console.log("🧹 Clearing existing dummy data (soft-delete safe)...");
    // We'll just add on top of existing — no clear needed to keep real data
}

// ─── 1. PARTNERS & DIRECTORY ───────────────────────────────────────────────
async function seedPartners() {
    console.log("\n📋 Seeding Partners & Directory...");
    const partners = [
        {
            name: "PT Bukit Asam Tbk",
            type: "vendor",
            category: "Coal Producer",
            contactPerson: "Budi Santoso",
            phone: "+62-812-3456-7890",
            email: "budi@bukitasam.co.id",
            city: "Tanjung Enim",
            country: "Indonesia",
            taxId: "01.234.567.8-901.000",
            status: "active",
            notes: "Major state-owned coal producer, IUP holder",
        },
        {
            name: "China Huaneng Group",
            type: "buyer",
            category: "Power Plant",
            contactPerson: "Li Wei",
            phone: "+86-138-0001-0001",
            email: "liwei@huaneng.com.cn",
            city: "Beijing",
            country: "China",
            taxId: "91110000100026301F",
            status: "active",
            notes: "Top-tier buyer, multi-year contract potential",
        },
        {
            name: "PT Mitra Armada Bahari",
            type: "fleet",
            category: "Vessel Operator",
            contactPerson: "Agus Priyanto",
            phone: "+62-811-9876-5432",
            email: "agus@mitraarmada.com",
            city: "Jakarta",
            country: "Indonesia",
            taxId: "02.345.678.9-012.000",
            status: "active",
            notes: "Provides Panamax and Supramax vessels",
        },
        {
            name: "Korea Electric Power Corp (KEPCO)",
            type: "buyer",
            category: "Power Plant",
            contactPerson: "Kim Jae-young",
            phone: "+82-2-3456-7890",
            email: "jaeyoung.kim@kepco.kr",
            city: "Naju",
            country: "South Korea",
            status: "active",
            notes: "Long-term supply agreement under negotiation",
        },
        {
            name: "PT Hasnur Riung Sinergi",
            type: "vendor",
            category: "Coal Producer",
            contactPerson: "Ahmad Fauzan",
            phone: "+62-812-7654-3210",
            email: "fauzan@hasnur.co.id",
            city: "Banjarmasin",
            country: "Indonesia",
            status: "active",
            notes: "KPK - Kalimantan coal supplier, GAR 4200-5000",
        },
        {
            name: "PT Pelabuhan Indonesia II",
            type: "vendor",
            category: "Port Operator",
            contactPerson: "Dedi Kurniawan",
            phone: "+62-21-5678-9012",
            email: "dedi@pelindo.co.id",
            city: "Jakarta",
            country: "Indonesia",
            status: "active",
            notes: "Port facilities for coal loading",
        },
        {
            name: "NTPC Limited",
            type: "buyer",
            category: "Power Plant",
            contactPerson: "Rajesh Kumar",
            phone: "+91-11-2341-0000",
            email: "rajesh.kumar@ntpc.co.in",
            city: "New Delhi",
            country: "India",
            status: "active",
            notes: "India's largest power generator, import via MMTC",
        },
        {
            name: "Intertek Testing Services",
            type: "vendor",
            category: "Surveyor",
            contactPerson: "Susanto Wibowo",
            phone: "+62-21-2345-6789",
            email: "susanto@intertek.com",
            city: "Jakarta",
            country: "Indonesia",
            status: "active",
            notes: "Independent coal quality surveyor",
        },
    ];

    for (const p of partners) {
        await prisma.partner.create({ data: p });
    }
    console.log(`   ✅ ${partners.length} partners created`);
}

// ─── 2. SOURCES (SourceSupplier) ──────────────────────────────────────────
async function seedSources() {
    console.log("\n⛏️  Seeding Sources / Suppliers...");
    const sources = [
        {
            name: "Tambang Hasnur Block A",
            region: "Kalimantan Selatan",
            calorieRange: "4200-4500 GAR",
            gar: 4300,
            ts: 0.4,
            ash: 8.5,
            tm: 28.0,
            jettyPort: "Trisakti Port, Banjarmasin",
            anchorage: "Sampit Anchorage",
            stockAvailable: 45000,
            minStockAlert: 5000,
            kycStatus: "approved",
            psiStatus: "approved",
            fobBargeOnly: false,
            priceLinkedIndex: "ICI 3",
            fobBargePriceUsd: 42.5,
            contractType: "spot",
            picName: "Ahmad Fauzan",
            iupNumber: "IUP-KS-2021-1234",
        },
        {
            name: "Tambang Muara Enim Selatan",
            region: "Sumatera Selatan",
            calorieRange: "5800-6000 GAR",
            gar: 5900,
            ts: 0.7,
            ash: 7.2,
            tm: 19.0,
            jettyPort: "Tarahan Port",
            anchorage: "Lampung Bay",
            stockAvailable: 28000,
            minStockAlert: 3000,
            kycStatus: "approved",
            psiStatus: "in_progress",
            fobBargeOnly: false,
            priceLinkedIndex: "ICI 4",
            fobBargePriceUsd: 58.0,
            contractType: "term",
            picName: "Budi Santoso",
            iupNumber: "IUP-SS-2019-0567",
        },
        {
            name: "Sungai Berau Block C",
            region: "Kalimantan Timur",
            calorieRange: "6300-6500 GAR",
            gar: 6400,
            ts: 0.5,
            ash: 5.0,
            tm: 12.0,
            jettyPort: "Berau Coal Jetty",
            anchorage: "Berau Bay Anchorage",
            stockAvailable: 18000,
            minStockAlert: 2000,
            kycStatus: "approved",
            psiStatus: "approved",
            fobBargeOnly: false,
            priceLinkedIndex: "ICI 5",
            fobBargePriceUsd: 75.0,
            contractType: "spot",
            picName: "Teguh Wahyudi",
            iupNumber: "IUP-KT-2020-0892",
        },
        {
            name: "Mahakam River Barge Supply",
            region: "Kalimantan Timur",
            calorieRange: "3800-4200 GAR",
            gar: 4000,
            ts: 0.35,
            ash: 10.0,
            tm: 32.0,
            jettyPort: "Samarinda Port",
            anchorage: "Mahakam River Anchorage",
            stockAvailable: 75000,
            minStockAlert: 10000,
            kycStatus: "in_progress",
            psiStatus: "not_started",
            fobBargeOnly: true,
            priceLinkedIndex: "ICI 2",
            fobBargePriceUsd: 36.0,
            contractType: "spot",
            picName: "Rudi Hartono",
            iupNumber: "IUP-KT-2022-1105",
        },
    ];

    for (const s of sources) {
        await prisma.sourceSupplier.create({ data: s });
    }
    console.log(`   ✅ ${sources.length} sources created`);
}

// ─── 3. SHIPMENT MONITOR ──────────────────────────────────────────────────
async function seedShipments() {
    console.log("\n🚢 Seeding Shipments...");
    const shipments = [
        {
            shipmentNumber: "SHP-2025-001",
            dealId: "deal-001",
            status: "loading",
            buyer: "China Huaneng Group",
            supplier: "Tambang Hasnur Block A",
            isBlending: false,
            iupOp: "IUP-KS-2021-1234",
            vesselName: "MV Kalimantan Star",
            bargeName: "BG Nusantara 01",
            loadingPort: "Trisakti Port, Banjarmasin",
            dischargePort: "Caofeidian Port, Hebei",
            quantityLoaded: 52000,
            blDate: new Date("2025-02-15"),
            eta: new Date("2025-03-05"),
            salesPrice: 44.5,
            marginMt: 2.5,
            picName: "Andi Wijaya",
            type: "export",
            milestones: JSON.stringify([
                { event: "PO Signed", date: "2025-01-20", done: true },
                { event: "Survey Pre-loading", date: "2025-02-10", done: true },
                { event: "Loading Complete", date: "2025-02-28", done: false },
                { event: "BL Issued", date: "2025-03-01", done: false },
                { event: "ETA Discharge Port", date: "2025-03-05", done: false },
            ]),
        },
        {
            shipmentNumber: "SHP-2025-002",
            dealId: "deal-002",
            status: "sailing",
            buyer: "KEPCO",
            supplier: "Sungai Berau Block C",
            isBlending: false,
            iupOp: "IUP-KT-2020-0892",
            vesselName: "MV Pacific Merchant",
            bargeName: null,
            loadingPort: "Berau Coal Jetty",
            dischargePort: "Pohang Port, South Korea",
            quantityLoaded: 65000,
            blDate: new Date("2025-02-08"),
            eta: new Date("2025-02-25"),
            salesPrice: 77.5,
            marginMt: 3.2,
            picName: "Dewi Lestari",
            type: "export",
            milestones: JSON.stringify([
                { event: "PO Signed", date: "2025-01-15", done: true },
                { event: "Loading Complete", date: "2025-02-10", done: true },
                { event: "BL Issued", date: "2025-02-10", done: true },
                { event: "ETA Discharge Port", date: "2025-02-25", done: false },
            ]),
        },
        {
            shipmentNumber: "SHP-2025-003",
            dealId: "deal-003",
            status: "discharged",
            buyer: "NTPC Limited",
            supplier: "Tambang Muara Enim Selatan",
            isBlending: true,
            iupOp: "IUP-SS-2019-0567",
            vesselName: "MV India Star",
            bargeName: "BG Asahan 02",
            loadingPort: "Tarahan Port",
            dischargePort: "Paradip Port, Odisha",
            quantityLoaded: 48000,
            blDate: new Date("2025-01-20"),
            eta: new Date("2025-02-05"),
            salesPrice: 62.0,
            marginMt: 4.1,
            picName: "Rini Suryani",
            type: "export",
            milestones: JSON.stringify([
                { event: "PO Signed", date: "2025-01-05", done: true },
                { event: "Loading Complete", date: "2025-01-22", done: true },
                { event: "BL Issued", date: "2025-01-22", done: true },
                { event: "ETA Discharge Port", date: "2025-02-05", done: true },
                { event: "Discharge Complete", date: "2025-02-08", done: true },
            ]),
        },
        {
            shipmentNumber: "SHP-2025-004",
            dealId: null,
            status: "draft",
            buyer: "PLN Nusantara Power",
            supplier: "Mahakam River Barge Supply",
            isBlending: false,
            iupOp: "IUP-KT-2022-1105",
            vesselName: null,
            bargeName: null,
            loadingPort: "Samarinda Port",
            dischargePort: "Suralaya PLTU, Banten",
            quantityLoaded: null,
            blDate: null,
            eta: null,
            salesPrice: 38.0,
            marginMt: 2.0,
            picName: "Andi Wijaya",
            type: "domestic",
            milestones: JSON.stringify([]),
        },
    ];

    for (const s of shipments) {
        await prisma.shipmentDetail.create({ data: s });
    }
    console.log(`   ✅ ${shipments.length} shipments created`);
}

// ─── 4. QUALITY ────────────────────────────────────────────────────────────
async function seedQuality() {
    console.log("\n🔬 Seeding Quality Results...");
    const results = [
        {
            cargoId: "SHP-2025-001",
            cargoName: "MV Kalimantan Star – Hasnur 4300 GAR",
            surveyor: "Intertek Testing Services",
            samplingDate: new Date("2025-02-12"),
            gar: 4285,
            ts: 0.38,
            ash: 8.7,
            tm: 28.5,
            status: "approved",
        },
        {
            cargoId: "SHP-2025-002",
            cargoName: "MV Pacific Merchant – Berau 6400 GAR",
            surveyor: "SGS Indonesia",
            samplingDate: new Date("2025-02-07"),
            gar: 6412,
            ts: 0.52,
            ash: 4.9,
            tm: 11.8,
            status: "approved",
        },
        {
            cargoId: "SHP-2025-003",
            cargoName: "MV India Star – Blended 5800 GAR",
            surveyor: "Bureau Veritas",
            samplingDate: new Date("2025-01-18"),
            gar: 5795,
            ts: 0.68,
            ash: 7.4,
            tm: 19.5,
            status: "approved",
        },
        {
            cargoId: "QC-PRE-001",
            cargoName: "Pre-shipment Sample – Tambang Hasnur Lot B",
            surveyor: "Intertek Testing Services",
            samplingDate: new Date("2025-02-20"),
            gar: 4310,
            ts: 0.41,
            ash: 8.3,
            tm: 27.8,
            status: "pending",
        },
        {
            cargoId: "QC-PRE-002",
            cargoName: "Incoming Sample – Mahakam Barge Lot 5",
            surveyor: "PT Geoservices",
            samplingDate: new Date("2025-02-22"),
            gar: 3980,
            ts: 0.33,
            ash: 10.2,
            tm: 33.0,
            status: "rejected",
        },
    ];

    for (const r of results) {
        await prisma.qualityResult.create({ data: r });
    }
    console.log(`   ✅ ${results.length} quality results created`);
}

// ─── 5. BLENDING SIMULATION ───────────────────────────────────────────────
async function seedBlending() {
    console.log("\n🧪 Seeding Blending Simulations...");
    const sims = [
        {
            inputs: JSON.stringify([
                { name: "Hasnur 4300 GAR", quantity: 30000, gar: 4300, ts: 0.38, ash: 8.5, tm: 28.0 },
                { name: "Berau 6400 GAR", quantity: 20000, gar: 6400, ts: 0.52, ash: 5.0, tm: 12.0 },
            ]),
            totalQuantity: 50000,
            resultGar: 5140,
            resultTs: 0.43,
            resultAsh: 7.1,
            resultTm: 21.6,
            createdBy: CREATED_BY,
        },
        {
            inputs: JSON.stringify([
                { name: "Mahakam 4000 GAR", quantity: 20000, gar: 4000, ts: 0.35, ash: 10.0, tm: 32.0 },
                { name: "Muara Enim 5900 GAR", quantity: 30000, gar: 5900, ts: 0.70, ash: 7.2, tm: 19.0 },
            ]),
            totalQuantity: 50000,
            resultGar: 5140,
            resultTs: 0.56,
            resultAsh: 8.3,
            resultTm: 24.2,
            createdBy: CREATED_BY,
        },
        {
            inputs: JSON.stringify([
                { name: "Hasnur 4300 GAR", quantity: 15000, gar: 4300, ts: 0.38, ash: 8.5, tm: 28.0 },
                { name: "Berau 6400 GAR", quantity: 25000, gar: 6400, ts: 0.52, ash: 5.0, tm: 12.0 },
                { name: "Mahakam 4000 GAR", quantity: 10000, gar: 4000, ts: 0.35, ash: 10.0, tm: 32.0 },
            ]),
            totalQuantity: 50000,
            resultGar: 5540,
            resultTs: 0.45,
            resultAsh: 6.8,
            resultTm: 18.2,
            createdBy: CREATED_BY,
        },
    ];

    for (const s of sims) {
        await prisma.blendingSimulation.create({ data: s });
    }
    console.log(`   ✅ ${sims.length} blending simulations created`);
}

// ─── 6. SALES DEALS (Projects + Sales Plan + Sales Monitor) ───────────────
async function seedSalesDeals() {
    console.log("\n💼 Seeding Sales Deals / Projects...");
    const deals = [
        {
            dealNumber: "DEAL-2025-001",
            status: "contracted",
            buyer: "China Huaneng Group",
            buyerCountry: "China",
            type: "export",
            shippingTerms: "CFR",
            quantity: 52000,
            pricePerMt: 44.5,
            totalValue: 2314000,
            laycanStart: new Date("2025-02-10"),
            laycanEnd: new Date("2025-02-20"),
            vesselName: "MV Kalimantan Star",
            gar: 4300,
            ts: 0.38,
            ash: 8.5,
            tm: 28.0,
            projectId: "proj-001",
            picId: "pic-001",
            picName: "Andi Wijaya",
            createdByName: CREATED_BY_NAME,
            createdBy: CREATED_BY,
        },
        {
            dealNumber: "DEAL-2025-002",
            status: "contracted",
            buyer: "KEPCO",
            buyerCountry: "South Korea",
            type: "export",
            shippingTerms: "FOB",
            quantity: 65000,
            pricePerMt: 77.5,
            totalValue: 5037500,
            laycanStart: new Date("2025-02-01"),
            laycanEnd: new Date("2025-02-12"),
            vesselName: "MV Pacific Merchant",
            gar: 6400,
            ts: 0.52,
            ash: 5.0,
            tm: 12.0,
            projectId: "proj-002",
            picId: "pic-002",
            picName: "Dewi Lestari",
            createdByName: CREATED_BY_NAME,
            createdBy: CREATED_BY,
        },
        {
            dealNumber: "DEAL-2025-003",
            status: "executed",
            buyer: "NTPC Limited",
            buyerCountry: "India",
            type: "export",
            shippingTerms: "CFR",
            quantity: 48000,
            pricePerMt: 62.0,
            totalValue: 2976000,
            laycanStart: new Date("2025-01-15"),
            laycanEnd: new Date("2025-01-25"),
            vesselName: "MV India Star",
            gar: 5900,
            ts: 0.68,
            ash: 7.4,
            tm: 19.0,
            projectId: "proj-003",
            picId: "pic-003",
            picName: "Rini Suryani",
            createdByName: CREATED_BY_NAME,
            createdBy: CREATED_BY,
        },
        {
            dealNumber: "DEAL-2025-004",
            status: "pre_sale",
            buyer: "Guangdong Energy Group",
            buyerCountry: "China",
            type: "export",
            shippingTerms: "CFR",
            quantity: 60000,
            pricePerMt: 46.0,
            totalValue: 2760000,
            laycanStart: new Date("2025-03-15"),
            laycanEnd: new Date("2025-03-25"),
            vesselName: null,
            gar: 4300,
            ts: 0.40,
            ash: 9.0,
            tm: 28.0,
            projectId: null,
            picId: "pic-001",
            picName: "Andi Wijaya",
            createdByName: CREATED_BY_NAME,
            createdBy: CREATED_BY,
        },
        {
            dealNumber: "DEAL-2025-005",
            status: "pre_sale",
            buyer: "PLN Nusantara Power",
            buyerCountry: "Indonesia",
            type: "domestic",
            shippingTerms: "FOB",
            quantity: 30000,
            pricePerMt: 38.0,
            totalValue: 1140000,
            laycanStart: new Date("2025-03-20"),
            laycanEnd: new Date("2025-04-05"),
            vesselName: null,
            gar: 4000,
            ts: 0.35,
            ash: 10.0,
            tm: 32.0,
            projectId: null,
            picId: "pic-002",
            picName: "Dewi Lestari",
            createdByName: CREATED_BY_NAME,
            createdBy: CREATED_BY,
        },
    ];

    for (const d of deals) {
        await prisma.salesDeal.create({ data: d });
    }
    console.log(`   ✅ ${deals.length} sales deals created`);
}

// ─── 7. SALES ORDERS ──────────────────────────────────────────────────────
async function seedSalesOrders() {
    console.log("\n🛒 Seeding Sales Orders...");
    const orders = [
        {
            orderNumber: "SO-2025-001",
            client: "China Huaneng Group",
            description: "52,000 MT Coal GAR 4300 CFR Caofeidian",
            amount: 2314000,
            priority: "high",
            status: "approved",
            createdByName: "Andi Wijaya",
            createdBy: CREATED_BY,
            approvedBy: "CEO",
            notes: "Linked to DEAL-2025-001. Payment via LC at sight.",
        },
        {
            orderNumber: "SO-2025-002",
            client: "KEPCO",
            description: "65,000 MT Coal GAR 6400 FOB Berau",
            amount: 5037500,
            priority: "urgent",
            status: "approved",
            createdByName: "Dewi Lestari",
            createdBy: CREATED_BY,
            approvedBy: "CEO",
            notes: "Linked to DEAL-2025-002. KEPCO standard LC terms.",
        },
        {
            orderNumber: "SO-2025-003",
            client: "NTPC Limited",
            description: "48,000 MT Blended Coal GAR 5800 CFR Paradip",
            amount: 2976000,
            priority: "high",
            status: "approved",
            createdByName: "Rini Suryani",
            createdBy: CREATED_BY,
            approvedBy: "Director",
            notes: "Blended cargo. Quality certificate attached.",
        },
        {
            orderNumber: "SO-2025-004",
            client: "Guangdong Energy Group",
            description: "60,000 MT Coal GAR 4300 CFR South China",
            amount: 2760000,
            priority: "medium",
            status: "pending",
            createdByName: "Andi Wijaya",
            createdBy: CREATED_BY,
            approvedBy: null,
            notes: "Awaiting CEO approval. Laycan March 2025.",
        },
    ];

    for (const o of orders) {
        await prisma.salesOrder.create({ data: o });
    }
    console.log(`   ✅ ${orders.length} sales orders created`);
}

// ─── 8. MARKET PRICES ─────────────────────────────────────────────────────
async function seedMarketPrices() {
    console.log("\n📈 Seeding Market Prices...");
    const prices = [
        { date: new Date("2025-01-06"), ici1: 29.5, ici2: 37.8, ici3: 42.5, ici4: 68.2, ici5: 79.1, newcastle: 102.4, hba: 85.3, source: "Argus/Platts" },
        { date: new Date("2025-01-13"), ici1: 30.1, ici2: 38.2, ici3: 43.1, ici4: 69.0, ici5: 80.2, newcastle: 104.5, hba: 86.0, source: "Argus/Platts" },
        { date: new Date("2025-01-20"), ici1: 29.8, ici2: 37.5, ici3: 42.0, ici4: 67.5, ici5: 78.5, newcastle: 101.8, hba: 84.5, source: "Argus/Platts" },
        { date: new Date("2025-01-27"), ici1: 31.0, ici2: 39.1, ici3: 44.0, ici4: 70.5, ici5: 82.0, newcastle: 106.0, hba: 87.5, source: "Argus/Platts" },
        { date: new Date("2025-02-03"), ici1: 30.5, ici2: 38.8, ici3: 43.5, ici4: 69.8, ici5: 81.0, newcastle: 105.2, hba: 86.8, source: "Argus/Platts" },
        { date: new Date("2025-02-10"), ici1: 31.2, ici2: 39.5, ici3: 44.8, ici4: 71.2, ici5: 83.1, newcastle: 107.3, hba: 88.2, source: "Argus/Platts" },
        { date: new Date("2025-02-17"), ici1: 30.8, ici2: 39.0, ici3: 44.2, ici4: 70.8, ici5: 82.4, newcastle: 106.5, hba: 87.9, source: "Argus/Platts" },
        { date: new Date("2025-02-24"), ici1: 31.5, ici2: 40.1, ici3: 45.2, ici4: 72.0, ici5: 84.0, newcastle: 108.5, hba: 89.0, source: "Argus/Platts" },
    ];

    for (const p of prices) {
        await prisma.marketPrice.create({ data: p });
    }
    console.log(`   ✅ ${prices.length} market price records created`);
}

// ─── 9. MEETINGS ──────────────────────────────────────────────────────────
async function seedMeetings() {
    console.log("\n📅 Seeding Meetings...");
    const meetings = [
        {
            title: "Weekly Ops Review – Feb W3",
            date: new Date("2025-02-17"),
            time: "09:00",
            location: "Board Room A, HO Jakarta",
            status: "completed",
            attendees: JSON.stringify(["Andi Wijaya (MD)", "Dewi Lestari (Sales)", "Rini Suryani (Ops)", "Ahmad Fauzan (Logistics)"]),
            momContent:
                "1. Shipment SHP-2025-001 on track, loading expected to complete by Feb 28.\n2. KEPCO deal fully executed – vessel MV Pacific Merchant departed Berau.\n3. Mahakam supply quality below spec (GAR 3980), supplier notified for replacement.\n4. New RFQ received from Guangdong Energy Group for 60K MT, team to prepare offer by Feb 20.\n5. ICE Newcastle index up 2% this week – beneficial for premium coal sales.",
            aiSummary:
                "## Meeting Summary – Weekly Ops Feb W3\n\n**Shipments:** SHP-2025-001 on track; SHP-2025-002 complete.\n\n**Issues:** Mahakam supply quality rejected (GAR 3980 vs spec 4000+).\n\n**Opportunities:** Guangdong RFQ for 60K MT – deadline Feb 20.\n\n**Market:** Newcastle index +2%, positive for premium coal.\n\n### Action Items\n- [ ] Sales team prepare Guangdong quote by Feb 20 (PIC: Andi)\n- [ ] Logistics contact Hasnur for emergency replacement stock (PIC: Ahmad)",
            createdByName: "Andi Wijaya",
            createdBy: CREATED_BY,
        },
        {
            title: "Board Meeting Q1 2025 Review",
            date: new Date("2025-01-31"),
            time: "14:00",
            location: "Virtual – Zoom",
            status: "completed",
            attendees: JSON.stringify(["CEO", "Director Finance", "MD Sales", "MD Operations"]),
            momContent:
                "1. Q4 2024 revenue: USD 18.5M, beat target by 8%.\n2. Q1 2025 pipeline: 3 contracted deals worth USD 10.3M.\n3. Cost pressure from rising freight rates – impact on existing CFR contracts.\n4. Plan to diversify to domestic PLN supply to reduce freight exposure.\n5. New credit line of USD 5M approved for working capital.",
            aiSummary:
                "## Board Meeting Q1 2025\n\n**Q4 Result:** Revenue USD 18.5M (+8% vs target). Strong finish.\n\n**Q1 Pipeline:** 3 contracted deals, USD 10.3M total value.\n\n**Risk:** Freight rate increase squeezing CFR margins.\n\n**Strategy:** Domestic supply diversification (PLN); USD 5M credit line approved.\n\n### Key Decisions\n1. Expand domestic market presence\n2. Hedge freight via FFA (to be evaluated by Finance)",
            createdByName: "CEO",
            createdBy: CREATED_BY,
        },
        {
            title: "Supplier KYC Review – Hasnur Group",
            date: new Date("2025-02-05"),
            time: "10:30",
            location: "Meeting Room B",
            status: "completed",
            attendees: JSON.stringify(["Andi Wijaya", "Legal Team", "Budi Santoso (Hasnur)"]),
            momContent:
                "1. IUP document review completed – valid until 2032.\n2. PSI certification current, valid until Dec 2025.\n3. Bank reference letter received.\n4. Site visit scheduled for March 2025.\n5. KYC status upgraded to APPROVED.",
            aiSummary:
                "## Hasnur KYC Review\n\n**Result:** KYC APPROVED.\n\n**Documents Verified:** IUP (valid 2032), PSI cert (Dec 2025), bank reference.\n\n**Next Step:** Site visit March 2025 to confirm stockpile conditions.",
            createdByName: "Andi Wijaya",
            createdBy: CREATED_BY,
        },
        {
            title: "Sales Strategy Planning – Q2 2025",
            date: new Date("2025-03-10"),
            time: "09:00",
            location: "Board Room A",
            status: "scheduled",
            attendees: JSON.stringify(["CEO", "Sales Team", "Logistics", "Finance"]),
            momContent: null,
            aiSummary: null,
            createdByName: "CEO",
            createdBy: CREATED_BY,
        },
    ];

    for (const m of meetings) {
        await prisma.meetingItem.create({ data: m });
    }
    console.log(`   ✅ ${meetings.length} meetings created`);
}

// ─── 10. TASKS ────────────────────────────────────────────────────────────
async function seedTasks() {
    console.log("\n✅ Seeding Tasks...");
    const tasks = [
        {
            title: "Prepare Guangdong Energy Quote",
            description: "Prepare competitive offer for 60,000 MT GAR 4300 coal delivery March 2025. Include freight estimate and margin analysis.",
            status: "in_progress",
            priority: "urgent",
            assigneeName: "Andi Wijaya",
            dueDate: new Date("2025-02-20"),
            createdBy: CREATED_BY,
        },
        {
            title: "Follow up SHP-2025-001 Loading",
            description: "Coordinate with Hasnur jetty to confirm loading completion date for MV Kalimantan Star.",
            status: "in_progress",
            priority: "high",
            assigneeName: "Ahmad Fauzan",
            dueDate: new Date("2025-02-28"),
            createdBy: CREATED_BY,
        },
        {
            title: "Submit KEPCO BL copy to Finance",
            description: "Send original BL, CoQ, and invoice to Finance team for LC utilization.",
            status: "done",
            priority: "high",
            assigneeName: "Dewi Lestari",
            dueDate: new Date("2025-02-12"),
            createdBy: CREATED_BY,
        },
        {
            title: "KYC Onboarding – Guangdong Energy Group",
            description: "Start KYC process for new buyer. Request company profile, bank reference, and trade license.",
            status: "todo",
            priority: "medium",
            assigneeName: "Rini Suryani",
            dueDate: new Date("2025-03-01"),
            createdBy: CREATED_BY,
        },
        {
            title: "Arrange Site Visit – Hasnur Tambang",
            description: "Coordinate logistics for site visit to Hasnur Block A mine in March 2025.",
            status: "todo",
            priority: "medium",
            assigneeName: "Ahmad Fauzan",
            dueDate: new Date("2025-03-10"),
            createdBy: CREATED_BY,
        },
        {
            title: "Review PLN Nusantara Term Sheet",
            description: "Legal review of PLN supply agreement term sheet received Jan 2025.",
            status: "review",
            priority: "high",
            assigneeName: "Legal Team",
            dueDate: new Date("2025-02-25"),
            createdBy: CREATED_BY,
        },
        {
            title: "Update Freight Cost Matrix Q1",
            description: "Update FOB/CFR freight cost estimates for all routes based on latest Clarksons report.",
            status: "todo",
            priority: "low",
            assigneeName: "Andi Wijaya",
            dueDate: new Date("2025-03-05"),
            createdBy: CREATED_BY,
        },
        {
            title: "Prepare Board Report – Feb 2025",
            description: "Monthly board report covering sales, operations, market prices, and P&L.",
            status: "in_progress",
            priority: "high",
            assigneeName: "CEO Office",
            dueDate: new Date("2025-03-03"),
            createdBy: CREATED_BY,
        },
    ];

    for (const t of tasks) {
        await prisma.taskItem.create({ data: t });
    }
    console.log(`   ✅ ${tasks.length} tasks created`);
}

// ─── 11. P&L FORECAST ─────────────────────────────────────────────────────
async function seedPLForecasts() {
    console.log("\n💰 Seeding P&L Forecasts...");
    const forecasts = [
        {
            dealId: "deal-001",
            dealNumber: "DEAL-2025-001",
            projectName: "Huaneng 52K MT Q1 2025",
            buyer: "China Huaneng Group",
            type: "export",
            status: "actual",
            quantity: 52000,
            sellingPrice: 44.5,
            buyingPrice: 38.5,
            freightCost: 2.5,
            otherCost: 0.8,
            grossProfitMt: 2.7,
            totalGrossProfit: 140400,
            createdBy: CREATED_BY,
        },
        {
            dealId: "deal-002",
            dealNumber: "DEAL-2025-002",
            projectName: "KEPCO 65K MT Berau HCV",
            buyer: "KEPCO",
            type: "export",
            status: "actual",
            quantity: 65000,
            sellingPrice: 77.5,
            buyingPrice: 69.0,
            freightCost: 0.0,
            otherCost: 1.2,
            grossProfitMt: 7.3,
            totalGrossProfit: 474500,
            createdBy: CREATED_BY,
        },
        {
            dealId: "deal-003",
            dealNumber: "DEAL-2025-003",
            projectName: "NTPC 48K MT Blended India",
            buyer: "NTPC Limited",
            type: "export",
            status: "actual",
            quantity: 48000,
            sellingPrice: 62.0,
            buyingPrice: 54.5,
            freightCost: 3.2,
            otherCost: 0.9,
            grossProfitMt: 3.4,
            totalGrossProfit: 163200,
            createdBy: CREATED_BY,
        },
        {
            dealId: "deal-004",
            dealNumber: "DEAL-2025-004",
            projectName: "Guangdong 60K MT Q1 Forecast",
            buyer: "Guangdong Energy Group",
            type: "export",
            status: "forecast",
            quantity: 60000,
            sellingPrice: 46.0,
            buyingPrice: 38.5,
            freightCost: 2.8,
            otherCost: 0.7,
            grossProfitMt: 4.0,
            totalGrossProfit: 240000,
            createdBy: CREATED_BY,
        },
        {
            dealId: "deal-005",
            dealNumber: "DEAL-2025-005",
            projectName: "PLN Domestic 30K MT Q2",
            buyer: "PLN Nusantara Power",
            type: "domestic",
            status: "forecast",
            quantity: 30000,
            sellingPrice: 38.0,
            buyingPrice: 34.0,
            freightCost: 0.0,
            otherCost: 0.5,
            grossProfitMt: 3.5,
            totalGrossProfit: 105000,
            createdBy: CREATED_BY,
        },
    ];

    for (const f of forecasts) {
        await prisma.pLForecast.create({ data: f });
    }
    console.log(`   ✅ ${forecasts.length} P&L forecast records created`);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────
async function main() {
    console.log("🌱 === 11GAWE Business OS – Dummy Data Seed ===\n");

    try {
        await clearExistingDummy();
        await seedPartners();
        await seedSources();
        await seedShipments();
        await seedQuality();
        await seedBlending();
        await seedSalesDeals();
        await seedSalesOrders();
        await seedMarketPrices();
        await seedMeetings();
        await seedTasks();
        await seedPLForecasts();

        console.log("\n\n✅ ============================================");
        console.log("   All dummy data seeded successfully!");
        console.log("   Modules covered:");
        console.log("   • Partners & Directory (8 records)");
        console.log("   • Sources / Suppliers  (4 records)");
        console.log("   • Shipment Monitor     (4 records)");
        console.log("   • Quality Results      (5 records)");
        console.log("   • Blending Simulations (3 records)");
        console.log("   • Sales Deals/Projects (5 records)");
        console.log("   • Sales Orders         (4 records)");
        console.log("   • Market Prices        (8 records)");
        console.log("   • Meetings             (4 records)");
        console.log("   • Tasks                (8 records)");
        console.log("   • P&L Forecasts        (5 records)");
        console.log("=============================================\n");
    } catch (error) {
        console.error("❌ Seed failed:", error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
