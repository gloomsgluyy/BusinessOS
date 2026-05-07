import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { checkAiRateLimit } from "@/lib/ai-security";
import { canUseAiAssistant } from "@/lib/role-access";
import { fetchShipmentNews } from "@/services/apiExtraction/newsExtractor";

export const dynamic = "force-dynamic";

function cleanText(v: unknown): string {
  return String(v || "").replace(/\s+/g, " ").trim();
}

function normalizeKey(v: unknown): string {
  return cleanText(v).toUpperCase();
}

function daysUntil(value?: Date | null): number | null {
  if (!value) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(value);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function scoreToLevel(score: number) {
  if (score >= 85) return "CRITICAL";
  if (score >= 70) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

function nameMatch(name: string, candidate?: string | null) {
  const a = normalizeKey(name);
  const b = normalizeKey(candidate);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

async function ensurePartnerDueDiligenceColumns() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "dueDiligenceScore" INTEGER;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "dueDiligenceLevel" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "dueDiligenceReport" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "lastDueDiligenceAt" TIMESTAMP(3);`);
}

async function runAiDueDiligence(prompt: string) {
  const groqKey = process.env.GROQ_API_KEY;
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!groqKey && !openRouterKey) return null;

  const useGroq = Boolean(groqKey);
  const res = await fetch(useGroq ? "https://api.groq.com/openai/v1/chat/completions" : "https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${useGroq ? groqKey : openRouterKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXTAUTH_URL || "http://localhost:3000",
      "X-Title": "Business OS Partner Due Diligence",
    },
    body: JSON.stringify({
      model: useGroq ? "llama-3.3-70b-versatile" : (process.env.OPENROUTER_RISK_MODEL || "meta-llama/llama-3.1-70b-instruct"),
      messages: [
        { role: "system", content: "Return strict JSON only. Do not wrap output in markdown. Do not invent facts; mark uncertainty clearly." },
        { role: "user", content: prompt },
      ],
      temperature: 0.15,
    }),
  });

  if (!res.ok) throw new Error(`AI provider returned ${res.status}`);
  const data = await res.json();
  const text = String(data.choices?.[0]?.message?.content || "").replace(/```json/gi, "").replace(/```/g, "").trim();
  const match = text.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : text);
}

function buildDeterministicReport(input: {
  partner: any;
  relatedShipments: any[];
  relatedDeals: any[];
  news: any[];
}) {
  const { partner, relatedShipments, relatedDeals, news } = input;
  const findings: string[] = [];
  const redFlags: string[] = [];
  const verificationChecklist: string[] = [];
  let score = 20;

  const legalDays = daysUntil(partner.legalExpiryDate);
  if (legalDays === null) {
    score += 25;
    redFlags.push("Tidak ada expiry date legalitas yang tercatat.");
    verificationChecklist.push("Upload dan isi tanggal berlaku dokumen legal utama.");
  } else if (legalDays < 0) {
    score += 40;
    redFlags.push(`Dokumen legal expired ${Math.abs(legalDays)} hari lalu.`);
    verificationChecklist.push("Minta dokumen legal terbaru sebelum transaksi/nomination berikutnya.");
  } else if (legalDays <= (partner.legalReminderDays || 30)) {
    score += 20;
    findings.push(`Dokumen legal akan jatuh tempo dalam ${legalDays} hari.`);
    verificationChecklist.push("Follow up renewal dokumen legal dan update expiry date.");
  } else {
    findings.push(`Dokumen legal masih valid ${legalDays} hari.`);
  }

  if (!cleanText(partner.taxId)) {
    score += 8;
    redFlags.push("Tax ID/NPWP belum tercatat.");
    verificationChecklist.push("Lengkapi NPWP/tax ID untuk validasi administrasi.");
  }

  if (normalizeKey(partner.status).includes("UNDER")) {
    score += 12;
    findings.push("Partner sedang under review di sistem internal.");
  } else if (normalizeKey(partner.status).includes("INACTIVE")) {
    score += 25;
    redFlags.push("Partner berstatus inactive.");
  }

  const activeShipments = relatedShipments.filter((s) => !["completed", "cancelled", "done_shipment"].includes(String(s.status || "").toLowerCase()));
  if (activeShipments.length > 0) {
    findings.push(`${activeShipments.length} shipment aktif terkait partner ini.`);
  }

  const blockedShipments = relatedShipments.filter((s) => {
    const text = `${s.status || ""} ${s.shipmentStatus || ""} ${s.statusReason || ""} ${s.issueNotes || ""}`.toLowerCase();
    return text.includes("pending") || text.includes("delay") || text.includes("waiting") || text.includes("issue");
  });
  if (blockedShipments.length > 0) {
    score += Math.min(25, blockedShipments.length * 10);
    redFlags.push(`${blockedShipments.length} shipment terkait punya pending/delay/issue signal.`);
  }

  if (relatedDeals.length > 0) {
    findings.push(`${relatedDeals.length} sales deal terkait ditemukan.`);
  }

  const realNews = news.filter((n) => !["System", "Mock News", "Error"].includes(String(n?.source || "")));
  if (realNews.length > 0) {
    score += Math.min(18, realNews.length * 6);
    findings.push(`Berita eksternal ditemukan untuk nama partner: ${realNews.slice(0, 2).map((n) => n.title).join("; ")}.`);
    verificationChecklist.push("Buka source berita eksternal dan validasi apakah entitasnya sama persis.");
  }

  if (!cleanText(partner.email) || !cleanText(partner.phone)) {
    score += 5;
    verificationChecklist.push("Lengkapi email dan nomor telepon PIC untuk traceability.");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const level = scoreToLevel(score);

  return {
    score,
    level,
    summary: `${partner.name} berada pada level due-diligence ${level}. Analisis memakai legal deadline, status internal, shipment/deal terkait, dan berita eksternal.`,
    findings: findings.length ? findings : ["Tidak ada temuan material dari data internal saat ini."],
    redFlags: redFlags.length ? redFlags : ["Tidak ada red flag tinggi yang terdeteksi dari data yang tersedia."],
    recommendation: level === "HIGH" || level === "CRITICAL"
      ? "Tahan onboarding/transaksi baru sampai legalitas, identitas pajak, dan issue shipment terkait diverifikasi oleh owner terkait."
      : level === "MEDIUM"
        ? "Lanjut dengan kontrol tambahan: lengkapi dokumen, review issue internal, dan monitor news eksternal."
        : "Partner dapat diproses normal, tetap update legal deadline dan audit trail.",
    verificationChecklist: verificationChecklist.length ? verificationChecklist : ["Jaga dokumen legal dan PIC tetap terbaru."],
    relatedShipments: relatedShipments.slice(0, 8).map((s) => ({
      id: s.id,
      project: s.mvProjectName,
      vessel: s.vesselName || s.nomination,
      status: s.status,
      statusReason: s.statusReason,
    })),
    relatedDeals: relatedDeals.slice(0, 8).map((d) => ({
      id: d.id,
      dealNumber: d.dealNumber,
      status: d.status,
      quantity: d.quantity,
      pricePerMt: d.pricePerMt,
    })),
    news: news.slice(0, 5),
    analyzedAt: new Date().toISOString(),
  };
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canUseAiAssistant(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const rate = checkAiRateLimit(`partner-due-diligence:${session.user.id}`, 15, 60 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many due-diligence analyses. Please retry later." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }

    await ensurePartnerDueDiligenceColumns();

    const partner = await prisma.partner.findUnique({ where: { id: params.id } });
    if (!partner || partner.isDeleted) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

    const [shipments, deals, news] = await Promise.all([
      prisma.shipmentDetail.findMany({ where: { isDeleted: false }, orderBy: { updatedAt: "desc" }, take: 500 }),
      prisma.salesDeal.findMany({ where: { isDeleted: false }, orderBy: { updatedAt: "desc" }, take: 250 }),
      fetchShipmentNews(`${partner.name} coal mining shipping legal dispute sanction fraud incident`),
    ]);

    const relatedShipments = shipments.filter((s) =>
      nameMatch(partner.name, s.buyer) ||
      nameMatch(partner.name, s.supplier) ||
      nameMatch(partner.name, s.source) ||
      nameMatch(partner.name, s.iupOp),
    );
    const relatedDeals = deals.filter((d) => nameMatch(partner.name, d.buyer));

    const fallbackReport = buildDeterministicReport({ partner, relatedShipments, relatedDeals, news });
    let report = fallbackReport;

    const prompt = `
Anda adalah konsultan due-diligence operasional untuk perusahaan batubara.
Analisa partner/vendor/client ini secara kritis. Jangan hanya cari hal positif; cari red flag, dokumen hilang/expired, mismatch data, issue internal, dan berita eksternal. Jangan mengarang fakta di luar data.

PARTNER:
${JSON.stringify({
  id: partner.id,
  name: partner.name,
  type: partner.type,
  category: partner.category,
  status: partner.status,
  taxId: partner.taxId,
  legalDocumentName: partner.legalDocumentName,
  legalExpiryDate: partner.legalExpiryDate,
  legalReminderDays: partner.legalReminderDays,
  notes: partner.notes,
})}

INTERNAL CONTEXT:
${JSON.stringify({
  relatedShipments: fallbackReport.relatedShipments,
  relatedDeals: fallbackReport.relatedDeals,
})}

EXTERNAL NEWS:
${JSON.stringify(news)}

Kembalikan HANYA JSON:
{
  "score": <0-100>,
  "level": "LOW|MEDIUM|HIGH|CRITICAL",
  "summary": "...",
  "findings": ["..."],
  "redFlags": ["..."],
  "recommendation": "...",
  "verificationChecklist": ["..."],
  "relatedShipments": [],
  "relatedDeals": [],
  "news": [],
  "analyzedAt": "ISO date"
}
`;

    try {
      const aiReport = await runAiDueDiligence(prompt);
      if (aiReport?.score !== undefined && aiReport?.level) {
        report = {
          ...fallbackReport,
          ...aiReport,
          score: Math.max(0, Math.min(100, Math.round(Number(aiReport.score) || fallbackReport.score))),
          level: String(aiReport.level || fallbackReport.level).toUpperCase(),
          relatedShipments: aiReport.relatedShipments || fallbackReport.relatedShipments,
          relatedDeals: aiReport.relatedDeals || fallbackReport.relatedDeals,
          news: aiReport.news || fallbackReport.news,
          analyzedAt: new Date().toISOString(),
        };
      }
    } catch (error) {
      console.warn("Partner due-diligence AI unavailable, using deterministic fallback:", error);
    }

    const updated = await prisma.partner.update({
      where: { id: partner.id },
      data: {
        dueDiligenceScore: report.score,
        dueDiligenceLevel: report.level,
        dueDiligenceReport: JSON.stringify(report),
        lastDueDiligenceAt: new Date(),
        status: report.level === "HIGH" || report.level === "CRITICAL" ? "under_review" : partner.status,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        userName: session.user.name || "Unknown",
        action: "PARTNER_DUE_DILIGENCE",
        entity: "Partner",
        entityId: partner.id,
        details: JSON.stringify({ score: report.score, level: report.level }),
      },
    }).catch(() => null);

    return NextResponse.json({ success: true, partner: updated, report });
  } catch (error) {
    console.error("POST /api/partners/[id]/due-diligence error:", error);
    return NextResponse.json(
      { error: "Failed to run due diligence", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
