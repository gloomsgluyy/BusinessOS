const { PrismaClient } = require('@prisma/client');
const xlsx = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();
const BASE_DIR = path.resolve(__dirname, '..');

// File Paths
const FILE_UNIFIED_LOGISTICS = path.join(BASE_DIR, 'Contoh_Excel/MV_Barge_ALL_YEARS_UNIFIED (Merged Sheet MV_Barge&Source).xlsx');
const FILE_UNIFIED_RECAP = path.join(BASE_DIR, 'Contoh_Excel/Consolidated_Delivery_Report (Merged Sheet10. Daily Delevery).xlsx');
const FILE_YEARLY_LOG = path.join(BASE_DIR, 'Contoh_Excel/00. MV_Barge&Source 2021,2022, 2023,2024-7-19.xlsx');

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
    if (typeof val === 'number' && val > 25569) { // Excel date
        return new Date((val - 25569) * 86400 * 1000);
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
}

function parseSmartDate(row) {
    // 1. Try BL DATE
    let d = safeDate(row['BL DATE'] || row['BL Date'] || row['bl_date']);
    if (d) return d;

    // 2. Try extract from LAYCAN if YEAR is present
    const laycan = cleanStr(row['LAYCAN'] || row['Laycan']);
    const year = parseInt(row['YEAR'] || row['Year']);
    if (laycan && !isNaN(year)) {
        const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        const upper = laycan.toUpperCase();
        for (let i = 0; i < months.length; i++) {
            if (upper.includes(months[i])) {
                // Return middle of month
                return new Date(year, i, 15);
            }
        }
    }

    // 3. Last fallback: Middle of the year
    if (!isNaN(year)) return new Date(year, 5, 15);

    return null;
}

