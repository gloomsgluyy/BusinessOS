/**
 * COMPREHENSIVE EXCEL → PRODUCTION DB MIGRATION SCRIPT
 * Migrates all client Excel data to Neon PostgreSQL via Prisma
 * 
 * Usage: node scripts/migrate-excel-to-db.js [--phase=0|1|2|all] [--dry-run]
 */

const { PrismaClient } = require('@prisma/client');
const xlsx = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();
const BASE_DIR = path.resolve(__dirname, '..');

// ─── Utility Helpers ──────────────────────────────────────────
function excelDateToJS(serial) {
  if (!serial) return null;
  if (serial instanceof Date) return serial;
  if (typeof serial === 'string') {
    // Try parsing text dates like "20-24 JAN" → skip, or "Jan-15" → parse
    const d = new Date(serial);
    if (!isNaN(d.getTime()) && d.getFullYear() > 1990) return d;
    return null;
  }
  if (typeof serial === 'number' && serial > 25569) {
    // Excel serial to JS date
    return new Date((serial - 25569) * 86400 * 1000);
  }
  return null;
}

function toFloat(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? null : n;
}

function toInt(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = parseInt(String(val).replace(/[^0-9\-]/g, ''), 10);
  return isNaN(n) ? null : n;
}

function cleanStr(val) {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  return s === '' ? null : s;
}

function readSheet(filePath, sheetName) {
  const wb = xlsx.readFile(filePath);
  if (!wb.SheetNames.includes(sheetName)) {
    console.log('  ⚠ Sheet "' + sheetName + '" not found in ' + path.basename(filePath));
    return [];
  }
  const ws = wb.Sheets[sheetName];
  return xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });
}

function isEmptyRow(row) {
  if (!row) return true;
  return row.every(function(cell) {
    return cell === '' || cell === null || cell === undefined;
  });
}

function isTotalRow(row) {
  if (!row) return false;
  const str = row.map(String).join(' ').toLowerCase();
  return str.includes('total') || str.includes('sub total');
}

// ─── PHASE 0: CLEANUP ────────────────────────────────────────

async function phase0_cleanup() {
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 0: DELETING ALL DUMMY/EXISTING DATA');
  console.log('='.repeat(60));

  const tables = [
    { name: 'ShipmentDetail', fn: () => prisma.shipmentDetail.deleteMany({}) },
    { name: 'DailyDelivery', fn: () => prisma.dailyDelivery.deleteMany({}) },
    { name: 'MarketPrice', fn: () => prisma.marketPrice.deleteMany({}) },
    { name: 'OutstandingPayment', fn: () => prisma.outstandingPayment.deleteMany({}) },
    { name: 'SourceSupplier', fn: () => prisma.sourceSupplier.deleteMany({}) },
    { name: 'QualityResult', fn: () => prisma.qualityResult.deleteMany({}) },
    { name: 'SalesDeal', fn: () => prisma.salesDeal.deleteMany({}) },
    { name: 'SalesOrder', fn: () => prisma.salesOrder.deleteMany({}) },
    { name: 'PurchaseRequest', fn: () => prisma.purchaseRequest.deleteMany({}) },
    { name: 'PLForecast', fn: () => prisma.pLForecast.deleteMany({}) },
    { name: 'Partner', fn: () => prisma.partner.deleteMany({}) },
    { name: 'BlendingSimulation', fn: () => prisma.blendingSimulation.deleteMany({}) },
  ];

  for (const t of tables) {
    try {
      const result = await t.fn();
      console.log('  ✅ ' + t.name + ': deleted ' + result.count + ' records');
    } catch (e) {
      console.log('  ❌ ' + t.name + ': ' + e.message.substring(0, 80));
    }
  }
}

// ─── PHASE 1: SHIPMENT DETAIL (MV_Barge&Source) ──────────────

