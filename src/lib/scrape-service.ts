import prisma from './prisma';

const GROQ_API_KEY = process.env.GROQ_API_KEY;

export interface ScrapedPrices {
    ici1: number;
    ici2: number;
    ici3: number;
    ici4: number;
    ici5: number;
    newcastle: number;
    hba: number;
    proof_url: string;
}

export class ScrapeService {
    private static async fetchWithGroq(prompt: string): Promise<string> {
        if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY is missing");

        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: "You are a specialized market data extraction assistant. You must output raw JSON ONLY. Do not include markdown blocks or commentary." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.1,
            })
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(`Groq API error: ${JSON.stringify(error)}`);
        }

        const data = await res.json();
        return data.choices[0].message.content;
    }

    private static validate(data: any): data is ScrapedPrices {
        const requiredKeys = ["ici1", "ici2", "ici3", "ici4", "ici5", "newcastle", "hba", "proof_url"];
        for (const key of requiredKeys) {
            if (data[key] === undefined || data[key] === null) {
                throw new Error(`Validation failed: Missing key ${key}`);
            }
            if (key !== "proof_url" && (typeof data[key] !== "number" || data[key] <= 0)) {
                throw new Error(`Validation failed: Key ${key} must be a positive number`);
            }
        }
        return true;
    }

    public static async scrapePrices(retries = 3): Promise<ScrapedPrices> {
        const today = new Date().toISOString().split("T")[0];
        const prompt = `Provide the LATEST coal prices as of today (${today}) in EXACT JSON. 
    Keys: ici1, ici2, ici3, ici4, ici5, newcastle, hba, proof_url.
    Note: prices for ICI 1-5 should be in USD/tonne (e.g. 6500, 5800, etc). Newcastle and HBA should be around 80-150.
    The proof_url must be a valid public URL where this data can be verified (e.g. CME Group, Investing.com, or Platts).
    Respond ONLY with raw JSON.`;

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                console.log(`Scraping attempt ${attempt}/${retries}...`);
                const rawContent = await this.fetchWithGroq(prompt);
                const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
                if (!jsonMatch) throw new Error("No JSON found in response");

                const prices = JSON.parse(jsonMatch[0]);
                this.validate(prices);

                console.log("✅ Scraping successful and validated.");
                return prices;
            } catch (err: any) {
                console.error(`❌ Attempt ${attempt} failed: ${err.message}`);
                if (attempt === retries) throw err;
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
        throw new Error("Scraping failed after retries");
    }

    public static async saveToDatabase(prices: ScrapedPrices) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Deduplication: upsert based on date (only latest per day)
        // Note: MarketPrice model in schema.prisma has id as PRIMARY KEY (cuid)
        // and doesn't have a unique constraint on date. We handle deduplication manually.

        const existing = await prisma.marketPrice.findFirst({
            where: {
                date: {
                    gte: today,
                    lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
                }
            }
        });

        if (existing) {
            return await prisma.marketPrice.update({
                where: { id: existing.id },
                data: {
                    ...prices,
                    date: new Date(),
                    source: prices.proof_url,
                    updatedAt: new Date(),
                }
            });
        } else {
            return await prisma.marketPrice.create({
                data: {
                    ...prices,
                    date: new Date(),
                    source: prices.proof_url,
                }
            });
        }
    }
}
