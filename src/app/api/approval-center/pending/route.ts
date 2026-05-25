import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canApproveProjectStatus, isExecutiveRole } from "@/lib/role-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ApprovalKind = "forecast_sales" | "early_si" | "source_change" | "barge_change";
type ApprovalPriority = "critical" | "high" | "medium";

type ApprovalItem = {
  id: string;
  kind: ApprovalKind;
  recordId: string;
  approvalRequestId?: string | null;
  shipmentId?: string | null;
  title: string;
  subtitle: string;
  requestedBy?: string | null;
  createdAt?: string | null;
  slaDueAt?: string | null;
  ageHours?: number | null;
  priority: ApprovalPriority;
  href: string;
  meta: Record<string, string | number | null>;
};

function activeShipmentName(shipment: any) {
  return shipment?.mvProjectName || shipment?.vesselName || shipment?.bargeName || shipment?.nomination || shipment?.id || "Shipment";
}

function dateIso(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalize(value: unknown) {
  return String(value || "").trim();
}

async function ensureApprovalColumns() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "ProjectItem" ADD COLUMN IF NOT EXISTS "approvalHistory" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ProjectItem" ADD COLUMN IF NOT EXISTS "targetSellingPrice" DOUBLE PRECISION;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ProjectItem" ADD COLUMN IF NOT EXISTS "quantity" DOUBLE PRECISION;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ProjectItem" ADD COLUMN IF NOT EXISTS "buyerCountry" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ShippingInstructionRecord" ADD COLUMN IF NOT EXISTS "earlyApprovalReason" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ShippingInstructionRecord" ADD COLUMN IF NOT EXISTS "approvedByName" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ShippingInstructionRecord" ADD COLUMN IF NOT EXISTS "approvalComment" TEXT;`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ApprovalRequest" (
      "id" TEXT NOT NULL,
      "kind" TEXT NOT NULL,
      "recordId" TEXT NOT NULL,
      "shipmentId" TEXT,
      "title" TEXT NOT NULL,
      "subtitle" TEXT,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "priority" TEXT NOT NULL DEFAULT 'medium',
      "href" TEXT,
      "meta" TEXT NOT NULL DEFAULT '{}',
      "requestedBy" TEXT,
      "requestedByName" TEXT,
      "sourceUpdatedAt" TIMESTAMP(3),
      "slaDueAt" TIMESTAMP(3),
      "resolvedBy" TEXT,
      "resolvedByName" TEXT,
      "resolvedAt" TIMESTAMP(3),
      "decisionComment" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "ApprovalRequest_kind_recordId_key" ON "ApprovalRequest"("kind", "recordId");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ApprovalRequest_status_idx" ON "ApprovalRequest"("status");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ApprovalRequest_kind_status_idx" ON "ApprovalRequest"("kind", "status");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ApprovalRequest_shipmentId_idx" ON "ApprovalRequest"("shipmentId");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ApprovalRequest_priority_slaDueAt_idx" ON "ApprovalRequest"("priority", "slaDueAt");`);
}

function slaDueFrom(createdAt: string | null | undefined, priority: ApprovalPriority) {
  const base = createdAt ? new Date(createdAt) : new Date();
  const hours = priority === "critical" ? 24 : priority === "high" ? 48 : 72;
  return new Date(base.getTime() + hours * 3600000);
}

function ageHoursFrom(createdAt: string | null | undefined) {
  if (!createdAt) return null;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 3600000));
}