async function migrate_shipments() {
  console.log('\n' + '-'.repeat(60));
  console.log('Migrating ShipmentDetail (MV_Barge&Source 2021-2026)...');
  console.log('-'.repeat(60));

  const file = path.join(BASE_DIR, '00. MV_Barge&Source 2021,2022, 2023,2024-7-19.xlsx');
  
  // Sheet configs: each year has slightly different column layout
  const sheetConfigs = [
    {
      sheet: ' MV_Barge&Source 2026', year: 2026, headerRow: 4,
      // Row 4: NO, EXPORT / DMO, STATUS, ORIGIN, MV./PROJECT NAME, SOURCE, IUP OP, SHIPMENT FLOW, JETTY / LOADING PORT, LAYCAN, NOMINATION, QTY (MT) [PLAN], COB, REMARKS, HARGA ACTUAL [FOB BARGE], HARGA ACTUAL/ASSUM [FOB MV], HPB, STATUS HPB, SHIPMENT STATUS, ISSUE / NOTES
      cols: { no:0, exportDmo:1, status:2, origin:3, mvProjectName:4, source:5, iupOp:6, shipmentFlow:7, jettyLoadingPort:8, laycan:9, nomination:10, qtyPlan:11, qtyCob:12, remarks:13, hargaActualFob:14, hargaActualFobMv:15, hpb:16, statusHpb:17, shipmentStatus:18, issueNotes:19 }
    },
    {
      sheet: 'MV_Barge&Source 2025', year: 2025, headerRow: 4,
      cols: { no:0, exportDmo:1, status:2, origin:3, mvProjectName:4, source:5, iupOp:6, shipmentFlow:7, jettyLoadingPort:8, laycan:9, nomination:10, qtyPlan:11, qtyCob:12, remarks:13, hargaActualFob:14, hargaActualFobMv:15, hpb:16, statusHpb:17, shipmentStatus:18, issueNotes:19 }
    },
    {
      sheet: 'MV_Barge&Source 2024', year: 2024, headerRow: 4,
      // Row 4: NO, EXPORT / DMO, ORIGIN, MV./PROJECT NAME, SOURCE, IUP OP, SHIPMENT FLOW, JETTY / LOADING PORT, LAYCAN, NOMINATION, QTY PLAN, COB, REMARKS, SHIPMENT STATUS, ISSUE, BL DATE, PIC, IUP-OPK, KUOTA EXPORT, JETTY ACTUAL
      cols: { no:0, exportDmo:1, origin:2, mvProjectName:3, source:4, iupOp:5, shipmentFlow:6, jettyLoadingPort:7, laycan:8, nomination:9, qtyPlan:10, qtyCob:11, remarks:12, shipmentStatus:13, issueNotes:14, blDate:15, pic:16, kuotaExport:18 }
    },
    {
      sheet: 'MV_Barge&Source 2023', year: 2023, headerRow: 0,
      // Row 0: No, MV NAME, LAYCAN, BUYER, IUP OP, IUP-OPK, KUOTA, SOURCE, GAR, result PSI, JETTY DOCS, JETTY ACTUAL, ..., NOMINATION, QTY PLAN, DSR, DSR Laut, QTY Provisional, Max Qty, STATUS
      cols: { no:0, mvProjectName:1, laycan:2, buyer:3, iupOp:4, kuotaExport:6, source:7, jettyLoadingPort:10, nomination:13, qtyPlan:14, qtyCob:15, shipmentStatus:19 }
    },
    {
      sheet: 'MV_Barge&Source 2022', year: 2022, headerRow: 0,
      // Row 0: z, NO., MV NAME, LAYCAN, BUYER, IUP OP, KUOTA, SOURCE, JETTY DOCS, JETTY ACTUAL, NOMINATION, ..., QTY PLAN, QTY STOCK JETTY, BL QUANTITY, STATUS, BL DATE, ..., (LOSS)/GAIN, SP
      cols: { no:1, mvProjectName:2, laycan:3, buyer:4, iupOp:5, kuotaExport:6, source:7, jettyLoadingPort:9, nomination:10, qtyPlan:12, qtyCob:13, shipmentStatus:15, blDate:16, lossGainCargo:18, sp:19 }
    },
    {
      sheet: 'MV_Barge&Source 2021', year: 2021, headerRow: 0,
      // Row 0: NO., NO., MV NAME, LAYCAN, BL DATE, BUYER, SP, BL QUANTITY, (LOSS)/GAIN CARGO, DEADFREIGHT, IUP OP, SOURCE, JETTY ACTUAL, NOMINATION, QTY PLAN, QTY STOCK, STATUS, BL DATE, BL Date SOURCE
      cols: { no:1, mvProjectName:2, laycan:3, blDate:4, buyer:5, sp:6, lossGainCargo:8, deadfreight:9, iupOp:10, source:11, jettyLoadingPort:12, nomination:13, qtyPlan:14, qtyCob:15, shipmentStatus:16 }
    }
  ];

  let totalInserted = 0;

  for (const config of sheetConfigs) {
    const data = readSheet(file, config.sheet);
    if (data.length === 0) continue;

    const startRow = config.headerRow + 2; // skip header + sub-header
    const records = [];

    for (let i = startRow; i < data.length; i++) {
      const row = data[i];
      if (isEmptyRow(row) || isTotalRow(row)) continue;

      const c = config.cols;
      const noVal = cleanStr(row[c.no]);
      const mvName = cleanStr(row[c.mvProjectName]);
      
      // Skip rows without meaningful data
      if (!noVal && !mvName) continue;
      // Skip sub-header rows
      if (noVal === 'NO' || noVal === 'NO.' || mvName === 'MV NAME') continue;

      const record = {
        no: toInt(row[c.no]),
        exportDmo: cleanStr(row[c.exportDmo]) || 'EXPORT',
        status: cleanStr(row[c.status]) || cleanStr(row[c.shipmentStatus]) || 'upcoming',
        origin: cleanStr(row[c.origin]),
        mvProjectName: mvName,
        source: cleanStr(row[c.source]),
        iupOp: cleanStr(row[c.iupOp]),
        shipmentFlow: c.shipmentFlow !== undefined ? cleanStr(row[c.shipmentFlow]) : null,
        jettyLoadingPort: cleanStr(row[c.jettyLoadingPort]),
        laycan: cleanStr(row[c.laycan]),
        nomination: cleanStr(row[c.nomination]),
        qtyPlan: toFloat(row[c.qtyPlan]),
        qtyCob: c.qtyCob !== undefined ? toFloat(row[c.qtyCob]) : null,
        remarks: c.remarks !== undefined ? cleanStr(row[c.remarks]) : null,
        hargaActualFob: c.hargaActualFob !== undefined ? toFloat(row[c.hargaActualFob]) : null,
        hargaActualFobMv: c.hargaActualFobMv !== undefined ? toFloat(row[c.hargaActualFobMv]) : null,
        hpb: c.hpb !== undefined ? toFloat(row[c.hpb]) : null,
        statusHpb: c.statusHpb !== undefined ? cleanStr(row[c.statusHpb]) : null,
        shipmentStatus: cleanStr(row[c.shipmentStatus !== undefined ? c.shipmentStatus : c.status]),
        issueNotes: c.issueNotes !== undefined ? cleanStr(row[c.issueNotes]) : null,
        blDate: c.blDate !== undefined ? excelDateToJS(row[c.blDate]) : null,
        pic: c.pic !== undefined ? cleanStr(row[c.pic]) : null,
        kuotaExport: c.kuotaExport !== undefined ? cleanStr(row[c.kuotaExport]) : null,
        sp: c.sp !== undefined ? toFloat(row[c.sp]) : null,
        deadfreight: c.deadfreight !== undefined ? toFloat(row[c.deadfreight]) : null,
        lossGainCargo: c.lossGainCargo !== undefined ? toFloat(row[c.lossGainCargo]) : null,
        buyer: c.buyer !== undefined ? cleanStr(row[c.buyer]) : null,
        year: config.year,
        type: 'export',
      };

      records.push(record);
    }

    if (records.length > 0) {
      const result = await prisma.shipmentDetail.createMany({ data: records, skipDuplicates: true });
      totalInserted += result.count;
      console.log('  ✅ ' + config.sheet + ': ' + result.count + '/' + records.length + ' records inserted (year=' + config.year + ')');
    } else {
      console.log('  ⚠ ' + config.sheet + ': no valid records found');
    }
  }

  // Also migrate PURCHASE REPORT sheet (latest shipment monitoring with pricing)
  const prData = readSheet(file, 'PURCHASE REPORT');
  if (prData.length > 0) {
    const records = [];
    for (let i = 6; i < prData.length; i++) {
      const row = prData[i];
      if (isEmptyRow(row) || isTotalRow(row)) continue;
      const noVal = cleanStr(row[0]);
      if (!noVal || noVal === 'NO') continue;

      records.push({
        no: toInt(row[0]),
        exportDmo: cleanStr(row[1]) || 'EXPORT',
        status: cleanStr(row[2]) || 'upcoming',
        origin: cleanStr(row[3]),
        mvProjectName: cleanStr(row[4]),
        source: cleanStr(row[5]),
        iupOp: cleanStr(row[6]),
        shipmentFlow: cleanStr(row[7]),
        jettyLoadingPort: cleanStr(row[8]),
        laycan: cleanStr(row[9]),
        nomination: cleanStr(row[10]),
        qtyPlan: toFloat(row[11]),
        qtyCob: toFloat(row[12]),
        remarks: cleanStr(row[13]),
        hargaActualFob: toFloat(row[14]),
        hargaActualFobMv: toFloat(row[15]),
        hpb: toFloat(row[16]),
        statusHpb: cleanStr(row[17]),
        shipmentStatus: cleanStr(row[18]),
        issueNotes: cleanStr(row[19]),
        year: 2025,
        type: 'export',
      });
    }
    if (records.length > 0) {
      const result = await prisma.shipmentDetail.createMany({ data: records, skipDuplicates: true });
      totalInserted += result.count;
      console.log('  ✅ PURCHASE REPORT: ' + result.count + ' records inserted');
    }
  }

  console.log('  📊 Total ShipmentDetail: ' + totalInserted + ' records');
  return totalInserted;
}

