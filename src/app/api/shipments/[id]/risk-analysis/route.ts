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

function normalizeText(v: unknown): string {
  return String(v || "").toLowerCase();
}

function detectRouteChokepoints(shipment: any, loadingPort: string, dischargePort: string) {
  const text = normalizeText([
    loadingPort,
    dischargePort,
    shipment.origin,
    shipment.shipmentFlow,
    shipment.buyerCountry,
    shipment.region,
  ].join(" "));
  const hits: Array<{ name: string; risk: number; note: string }> = [];
  const add = (name: string, risk: number, note: string) => {
    if (!hits.some((hit) => hit.name === name)) hits.push({ name, risk, note });
  };

  if (/red sea|suez|yemen|hodeidah|bab el|aden/.test(text)) add("Red Sea / Gulf of Aden", 30, "Potential conflict/security exposure on route.");
  if (/hormuz|persian gulf|iran|oman/.test(text)) add("Strait of Hormuz", 22, "Strategic chokepoint exposure.");
  if (/malacca|singapore|strait/.test(text)) add("Malacca/Singapore Strait", 10, "High traffic maritime chokepoint.");
  if (/south china sea|manila|philippines|vietnam|taiwan/.test(text)) add("South China Sea", 16, "Weather/geopolitical routing needs monitoring.");
  if (/korea|japan|china/.test(text)) add("North Asia leg", 10, "Longer ocean leg, monitor weather window and discharge readiness.");
  if (/ciwandan|cilegon|anyer|banten/.test(text)) add("Sunda / Ciwandan approach", 8, "Check port congestion and local weather before discharge.");
  if (/taboneo|samarinda|kalimantan|barito|bintuni/.test(text)) add("Kalimantan loading area", 8, "River/anchorage weather and barge readiness can affect loading.");

  return hits;
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
  const routeFindings: string[] = [];
  const decisionTriggers: string[] = [];
  let score = 20;
  const loadingPort = shipment.loadingPort || shipment.jettyLoadingPort || "Unknown load port";
  const dischargePort = shipment.dischargePort || "Unknown discharge port";
  const chokepoints = detectRouteChokepoints(shipment, loadingPort, dischargePort);

  if (chokepoints.length > 0) {
    const routeScore = Math.min(35, chokepoints.reduce((sum, item) => sum + item.risk, 0));
    score += routeScore;
    routeFindings.push(...chokepoints.map((item) => `${item.name}: ${item.note}`));
    factors.push(`Route exposure detected: ${chokepoints.map((item) => item.name).join(", ")}.`);
  }

  const weatherScore = riskPointsFromHint(weatherLoad?.riskHint) + riskPointsFromHint(weatherDischarge?.riskHint);
  if (weatherScore > 0) {
    score += weatherScore;
    factors.push(`Weather exposure: load port ${weatherLoad?.description || "unknown"}, discharge port ${weatherDischarge?.description || "unknown"}.`);
    decisionTriggers.push("Refresh weather/marine window before loading/discharge confirmation.");
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
    decisionTriggers.push(`Resolve pending reason: ${shipment.statusReason || shipment.issueNotes || "reason not specified"}.`);
  }

  const demurrageRate = asNumber(shipment.demurrageRate);
  if (demurrageRate > 0) {
    score += demurrageRate >= 10000 ? 15 : 8;
    factors.push(`Demurrage exposure detected at ${shipment.demurrageCurrency || "USD"} ${demurrageRate.toLocaleString("en-US")}/day.`);
    decisionTriggers.push("Calculate daily demurrage exposure and assign negotiation owner.");
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
    decisionTriggers.push("Validate if external news affects exact route/port/counterparty before committing schedule.");
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
    summary: `${shipment.vesselName || shipment.mvProjectName || "Shipment"} is rated ${level} for route ${loadingPort} -> ${dischargePort}. The decision uses route exposure, weather, marine condition, status reason, news, BMKG alert, and demurrage exposure.`,
    factors: factors.length ? factors : ["No major external risk signal detected from the current data pull."],
    recommendations: recommendations.join(" "),
    routeFindings,
    decisionTriggers,
    consultantDecision: {
      suggestedDecision: level === "CRITICAL" ? "HOLD / EXECUTIVE ESCALATION" : level === "HIGH" ? "PROCEED WITH CONTROLS" : "PROCEED / MONITOR",
      owner: level === "CRITICAL" || level === "HIGH" ? "Traffic Head + Operation" : "PIC Shipment",
      nextStep: decisionTriggers[0] || recommendations[0],
    },
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
      chokepoints,
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
      fetchShipmentNews(`${loadingPort} ${dischargePort} coal shipment port delay weather conflict security congestion`),
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
  routeExposure: detectRouteChokepoints(shipment, loadingPort, dischargePort),
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
  "routeFindings": ["..."],
  "decisionTriggers": ["..."],
  "consultantDecision": {"suggestedDecision":"...", "owner":"...", "nextStep":"..."},
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
