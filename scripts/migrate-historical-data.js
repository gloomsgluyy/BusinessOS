/**
 * Historical Data Migration Script
 * 
 * Migrates 2,157+ rows of historical data from Excel to Production Neon DB
 * Strategy: Clean & Load (removes dummy data, loads verified historical records)
 * 
 * Data Sources:
 * 1. 10.Daily Delivery Report (Recap Shipment) 2020-2026.xlsx
 * 2. 00. MV_Barge&Source 2021,2022, 2023,2024-7-19.xlsx
 */

const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

// ============================================================================
// Configuration: Column Mappings
// ============================================================================

const MV_BARGE_CONFIG = {
  '2024': {
    sheetName: 'MV_Barge&Source 2024',
    headerRowIndex: 4,
    dataStartRowIndex: 5,
  },
  '2025': {
    sheetName: 'MV_Barge&Source 2025',
    headerRowIndex: 4,
    dataStartRowIndex: 5,
  },
  '2026': {
    sheetName: ' MV_Barge&Source 2026', // Note: leading space
    headerRowIndex: 4,
    dataStartRowIndex: 5,
  },
};

const DAILY_DELIVERY_CONFIG = {
  '2020': {
    sheetName: 'DOMESTIK KLT, KALSEL SUMSEL 20',
    headerRowIndex: 1,
    dataStartRowIndex: 2,
  },
  // NOTE: Years 2021-2024 do not exist as separate sheets in the Excel file
  // Only 2020, 2025, 2026 sheets are present
  '2025': {
    sheetName: 'DOM_EXPORT SUMSEL KALSEL 2025',
    headerRowIndex: 1,
    dataStartRowIndex: 2,
  },
  '2026': {
    sheetName: 'DOM_EXPORT SUMSEL KALSEL 2026',
    headerRowIndex: 1,
    dataStartRowIndex: 2,
  },
};

// Partner name normalization map (Smart Lookup)
const PARTNER_ALIASES = {
  'PT. MME': 'PT Manambang Muara Enim',
  'MME': 'PT Manambang Muara Enim',
  'Manambang': 'PT Manambang Muara Enim',
  'PT MME': 'PT Manambang Muara Enim',
  'PT. Bumi Merapi': 'PT Bumi Merapi Energi',
  'BME': 'PT Bumi Merapi Energi',
  'PT BME': 'PT Bumi Merapi Energi',
};

// ============================================================================
// Helper Functions
// ============================================================================

function normalizePartnerName(name) {
  if (!name) return 'Unknown';
  const trimmed = name.toString().trim();
  return PARTNER_ALIASES[trimmed] || trimmed;
}

function parseExcelDate(value) {
  if (!value) return null;
  
  if (value instanceof Date) {
    return value;
  }
  
  // Excel serial date number
  if (typeof value === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    return date;
  }
  
  // String date in DD/MM/YYYY format
  if (typeof value === 'string') {
    const parts = value.split(/[\/\-\.]/);
    if (parts.length === 3) {
      // Try DD/MM/YYYY (Indonesian format)
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month, day);
      }
    }
    
    // Fallback to standard parsing
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  
  return null;
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
}

function findColumnIndex(headerRow, columnNames) {
  for (const name of columnNames) {
    const normalized = name.trim().toUpperCase();
    const index = headerRow.findIndex(h => 
      h?.toString().trim().toUpperCase() === normalized
    );
    if (index !== -1) return index;
  }
  return -1;
}

function isEmptyRow(row) {
  if (!row) return true;
  const firstCell = row[0];
  if (!firstCell) return true;
  const str = String(firstCell).trim().toUpperCase();
  // Skip summary rows
  if (str === 'TOTAL' || str === 'GRAND TOTAL' || str === '') return true;
  return false;
}

// ============================================================================
// Phase 1: Extract Partners from Excel
// ============================================================================

