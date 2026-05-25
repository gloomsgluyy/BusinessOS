import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canReadModuleForRole, canWriteModuleForRole } from "@/lib/role-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

let shippingInstructionTableReady = false;

async function ensureShippingInstructionTable() {
  if (shippingInstructionTableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ShippingInstructionRecord" (
      "id" TEXT NOT NULL,
      "shipmentId" TEXT NOT NULL,
      "siNumber" TEXT NOT NULL,
      "version" INTEGER NOT NULL DEFAULT 1,
      "status" TEXT NOT NULL DEFAULT 'generated',
      "reason" TEXT,
      "earlyApprovalReason" TEXT,
      "approvedBy" TEXT,
      "approvedByName" TEXT,
      "approvedAt" TIMESTAMP(3),
      "approvalComment" TEXT,
      "cancellationReason" TEXT,
      "cancelledBy" TEXT,
      "cancelledByName" TEXT,
      "cancelledAt" TIMESTAMP(3),
      "pdfFileName" TEXT,
      "pdfGeneratedAt" TIMESTAMP(3),
      "snapshot" TEXT NOT NULL DEFAULT '{}',
      "generatedBy" TEXT,
      "generatedByName" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      CONSTRAINT "ShippingInstructionRecord_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ShippingInstructionRecord_shipmentId_idx" ON "ShippingInstructionRecord"("shipmentId");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ShippingInstructionRecord_shipmentId_version_idx" ON "ShippingInstructionRecord"("shipmentId", "version");`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ShippingInstructionRecord" ADD COLUMN IF NOT EXISTS "earlyApprovalReason" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ShippingInstructionRecord" ADD COLUMN IF NOT EXISTS "approvedBy" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ShippingInstructionRecord" ADD COLUMN IF NOT EXISTS "approvedByName" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ShippingInstructionRecord" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ShippingInstructionRecord" ADD COLUMN IF NOT EXISTS "approvalComment" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ShippingInstructionRecord" ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ShippingInstructionRecord" ADD COLUMN IF NOT EXISTS "cancelledBy" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ShippingInstructionRecord" ADD COLUMN IF NOT EXISTS "cancelledByName" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ShippingInstructionRecord" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ShippingInstructionRecord" ADD COLUMN IF NOT EXISTS "pdfFileName" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ShippingInstructionRecord" ADD COLUMN IF NOT EXISTS "pdfGeneratedAt" TIMESTAMP(3);`);
  shippingInstructionTableReady = true;
}

function canReadSi(role: unknown) {
  return canReadModuleForRole(role, "OPERATIONS_TRAFFIC") || canReadModuleForRole(role, "PL_SALES");
}

function canWriteSi(role: unknown) {
  return canWriteModuleForRole(role, "OPERATIONS_TRAFFIC") || canWriteModuleForRole(role, "PL_SALES");
}

function cleanText(value: unknown, fallback = "") {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function auditDetails(input: {
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

function romanMonth(date = new Date()) {
  const months = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  return months[date.getMonth()] || "I";
}

function buildSiNumber(shipment: any, version: number) {
  const existing = cleanText(shipment?.noSi || shipment?.no_si);
  if (existing) return version > 1 ? `${existing}-R${version - 1}` : existing;
  const date = new Date();
  const no = shipment?.no ? String(shipment.no).padStart(3, "0") : String(version).padStart(3, "0");
  const base = `${no} SI-SUPPLIER/${romanMonth(date)}/${date.getFullYear()}`;
  return version > 1 ? `${base}-R${version - 1}` : base;
}

function safeFileName(value: string) {
  return value.replace(/[^\w.\- ()]/g, "_").slice(0, 160) || "shipping-instruction";
}

function buildSnapshot(shipment: any) {
  return {
    shipmentId: shipment.id,
    forecastSalesId: shipment.forecastSalesId,
    forecastSalesName: shipment.forecastSalesName || shipment.mvProjectName,
    fcoNumber: shipment.fcoNumber,
    buyer: shipment.buyer,
    supplier: shipment.supplier || shipment.source,
    vesselName: shipment.vesselName,
    bargeName: shipment.bargeName,
    nomination: shipment.nomination,
    laycan: shipment.laycan,
    quantity: shipment.quantityLoaded || shipment.qtyPlan || shipment.qtyCob,
    loadingPort: shipment.loadingPort || shipment.jettyLoadingPort,
    dischargePort: shipment.dischargePort,
    shippingTerm: shipment.shippingTerm,
    product: shipment.product,
    surveyor: shipment.surveyorLhv,
    siTo: shipment.siTo,
    siShipper: shipment.siShipper,
    consignee: shipment.consignee,
    notifyParty: shipment.notifyParty,
    quantityTolerance: shipment.quantityTolerance,
    createdAt: new Date().toISOString(),
  };
}

function parseLaycanDate(value: unknown): Date | null {
  const text = cleanText(value);
  if (!text) return null;
  const direct = new Date(text);
  if (!Number.isNaN(direct.getTime())) return direct;
  const match = text.match(/(\d{1,2})\s*[-\/]?\s*([A-Za-z]{3,})(?:\s+((?:19|20)\d{2}))?/);
  if (!match) return null;
  const months: Record<string, number> = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, MEI: 4, JUN: 5,
    JUL: 6, AUG: 7, AGU: 7, SEP: 8, OCT: 9, OKT: 9, NOV: 10, DEC: 11, DES: 11,
  };
  const month = months[match[2].slice(0, 3).toUpperCase()];
  const year = match[3] ? Number(match[3]) : new Date().getFullYear();
  if (month === undefined) return null;
  const date = new Date(year, month, Number(match[1]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function isEarlierThanH10(shipment: any) {
  const laycanDate = parseLaycanDate(shipment?.laycan);
  if (!laycanDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  laycanDate.setHours(0, 0, 0, 0);
  const daysUntilLaycan = Math.ceil((laycanDate.getTime() - today.getTime()) / 86400000);
  return daysUntilLaycan > 10;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canReadSi(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await ensureShippingInstructionTable();

  const records = await prisma.shippingInstructionRecord.findMany({
    where: { shipmentId: params.id, isDeleted: false },
    orderBy: [{ version: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({
    success: true,
    records: records.map((record) => ({
      ...record,
      pdfUrl: `/api/shipments/${params.id}/shipping-instructions/${record.id}/pdf`,
    })),
  });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canWriteSi(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await ensureShippingInstructionTable();

  const shipment = await prisma.shipmentDetail.findUnique({ where: { id: params.id } });
  if (!shipment || shipment.isDeleted) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const latest = await prisma.shippingInstructionRecord.findFirst({
    where: { shipmentId: params.id, isDeleted: false },
    orderBy: { version: "desc" },
  });
  const version = (latest?.version || 0) + 1;
  const reason = cleanText(body.reason, version > 1 ? "SI revision generated" : "Initial SI generated");
  const early = isEarlierThanH10(shipment);
  const earlyApprovalReason = cleanText(body.earlyApprovalReason || body.reason);
  if (early && !earlyApprovalReason) {
    return NextResponse.json({ error: "Early SI approval reason is required before H-10" }, { status: 400 });
  }
  const siNumber = cleanText(body.siNumber) || buildSiNumber(shipment, version);
  const pdfFileName = `${safeFileName(siNumber)}-v${version}.pdf`;

  if (latest && !["cancelled", "rejected", "superseded"].includes(latest.status)) {
    await prisma.shippingInstructionRecord.update({
      where: { id: latest.id },
      data: { status: "superseded" },
    });
  }

  const record = await prisma.shippingInstructionRecord.create({
    data: {
      shipmentId: params.id,
      siNumber,
      version,
      status: early ? "early_pending_approval" : cleanText(body.status, "generated"),
      reason,
      earlyApprovalReason: early ? earlyApprovalReason : null,
      pdfFileName,
      pdfGeneratedAt: new Date(),
      snapshot: JSON.stringify(buildSnapshot(shipment)),
      generatedBy: session.user.id,
      generatedByName: session.user.name || null,
    },
  });

  try {
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        userName: session.user.name || "Unknown",
        action: version > 1 ? "CREATE_SI_REVISION" : "CREATE_SI",
        entity: "ShippingInstructionRecord",
        entityId: record.id,
        details: auditDetails({
          actionType: version > 1 ? "revision" : "create",
          reason,
          evidence: body.evidence || null,
          changes: [
            { field: "siNumber", oldValue: latest?.siNumber || null, newValue: siNumber },
            { field: "version", oldValue: latest?.version || null, newValue: version },
            { field: "status", oldValue: latest?.status || null, newValue: record.status },
          ],
          context: { shipmentId: params.id, earlyApprovalReason: record.earlyApprovalReason, pdfFileName },
        }),
      },
    });
  } catch (error: any) {
    console.warn("[shipping-instructions] audit skipped:", error?.code || error?.message);
  }

  return NextResponse.json({
    success: true,
    record: {
      ...record,
      pdfUrl: `/api/shipments/${params.id}/shipping-instructions/${record.id}/pdf`,
    },
  });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = String(session.user.role || "").toUpperCase();

  await ensureShippingInstructionTable();

  const body = await req.json().catch(() => ({}));
  const recordId = cleanText(body.id);
  const action = cleanText(body.action).toLowerCase();
  const comment = cleanText(body.comment);
  if (!recordId) return NextResponse.json({ error: "SI record ID is required" }, { status: 400 });
  if (!["approve", "reject", "cancel"].includes(action)) return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  if (!comment) return NextResponse.json({ error: action === "cancel" ? "Cancellation reason is required" : "Approval comment is required" }, { status: 400 });
  const isExecutive = ["CEO", "DIRUT", "ASS_DIRUT", "COO"].includes(role);
  if (["approve", "reject"].includes(action) && !isExecutive) {
    return NextResponse.json({ error: "Forbidden: executive approval required" }, { status: 403 });
  }
  if (action === "cancel" && !canWriteSi(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.shippingInstructionRecord.findFirst({
    where: { id: recordId, shipmentId: params.id, isDeleted: false },
  });
  if (!existing) return NextResponse.json({ error: "SI record not found" }, { status: 404 });

  const record = await prisma.shippingInstructionRecord.update({
    where: { id: recordId },
    data: action === "cancel"
      ? {
        status: "cancelled",
        cancellationReason: comment,
        cancelledBy: session.user.id,
        cancelledByName: session.user.name || null,
        cancelledAt: new Date(),
      }
      : {
        status: action === "approve" ? "approved" : "rejected",
        approvedBy: session.user.id,
        approvedByName: session.user.name || null,
        approvedAt: new Date(),
        approvalComment: comment,
      },
  });

  try {
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        userName: session.user.name || "Unknown",
        action: action === "approve" ? "APPROVE_EARLY_SI" : action === "reject" ? "REJECT_EARLY_SI" : "CANCEL_SI",
        entity: "ShippingInstructionRecord",
        entityId: record.id,
        details: auditDetails({
          actionType: action === "cancel" ? "cancelled" : record.status,
          reason: comment,
          evidence: body.evidence || null,
          changes: [
            { field: "status", oldValue: existing.status, newValue: record.status },
            ...(action === "cancel"
              ? [{ field: "cancellationReason", oldValue: existing.cancellationReason, newValue: comment }]
              : [{ field: "approvalComment", oldValue: existing.approvalComment, newValue: comment }]),
          ],
          context: { shipmentId: params.id, siNumber: record.siNumber, version: record.version },
        }),
      },
    });
  } catch (error: any) {
    console.warn("[shipping-instructions] audit skipped:", error?.code || error?.message);
  }

  return NextResponse.json({
    success: true,
    record: {
      ...record,
      pdfUrl: `/api/shipments/${params.id}/shipping-instructions/${record.id}/pdf`,
    },
  });
}
