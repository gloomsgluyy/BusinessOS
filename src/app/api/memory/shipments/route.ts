import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { PushService } from "@/lib/push-to-sheets";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/pagination";

export const dynamic = "force-dynamic";

const DEFAULT_REQUIRED_DOCUMENTS = [
    { code: "a", label: "COPY OF LAPORAN HASIL VERIFIKASI" },
    { code: "b", label: "1 ORIGINAL DRAUGHT SURVEY REPORT" },
    { code: "c", label: "1 ORIGINAL SURAT KETERANGAN ASAL BARANG" },
    { code: "d", label: "1 ORIGINAL SURAT KEBENARAN DOKUMEN" },
    { code: "e", label: "1 ORIGINAL SURAT KIRIM BARANG" },
    { code: "f", label: "1 ORIGINAL BUKTI BAYAR ROYALTI" },
    { code: "g", label: "3/3 ORIGINAL BILL OF LADING ISSUED BY LOADPORT AGENT" },
    { code: "h", label: "3/3 COPIES NON NEGOTIABLE BILL OF LADING ISSUED BY LOADPORT AGENT" },
    { code: "i", label: "1 ORIGINAL AND 4 COPIES OF CERTIFICATE OF SAMPLING AND ANALYSIS ISSUED BY INDEPENDENT SURVEYOR AT LOADING PORT (IF ANY)" },
    { code: "j", label: "1 ORIGINAL AND 4 COPIES OF CERTIFICATE OF WEIGHT ISSUED BY INDEPENDENT SURVEYOR AT LOADING PORT (IF ANY)" },
    { code: "k", label: "1 ORIGINAL AND 2 COPIES OF CERTIFICATE OF DRAUGHT SURVEY REPORT BY INDEPENDENT SURVEYOR AT LOADING PORT" },
];

async function triggerPush() {
    PushService.debouncedPush("shipmentDetail").catch(err => console.error("Optional Sheet push failed:", err));
}

async function ensureShipmentDetailExtendedColumns() {
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "buyingPrice" DOUBLE PRECISION;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "forecastSalesId" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "forecastSalesName" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "fcoNumber" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "commercialMomDocumentId" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "commercialPoDocumentId" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "sourceConfirmationStatus" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "sourceConfirmationDocumentId" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "sourceConfirmationNotes" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "sourceConfirmedBy" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "sourceConfirmedByName" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "sourceConfirmedAt" TIMESTAMP(3);`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "sourceLegalReadinessStatus" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "sourceCargoReadinessStatus" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "paymentDueDate" TIMESTAMP(3);`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "paymentFinanceCost" DOUBLE PRECISION;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "qualityStatus" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "issueStatus" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "siTo" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "siShipper" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "consignee" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "consigneeAddress" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "notifyParty" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "notifyPartyAddress" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "siMarked" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "quantityTolerance" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "royaltyCost" DOUBLE PRECISION;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "taxExportCost" DOUBLE PRECISION;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShipmentDetail" ADD COLUMN IF NOT EXISTS "surveyCost" DOUBLE PRECISION;`);
}

async function ensureShipmentDocumentChecklistTable() {
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
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "ShipmentDocumentChecklistItem_required_code_uidx" ON "ShipmentDocumentChecklistItem"("shipmentId", "documentGroup", "requirementCode") WHERE "requirementCode" IS NOT NULL;`);
}

async function ensureShippingInstructionTable() {
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
}

async function ensureShipmentIssueTable() {
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
}

async function ensureShipmentSourceChangeTable() {
    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ShipmentSourceChangeRequest" (
          "id" TEXT NOT NULL,
          "shipmentId" TEXT NOT NULL,
          "oldSource" TEXT,
          "newSource" TEXT NOT NULL,
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
          CONSTRAINT "ShipmentSourceChangeRequest_pkey" PRIMARY KEY ("id")
        );
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ShipmentSourceChangeRequest_shipmentId_idx" ON "ShipmentSourceChangeRequest"("shipmentId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ShipmentSourceChangeRequest_shipmentId_status_idx" ON "ShipmentSourceChangeRequest"("shipmentId", "status");`);
}

async function ensureShipmentBargeChangeTable() {
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
}

async function ensureDefaultRequiredDocumentChecklist(shipmentId: string) {
    await ensureShipmentDocumentChecklistTable();
    await prisma.shipmentDocumentChecklistItem.createMany({
        data: DEFAULT_REQUIRED_DOCUMENTS.map((item) => ({
            shipmentId,
            documentGroup: "required",
            requirementCode: item.code,
            requirementLabel: item.label,
            title: item.label,
            required: true,
            ownerRole: "Traffic",
            status: "pending",
        })),
        skipDuplicates: true,
    });
}

function isClosingStatus(value: unknown): boolean {
    const status = normalizeKey(value);
    return status.includes("COMPLETED") || status.includes("DONE_SHIPMENT") || status.includes("DONE") || status.includes("CLOSED") || status.includes("DISCHARGED");
}

async function validateDocumentClosingReadiness(shipmentId: string) {
    await ensureDefaultRequiredDocumentChecklist(shipmentId);
    const checklist = await prisma.shipmentDocumentChecklistItem.findMany({
        where: { shipmentId, documentGroup: "required", required: true, isDeleted: false },
        select: { requirementCode: true, requirementLabel: true, status: true },
        orderBy: { requirementCode: "asc" },
    });
    const readyStatuses = new Set(["submitted", "completed", "not_required"]);
    const blockers = checklist
        .filter((item) => !readyStatuses.has(String(item.status || "pending").toLowerCase()))
        .map((item) => `${item.requirementCode ? `${item.requirementCode}. ` : ""}${item.requirementLabel} (${item.status || "pending"})`);
    return blockers;
}

async function validateSiClosingReadiness(shipmentId: string) {
    await ensureShippingInstructionTable();
    const records = await prisma.shippingInstructionRecord.findMany({
        where: { shipmentId, isDeleted: false },
        select: { siNumber: true, version: true, status: true },
        orderBy: { version: "desc" },
        take: 5,
    });
    const activeReady = records.find((record) => ["approved", "generated"].includes(String(record.status || "").toLowerCase()));
    if (activeReady) return [];
    if (records.length === 0) return ["Shipping Instruction has not been recorded."];
    const latest = records[0];
    return [`Latest SI ${latest.siNumber} v${latest.version} is ${latest.status || "unknown"}.`];
}

function closingValue(data: any, camel: string, snake: string, fallback: any) {
    if (data?.[camel] !== undefined) return data[camel];
    if (data?.[snake] !== undefined) return data[snake];
    return fallback;
}

function statusIsOneOf(value: unknown, allowed: string[]) {
    const status = normalizeKey(value);
    return allowed.some((item) => status.includes(item));
}

