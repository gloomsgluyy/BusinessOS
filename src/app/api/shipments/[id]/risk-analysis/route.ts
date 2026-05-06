import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { AIAgent } from '@/lib/ai-agent';

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

        // Mock Weather and News data
        const weatherData = "Scattered thunderstorms expected at loading port over next 3 days. Wave heights up to 2.5m.";
        const newsData = "Port congestion reported at destination port, delaying berthing times by 48-72 hours.";

        const prompt = `
           Analyze the operational risk for the following shipment:
           - Origin: ${shipment.loadingPort || "Unknown"}, Destination: ${shipment.dischargePort || "Unknown"}, Cargo: ${shipment.product || "Coal"}
           - Weather Data: ${weatherData}
           - News/Incidents: ${newsData}
           
           Return ONLY a valid JSON object with this exact schema:
           {
             "score": <number 0-100>,
             "level": "<LOW|MEDIUM|HIGH|CRITICAL>",
             "summary": "<short string summarizing the risk>",
             "factors": ["<risk factor 1>", "<risk factor 2>"],
             "recommendations": "<string advising the admin on what to do>"
           }
        `;

        const ai = new AIAgent({ apiKey: process.env.OPENROUTER_API_KEY || "" });
        const aiResponse = await ai.chat([{ role: "user", content: prompt }]);
        
        let reportData;
        try {
            // Find JSON in response text
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                reportData = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error("No JSON found");
            }
        } catch (e) {
            console.error("Failed to parse AI response:", aiResponse);
            // Fallback object in case of parsing failure
            reportData = {
                score: 50,
                level: "MEDIUM",
                summary: "Analysis failed to parse, showing fallback data.",
                factors: ["Weather delays possible", "Port congestion"],
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
