import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { fetchShipmentNews } from "@/services/apiExtraction/newsExtractor";
import { fetchPortWeather } from "@/services/apiExtraction/weatherExtractor";
import { fetchMarineData } from "@/services/apiExtraction/marineExtractor";
import { fetchBMKGEarthquakeAndAlerts } from "@/services/apiExtraction/bmkgExtractor";

export async function POST(req: Request, { params }: { params: { id: string } }) {
    try {
        const id = params.id;
        if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

        const shipment = await prisma.shipmentDetail.findUnique({
            where: { id }
        });

        if (!shipment) {
            return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
        }

        const loadingPort = shipment.loadingPort || "Unknown Port";
        const dischargePort = shipment.dischargePort || "Unknown Port";
        const product = shipment.product || "Coal";

        // 2. Kumpulkan Semua Data Eksternal (Parallel fetching)
        const [
            news, 
            weatherLoad, 
            weatherDischarge, 
            marineData, 
            bmkgAlerts
        ] = await Promise.all([
            fetchShipmentNews(`${loadingPort} OR ${dischargePort} maritime`),
            fetchPortWeather(null, null, loadingPort),
            fetchPortWeather(null, null, dischargePort),
            fetchMarineData(null, null, loadingPort),
            fetchBMKGEarthquakeAndAlerts()
        ]);

        const prompt = `
Anda adalah "AI Agent Risk Analyst" maritim. 
Tugas Anda adalah menilai Risiko Pengiriman kargo: ${product} 
Rute: ${loadingPort} -> ${dischargePort}

DATA EKSTERNAL SAAT INI:
- Berita Terkait (NewsAPI & MediaStack): ${JSON.stringify(news)}
- Cuaca Area Muat (OpenWeatherMap/WeatherAPI): ${JSON.stringify(weatherLoad)}
- Cuaca Area Bongkar (OpenWeatherMap/WeatherAPI): ${JSON.stringify(weatherDischarge)}
- Kondisi Laut (Stormglass): ${JSON.stringify(marineData)}
- Peringatan Dini Indonesia (BMKG): ${JSON.stringify(bmkgAlerts)}

INSTRUKSI:
Lakukan agregasi dari semua data di atas. Deteksi jika ada cuaca ekstrem, ombak tinggi, berita penutupan pelabuhan, atau peringatan tsunami.
Kembalikan HANYA JSON dengan schema berikut:
{
   "score": <number 0-100, 100=Paling Berisiko>,
   "level": "<LOW|MEDIUM|HIGH|CRITICAL>",
   "summary": "<Analisis ringkas dari berbagai sumber data ini>",
   "factors": ["Faktor yang memicu skor tinggi/rendah"],
   "recommendations": "<Tindakan yang harus diambil Admin/Operator Kapal>"
}
`;

        const apiKey = process.env.GROQ_API_KEY || process.env.OPENROUTER_API_KEY || process.env.AI_API_KEY;
        if (!apiKey) {
             throw new Error("No AI API Key configured.");
        }

        // We use Groq directly since the server might fail doing relative fetch("/api/chat")
        const aiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama3-70b-8192", // excellent for JSON structuring
                messages: [{ role: "system", content: "You strictly return JSON." }, { role: "user", content: prompt }],
                temperature: 0.2
            })
        });

        if (!aiRes.ok) {
            const err = await aiRes.text();
            throw new Error(`AI API Error: ${aiRes.status} ${err}`);
        }

        const aiData = await aiRes.json();
        let aiResponse = aiData.choices?.[0]?.message?.content || "";
        
        let reportData;
        try {
            // Clean markdown if any
            aiResponse = aiResponse.replace(/```json/gi, "").replace(/```/g, "").trim();
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                reportData = JSON.parse(jsonMatch[0]);
            } else {
                reportData = JSON.parse(aiResponse);
            }
        } catch (e) {
            console.error("Failed to parse AI response:", aiResponse);
            reportData = {
                score: 50,
                level: "MEDIUM",
                summary: "Analysis failed to parse properly. Raw response: " + aiResponse.substring(0, 100),
                factors: ["Parsing error"],
                recommendations: "Review manually."
            };
        }

        const updated = await prisma.shipmentDetail.update({
            where: { id },
            data: {
                riskScore: reportData.score,
                riskLevel: reportData.level,
                riskReport: JSON.stringify(reportData),
                lastAnalyzedAt: new Date()
            }
        });

        return NextResponse.json({ success: true, data: updated });
    } catch (error: any) {
        console.error("Risk Analysis Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