async function syncApprovalRequests(items: ApprovalItem[], visibleKinds: ApprovalKind[]) {
  if (visibleKinds.length === 0) return items;

  try {
    for (const item of items) {
      const sourceUpdatedAt = item.createdAt ? new Date(item.createdAt) : null;
      const slaDueAt = slaDueFrom(item.createdAt, item.priority);
      await prisma.approvalRequest.upsert({
        where: { kind_recordId: { kind: item.kind, recordId: item.recordId } },
        create: {
          kind: item.kind,
          recordId: item.recordId,
          shipmentId: item.shipmentId || null,
          title: item.title,
          subtitle: item.subtitle,
          status: "pending",
          priority: item.priority,
          href: item.href,
          meta: JSON.stringify(item.meta || {}),
          requestedByName: item.requestedBy || null,
          sourceUpdatedAt,
          slaDueAt,
        },
        update: {
          shipmentId: item.shipmentId || null,
          title: item.title,
          subtitle: item.subtitle,
          status: "pending",
          priority: item.priority,
          href: item.href,
          meta: JSON.stringify(item.meta || {}),
          requestedByName: item.requestedBy || null,
          sourceUpdatedAt,
          slaDueAt,
          resolvedAt: null,
          resolvedBy: null,
          resolvedByName: null,
          decisionComment: null,
          isDeleted: false,
        },
      });
    }

    const activeKeys = items.map((item) => ({ kind: item.kind, recordId: item.recordId }));
    await prisma.approvalRequest.updateMany({
      where: {
        kind: { in: visibleKinds },
        status: "pending",
        isDeleted: false,
        ...(activeKeys.length > 0 ? { NOT: activeKeys } : {}),
      },
      data: {
        status: "resolved_external",
        resolvedAt: new Date(),
        decisionComment: "Underlying workflow is no longer pending.",
      },
    });

    const requests = await prisma.approvalRequest.findMany({
      where: {
        OR: activeKeys.length > 0 ? activeKeys : [{ id: "__none__" }],
      },
      select: {
        id: true,
        kind: true,
        recordId: true,
        slaDueAt: true,
        createdAt: true,
      },
    });
    const requestByKey = new Map(requests.map((request) => [`${request.kind}:${request.recordId}`, request]));
    return items.map((item) => {
      const request = requestByKey.get(`${item.kind}:${item.recordId}`);
      return {
        ...item,
        approvalRequestId: request?.id || null,
        slaDueAt: dateIso(request?.slaDueAt || slaDueFrom(item.createdAt, item.priority)),
        ageHours: ageHoursFrom(dateIso(request?.createdAt) || item.createdAt),
      };
    });
  } catch (error: any) {
    console.warn("[approval-center] approval request sync skipped:", error?.code || error?.message);
    return items.map((item) => ({
      ...item,
      slaDueAt: dateIso(slaDueFrom(item.createdAt, item.priority)),
      ageHours: ageHoursFrom(item.createdAt),
    }));
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = session.user.role;
    const canApproveForecast = canApproveProjectStatus(role);
    const canApproveOperational = isExecutiveRole(role);
    if (!canApproveForecast && !canApproveOperational) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await ensureApprovalColumns();

    const [
      forecastSales,
      earlySiRecords,
      sourceChanges,
      bargeChanges,
      shipments,
    ] = await Promise.all([
      canApproveForecast
        ? prisma.projectItem.findMany({
          where: { isDeleted: false, status: "waiting_approval" },
          orderBy: { updatedAt: "desc" },
          take: 100,
          select: {
            id: true,
            name: true,
            buyer: true,
            buyerCountry: true,
            quantity: true,
            targetSellingPrice: true,
            createdByName: true,
            updatedAt: true,
          },
        })
        : Promise.resolve([]),
      canApproveOperational
        ? prisma.shippingInstructionRecord.findMany({
          where: { isDeleted: false, status: "early_pending_approval" },
          orderBy: { createdAt: "desc" },
          take: 100,
          select: {
            id: true,
            shipmentId: true,
            siNumber: true,
            version: true,
            earlyApprovalReason: true,
            generatedByName: true,
            createdAt: true,
          },
        })
        : Promise.resolve([]),
      canApproveOperational
        ? prisma.shipmentSourceChangeRequest.findMany({
          where: { isDeleted: false, status: "pending" },
          orderBy: { createdAt: "desc" },
          take: 100,
          select: {
            id: true,
            shipmentId: true,
            oldSource: true,
            newSource: true,
            reason: true,
            impact: true,
            version: true,
            requestedByName: true,
            createdAt: true,
          },
        })
        : Promise.resolve([]),
      canApproveOperational
        ? prisma.shipmentBargeChangeLog.findMany({
          where: { isDeleted: false, status: "pending" },
          orderBy: { createdAt: "desc" },
          take: 100,
          select: {
            id: true,
            shipmentId: true,
            newMv: true,
            newTb: true,
            newBg: true,
            newNomination: true,
            reason: true,
            impact: true,
            version: true,
            requestedByName: true,
            createdAt: true,
          },
        })
        : Promise.resolve([]),
      canApproveOperational
        ? prisma.shipmentDetail.findMany({
          where: { isDeleted: false },
          take: 500,
          select: {
            id: true,
            mvProjectName: true,
            vesselName: true,
            bargeName: true,
            nomination: true,
          },
        })
        : Promise.resolve([]),
    ]);

    const shipmentById = new Map(shipments.map((shipment) => [shipment.id, shipment]));
    const items: ApprovalItem[] = [];

    for (const project of forecastSales) {
      items.push({
        id: `forecast_sales:${project.id}`,
        kind: "forecast_sales",
        recordId: project.id,
        title: project.name,
        subtitle: `Offer Profile approval${project.buyer ? ` for ${project.buyer}` : ""}`,
        requestedBy: project.createdByName,
        createdAt: dateIso(project.updatedAt),
        priority: "high",
        href: `/forecast-sales?open=${encodeURIComponent(project.id)}`,
        meta: {
          buyer: project.buyer || null,
          country: project.buyerCountry || null,
          quantityMt: project.quantity || null,
          targetPriceUsd: project.targetSellingPrice || null,
        },
      });
    }

    for (const si of earlySiRecords) {
      const shipment = shipmentById.get(si.shipmentId);
      items.push({
        id: `early_si:${si.id}`,
        kind: "early_si",
        recordId: si.id,
        shipmentId: si.shipmentId,
        title: `Early SI ${si.siNumber}`,
        subtitle: `${activeShipmentName(shipment)} needs H-10 approval`,
        requestedBy: si.generatedByName,
        createdAt: dateIso(si.createdAt),
        priority: "critical",
        href: `/shipment-monitor?open=${encodeURIComponent(si.shipmentId)}&tab=all`,
        meta: {
          version: si.version,
          reason: normalize(si.earlyApprovalReason) || null,
        },
      });
    }

    for (const change of sourceChanges) {
      const shipment = shipmentById.get(change.shipmentId);
      items.push({
        id: `source_change:${change.id}`,
        kind: "source_change",
        recordId: change.id,
        shipmentId: change.shipmentId,
        title: `Source Change v${change.version}`,
        subtitle: `${activeShipmentName(shipment)}: ${change.oldSource || "-"} -> ${change.newSource}`,
        requestedBy: change.requestedByName,
        createdAt: dateIso(change.createdAt),
        priority: "high",
        href: `/shipment-monitor?open=${encodeURIComponent(change.shipmentId)}&tab=all`,
        meta: {
          reason: change.reason,
          impact: change.impact || null,
        },
      });
    }

    for (const change of bargeChanges) {
      const shipment = shipmentById.get(change.shipmentId);
      const target = [change.newMv, change.newTb, change.newBg, change.newNomination].filter(Boolean).join(" / ");
      items.push({
        id: `barge_change:${change.id}`,
        kind: "barge_change",
        recordId: change.id,
        shipmentId: change.shipmentId,
        title: `Barge Change v${change.version}`,
        subtitle: `${activeShipmentName(shipment)}: ${target || "vessel/barge nomination update"}`,
        requestedBy: change.requestedByName,
        createdAt: dateIso(change.createdAt),
        priority: "high",
        href: `/shipment-monitor?open=${encodeURIComponent(change.shipmentId)}&tab=all`,
        meta: {
          reason: change.reason,
          impact: change.impact || null,
        },
      });
    }

    const visibleKinds: ApprovalKind[] = [
      ...(canApproveForecast ? ["forecast_sales" as const] : []),
      ...(canApproveOperational ? (["early_si", "source_change", "barge_change"] as const) : []),
    ];
    const syncedItems = await syncApprovalRequests(items, visibleKinds);

    const priorityOrder: Record<ApprovalPriority, number> = { critical: 0, high: 1, medium: 2 };
    syncedItems.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority] || String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    const now = new Date();

    const summary = {
      total: syncedItems.length,
      forecastSales: syncedItems.filter((item) => item.kind === "forecast_sales").length,
      earlySi: syncedItems.filter((item) => item.kind === "early_si").length,
      sourceChange: syncedItems.filter((item) => item.kind === "source_change").length,
      bargeChange: syncedItems.filter((item) => item.kind === "barge_change").length,
      critical: syncedItems.filter((item) => item.priority === "critical").length,
      overdue: syncedItems.filter((item) => item.slaDueAt && new Date(item.slaDueAt).getTime() < now.getTime()).length,
    };

    return NextResponse.json({ success: true, summary, items: syncedItems }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET /api/approval-center/pending error:", error);
    return NextResponse.json({ error: "Failed to fetch approval center queue" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canApproveProjectStatus(session.user.role) && !isExecutiveRole(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await ensureApprovalColumns();

    const body = await request.json().catch(() => ({}));
    const status = normalize(body.status);
    const comment = normalize(body.comment);
    if (!["approved", "rejected", "revision_requested", "resolved_external"].includes(status)) {
      return NextResponse.json({ error: "Invalid approval request status" }, { status: 400 });
    }
    if (!comment) return NextResponse.json({ error: "Decision comment is required" }, { status: 400 });

    const where = body.approvalRequestId
      ? { id: String(body.approvalRequestId) }
      : { kind_recordId: { kind: String(body.kind || ""), recordId: String(body.recordId || "") } };

    const updated = await prisma.approvalRequest.update({
      where: where as any,
      data: {
        status,
        resolvedAt: new Date(),
        resolvedBy: session.user.id,
        resolvedByName: session.user.name || session.user.email || "Unknown",
        decisionComment: comment,
      },
    });

    return NextResponse.json({ success: true, request: updated });
  } catch (error) {
    console.error("PATCH /api/approval-center/pending error:", error);
    return NextResponse.json({ error: "Failed to update approval request" }, { status: 500 });
  }
}
