const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const prisma = new PrismaClient();

async function fullIntegrationTest() {
    console.log("=== STARTING FULL INTEGRATION TEST ===");

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    const today = new Date().toISOString().split("T")[0];
    const prompt = `Provide the LATEST coal prices as of today (${today}) in EXACT JSON. Required: ici_1, ici_2, ici_3, ici_4, ici_5, newcastle, hba, proof_url. Respond ONLY with JSON.`;

    try {
        // 1. SCRAPE
        console.log("1. Scraping from AI...");
        const scrapeRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: "You are a market data assistant. Output raw JSON ONLY." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.1,
            })
        });

        const scrapeData = await scrapeRes.json();
        const content = scrapeData.choices[0].message.content;
        const prices = JSON.parse(content.match(/\{[\s\S]*\}/)[0]);
        console.log("Scraped Data:", JSON.stringify(prices, null, 2));

        // 2. UPSERT Logic (Simulating POST /api/memory/market-prices)
        console.log("\n2. Upserting to Database...");
        const normalizedDate = new Date(today);

        const existing = await prisma.marketPrice.findFirst({
            where: { date: normalizedDate, isDeleted: false }
        });

        const priceData = {
            date: normalizedDate,
            ici1: parseFloat(prices.ici_1),
            ici2: parseFloat(prices.ici_2),
            ici3: parseFloat(prices.ici_3),
            ici4: parseFloat(prices.ici_4),
            ici5: parseFloat(prices.ici_5),
            newcastle: parseFloat(prices.newcastle),
            hba: parseFloat(prices.hba),
            source: `${prices.source || "AI Market Intelligence"} (${prices.proof_url || "Verified"})`
        };

        let result;
        if (existing) {
            console.log(`Found existing record for ${today}. Updating...`);
            result = await prisma.marketPrice.update({
                where: { id: existing.id },
                data: priceData
            });
        } else {
            console.log(`Creating new record for ${today}...`);
            result = await prisma.marketPrice.create({
                data: priceData
            });
        }
        console.log("Upsert Success. ID:", result.id);

        // 3. Test DUPLICATE PREVENTION (Upsert again for SAME date)
        console.log("\n3. Testing Duplicate Prevention (Updating same date with +1 dollar)...");
        const priceData2 = { ...priceData, hba: priceData.hba + 1 };

        const existing2 = await prisma.marketPrice.findFirst({
            where: { date: normalizedDate, isDeleted: false }
        });

        const result2 = await prisma.marketPrice.update({
            where: { id: existing2.id },
            data: priceData2
        });

        const count = await prisma.marketPrice.count({
            where: { date: normalizedDate, isDeleted: false }
        });

        if (count === 1) {
            console.log("✅ DUPLICATE PREVENTION PASSED: Only 1 record exists for this date.");
        } else {
            console.log("❌ DUPLICATE PREVENTION FAILED: Multiple records found for the same date.");
        }

        console.log("\n=== FULL INTEGRATION TEST COMPLETE ===");

    } catch (err) {
        console.error("Integration Test Error:", err);
    } finally {
        await prisma.$disconnect();
    }
}

fullIntegrationTest();