function validateCommercialClosingReadiness(shipment: any, data: any = {}) {
    const blockers: string[] = [];
    const paymentStatus = closingValue(data, "paymentStatus", "payment_status", shipment.paymentStatus);
    const noInvoice = closingValue(data, "noInvoiceMkls", "no_invoice_mkls", shipment.noInvoiceMkls);
    const salesPrice = parseNum(closingValue(data, "salesPrice", "sales_price", shipment.salesPrice));
    const buyingPrice = parseNum(closingValue(data, "buyingPrice", "buying_price", shipment.buyingPrice));
    const quantity = parseNum(closingValue(data, "quantityLoaded", "quantity_loaded", shipment.quantityLoaded)) ??
        parseNum(closingValue(data, "qtyPlan", "qty_plan", shipment.qtyPlan));

    if (!statusIsOneOf(paymentStatus, ["PAID", "SETTLED", "COMPLETED", "COMPLETE", "NOT_REQUIRED", "N/A"])) {
        blockers.push(`Payment: status must be paid/settled/not required (current: ${paymentStatus || "empty"}).`);
    }
    if (!cleanText(noInvoice)) blockers.push("Payment: invoice number is missing.");
    if (!quantity || quantity <= 0) blockers.push("Commercial: final/loaded quantity is missing.");
    if (!salesPrice || salesPrice <= 0) blockers.push("Commercial: sales price is missing.");
    if (!buyingPrice || buyingPrice <= 0) blockers.push("Commercial: buying price is missing.");
    return blockers;
}

async function validateQualityClosingReadiness(shipment: any, data: any = {}) {
    const blockers: string[] = [];
    const qualityStatus = closingValue(data, "qualityStatus", "quality_status", shipment.qualityStatus);
    const coaDate = closingValue(data, "coaDate", "coa_date", shipment.coaDate);
    const resultGar = parseNum(closingValue(data, "resultGar", "result_gar", shipment.resultGar));

    const linkedQuality = await prisma.qualityResult.findMany({
        where: {
            isDeleted: false,
            OR: [
                { cargoId: shipment.id },
                ...(shipment.shipmentNumber ? [{ cargoId: shipment.shipmentNumber }] : []),
                ...(shipment.vesselName ? [{ cargoName: { contains: shipment.vesselName, mode: "insensitive" as const } }] : []),
                ...(shipment.mvProjectName ? [{ cargoName: { contains: shipment.mvProjectName, mode: "insensitive" as const } }] : []),
                ...(shipment.nomination ? [{ cargoName: { contains: shipment.nomination, mode: "insensitive" as const } }] : []),
            ],
        },
        select: { cargoName: true, status: true, comparisonStatus: true, warningNotes: true, coaPolDocumentId: true, coaPodDocumentId: true },
        take: 5,
    });

    const badQuality = linkedQuality.find((item) => {
        const status = item.comparisonStatus || item.status;
        return !statusIsOneOf(status, ["PASSED", "APPROVED", "ACCEPTED", "COMPLETED", "COMPLETE", "NOT_REQUIRED"]);
    });
    if (badQuality) blockers.push(`Quality: linked result ${badQuality.cargoName || "record"} is ${badQuality.comparisonStatus || badQuality.status || "pending"}${badQuality.warningNotes ? ` (${badQuality.warningNotes})` : ""}.`);
    const passedWithoutCoaDoc = linkedQuality.find((item) =>
        statusIsOneOf(item.comparisonStatus || item.status, ["PASSED", "APPROVED", "ACCEPTED", "COMPLETED", "COMPLETE"]) &&
        !item.coaPolDocumentId &&
        !item.coaPodDocumentId
    );
    if (passedWithoutCoaDoc) blockers.push(`Quality: linked result ${passedWithoutCoaDoc.cargoName || "record"} has no COA document attached.`);
    if (!linkedQuality.length && !statusIsOneOf(qualityStatus, ["PASSED", "APPROVED", "ACCEPTED", "COMPLETED", "COMPLETE", "NOT_REQUIRED"])) {
        blockers.push(`Quality: status must be passed/approved/not required (current: ${qualityStatus || "empty"}).`);
    }
    if (!coaDate && !resultGar && !linkedQuality.length && !statusIsOneOf(qualityStatus, ["NOT_REQUIRED", "N/A"])) {
        blockers.push("Quality: COA date, GAR result, or linked quality result is required.");
    }
    return blockers;
}

function validateIssueClosingReadiness(shipment: any, data: any = {}) {
    const issueStatus = closingValue(data, "issueStatus", "issue_status", shipment.issueStatus);
    const issueText = [
        closingValue(data, "statusReason", "status_reason", shipment.statusReason),
        closingValue(data, "issueNotes", "issue_notes", shipment.issueNotes),
        closingValue(data, "remarks", "remarks", shipment.remarks),
    ].map((item) => cleanText(item)).filter(Boolean).join(" ");
    if (!issueText) return [];
    const hasRiskSignal = /(pending|waiting|delay|issue|problem|hold|claim|dispute|short|loss|not clear|belum|menunggu|kendala)/i.test(issueText);
    if (!hasRiskSignal) return [];
    if (statusIsOneOf(issueStatus, ["RESOLVED", "CLOSED", "CLEARED", "DONE", "NOT_REQUIRED", "N/A"])) return [];
    return [`Issue: pending issue/reason exists and issue status is ${issueStatus || "empty"}.`];
}

function traceValue(value: unknown): string {
    return String(value ?? "").replace(/\s+/g, " ").trim();
}

function incomingValue(data: any, camel: string, snake?: string): { provided: boolean; value: string } {
    if (data?.[camel] !== undefined) return { provided: true, value: traceValue(data[camel]) };
    if (snake && data?.[snake] !== undefined) return { provided: true, value: traceValue(data[snake]) };
    return { provided: false, value: "" };
}

function directChangeBlocker(label: string, oldValue: unknown, nextValue: { provided: boolean; value: string }, flowName: string) {
    const oldText = traceValue(oldValue);
    if (!nextValue.provided) return null;
    if (!oldText) return null;
    if (oldText.toLowerCase() === nextValue.value.toLowerCase()) return null;
    return `${label}: ${oldText} -> ${nextValue.value || "(empty)"} must use ${flowName}.`;
}

function validateTraceabilityOverwriteGuard(existing: any, data: any) {
    const blockers = [
        directChangeBlocker("Source", existing.source, incomingValue(data, "source"), "Source Change Request"),
        directChangeBlocker("Supplier", existing.supplier, incomingValue(data, "supplier"), "Source Change Request"),
        directChangeBlocker("Vessel/MV", existing.vesselName, incomingValue(data, "vesselName", "vessel_name"), "Barge Change Log"),
        directChangeBlocker("Barge/TB-BG", existing.bargeName, incomingValue(data, "bargeName", "barge_name"), "Barge Change Log"),
        directChangeBlocker("Nomination", existing.nomination, incomingValue(data, "nomination"), "Barge Change Log"),
    ].filter(Boolean) as string[];
    return blockers;
}