// ─── PHASE 1: DAILY DELIVERY REPORT ─────────────────────────

async function migrate_daily_delivery() {
  console.log('\n' + '-'.repeat(60));
  console.log('Migrating DailyDelivery (2020-2026 EXP + DOM)...');
  console.log('-'.repeat(60));

  const file = path.join(BASE_DIR, '10.Daily Delivery Report (Recap Shipment) 2020, 2021, 2022, 2023, 2024, 2025, 2026.xlsx');
  let totalInserted = 0;

  // ── EXPORT sheets (2022-2026) ──
  const expConfigs = [
    { sheet: '2026-EXP', year: 2026, headerRow: 1 },
    { sheet: '2025-EXP', year: 2025, headerRow: 1 },
    { sheet: '2024-EXP', year: 2024, headerRow: 1 },
    { sheet: '2023-EXP', year: 2023, headerRow: 0 },
    { sheet: 'From 2023 Sep - EXP', year: 2023, headerRow: 0 },
    { sheet: '2022-EXP', year: 2022, headerRow: 3 },
  ];

  for (const config of expConfigs) {
    const data = readSheet(file, config.sheet);
    if (data.length === 0) continue;

    const records = [];
    const startRow = config.headerRow + 1;

    for (let i = startRow; i < data.length; i++) {
      const row = data[i];
      if (isEmptyRow(row) || isTotalRow(row)) continue;

      const status = cleanStr(row[0]);
      const buyer = cleanStr(row[1]);
      if (!buyer || buyer === 'Status' || buyer === 'Status ') continue;
      // Skip month label rows
      if (!status && buyer && buyer.length < 15 && !row[2]) continue;

      let blQuantity, blDate, shippingTerm, area, source, pol;
      
      if (config.sheet === '2023-EXP') {
        // Different layout: Laycan Shipment, PO Month, Buyer, Product, Contract No., ...
        records.push({
          reportType: 'export', year: config.year,
          buyer: cleanStr(row[2]), // Buyer is col 2
          product: cleanStr(row[3]),
          shipmentStatus: cleanStr(row[7]),
          shippingTerm: cleanStr(row[13]),
          area: cleanStr(row[14]),
          pol: cleanStr(row[15]),
          mvBargeNomination: cleanStr(row[16]),
          blQuantity: toFloat(row[18]),
          blDate: excelDateToJS(row[19]),
          poMonth: cleanStr(row[0]),
        });
        continue;
      }

      if (config.sheet === 'From 2023 Sep - EXP') {
        records.push({
          reportType: 'export', year: config.year,
          poMonth: cleanStr(row[0]),
          buyer: cleanStr(row[2]),
          product: cleanStr(row[4]),
          shippingTerm: cleanStr(row[7]),
          area: cleanStr(row[8]),
          pol: cleanStr(row[9]),
          mvBargeNomination: cleanStr(row[10]),
          blQuantity: toFloat(row[15]),
          blDate: excelDateToJS(row[16]),
          shipmentStatus: 'Done',
        });
        continue;
      }

      // Standard EXP layout (2024-2026): Status, Buyer, Shipping Term, Area, Source, POL, Laycan POL, Vessel Nomination, BL Date, ...
      records.push({
        reportType: 'export', year: config.year,
        shipmentStatus: cleanStr(row[0]),
        buyer: cleanStr(row[1]),
        shippingTerm: cleanStr(row[2]),
        area: cleanStr(row[3]),
        supplier: cleanStr(row[4]),
        pol: cleanStr(row[5]),
        laycanPol: cleanStr(row[6]),
        mvBargeNomination: cleanStr(row[7]),
        blDate: excelDateToJS(row[8]),
        blQuantity: toFloat(row[18] || row[14]),
        analysisMethod: cleanStr(row[19] || row[17]),
        surveyorPol: cleanStr(row[20] || row[18]),
      });
    }

    const validRecords = records.filter(r => r.buyer || r.blQuantity);
    if (validRecords.length > 0) {
      const result = await prisma.dailyDelivery.createMany({ data: validRecords, skipDuplicates: true });
      totalInserted += result.count;
      console.log('  ✅ ' + config.sheet + ': ' + result.count + ' records (export, year=' + config.year + ')');
    }
  }

  // ── DOMESTIC sheets (2022-2026) ──
  const domConfigs = [
    { sheet: '2026-DOM', year: 2026, headerRow: 1 },
    { sheet: '2025-DOM', year: 2025, headerRow: 1 },
    { sheet: '2024-DOM', year: 2024, headerRow: 1 },
    { sheet: '2023-DOM', year: 2023, headerRow: 0 },
    { sheet: '2022-DOM', year: 2022, headerRow: 0 },
  ];

  for (const config of domConfigs) {
    const data = readSheet(file, config.sheet);
    if (data.length === 0) continue;

    const records = [];
    const startRow = config.headerRow + 1;

    for (let i = startRow; i < data.length; i++) {
      const row = data[i];
      if (isEmptyRow(row) || isTotalRow(row)) continue;

      const col0 = cleanStr(row[0]);
      const col1 = cleanStr(row[1]);
      if (!col0 && !col1) continue;
      // Skip headers and month labels
      if (col0 === 'Shipment Status' || col0 === 'PO' || col0 === 'Laycan PO') continue;
      if (!col0 && col1 && !row[2] && !row[3]) continue; // month label row like "JANUARY"

      if (config.sheet === '2023-DOM' || config.sheet === '2022-DOM') {
        // Different layout
        records.push({
          reportType: 'domestic', year: config.year,
          poMonth: cleanStr(row[0]),
          buyer: cleanStr(row[1] || row[4]),
          product: cleanStr(row[2] || row[5]),
          shippingTerm: cleanStr(row[7]),
          supplier: cleanStr(row[6] || row[12]),
          pol: cleanStr(row[12] || row[17]),
          mvBargeNomination: cleanStr(row[15] || row[14]),
          blQuantity: toFloat(row[16] || row[15]),
          blDate: excelDateToJS(row[17] || row[16]),
          shipmentStatus: cleanStr(row[8] || row[13]),
          project: cleanStr(row[9] || row[2]),
        });
        continue;
      }

      // Standard DOM layout (2024-2026): Shipment Status, Buyer, POD, Shipping Term, Latest ETA, Arrive at POD, Keterlambatan, POL, Laycan at POL, Area, Supplier, MV/Barge, Issue, BL Month, BL Quantity, BL DATE, ...
      records.push({
        reportType: 'domestic', year: config.year,
        shipmentStatus: cleanStr(row[0]),
        buyer: cleanStr(row[1]),
        pod: cleanStr(row[2]),
        shippingTerm: cleanStr(row[3]),
        latestEtaPod: excelDateToJS(row[4]),
        arriveAtPod: excelDateToJS(row[5]),
        keterlambatan: cleanStr(row[6]),
        pol: cleanStr(row[7]),
        laycanPol: cleanStr(row[8]),
        area: cleanStr(row[9]),
        supplier: cleanStr(row[10]),
        mvBargeNomination: cleanStr(row[11]),
        issue: cleanStr(row[12]),
        blMonth: cleanStr(row[13]),
        blQuantity: toFloat(row[14]),
        blDate: excelDateToJS(row[15]),
        analysisMethod: cleanStr(row[17]),
        surveyorPol: cleanStr(row[18]),
        surveyorPod: cleanStr(row[19]),
      });
    }

    const validRecords = records.filter(r => r.buyer || r.blQuantity);
    if (validRecords.length > 0) {
      const result = await prisma.dailyDelivery.createMany({ data: validRecords, skipDuplicates: true });
      totalInserted += result.count;
      console.log('  ✅ ' + config.sheet + ': ' + result.count + ' records (domestic, year=' + config.year + ')');
    }
  }

  // ── 2021 sheet (combined DOM+EXP) ──
  const data2021 = readSheet(file, '2021');
  if (data2021.length > 0) {
    const records = [];
    for (let i = 2; i < data2021.length; i++) {
      const row = data2021[i];
      if (isEmptyRow(row) || isTotalRow(row)) continue;
      const buyer = cleanStr(row[6]);
      if (!buyer) continue;

      const domExp = cleanStr(row[2]); // Dom./Exp.
      records.push({
        reportType: domExp && domExp.toLowerCase().includes('exp') ? 'export' : 'domestic',
        year: 2021,
        buyer: buyer,
        product: cleanStr(row[7]),
        shippingTerm: cleanStr(row[8]),
        supplier: cleanStr(row[13]),
        pol: cleanStr(row[14]),
        laycanPol: cleanStr(row[15]),
        mvBargeNomination: cleanStr(row[19]),
        blQuantity: toFloat(row[20]),
        blDate: excelDateToJS(row[21]),
        shipmentStatus: cleanStr(row[16]),
        pod: cleanStr(row[10]),
        project: cleanStr(row[4]),
      });
    }
    const valid = records.filter(r => r.buyer);
    if (valid.length > 0) {
      const result = await prisma.dailyDelivery.createMany({ data: valid, skipDuplicates: true });
      totalInserted += result.count;
      console.log('  ✅ 2021: ' + result.count + ' records');
    }
  }

  // ── 2020 sheet ──
  const data2020 = readSheet(file, '2020');
  if (data2020.length > 0) {
    const records = [];
    for (let i = 2; i < data2020.length; i++) {
      const row = data2020[i];
      if (isEmptyRow(row) || isTotalRow(row)) continue;
      const buyer = cleanStr(row[4]);
      if (!buyer) continue;

      records.push({
        reportType: 'domestic', // 2020 is mostly domestic
        year: 2020,
        poMonth: cleanStr(row[0]),
        buyer: buyer,
        product: cleanStr(row[5]),
        shippingTerm: cleanStr(row[6]),
        supplier: cleanStr(row[10]),
        pol: cleanStr(row[11]),
        laycanPol: cleanStr(row[12]),
        mvBargeNomination: cleanStr(row[15]),
        blDate: excelDateToJS(row[16]),
        blQuantity: toFloat(row[17]),
        shipmentStatus: cleanStr(row[13]),
        pod: cleanStr(row[8]),
        project: cleanStr(row[3]),
      });
    }
    const valid = records.filter(r => r.buyer);
    if (valid.length > 0) {
      const result = await prisma.dailyDelivery.createMany({ data: valid, skipDuplicates: true });
      totalInserted += result.count;
      console.log('  ✅ 2020: ' + result.count + ' records');
    }
  }

  console.log('  📊 Total DailyDelivery: ' + totalInserted + ' records');
  return totalInserted;
}