async function extractPartnersFromExcel() {
  console.log('\n📊 PHASE 1: Extracting Partners from Excel...');
  
  const partnersMap = new Map();
  
  // Extract from MV Barge file
  const mvBargeFile = path.join(process.cwd(), '00. MV_Barge&Source 2021,2022, 2023,2024-7-19.xlsx');
  if (fs.existsSync(mvBargeFile)) {
    const workbook = XLSX.readFile(mvBargeFile, { cellDates: true });
    
    for (const [year, config] of Object.entries(MV_BARGE_CONFIG)) {
      const sheet = workbook.Sheets[config.sheetName];
      if (!sheet) {
        console.log(`⚠️  Sheet not found: ${config.sheetName}`);
        continue;
      }
      
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
      const headerRow = data[config.headerRowIndex] || [];
      
      const buyerIdx = findColumnIndex(headerRow, ['BUYER']);
      const supplierIdx = findColumnIndex(headerRow, ['IUP OP', 'SOURCE']);
      
      for (let i = config.dataStartRowIndex; i < data.length; i++) {
        const row = data[i];
        if (isEmptyRow(row)) continue;
        
        if (buyerIdx !== -1 && row[buyerIdx]) {
          const buyerName = normalizePartnerName(String(row[buyerIdx]));
          if (buyerName !== 'Unknown') {
            partnersMap.set(buyerName, { name: buyerName, type: 'buyer' });
          }
        }
        
        if (supplierIdx !== -1 && row[supplierIdx]) {
          const supplierName = normalizePartnerName(String(row[supplierIdx]));
          if (supplierName !== 'Unknown') {
            partnersMap.set(supplierName, { name: supplierName, type: 'vendor' });
          }
        }
      }
      
      console.log(`✓ Processed MV Barge ${year}: ${data.length - config.dataStartRowIndex} rows`);
    }
  }
  
  // Extract from Daily Delivery file
  const dailyFile = path.join(process.cwd(), '10.Daily Delivery Report (Recap Shipment) 2020, 2021, 2022, 2023, 2024, 2025, 2026.xlsx');
  if (fs.existsSync(dailyFile)) {
    const workbook = XLSX.readFile(dailyFile, { cellDates: true });
    
    for (const [year, config] of Object.entries(DAILY_DELIVERY_CONFIG)) {
      const sheet = workbook.Sheets[config.sheetName];
      if (!sheet) {
        console.log(`⚠️  Sheet not found: ${config.sheetName}`);
        continue;
      }
      
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
      const headerRow = data[config.headerRowIndex] || [];
      
      const buyerIdx = findColumnIndex(headerRow, ['Buyer', 'Project / Buyer', 'Project Name']);
      const supplierIdx = findColumnIndex(headerRow, ['Source', 'Supplier']);
      
      for (let i = config.dataStartRowIndex; i < data.length; i++) {
        const row = data[i];
        if (isEmptyRow(row)) continue;
        
        if (buyerIdx !== -1 && row[buyerIdx]) {
          const buyerName = normalizePartnerName(String(row[buyerIdx]));
          if (buyerName !== 'Unknown') {
            partnersMap.set(buyerName, { name: buyerName, type: 'buyer' });
          }
        }
        
        if (supplierIdx !== -1 && row[supplierIdx]) {
          const supplierName = normalizePartnerName(String(row[supplierIdx]));
          if (supplierName !== 'Unknown') {
            partnersMap.set(supplierName, { name: supplierName, type: 'vendor' });
          }
        }
      }
      
      console.log(`✓ Processed Daily Delivery ${year}: ${data.length - config.dataStartRowIndex} rows`);
    }
  }
  
  console.log(`\n✅ Found ${partnersMap.size} unique partners`);
  return partnersMap;
}

// ============================================================================
// Phase 2: Seed Partners to Database
// ============================================================================

async function seedPartners(partnersMap) {
  console.log('\n🌱 PHASE 2: Seeding Partners to Database...');
  
  const partnerIdMap = new Map();
  
  for (const [name, entry] of partnersMap.entries()) {
    // Check if partner already exists
    const existing = await prisma.partner.findFirst({
      where: { name, isDeleted: false },
    });
    
    if (existing) {
      partnerIdMap.set(name, existing.id);
      console.log(`  • ${name} (existing)`);
    } else {
      const created = await prisma.partner.create({
        data: {
          name,
          type: entry.type,
          status: 'active',
        },
      });
      partnerIdMap.set(name, created.id);
      console.log(`  ✓ ${name} (created)`);
    }
  }
  
  console.log(`\n✅ Seeded ${partnerIdMap.size} partners`);
  return partnerIdMap;
}

// ============================================================================
// Phase 3: Clean Dummy Data
// ============================================================================

