const { PrismaClient } = require('@prisma/client');
const xlsx = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();
const BASE_DIR = path.resolve(__dirname, '..');

// File Paths
const FILE_UNIFIED_LOGISTICS = path.join(BASE_DIR, 'Contoh_Excel/MV_Barge_ALL_YEARS_UNIFIED (Merged Sheet MV_Barge&Source).xlsx');
const FILE_UNIFIED_RECAP = path.join(BASE_DIR, 'Contoh_Excel/Consolidated_Delivery_Report (Merged Sheet10. Daily Delevery).xlsx');
const FILE_YEARLY_LOG = path.join(BASE_DIR, 'Contoh_Excel/00. MV_Barge&Source 2021,2022, 2023,2024-7-19.xlsx');

// ─── Constants & Enums ───────────────────────────────────────
const SHIPMENT_STATUS_MAP = {
    completed: ['completely discharged', 'done shipment', 'completed', 'sold', 'done', 'discharged', 'complete'],
    loading: ['loading', 'sailing', 'process', 'barging', 'in transit', 'on voyage'],
    upcoming: ['nomination', 'upcoming', 'waiting', 'plan']
};

// ─── Utility Helpers ──────────────────────────────────────────
function cleanStr(val) {
    if (val === null || val === undefined) return null;
    let s = String(val).trim();
    return s === '' || s.toLowerCase() === 'nan' ? null : s;
}

function toFloat(val) {
    if (val === null || val === undefined || val === '') return 0;
    const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.\-]/g, ''));
    return isNaN(n) ? 0 : n;
}