async function validateStructuredIssueClosingReadiness(shipmentId: string) {
    await ensureShipmentIssueTable();
    const issues = await prisma.shipmentIssueLog.findMany({
        where: {
            shipmentId,
            isDeleted: false,
            NOT: { status: { in: ["resolved", "closed", "not_required"] } },
        },
        select: { category: true, status: true, pic: true, targetDate: true },
        orderBy: { createdAt: "desc" },
        take: 5,
    });
    return issues.map((issue) => {
        const due = issue.targetDate ? ` due ${issue.targetDate.toISOString().slice(0, 10)}` : "";
        const pic = issue.pic ? ` PIC ${issue.pic}` : "";
        return `Issue Log: ${issue.category} is ${issue.status || "open"}${pic}${due}.`;
    });
}

async function validateSourceChangeClosingReadiness(shipmentId: string) {
    await ensureShipmentSourceChangeTable();
    const changes = await prisma.shipmentSourceChangeRequest.findMany({
        where: {
            shipmentId,
            isDeleted: false,
            status: "pending",
        },
        select: { oldSource: true, newSource: true, version: true, requestedByName: true },
        orderBy: { version: "desc" },
        take: 5,
    });
    return changes.map((change) => `Source Change: v${change.version} ${change.oldSource || "-"} -> ${change.newSource} is pending${change.requestedByName ? ` by ${change.requestedByName}` : ""}.`);
}

function validateSourceConfirmationClosingReadiness(shipment: any, data: any = {}) {
    const status = closingValue(data, "sourceConfirmationStatus", "source_confirmation_status", shipment.sourceConfirmationStatus);
    const legal = closingValue(data, "sourceLegalReadinessStatus", "source_legal_readiness_status", shipment.sourceLegalReadinessStatus);
    const cargo = closingValue(data, "sourceCargoReadinessStatus", "source_cargo_readiness_status", shipment.sourceCargoReadinessStatus);
    const evidence = closingValue(data, "sourceConfirmationDocumentId", "source_confirmation_document_id", shipment.sourceConfirmationDocumentId);
    const blockers: string[] = [];
    if (status && !statusIsOneOf(status, ["CONFIRMED", "APPROVED", "READY", "NOT_REQUIRED", "N/A"])) {
        blockers.push(`Source Confirmation: status is ${status}.`);
    }
    if (legal && !statusIsOneOf(legal, ["READY", "CLEARED", "APPROVED", "NOT_REQUIRED", "N/A"])) {
        blockers.push(`Source Legal: readiness is ${legal}.`);
    }
    if (cargo && !statusIsOneOf(cargo, ["READY", "CLEARED", "APPROVED", "NOT_REQUIRED", "N/A"])) {
        blockers.push(`Source Cargo: readiness is ${cargo}.`);
    }
    if (statusIsOneOf(status, ["CONFIRMED", "APPROVED", "READY"]) && !evidence) {
        blockers.push("Source Confirmation: confirmed source needs evidence document.");
    }
    return blockers;
}

async function validateLinkedPaymentClosingReadiness(shipmentId: string) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "OutstandingPayment" ADD COLUMN IF NOT EXISTS "shipmentId" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "OutstandingPayment" ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "OutstandingPayment" ADD COLUMN IF NOT EXISTS "invoiceDocumentId" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "OutstandingPayment" ADD COLUMN IF NOT EXISTS "paymentProofDocumentId" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "OutstandingPayment" ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3);`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "OutstandingPayment" ADD COLUMN IF NOT EXISTS "disputeStatus" TEXT;`);
    const payments = await prisma.outstandingPayment.findMany({
        where: { shipmentId, isDeleted: false },
        select: { invoiceNumber: true, invoiceDocumentId: true, paymentProofDocumentId: true, status: true, disputeStatus: true, dueDate: true, perusahaan: true },
        orderBy: { createdAt: "desc" },
    });
    if (!payments.length) return [];
    return payments.flatMap((payment) => {
        const blockers: string[] = [];
        const label = payment.invoiceNumber || payment.perusahaan || "linked payment";
        const isPaid = statusIsOneOf(payment.status, ["PAID", "SETTLED", "COMPLETED", "COMPLETE", "NOT_REQUIRED"]);
        if (!isPaid) {
            const due = payment.dueDate ? ` due ${payment.dueDate.toISOString().slice(0, 10)}` : "";
            const dispute = payment.disputeStatus ? ` dispute ${payment.disputeStatus}` : "";
            blockers.push(`Payment Record: ${label} is ${payment.status || "pending"}${due}${dispute}.`);
        }
        if (!payment.invoiceNumber) blockers.push(`Payment Record: ${label} invoice number is missing.`);
        if (!payment.invoiceDocumentId) blockers.push(`Payment Record: ${label} invoice document is not attached.`);
        if (isPaid && !payment.paymentProofDocumentId) blockers.push(`Payment Record: ${label} payment proof is not attached.`);
        return blockers;
    });
}

async function validateBargeChangeClosingReadiness(shipmentId: string) {
    await ensureShipmentBargeChangeTable();
    const changes = await prisma.shipmentBargeChangeLog.findMany({
        where: {
            shipmentId,
            isDeleted: false,
            status: "pending",
        },
        select: { newMv: true, newTb: true, newBg: true, newNomination: true, version: true, requestedByName: true },
        orderBy: { version: "desc" },
        take: 5,
    });
    return changes.map((change) => {
        const target = [change.newMv, change.newTb, change.newBg, change.newNomination].filter(Boolean).join(" / ") || "barge data";
        return `Barge Change: v${change.version} ${target} is pending${change.requestedByName ? ` by ${change.requestedByName}` : ""}.`;
    });
}

async function tryAuditLog(userId: string, userName: string, action: string, entityId: string, details: string) {
    try {
        await prisma.auditLog.create({
            data: {
                userId,
                userName,
                action,
                entity: "ShipmentDetail",
                entityId,
                details,
            },
        });
    } catch (error: any) {
        console.warn("[shipments] audit skipped:", error?.code || error?.message);
    }
}

function parseNum(v: any): number | null {
    if (v === null || v === undefined || v === "") return null;
    const n = parseFloat(String(v));
    return isNaN(n) ? null : n;
}

function parseDate(v: any): Date | null {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
}

