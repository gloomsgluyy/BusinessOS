import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canReadModuleForRole, canWriteModuleForRole } from "@/lib/role-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

let candidateTableReady = false;

async function ensureProjectSupplierCandidateTable() {
  if (candidateTableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProjectSupplierCandidate" (
      "id" TEXT NOT NULL,
      "projectId" TEXT NOT NULL,
      "sourceId" TEXT,
      "supplierName" TEXT NOT NULL,
      "sourceName" TEXT,
      "region" TEXT,
      "fitScore" INTEGER,
      "warningText" TEXT,
      "stockAvailable" DOUBLE PRECISION,
      "gar" DOUBLE PRECISION,
      "tm" DOUBLE PRECISION,
      "ts" DOUBLE PRECISION,
      "ash" DOUBLE PRECISION,
      "priceUsd" DOUBLE PRECISION,
      "status" TEXT NOT NULL DEFAULT 'candidate',
      "selected" BOOLEAN NOT NULL DEFAULT false,
      "version" INTEGER NOT NULL DEFAULT 1,
      "notes" TEXT,
      "createdBy" TEXT,
      "createdByName" TEXT,
      "selectedBy" TEXT,
      "selectedByName" TEXT,
      "selectedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      CONSTRAINT "ProjectSupplierCandidate_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ProjectSupplierCandidate_projectId_idx" ON "ProjectSupplierCandidate"("projectId");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ProjectSupplierCandidate_projectId_selected_idx" ON "ProjectSupplierCandidate"("projectId", "selected");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ProjectSupplierCandidate_projectId_status_idx" ON "ProjectSupplierCandidate"("projectId", "status");`);
  candidateTableReady = true;
}

function cleanText(value: unknown, fallback = "") {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function toNum(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toInt(value: unknown) {
  const numeric = toNum(value);
  return numeric === null ? null : Math.round(numeric);
}

function candidateSelect() {
  return {
    id: true,
    projectId: true,
    sourceId: true,
    supplierName: true,
    sourceName: true,
    region: true,
    fitScore: true,
    warningText: true,
    stockAvailable: true,
    gar: true,
    tm: true,
    ts: true,
    ash: true,
    priceUsd: true,
    status: true,
    selected: true,
    version: true,
    notes: true,
    createdBy: true,
    createdByName: true,
    selectedBy: true,
    selectedByName: true,
    selectedAt: true,
    createdAt: true,
    updatedAt: true,
    isDeleted: true,
  };
}

async function assertProject(projectId: string) {
  const project = await prisma.projectItem.findFirst({
    where: { id: projectId, isDeleted: false },
    select: {
      id: true,
      name: true,
      quantity: true,
      targetSellingPrice: true,
      supplierCandidates: true,
      blendingScenario: true,
      surveyor: true,
    },
  });
  return project;
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

function buildRoughPnlFromSelectedCandidate(project: any, candidate: any) {
  const scenario = parseJsonObject(project.blendingScenario);
  const scenarioCost = Number(scenario?.result?.avgCost);
  const selectedPrice = Number(candidate.priceUsd || 0);
  const supplierPrice = selectedPrice > 0 ? selectedPrice : (Number.isFinite(scenarioCost) && scenarioCost > 0 ? scenarioCost : 0);
  const quantity = Number(project.quantity || 0);
  const sellingPrice = Number(project.targetSellingPrice || 0);
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
    source: "selected_supplier_candidate",
    forecastSalesId: project.id,
    forecastSalesName: project.name,
    selectedSupplierCandidateId: candidate.id,
    selectedSupplierName: candidate.supplierName,
    selectedSupplierFitScore: candidate.fitScore,
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
      ? "Supplier price pulled from selected structured supplier candidate."
      : "Selected supplier has no price yet; rough P&L should be updated when source cost is available.",
  });
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canReadModuleForRole(session.user.role, "PL_SALES")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await ensureProjectSupplierCandidateTable();
  const project = await assertProject(params.id);
  if (!project) return NextResponse.json({ error: "Forecast Sales not found" }, { status: 404 });

  const candidates = await prisma.projectSupplierCandidate.findMany({
    where: { projectId: params.id, isDeleted: false },
    orderBy: [{ selected: "desc" }, { fitScore: "desc" }, { updatedAt: "desc" }],
    select: candidateSelect(),
  });

  return NextResponse.json({ success: true, candidates });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canWriteModuleForRole(session.user.role, "PL_SALES")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await ensureProjectSupplierCandidateTable();
  const project = await assertProject(params.id);
  if (!project) return NextResponse.json({ error: "Forecast Sales not found" }, { status: 404 });

  const data = await req.json();
  const supplierName = cleanText(data.supplierName ?? data.supplier_name ?? data.sourceName ?? data.source_name);
  if (!supplierName) return NextResponse.json({ error: "Supplier/source name is required" }, { status: 400 });
  const sourceId = cleanText(data.sourceId ?? data.source_id) || null;

  const latest = await prisma.projectSupplierCandidate.findFirst({
    where: { projectId: params.id, isDeleted: false },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const existing = sourceId
    ? await prisma.projectSupplierCandidate.findFirst({
      where: { projectId: params.id, sourceId, isDeleted: false },
      select: { id: true },
    })
    : null;

  const candidate = existing
    ? await prisma.projectSupplierCandidate.update({
      where: { id: existing.id },
      data: {
        supplierName,
        sourceName: cleanText(data.sourceName ?? data.source_name) || supplierName,
        region: cleanText(data.region) || null,
        fitScore: toInt(data.fitScore ?? data.fit_score),
        warningText: cleanText(data.warningText ?? data.warning_text) || null,
        stockAvailable: toNum(data.stockAvailable ?? data.stock_available),
        gar: toNum(data.gar),
        tm: toNum(data.tm),
        ts: toNum(data.ts),
        ash: toNum(data.ash),
        priceUsd: toNum(data.priceUsd ?? data.price_usd),
        notes: cleanText(data.notes) || null,
        status: cleanText(data.status, "candidate").toLowerCase(),
        updatedAt: new Date(),
      },
      select: candidateSelect(),
    })
    : await prisma.projectSupplierCandidate.create({
      data: {
        projectId: params.id,
        sourceId,
        supplierName,
        sourceName: cleanText(data.sourceName ?? data.source_name) || supplierName,
        region: cleanText(data.region) || null,
        fitScore: toInt(data.fitScore ?? data.fit_score),
        warningText: cleanText(data.warningText ?? data.warning_text) || null,
        stockAvailable: toNum(data.stockAvailable ?? data.stock_available),
        gar: toNum(data.gar),
        tm: toNum(data.tm),
        ts: toNum(data.ts),
        ash: toNum(data.ash),
        priceUsd: toNum(data.priceUsd ?? data.price_usd),
        notes: cleanText(data.notes) || null,
        status: cleanText(data.status, "candidate").toLowerCase(),
        version: (latest?.version || 0) + 1,
        createdBy: session.user.id,
        createdByName: session.user.name || session.user.email || null,
      },
      select: candidateSelect(),
    });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      userName: session.user.name || "Unknown",
      action: existing ? "FORECAST_SUPPLIER_CANDIDATE_UPDATE" : "FORECAST_SUPPLIER_CANDIDATE_CREATE",
      entity: "ProjectSupplierCandidate",
      entityId: candidate.id,
      details: JSON.stringify({ projectId: params.id, supplierName: candidate.supplierName, fitScore: candidate.fitScore }),
    },
  }).catch(() => null);

  return NextResponse.json({ success: true, candidate });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canWriteModuleForRole(session.user.role, "PL_SALES")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await ensureProjectSupplierCandidateTable();
  const project = await assertProject(params.id);
  if (!project) return NextResponse.json({ error: "Forecast Sales not found" }, { status: 404 });

  const data = await req.json();
  const id = cleanText(data.id);
  if (!id) return NextResponse.json({ error: "Candidate ID is required" }, { status: 400 });

  const existing = await prisma.projectSupplierCandidate.findFirst({
    where: { id, projectId: params.id, isDeleted: false },
    select: { id: true, supplierName: true },
  });
  if (!existing) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });

  const selected = Boolean(data.selected);
  const candidate = await prisma.$transaction(async (tx) => {
    if (selected) {
      await tx.projectSupplierCandidate.updateMany({
        where: { projectId: params.id, isDeleted: false, selected: true },
        data: { selected: false, status: "candidate", updatedAt: new Date() },
      });
    }
    return tx.projectSupplierCandidate.update({
      where: { id },
      data: {
        selected,
        status: data.status !== undefined ? cleanText(data.status, "candidate").toLowerCase() : (selected ? "selected" : undefined),
        notes: data.notes !== undefined ? (cleanText(data.notes) || null) : undefined,
        selectedBy: selected ? session.user.id : null,
        selectedByName: selected ? (session.user.name || session.user.email || null) : null,
        selectedAt: selected ? new Date() : null,
        updatedAt: new Date(),
      },
      select: candidateSelect(),
    });
  });

  if (selected) {
    await prisma.projectItem.update({
      where: { id: params.id },
      data: { roughPnl: buildRoughPnlFromSelectedCandidate(project, candidate) },
    }).catch(() => null);
  }

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      userName: session.user.name || "Unknown",
      action: selected ? "FORECAST_SUPPLIER_CANDIDATE_SELECT" : "FORECAST_SUPPLIER_CANDIDATE_UPDATE",
      entity: "ProjectSupplierCandidate",
      entityId: candidate.id,
      details: JSON.stringify({ projectId: params.id, supplierName: candidate.supplierName, selected }),
    },
  }).catch(() => null);

  return NextResponse.json({ success: true, candidate });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canWriteModuleForRole(session.user.role, "PL_SALES")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await ensureProjectSupplierCandidateTable();
  const url = new URL(req.url);
  const id = cleanText(url.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "Candidate ID is required" }, { status: 400 });

  const existing = await prisma.projectSupplierCandidate.findFirst({
    where: { id, projectId: params.id, isDeleted: false },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });

  await prisma.projectSupplierCandidate.update({
    where: { id },
    data: { isDeleted: true, selected: false, status: "deleted", updatedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      userName: session.user.name || "Unknown",
      action: "FORECAST_SUPPLIER_CANDIDATE_DELETE",
      entity: "ProjectSupplierCandidate",
      entityId: id,
      details: JSON.stringify({ projectId: params.id }),
    },
  }).catch(() => null);

  return NextResponse.json({ success: true });
}
