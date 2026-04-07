const { PrismaClient } = require('@prisma/client');
const xlsx = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();
const BASE_DIR = path.resolve(__dirname, '..');

// File Paths
const FILE_UNIFIED_LOGISTICS = path.join(BASE_DIR, 'Contoh_Excel/MV_Barge_ALL_YEARS_UNIFIED (Merged Sheet MV_Barge&Source).xlsx');
const FILE_UNIFIED_RECAP = path.join(BASE_DIR, 'Contoh_Excel/Consolidated_Delivery_Report (Merged Sheet10. Daily Delevery).xlsx');
// Original Yearly File (for price enrichment)
const FILE_YEARLY_LOG = path.join(BASE_DIR, 'Contoh_Excel/00. MV_Barge&Source 2021,2022, 2023,2024-7-19.xlsx');

// ─── Constants & Enums ───────────────────────────────────────
const SHIPMENT_STATUS_MAP = {
    completed: ['completely discharged', 'done shipment', 'completed', 'sold', 'done'],
    loading: ['loading', 'sailing', 'process', 'barging', 'in transit'],
    upcoming: ['nomination', 'upcoming', 'waiting']
};

// ─── Utility Helpers ──────────────────────────────────────────
function cleanStr(val) {
    if (val === null || val === undefined) return null;
    const s = String(val).trim();
    return s === '' ? null : s;
}

function toFloat(val) {
    if (val === null || val === undefined || val === '') return 0;
    const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.\-]/g, ''));
    return isNaN(n) ? 0 : n;
}

