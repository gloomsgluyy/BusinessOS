/**
 * REMAINING MIGRATION: HBA Monthly + Phase 2 Extras
 * Picks up where the main migration stopped
 */
const { PrismaClient } = require('@prisma/client');
const xlsx = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();
const BASE_DIR = path.resolve(__dirname, '..');

function excelDateToJS(serial) {
  if (!serial) return null;
  if (serial instanceof Date) return serial;
  if (typeof serial === 'string') {
    const d = new Date(serial);
    if (!isNaN(d.getTime()) && d.getFullYear() > 1990) return d;
    return null;
  }
  if (typeof serial === 'number' && serial > 25569) {
    return new Date((serial - 25569) * 86400 * 1000);
  }
  return null;
}

function toFloat(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.\-]/g, ''));
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
    console.log('  ⚠ Sheet "' + sheetName + '" not found. Available:', wb.SheetNames.join(', '));
    return [];
  }
  return xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
}

function isEmptyRow(row) {
  if (!row) return true;
  return row.every(c => c === '' || c === null || c === undefined);
}

function isTotalRow(row) {
  if (!row) return false;
  return row.map(String).join(' ').toLowerCase().includes('total');
}

async function main() {
  try {
    await prisma.$connect();
    console.log('✅ DB connected\n');

    // ═══ 1. HBA Monthly Data ═══
    console.log('='.repeat(50));
    console.log('1. Migrating HBA Monthly Data...');
    console.log('='.repeat(50));
    
    const iciFile = path.join(BASE_DIR, 'ICI HBA HPB 2025.-2-4.xlsx');
    const hbaData = readSheet(iciFile, 'HBA');
    
    if (hbaData.length > 0) {
      let hbaCount = 0;
      const cutoffDate = new Date('2024-01-01');
      
      for (let i = 2; i < hbaData.length; i++) {
        const row = hbaData[i];
        if (isEmptyRow(row)) continue;
        
        const dateStr = cleanStr(row[0]);
        if (!dateStr) continue;
        
        // Parse date - could be Excel serial or string like "Jan-24"
        let date = excelDateToJS(row[0]);
        if (!date) {
          date = new Date(dateStr);
        }
        if (!date || isNaN(date.getTime())) {
          console.log('  ⚠ Skipping invalid date:', dateStr);
          continue;
        }
        if (date < cutoffDate) continue;
        
        const hba = toFloat(row[1]);
        const hbaI = toFloat(row[2]);
        const hbaII = toFloat(row[6]);
        const hbaIII = toFloat(row[10]);
        
        if (!hba && !hbaI) continue; // skip empty rows
        
        try {
          // Find existing ICI record for the same month to merge
          const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
          const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 1);
          
          const existing = await prisma.marketPrice.findFirst({
            where: {
              date: { gte: monthStart, lt: monthEnd }
            }
          });
          
          if (existing) {
            await prisma.marketPrice.update({
              where: { id: existing.id },
              data: { hba, hbaI, hbaII, hbaIII }
            });
            console.log('  📝 Merged HBA into existing ICI record for', date.toISOString().substring(0, 7));
          } else {
            await prisma.marketPrice.create({
              data: { date, hba, hbaI, hbaII, hbaIII, source: 'HBA Monthly' }
            });
            console.log('  ➕ Created new HBA record for', date.toISOString().substring(0, 7));
          }
          hbaCount++;
        } catch (e) {
          console.log('  ❌ Error for date', dateStr, ':', e.message.substring(0, 80));
        }
      }
      console.log('  ✅ HBA Monthly: ' + hbaCount + ' records processed');
    }

    // ═══ 2. Phase 2 Extras ═══
    console.log('\n' + '='.repeat(50));
    console.log('2. Phase 2: Extra Sheets Migration...');
    console.log('='.repeat(50));

    const ddFile = path.join(BASE_DIR, '10.Daily Delivery Report (Recap Shipment) 2020, 2021, 2022, 2023, 2024, 2025, 2026.xlsx');
    const mvFile = path.join(BASE_DIR, '00. MV_Barge&Source 2021,2022, 2023,2024-7-19.xlsx');
    let extrasCount = 0;

    // ── 2023-Stockpile → DailyDelivery (reportType: stockpile) ──
    console.log('\n  --- 2023-Stockpile ---');
    const spData = readSheet(ddFile, '2023-Stockpile');
    if (spData.length > 0) {
      const records = [];
      for (let i = 1; i < spData.length; i++) {
        const row = spData[i];
        if (isEmptyRow(row) || isTotalRow(row)) continue;
        const project = cleanStr(row[1]);
        if (!project) continue;

        records.push({
          reportType: 'stockpile', year: 2023,
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
        extrasCount += result.count;
        console.log('  ✅ 2023-Stockpile: ' + result.count + ' records');
      }
    }

    // ── Fin → OutstandingPayment ──
    console.log('\n  --- Fin Sheet ---');
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
          kodeBatu: cleanStr(row[2]) || cleanStr(row[6]),
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
        extrasCount += result.count;
        console.log('  ✅ Fin: ' + result.count + ' records → OutstandingPayment');
      } else {
        console.log('  ⚠ Fin: no valid records');
      }
    }

    // ── Sheet10 (RKAB quotas) → SourceSupplier ──
    console.log('\n  --- Sheet10 (RKAB) ---');
    const rkabData = readSheet(mvFile, 'Sheet10');
    if (rkabData.length > 0) {
      const records = [];
      for (let i = 2; i < rkabData.length; i++) {
        const row = rkabData[i];
        if (isEmptyRow(row)) continue;
        const name = cleanStr(row[2]);
        if (!name) continue;

        const existing = await prisma.sourceSupplier.findFirst({ where: { name: name } });
        if (!existing) {
          records.push({
            name: name,
            region: cleanStr(row[1]) || 'Unknown',
            origin: cleanStr(row[1]),
            stockAvailable: toFloat(row[3]) || 0,
            kycStatus: 'not_started',
            psiStatus: 'not_started',
          });
        }
      }
      if (records.length > 0) {
        const result = await prisma.sourceSupplier.createMany({ data: records, skipDuplicates: true });
        extrasCount += result.count;
        console.log('  ✅ Sheet10 (RKAB): ' + result.count + ' suppliers added');
      } else {
        console.log('  ⚠ Sheet10: all suppliers already exist');
      }
    }

    console.log('\n  📊 Total extras: ' + extrasCount + ' records');

    // ═══ FINAL COUNTS ═══
    console.log('\n' + '='.repeat(50));
    console.log('FINAL DATABASE COUNTS');
    console.log('='.repeat(50));

    const counts = {
      ShipmentDetail: await prisma.shipmentDetail.count(),
      DailyDelivery: await prisma.dailyDelivery.count(),
      MarketPrice: await prisma.marketPrice.count(),
      OutstandingPayment: await prisma.outstandingPayment.count(),
      SourceSupplier: await prisma.sourceSupplier.count(),
    };

    let grandTotal = 0;
    Object.entries(counts).forEach(([k, v]) => {
      console.log('  ' + k + ': ' + v);
      grandTotal += v;
    });
    console.log('\n  GRAND TOTAL: ' + grandTotal + ' records');
    console.log('\n✅ REMAINING MIGRATION COMPLETE!');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main();
