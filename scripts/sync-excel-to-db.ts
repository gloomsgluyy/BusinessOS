import { PrismaClient } from '@prisma/client';
import * as xlsx from 'xlsx';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
    console.log("Starting DB Sync from Excel...");
    const year = 2025; // default year context where applicable

    try {
        console.log("1. Truncating old data...");
        // We delete all previous records first
        await prisma.marketPrice.deleteMany();
        await prisma.dailyDelivery.deleteMany();
        await prisma.shipmentDetail.deleteMany();

        console.log("2. Parsing Market Prices...");
        await syncMarketPrice();

        console.log("3. Parsing Shipment Details (MV_Barge)...");
        await syncShipmentDetail(year);

        console.log("4. Parsing Daily Deliveries...");
        await syncDailyDelivery(year);

        console.log("✅ Sync Complete!");
    } catch (e: any) {
        console.error("❌ Error during sync:");
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

// ----------------------------------------------------
// Market Price Sync
// ----------------------------------------------------
async function syncMarketPrice() {
    const wb = xlsx.readFile(path.resolve('ICI HBA HPB 2025.-2-4.xlsx'), { cellDates: true, dateNF: 'yyyy-mm-dd' });
    const sheet = wb.Sheets['ICI, GNewc, Delta'];
    const data: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false });

    const marketPrices = [];
    for (let i = 4; i < data.length; i++) {
        const row = data[i];
        if (!row || !row[0]) continue;

        let dateVal = new Date(row[0]);
        if (isNaN(dateVal.getTime())) continue;

        marketPrices.push({
            date: dateVal,
            ici1: parseFloat(row[1]) || null,
            ici2: parseFloat(row[2]) || null,
            ici3: parseFloat(row[3]) || null,
            ici4: parseFloat(row[4]) || null,
            ici5: parseFloat(row[5]) || null,
            newcastle: parseFloat(row[6]) || null,
        });
    }

    if (marketPrices.length > 0) {
        await prisma.marketPrice.createMany({ data: marketPrices });
    }
    console.log(`-> Inserted ${marketPrices.length} MarketPrice rows.`);
}

// ----------------------------------------------------
// Shipment Detail Sync
// ----------------------------------------------------
async function syncShipmentDetail(year: number) {
    const wb = xlsx.readFile(path.resolve('00. MV_Barge&Source 2021,2022, 2023,2024-7-19.xlsx'), { cellDates: true });
    // Let's read sheets 'MV_Barge&Source 2024' to '2026' if possible.
    // For simplicity we will sync 2025 as the primary source if it exists.
    const targetSheet = wb.Sheets['MV_Barge&Source 2025'] || wb.Sheets[wb.SheetNames[0]];
    const data: any[][] = xlsx.utils.sheet_to_json(targetSheet, { header: 1, defval: null });

    // Header is row 4 (0-indexed)
    const headerRow = data[4] || [];

    const shipments = [];
    for (let i = 5; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;

        const noVal = row[headerRow.indexOf('NO')];
        const mvProject = row[headerRow.indexOf('MV./PROJECT NAME')];
        if (!noVal && !mvProject) continue; // skip completely empty rows

        const qtyPlan = parseFloat(row[headerRow.indexOf('QTY (MT)')]) || null;
        let blDate = row[headerRow.indexOf('BL DATE')];
        if (typeof blDate === 'string') blDate = new Date(blDate);

        shipments.push({
            year: year,
            no: parseInt(noVal) || null,
            exportDmo: row[headerRow.indexOf('EXPORT / DMO')]?.toString() || null,
            status: row[headerRow.indexOf('STATUS')]?.toString() || 'upcoming',
            origin: row[headerRow.indexOf('ORIGIN')]?.toString() || null,
            mvProjectName: mvProject?.toString() || null,
            vesselName: mvProject?.toString() || null,
            source: row[headerRow.indexOf('SOURCE')]?.toString() || null,
            iupOp: row[headerRow.indexOf('IUP OP')]?.toString() || null,
            shipmentFlow: row[headerRow.indexOf('SHIPMENT FLOW')]?.toString() || null,
            jettyLoadingPort: row[headerRow.indexOf('JETTY / LOADING PORT')]?.toString() || null,
            laycan: row[headerRow.indexOf('LAYCAN')]?.toString() || null,
            nomination: row[headerRow.indexOf('NOMINATION')]?.toString() || null,
            qtyPlan: qtyPlan,
            qtyCob: parseFloat(row[headerRow.indexOf('COB')]) || null,
            blDate: isNaN(new Date(blDate).getTime()) ? null : new Date(blDate),
            hargaActualFob: parseFloat(row[headerRow.indexOf('HARGA ACTUAL')]) || null,
            hpb: parseFloat(row[headerRow.indexOf('HPB')]) || null,
            sp: parseFloat(row[headerRow.indexOf('SP')]) || null,
            shipmentStatus: row[headerRow.indexOf('SHIPMENT STATUS')]?.toString() || null,
            pic: row[headerRow.indexOf('PIC ')]?.toString() || null,
            buyer: row[headerRow.indexOf('BUYER')]?.toString() || '',
        });
    }

    if (shipments.length > 0) {
        await prisma.shipmentDetail.createMany({ data: shipments });
    }
    console.log(`-> Inserted ${shipments.length} ShipmentDetail rows.`);
}