// ─── PHASE 1: OUTSTANDING PAYMENT ───────────────────────────

async function migrate_outstanding_payment() {
  console.log('\n' + '-'.repeat(60));
  console.log('Migrating OutstandingPayment...');
  console.log('-'.repeat(60));

  const file = path.join(BASE_DIR, '00. MV_Barge&Source 2021,2022, 2023,2024-7-19.xlsx');
  const data = readSheet(file, 'Outstanding Payment');
  if (data.length === 0) return 0;

  const records = [];
  // Row 1 is header: Perusahaan, Kode Batu, Price (Incl PPh, Exc. PPN), Qty (MT), Total DP, Calculation Date, DP to Shipment, Timeframe, Status
  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    if (isEmptyRow(row)) continue;
    const perusahaan = cleanStr(row[0]);
    if (!perusahaan) continue;

    // Parse price - remove IDR prefix and formatting
    let priceStr = cleanStr(row[2]);
    let price = null;
    if (priceStr) {
      price = toFloat(priceStr.replace(/IDR/gi, '').replace(/,/g, ''));
    }

    records.push({
      perusahaan: perusahaan,
      kodeBatu: cleanStr(row[1]),
      priceInclPph: price,
      qty: toFloat(row[3]),
      totalDp: toFloat(row[4]),
      calculationDate: excelDateToJS(row[5]),
      dpToShipment: excelDateToJS(row[6]),
      timeframeDays: cleanStr(row[7]),
      status: cleanStr(row[8]) || 'pending',
      year: 2025,
    });
  }

  if (records.length > 0) {
    const result = await prisma.outstandingPayment.createMany({ data: records, skipDuplicates: true });
    console.log('  ✅ OutstandingPayment: ' + result.count + ' records inserted');
    return result.count;
  }
  return 0;
}

