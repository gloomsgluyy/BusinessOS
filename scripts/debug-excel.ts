import * as xlsx from 'xlsx';
import * as path from 'path';

function debugHeaders() {
    console.log("Reading MV_Barge...");
    const mvWb = xlsx.readFile(path.resolve('00. MV_Barge&Source 2021,2022, 2023,2024-7-19.xlsx'));
    const mvSheet = mvWb.Sheets['MV_Barge&Source 2025'];
    // extract as array to get rows directly
    const mvData: any[][] = xlsx.utils.sheet_to_json(mvSheet, { header: 1 });
    console.log("MV Rows 0-5:");
    console.log(mvData.slice(0, 5));

    console.log("\nReading Daily Delivery...");
    try {
        const ddWb = xlsx.readFile(path.resolve('10.Daily Delivery Report (Recap Shipment) 2020, 2021, 2022, 2023, 2024, 2025, 2026.xlsx'));
        const ddSheet = ddWb.Sheets['2025'] || ddWb.Sheets[ddWb.SheetNames[0]];
        const ddData: any[][] = xlsx.utils.sheet_to_json(ddSheet, { header: 1 });
        console.log("DD Rows 0-5:");
        console.log(ddData.slice(0, 5));
    } catch (e) {
        console.log("DD error: ", (e as any).message);
    }
}

debugHeaders();
