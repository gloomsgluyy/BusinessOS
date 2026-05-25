import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canReadModuleForRole, canWriteModuleForRole } from "@/lib/role-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ISSUE_STATUSES = new Set(["open", "monitoring", "resolved", "closed", "not_required"]);

let issueTableReady = false;

async function ensureIssueTable() {
  if (issueTableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ShipmentIssueLog" (
      "id" TEXT NOT NULL,
      "shipmentId" TEXT NOT NULL,
      "category" TEXT NOT NULL,
      "impact" TEXT,
      "action" TEXT,
      "pic" TEXT,
      "targetDate" TIMESTAMP(3),
      "status" TEXT NOT NULL DEFAULT 'open',
      "evidence" TEXT,
      "notes" TEXT,
      "createdBy" TEXT,
      "createdByName" TEXT,
      "resolvedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "isDeleted" BOOLEAN NOT NULL DEFAULT false,
      CONSTRAINT "ShipmentIssueLog_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ShipmentIssueLog_shipmentId_idx" ON "ShipmentIssueLog"("shipmentId");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ShipmentIssueLog_shipmentId_status_idx" ON "ShipmentIssueLog"("shipmentId", "status");`);
  issueTableReady = true;
}

function cleanText(value: unknown, fallback = "") {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function parseDate(value: unknown) {
  const text = cleanText(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function canRead(role: unknown) {
  return canReadModuleForRole(role, "OPERATIONS_TRAFFIC") || canReadModuleForRole(role, "PL_SALES");
}

function canWrite(role: unknown) {
  return canWriteModuleForRole(role, "OPERATIONS_TRAFFIC") || canWriteModuleForRole(role, "PL_SALES");
}

function issueSelect() {
  return {
    id: true,
    shipmentId: true,
    category: true,
    impact: true,
    action: true,
    pic: true,
    targetDate: true,
    status: true,
    evidence: true,
    notes: true,
    createdBy: true,
    createdByName: true,
    resolvedAt: true,
    createdAt: true,
    updatedAt: true,
  };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canRead(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await ensureIssueTable();
  const issues = await prisma.shipmentIssueLog.findMany({
    where: { shipmentId: params.id, isDeleted: false },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: issueSelect(),
  });
  return NextResponse.json({ success: true, issues }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canWrite(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await ensureIssueTable();
  const shipment = await prisma.shipmentDetail.findUnique({ where: { id: params.id }, select: { id: true, isDeleted: true } });
  if (!shipment || shipment.isDeleted) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

  const data = await req.json();
  const status = cleanText(data.status, "open").toLowerCase();
  if (!ISSUE_STATUSES.has(status)) return NextResponse.json({ error: "Invalid issue status" }, { status: 400 });

  const issue = await prisma.shipmentIssueLog.create({
    data: {
      shipmentId: params.id,
      category: cleanText(data.category, "Operational Issue"),
      impact: cleanText(data.impact) || null,
      action: cleanText(data.action) || null,
      pic: cleanText(data.pic) || null,
      targetDate: parseDate(data.targetDate),
      status,
      evidence: cleanText(data.evidence) || null,
      notes: cleanText(data.notes) || null,
      createdBy: session.user.id,
      createdByName: session.user.name || session.user.email || null,
      resolvedAt: ["resolved", "closed", "not_required"].includes(status) ? new Date() : null,
    },
    select: issueSelect(),
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      userName: session.user.name || "Unknown",
      action: "SHIPMENT_ISSUE_CREATE",
      entity: "ShipmentIssueLog",
      entityId: issue.id,
      details: JSON.stringify({ shipmentId: params.id, category: issue.category, status: issue.status }),
    },
  }).catch(() => null);

  return NextResponse.json({ success: true, issue }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canWrite(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await ensureIssueTable();
  const data = await req.json();
  const issueId = cleanText(data.id);
  if (!issueId) return NextResponse.json({ error: "Issue ID missing" }, { status: 400 });

  const existing = await prisma.shipmentIssueLog.findFirst({
    where: { id: issueId, shipmentId: params.id, isDeleted: false },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Issue not found" }, { status: 404 });

  const status = data.status !== undefined ? cleanText(data.status, "open").toLowerCase() : undefined;
  if (status && !ISSUE_STATUSES.has(status)) return NextResponse.json({ error: "Invalid issue status" }, { status: 400 });

  const issue = await prisma.shipmentIssueLog.update({
    where: { id: issueId },
    data: {
      category: data.category !== undefined ? cleanText(data.category, "Operational Issue") : undefined,
      impact: data.impact !== undefined ? (cleanText(data.impact) || null) : undefined,
      action: data.action !== undefined ? (cleanText(data.action) || null) : undefined,
      pic: data.pic !== undefined ? (cleanText(data.pic) || null) : undefined,
      targetDate: data.targetDate !== undefined ? parseDate(data.targetDate) : undefined,
      status,
      evidence: data.evidence !== undefined ? (cleanText(data.evidence) || null) : undefined,
      notes: data.notes !== undefined ? (cleanText(data.notes) || null) : undefined,
      resolvedAt: status && ["resolved", "closed", "not_required"].includes(status) ? new Date() : undefined,
      updatedAt: new Date(),
    },
    select: issueSelect(),
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      userName: session.user.name || "Unknown",
      action: "SHIPMENT_ISSUE_UPDATE",
      entity: "ShipmentIssueLog",
      entityId: issue.id,
      details: JSON.stringify({ shipmentId: params.id, category: issue.category, status: issue.status }),
    },
  }).catch(() => null);

  return NextResponse.json({ success: true, issue }, { headers: { "Cache-Control": "no-store" } });
}
