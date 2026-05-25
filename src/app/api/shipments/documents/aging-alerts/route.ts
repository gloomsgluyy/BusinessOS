import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canReadModuleForRole, isExecutiveRole } from "@/lib/role-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const RECEIVED_AGING_THRESHOLD_DAYS = 3;
const SUBMITTED_AGING_THRESHOLD_DAYS = 3;

let checklistTableReady = false;

async function ensureChecklistTable() {
  if (checklistTableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ShipmentDocumentChecklistItem" (
      "id" TEXT NOT NULL,
      "shipmentId" TEXT NOT NULL,
      "documentGroup" TEXT NOT NULL DEFAULT 'required',
      "requirementCode" TEXT,
      "requirementLabel" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "required" BOOLEAN NOT NULL DEFAULT true,
      "ownerRole" TEXT,
      "responsibleParty" TEXT,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "expectedDate" TIMESTAMP(3),
      "receivedDate" TIMESTAMP(3),
      "submittedDate" TIMESTAMP(3),
      "submittedTo" TEXT,
      "hardcopyStatus" TEXT,
      "notes" TEXT,
      "createdBy" TEXT,
      "createdByName" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      CONSTRAINT "ShipmentDocumentChecklistItem_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ShipmentDocumentChecklistItem_shipmentId_idx" ON "ShipmentDocumentChecklistItem"("shipmentId");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ShipmentDocumentChecklistItem_shipmentId_documentGroup_idx" ON "ShipmentDocumentChecklistItem"("shipmentId", "documentGroup");`);
  checklistTableReady = true;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function daysSince(value?: Date | null) {
  if (!value) return null;
  const base = new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  return Math.floor((startOfToday().getTime() - base) / 86400000);
}

function buildAlert(item: any, shipment: any) {
  const status = String(item.status || "pending").toLowerCase();
  const completedStatuses = new Set(["completed", "not_required", "superseded"]);
  if (completedStatuses.has(status)) return null;

  let severity: "critical" | "warning" | "info" = "info";
  let agingDays = 0;
  let message = "Needs document follow-up";

  if (status === "pending") {
    const days = daysSince(item.expectedDate);
    if (days === null) return null;
    if (days < 0) return null;
    agingDays = days;
    severity = days >= 3 ? "critical" : "warning";
    message = days === 0 ? "Due today" : `Overdue ${days} day${days === 1 ? "" : "s"}`;
  } else if (status === "received") {
    const days = daysSince(item.receivedDate);
    if (days === null || days <= RECEIVED_AGING_THRESHOLD_DAYS) return null;
    agingDays = days;
    severity = "warning";
    message = `Received ${days} days, not submitted`;
  } else if (status === "submitted") {
    const days = daysSince(item.submittedDate);
    if (days === null || days <= SUBMITTED_AGING_THRESHOLD_DAYS) return null;
    agingDays = days;
    severity = "warning";
    message = `Submitted ${days} days, not completed`;
  } else if (status === "rejected") {
    agingDays = daysSince(item.updatedAt) || 0;
    severity = "critical";
    message = "Rejected, replacement required";
  }

  return {
    id: item.id,
    shipmentId: item.shipmentId,
    shipmentName: shipment?.mvProjectName || shipment?.vesselName || shipment?.nomination || shipment?.bargeName || item.shipmentId,
    buyer: shipment?.buyer || null,
    documentGroup: item.documentGroup,
    requirementCode: item.requirementCode,
    requirementLabel: item.requirementLabel || item.title,
    status,
    ownerRole: item.ownerRole,
    responsibleParty: item.responsibleParty,
    hardcopyStatus: item.hardcopyStatus,
    expectedDate: item.expectedDate,
    receivedDate: item.receivedDate,
    submittedDate: item.submittedDate,
    agingDays,
    severity,
    message,
  };
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isExecutiveRole(session.user.role) && !canReadModuleForRole(session.user.role, "OPERATIONS_TRAFFIC")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ensureChecklistTable();

  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 12), 1), 50);

  const items = await prisma.shipmentDocumentChecklistItem.findMany({
    where: {
      isDeleted: false,
      required: true,
      status: { notIn: ["completed", "not_required", "superseded"] },
    },
    orderBy: [{ expectedDate: "asc" }, { updatedAt: "asc" }],
    take: 200,
  });

  const shipmentIds = Array.from(new Set(items.map((item) => item.shipmentId)));
  const shipments = shipmentIds.length
    ? await prisma.shipmentDetail.findMany({
      where: { id: { in: shipmentIds }, isDeleted: false },
      select: {
        id: true,
        mvProjectName: true,
        vesselName: true,
        nomination: true,
        bargeName: true,
        buyer: true,
        status: true,
      },
    })
    : [];
  const shipmentById = new Map(shipments.map((shipment) => [shipment.id, shipment]));

  const alerts = items
    .map((item) => buildAlert(item, shipmentById.get(item.shipmentId)))
    .filter(Boolean)
    .sort((a: any, b: any) => {
      const severityRank = { critical: 0, warning: 1, info: 2 };
      const bySeverity = severityRank[a.severity as keyof typeof severityRank] - severityRank[b.severity as keyof typeof severityRank];
      if (bySeverity !== 0) return bySeverity;
      return (b.agingDays || 0) - (a.agingDays || 0);
    })
    .slice(0, limit);

  return NextResponse.json({
    success: true,
    alerts,
    summary: {
      total: alerts.length,
      critical: alerts.filter((alert: any) => alert.severity === "critical").length,
      warning: alerts.filter((alert: any) => alert.severity === "warning").length,
    },
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