// ─── PHASE 1: SOURCE SUPPLIER ───────────────────────────────

async function migrate_source_supplier() {
  console.log('\n' + '-'.repeat(60));
  console.log('Migrating SourceSupplier (Source Monitoring 2024)...');
  console.log('-'.repeat(60));

  const file = path.join(BASE_DIR, '00. MV_Barge&Source 2021,2022, 2023,2024-7-19.xlsx');
  const data = readSheet(file, 'Source Monitoring 2024');
  if (data.length === 0) return 0;

  // Row 1-2 are headers:
  // PIC, SOURCE COAL, AREA, ORIGIN, STATUS (SURVEY/PSA/RESULT), UPDATED DATE, SPECIFICATION GAR/TS/ASH, QTY PRODUCTION, DOKUMEN FLOW, PRICE, PSA RESULT GAR/TS/ASH
  const records = [];
  for (let i = 3; i < data.length; i++) {
    const row = data[i];
    if (isEmptyRow(row)) continue;
    const name = cleanStr(row[1]);
    if (!name) continue;

    records.push({
      name: name,
      region: cleanStr(row[2]) || 'Unknown',
      origin: cleanStr(row[3]),
      statusDetail: cleanStr(row[4]),
      kycStatus: 'not_started',
      psiStatus: cleanStr(row[5]) ? 'completed' : 'not_started',
      updatedDate: excelDateToJS(row[7]),
      specGar: toFloat(row[8]),
      ts: toFloat(row[9]),
      ash: toFloat(row[10]),
      qtyProduction: toFloat(row[11]),
      dokumenFlow: cleanStr(row[12]),
      fobBargePriceUsd: toFloat(row[13]),
      psaResultGar: toFloat(row[14]),
      picName: cleanStr(row[0]),
    });
  }

  if (records.length > 0) {
    const result = await prisma.sourceSupplier.createMany({ data: records, skipDuplicates: true });
    console.log('  ✅ SourceSupplier: ' + result.count + ' records inserted');
    return result.count;
  }
  return 0;
}

