import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isExecutiveRole } from "@/lib/role-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Severity = "critical" | "warning" | "info";
type BlockerCategory = "payment" | "quality" | "source" | "barge" | "closing" | "domestic";

type BlockerAlert = {
  id: string;
  category: BlockerCategory;
  severity: Severity;
  shipmentId?: string | null;
  shipmentName?: string | null;
  title: string;
  message: string;
  owner?: string | null;
  dueDate?: string | null;
  href: string;
  createdAt?: string | null;
};

function normalize(value: unknown) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, " ");
}

function statusIsOneOf(value: unknown, allowed: string[]) {
  const status = normalize(value);
  return allowed.some((item) => status.includes(item));
}

function activeShipmentName(shipment: any) {
  return shipment?.mvProjectName || shipment?.vesselName || shipment?.bargeName || shipment?.nomination || shipment?.id || "Shipment";
}

function isActiveShipment(shipment: any) {
  return !statusIsOneOf(shipment.status || shipment.shipmentStatus, ["COMPLETED", "DONE", "CANCELLED", "CANCELED"]);
}

function daysSince(value: Date | null | undefined, now = new Date()) {
  if (!value) return 0;
  const start = new Date(value).setHours(0, 0, 0, 0);
  const end = new Date(now).setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((end - start) / 86400000));
}

function domesticName(row: any) {
  return row.project || row.mvBargeNomination || row.buyer || row.id || "Domestic delivery";
}

function domesticHref(row: any, section?: string) {
  const params = new URLSearchParams({
    main: "daily",
    daily: String(row.id),
    dailyTab: "handover",
  });
  if (section) params.set("section", section.toLowerCase().replace(/[^a-z0-9]+/g, "_"));
  return `/shipment-monitor?${params.toString()}`;
}

function getDomesticHandoverBlockers(row: any, now = new Date()) {
  const tracks = [
    {
      label: "SKAB-SK",
      done: row.skabFinanceReceivedAt,
      last: row.skabTrafficSentFinanceAt || row.skabTrafficReceivedAt || row.skabOperationSentAt || row.skabOperationReceivedAt || row.skabSupplierSentAt,
      stuckAt: row.skabTrafficSentFinanceAt ? "Finance" : row.skabTrafficReceivedAt ? "Traffic" : row.skabOperationReceivedAt || row.skabSupplierSentAt ? "Operation" : "Supplier",
    },
    {
      label: "DSR Carbon",
      done: row.dsrTrafficReceivedAt,
      last: row.dsrOperationSentAt || row.dsrOperationReceivedAt || row.dsrSupplierSentAt,
      stuckAt: row.dsrOperationSentAt ? "Traffic" : row.dsrOperationReceivedAt || row.dsrSupplierSentAt ? "Operation" : "Supplier",
    },
    {
      label: "BL/CM",
      done: row.blCmFinanceReceivedAt,
      last: row.blCmTrafficSentFinanceAt || row.blCmTrafficReceivedAt || row.blCmOperationSentAt || row.blDate,
      stuckAt: row.blCmTrafficSentFinanceAt ? "Finance" : row.blCmTrafficReceivedAt ? "Traffic" : row.blCmOperationSentAt || row.blDate ? "Traffic" : "Operation",
    },
    {
      label: "COA POL",
      done: row.coaPolFinanceReceivedAt,
      last: row.coaPolTrafficReceivedAt || row.coaPolSurveyorSentAt || row.coaPolDate,
      stuckAt: row.coaPolTrafficReceivedAt ? "Finance" : row.coaPolSurveyorSentAt || row.coaPolDate ? "Traffic" : "Surveyor",
    },
    {
      label: "COA POD / Final Docs",
      done: row.vendorPaidAt || row.vendorReceivedFullSetAt,
      last: row.approvalDtAt || row.vendorReceivedFullSetAt || row.financeSubmitFullSetAt || row.coaPodReceivedAt,
      stuckAt: row.approvalDtAt ? "Vendor payment" : row.vendorReceivedFullSetAt ? "Approval DT" : row.financeSubmitFullSetAt ? "Vendor" : row.coaPodReceivedAt ? "Finance" : "Quality/Traffic",
    },
  ];

  return tracks
    .filter((track) => !track.done)
    .map((track) => ({
      ...track,
      agingDays: track.last ? daysSince(track.last, now) : daysSince(row.updatedAt, now),
    }))
    .filter((track) => track.last || track.agingDays >= 2);
}

