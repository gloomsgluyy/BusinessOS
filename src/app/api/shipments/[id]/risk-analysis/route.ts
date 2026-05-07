import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { fetchShipmentNews } from "@/services/apiExtraction/newsExtractor";
import { fetchPortWeather } from "@/services/apiExtraction/weatherExtractor";
import { fetchMarineData } from "@/services/apiExtraction/marineExtractor";
import { fetchBMKGEarthquakeAndAlerts } from "@/services/apiExtraction/bmkgExtractor";
import { checkAiRateLimit } from "@/lib/ai-security";
import { normalizeRole } from "@/lib/role-access";

export const dynamic = "force-dynamic";

type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

const ALLOWED_ROLES = new Set([
  "CEO",
  "DIRUT",
  "ASS_DIRUT",
  "COO",
  "ADMIN_OPERATION",
  "TRAFFIC_HEAD",
  "TRAFFIC_TEAM_1",
  "TRAFFIC_TEAM_2",
  "TRAFFIC_TEAM_3",
  "TRAFFIC_TEAM_4",
  "QC_MANAGER",
  "QC_ADMIN_1",
  "QC_ADMIN_2",
]);

function scoreToLevel(score: number): RiskLevel {
  if (score >= 85) return "CRITICAL";
  if (score >= 70) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

function asNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function riskPointsFromHint(hint?: string): number {
  if (hint === "high") return 25;
  if (hint === "medium") return 12;
  return 0;
}

function buildFallbackReport(input: {
  shipment: any;
  news: any[];
  weatherLoad: any;
  weatherDischarge: any;
  marineData: any;
  bmkgAlerts: any;
}) {
  const { shipment, news, weatherLoad, weatherDischarge, marineData, bmkgAlerts } = input;
  const factors: string[] = [];
  let score = 20;

  const weatherScore = riskPointsFromHint(weatherLoad?.riskHint) + riskPointsFromHint(weatherDischarge?.riskHint);
  if (weatherScore > 0) {
    score += weatherScore;
    factors.push(`Weather exposure: load port ${weatherLoad?.description || "unknown"}, discharge port ${weatherDischarge?.description || "unknown"}.`);
  }

  const waveHeight = asNumber(marineData?.waveHeight);
  if (waveHeight >= 3) {
    score += 25;
    factors.push(`Marine condition: wave height ${waveHeight.toFixed(1)} m requires voyage and loading caution.`);
  } else if (waveHeight >= 2) {
    score += 12;
    factors.push(`Marine condition: wave height ${waveHeight.toFixed(1)} m is moderate.`);
  }

  const statusText = `${shipment.status || ""} ${shipment.shipmentStatus || ""}`.toLowerCase();
  if (statusText.includes("pending") || statusText.includes("waiting")) {
    score += 15;
    factors.push(`Shipment is waiting/pending: ${shipment.statusReason || shipment.issueNotes || "reason not specified"}.`);
  }

  const demurrageRate = asNumber(shipment.demurrageRate);
  if (demurrageRate > 0) {
    score += demurrageRate >= 10000 ? 15 : 8;
    factors.push(`Demurrage exposure detected at ${shipment.demurrageCurrency || "USD"} ${demurrageRate.toLocaleString("en-US")}/day.`);
  }

  if (bmkgAlerts?.latestEarthquake?.magnitude) {
    const mag = asNumber(bmkgAlerts.latestEarthquake.magnitude);
    if (mag >= 5.5) {
      score += 12;
      factors.push(`BMKG alert: recent M${mag} event near ${bmkgAlerts.latestEarthquake.region || "Indonesia"}.`);
    }
  }

  const relevantNews = news.filter((n) => n?.source !== "System" && n?.source !== "Mock News");
  if (relevantNews.length > 0) {
    score += 8;
    factors.push(`External news found: ${relevantNews.slice(0, 2).map((n) => n.title).join("; ")}.`);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const level = scoreToLevel(score);
  const recommendations = [
    level === "CRITICAL" || level === "HIGH"
      ? "Hold dispatch decision until Traffic Head confirms weather window, port readiness, and demurrage exposure."
      : "Proceed with normal monitoring and refresh risk analysis before laycan or port arrival.",
    demurrageRate > 0
      ? "Operation team should update operational info daily and negotiate laytime/demurrage mitigation with counterparty."
      : "Operation team should add demurrage rate in Operational Info if port waiting risk appears.",
    waveHeight >= 2
      ? "Coordinate with barge owner and surveyor for loading/discharge safety window."
      : "Keep standard route and safety checks active.",
  ];

  return {
    score,
    level,
    summary: `${shipment.vesselName || shipment.mvProjectName || "Shipment"} is rated ${level} based on weather, marine condition, status, news, BMKG alert, and demurrage exposure.`,
    factors: factors.length ? factors : ["No major external risk signal detected from the current data pull."],
    recommendations: recommendations.join(" "),
    mitigationPlan: [
      {
        action: "Confirm port and weather window",
        owner: "Traffic / Operation",
        due: "Before next loading or discharge milestone",
        status: level === "LOW" ? "monitor" : "urgent",
      },
      {
        action: "Update Operational Info and demurrage exposure",
        owner: "Admin Operation",
        due: "Daily until shipment completed",
        status: demurrageRate > 0 ? "active" : "needs_data",
      },
      {
        action: "Notify buyer/supplier if delay risk increases",
        owner: "PIC Shipment",
        due: "When risk reaches HIGH",
        status: score >= 70 ? "active" : "standby",
      },
    ],
    sourceSnapshot: {
      weatherLoad,
      weatherDischarge,
      marineData,
      bmkgAlerts,
      news: news.slice(0, 5),
    },
  };
}

async function runAiReport(prompt: string) {
  const groqKey = process.env.GROQ_API_KEY;
  const openRouterKey = process.env.OPENROUTER_API_KEY;

  if (!groqKey && !openRouterKey) return null;

  const isGroq = Boolean(groqKey);
  const url = isGroq
    ? "https://api.groq.com/openai/v1/chat/completions"
    : "https://openrouter.ai/api/v1/chat/completions";
  const apiKey = isGroq ? groqKey : openRouterKey;
  const model = isGroq
    ? "llama-3.3-70b-versatile"
    : (process.env.OPENROUTER_RISK_MODEL || "meta-llama/llama-3.1-70b-instruct");

  const aiRes = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXTAUTH_URL || "http://localhost:3000",
      "X-Title": "Business OS Risk Analysis",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Return strict JSON only. Do not wrap output in markdown." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    }),
  });

  if (!aiRes.ok) {
    const err = await aiRes.text();
    throw new Error(`AI API Error: ${aiRes.status} ${err}`);
  }

  const aiData = await aiRes.json();
  let aiResponse = aiData.choices?.[0]?.message?.content || "";
  aiResponse = aiResponse.replace(/```json/gi, "").replace(/```/g, "").trim();
  const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
  return JSON.parse(jsonMatch ? jsonMatch[0] : aiResponse);
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = normalizeRole(session.user.role);
    if (!role || !ALLOWED_ROLES.has(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rate = checkAiRateLimit(`shipment-risk:${session.user.id}`, 20, 60 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many shipment risk analyses. Please retry later." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }

    const id = params.id;
    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    const shipment = await prisma.shipmentDetail.findUnique({ where: { id } });
    if (!shipment || shipment.isDeleted) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    const loadingPort = shipment.loadingPort || shipment.jettyLoadingPort || "Samarinda";
    const dischargePort = shipment.dischargePort || "Taboneo";
    const product = shipment.product || "Coal";

    const [news, weatherLoad, weatherDischarge, marineData, bmkgAlerts] = await Promise.all([
      fetchShipmentNews(`${loadingPort} ${dischargePort} coal shipment port delay weather`),
      fetchPortWeather(null, null, loadingPort),
      fetchPortWeather(null, null, dischargePort),
      fetchMarineData(null, null, loadingPort),
      fetchBMKGEarthquakeAndAlerts(),
    ]);

    const fallbackReport = buildFallbackReport({
      shipment,
      news,
      weatherLoad,
      weatherDischarge,
      marineData,
      bmkgAlerts,
    });

    const prompt = `
Anda adalah AI Agent Risk Analyst maritim untuk shipment batubara.
Nilai risiko pengiriman dan buat mitigation recommendation yang bisa dieksekusi.

SHIPMENT:
${JSON.stringify({
  id: shipment.id,
  vesselName: shipment.vesselName,
  project: shipment.mvProjectName,
  product,
  route: `${loadingPort} -> ${dischargePort}`,
  status: shipment.status,
  shipmentStatus: shipment.shipmentStatus,
  statusReason: shipment.statusReason,
  operationalInfo: shipment.operationalInfo,
  demurrageRate: shipment.demurrageRate,
  demurrageCurrency: shipment.demurrageCurrency,
})}

DATA EKSTERNAL:
${JSON.stringify({ news, weatherLoad, weatherDischarge, marineData, bmkgAlerts })}

Kembalikan HANYA JSON:
{
  "score": <number 0-100>,
  "level": "<LOW|MEDIUM|HIGH|CRITICAL>",
  "summary": "<ringkasan>",
  "factors": ["..."],
  "recommendations": "<narasi mitigasi>",
  "mitigationPlan": [
    {"action":"...", "owner":"...", "due":"...", "status":"standby|active|urgent|needs_data|monitor"}
  ],
  "sourceSnapshot": { "weatherLoad": {}, "weatherDischarge": {}, "marineData": {}, "bmkgAlerts": {}, "news": [] }
}
`;

    let reportData = fallbackReport;
    try {
      const aiReport = await runAiReport(prompt);
      if (aiReport?.score !== undefined && aiReport?.level) {
        reportData = {
          ...fallbackReport,
          ...aiReport,
          score: Math.max(0, Math.min(100, Math.round(Number(aiReport.score) || fallbackReport.score))),
          level: String(aiReport.level || fallbackReport.level).toUpperCase(),
          sourceSnapshot: aiReport.sourceSnapshot || fallbackReport.sourceSnapshot,
        };
      }
    } catch (error) {
      console.warn("Risk AI unavailable, using deterministic fallback:", error);
    }

    const updated = await prisma.shipmentDetail.update({
      where: { id },
      data: {
        riskScore: reportData.score,
        riskLevel: reportData.level,
        riskReport: JSON.stringify(reportData),
        lastAnalyzedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        userName: session.user.name || "Unknown",
        action: "RISK_ANALYSIS",
        entity: "ShipmentDetail",
        entityId: id,
        details: JSON.stringify({ score: reportData.score, level: reportData.level }),
      },
    }).catch(() => null);

    return NextResponse.json({ success: true, data: updated, report: reportData });
  } catch (error: any) {
    console.error("Risk Analysis Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