// ─── PHASE 1: MARKET PRICE (ICI + HBA) ─────────────────────

async function migrate_market_price() {
  console.log('\n' + '-'.repeat(60));
  console.log('Migrating MarketPrice (ICI + HBA recent data)...');
  console.log('-'.repeat(60));

  const file = path.join(BASE_DIR, 'ICI HBA HPB 2025.-2-4.xlsx');
  let totalInserted = 0;

  // ── ICI Weekly Data (recent 2 years: ~104 rows) ──
  const iciData = readSheet(file, 'ICI, GNewc, Delta');
  if (iciData.length > 0) {
    const records = [];
    // Row 3 has column labels, data starts at row 4
    // Cols: Date, ICI1(6500), ICI2(5800), ICI3(5000), ICI4(4200), ICI5(3400), NEWCASTLE, CHANGE WEEKLY, ...
    // avg monthly cols around 13+, avg 2 weeks around 18+

    const cutoffDate = new Date('2024-01-01');

    for (let i = 4; i < iciData.length; i++) {
      const row = iciData[i];
      if (isEmptyRow(row)) continue;

      const date = excelDateToJS(row[0]);
      if (!date || date < cutoffDate) continue;

      const ici1 = toFloat(row[1]);
      if (!ici1) continue; // skip rows without ICI data

      records.push({
        date: date,
        ici1: ici1,
        ici2: toFloat(row[2]),
        ici3: toFloat(row[3]),
        ici4: toFloat(row[4]),
        ici5: toFloat(row[5]),
        newcastle: toFloat(row[6]),
        changeWeekly: toFloat(row[7]),
        avgMonthlyIci1: toFloat(row[13]),
        avg2WeeksIci1: toFloat(row[18]),
        source: 'ICI Weekly',
      });
    }

    if (records.length > 0) {
      const result = await prisma.marketPrice.createMany({ data: records, skipDuplicates: true });
      totalInserted += result.count;
      console.log('  ✅ ICI Weekly: ' + result.count + ' records (from 2024+)');
    }
  }

  // ── HBA Monthly Data ──
  const hbaData = readSheet(file, 'HBA');
  if (hbaData.length > 0) {
    const records = [];
    // Row 1: Month, HBA CV6322, HBA I CV5300, HBA I diff, MAX HBA I, MIN HBA I, HBA II CV4100, ...
    const cutoffDate = new Date('2024-01-01');

    for (let i = 2; i < hbaData.length; i++) {
      const row = hbaData[i];
      if (isEmptyRow(row)) continue;

      const dateStr = cleanStr(row[0]);
      if (!dateStr) continue;

      // Parse "Jan-15", "Feb-24" etc.
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) continue;
      if (date < cutoffDate) continue;

      records.push({
        date: date,
        hba: toFloat(row[1]),
        hbaI: toFloat(row[2]),
        hbaII: toFloat(row[6]),
        hbaIII: toFloat(row[10]),
        source: 'HBA Monthly',
      });
    }

    if (records.length > 0) {
      // Check for duplicate dates with ICI data and merge
      for (const rec of records) {
        const existing = await prisma.marketPrice.findFirst({
          where: { date: { gte: new Date(rec.date.getFullYear(), rec.date.getMonth(), 1), lt: new Date(rec.date.getFullYear(), rec.date.getMonth() + 1, 1) } }
        });
        if (existing) {
          // Update existing record with HBA data
          await prisma.marketPrice.update({
            where: { id: existing.id },
            data: { hba: rec.hba, hbaI: rec.hbaI, hbaII: rec.hbaII, hbaIII: rec.hbaIII }
          });
        } else {
          await prisma.marketPrice.create({ data: rec });
        }
        totalInserted++;
      }
      console.log('  ✅ HBA Monthly: ' + records.length + ' records merged/inserted');
    }
  }

  console.log('  📊 Total MarketPrice: ' + totalInserted + ' records');
  return totalInserted;
}