function safeDate(val) {
    if (!val) return null;
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
        return xlsx.utils.sheet_to_json(sheet, { defval: null });
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

// ─── Phase 1: Migration ──────────────────────────────────────
async function migrate() {
    await cleanup();

    const logisticsDataRaw = readExcel(FILE_UNIFIED_LOGISTICS);
    const recapDataRaw = readExcel(FILE_UNIFIED_RECAP);
    
    console.log(`📊 Loaded ${logisticsDataRaw.length} logistics rows and ${recapDataRaw.length} recap rows.`);

    // Build Recap Lookup
    const recapLookup = {};
    recapDataRaw.forEach(row => {
        const proj = cleanStr(row['Project']);
        const mvNom = cleanStr(row['MV/Barge Nomination']);
        if (proj && !recapLookup[proj]) recapLookup[proj] = row;
        if (mvNom && !recapLookup[mvNom]) recapLookup[mvNom] = row;
    });

    // Load Prices
    const priceMap = {};
    try {
        const yearlyWb = xlsx.readFile(FILE_YEARLY_LOG);
        [2021, 2022, 2023, 2024, 2025, 2026].forEach(year => {
            const sheetName = yearlyWb.SheetNames.find(n => n.includes(String(year)));
            if (sheetName) {
                const data = xlsx.utils.sheet_to_json(yearlyWb.Sheets[sheetName]);
                data.forEach(row => {
                    const no = row['NO'] || row['No'] || row['No.'];
                    if (no) priceMap[`${year}-${no}`] = {
                        sp: toFloat(row['SP']),
                        fob: toFloat(row['HARGA ACTUAL [FOB BARGE]'] || row['Harga Actual FOB'])
                    };
                });
            }
        });
    } catch (e) {}

    console.log('🚢 Migrating Shipment Data...');
    let successCount = 0;

    for (const row of logisticsDataRaw) {
        const year = parseInt(row['YEAR']);
        const no = parseInt(row['NO']);
        if (!year || isNaN(no)) continue;

        const mvName = cleanStr(row['MV PROJECT NAME'] || row['MV./PROJECT NAME'] || row['MV']);
        const nomination = cleanStr(row['NOMINATION'] || row['Barge Name']);
        
        const recapEntry = recapLookup[mvName] || recapLookup[nomination] || {};
        const buyerName = cleanStr(row['BUYER']) || cleanStr(recapEntry['Buyer']) || 'Unknown Buyer';
        
        const priceInfo = priceMap[`${year}-${no}`] || { sp: 0, fob: 0 };
        const status = normalizeStatus(row['SHIPMENT STATUS'] || row['STATUS'] || row['Shipment_Status']);

        try {
            // 1. ShipmentDetail
            await prisma.shipmentDetail.create({
                data: {
                    no: no,
                    year: year,
                    exportDmo: cleanStr(row['EXPORT DMO']) || cleanStr(recapEntry['Shipment_Type']) || 'EXPORT',
                    status: status,
                    origin: cleanStr(row['ORIGIN']) || cleanStr(recapEntry['Area']),
                    mvProjectName: mvName,
                    source: cleanStr(row['SOURCE']),
                    iupOp: cleanStr(row['IUP OP']),
                    shipmentFlow: cleanStr(row['SHIPMENT FLOW']) || cleanStr(recapEntry['Flow']),
                    jettyLoadingPort: cleanStr(row['JETTY LOADING PORT'] || row['JETTY / LOADING PORT']) || cleanStr(recapEntry['POL']),
                    loadingPort: cleanStr(row['JETTY LOADING PORT'] || row['JETTY / LOADING PORT']) || cleanStr(recapEntry['POL']),
                    dischargePort: cleanStr(recapEntry['POD']) || 'TBA',
                    laycan: cleanStr(row['LAYCAN']) || cleanStr(recapEntry['Laycan_at_POL']),
                    nomination: nomination,
                    qtyPlan: toFloat(row['QTY PLAN']),
                    quantityLoaded: toFloat(row['QTY ACTUAL']),
                    remarks: cleanStr(row['REMARKS']),
                    blDate: safeDate(row['BL DATE']) || safeDate(recapEntry['Data_Loaded_Date']),
                    resultGar: toFloat(row['RESULT GAR (ARB)'] || row['Calorie']),
                    buyer: buyerName,
                    salesPrice: priceInfo.sp || 50,
                    marginMt: (priceInfo.sp - priceInfo.fob) || 5,
                    product: cleanStr(recapEntry['Product']),
                    analysisMethod: cleanStr(recapEntry['Analysis Method']),
                    type: (cleanStr(row['EXPORT DMO']) || '').toLowerCase().includes('dmo') ? 'local' : 'export'
                }
            });

            // 2. SalesDeal
            await prisma.salesDeal.upsert({
                where: { dealNumber: `SD-${year}-${no}` },
                update: {
                    quantity: { increment: toFloat(row['QTY ACTUAL'] || row['QTY PLAN']) }
                },
                create: {
                    dealNumber: `SD-${year}-${no}`,
                    status: 'confirmed',
                    buyer: buyerName,
                    quantity: toFloat(row['QTY ACTUAL'] || row['QTY PLAN']),
                    pricePerMt: priceInfo.sp || 50,
                    totalValue: (toFloat(row['QTY ACTUAL'] || row['QTY PLAN'])) * (priceInfo.sp || 50),
                    type: (cleanStr(row['EXPORT DMO']) || '').toLowerCase().includes('dmo') ? 'local' : 'export',
                    shippingTerms: cleanStr(recapEntry['Shipping Term']) || 'FOB',
                    createdBy: 'system'
                }
            });

            successCount++;
        } catch (err) {
            console.error(`❌ Error migrating row ${year}-${no}:`, err.message);
        }
    }

    console.log(`✅ Successfully migrated ${successCount} shipments.`);

    // ── Phase 2: Daily Delivery ──────────────────────────────
    console.log('📝 Migrating Daily Delivery records...');
    let recapCount = 0;
    for (const row of recapDataRaw) {
        try {
            await prisma.dailyDelivery.create({
                data: {
                    reportType: (row['Shipment_Type'] || 'EXPORT').toLowerCase(),
                    year: parseInt(row['Year']) || 2025,
                    buyer: cleanStr(row['Buyer']),
                    area: cleanStr(row['Area']),
                    pol: cleanStr(row['POL']),
                    pod: cleanStr(row['POD']),
                    shippingTerm: cleanStr(row['Shipping Term']),
                    mvBargeNomination: cleanStr(row['MV/Barge Nomination']),
                    shipmentStatus: normalizeStatus(row['Shipment_Status']),
                    blQuantity: toFloat(row['QTY'] || row['QTY ACTUAL']), 
                    blDate: safeDate(row['Laycan_at_POL']),
                    product: cleanStr(row['Product']),
                    flow: cleanStr(row['Flow']),
                    project: cleanStr(row['Project']),
                    analysisMethod: cleanStr(row['Analysis Method'])
                }
            });
            recapCount++;
        } catch (err) {}
    }
    console.log(`✅ Successfully migrated ${recapCount} daily delivery records.`);
}

migrate()
    .catch(err => console.error('FATAL ERROR:', err))
    .finally(() => prisma.$disconnect());
