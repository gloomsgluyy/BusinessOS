const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const prisma = new PrismaClient();

async function testScrape() {
    console.log("=== FINAL TEST SCRAPE (v24) ===");

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
        console.error("GROQ_API_KEY is missing!");
        return;
    }

    const today = new Date().toISOString().split("T")[0];
    const prompt = `Provide the LATEST coal prices as of today (${today}) in EXACT JSON. Required: ici_1, ici_2, ici_3, ici_4, ici_5, newcastle, hba, proof_url. Respond ONLY with JSON.`;

    try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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

        const data = await res.json();
        if (data.choices && data.choices[0]) {
            const content = data.choices[0].message.content;
            console.log("CONTENT:", content);

            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const prices = JSON.parse(jsonMatch[0]);
                console.log("PARSED:", JSON.stringify(prices, null, 2));

                const required = ["ici_1", "ici_2", "ici_3", "ici_4", "ici_5", "newcastle", "hba", "proof_url"];
                let ok = true;
                for (const k of required) {
                    if (prices[k] === undefined || prices[k] === 0) {
                        console.log(`❌ Missing or zero: ${k}`);
                        ok = false;
                    }
                }
                if (ok) console.log("\n✅ ALL DATA VERIFIED.");
            }
        } else {
            console.error("Error:", JSON.stringify(data, null, 2));
        }
    } catch (err) {
        console.error("Scrape Error:", err.message);
    }
}

testScrape();