function safeDate(val) {
    if (!val) return null;
    // Excel date might be a serial number
    if (typeof val === 'number' && val > 25569) {
        return new Date((val - 25569) * 86400 * 1000);
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
}

function normalizeStatus(statusText) {
    if (!statusText) return 'upcoming';
    const s = String(statusText).toLowerCase();
    if (SHIPMENT_STATUS_MAP.completed.some(k => s.includes(k))) return 'completed';
    if (SHIPMENT_STATUS_MAP.loading.some(k => s.includes(k))) return 'loading';
    return 'upcoming';
}

function readExcel(filePath) {
    try {
        const wb = xlsx.readFile(filePath);
        const sheet = wb.Sheets[wb.SheetNames[0]];
        return xlsx.utils.sheet_to_json(sheet);
    } catch (e) {
        console.error(`❌ Error reading ${filePath}:`, e.message);
        return [];
    }
}

// ─── Phase 0: Cleanup ────────────────────────────────────────
async function cleanup() {
    console.log('🧹 Cleaning up database...');
    await prisma.dailyDelivery.deleteMany({});
    await prisma.salesDeal.deleteMany({});
    await prisma.shipmentDetail.deleteMany({});
    await prisma.partner.deleteMany({});
    console.log('✅ Cleanup complete.');
}

// ─── Phase 1: Auto-Master Seeding ───────────────────────────
async function seedMasterData(logisticsData, recapData) {
    try {
        console.log('🌱 Seeding Master Data (Partners)...');
        const buyers = new Set();
        const suppliers = new Set();

        logisticsData.forEach(row => {
            const s = cleanStr(row['SOURCE']);
            if (s) suppliers.add(s);
        });
        recapData.forEach(row => {
            const b = cleanStr(row['Buyer']);
            if (b) buyers.add(b);
        });

        console.log(`🔍 Extracted ${buyers.size} unique Buyers and ${suppliers.size} unique Suppliers.`);

        // Create Partners
        let bCount = 0;
        for (const b of buyers) {
            const bid = `partner-buyer-${b.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;
            await prisma.partner.upsert({
                where: { id: bid },
                update: { name: b, type: 'buyer' },
                create: { id: bid, name: b, type: 'buyer', status: 'active' }
            });
            bCount++;
        }
        
        let sCount = 0;
        for (const s of suppliers) {
            const sid = `partner-vendor-${s.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;
            await prisma.partner.upsert({
                where: { id: sid },
                update: { name: s, type: 'vendor' },
                create: { id: sid, name: s, type: 'vendor', status: 'active' }
            });
            sCount++;
        }
        console.log(`✅ Upserted ${bCount} Buyers and ${sCount} Suppliers.`);
    } catch (err) {
        console.error('❌ Error in seedMasterData:', err);
        throw err;
    }
}

// ─── Phase 2: Main Migration ───────────────────────────────
async function migrate() {
    await cleanup();

    const logisticsData = readExcel(FILE_UNIFIED_LOGISTICS);
    const recapData = readExcel(FILE_UNIFIED_RECAP);
    
    console.log(`📊 Found ${logisticsData.length} logistics rows and ${recapData.length} recap rows.`);

    if (logisticsData.length > 0) {
        console.log('DEBUG: Logistics Row 0 Keys:', Object.keys(logisticsData[0]));
    }

    await seedMasterData(logisticsData, recapData);

    // Build Buyer Lookup from Recap Data (Project Name -> Buyer)
    console.log('🔍 Building Buyer lookup from recap data...');
    const buyerLookup = {};
    recapData.forEach(row => {
        const proj = cleanStr(row['Project']);
        const mvNom = cleanStr(row['MV/Barge Nomination']);
        const buyer = cleanStr(row['Buyer']);
        if (proj && buyer) buyerLookup[proj] = buyer;
        if (mvNom && buyer) buyerLookup[mvNom] = buyer;
    });

    // Load Price Map from yearly logs for enrichment
    console.log('🔍 Indexing financial data from yearly logs...');
    const priceMap = {}; // Key: "Year-NO"
    const years = [2021, 2022, 2023, 2024, 2025, 2026];
    
    try {
        const yearlyWb = xlsx.readFile(FILE_YEARLY_LOG);
        years.forEach(year => {
            const sheetName = yearlyWb.SheetNames.find(n => n.includes(String(year)));
            if (sheetName) {
                const data = xlsx.utils.sheet_to_json(yearlyWb.Sheets[sheetName]);
                data.forEach(row => {
                    const no = row['NO'] || row['No'] || row['No.'];
                    if (no) {
                        priceMap[`${year}-${no}`] = {
                            sp: toFloat(row['SP']),
                            fob: toFloat(row['HARGA ACTUAL [FOB BARGE]'] || row['Harga Actual FOB'])
                        };
                    }
                });
            }
        });
    } catch (e) {
        console.warn('⚠️ Yearly logs not found or inaccessible, skipping enrichment.');
    }

    console.log('🚢 Migrating shipments and creating sales deals...');
    let successCount = 0;

    for (const row of logisticsData) {
        const year = row['YEAR'];
        const no = row['NO'];
        if (!year || !no) continue;

        const mvName = cleanStr(row['MV PROJECT NAME'] || row['MV./PROJECT NAME'] || row['MV']);
        const sourceName = cleanStr(row['SOURCE']);
        const nomination = cleanStr(row['NOMINATION']);
        
        // Find Buyer
        const buyerName = buyerLookup[mvName] || buyerLookup[nomination] || 'Unknown Buyer';
        
        const priceInfo = priceMap[`${year}-${no}`] || { sp: 0, fob: 0 };
        const status = normalizeStatus(row['SHIPMENT STATUS'] || row['STATUS']);

        try {
            // Find Partner ID
            const partnerId = buyerName !== 'Unknown Buyer' ? `partner-buyer-${buyerName.replace(/[^a-z0-9]/gi, '_')}` : undefined;

            // 1. Create ShipmentDetail
            const shipment = await prisma.shipmentDetail.create({
                data: {
                    no: parseInt(no),
                    year: parseInt(year),
                    mvProjectName: mvName,
                    buyer: buyerName,
                    source: sourceName,
                    qtyPlan: toFloat(row['QTY PLAN']),
                    quantityLoaded: toFloat(row['QTY ACTUAL']),
                    shipmentStatus: status,
                    laycan: String(row['LAYCAN'] || ''),
                    nomination: nomination,
                    blDate: safeDate(row['BL DATE']),
                    exportDmo: row['EXPORT DMO'] || 'EXPORT'
                }
            });

            // 2. Create SalesDeal Parallel (Confirmed)
            await prisma.salesDeal.upsert({
                where: { dealNumber: `SD-${year}-${no}` },
                update: {
                    quantity: { increment: toFloat(row['QTY ACTUAL'] || row['QTY PLAN']) },
                    totalValue: { increment: (toFloat(row['QTY ACTUAL'] || row['QTY PLAN'])) * (priceInfo.sp || priceInfo.fob || 50) }
                },
                create: {
                    dealNumber: `SD-${year}-${no}`,
                    status: 'confirmed',
                    buyer: buyerName,
                    quantity: toFloat(row['QTY ACTUAL'] || row['QTY PLAN']),
                    pricePerMt: priceInfo.sp || priceInfo.fob || 50, 
                    totalValue: (toFloat(row['QTY ACTUAL'] || row['QTY PLAN'])) * (priceInfo.sp || priceInfo.fob || 50),
                    type: (row['EXPORT DMO'] || '').toLowerCase().includes('dmo') ? 'local' : 'export',
                    shippingTerms: 'FOB',
                    createdBy: 'system',
                    partnerId: partnerId
                }
            });

            successCount++;
        } catch (err) {
            console.error(`❌ Error migrating row ${year}-${no}:`, err.message);
        }
    }

    console.log(`✅ Successfully migrated ${successCount} shipments and sales deals.`);

    // Phase 3: Recap Delivery
    console.log('📝 Migrating Daily Delivery records...');
    let recapCount = 0;
    for (const row of recapData) {
        try {
            const b = cleanStr(row['Buyer']);
            const partnerId = b ? `partner-buyer-${b.replace(/[^a-z0-9]/gi, '_')}` : undefined;

            await prisma.dailyDelivery.create({
                data: {
                    reportType: (row['Shipment_Type'] || 'EXPORT').toLowerCase(),
                    year: parseInt(row['Year']) || 2025,
                    buyer: b,
                    area: cleanStr(row['Area']),
                    pol: cleanStr(row['POL']),
                    pod: cleanStr(row['POD']),
                    shippingTerm: cleanStr(row['Shipping Term']),
                    mvBargeNomination: cleanStr(row['MV/Barge Nomination']),
                    shipmentStatus: normalizeStatus(row['Shipment_Status']),
                    blQuantity: toFloat(row['QTY'] || row['QTY ACTUAL'] || row['BL Quantity']), 
                    blDate: safeDate(row['Laycan_at_POL'] || row['BL DATE']),
                }
            });
            recapCount++;
        } catch (err) {
            // silent fail for duplicates
        }
    }
    console.log(`✅ Successfully migrated ${recapCount} daily delivery records.`);
}
migrate()
    .catch(err => console.error('FATAL ERROR:', err))
    .finally(() => prisma.$disconnect());
