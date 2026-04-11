const { PrismaClient } = require('@prisma/client');
const xlsx = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();

const FILE_PATH = "00. MV_Barge&Source 2021,2022, 2023,2024-7-19.xlsx";
const SHEET_NAME = "Source Monitoring 2024";

async function main() {
    console.log("🚀 Starting Stock Inventory Migration...");

    try {
        const workbook = xlsx.readFile(FILE_PATH);
        const worksheet = workbook.Sheets[SHEET_NAME];
        
        if (!worksheet) {
            console.error(`❌ Sheet "${SHEET_NAME}" not found!`);
            return;
        }

        // Row 1 contains actual headers (A2, B2...)
        const rawData = xlsx.utils.sheet_to_json(worksheet, { range: 1 });
        console.log(`📊 Found ${rawData.length} rows in Excel.`);

        // Clear existing SourceSupplier data to avoid duplicates/stale data
        console.log("🧹 Clearing existing SourceSupplier records...");
        await prisma.sourceSupplier.deleteMany({});

        let createdCount = 0;

        for (const row of rawData) {
            const name = row["SOURCE"];
            if (!name || name === "SOURCE") continue;

            const region = row["AREA"] || "Unknown";
            const origin = row["ORIGIN"];
            const statusDetail = row["STATUS"];
            const qtyProduction = parseFloat(row["QTY (PRODUCTION)"]);
            const specGar = parseFloat(row["SPEC (GAR)"]);
            const dokumenFlow = row["DOKUMEN FLOW"];
            const psaResultGar = parseFloat(row["RESULT PSA (GAR)"]);
            
            // Handle date parsing for "UPDATED"
            let updatedDate = null;
            if (row["UPDATED"]) {
                if (typeof row["UPDATED"] === "number") {
                    // Excel serial date
                    updatedDate = new Date((row["UPDATED"] - 25569) * 86400 * 1000);
                } else {
                    const d = new Date(row["UPDATED"]);
                    if (!isNaN(d.getTime())) updatedDate = d;
                }
            }

            // Create record
            await prisma.sourceSupplier.create({
                data: {
                    name: String(name),
                    region: String(region),
                    origin: origin ? String(origin) : null,
                    statusDetail: statusDetail ? String(statusDetail) : null,
                    stockAvailable: isNaN(qtyProduction) ? 0 : qtyProduction,
                    qtyProduction: isNaN(qtyProduction) ? 0 : qtyProduction,
                    specGar: isNaN(specGar) ? null : specGar,
                    dokumenFlow: dokumenFlow ? String(dokumenFlow) : null,
                    psaResultGar: isNaN(psaResultGar) ? null : psaResultGar,
                    updatedDate: updatedDate,
                    calorieRange: specGar ? `GAR ${specGar}` : null,
                }
            });
            createdCount++;
        }

        console.log(`✅ Successfully migrated ${createdCount} stock inventory records.`);
    } catch (error) {
        console.error("❌ Migration failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