// ─── PHASE 2: EXTRA SHEETS ─────────────────────────────────

async function migrate_extras() {
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 2: EXTRA SHEETS MIGRATION');
  console.log('='.repeat(60));

  const ddFile = path.join(BASE_DIR, '10.Daily Delivery Report (Recap Shipment) 2020, 2021, 2022, 2023, 2024, 2025, 2026.xlsx');
  let total = 0;

  // ── 2023-Stockpile → DailyDelivery (reportType: stockpile) ──
  const spData = readSheet(ddFile, '2023-Stockpile');
  if (spData.length > 0) {
    const records = [];
    for (let i = 1; i < spData.length; i++) {
      const row = spData[i];
      if (isEmptyRow(row) || isTotalRow(row)) continue;
      const project = cleanStr(row[1]);
      if (!project) continue;

      records.push({
        reportType: 'stockpile',
        year: 2023,
        poMonth: cleanStr(row[0]),
        project: project,
        buyer: cleanStr(row[4]),
        product: cleanStr(row[5]),
        supplier: cleanStr(row[6]),
        shippingTerm: cleanStr(row[7]),
        contractNo: cleanStr(row[8]),
        mvBargeNomination: cleanStr(row[10]),
        shipmentStatus: cleanStr(row[11]) || 'Done',
        blQuantity: toFloat(row[12]),
        blDate: excelDateToJS(row[13]),
        pol: cleanStr(row[14]),
        pod: cleanStr(row[15]),
        surveyorPol: cleanStr(row[16]),
        analysisMethod: cleanStr(row[18]),
      });
    }
    const valid = records.filter(r => r.buyer || r.project);
    if (valid.length > 0) {
      const result = await prisma.dailyDelivery.createMany({ data: valid, skipDuplicates: true });
      total += result.count;
      console.log('  ✅ 2023-Stockpile: ' + result.count + ' records');
    }
  }

  // ── Fin → OutstandingPayment (financial data) ──
  const finData = readSheet(ddFile, 'Fin');
  if (finData.length > 0) {
    const records = [];
    for (let i = 1; i < finData.length; i++) {
      const row = finData[i];
      if (isEmptyRow(row) || isTotalRow(row)) continue;
      const buyer = cleanStr(row[4]);
      if (!buyer) continue;

      records.push({
        perusahaan: buyer,
        kodeBatu: cleanStr(row[2]) || cleanStr(row[6]), // project or supplier
        qty: toFloat(row[14]),
        priceInclPph: toFloat(row[16]),
        totalDp: toFloat(row[17]),
        status: cleanStr(row[18]) || 'pending',
        timeframeDays: cleanStr(row[15]) ? 'TOP ' + cleanStr(row[15]) : null,
        year: 2023,
      });
    }
    const valid = records.filter(r => r.perusahaan);
    if (valid.length > 0) {
      const result = await prisma.outstandingPayment.createMany({ data: valid, skipDuplicates: true });
      total += result.count;
      console.log('  ✅ Fin: ' + result.count + ' records → OutstandingPayment');
    }
  }

  // ── Sheet10 (RKAB quotas) → SourceSupplier ──
  const mvFile = path.join(BASE_DIR, '00. MV_Barge&Source 2021,2022, 2023,2024-7-19.xlsx');
  const rkabData = readSheet(mvFile, 'Sheet10');
  if (rkabData.length > 0) {
    const records = [];
    for (let i = 2; i < rkabData.length; i++) {
      const row = rkabData[i];
      if (isEmptyRow(row)) continue;
      const name = cleanStr(row[2]);
      if (!name) continue;

      // Check if this supplier already exists
      const existing = await prisma.sourceSupplier.findFirst({ where: { name: name } });
      if (!existing) {
        records.push({
          name: name,
          region: cleanStr(row[1]) || 'Unknown',
          origin: cleanStr(row[1]),
          stockAvailable: toFloat(row[3]) || 0, // RKAB 2024
          kycStatus: 'not_started',
          psiStatus: 'not_started',
        });
      }
    }
    if (records.length > 0) {
      const result = await prisma.sourceSupplier.createMany({ data: records, skipDuplicates: true });
      total += result.count;
      console.log('  ✅ Sheet10 (RKAB): ' + result.count + ' suppliers added');
    }
  }

  console.log('  📊 Total extras: ' + total + ' records');
  return total;
}

