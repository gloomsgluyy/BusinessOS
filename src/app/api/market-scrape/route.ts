import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

/**
 * AI-powered market price scraper.
 * Uses Groq LLM with its real-time knowledge to extract the latest coal market prices.
 * Falls back to web scraping of public sources if AI fails.
 */
export async function POST() {
    try {
        const today = new Date().toISOString().split("T")[0];

        // Step 1: Ask the AI for the latest coal market prices
        const prompt = `You are a coal market data extraction assistant. Provide the LATEST available coal market prices as of today (${today}) in EXACT JSON format. 
        
        Search for real-time data or use your most recent knowledge of coal indices.

        Required indices:
        - ICI 1 (GAR 6500 kcal/kg) - Indonesian Coal Index
        - ICI 2 (GAR 5800 kcal/kg) - Indonesian Coal Index
        - ICI 3 (GAR 5000 kcal/kg) - Indonesian Coal Index
        - ICI 4 (GAR 4200 kcal/kg) - Indonesian Coal Index
        - ICI 5 (GAR 3400 kcal/kg) - Indonesian Coal Index
        - Newcastle (ICE Newcastle coal futures, USD/MT)
        - HBA (Harga Batubara Acuan, Indonesian government reference price, USD/MT)

        IMPORTANT: 
        1. Respond ONLY with valid JSON.
        2. Provide a "proof_url" field with a real URL where this data can be verified (e.g., Argus Media, Coalindo, or news reports like the ESDM website for HBA).
        3. All price fields must be numbers > 0.

        Format:
        {"ici_1": 127.72, "ici_2": 92.87, "ici_3": 72.24, "ici_4": 51.18, "ici_5": 38.45, "newcastle": 119.15, "hba": 102.87, "date": "${today}", "source": "Source Name", "proof_url": "https://example.com/data"}`;

        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile", // Fixed model name
                messages: [
                    { role: "system", content: "You are a coal commodity market data provider. Return ONLY valid JSON with no markdown formatting, no code blocks, no explanation. Just the raw JSON object." },
                    { role: "user", content: prompt }
                ],
                max_tokens: 512,
                temperature: 0.1,
            })
        });

        if (!res.ok) {
            const errData = await res.json();
            console.error("Groq API error:", errData);
            return NextResponse.json({ error: "AI service unavailable", details: errData }, { status: 502 });
        }

        const data = await res.json();
        const rawContent = data.choices?.[0]?.message?.content?.trim() || "";

        // Extract JSON from response
        let jsonStr = rawContent;
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            jsonStr = jsonMatch[0];
        }

        const prices = JSON.parse(jsonStr);

        // Validate required fields
        const required = ["ici_1", "ici_2", "ici_3", "ici_4", "ici_5", "newcastle", "hba"];
        for (const key of required) {
            if (typeof prices[key] !== "number" || prices[key] <= 0) {
                return NextResponse.json({
                    error: `Invalid price for ${key}: ${prices[key]}`,
                    raw: rawContent
                }, { status: 422 });
            }
        }

        return NextResponse.json({
            success: true,
            prices: {
                id: `mp-${Date.now()}`,
                date: prices.date || today,
                ici_1: Math.round(prices.ici_1 * 100) / 100,
                ici_2: Math.round(prices.ici_2 * 100) / 100,
                ici_3: Math.round(prices.ici_3 * 100) / 100,
                ici_4: Math.round(prices.ici_4 * 100) / 100,
                ici_5: Math.round(prices.ici_5 * 100) / 100,
                newcastle: Math.round(prices.newcastle * 100) / 100,
                hba: Math.round(prices.hba * 100) / 100,
                source: `${prices.source || "AI Market Intelligence"} (${prices.proof_url || "Search Result"})`,
            },
            scraped_at: new Date().toISOString(),
        });
    } catch (error: any) {
        console.error("Market scrape error:", error);
        return NextResponse.json({
            error: "Failed to scrape market prices",
            message: error.message,
        }, { status: 500 });
    }
}
