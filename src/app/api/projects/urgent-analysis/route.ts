import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { fetchShipmentNews } from "@/services/apiExtraction/newsExtractor";
import { checkAiRateLimit } from "@/lib/ai-security";
import { normalizeRole } from "@/lib/role-access";
import { buildSource, calculateDataQuality, normalizeDecisionReport } from "@/lib/decision-helper";

export const dynamic = "force-dynamic";

const EXECUTIVE_ROLES = new Set(["CEO", "DIRUT", "ASS_DIRUT"]);

function cleanText(v: unknown): string {
  return String(v || "").replace(/\s+/g, " ").trim();
}

function normalizeKey(v: unknown): string {
  return cleanText(v).toUpperCase();
}

function scoreToLevel(score: number) {
  if (score >= 85) return "CRITICAL";
  if (score >= 70) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

function daysUntil(value?: Date | null): number | null {
  if (!value) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(value);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseChecklist(value?: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.map((item) => ({
        label: cleanText(item?.label) || "Document",
        owner: cleanText(item?.owner) || "Team",
        done: Boolean(item?.done),
        fileUrl: cleanText(item?.fileUrl),
        required: item?.required !== false,
      }))
      : [];
  } catch {
    return [];
  }
}

function projectMatchesShipment(project: any, shipment: any): boolean {
  const projectKey = normalizeKey(project.name);
  const fields = [
    shipment.mvProjectName,
    shipment.vesselName,
    shipment.nomination,
    shipment.buyer,
    shipment.shipmentFlow,
  ].map(normalizeKey);
  return fields.some((field) => field && (field.includes(projectKey) || projectKey.includes(field)));
}

function buildProjectReport(input: {
  project: any;
  shipments: any[];
  news: any[];
  marketPrices: any[];
  plForecasts: any[];
  deals: any[];
}) {
  const { project, shipments, news, marketPrices, plForecasts, deals } = input;
  const factors: string[] = [];
  const documentGaps: string[] = [];
  const shipmentBlockers: string[] = [];
  const commercialSignals: string[] = [];
  let score = 15;
  const status = normalizeKey(project.status);

  if (status.includes("WAIT") || status.includes("PENDING")) {
    score += 15;
    factors.push("Project masih waiting approval.");
  }

  const activeShipments = shipments.filter((s) => !["completed", "cancelled", "done_shipment"].includes(String(s.status || "").toLowerCase()));
  if (activeShipments.length > 0) {
    score += Math.min(25, activeShipments.length * 8);
    factors.push(`${activeShipments.length} shipment aktif terkait project.`);
  }

  const pendingShipments = activeShipments.filter((s) => {
    const text = `${s.status || ""} ${s.shipmentStatus || ""} ${s.statusReason || ""}`.toLowerCase();
    return text.includes("pending") || text.includes("waiting") || text.includes("delay");
  });
  if (pendingShipments.length > 0) {
    score += Math.min(25, pendingShipments.length * 12);
    factors.push(`${pendingShipments.length} shipment terkait punya indikasi pending/waiting/delay.`);
    shipmentBlockers.push(...pendingShipments.slice(0, 4).map((s) =>
      `${s.vesselName || s.mvProjectName || s.nomination || s.id}: ${s.statusReason || s.issueNotes || s.status || "pending signal"}`,
    ));
  }

  const soonestEta = activeShipments
    .map((s) => daysUntil(s.eta || s.blDate))
    .filter((d): d is number => d !== null)
    .sort((a, b) => a - b)[0];
  if (soonestEta !== undefined && soonestEta <= 7) {
    score += soonestEta < 0 ? 20 : 12;
    factors.push(soonestEta < 0 ? "Ada shipment melewati ETA/BL date." : `Shipment terdekat jatuh tempo dalam ${soonestEta} hari.`);
  }

  const realNews = news.filter((n) => n?.source !== "Mock News" && n?.source !== "System");
  if (realNews.length > 0) {
    score += Math.min(20, realNews.length * 7);
    factors.push(`Berita eksternal ditemukan: ${realNews.slice(0, 2).map((n) => n.title).join("; ")}.`);
  }

  const checklist = parseChecklist(project.templateChecklist);
  const requiredDocs = checklist.filter((item) => item.required);
  const missingDocs = requiredDocs.filter((item) => !item.done && !item.fileUrl);
  if (requiredDocs.length > 0) {
    const missingPct = missingDocs.length / requiredDocs.length;
    if (missingDocs.length > 0) {
      score += Math.min(22, Math.round(missingPct * 22));
      documentGaps.push(...missingDocs.slice(0, 6).map((item) => `${item.label} (${item.owner})`));
      factors.push(`${missingDocs.length}/${requiredDocs.length} required project documents belum complete/uploaded.`);
    }
  }

  const projectKey = normalizeKey(project.name);
  const relatedPl = plForecasts.filter((p) => {
    const key = normalizeKey(`${p.projectName || ""} ${p.dealNumber || ""} ${p.buyer || ""}`);
    return key.includes(projectKey) || projectKey.includes(key) || normalizeKey(project.buyer).includes(normalizeKey(p.buyer));
  });
  const relatedDeals = deals.filter((d) => {
    const key = normalizeKey(`${d.dealNumber || ""} ${d.buyer || ""} ${d.vesselName || ""}`);
    return normalizeKey(project.buyer).includes(normalizeKey(d.buyer)) || normalizeKey(d.buyer).includes(normalizeKey(project.buyer)) || key.includes(projectKey);
  });
  const latestMarket = marketPrices[0];
  const benchmark = safeNum(latestMarket?.ici4 || latestMarket?.ici3 || latestMarket?.hba || latestMarket?.newcastle);
  const avgSell = relatedDeals.length
    ? relatedDeals.reduce((sum, d) => sum + safeNum(d.pricePerMt), 0) / relatedDeals.length
    : 0;
  const avgPlMargin = relatedPl.length
    ? relatedPl.reduce((sum, p) => sum + safeNum(p.grossProfitMt), 0) / relatedPl.length
    : 0;

  if (benchmark > 0 && avgSell > 0) {
    const spread = avgSell - benchmark;
    commercialSignals.push(`Average selling price spread vs selected benchmark: ${spread >= 0 ? "+" : ""}${spread.toFixed(2)} USD/MT.`);
    if (spread < -3) {
      score += 12;
      factors.push("Selling price berada di bawah benchmark market, perlu review commercial decision.");
    } else if (spread > 3) {
      commercialSignals.push("Selling price terlihat lebih baik dari benchmark; cek peluang percepat approval/execution.");
    }
  }

  if (relatedPl.length > 0) {
    commercialSignals.push(`P&L forecast rows: ${relatedPl.length}, average GP/MT: ${avgPlMargin.toFixed(2)}.`);
    if (avgPlMargin < 0) {
      score += 18;
      factors.push("P&L forecast menunjukkan margin negatif.");
    } else if (avgPlMargin > 5) {
      commercialSignals.push("Margin forecast sehat; execution risk lebih banyak datang dari operasi/dokumen.");
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const level = scoreToLevel(score);
  const recommendedAction = level === "HIGH" || level === "CRITICAL"
    ? documentGaps.length > 0
      ? "Prioritaskan project ini hari ini: tuntaskan document gaps, assign owner per dokumen, lalu eskalasi blocker shipment dan keputusan commercial ke executive."
      : "Prioritaskan project ini hari ini: eskalasi blocker shipment, cek commercial spread, dan putuskan proceed/hold dengan executive."
    : "Monitor normal, namun jalankan ulang analisis saat dokumen/market/shipment berubah.";
  const dataQuality = calculateDataQuality([
    { label: "Project name", value: project.name, critical: true },
    { label: "Buyer", value: project.buyer, critical: true },
    { label: "Project status", value: project.status },
    { label: "Required document checklist", value: requiredDocs },
    { label: "Related shipments", value: shipments },
    { label: "Market price benchmark", value: latestMarket },
    { label: "P&L forecast", value: relatedPl },
    { label: "Sales deals", value: relatedDeals },
    { label: "External news", value: realNews },
  ]);
  const sources = [
    buildSource({
      type: "internal",
      label: "Project record",
      source: "ProjectItem",
      detail: `${project.name || project.id} - ${project.status || "no status"}`,
      reliability: "INTERNAL_SYSTEM",
    }),
    buildSource({
      type: "document",
      label: "Project document checklist",
      source: "ProjectItem.templateChecklist",
      detail: `${requiredDocs.length - missingDocs.length}/${requiredDocs.length || 0} required documents complete`,
      reliability: "INTERNAL_SYSTEM",
    }),
    buildSource({
      type: "internal",
      label: "Related shipment records",
      source: "ShipmentDetail",
      detail: `${activeShipments.length} active shipments, ${pendingShipments.length} blocker signals`,
      reliability: "INTERNAL_SYSTEM",
    }),
    buildSource({
      type: "market",
      label: "Market benchmark",
      source: latestMarket?.source || "MarketPrice",
      detail: latestMarket ? `ICI3 ${latestMarket.ici3 || "-"} / ICI4 ${latestMarket.ici4 || "-"} / HBA ${latestMarket.hba || "-"}` : "No market benchmark available",
      reliability: latestMarket ? "INTERNAL_SYSTEM" : "UNKNOWN",
    }),
    buildSource({
      type: "market",
      label: "P&L forecast",
      source: "PLForecast",
      detail: `${relatedPl.length} related forecast rows`,
      reliability: relatedPl.length ? "INTERNAL_SYSTEM" : "UNKNOWN",
    }),
    ...realNews.slice(0, 5).map((item) => buildSource({
      type: "news" as const,
      label: item?.title || "News signal",
      source: item?.source || "News API",
      detail: item?.description || item?.title || "News context",
      url: item?.url,
      reliability: "API" as const,
    })),
  ];

  const report = {
    score,
    level,
    summary: `${project.name} berada pada level ${level}. Prioritas dihitung dari status approval, shipment aktif, pending reason, timeline, kelengkapan dokumen, P&L/market signal, dan berita eksternal.`,
    factors: factors.length ? factors : ["Tidak ada sinyal urgensi tinggi dari data internal saat ini."],
    recommendedAction,
    documentGaps,
    shipmentBlockers,
    commercialSignals: commercialSignals.length ? commercialSignals : ["Belum ada data market/P&L/deal yang cukup untuk commercial signal."],
    decisionMemo: {
      suggestedDecision: level === "CRITICAL" ? "HOLD / EXECUTIVE REVIEW" : level === "HIGH" ? "FAST REVIEW" : "MONITOR",
      owner: level === "HIGH" || level === "CRITICAL" ? "CEO / DIRUT / ASS_DIRUT" : "Project owner",
      nextStep: recommendedAction,
    },
    relatedShipments: activeShipments.slice(0, 6).map((s) => ({
      id: s.id,
      vesselName: s.vesselName || s.mvProjectName || s.nomination,
      status: s.status,
      statusReason: s.statusReason,
      eta: s.eta,
    })),
    marketSnapshot: latestMarket ? {
      date: latestMarket.date,
      ici3: latestMarket.ici3,
      ici4: latestMarket.ici4,
      hba: latestMarket.hba,
      newcastle: latestMarket.newcastle,
      source: latestMarket.source,
    } : null,
    news: news.slice(0, 5),
    analyzedAt: new Date().toISOString(),
  };

  return normalizeDecisionReport(report, {
    level,
    score,
    reason: factors[0] || "No urgent blocker detected from current project context.",
    owner: level === "HIGH" || level === "CRITICAL" ? "CEO / DIRUT / ASS_DIRUT" : "Project owner",
    nextAction: recommendedAction,
    deadline: level === "CRITICAL" || level === "HIGH" ? "Today before executive close" : "Next project review",
    approverRoles: ["CEO", "DIRUT", "ASS_DIRUT"],
    holdOnCritical: false,
    sources,
    dataQuality,
    inputSnapshot: {
      projectId: project.id,
      projectName: project.name,
      buyer: project.buyer,
      status: project.status,
      activeShipmentCount: activeShipments.length,
      pendingShipmentCount: pendingShipments.length,
      missingDocumentCount: missingDocs.length,
      marketBenchmark: benchmark || null,
      relatedPlCount: relatedPl.length,
      relatedDealCount: relatedDeals.length,
      sourceCount: sources.length,
    },
  });
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = normalizeRole(session.user.role);
    if (!role || !EXECUTIVE_ROLES.has(role)) {
      return NextResponse.json({ error: "Forbidden. Only CEO, DIRUT, and ASS_DIRUT can run urgency analysis." }, { status: 403 });
    }

    const rate = checkAiRateLimit(`project-urgency:${session.user.id}`, 10, 60 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many project urgency analyses. Please retry later." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const targetProjectId = body?.projectId ? String(body.projectId) : null;

    const projects = await prisma.projectItem.findMany({
      where: targetProjectId ? { id: targetProjectId, isDeleted: false } : { isDeleted: false },
      orderBy: { updatedAt: "desc" },
      take: targetProjectId ? 1 : 30,
    });

    const [shipments, marketPrices, plForecasts, deals] = await Promise.all([
      prisma.shipmentDetail.findMany({
        where: { isDeleted: false },
        orderBy: { updatedAt: "desc" },
        take: 500,
      }),
      prisma.marketPrice.findMany({
        where: { isDeleted: false },
        orderBy: { date: "desc" },
        take: 8,
      }),
      prisma.pLForecast.findMany({
        where: { isDeleted: false },
        orderBy: { updatedAt: "desc" },
        take: 300,
      }),
      prisma.salesDeal.findMany({
        where: { isDeleted: false },
        orderBy: { updatedAt: "desc" },
        take: 300,
      }),
    ]);

    const analyzed = [];
    const auditSummaries = [];
    for (const project of projects) {
      const relatedShipments = shipments.filter((s) => projectMatchesShipment(project, s));
      const query = [project.name, project.buyer, ...relatedShipments.slice(0, 2).map((s) => s.loadingPort || s.dischargePort)]
        .filter(Boolean)
        .join(" coal shipment delay port");
      const news = await fetchShipmentNews(query || `${project.name} coal shipment`);
      const report = buildProjectReport({
        project,
        shipments: relatedShipments,
        news,
        marketPrices,
        plForecasts,
        deals,
      });

      const updated = await prisma.projectItem.update({
        where: { id: project.id },
        data: {
          urgencyScore: report.score,
          urgencyLevel: report.level,
          urgencyReport: JSON.stringify(report),
          lastUrgencyAnalyzedAt: new Date(),
        },
      });

      analyzed.push(updated);
      auditSummaries.push({
        id: project.id,
        score: report.score,
        level: report.level,
        decision: report.decision?.action,
        confidence: report.decision?.confidence,
        sourceCount: report.sourceAttribution?.length || 0,
        missingFields: report.dataQuality?.missingFields?.length || 0,
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        userName: session.user.name || "Unknown",
        action: "PROJECT_URGENCY_ANALYSIS",
        entity: "ProjectItem",
        entityId: targetProjectId || "batch",
        details: JSON.stringify({ count: analyzed.length, reports: auditSummaries.slice(0, 20) }),
      },
    }).catch(() => null);

    return NextResponse.json({ success: true, projects: analyzed });
  } catch (error) {
    console.error("POST /api/projects/urgent-analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze project urgency", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
