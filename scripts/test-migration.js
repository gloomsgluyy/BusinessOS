const { PrismaClient } = require('@prisma/client');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

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

async function main() {
  try {
    await prisma.$connect();
    console.log('DB connected');

    // Test: read first sheet and try insert 1 record
    const file = path.join(__dirname, '..', '00. MV_Barge&Source 2021,2022, 2023,2024-7-19.xlsx');
    console.log('Reading file:', file);
    console.log('File exists:', fs.existsSync(file));
    
    const wb = xlsx.readFile(file);
    console.log('Sheet names:', wb.SheetNames);
    
    // Read  MV_Barge&Source 2026
    const sheetName = wb.SheetNames.find(s => s.includes('2026'));
    if (!sheetName) {
      console.log('No 2026 sheet found');
      return;
    }
    console.log('Using sheet:', sheetName);
    
    const ws = wb.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });
    console.log('Total rows:', data.length);
    console.log('Row 0:', JSON.stringify(data[0]).substring(0, 200));
    console.log('Row 1:', JSON.stringify(data[1]).substring(0, 200));
    console.log('Row 2:', JSON.stringify(data[2]).substring(0, 200));
    console.log('Row 3:', JSON.stringify(data[3]).substring(0, 200));
    console.log('Row 4:', JSON.stringify(data[4]).substring(0, 200));
    console.log('Row 5:', JSON.stringify(data[5]).substring(0, 200));
    console.log('Row 6:', JSON.stringify(data[6]).substring(0, 200));
    
    // Try inserting row 6 (first data row)
    const row = data[6];
    const record = {
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
      year: 2026,
      type: 'export',
    };
    
    console.log('\nRecord to insert:', JSON.stringify(record, null, 2));
    
    const result = await prisma.shipmentDetail.create({ data: record });
    console.log('SUCCESS! ID:', result.id);
    
    // Clean up test record
    await prisma.shipmentDetail.delete({ where: { id: result.id } });
    console.log('Cleaned up test record');
    
  } catch (error) {
    console.error('ERROR:', error.message);
    console.error('CODE:', error.code);
    console.error('META:', JSON.stringify(error.meta));
  } finally {
    await prisma.$disconnect();
  }
}

main();