// ─── MAIN ───────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const phase = args.find(a => a.startsWith('--phase='));
  const phaseVal = phase ? phase.split('=')[1] : 'all';
  const dryRun = args.includes('--dry-run');

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  EXCEL → PRODUCTION DB MIGRATION                       ║');
  console.log('║  Phase: ' + phaseVal.padEnd(47) + ' ║');
  console.log('║  Dry Run: ' + String(dryRun).padEnd(45) + ' ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  try {
    // Test connection
    await prisma.$connect();
    console.log('✅ Database connected');

    if (phaseVal === '0' || phaseVal === 'all') {
      await phase0_cleanup();
    }

    if (phaseVal === '1' || phaseVal === 'all') {
      console.log('\n' + '='.repeat(60));
      console.log('PHASE 1: CORE DATA MIGRATION');
      console.log('='.repeat(60));

      await migrate_shipments();
      await migrate_daily_delivery();
      await migrate_outstanding_payment();
      await migrate_source_supplier();
      await migrate_market_price();
    }

    if (phaseVal === '2' || phaseVal === 'all') {
      await migrate_extras();
    }

    // Final count
    console.log('\n' + '='.repeat(60));
    console.log('FINAL DATABASE COUNTS');
    console.log('='.repeat(60));

    const counts = {
      ShipmentDetail: await prisma.shipmentDetail.count({ where: { isDeleted: false } }),
      DailyDelivery: await prisma.dailyDelivery.count({ where: { isDeleted: false } }),
      MarketPrice: await prisma.marketPrice.count({ where: { isDeleted: false } }),
      OutstandingPayment: await prisma.outstandingPayment.count({ where: { isDeleted: false } }),
      SourceSupplier: await prisma.sourceSupplier.count({ where: { isDeleted: false } }),
    };

    Object.entries(counts).forEach(function(entry) {
      console.log('  ' + entry[0] + ': ' + entry[1] + ' records');
    });

    console.log('\n✅ MIGRATION COMPLETE!');

  } catch (error) {
    console.error('\n❌ MIGRATION ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main();