async function cleanDummyData() {
  console.log('\n🧹 PHASE 3: Cleaning Dummy Data...');
  
  // Delete ShipmentDetail records
  const deletedShipments = await prisma.shipmentDetail.deleteMany({});
  console.log(`  ✓ Deleted ${deletedShipments.count} ShipmentDetail records`);
  
  // Delete DailyDelivery records
  const deletedDeliveries = await prisma.dailyDelivery.deleteMany({});
  console.log(`  ✓ Deleted ${deletedDeliveries.count} DailyDelivery records`);
  
  // Delete QualityResult records
  const deletedQuality = await prisma.qualityResult.deleteMany({});
  console.log(`  ✓ Deleted ${deletedQuality.count} QualityResult records`);
  
  console.log('\n✅ Database cleaned (ready for fresh data)');
}

// ============================================================================
// Phase 4: Load ShipmentDetail (from MV Barge file)
// ============================================================================

async function loadShipmentDetails(partnerIdMap) {
  console.log('\n📦 PHASE 4: Loading ShipmentDetail records...');
  
  const mvBargeFile = path.join(process.cwd(), '00. MV_Barge&Source 2021,2022, 2023,2024-7-19.xlsx');
  if (!fs.existsSync(mvBargeFile)) {
    console.log('⚠️  MV Barge file not found, skipping...');
    return 0;
  }
  
  const workbook = XLSX.readFile(mvBargeFile, { cellDates: true });
  const records = [];
  
  for (const [year, config] of Object.entries(MV_BARGE_CONFIG)) {
    const sheet = workbook.Sheets[config.sheetName];
    if (!sheet) continue;
    
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    const headerRow = data[config.headerRowIndex] || [];
    
    // Diagnostic: Log header row for debugging
    console.log(`\n  📋 ${config.sheetName} headers (first 10):`, headerRow.slice(0, 10).map(h => `"${h}"`));
    
    // Find column indices
    const noIdx = findColumnIndex(headerRow, ['NO']);
    const exportDmoIdx = findColumnIndex(headerRow, ['EXPORT / DMO']);
    const statusIdx = findColumnIndex(headerRow, ['STATUS']);
    const originIdx = findColumnIndex(headerRow, ['ORIGIN']);
    const mvProjectIdx = findColumnIndex(headerRow, ['MV./PROJECT NAME']);
    const sourceIdx = findColumnIndex(headerRow, ['SOURCE']);
    const iupOpIdx = findColumnIndex(headerRow, ['IUP OP']);
    const flowIdx = findColumnIndex(headerRow, ['SHIPMENT FLOW']);
    const jettyIdx = findColumnIndex(headerRow, ['JETTY / LOADING PORT', 'JETTY']);
    const laycanIdx = findColumnIndex(headerRow, ['LAYCAN']);
    const nominationIdx = findColumnIndex(headerRow, ['NOMINATION']);
    const qtyIdx = findColumnIndex(headerRow, ['QTY (MT)', 'QTY']);
    const cobIdx = findColumnIndex(headerRow, ['COB']);
    const blDateIdx = findColumnIndex(headerRow, ['BL DATE']);
    const hargaIdx = findColumnIndex(headerRow, ['HARGA ACTUAL']);
    const hpbIdx = findColumnIndex(headerRow, ['HPB']);
    const spIdx = findColumnIndex(headerRow, ['SP']);
    const shipmentStatusIdx = findColumnIndex(headerRow, ['SHIPMENT STATUS']);
    const picIdx = findColumnIndex(headerRow, ['PIC', 'PIC ', 'pic']);
    const buyerIdx = findColumnIndex(headerRow, ['BUYER', 'Buyer', 'buyer']);
    const garIdx = findColumnIndex(headerRow, ['RESULT GAR (ARB)', 'RESULT GAR', 'GAR', 'Gar', 'gar']);
    
    // Diagnostic: Report missing columns
    const missingCols = [];
    if (buyerIdx === -1) missingCols.push('BUYER');
    if (blDateIdx === -1) missingCols.push('BL DATE');
    if (qtyIdx === -1) missingCols.push('QTY');
    if (missingCols.length > 0) {
      console.log(`  ⚠️  Missing columns in ${config.sheetName}:`, missingCols.join(', '));
    }
    
    for (let i = config.dataStartRowIndex; i < data.length; i++) {
      const row = data[i];
      if (isEmptyRow(row)) continue;
      
      const buyerName = normalizePartnerName(row[buyerIdx]);
      const supplierName = normalizePartnerName(row[iupOpIdx]);
      
      // Check if critical data is truly missing (not just column not found)
      const hasBuyer = buyerIdx !== -1 && row[buyerIdx];
      const hasBlDate = blDateIdx !== -1 && row[blDateIdx];
      const hasQuantity = qtyIdx !== -1 && row[qtyIdx];
      
      const record = {
        no: noIdx !== -1 ? parseNumber(row[noIdx]) : null,
        exportDmo: exportDmoIdx !== -1 ? String(row[exportDmoIdx] || '').trim() : null,
        status: statusIdx !== -1 ? String(row[statusIdx] || 'upcoming').trim() : 'upcoming',
        origin: originIdx !== -1 ? String(row[originIdx] || '').trim() : null,
        mvProjectName: mvProjectIdx !== -1 ? String(row[mvProjectIdx] || '').trim() : null,
        source: sourceIdx !== -1 ? String(row[sourceIdx] || '').trim() : null,
        iupOp: iupOpIdx !== -1 ? String(row[iupOpIdx] || '').trim() : null,
        shipmentFlow: flowIdx !== -1 ? String(row[flowIdx] || '').trim() : null,
        jettyLoadingPort: jettyIdx !== -1 ? String(row[jettyIdx] || '').trim() : null,
        laycan: laycanIdx !== -1 ? String(row[laycanIdx] || '').trim() : null,
        nomination: nominationIdx !== -1 ? String(row[nominationIdx] || '').trim() : null,
        qtyPlan: qtyIdx !== -1 ? parseNumber(row[qtyIdx]) : null,
        qtyCob: cobIdx !== -1 ? parseNumber(row[cobIdx]) : null,
        blDate: blDateIdx !== -1 ? parseExcelDate(row[blDateIdx]) : null,
        hargaActualFob: hargaIdx !== -1 ? parseNumber(row[hargaIdx]) : null,
        hpb: hpbIdx !== -1 ? parseNumber(row[hpbIdx]) : null,
        sp: spIdx !== -1 ? parseNumber(row[spIdx]) : null,
        shipmentStatus: shipmentStatusIdx !== -1 ? String(row[shipmentStatusIdx] || '').trim() : null,
        pic: picIdx !== -1 ? String(row[picIdx] || '').trim() : null,
        buyer: hasBuyer ? buyerName : null,
        resultGar: garIdx !== -1 ? parseNumber(row[garIdx]) : null,
        year: parseInt(year, 10),
        vesselName: nominationIdx !== -1 ? String(row[nominationIdx] || '').trim() : null,
        bargeName: nominationIdx !== -1 ? String(row[nominationIdx] || '').trim() : null,
        // Mark incomplete only if data is actually missing (not if column header not found)
        supplier: (!hasBuyer || !hasBlDate || !hasQuantity) ? 'Incomplete' : supplierName,
      };
      
      records.push(record);
    }
    
    console.log(`  ✓ Extracted ${year}: ${records.length} records`);
  }
  
  // Batch insert
  if (records.length > 0) {
    await prisma.shipmentDetail.createMany({
      data: records,
      skipDuplicates: true,
    });
    console.log(`\n✅ Loaded ${records.length} ShipmentDetail records`);
  }
  
  return records.length;
}