function parseDemurrageRate(v: unknown): number | null {
    const text = cleanText(v);
    if (!text) return null;
    const match = text.match(/(?:demurrage|demm|dmg|rate)?[^0-9$]*(?:usd|\$)?\s*([0-9]+(?:[.,][0-9]+)?)(\s*k)?\s*(?:\/|per)?\s*(?:day|hari|d)/i);
    if (!match) return null;
    const raw = Number(match[1].replace(",", "."));
    if (!Number.isFinite(raw)) return null;
    return match[2] ? raw * 1000 : raw;
}

function cleanText(v: unknown): string | null {
    if (v === null || v === undefined) return null;
    const text = String(v).replace(/\s+/g, " ").trim();
    return text || null;
}

function normalizeKey(v: unknown): string {
    return (cleanText(v) || "").toUpperCase();
}

const HEADER_LIKE_TOKENS = new Set([
    "NO",
    "NO.",
    "STATUS",
    "ORIGIN",
    "MV PROJECT NAME",
    "MV NAME",
    "SOURCE",
    "IUP OP",
    "SHIPMENT FLOW",
    "JETTY",
    "JETTY LOADING PORT",
    "LAYCAN",
    "NOMINATION",
    "QTY",
    "QTY MT",
    "PLAN",
    "COB",
    "REMARKS",
    "SHIPMENT STATUS",
    "ISSUE",
    "BL DATE",
    "BUYER",
    "EXPORT",
    "EXPORT DMO",
    "LOADING PORT"
]);

function isHeaderLikeValue(v: unknown): boolean {
    const n = normalizeKey(v);
    return !!n && HEADER_LIKE_TOKENS.has(n);
}

function looksLikeNarrativeText(v: unknown): boolean {
    const text = cleanText(v);
    if (!text) return false;
    const lower = text.toLowerCase();
    return (
        text.length > 60 ||
        lower.includes("issue") ||
        lower.includes("terms payment") ||
        lower.includes("kontrak") ||
        lower.includes("dokumen") ||
        lower.includes("harga")
    );
}

function isNoiseShipmentRecord(s: any): boolean {
    if (
        isHeaderLikeValue(s?.mvProjectName) ||
        isHeaderLikeValue(s?.nomination) ||
        isHeaderLikeValue(s?.source) ||
        isHeaderLikeValue(s?.shipmentFlow) ||
        isHeaderLikeValue(s?.shipmentStatus)
    ) return true;

    const qty = parseNum(s?.quantityLoaded) ?? parseNum(s?.qtyPlan) ?? parseNum(s?.qtyCob) ?? 0;
    const hasIdentity = Boolean(
        cleanText(s?.mvProjectName) ||
        cleanText(s?.vesselName) ||
        cleanText(s?.nomination) ||
        cleanText(s?.bargeName)
    );

    const hasCounterparty = Boolean(cleanText(s?.buyer) || cleanText(s?.supplier) || cleanText(s?.source));
    const hasShipmentStatus = Boolean(cleanText(s?.shipmentStatus));
    const likelyNarrativePort = looksLikeNarrativeText(s?.loadingPort) || looksLikeNarrativeText(s?.jettyLoadingPort);
    if (qty <= 0 && !cleanText(s?.nomination) && !hasCounterparty && !hasShipmentStatus && likelyNarrativePort) {
        return true;
    }

    return !hasIdentity && qty <= 0;
}

function sanitizeEntityName(v: unknown): string | null {
    const t = cleanText(v);
    if (!t) return null;
    if (isHeaderLikeValue(t)) return null;
    return t;
}

function isExportShipment(s: any): boolean {
    const type = normalizeKey(s?.type);
    const expDmo = normalizeKey(s?.exportDmo);
    if (type.includes("LOCAL") || type.includes("DMO") || type.includes("DOMESTIC")) return false;
    if (expDmo.includes("DMO") || expDmo.includes("LOCAL") || expDmo.includes("DOMESTIC")) return false;
    return true;
}

function inferBuyerFromFlow(flow: unknown): string | null {
    const raw = cleanText(flow);
    if (!raw) return null;
    const stopwords = new Set([
        "MSE", "MKLS", "CMD", "BAC", "LJT", "BUYER", "SUPPLIER", "OPS", "FLOW", "I/O", "IO", "AND", "OR",
        "SHIPMENT", "SHIPMENT FLOW", "LOADING", "PORT", "JETTY", "TBA"
    ]);
    const tokens = raw
        .split(/[-–>/,|]+/)
        .map((t) => cleanText(t))
        .filter((t): t is string => Boolean(t));
    for (let i = tokens.length - 1; i >= 0; i--) {
        const token = tokens[i];
        const norm = normalizeKey(token);
        if (!norm || stopwords.has(norm)) continue;
        if (norm.length <= 2) continue;
        return token;
    }
    return null;
}

function splitReasonItems(...parts: Array<unknown>): string[] {
    const out: string[] = [];
    for (const part of parts) {
        const text = cleanText(part);
        if (!text) continue;
        const chunks = text
            .split(/\r?\n|;|•|\||\u2022|,|\s{2,}/g)
            .map((x) => cleanText(x))
            .filter((x): x is string => Boolean(x));
        for (const chunk of chunks) {
            const key = normalizeKey(chunk);
            if (!key) continue;
            if (HEADER_LIKE_TOKENS.has(key)) continue;
            if (key.length < 3) continue;
            if (!out.some((existing) => normalizeKey(existing) === key)) {
                out.push(chunk);
            }
        }
    }
    return out.slice(0, 8);
}

