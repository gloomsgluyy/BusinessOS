import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { fetchShipmentNews } from "@/services/apiExtraction/newsExtractor";
import { checkAiRateLimit } from "@/lib/ai-security";
import { normalizeRole } from "@/lib/role-access";

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

function buildProjectReport(project: any, shipments: any[], news: any[]) {
  const factors: string[] = [];
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

  score = Math.max(0, Math.min(100, Math.round(score)));
  const level = scoreToLevel(score);

  return {
    score,
    level,
    summary: `${project.name} berada pada level ${level}. Prioritas dihitung dari status approval, shipment aktif, pending reason, timeline, dan berita eksternal.`,
    factors: factors.length ? factors : ["Tidak ada sinyal urgensi tinggi dari data internal saat ini."],
    recommendedAction: level === "HIGH" || level === "CRITICAL"
      ? "CEO/Dirut perlu review hari ini: cek blocker shipment, keputusan approval, dan eskalasi counterparty bila ada delay."
      : "Monitor di ritme normal dan jalankan ulang analisis ketika ada update shipment atau berita baru.",
    relatedShipments: activeShipments.slice(0, 6).map((s) => ({
      id: s.id,
      vesselName: s.vesselName || s.mvProjectName || s.nomination,
      status: s.status,
      statusReason: s.statusReason,
      eta: s.eta,
    })),
    news: news.slice(0, 5),
    analyzedAt: new Date().toISOString(),
  };
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

    const shipments = await prisma.shipmentDetail.findMany({
      where: { isDeleted: false },
      orderBy: { updatedAt: "desc" },
      take: 500,
    });

    const analyzed = [];
    for (const project of projects) {
      const relatedShipments = shipments.filter((s) => projectMatchesShipment(project, s));
      const query = [project.name, project.buyer, ...relatedShipments.slice(0, 2).map((s) => s.loadingPort || s.dischargePort)]
        .filter(Boolean)
        .join(" coal shipment delay port");
      const news = await fetchShipmentNews(query || `${project.name} coal shipment`);
      const report = buildProjectReport(project, relatedShipments, news);

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
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        userName: session.user.name || "Unknown",
        action: "PROJECT_URGENCY_ANALYSIS",
        entity: "ProjectItem",
        entityId: targetProjectId || "batch",
        details: JSON.stringify({ count: analyzed.length }),
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