// ----------------------------------------------------
// Daily Delivery Sync
// ----------------------------------------------------
async function syncDailyDelivery(year: number) {
    const wb = xlsx.readFile(path.resolve('10.Daily Delivery Report (Recap Shipment) 2020, 2021, 2022, 2023, 2024, 2025, 2026.xlsx'), { cellDates: true });
    let targetSheet;
    if (wb.Sheets['2025']) targetSheet = wb.Sheets['2025'];
    else if (wb.Sheets['2025']) targetSheet = wb.Sheets['2024'];
    else targetSheet = wb.Sheets[wb.SheetNames[0]];

    const data: any[][] = xlsx.utils.sheet_to_json(targetSheet, { header: 1, defval: null });

    // Header is row 1
    const headerRow = data[1] || [];

    const deliveries = [];
    for (let i = 2; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;

        const status = row[headerRow.indexOf('Status ')]?.toString();
        const buyer = row[headerRow.indexOf('Buyer')]?.toString();
        if (!buyer && !status) continue; // skip empty
        if (buyer && buyer.includes('TOTAL')) continue; // skip total rows

        deliveries.push({
            year: year,
            shipmentStatus: status || null,
            buyer: buyer || null,
            shippingTerm: row[headerRow.indexOf('Shipping Term')]?.toString() || null,
            area: row[headerRow.indexOf('Area')]?.toString() || null,
            supplier: row[headerRow.indexOf('Source')]?.toString() || null,
            pol: row[headerRow.indexOf('POL')]?.toString() || null,
            laycanPol: row[headerRow.indexOf('Laycan POL')]?.toString() || null,
            mvBargeNomination: row[headerRow.indexOf('Vessel Nomination')]?.toString() || null,
            project: row[headerRow.indexOf('Project Name')]?.toString() || null,
            flow: row[headerRow.indexOf('Flow')]?.toString() || null,
            blQuantity: parseFloat(row[headerRow.indexOf('BL Quantity')]) || null,
            invoiceAmount: parseFloat(row[headerRow.indexOf('Invoice Amount')]) || null,
            product: row[headerRow.indexOf('Product')]?.toString() || null,
            actualGcvGar: parseFloat(row[headerRow.indexOf('ACTUAL GAR')]) || null,
            poNo: row[headerRow.indexOf('Contract No.')]?.toString() || null,
            contractNo: row[headerRow.indexOf('Contract No.')]?.toString() || null,
        });
    }

    if (deliveries.length > 0) {
        await prisma.dailyDelivery.createMany({ data: deliveries });
    }
    console.log(`-> Inserted ${deliveries.length} DailyDelivery rows.`);
}

main();