// ============================================================================
// Phase 5: Load DailyDelivery records
// ============================================================================

async function loadDailyDeliveries(partnerIdMap) {
  console.log('\n📋 PHASE 5: Loading DailyDelivery records...');
  
  const dailyFile = path.join(process.cwd(), '10.Daily Delivery Report (Recap Shipment) 2020, 2021, 2022, 2023, 2024, 2025, 2026.xlsx');
  if (!fs.existsSync(dailyFile)) {
    console.log('⚠️  Daily Delivery file not found, skipping...');
    return 0;
  }
  
  const workbook = XLSX.readFile(dailyFile, { cellDates: true });
  const records = [];
  
  for (const [year, config] of Object.entries(DAILY_DELIVERY_CONFIG)) {
    const sheet = workbook.Sheets[config.sheetName];
    if (!sheet) continue;
    
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    const headerRow = data[config.headerRowIndex] || [];
    
    // Diagnostic: Log header row for debugging
    console.log(`\n  📋 ${config.sheetName} headers (first 10):`, headerRow.slice(0, 10).map(h => `"${h}"`));
    
    // Find column indices
    const statusIdx = findColumnIndex(headerRow, ['Status', 'Status ', 'Shipment Status']);
    const buyerIdx = findColumnIndex(headerRow, ['Buyer', 'BUYER', 'Project / Buyer', 'Project Name', 'buyer']);
    const shippingTermIdx = findColumnIndex(headerRow, ['Shipping Term', 'SHIPPING TERM']);
    const areaIdx = findColumnIndex(headerRow, ['Area', 'AREA']);
    const supplierIdx = findColumnIndex(headerRow, ['Source', 'SOURCE', 'Supplier', 'SUPPLIER']);
    const polIdx = findColumnIndex(headerRow, ['POL', 'pol']);
    const laycanPolIdx = findColumnIndex(headerRow, ['Laycan POL', 'LAYCAN POL', 'Laycan at POL']);
    const vesselIdx = findColumnIndex(headerRow, ['Vessel Nomination', 'VESSEL NOMINATION', 'MV/Barge Nomination', 'MV Nomination']);
    const projectIdx = findColumnIndex(headerRow, ['Project Name', 'PROJECT NAME', 'Project', 'PROJECT']);
    const flowIdx = findColumnIndex(headerRow, ['Flow', 'FLOW']);
    const blQtyIdx = findColumnIndex(headerRow, ['BL Quantity', 'BL QUANTITY', 'Qty (MT)', 'QTY (MT)']);
    const invoiceAmtIdx = findColumnIndex(headerRow, ['Invoice Amount', 'INVOICE AMOUNT']);
    const productIdx = findColumnIndex(headerRow, ['Product', 'PRODUCT']);
    const garIdx = findColumnIndex(headerRow, ['ACTUAL GAR', 'Actual GAR', 'ACTUAL GCV (GAR&GAD)', 'GAR', 'Gar']);
    const poNoIdx = findColumnIndex(headerRow, ['Contract No.', 'CONTRACT NO.', 'PO No', 'PO NO']);
    const blDateIdx = findColumnIndex(headerRow, ['BL DATE', 'BL Date', 'BL date', 'bl date']);
    
    // Diagnostic: Report missing columns
    const missingCols = [];
    if (buyerIdx === -1) missingCols.push('Buyer');
    if (blDateIdx === -1) missingCols.push('BL Date');
    if (blQtyIdx === -1) missingCols.push('BL Quantity');
    if (missingCols.length > 0) {
      console.log(`  ⚠️  Missing columns in ${config.sheetName}:`, missingCols.join(', '));
    }
    
    for (let i = config.dataStartRowIndex; i < data.length; i++) {
      const row = data[i];
      if (isEmptyRow(row)) continue;
      
      const buyerName = normalizePartnerName(row[buyerIdx]);
      const supplierName = normalizePartnerName(row[supplierIdx]);
      
      // Check if critical data is truly missing
      const hasBuyer = buyerIdx !== -1 && row[buyerIdx];
      const hasBlDate = blDateIdx !== -1 && row[blDateIdx];
      const hasQuantity = blQtyIdx !== -1 && row[blQtyIdx];
      
      const record = {
        reportType: row[areaIdx]?.toString().includes('EXPORT') ? 'export' : 'domestic',
        year: parseInt(year, 10),
        shipmentStatus: statusIdx !== -1 ? String(row[statusIdx] || '').trim() : null,
        buyer: hasBuyer ? buyerName : null,
        shippingTerm: shippingTermIdx !== -1 ? String(row[shippingTermIdx] || '').trim() : null,
        area: areaIdx !== -1 ? String(row[areaIdx] || '').trim() : null,
        supplier: (!hasBuyer || !hasBlDate || !hasQuantity) ? 'Incomplete' : supplierName,
        pol: polIdx !== -1 ? String(row[polIdx] || '').trim() : null,
        laycanPol: laycanPolIdx !== -1 ? String(row[laycanPolIdx] || '').trim() : null,
        mvBargeNomination: vesselIdx !== -1 ? String(row[vesselIdx] || '').trim() : null,
        project: projectIdx !== -1 ? String(row[projectIdx] || '').trim() : null,
        flow: flowIdx !== -1 ? String(row[flowIdx] || '').trim() : null,
        blQuantity: blQtyIdx !== -1 ? parseNumber(row[blQtyIdx]) : null,
        invoiceAmount: invoiceAmtIdx !== -1 ? parseNumber(row[invoiceAmtIdx]) : null,
        product: productIdx !== -1 ? String(row[productIdx] || '').trim() : null,
        actualGcvGar: garIdx !== -1 ? parseNumber(row[garIdx]) : null,
        poNo: poNoIdx !== -1 ? String(row[poNoIdx] || '').trim() : null,
        contractNo: poNoIdx !== -1 ? String(row[poNoIdx] || '').trim() : null,
        blDate: blDateIdx !== -1 ? parseExcelDate(row[blDateIdx]) : null,
      };
      
      records.push(record);
    }
    
    console.log(`  ✓ Extracted ${year}: ${records.length} records`);
  }
  
  // Batch insert
  if (records.length > 0) {
    await prisma.dailyDelivery.createMany({
      data: records,
      skipDuplicates: true,
    });
    console.log(`\n✅ Loaded ${records.length} DailyDelivery records`);
  }
  
  return records.length;
}