async function ensureBlockerColumns() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "OutstandingPayment" ADD COLUMN IF NOT EXISTS "shipmentId" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "OutstandingPayment" ADD COLUMN IF NOT EXISTS "shipmentName" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "OutstandingPayment" ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "OutstandingPayment" ADD COLUMN IF NOT EXISTS "invoiceDocumentId" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "OutstandingPayment" ADD COLUMN IF NOT EXISTS "paymentProofDocumentId" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "OutstandingPayment" ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3);`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "OutstandingPayment" ADD COLUMN IF NOT EXISTS "disputeStatus" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "QualityResult" ADD COLUMN IF NOT EXISTS "comparisonStatus" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "QualityResult" ADD COLUMN IF NOT EXISTS "warningNotes" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "QualityResult" ADD COLUMN IF NOT EXISTS "coaPolDocumentId" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "QualityResult" ADD COLUMN IF NOT EXISTS "coaPodDocumentId" TEXT;`);
  const domesticDateColumns = [
    "skabSupplierSentAt", "skabOperationReceivedAt", "skabOperationSentAt", "skabTrafficReceivedAt", "skabTrafficSentFinanceAt", "skabFinanceReceivedAt",
    "dsrSupplierSentAt", "dsrOperationReceivedAt", "dsrOperationSentAt", "dsrTrafficReceivedAt",
    "blCmOperationSentAt", "blCmTrafficReceivedAt", "blCmTrafficSentFinanceAt", "blCmFinanceReceivedAt",
    "coaPolDate", "coaPolSurveyorSentAt", "coaPolTrafficReceivedAt", "coaPolFinanceReceivedAt",
    "coaPodReceivedAt", "financeSubmitFullSetAt", "vendorReceivedFullSetAt", "approvalDtAt", "vendorPaidAt",
  ];
  const domesticTextColumns = [
    "fullSetDocumentStatus", "hardcopyStatus", "softcopyStatus",
  ];
  for (const col of domesticDateColumns) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "DailyDelivery" ADD COLUMN IF NOT EXISTS "${col}" TIMESTAMP(3);`);
  }
  for (const col of domesticTextColumns) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "DailyDelivery" ADD COLUMN IF NOT EXISTS "${col}" TEXT;`);
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isExecutiveRole(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await ensureBlockerColumns();

    const now = new Date();
    const [
      shipments,
      payments,
      qualityResults,
      sourceChanges,
      bargeChanges,
      domesticDeliveries,
    ] = await Promise.all([
      prisma.shipmentDetail.findMany({
        where: { isDeleted: false },
        orderBy: { updatedAt: "desc" },
        take: 400,
        select: {
          id: true,
          mvProjectName: true,
          vesselName: true,
          bargeName: true,
          nomination: true,
          buyer: true,
          status: true,
          shipmentStatus: true,
          paymentStatus: true,
          qualityStatus: true,
          issueStatus: true,
          noInvoiceMkls: true,
          coaDate: true,
          resultGar: true,
          updatedAt: true,
        },
      }),
      prisma.outstandingPayment.findMany({
        where: { isDeleted: false, shipmentId: { not: null } },
        orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
        take: 200,
        select: {
          id: true,
          shipmentId: true,
          shipmentName: true,
          invoiceNumber: true,
          invoiceDocumentId: true,
          paymentProofDocumentId: true,
          perusahaan: true,
          status: true,
          disputeStatus: true,
          dueDate: true,
          updatedAt: true,
        },
      }),
      prisma.qualityResult.findMany({
        where: { isDeleted: false },
        orderBy: { updatedAt: "desc" },
        take: 200,
        select: {
          id: true,
          cargoId: true,
          cargoName: true,
          status: true,
          comparisonStatus: true,
          warningNotes: true,
          coaPolDocumentId: true,
          coaPodDocumentId: true,
          reviewedByName: true,
          updatedAt: true,
        },
      }),
      prisma.shipmentSourceChangeRequest.findMany({
        where: { isDeleted: false, status: "pending" },
        orderBy: { updatedAt: "desc" },
        take: 50,
        select: {
          id: true,
          shipmentId: true,
          oldSource: true,
          newSource: true,
          requestedByName: true,
          updatedAt: true,
          version: true,
        },
      }),
      prisma.shipmentBargeChangeLog.findMany({
        where: { isDeleted: false, status: "pending" },
        orderBy: { updatedAt: "desc" },
        take: 50,
        select: {
          id: true,
          shipmentId: true,
          newMv: true,
          newTb: true,
          newBg: true,
          newNomination: true,
          requestedByName: true,
          updatedAt: true,
          version: true,
        },
      }),
      prisma.dailyDelivery.findMany({
        where: {
          isDeleted: false,
          reportType: { in: ["domestic", "DOMESTIC", "Domestic"] },
        },
        orderBy: { updatedAt: "desc" },
        take: 150,
        select: {
          id: true,
          reportType: true,
          buyer: true,
          project: true,
          mvBargeNomination: true,
          supplier: true,
          blDate: true,
          fullSetDocumentStatus: true,
          hardcopyStatus: true,
          softcopyStatus: true,
          skabSupplierSentAt: true,
          skabOperationReceivedAt: true,
          skabOperationSentAt: true,
          skabTrafficReceivedAt: true,
          skabTrafficSentFinanceAt: true,
          skabFinanceReceivedAt: true,
          dsrSupplierSentAt: true,
          dsrOperationReceivedAt: true,
          dsrOperationSentAt: true,
          dsrTrafficReceivedAt: true,
          blCmOperationSentAt: true,
          blCmTrafficReceivedAt: true,
          blCmTrafficSentFinanceAt: true,
          blCmFinanceReceivedAt: true,
          coaPolDate: true,
          coaPolSurveyorSentAt: true,
          coaPolTrafficReceivedAt: true,
          coaPolFinanceReceivedAt: true,
          coaPodReceivedAt: true,
          financeSubmitFullSetAt: true,
          vendorReceivedFullSetAt: true,
          approvalDtAt: true,
          vendorPaidAt: true,
          updatedAt: true,
        },
      }),
    ]);

    const shipmentById = new Map(shipments.map((shipment) => [shipment.id, shipment]));
    const alerts: BlockerAlert[] = [];

    for (const payment of payments) {
      const isPaid = statusIsOneOf(payment.status, ["PAID", "SETTLED", "COMPLETED", "COMPLETE", "NOT_REQUIRED"]);
      const overdue = payment.dueDate ? payment.dueDate.getTime() < now.getTime() && !isPaid : false;
      const missingInvoice = !payment.invoiceNumber || !payment.invoiceDocumentId;
      const missingProof = isPaid && !payment.paymentProofDocumentId;
      const disputed = Boolean(payment.disputeStatus && !statusIsOneOf(payment.disputeStatus, ["NONE", "NO", "CLEAR", "CLEARED"]));
      if (!overdue && !missingInvoice && !missingProof && !disputed && isPaid) continue;

      const title = payment.invoiceNumber || payment.perusahaan || "Linked payment";
      const pieces = [
        !isPaid ? `status ${payment.status || "pending"}` : "",
        overdue ? "overdue" : "",
        missingInvoice ? "invoice evidence incomplete" : "",
        missingProof ? "payment proof missing" : "",
        disputed ? `dispute ${payment.disputeStatus}` : "",
      ].filter(Boolean).join(", ");

      alerts.push({
        id: `payment:${payment.id}`,
        category: "payment",
        severity: overdue || disputed ? "critical" : "warning",
        shipmentId: payment.shipmentId,
        shipmentName: payment.shipmentName || activeShipmentName(shipmentById.get(payment.shipmentId || "")),
        title,
        message: pieces || "Payment needs review.",
        owner: payment.perusahaan,
        dueDate: payment.dueDate?.toISOString() || null,
        href: "/outstanding-payment",
        createdAt: payment.updatedAt.toISOString(),
      });
    }

    for (const quality of qualityResults) {
      const status = quality.comparisonStatus || quality.status;
      const hasCoa = Boolean(quality.coaPolDocumentId || quality.coaPodDocumentId);
      const unresolved = !statusIsOneOf(status, ["PASSED", "APPROVED", "ACCEPTED", "COMPLETED", "COMPLETE", "NOT_REQUIRED"]);
      const missingCoa = statusIsOneOf(status, ["PASSED", "APPROVED", "ACCEPTED", "COMPLETED", "COMPLETE"]) && !hasCoa;
      if (!unresolved && !missingCoa) continue;

      const shipment = shipmentById.get(quality.cargoId);
      alerts.push({
        id: `quality:${quality.id}`,
        category: "quality",
        severity: statusIsOneOf(status, ["REJECTED", "CLAIM"]) ? "critical" : "warning",
        shipmentId: quality.cargoId,
        shipmentName: shipment ? activeShipmentName(shipment) : quality.cargoName,
        title: quality.cargoName || "Quality result",
        message: missingCoa ? "Passed quality has no COA evidence attached." : `${status || "pending"}${quality.warningNotes ? `: ${quality.warningNotes}` : ""}`,
        owner: quality.reviewedByName,
        href: "/quality",
        createdAt: quality.updatedAt.toISOString(),
      });
    }

    for (const change of sourceChanges) {
      alerts.push({
        id: `source:${change.id}`,
        category: "source",
        severity: "warning",
        shipmentId: change.shipmentId,
        shipmentName: activeShipmentName(shipmentById.get(change.shipmentId)),
        title: `Source Change v${change.version}`,
        message: `${change.oldSource || "-"} -> ${change.newSource} is pending approval.`,
        owner: change.requestedByName,
        href: `/shipment-monitor?open=${encodeURIComponent(change.shipmentId)}&tab=all`,
        createdAt: change.updatedAt.toISOString(),
      });
    }

    for (const change of bargeChanges) {
      const target = [change.newMv, change.newTb, change.newBg, change.newNomination].filter(Boolean).join(" / ") || "barge data";
      alerts.push({
        id: `barge:${change.id}`,
        category: "barge",
        severity: "warning",
        shipmentId: change.shipmentId,
        shipmentName: activeShipmentName(shipmentById.get(change.shipmentId)),
        title: `Barge Change v${change.version}`,
        message: `${target} is pending approval.`,
        owner: change.requestedByName,
        href: `/shipment-monitor?open=${encodeURIComponent(change.shipmentId)}&tab=all`,
        createdAt: change.updatedAt.toISOString(),
      });
    }

    for (const delivery of domesticDeliveries) {
      const blockers = getDomesticHandoverBlockers(delivery, now);
      const statusBlockers = [
        delivery.fullSetDocumentStatus && !statusIsOneOf(delivery.fullSetDocumentStatus, ["COMPLETED", "COMPLETE", "APPROVED", "DONE"]) ? `full set ${delivery.fullSetDocumentStatus}` : "",
        delivery.hardcopyStatus && !statusIsOneOf(delivery.hardcopyStatus, ["RECEIVED", "SUBMITTED", "COMPLETED", "COMPLETE", "DONE"]) ? `hardcopy ${delivery.hardcopyStatus}` : "",
        delivery.softcopyStatus && !statusIsOneOf(delivery.softcopyStatus, ["RECEIVED", "SUBMITTED", "COMPLETED", "COMPLETE", "DONE"]) ? `softcopy ${delivery.softcopyStatus}` : "",
      ].filter(Boolean);
      const topBlocker = blockers.sort((a, b) => b.agingDays - a.agingDays)[0];
      if (!topBlocker && statusBlockers.length === 0) continue;

      alerts.push({
        id: `domestic:${delivery.id}:${topBlocker?.label || "docs"}`,
        category: "domestic",
        severity: (topBlocker?.agingDays || 0) >= 5 || statusBlockers.length >= 2 ? "critical" : "warning",
        shipmentId: null,
        shipmentName: domesticName(delivery),
        title: topBlocker?.label || "Domestic document handover",
        message: topBlocker
          ? `${topBlocker.label} stuck at ${topBlocker.stuckAt}${topBlocker.agingDays ? ` for ${topBlocker.agingDays} day(s)` : ""}. ${statusBlockers.join(", ")}`
          : `Domestic document status needs follow-up: ${statusBlockers.join(", ")}.`,
        owner: topBlocker?.stuckAt || delivery.supplier || delivery.buyer,
        href: domesticHref(delivery, topBlocker?.label || "docs"),
        createdAt: delivery.updatedAt.toISOString(),
      });
    }

    const linkedPaymentByShipment = new Map<string, number>();
    for (const payment of payments) {
      if (!payment.shipmentId) continue;
      const isPaid = statusIsOneOf(payment.status, ["PAID", "SETTLED", "COMPLETED", "COMPLETE", "NOT_REQUIRED"]);
      if (!isPaid || !payment.invoiceDocumentId || (isPaid && !payment.paymentProofDocumentId)) {
        linkedPaymentByShipment.set(payment.shipmentId, (linkedPaymentByShipment.get(payment.shipmentId) || 0) + 1);
      }
    }

    const qualityByShipment = new Map<string, number>();
    for (const quality of qualityResults) {
      const status = quality.comparisonStatus || quality.status;
      const hasCoa = Boolean(quality.coaPolDocumentId || quality.coaPodDocumentId);
      if (!statusIsOneOf(status, ["PASSED", "APPROVED", "ACCEPTED", "COMPLETED", "COMPLETE", "NOT_REQUIRED"]) || !hasCoa) {
        qualityByShipment.set(quality.cargoId, (qualityByShipment.get(quality.cargoId) || 0) + 1);
      }
    }

    for (const shipment of shipments.filter(isActiveShipment).slice(0, 200)) {
      const blockers: string[] = [];
      if (!statusIsOneOf(shipment.paymentStatus, ["PAID", "SETTLED", "COMPLETED", "COMPLETE", "NOT_REQUIRED", "N/A"])) blockers.push("payment status");
      if (!shipment.noInvoiceMkls) blockers.push("invoice number");
      if (!statusIsOneOf(shipment.qualityStatus, ["PASSED", "APPROVED", "ACCEPTED", "COMPLETED", "COMPLETE", "NOT_REQUIRED"])) blockers.push("quality status");
      if (!shipment.coaDate && !shipment.resultGar && (qualityByShipment.get(shipment.id) || 0) > 0) blockers.push("quality evidence");
      if (linkedPaymentByShipment.get(shipment.id)) blockers.push(`${linkedPaymentByShipment.get(shipment.id)} linked payment`);
      if (statusIsOneOf(shipment.issueStatus, ["OPEN", "PENDING", "WAITING", "CLAIM", "DISPUTE"])) blockers.push("open issue");
      if (!blockers.length) continue;

      alerts.push({
        id: `closing:${shipment.id}`,
        category: "closing",
        severity: blockers.length >= 3 ? "critical" : "warning",
        shipmentId: shipment.id,
        shipmentName: activeShipmentName(shipment),
        title: activeShipmentName(shipment),
        message: `Closing blocker: ${blockers.slice(0, 4).join(", ")}.`,
        owner: shipment.buyer,
        href: `/shipment-monitor?open=${encodeURIComponent(shipment.id)}&tab=all`,
        createdAt: shipment.updatedAt.toISOString(),
      });
    }

    const order: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
    const limitedAlerts = alerts
      .sort((a, b) => order[a.severity] - order[b.severity] || String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .slice(0, 30);

    const summary = {
      critical: alerts.filter((alert) => alert.severity === "critical").length,
      warning: alerts.filter((alert) => alert.severity === "warning").length,
      payment: alerts.filter((alert) => alert.category === "payment").length,
      quality: alerts.filter((alert) => alert.category === "quality").length,
      source: alerts.filter((alert) => alert.category === "source").length,
      barge: alerts.filter((alert) => alert.category === "barge").length,
      closing: alerts.filter((alert) => alert.category === "closing").length,
      domestic: alerts.filter((alert) => alert.category === "domestic").length,
    };

    return NextResponse.json({ success: true, summary, alerts: limitedAlerts }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET /api/dashboard/blockers error:", error);
    return NextResponse.json({ error: "Failed to fetch dashboard blockers" }, { status: 500 });
  }
}
