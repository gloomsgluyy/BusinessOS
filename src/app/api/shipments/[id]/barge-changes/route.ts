import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canReadModuleForRole, canWriteModuleForRole, isExecutiveRole } from "@/lib/role-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

let bargeChangeTableReady = false;

async function ensureBargeChangeTable() {
  if (bargeChangeTableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ShipmentBargeChangeLog" (
      "id" TEXT NOT NULL,
      "shipmentId" TEXT NOT NULL,
      "oldMv" TEXT,
      "oldTb" TEXT,
      "oldBg" TEXT,
      "oldNomination" TEXT,
      "newMv" TEXT,
      "newTb" TEXT,
      "newBg" TEXT,
      "newNomination" TEXT,
      "reason" TEXT NOT NULL,
      "evidence" TEXT,
      "impact" TEXT,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "version" INTEGER NOT NULL DEFAULT 1,
      "active" BOOLEAN NOT NULL DEFAULT false,
      "requestedBy" TEXT,
      "requestedByName" TEXT,
      "approvedBy" TEXT,
      "approvedByName" TEXT,
      "approvedAt" TIMESTAMP(3),
      "approvalComment" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      CONSTRAINT "ShipmentBargeChangeLog_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ShipmentBargeChangeLog_shipmentId_idx" ON "ShipmentBargeChangeLog"("shipmentId");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ShipmentBargeChangeLog_shipmentId_status_idx" ON "ShipmentBargeChangeLog"("shipmentId", "status");`);
  bargeChangeTableReady = true;
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

function canRead(role: unknown) {
  return canReadModuleForRole(role, "OPERATIONS_TRAFFIC") || canReadModuleForRole(role, "PL_SALES");
}

function canRequest(role: unknown) {
  return canWriteModuleForRole(role, "OPERATIONS_TRAFFIC") || canWriteModuleForRole(role, "PL_SALES");
}

function changeSelect() {
  return {
    id: true,
    shipmentId: true,
    oldMv: true,
    oldTb: true,
    oldBg: true,
    oldNomination: true,
    newMv: true,
    newTb: true,
    newBg: true,
    newNomination: true,
    reason: true,
    evidence: true,
    impact: true,
    status: true,
    version: true,
    active: true,
    requestedBy: true,
    requestedByName: true,
    approvedBy: true,
    approvedByName: true,
    approvedAt: true,
    approvalComment: true,
    createdAt: true,
    updatedAt: true,
  };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canRead(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await ensureBargeChangeTable();
  const changes = await prisma.shipmentBargeChangeLog.findMany({
    where: { shipmentId: params.id, isDeleted: false },
    orderBy: [{ version: "desc" }, { createdAt: "desc" }],
    select: changeSelect(),
  });
  return NextResponse.json({ success: true, changes }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canRequest(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await ensureBargeChangeTable();
  const data = await req.json();
  const reason = cleanText(data.reason);
  const newMv = cleanText(data.newMv || data.new_mv);
  const newTb = cleanText(data.newTb || data.new_tb);
  const newBg = cleanText(data.newBg || data.new_bg);
  const newNomination = cleanText(data.newNomination || data.new_nomination);
  if (!reason) return NextResponse.json({ error: "Reason is required" }, { status: 400 });
  if (!newMv && !newTb && !newBg && !newNomination) {
    return NextResponse.json({ error: "At least one new MV/TB/BG/Nomination value is required" }, { status: 400 });
  }

  const shipment = await prisma.shipmentDetail.findUnique({
    where: { id: params.id },
    select: { id: true, vesselName: true, bargeName: true, nomination: true, mvProjectName: true, isDeleted: true },
  });
  if (!shipment || shipment.isDeleted) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

  const latest = await prisma.shipmentBargeChangeLog.findFirst({
    where: { shipmentId: params.id, isDeleted: false },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const change = await prisma.shipmentBargeChangeLog.create({
    data: {
      shipmentId: params.id,
      oldMv: shipment.vesselName || shipment.mvProjectName || null,
      oldTb: shipment.bargeName || null,
      oldBg: null,
      oldNomination: shipment.nomination || null,
      newMv: newMv || null,
      newTb: newTb || null,
      newBg: newBg || null,
      newNomination: newNomination || null,
      reason,
      evidence: cleanText(data.evidence) || null,
      impact: cleanText(data.impact) || null,
      version: (latest?.version || 0) + 1,
      requestedBy: session.user.id,
      requestedByName: session.user.name || session.user.email || null,
    },
    select: changeSelect(),
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      userName: session.user.name || "Unknown",
      action: "SHIPMENT_BARGE_CHANGE_REQUEST",
      entity: "ShipmentBargeChangeLog",
      entityId: change.id,
      details: auditDetails({
        actionType: "request",
        reason: change.reason,
        evidence: change.evidence,
        changes: [
          { field: "vesselName", oldValue: change.oldMv, newValue: change.newMv },
          { field: "bargeName", oldValue: change.oldTb || change.oldBg, newValue: change.newTb || change.newBg },
          { field: "nomination", oldValue: change.oldNomination, newValue: change.newNomination },
        ].filter((item) => item.newValue !== null && item.newValue !== undefined && item.newValue !== ""),
        context: { shipmentId: params.id, version: change.version, impact: change.impact, status: change.status },
      }),
    },
  }).catch(() => null);

  return NextResponse.json({ success: true, change }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isExecutiveRole(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await ensureBargeChangeTable();
  const data = await req.json();
  const id = cleanText(data.id);
  const action = cleanText(data.action).toLowerCase();
  if (!id) return NextResponse.json({ error: "Barge change ID is required" }, { status: 400 });
  if (!["approve", "reject", "cancel"].includes(action)) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const existing = await prisma.shipmentBargeChangeLog.findFirst({
    where: { id, shipmentId: params.id, isDeleted: false },
  });
  if (!existing) return NextResponse.json({ error: "Barge change not found" }, { status: 404 });
  if (existing.status !== "pending") return NextResponse.json({ error: "Barge change is already decided" }, { status: 409 });

  const status = action === "approve" ? "approved" : action === "reject" ? "rejected" : "cancelled";
  const comment = cleanText(data.comment || data.approvalComment);
  const change = await prisma.$transaction(async (tx) => {
    if (status === "approved") {
      await tx.shipmentBargeChangeLog.updateMany({
        where: { shipmentId: params.id, isDeleted: false, active: true },
        data: { active: false },
      });
      await tx.shipmentDetail.update({
        where: { id: params.id },
        data: {
          vesselName: existing.newMv || undefined,
          mvProjectName: existing.newMv || undefined,
          bargeName: existing.newTb || existing.newBg || undefined,
          nomination: existing.newNomination || undefined,
          updatedAt: new Date(),
        },
      });
    }
    return tx.shipmentBargeChangeLog.update({
      where: { id },
      data: {
        status,
        active: status === "approved",
        approvedBy: session.user.id,
        approvedByName: session.user.name || session.user.email || null,
        approvedAt: new Date(),
        approvalComment: comment || null,
        updatedAt: new Date(),
      },
      select: changeSelect(),
    });
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      userName: session.user.name || "Unknown",
      action: status === "approved" ? "SHIPMENT_BARGE_CHANGE_APPROVE" : "SHIPMENT_BARGE_CHANGE_REJECT",
      entity: "ShipmentBargeChangeLog",
      entityId: change.id,
      details: auditDetails({
        actionType: status,
        reason: comment || change.reason,
        evidence: change.evidence,
        changes: [
          { field: "status", oldValue: existing.status, newValue: status },
          ...(status === "approved"
            ? [
              { field: "vesselName", oldValue: existing.oldMv, newValue: existing.newMv },
              { field: "bargeName", oldValue: existing.oldTb || existing.oldBg, newValue: existing.newTb || existing.newBg },
              { field: "nomination", oldValue: existing.oldNomination, newValue: existing.newNomination },
            ].filter((item) => item.newValue !== null && item.newValue !== undefined && item.newValue !== "")
            : []),
        ],
        context: { shipmentId: params.id, version: change.version, impact: change.impact, approvalComment: comment },
      }),
    },
  }).catch(() => null);

  return NextResponse.json({ success: true, change }, { headers: { "Cache-Control": "no-store" } });
}