// ============================================================================
// Phase 6: Create QualityResult records from ShipmentDetail
// ============================================================================

async function createQualityResults() {
  console.log('\n🧪 PHASE 6: Creating QualityResult records...');
  
  // Find shipments with GAR data
  const shipmentsWithQuality = await prisma.shipmentDetail.findMany({
    where: {
      resultGar: { not: null },
      isDeleted: false,
    },
    select: {
      id: true,
      nomination: true,
      resultGar: true,
      blDate: true,
    },
  });
  
  const qualityRecords = shipmentsWithQuality.map(s => ({
    cargoId: s.id,
    cargoName: s.nomination || 'Unknown',
    gar: s.resultGar,
    samplingDate: s.blDate,
    status: 'completed',
  }));
  
  if (qualityRecords.length > 0) {
    await prisma.qualityResult.createMany({
      data: qualityRecords,
      skipDuplicates: true,
    });
    console.log(`✅ Created ${qualityRecords.length} QualityResult records`);
  }
  
  return qualityRecords.length;
}

// ============================================================================
// Main Migration Function
// ============================================================================

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║  HISTORICAL DATA MIGRATION (Excel → Production DB)       ║');
  console.log('║  Strategy: Clean & Load | Date Format: DD/MM/YYYY        ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  
  try {
    // Phase 1: Extract Partners
    const partnersMap = await extractPartnersFromExcel();
    
    // Phase 2: Seed Partners
    const partnerIdMap = await seedPartners(partnersMap);
    
    // Phase 3: Clean Dummy Data
    await cleanDummyData();
    
    // Phase 4: Load ShipmentDetail
    const shipmentCount = await loadShipmentDetails(partnerIdMap);
    
    // Phase 5: Load DailyDelivery
    const deliveryCount = await loadDailyDeliveries(partnerIdMap);
    
    // Phase 6: Create QualityResults
    const qualityCount = await createQualityResults();
    
    // Final Summary
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║                    MIGRATION COMPLETE                     ║');
    console.log('╠═══════════════════════════════════════════════════════════╣');
    console.log(`║  Partners Seeded:       ${String(partnerIdMap.size).padStart(4)} records              ║`);
    console.log(`║  ShipmentDetail:        ${String(shipmentCount).padStart(4)} records              ║`);
    console.log(`║  DailyDelivery:         ${String(deliveryCount).padStart(4)} records              ║`);
    console.log(`║  QualityResult:         ${String(qualityCount).padStart(4)} records              ║`);
    console.log(`║  ─────────────────────────────────────────────────────    ║`);
    console.log(`║  TOTAL MIGRATED:        ${String(shipmentCount + deliveryCount).padStart(4)} records              ║`);
    console.log('╚═══════════════════════════════════════════════════════════╝');
    
    if (shipmentCount + deliveryCount < 2157) {
      console.log('\n⚠️  WARNING: Total records below target of 2,157');
      console.log('    Check Excel files and sheet configurations');
    } else {
      console.log('\n✅ Target of 2,157+ records achieved!');
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
