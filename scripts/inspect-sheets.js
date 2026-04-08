const xlsx = require('xlsx');
const path = require('path');

const file1 = "00. MV_Barge&Source 2021,2022, 2023,2024-7-19.xlsx";
const sheet1 = "Source Monitoring 2024";

const file2 = "10.Daily Delivery Report (Recap Shipment) 2020, 2021, 2022, 2023, 2024, 2025, 2026.xlsx";
const sheet2 = "2023-Stockpile";

function inspect(file, sheet) {
    console.log(`\n--- Inspecting ${file} [${sheet}] ---`);
    try {
        const workbook = xlsx.readFile(file);
        const worksheet = workbook.Sheets[sheet];
        if (!worksheet) {
            console.log(`Sheet "${sheet}" not found in ${file}`);
            return;
        }
        const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
        if (data.length > 0) {
            console.log("Headers:", data[0]);
            console.log("Row 1 Sample:", data[1]);
            console.log("Row 2 Sample:", data[2]);
        }
    } catch (e) {
        console.error(`Error reading ${file}:`, e.message);
    }
}

inspect(file1, sheet1);
inspect(file2, sheet2);