function deriveStatusReason(s: any): string | null {
    const reason =
        cleanText(s?.issueNotes) ||
        cleanText(s?.remarks) ||
        null;
    if (reason) return reason;

    const status = normalizeKey(s?.status || s?.shipmentStatus);
    if (status.includes("CANCEL")) return "Shipment cancelled (reason not captured in source).";
    if (status.includes("WAIT") || status.includes("UPCOMING")) return "Waiting operational readiness.";
    return null;
}

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        await ensureShipmentDetailExtendedColumns();
        const { searchParams } = new URL(req.url);
        const lite = ["1", "true", "yes"].includes((searchParams.get("lite") || "").toLowerCase());
        const includeTimeline = ["1", "true", "yes"].includes((searchParams.get("timeline") || "").toLowerCase());

        // DATABASE-FIRST: Read directly from database
        const shipments = await prisma.shipmentDetail.findMany({
            where: { isDeleted: false },
            orderBy: { createdAt: "desc" },
            ...(lite
                ? {
                    select: {
                        id: true,
                        no: true,
                        exportDmo: true,
                        status: true,
                        origin: true,
                        mvProjectName: true,
                        source: true,
                        iupOp: true,
                        shipmentFlow: true,
                        jettyLoadingPort: true,
                        laycan: true,
                        nomination: true,
                        qtyPlan: true,
                        qtyCob: true,
                        remarks: true,
                        hargaActualFob: true,
                        hargaActualFobMv: true,
                        hpb: true,
                        shipmentStatus: true,
                        paymentStatus: true,
                        paymentDueDate: true,
                        qualityStatus: true,
                        issueStatus: true,
                        issueNotes: true,
                        statusReason: true,
                        blDate: true,
                        pic: true,
                        sp: true,
                        year: true,
                        quantityLoaded: true,
                        salesPrice: true,
                        buyingPrice: true,
                        marginMt: true,
                        buyer: true,
                        supplier: true,
                        vesselName: true,
                        bargeName: true,
                        loadingPort: true,
                        dischargePort: true,
                        type: true,
                        riskScore: true,
                        riskLevel: true,
                        riskReport: true,
                        lastAnalyzedAt: true,
                        operationalInfo: true,
                        demurrageRate: true,
                        demurrageCurrency: true,
                        demurrageSource: true,
                        demurrageUpdatedAt: true,
                        siTo: true,
                        siShipper: true,
                        consignee: true,
                        consigneeAddress: true,
                        notifyParty: true,
                        notifyPartyAddress: true,
                        siMarked: true,
                        quantityTolerance: true,
                        createdAt: true,
                        updatedAt: true,
                        isDeleted: true,
                    }
                }
                : {})
        });

        const cleanShipments = shipments.filter((s) => !isNoiseShipmentRecord(s));
        const shipmentIds = cleanShipments.map((s) => s.id);
        const timeline = includeTimeline && !lite && shipmentIds.length
            ? await prisma.timelineMilestone.findMany({
                where: { shipmentId: { in: shipmentIds } },
                orderBy: { date: "asc" }
            })
            : [];

        const timelineByShipment = new Map<string, typeof timeline>();
        for (const item of timeline) {
            const existing = timelineByShipment.get(item.shipmentId) || [];
            existing.push(item);
            timelineByShipment.set(item.shipmentId, existing);
        }

        // Build buyer consensus by mother-vessel/project group
        const buyerVotesByGroup = new Map<string, Map<string, number>>();
        for (const s of cleanShipments) {
            const groupKey = normalizeKey(s.vesselName || s.mvProjectName || s.nomination);
            const buyer = sanitizeEntityName(s.buyer);
            if (!groupKey || !buyer) continue;
            const votes = buyerVotesByGroup.get(groupKey) || new Map<string, number>();
            votes.set(buyer, (votes.get(buyer) || 0) + 1);
            buyerVotesByGroup.set(groupKey, votes);
        }

        const consensusBuyerByGroup = new Map<string, string>();
        buyerVotesByGroup.forEach((votes, groupKey) => {
            let winner = "";
            let maxVote = -1;
            votes.forEach((vote, candidate) => {
                if (vote > maxVote) {
                    winner = candidate;
                    maxVote = vote;
                }
            });
            if (winner) consensusBuyerByGroup.set(groupKey, winner);
        });

        const enriched = cleanShipments.map((s) => {
            const milestones = timelineByShipment.get(s.id) || [];
            const groupKey = normalizeKey(s.vesselName || s.mvProjectName || s.nomination);
            const inferredBuyer =
                sanitizeEntityName(s.buyer) ||
                consensusBuyerByGroup.get(groupKey) ||
                inferBuyerFromFlow(s.shipmentFlow) ||
                null;
            const inferredSupplier =
                sanitizeEntityName(s.supplier) ||
                sanitizeEntityName(s.source) ||
                sanitizeEntityName(s.iupOp) ||
                null;
            const exportShipment = isExportShipment(s);
            const counterpartyRole = exportShipment ? "buyer" : "vendor";
            const counterparty = exportShipment
                ? (inferredBuyer || inferredSupplier || sanitizeEntityName(s.mvProjectName) || "TBA Buyer")
                : (inferredSupplier || inferredBuyer || sanitizeEntityName(s.mvProjectName) || "TBA Vendor");
            const statusReason = (s as any).statusReason || deriveStatusReason(s);
            const pendingItems = splitReasonItems(s?.issueNotes, s?.remarks);

            return {
                ...s,
                buyer: inferredBuyer,
                supplier: inferredSupplier,
                counterpartyRole,
                counterparty,
                statusReason,
                pendingItems,
                milestones: includeTimeline
                    ? milestones.map((m) => ({
                        title: m.title,
                        subtitle: `${m.date.toISOString().slice(0, 10)}${m.description ? ` - ${m.description}` : ""}`,
                        status: "completed",
                        date: m.date
                    }))
                    : []
            };
        });

        // Apply pagination after enrichment (since noise filtering changes total count)
        const pagination = parsePaginationParams(searchParams);
        if (pagination) {
            const totalItems = enriched.length;
            const meta = buildPaginationMeta(totalItems, pagination.page, pagination.pageSize);
            const paginated = enriched.slice(pagination.skip, pagination.skip + pagination.take);
            return NextResponse.json({ success: true, shipments: paginated, meta });
        }

        return NextResponse.json({ success: true, shipments: enriched });
    } catch (error) {
        console.error("GET /api/memory/shipments error:", error);
        return NextResponse.json({ error: "Failed to fetch shipments" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        await ensureShipmentDetailExtendedColumns();

        const data = await req.json();

        // DATABASE-FIRST: Write to database as primary source
        const shipment = await prisma.shipmentDetail.create({
            data: {
                no: data.no ? parseInt(data.no) : null,
                forecastSalesId: data.forecastSalesId ?? data.forecast_sales_id,
                forecastSalesName: data.forecastSalesName ?? data.forecast_sales_name,
                fcoNumber: data.fcoNumber ?? data.fco_number,
                commercialMomDocumentId: data.commercialMomDocumentId ?? data.commercial_mom_document_id,
                commercialPoDocumentId: data.commercialPoDocumentId ?? data.commercial_po_document_id,
                sourceConfirmationStatus: data.sourceConfirmationStatus ?? data.source_confirmation_status,
                sourceConfirmationDocumentId: data.sourceConfirmationDocumentId ?? data.source_confirmation_document_id,
                sourceConfirmationNotes: data.sourceConfirmationNotes ?? data.source_confirmation_notes,
                sourceConfirmedBy: data.sourceConfirmedBy ?? data.source_confirmed_by,
                sourceConfirmedByName: data.sourceConfirmedByName ?? data.source_confirmed_by_name,
                sourceConfirmedAt: parseDate(data.sourceConfirmedAt ?? data.source_confirmed_at),
                sourceLegalReadinessStatus: data.sourceLegalReadinessStatus ?? data.source_legal_readiness_status,
                sourceCargoReadinessStatus: data.sourceCargoReadinessStatus ?? data.source_cargo_readiness_status,
                exportDmo: data.exportDmo,
                status: data.status || "upcoming",
                origin: data.origin,
                mvProjectName: data.mvProjectName,
                source: data.source,
                iupOp: data.iupOp,
                shipmentFlow: data.shipmentFlow,
                jettyLoadingPort: data.jettyLoadingPort,
                laycan: data.laycan,
                nomination: data.nomination,
                qtyPlan: parseNum(data.qtyPlan),
                qtyCob: parseNum(data.qtyCob),
                remarks: data.remarks,
                hargaActualFob: parseNum(data.hargaActualFob),
                hargaActualFobMv: parseNum(data.hargaActualFobMv),
                hpb: parseNum(data.hpb),
                statusHpb: data.statusHpb,
                shipmentStatus: data.shipmentStatus,
                paymentStatus: data.paymentStatus ?? data.payment_status ?? "pending",
                paymentDueDate: parseDate(data.paymentDueDate ?? data.payment_due_date),
                qualityStatus: data.qualityStatus ?? data.quality_status ?? "pending",
                issueStatus: data.issueStatus ?? data.issue_status ?? (cleanText(data.issueNotes ?? data.issue_notes ?? data.statusReason ?? data.status_reason) ? "open" : "none"),
                issueNotes: data.issueNotes,
                statusReason: (() => {
                    let reason = data.statusReason ?? data.status_reason ?? null;
                    if (reason) reason = String(reason).slice(0, 500);
                    const st = (data.status || "").toLowerCase();
                    const shipSt = (data.shipmentStatus || "").toLowerCase();
                    const isOnGoing = ["upcoming", "loading", "in_transit"].includes(st);
                    const isPending = shipSt.includes("pending") || shipSt.includes("waiting");
                    if (!reason && isOnGoing && isPending) reason = "Waiting operational readiness.";
                    return reason;
                })(),
                blDate: parseDate(data.blDate),
                pic: data.pic || session.user.name,
                kuotaExport: data.kuotaExport,
                surveyorLhv: data.surveyorLhv,
                completelyLoaded: parseDate(data.completelyLoaded),
                lhvTerbit: parseDate(data.lhvTerbit),
                lossGainCargo: parseNum(data.lossGainCargo),
                sp: parseNum(data.sp),
                deadfreight: parseNum(data.deadfreight),
                jarak: parseNum(data.jarak),
                shippingTerm: data.shippingTerm,
                shippingRate: parseNum(data.shippingRate),
                priceFreight: parseNum(data.priceFreight),
                royaltyCost: parseNum(data.royaltyCost ?? data.royalty_cost),
                taxExportCost: parseNum(data.taxExportCost ?? data.tax_export_cost),
                surveyCost: parseNum(data.surveyCost ?? data.survey_cost),
                paymentFinanceCost: parseNum(data.paymentFinanceCost ?? data.payment_finance_cost),
                allowance: data.allowance,
                demm: data.demm,
                noSpal: data.noSpal,
                noSi: data.noSi,
                sentToSupplier: data.sentToSupplier,
                sentToBargeOwner: data.sentToBargeOwner,
                noInvoiceMkls: data.noInvoiceMkls,
                coaDate: parseDate(data.coaDate),
                resultGar: parseNum(data.resultGar),
                year: data.year || new Date().getFullYear(),
                // Detailed/Unified fields
                quantityLoaded: parseNum(data.quantity_loaded ?? data.quantityLoaded),
                salesPrice: parseNum(data.sales_price ?? data.salesPrice),
                buyingPrice: parseNum(data.buying_price ?? data.buyingPrice),
                marginMt: parseNum(data.margin_mt ?? data.marginMt),
                buyer: data.buyer,
                supplier: data.supplier || data.source,
                vesselName: data.vessel_name ?? data.vesselName,
                bargeName: data.barge_name ?? data.bargeName,
                loadingPort: data.loading_port ?? data.loadingPort,
                dischargePort: data.discharge_port ?? data.dischargePort,
                product: data.product,
                analysisMethod: data.analysis_method ?? data.analysisMethod,
                siTo: data.si_to ?? data.siTo,
                siShipper: data.si_shipper ?? data.siShipper,
                consignee: data.consignee,
                consigneeAddress: data.consignee_address ?? data.consigneeAddress,
                notifyParty: data.notify_party ?? data.notifyParty,
                notifyPartyAddress: data.notify_party_address ?? data.notifyPartyAddress,
                siMarked: data.si_marked ?? data.siMarked,
                quantityTolerance: data.quantity_tolerance ?? data.quantityTolerance,
                type: data.type || "export",
                operationalInfo: data.operationalInfo ?? data.operational_info,
                demurrageRate: data.demurrageRate !== undefined
                    ? parseNum(data.demurrageRate)
                    : parseDemurrageRate(data.operationalInfo ?? data.operational_info ?? data.demm),
                demurrageCurrency: data.demurrageCurrency ?? data.demurrage_currency ?? "USD",
                demurrageSource: data.demurrageSource ?? data.demurrage_source ?? ((data.operationalInfo ?? data.operational_info) ? "Operational Info" : undefined),
                demurrageUpdatedAt: (data.demurrageRate !== undefined || data.demurrage_rate !== undefined || data.operationalInfo || data.operational_info)
                    ? new Date()
                    : undefined,
            }
        });
        await tryAuditLog(
            session.user.id,
            session.user.name || "Unknown",
            "CREATE",
            shipment.id,
            JSON.stringify({ mvProjectName: shipment.mvProjectName, status: shipment.status })
        );

        // Optional push to Sheets for backup/export
        await triggerPush();

        return NextResponse.json({ success: true, shipment });
    } catch (error) {
        console.error("POST /api/memory/shipments error:", error);
        return NextResponse.json({ error: "Failed to create shipment", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        await ensureShipmentDetailExtendedColumns();

        const data = await req.json();
        if (!data.id) return NextResponse.json({ error: "ID missing" }, { status: 400 });

        const existing = await prisma.shipmentDetail.findUnique({ where: { id: data.id } });
        if (!existing || existing.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const traceabilityBlockers = validateTraceabilityOverwriteGuard(existing, data);
        if (traceabilityBlockers.length > 0) {
            return NextResponse.json({
                error: "Shipment traceability fields cannot be overwritten directly. Use the change request flow.",
                code: "SHIPMENT_TRACEABILITY_GUARD",
                blockers: traceabilityBlockers,
            }, { status: 409 });
        }

        if (data.status !== undefined && isClosingStatus(data.status)) {
            const documentBlockers = await validateDocumentClosingReadiness(existing.id);
            const siBlockers = await validateSiClosingReadiness(existing.id);
            const commercialBlockers = validateCommercialClosingReadiness(existing, data);
            const qualityBlockers = await validateQualityClosingReadiness(existing, data);
            const issueBlockers = validateIssueClosingReadiness(existing, data);
            const structuredIssueBlockers = await validateStructuredIssueClosingReadiness(existing.id);
            const linkedPaymentBlockers = await validateLinkedPaymentClosingReadiness(existing.id);
            const sourceChangeBlockers = await validateSourceChangeClosingReadiness(existing.id);
            const sourceConfirmationBlockers = validateSourceConfirmationClosingReadiness(existing, data);
            const bargeChangeBlockers = await validateBargeChangeClosingReadiness(existing.id);
            const blockers = [
                ...documentBlockers.map((item) => `Document: ${item}`),
                ...siBlockers.map((item) => `SI: ${item}`),
                ...commercialBlockers,
                ...linkedPaymentBlockers,
                ...qualityBlockers,
                ...issueBlockers,
                ...structuredIssueBlockers,
                ...sourceChangeBlockers,
                ...sourceConfirmationBlockers,
                ...bargeChangeBlockers,
            ];
            if (blockers.length > 0) {
                return NextResponse.json({
                    error: "Shipment cannot be closed because closing checklist is incomplete.",
                    code: "SHIPMENT_CLOSING_BLOCKED",
                    blockers: blockers.slice(0, 14),
                }, { status: 409 });
            }
        }

        // DATABASE-FIRST: Update database as primary source
        const shipment = await prisma.shipmentDetail.update({
            where: { id: data.id },
            data: {
                no: data.no !== undefined ? (data.no ? parseInt(data.no) : null) : undefined,
                forecastSalesId: data.forecastSalesId !== undefined ? data.forecastSalesId : (data.forecast_sales_id !== undefined ? data.forecast_sales_id : undefined),
                forecastSalesName: data.forecastSalesName !== undefined ? data.forecastSalesName : (data.forecast_sales_name !== undefined ? data.forecast_sales_name : undefined),
                fcoNumber: data.fcoNumber !== undefined ? data.fcoNumber : (data.fco_number !== undefined ? data.fco_number : undefined),
                commercialMomDocumentId: data.commercialMomDocumentId !== undefined ? data.commercialMomDocumentId : (data.commercial_mom_document_id !== undefined ? data.commercial_mom_document_id : undefined),
                commercialPoDocumentId: data.commercialPoDocumentId !== undefined ? data.commercialPoDocumentId : (data.commercial_po_document_id !== undefined ? data.commercial_po_document_id : undefined),
                sourceConfirmationStatus: data.sourceConfirmationStatus !== undefined ? data.sourceConfirmationStatus : (data.source_confirmation_status !== undefined ? data.source_confirmation_status : undefined),
                sourceConfirmationDocumentId: data.sourceConfirmationDocumentId !== undefined ? data.sourceConfirmationDocumentId : (data.source_confirmation_document_id !== undefined ? data.source_confirmation_document_id : undefined),
                sourceConfirmationNotes: data.sourceConfirmationNotes !== undefined ? data.sourceConfirmationNotes : (data.source_confirmation_notes !== undefined ? data.source_confirmation_notes : undefined),
                sourceConfirmedBy: data.sourceConfirmedBy !== undefined ? data.sourceConfirmedBy : (data.source_confirmed_by !== undefined ? data.source_confirmed_by : undefined),
                sourceConfirmedByName: data.sourceConfirmedByName !== undefined ? data.sourceConfirmedByName : (data.source_confirmed_by_name !== undefined ? data.source_confirmed_by_name : undefined),
                sourceConfirmedAt: data.sourceConfirmedAt !== undefined ? parseDate(data.sourceConfirmedAt) : (data.source_confirmed_at !== undefined ? parseDate(data.source_confirmed_at) : undefined),
                sourceLegalReadinessStatus: data.sourceLegalReadinessStatus !== undefined ? data.sourceLegalReadinessStatus : (data.source_legal_readiness_status !== undefined ? data.source_legal_readiness_status : undefined),
                sourceCargoReadinessStatus: data.sourceCargoReadinessStatus !== undefined ? data.sourceCargoReadinessStatus : (data.source_cargo_readiness_status !== undefined ? data.source_cargo_readiness_status : undefined),
                exportDmo: data.exportDmo, status: data.status, origin: data.origin,
                mvProjectName: data.mvProjectName, source: data.source, iupOp: data.iupOp,
                shipmentFlow: data.shipmentFlow, jettyLoadingPort: data.jettyLoadingPort,
                laycan: data.laycan, nomination: data.nomination,
                qtyPlan: data.qtyPlan !== undefined ? parseNum(data.qtyPlan) : undefined,
                qtyCob: data.qtyCob !== undefined ? parseNum(data.qtyCob) : undefined,
                remarks: data.remarks, hargaActualFob: data.hargaActualFob !== undefined ? parseNum(data.hargaActualFob) : undefined,
                hargaActualFobMv: data.hargaActualFobMv !== undefined ? parseNum(data.hargaActualFobMv) : undefined,
                hpb: data.hpb !== undefined ? parseNum(data.hpb) : undefined,
                statusHpb: data.statusHpb,
                shipmentStatus: data.shipmentStatus,
                paymentStatus: data.paymentStatus !== undefined ? data.paymentStatus : (data.payment_status !== undefined ? data.payment_status : undefined),
                paymentDueDate: data.paymentDueDate !== undefined ? parseDate(data.paymentDueDate) : (data.payment_due_date !== undefined ? parseDate(data.payment_due_date) : undefined),
                qualityStatus: data.qualityStatus !== undefined ? data.qualityStatus : (data.quality_status !== undefined ? data.quality_status : undefined),
                issueStatus: data.issueStatus !== undefined ? data.issueStatus : (data.issue_status !== undefined ? data.issue_status : undefined),
                issueNotes: data.issueNotes,
                statusReason: data.statusReason !== undefined ? (data.statusReason ? String(data.statusReason).slice(0, 500) : data.statusReason) : (data.status_reason !== undefined ? (data.status_reason ? String(data.status_reason).slice(0, 500) : data.status_reason) : undefined),
                blDate: data.blDate !== undefined ? parseDate(data.blDate) : undefined,
                pic: data.pic, kuotaExport: data.kuotaExport, surveyorLhv: data.surveyorLhv,
                completelyLoaded: data.completelyLoaded !== undefined ? parseDate(data.completelyLoaded) : undefined,
                lhvTerbit: data.lhvTerbit !== undefined ? parseDate(data.lhvTerbit) : undefined,
                lossGainCargo: data.lossGainCargo !== undefined ? parseNum(data.lossGainCargo) : undefined,
                sp: data.sp !== undefined ? parseNum(data.sp) : undefined,
                deadfreight: data.deadfreight !== undefined ? parseNum(data.deadfreight) : undefined,
                jarak: data.jarak !== undefined ? parseNum(data.jarak) : undefined,
                shippingTerm: data.shippingTerm, shippingRate: data.shippingRate !== undefined ? parseNum(data.shippingRate) : undefined,
                priceFreight: data.priceFreight !== undefined ? parseNum(data.priceFreight) : undefined,
                royaltyCost: data.royaltyCost !== undefined ? parseNum(data.royaltyCost) : (data.royalty_cost !== undefined ? parseNum(data.royalty_cost) : undefined),
                taxExportCost: data.taxExportCost !== undefined ? parseNum(data.taxExportCost) : (data.tax_export_cost !== undefined ? parseNum(data.tax_export_cost) : undefined),
                surveyCost: data.surveyCost !== undefined ? parseNum(data.surveyCost) : (data.survey_cost !== undefined ? parseNum(data.survey_cost) : undefined),
                paymentFinanceCost: data.paymentFinanceCost !== undefined ? parseNum(data.paymentFinanceCost) : (data.payment_finance_cost !== undefined ? parseNum(data.payment_finance_cost) : undefined),
                allowance: data.allowance, demm: data.demm, noSpal: data.noSpal, noSi: data.noSi,
                sentToSupplier: data.sentToSupplier,
                sentToBargeOwner: data.sentToBargeOwner,
                noInvoiceMkls: data.noInvoiceMkls,
                coaDate: data.coaDate !== undefined ? parseDate(data.coaDate) : undefined,
                resultGar: data.resultGar !== undefined ? parseNum(data.resultGar) : undefined,
                year: data.year,
                // Detailed/Unified fields
                quantityLoaded: data.quantity_loaded !== undefined
                    ? parseNum(data.quantity_loaded)
                    : (data.quantityLoaded !== undefined ? parseNum(data.quantityLoaded) : undefined),
                salesPrice: data.sales_price !== undefined
                    ? parseNum(data.sales_price)
                    : (data.salesPrice !== undefined ? parseNum(data.salesPrice) : undefined),
                buyingPrice: data.buying_price !== undefined
                    ? parseNum(data.buying_price)
                    : (data.buyingPrice !== undefined ? parseNum(data.buyingPrice) : undefined),
                marginMt: data.margin_mt !== undefined
                    ? parseNum(data.margin_mt)
                    : (data.marginMt !== undefined ? parseNum(data.marginMt) : undefined),
                buyer: data.buyer,
                supplier: data.supplier !== undefined ? data.supplier : undefined,
                vesselName: data.vessel_name !== undefined ? data.vessel_name : (data.vesselName !== undefined ? data.vesselName : undefined),
                bargeName: data.barge_name !== undefined ? data.barge_name : (data.bargeName !== undefined ? data.bargeName : undefined),
                loadingPort: data.loading_port !== undefined ? data.loading_port : (data.loadingPort !== undefined ? data.loadingPort : undefined),
                dischargePort: data.discharge_port !== undefined ? data.discharge_port : (data.dischargePort !== undefined ? data.dischargePort : undefined),
                product: data.product,
                analysisMethod: data.analysis_method !== undefined ? data.analysis_method : (data.analysisMethod !== undefined ? data.analysisMethod : undefined),
                siTo: data.si_to !== undefined ? data.si_to : (data.siTo !== undefined ? data.siTo : undefined),
                siShipper: data.si_shipper !== undefined ? data.si_shipper : (data.siShipper !== undefined ? data.siShipper : undefined),
                consignee: data.consignee !== undefined ? data.consignee : undefined,
                consigneeAddress: data.consignee_address !== undefined ? data.consignee_address : (data.consigneeAddress !== undefined ? data.consigneeAddress : undefined),
                notifyParty: data.notify_party !== undefined ? data.notify_party : (data.notifyParty !== undefined ? data.notifyParty : undefined),
                notifyPartyAddress: data.notify_party_address !== undefined ? data.notify_party_address : (data.notifyPartyAddress !== undefined ? data.notifyPartyAddress : undefined),
                siMarked: data.si_marked !== undefined ? data.si_marked : (data.siMarked !== undefined ? data.siMarked : undefined),
                quantityTolerance: data.quantity_tolerance !== undefined ? data.quantity_tolerance : (data.quantityTolerance !== undefined ? data.quantityTolerance : undefined),
                type: data.type !== undefined ? data.type : undefined,
                operationalInfo: data.operationalInfo !== undefined
                    ? data.operationalInfo
                    : (data.operational_info !== undefined ? data.operational_info : undefined),
                demurrageRate: data.demurrageRate !== undefined
                    ? parseNum(data.demurrageRate)
                    : (data.demurrage_rate !== undefined
                        ? parseNum(data.demurrage_rate)
                        : ((data.operationalInfo !== undefined || data.operational_info !== undefined)
                            ? parseDemurrageRate(data.operationalInfo ?? data.operational_info)
                            : undefined)),
                demurrageCurrency: data.demurrageCurrency !== undefined
                    ? data.demurrageCurrency
                    : (data.demurrage_currency !== undefined ? data.demurrage_currency : undefined),
                demurrageSource: data.demurrageSource !== undefined
                    ? data.demurrageSource
                    : (data.demurrage_source !== undefined ? data.demurrage_source : undefined),
                demurrageUpdatedAt: data.demurrageUpdatedAt !== undefined
                    ? parseDate(data.demurrageUpdatedAt)
                    : (data.demurrage_updated_at !== undefined
                        ? parseDate(data.demurrage_updated_at)
                        : (data.demurrageRate !== undefined || data.demurrage_rate !== undefined || data.operationalInfo !== undefined || data.operational_info !== undefined)
                            ? new Date()
                            : undefined),
            }
        });
        await tryAuditLog(
            session.user.id,
            session.user.name || "Unknown",
            "UPDATE",
            shipment.id,
            JSON.stringify(data)
        );

        // Optional push to Sheets for backup/export
        await triggerPush();

        return NextResponse.json({ success: true, shipment });
    } catch (error) {
        console.error("PUT /api/memory/shipments error:", error);
        return NextResponse.json({ error: "Failed to update shipment", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const url = new URL(req.url);
        const id = url.searchParams.get("id");
        if (!id) return NextResponse.json({ error: "ID missing" }, { status: 400 });

        const existing = await prisma.shipmentDetail.findUnique({ where: { id } });
        if (!existing || existing.isDeleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

        // DATABASE-FIRST: Delete from database as primary source
        await prisma.shipmentDetail.update({ where: { id }, data: { isDeleted: true } });
        await tryAuditLog(
            session.user.id,
            session.user.name || "Unknown",
            "DELETE",
            id,
            JSON.stringify({ isDeleted: true })
        );

        // Optional push to Sheets for backup/export
        await triggerPush();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/memory/shipments error:", error);
        return NextResponse.json({ error: "Failed to delete shipment", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}
