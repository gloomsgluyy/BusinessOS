import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/pagination";
import { canApproveProjectStatus } from "@/lib/role-access";

export const dynamic = "force-dynamic";

function cleanText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const text = String(v).replace(/\s+/g, " ").trim();
  return text || null;
}

function numberOrNull(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function dateOrNull(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  const text = cleanText(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseApprovalHistory(value: unknown): any[] {
  if (!value || typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonHistory(value: unknown): any[] {
  if (!value || typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value: unknown): Record<string, any> | null {
  if (!value || typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function inferSupplierPrice(value: unknown, blendingScenario?: unknown): number {
  const scenario = parseJsonObject(blendingScenario);
  const scenarioCost = Number(scenario?.result?.avgCost);
  if (Number.isFinite(scenarioCost) && scenarioCost > 0) return scenarioCost;

  const text = cleanText(value) || "";
  const matches = Array.from(text.matchAll(/(?:\$|usd\s*)\s*([0-9]+(?:[.,][0-9]+)?)/gi))
    .map((match) => Number(String(match[1]).replace(",", ".")))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (matches.length) return Math.min(...matches);
  return 0;
}

function buildRoughPnl(input: {
  id?: string | null;
  name?: string | null;
  quantity?: number | null;
  targetSellingPrice?: number | null;
  supplierCandidates?: string | null;
  blendingScenario?: string | null;
  surveyor?: string | null;
}) {
  const quantity = Number(input.quantity || 0);
  const sellingPrice = Number(input.targetSellingPrice || 0);
  const supplierPrice = inferSupplierPrice(input.supplierCandidates, input.blendingScenario);
  const freightCost = 0;
  const blendingCost = 0;
  const surveyorCost = 0;
  const royaltyCost = 0;
  const taxExportCost = 0;
  const otherCost = 0;
  const variableCostPerMt = supplierPrice + freightCost + blendingCost + surveyorCost + royaltyCost + taxExportCost + otherCost;
  const revenue = quantity * sellingPrice;
  const totalCost = quantity * variableCostPerMt;
  const estimatedGrossProfit = revenue - totalCost;
  const marginPerMt = sellingPrice - variableCostPerMt;
  const marginPercent = revenue ? (estimatedGrossProfit / revenue) * 100 : 0;

  return JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: "auto_forecast_sales",
    forecastSalesId: input.id || null,
    forecastSalesName: input.name || null,
    quantity,
    sellingPrice,
    supplierPrice,
    freightCost,
    blendingCost,
    surveyorCost,
    royaltyCost,
    taxExportCost,
    otherCost,
    variableCostPerMt,
    revenue,
    totalCost,
    estimatedGrossProfit,
    marginPerMt,
    marginPercent,
    notes: supplierPrice
      ? "Supplier price inferred from saved blending scenario or supplier candidate text."
      : "Supplier price not available yet; rough P&L should be updated when source cost is selected.",
  });
}

function dateValue(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function comparableValue(value: unknown): string {
  if (value instanceof Date) return dateValue(value) || "";
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function needsBelowSpecAcknowledgement(value: unknown): boolean {
  const text = cleanText(value) || "";
  const fitScores = Array.from(text.matchAll(/fit\s+(\d{1,3})%/gi)).map((match) => Number(match[1]));
  return fitScores.some((score) => Number.isFinite(score) && score < 80) ||
    /below|above target|stock below|kyc not verified|psi failed/i.test(text);
}

const PROJECT_ITEM_COLUMN_SPECS = [
  { name: "approvedBy", sql: `"approvedBy" TEXT` },
  { name: "approvedByName", sql: `"approvedByName" TEXT` },
  { name: "approvedAt", sql: `"approvedAt" TIMESTAMP(3)` },
  { name: "approvalHistory", sql: `"approvalHistory" TEXT` },
  { name: "revisionHistory", sql: `"revisionHistory" TEXT` },
  { name: "fcoNumber", sql: `"fcoNumber" TEXT` },
  { name: "fcoGeneratedAt", sql: `"fcoGeneratedAt" TIMESTAMP(3)` },
  { name: "fcoHistory", sql: `"fcoHistory" TEXT` },
  { name: "buyerFeedbackStatus", sql: `"buyerFeedbackStatus" TEXT` },
  { name: "buyerFeedbackReason", sql: `"buyerFeedbackReason" TEXT` },
  { name: "buyerFeedbackUpdatedAt", sql: `"buyerFeedbackUpdatedAt" TIMESTAMP(3)` },
  { name: "buyerFeedbackHistory", sql: `"buyerFeedbackHistory" TEXT` },
  { name: "templateType", sql: `"templateType" TEXT` },
  { name: "templateChecklist", sql: `"templateChecklist" TEXT` },
  { name: "buyerCountry", sql: `"buyerCountry" TEXT` },
  { name: "commodity", sql: `"commodity" TEXT` },
  { name: "quantity", sql: `"quantity" DOUBLE PRECISION` },
  { name: "laycanStart", sql: `"laycanStart" TIMESTAMP(3)` },
  { name: "laycanEnd", sql: `"laycanEnd" TIMESTAMP(3)` },
  { name: "portOfLoading", sql: `"portOfLoading" TEXT` },
  { name: "salesTerm", sql: `"salesTerm" TEXT` },
  { name: "targetSellingPrice", sql: `"targetSellingPrice" DOUBLE PRECISION` },
  { name: "priceBasis", sql: `"priceBasis" TEXT` },
  { name: "paymentTerms", sql: `"paymentTerms" TEXT` },
  { name: "surveyor", sql: `"surveyor" TEXT` },
  { name: "gar", sql: `"gar" DOUBLE PRECISION` },
  { name: "tm", sql: `"tm" DOUBLE PRECISION` },
  { name: "ts", sql: `"ts" DOUBLE PRECISION` },
  { name: "ash", sql: `"ash" DOUBLE PRECISION` },
  { name: "vm", sql: `"vm" DOUBLE PRECISION` },
  { name: "size", sql: `"size" TEXT` },
  { name: "supplierCandidates", sql: `"supplierCandidates" TEXT` },
  { name: "belowSpecReason", sql: `"belowSpecReason" TEXT` },
  { name: "belowSpecAcknowledgedAt", sql: `"belowSpecAcknowledgedAt" TIMESTAMP(3)` },
  { name: "belowSpecAcknowledgedByName", sql: `"belowSpecAcknowledgedByName" TEXT` },
  { name: "blendingScenario", sql: `"blendingScenario" TEXT` },
  { name: "roughPnl", sql: `"roughPnl" TEXT` },
  { name: "urgencyScore", sql: `"urgencyScore" INTEGER` },
  { name: "urgencyLevel", sql: `"urgencyLevel" TEXT` },
  { name: "urgencyReport", sql: `"urgencyReport" TEXT` },
  { name: "lastUrgencyAnalyzedAt", sql: `"lastUrgencyAnalyzedAt" TIMESTAMP(3)` },
];

let projectTableReady = false;
let projectTableEnsurePromise: Promise<void> | null = null;

async function ensureProjectTable(): Promise<boolean> {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ProjectItem" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "segment" TEXT,
        "buyer" TEXT,
        "status" TEXT NOT NULL DEFAULT 'waiting_approval',
        "notes" TEXT,
        "createdBy" TEXT,
        "createdByName" TEXT,
        "approvedBy" TEXT,
        "approvedByName" TEXT,
        "approvedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "isDeleted" BOOLEAN NOT NULL DEFAULT false,
        CONSTRAINT "ProjectItem_pkey" PRIMARY KEY ("id")
      );
    `);
    const existingColumns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ProjectItem'
    `;
    const existing = new Set(existingColumns.map((column) => column.column_name));
    const missing = PROJECT_ITEM_COLUMN_SPECS.filter((column) => !existing.has(column.name));
    for (const column of missing) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "ProjectItem" ADD COLUMN IF NOT EXISTS ${column.sql};`);
    }
    if (missing.length) {
      console.info(`[projects] ensured ${missing.length} missing ProjectItem columns`);
    }
    return true;
  } catch (error) {
    console.error("[projects] ensureProjectTable failed:", error);
    return false;
  }
}

function ensureProjectTableCached() {
  if (projectTableReady) return Promise.resolve();
  if (projectTableEnsurePromise) return projectTableEnsurePromise;
  projectTableEnsurePromise = ensureProjectTable()
    .then(() => {
      projectTableReady = true;
    })
    .finally(() => {
      projectTableEnsurePromise = null;
    });
  return projectTableEnsurePromise;
}

async function tryAuditLog(userId: string, userName: string, action: string, entityId: string, details: string) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        userName,
        action,
        entity: "ProjectItem",
        entityId,
        details,
      },
    });
  } catch (error: any) {
    console.warn("[projects] audit skipped:", error?.code || error?.message);
  }
}

function structuredAuditDetails(input: {
  actionType: string;
  reason?: string | null;
  evidence?: string | null;
  changes?: Array<{ field: string; oldValue: unknown; newValue: unknown }>;
  context?: Record<string, unknown>;
}) {
  return JSON.stringify({
    schemaVersion: 1,
    actionType: input.actionType,
    reason: input.reason || null,
    evidence: input.evidence || null,
    changes: input.changes || [],
    context: input.context || {},
  });
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await ensureProjectTableCached();

    const url = new URL(req.url);
    const pagination = parsePaginationParams(url.searchParams);
    const where = { isDeleted: false };

    if (pagination) {
      const [projects, totalItems] = await Promise.all([
        prisma.projectItem.findMany({
          where,
          orderBy: { createdAt: pagination.sortOrder },
          skip: pagination.skip,
          take: pagination.take,
        }),
        prisma.projectItem.count({ where }),
      ]);
      const meta = buildPaginationMeta(totalItems, pagination.page, pagination.pageSize);
      return NextResponse.json({ success: true, projects, meta }, { headers: { "Cache-Control": "no-store" } });
    }

    const projects = await prisma.projectItem.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, projects }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET /api/memory/projects error:", error);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await ensureProjectTableCached();

    const data = await req.json();
    const name = cleanText(data.name);
    if (!name) return NextResponse.json({ error: "Forecast Sales name is required" }, { status: 400 });
    if (
      String(cleanText(data.status) || "draft").toLowerCase() === "waiting_approval" &&
      needsBelowSpecAcknowledgement(data.supplierCandidates) &&
      !cleanText(data.belowSpecReason)
    ) {
      return NextResponse.json({ error: "Below-spec acknowledgement reason is required" }, { status: 400 });
    }

    const project = await prisma.projectItem.create({
      data: {
        name,
        segment: cleanText(data.segment),
        buyer: cleanText(data.buyer),
        status: cleanText(data.status) || "draft",
        notes: cleanText(data.notes),
        buyerCountry: cleanText(data.buyerCountry),
        commodity: cleanText(data.commodity),
        quantity: numberOrNull(data.quantity),
        laycanStart: dateOrNull(data.laycanStart),
        laycanEnd: dateOrNull(data.laycanEnd),
        portOfLoading: cleanText(data.portOfLoading),
        salesTerm: cleanText(data.salesTerm),
        targetSellingPrice: numberOrNull(data.targetSellingPrice),
        priceBasis: cleanText(data.priceBasis),
        paymentTerms: cleanText(data.paymentTerms),
        surveyor: cleanText(data.surveyor),
        gar: numberOrNull(data.gar),
        tm: numberOrNull(data.tm),
        ts: numberOrNull(data.ts),
        ash: numberOrNull(data.ash),
        vm: numberOrNull(data.vm),
        size: cleanText(data.size),
        supplierCandidates: cleanText(data.supplierCandidates),
        belowSpecReason: cleanText(data.belowSpecReason),
        belowSpecAcknowledgedAt: cleanText(data.belowSpecReason) ? new Date() : null,
        belowSpecAcknowledgedByName: cleanText(data.belowSpecReason) ? (session.user.name || null) : null,
        blendingScenario: cleanText(data.blendingScenario),
        roughPnl: buildRoughPnl({
          name,
          quantity: numberOrNull(data.quantity) ?? null,
          targetSellingPrice: numberOrNull(data.targetSellingPrice) ?? null,
          supplierCandidates: cleanText(data.supplierCandidates),
          blendingScenario: cleanText(data.blendingScenario),
          surveyor: cleanText(data.surveyor),
        }),
        templateType: cleanText(data.templateType),
        templateChecklist: cleanText(data.templateChecklist),
        createdBy: session.user.id,
        createdByName: session.user.name || null,
      },
    });
    await tryAuditLog(
      session.user.id,
      session.user.name || "Unknown",
      "CREATE",
      project.id,
      JSON.stringify({
        name: project.name,
        segment: project.segment,
        buyer: project.buyer,
        status: project.status,
        buyerCountry: project.buyerCountry,
        commodity: project.commodity,
        quantity: project.quantity,
        laycanStart: project.laycanStart,
        laycanEnd: project.laycanEnd,
        portOfLoading: project.portOfLoading,
        salesTerm: project.salesTerm,
        targetSellingPrice: project.targetSellingPrice,
        priceBasis: project.priceBasis,
        paymentTerms: project.paymentTerms,
        surveyor: project.surveyor,
        belowSpecReason: project.belowSpecReason,
        belowSpecAcknowledgedAt: project.belowSpecAcknowledgedAt,
        belowSpecAcknowledgedByName: project.belowSpecAcknowledgedByName,
        blendingScenario: project.blendingScenario,
        roughPnl: project.roughPnl,
        templateType: project.templateType,
        templateChecklist: project.templateChecklist,
        approvedBy: project.approvedBy,
        approvedByName: project.approvedByName,
        approvedAt: project.approvedAt,
        approvalHistory: project.approvalHistory,
        revisionHistory: project.revisionHistory,
        fcoNumber: project.fcoNumber,
        fcoGeneratedAt: project.fcoGeneratedAt,
        fcoHistory: project.fcoHistory,
        buyerFeedbackStatus: project.buyerFeedbackStatus,
        buyerFeedbackReason: project.buyerFeedbackReason,
        buyerFeedbackUpdatedAt: project.buyerFeedbackUpdatedAt,
        buyerFeedbackHistory: project.buyerFeedbackHistory,
      }),
    );

    return NextResponse.json({ success: true, project });
  } catch (error) {
    console.error("POST /api/memory/projects error:", error);
    return NextResponse.json(
      { error: "Failed to create Forecast Sales", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await ensureProjectTableCached();

    const data = await req.json();
    if (!data.id) return NextResponse.json({ error: "Forecast Sales ID missing" }, { status: 400 });

    const existing = await prisma.projectItem.findUnique({ where: { id: data.id } });
    if (!existing || existing.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const nextName = data.name !== undefined ? cleanText(data.name) : undefined;
    if (data.name !== undefined && !nextName) {
      return NextResponse.json({ error: "Forecast Sales name cannot be empty" }, { status: 400 });
    }

    const nextStatus =
      data.status !== undefined ? (cleanText(data.status) || undefined) : undefined;
    const approvalTarget = (nextStatus || "").toLowerCase();
    const approvalStatuses = new Set(["approved", "rejected", "revision_requested"]);
    if (approvalTarget && approvalStatuses.has(approvalTarget) && !canApproveProjectStatus(session.user.role)) {
      return NextResponse.json({ error: "Forbidden: only CEO/DIRUT/ASS_DIRUT can approve Forecast Sales" }, { status: 403 });
    }
    const approvalComment = cleanText(data.approvalComment);
    if (approvalTarget && approvalStatuses.has(approvalTarget) && !approvalComment) {
      return NextResponse.json({ error: "Approval comment is required" }, { status: 400 });
    }
    const toApprovalStatus = (nextStatus || "").toLowerCase();
    const nextBuyerFeedbackStatus = data.buyerFeedbackStatus !== undefined ? cleanText(data.buyerFeedbackStatus) : undefined;
    if (nextBuyerFeedbackStatus === "failed" && !cleanText(data.buyerFeedbackReason)) {
      return NextResponse.json({ error: "Failed buyer feedback reason is required" }, { status: 400 });
    }
    const supplierForCheck = data.supplierCandidates !== undefined ? data.supplierCandidates : existing.supplierCandidates;
    const belowSpecReasonForCheck = data.belowSpecReason !== undefined ? data.belowSpecReason : existing.belowSpecReason;
    if (
      toApprovalStatus === "waiting_approval" &&
      needsBelowSpecAcknowledgement(supplierForCheck) &&
      !cleanText(belowSpecReasonForCheck)
    ) {
      return NextResponse.json({ error: "Below-spec acknowledgement reason is required" }, { status: 400 });
    }
    const shouldSetApproval = toApprovalStatus === "approved";
    const shouldResetApproval = toApprovalStatus === "rejected" || toApprovalStatus === "waiting_approval" || toApprovalStatus === "revision_requested";
    const shouldAppendApprovalHistory = Boolean(nextStatus && cleanText(nextStatus) !== cleanText(existing.status) && approvalComment);
    const approvalHistory = shouldAppendApprovalHistory
      ? JSON.stringify([
        {
          status: nextStatus,
          comment: approvalComment,
          userId: session.user.id,
          userName: session.user.name || "Unknown",
          createdAt: new Date().toISOString(),
        },
        ...parseApprovalHistory(existing.approvalHistory),
      ])
      : undefined;

    const revisionFields = [
      {
        key: "targetSellingPrice",
        label: "Target Selling Price",
        incoming: data.targetSellingPrice,
        previous: existing.targetSellingPrice,
        next: numberOrNull(data.targetSellingPrice),
      },
      {
        key: "laycanStart",
        label: "Laycan Start",
        incoming: data.laycanStart,
        previous: dateValue(existing.laycanStart),
        next: dateValue(dateOrNull(data.laycanStart) as Date | null | undefined),
      },
      {
        key: "laycanEnd",
        label: "Laycan End",
        incoming: data.laycanEnd,
        previous: dateValue(existing.laycanEnd),
        next: dateValue(dateOrNull(data.laycanEnd) as Date | null | undefined),
      },
      {
        key: "supplierCandidates",
        label: "Supplier Candidates",
        incoming: data.supplierCandidates,
        previous: existing.supplierCandidates,
        next: cleanText(data.supplierCandidates),
      },
      {
        key: "quantity",
        label: "Quantity",
        incoming: data.quantity,
        previous: existing.quantity,
        next: numberOrNull(data.quantity),
      },
    ];
    const revisionChanges = revisionFields
      .filter((field) => field.incoming !== undefined && comparableValue(field.previous) !== comparableValue(field.next))
      .map((field) => ({
        field: field.key,
        label: field.label,
        oldValue: comparableValue(field.previous) || null,
        newValue: comparableValue(field.next) || null,
      }));
    const revisionHistory = revisionChanges.length
      ? JSON.stringify([
        {
          changes: revisionChanges,
          reason: cleanText(data.revisionReason) || cleanText(data.approvalComment) || "Forecast Sales updated",
          statusAtChange: existing.status,
          userId: session.user.id,
          userName: session.user.name || "Unknown",
          createdAt: new Date().toISOString(),
        },
        ...parseJsonHistory(existing.revisionHistory),
      ])
      : undefined;

    const fcoHistory = (data.fcoNumber !== undefined || data.fcoGeneratedAt !== undefined)
      ? JSON.stringify([
        {
          version: parseJsonHistory(existing.fcoHistory).length + 1,
          action: existing.fcoNumber && cleanText(data.fcoNumber) === existing.fcoNumber ? "download" : "generate",
          fcoNumber: cleanText(data.fcoNumber) || existing.fcoNumber || null,
          previousFcoNumber: existing.fcoNumber || null,
          generatedAt: data.fcoGeneratedAt || new Date().toISOString(),
          userId: session.user.id,
          userName: session.user.name || "Unknown",
          createdAt: new Date().toISOString(),
        },
        ...parseJsonHistory(existing.fcoHistory),
      ])
      : undefined;

    const buyerFeedbackHistory = nextBuyerFeedbackStatus !== undefined
      ? JSON.stringify([
        {
          status: nextBuyerFeedbackStatus,
          previousStatus: existing.buyerFeedbackStatus || null,
          reason: cleanText(data.buyerFeedbackReason) || null,
          fcoNumber: data.fcoNumber !== undefined ? cleanText(data.fcoNumber) : existing.fcoNumber,
          userId: session.user.id,
          userName: session.user.name || "Unknown",
          createdAt: data.buyerFeedbackUpdatedAt || new Date().toISOString(),
        },
        ...parseJsonHistory(existing.buyerFeedbackHistory),
      ])
      : undefined;

    const mergedForPnl = {
      id: existing.id,
      name: nextName || existing.name,
      quantity: data.quantity !== undefined ? numberOrNull(data.quantity) : existing.quantity,
      targetSellingPrice: data.targetSellingPrice !== undefined ? numberOrNull(data.targetSellingPrice) : existing.targetSellingPrice,
      supplierCandidates: data.supplierCandidates !== undefined ? cleanText(data.supplierCandidates) : existing.supplierCandidates,
      blendingScenario: data.blendingScenario !== undefined ? cleanText(data.blendingScenario) : existing.blendingScenario,
      surveyor: data.surveyor !== undefined ? cleanText(data.surveyor) : existing.surveyor,
    };

    const project = await prisma.projectItem.update({
      where: { id: data.id },
      data: {
        name: nextName || undefined,
        segment: data.segment !== undefined ? cleanText(data.segment) : undefined,
        buyer: data.buyer !== undefined ? cleanText(data.buyer) : undefined,
        status: nextStatus,
        notes: data.notes !== undefined ? cleanText(data.notes) : undefined,
        buyerCountry: data.buyerCountry !== undefined ? cleanText(data.buyerCountry) : undefined,
        commodity: data.commodity !== undefined ? cleanText(data.commodity) : undefined,
        quantity: numberOrNull(data.quantity),
        laycanStart: dateOrNull(data.laycanStart),
        laycanEnd: dateOrNull(data.laycanEnd),
        portOfLoading: data.portOfLoading !== undefined ? cleanText(data.portOfLoading) : undefined,
        salesTerm: data.salesTerm !== undefined ? cleanText(data.salesTerm) : undefined,
        targetSellingPrice: numberOrNull(data.targetSellingPrice),
        priceBasis: data.priceBasis !== undefined ? cleanText(data.priceBasis) : undefined,
        paymentTerms: data.paymentTerms !== undefined ? cleanText(data.paymentTerms) : undefined,
        surveyor: data.surveyor !== undefined ? cleanText(data.surveyor) : undefined,
        gar: numberOrNull(data.gar),
        tm: numberOrNull(data.tm),
        ts: numberOrNull(data.ts),
        ash: numberOrNull(data.ash),
        vm: numberOrNull(data.vm),
        size: data.size !== undefined ? cleanText(data.size) : undefined,
        supplierCandidates: data.supplierCandidates !== undefined ? cleanText(data.supplierCandidates) : undefined,
        belowSpecReason: data.belowSpecReason !== undefined ? cleanText(data.belowSpecReason) : undefined,
        belowSpecAcknowledgedAt: data.belowSpecReason !== undefined
          ? (cleanText(data.belowSpecReason) ? new Date() : null)
          : undefined,
        belowSpecAcknowledgedByName: data.belowSpecReason !== undefined
          ? (cleanText(data.belowSpecReason) ? (session.user.name || null) : null)
          : undefined,
        blendingScenario: data.blendingScenario !== undefined ? cleanText(data.blendingScenario) : undefined,
        roughPnl: buildRoughPnl(mergedForPnl),
        templateType: data.templateType !== undefined ? cleanText(data.templateType) : undefined,
        templateChecklist: data.templateChecklist !== undefined ? cleanText(data.templateChecklist) : undefined,
        urgencyScore: data.urgencyScore !== undefined ? Number(data.urgencyScore) : undefined,
        urgencyLevel: data.urgencyLevel !== undefined ? cleanText(data.urgencyLevel) : undefined,
        urgencyReport: data.urgencyReport !== undefined ? cleanText(data.urgencyReport) : undefined,
        lastUrgencyAnalyzedAt: data.lastUrgencyAnalyzedAt !== undefined
          ? (data.lastUrgencyAnalyzedAt ? new Date(data.lastUrgencyAnalyzedAt) : null)
          : undefined,
        approvedBy: shouldSetApproval
          ? session.user.id
          : shouldResetApproval
            ? null
            : undefined,
        approvedByName: shouldSetApproval
          ? (session.user.name || null)
          : shouldResetApproval
            ? null
            : undefined,
        approvedAt: shouldSetApproval
          ? new Date()
          : shouldResetApproval
            ? null
            : undefined,
        approvalHistory,
        revisionHistory,
        fcoNumber: data.fcoNumber !== undefined ? cleanText(data.fcoNumber) : undefined,
        fcoGeneratedAt: data.fcoGeneratedAt !== undefined
          ? (data.fcoGeneratedAt ? new Date(data.fcoGeneratedAt) : null)
          : undefined,
        fcoHistory,
        buyerFeedbackStatus: nextBuyerFeedbackStatus,
        buyerFeedbackReason: data.buyerFeedbackReason !== undefined ? cleanText(data.buyerFeedbackReason) : undefined,
        buyerFeedbackUpdatedAt: data.buyerFeedbackStatus !== undefined
          ? (data.buyerFeedbackUpdatedAt ? new Date(data.buyerFeedbackUpdatedAt) : new Date())
          : undefined,
        buyerFeedbackHistory,
      },
    });
    const generalAuditFields = [
      "name",
      "segment",
      "buyer",
      "status",
      "buyerCountry",
      "commodity",
      "portOfLoading",
      "salesTerm",
      "priceBasis",
      "paymentTerms",
      "surveyor",
      "belowSpecReason",
      "blendingScenario",
      "templateType",
      "fcoNumber",
      "buyerFeedbackStatus",
      "buyerFeedbackReason",
    ];
    const structuredChanges = [
      ...revisionChanges.map((change) => ({ field: change.field, oldValue: change.oldValue, newValue: change.newValue })),
      ...generalAuditFields
        .filter((field) => data[field] !== undefined && comparableValue((existing as any)[field]) !== comparableValue((project as any)[field]))
        .map((field) => ({
          field,
          oldValue: (existing as any)[field] ?? null,
          newValue: (project as any)[field] ?? null,
        })),
    ];
    await tryAuditLog(
      session.user.id,
      session.user.name || "Unknown",
      "UPDATE",
      project.id,
      structuredAuditDetails({
        actionType: approvalTarget ? `status_${approvalTarget}` : nextBuyerFeedbackStatus ? "buyer_feedback" : "update",
        reason: cleanText(data.revisionReason) || approvalComment || cleanText(data.buyerFeedbackReason) || cleanText(data.reason) || null,
        evidence: cleanText(data.evidence) || null,
        changes: structuredChanges,
        context: {
          approvalComment: approvalComment || null,
          buyerFeedbackStatus: nextBuyerFeedbackStatus || null,
          roughPnlRefreshed: true,
        },
      }),
    );

    return NextResponse.json({ success: true, project });
  } catch (error) {
    console.error("PUT /api/memory/projects error:", error);
    return NextResponse.json(
      { error: "Failed to update Forecast Sales", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await ensureProjectTableCached();

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Forecast Sales ID missing" }, { status: 400 });

    const existing = await prisma.projectItem.findUnique({ where: { id } });
    if (!existing || existing.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.projectItem.update({
      where: { id },
      data: { isDeleted: true },
    });
    await tryAuditLog(
      session.user.id,
      session.user.name || "Unknown",
      "DELETE",
      id,
      JSON.stringify({ isDeleted: true }),
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/memory/projects error:", error);
    return NextResponse.json(
      { error: "Failed to delete Forecast Sales", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