function readExcel(filePath) {
    try {
        console.log(`Reading ${path.basename(filePath)}...`);
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
    console.log('🧹 Cleaning up database (Fresh Start)...');
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

    // 1. Build Recap Lookup (Project -> Data)
    const recapLookup = {};
    recapDataRaw.forEach(row => {
        const proj = cleanStr(row['Project']);
        const mvNom = cleanStr(row['MV/Barge Nomination']);
        if (proj && !recapLookup[proj]) recapLookup[proj] = row;
        if (mvNom && !recapLookup[mvNom]) recapLookup[mvNom] = row;
    });

    // 2. Load Prices from Yearly Log
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
    } catch (e) {
        console.warn('⚠️ Pricing log not found or error reading prices.');
    }

    // 3. Extract & Create Partners (Buyers & Suppliers)
    console.log('👥 Processing Partners...');
    const partnerNames = new Set();
    logisticsDataRaw.forEach(row => {
        const b = cleanStr(row['BUYER']);
        const s = cleanStr(row['SOURCE']);
        if (b) partnerNames.add(JSON.stringify({ name: b, type: 'buyer' }));
        if (s) partnerNames.add(JSON.stringify({ name: s, type: 'vendor' }));
    });

    for (const pStr of partnerNames) {
        const p = JSON.parse(pStr);
        await prisma.partner.create({
            data: {
                name: p.name,
                type: p.type,
                status: 'active'
            }
        });
    }
    console.log(`✅ Created ${partnerNames.size} partners.`);

    // 4. Migrate Main Data
    console.log('🚢 Migrating Shipment & Sales Data...');
    let successCount = 0;
    
    for (const row of logisticsDataRaw) {
        try {
            const yearStr = cleanStr(row['YEAR']);
            const noStr = cleanStr(row['NO']);
            if (!yearStr || !noStr) continue;

            const year = parseInt(yearStr);
            const no = parseInt(noStr);
            const dealNo = `SD-${year}-${no}`;
            
            const recapEntry = recapLookup[cleanStr(row['MV/PROJECT NAME'])] || recapLookup[cleanStr(row['NOMINATION'])] || {};
            const priceInfo = priceMap[`${year}-${no}`] || { sp: 0, fob: 0 };
            
            const buyerName = cleanStr(row['BUYER']) || cleanStr(recapEntry['Buyer']) || 'Unknown Buyer';
            const qty = toFloat(row['QTY ACTUAL'] || row['QTY PLAN']);
            const sp = priceInfo.sp || 50;

            const marketStr = (cleanStr(row['EXPORT DMO']) || '').toUpperCase();
            const type = (marketStr.includes('DOMESTIC') || marketStr.includes('DMO') || marketStr.includes('LOCAL') || marketStr.includes('DOMESTIK') || marketStr.includes('LOKAL')) ? 'local' : 'export';
            
            // Extract country from POD
            const pod = cleanStr(row['POD'] || recapEntry['POD']) || '';
            let country = type === 'local' ? 'Indonesia' : 'Unknown';
            if (type === 'export') {
                const podUpper = pod.toUpperCase();
                if (podUpper.includes('CHINA')) country = 'China';
                else if (podUpper.includes('INDIA')) country = 'India';
                else if (podUpper.includes('VIETNAM')) country = 'Vietnam';
                else if (podUpper.includes('THAILAND')) country = 'Thailand';
                else if (podUpper.includes('KOREA')) country = 'South Korea';
                else if (podUpper.includes('JAPAN')) country = 'Japan';
                else if (podUpper.includes('MALAYSIA')) country = 'Malaysia';
                else if (podUpper.includes('PHILIPPINES')) country = 'Philippines';
            }

            // A. Create Shipment Detail (Target: 40+ fields)
            const shipment = await prisma.shipmentDetail.create({
                data: {
                    no: no,
                    year: year,
                    exportDmo: type === 'local' ? 'DOMESTIC' : 'EXPORT',
                    status: (cleanStr(row['STATUS']) || 'upcoming').toLowerCase().includes('done') ? 'completed' : 'loading',
                    origin: cleanStr(row['ORIGIN']),
                    mvProjectName: cleanStr(row['MV/PROJECT NAME']),
                    source: cleanStr(row['SOURCE']) || cleanStr(recapEntry['Supplier']),
                    iupOp: cleanStr(row['IUP/OP']),
                    shipmentFlow: cleanStr(row['SHIPMENT FLOW']),
                    jettyLoadingPort: cleanStr(row['JETTY LOADING PORT']) || cleanStr(recapEntry['POL']),
                    laycan: cleanStr(row['LAYCAN']),
                    nomination: cleanStr(row['NOMINATION']),
                    qtyPlan: toFloat(row['QTY PLAN']),
                    qtyCob: toFloat(row['QTY COB']),
                    remarks: cleanStr(row['REMARKS']),
                    hargaActualFob: priceInfo.fob,
                    hargaActualFobMv: priceInfo.sp,
                    hpb: toFloat(row['HPB']),
                    statusHpb: cleanStr(row['STATUS HPB']),
                    shipmentStatus: cleanStr(row['SHIPMENT STATUS']),
                    issueNotes: cleanStr(row['ISSUE NOTES']) || cleanStr(recapEntry['Issue']),
                    blDate: parseSmartDate(row),
                    pic: cleanStr(row['PIC']),
                    kuotaExport: cleanStr(row['KUOTA EKSPOR']),
                    surveyorLhv: cleanStr(row['SURVEYOR LHV']),
                    completelyLoaded: cleanStr(row['COMPLETELY LOADED']) === 'YES' ? new Date() : null,
                    lhvTerbit: cleanStr(row['LHV TERBIT']) === 'YES' ? new Date() : null,
                    lossGainCargo: toFloat(row['LOSS GAIN CARGO']),
                    sp: sp,
                    deadfreight: toFloat(row['DEADFREIGHT']),
                    jarak: toFloat(row['JARAK']),
                    shippingTerm: cleanStr(row['SHIPPING TERM']) || cleanStr(recapEntry['Shipping Term']),
                    shippingRate: toFloat(row['SHIPPING RATE']),
                    priceFreight: toFloat(row['PRICE FREIGHT']),
                    allowance: cleanStr(row['ALLOWANCE']),
                    demm: cleanStr(row['DEMM']),
                    noSpal: cleanStr(row['NO SPAL']),
                    noSi: cleanStr(row['NO SI']),
                    coaDate: safeDate(row['COA DATE']),
                    resultGar: toFloat(row['RESULT GAR']),
                    // Link-ready fields
                    buyer: buyerName,
                    type: type,
                    vesselName: cleanStr(row['NOMINATION']),
                    loadingPort: cleanStr(row['JETTY LOADING PORT']),
                    dischargePort: cleanStr(row['DISCHARGE PORT']) || cleanStr(recapEntry['POD']),
                    product: cleanStr(recapEntry['Product']) || 'Coal',
                    quantityLoaded: qty,
                    salesPrice: sp,
                    marginMt: (sp - priceInfo.fob) || 2.42, 
                }
            });

            // B. Create/Upsert SalesDeal (Crucial for Dashboard Revenue)
            // Note: We use SD-YEAR-NO as a consistent reference
            await prisma.salesDeal.upsert({
                where: { dealNumber: dealNo },
                update: {
                    quantity: { increment: qty },
                    totalValue: { increment: qty * sp }
                },
                create: {
                    dealNumber: dealNo,
                    status: 'confirmed', // Mark confirmed so it shows in revenue
                    buyer: buyerName,
                    type: type,
                    shippingTerms: cleanStr(row['SHIPPING TERM']) || 'FOB',
                    quantity: qty,
                    pricePerMt: sp,
                    totalValue: qty * sp,
                    vesselName: cleanStr(row['NOMINATION']),
                    projectId: cleanStr(row['MV/PROJECT NAME']),
                    createdBy: 'system'
                }
            });

            successCount++;
            if (successCount % 100 === 0) console.log(`🚀 Migrated ${successCount} records...`);

        } catch (err) {
            console.error(`❌ Error migrating row:`, err.message);
        }
    }

    console.log(`\n✅ Migration Finished Successfully!`);
    console.log(`✨ Total Shipments: ${await prisma.shipmentDetail.count()}`);
    console.log(`💰 Total Sales Deals: ${await prisma.salesDeal.count()}`);
    console.log(`🤝 Total Partners: ${await prisma.partner.count()}`);
}

migrate()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
