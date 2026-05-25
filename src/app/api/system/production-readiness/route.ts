import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { isExecutiveRole } from "@/lib/role-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CheckStatus = "pass" | "warn" | "fail";

type ReadinessCheck = {
  key: string;
  label: string;
  status: CheckStatus;
  message: string;
};

const requiredEnv = ["DATABASE_URL", "NEXTAUTH_SECRET"];

const expectedMigrations = [
  "20260326041512_init",
  "20260417093000_harden_public_rls",
  "20260421133929_init",
  "20260502083300_add_risk_analysis",
  "20260507120000_ongoing_feature_completion",
  "20260507153000_partner_due_diligence",
  "20260507161000_project_documents",
  "20260521090000_add_source_stock_locations",
  "20260521120000_shipment_documents_and_si_finance",
  "20260522090000_add_market_price_history",
  "20260524093000_quality_workflow_sections",
  "20260524094500_payment_document_links",
  "20260524100000_quality_document_links",
  "20260524102000_project_supplier_candidates",
  "20260524104500_shipment_commercial_reference_docs",
  "20260524110000_shipment_source_confirmation",
  "20260524112000_pnl_cost_components",
  "20260525093000_domestic_handover_tracking",
  "20260525103000_daily_delivery_documents",
  "20260525113000_approval_request",
  "20260525123000_document_object_storage",
  "20260525160000_project_fco_feedback_history",
];

const expectedSchema: Record<string, string[]> = {
  ProjectItem: [
    "fcoHistory",
    "buyerFeedbackHistory",
    "approvalHistory",
    "revisionHistory",
    "roughPnl",
    "blendingScenario",
  ],
  ProjectSupplierCandidate: ["selected", "fitScore", "priceUsd", "warningText", "selectedAt", "selectedByName"],
  ProjectDocument: ["storageProvider", "storageKey", "storageUrl"],
  ShipmentDetail: [
    "forecastSalesId",
    "forecastSalesName",
    "fcoNumber",
    "commercialMomDocumentId",
    "commercialPoDocumentId",
    "royaltyCost",
    "taxExportCost",
    "surveyCost",
    "paymentFinanceCost",
    "sourceConfirmationStatus",
    "sourceConfirmationDocumentId",
    "sourceLegalReadinessStatus",
    "sourceCargoReadinessStatus",
  ],
  ShipmentDocument: ["storageProvider", "storageKey", "storageUrl", "version", "replacedByDocumentId"],
  DailyDeliveryDocument: ["storageProvider", "storageKey", "storageUrl"],
  DailyDelivery: [
    "skabSupplierSentAt",
    "skabEvidenceDocumentId",
    "dsrSupplierSentAt",
    "dsrEvidenceDocumentId",
    "blCmEvidenceDocumentId",
    "coaPolEvidenceDocumentId",
    "coaPodEvidenceDocumentId",
    "fullSetDocumentStatus",
    "hardcopyStatus",
    "softcopyStatus",
  ],
  ShipmentDocumentChecklistItem: ["expectedDate", "receivedDate", "submittedDate", "hardcopyStatus"],
  ShipmentIssueLog: ["category", "impact", "action", "pic", "targetDate", "status", "evidence"],
  ShipmentSourceChangeRequest: ["oldSource", "newSource", "reason", "evidence", "status", "version", "active", "approvalComment"],
  ShipmentBargeChangeLog: ["oldMv", "oldTb", "oldBg", "oldNomination", "newMv", "newTb", "newBg", "newNomination", "reason", "evidence", "status", "version", "active", "approvalComment"],
  ShippingInstructionRecord: ["siNumber", "version", "status", "earlyApprovalReason", "approvalComment", "cancellationReason", "snapshot"],
  QualityResult: ["contractSpec", "sourceEstimate", "qcResult", "qcDocumentId", "psiResult", "psiDocumentId", "coaPolResult", "coaPolDocumentId", "coaPodResult", "coaPodDocumentId", "comparisonStatus"],
  OutstandingPayment: ["shipmentId", "invoiceNumber", "invoiceDocumentId", "paymentProofDocumentId", "dueDate", "disputeStatus"],
  PLForecast: ["freightCost", "royaltyCost", "taxCost", "surveyCost", "paymentCost", "otherCost"],
  ApprovalRequest: ["kind", "status", "priority", "dueAt", "sourceEntity"],
  AuditLog: ["action", "entity", "details", "createdAt"],
};

function envPresent(name: string) {
  return Boolean(String(process.env[name] || "").trim());
}

function check(key: string, label: string, status: CheckStatus, message: string): ReadinessCheck {
  return { key, label, status, message };
}

async function tableExists(table: string) {
  const safe = table.replace(/"/g, "");
  const rows = await prisma.$queryRawUnsafe<Array<{ reg: string | null }>>(
    `SELECT to_regclass('public."${safe}"')::text AS reg`,
  );
  return Boolean(rows[0]?.reg);
}

async function existingColumns(table: string) {
  const safe = table.replace(/"/g, "");
  const rows = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${safe}'`,
  );
  return new Set(rows.map((row) => row.column_name));
}

async function appliedMigrationNames() {
  const hasMigrationTable = await tableExists("_prisma_migrations");
  if (!hasMigrationTable) return null;
  const rows = await prisma.$queryRaw<Array<{
    migration_name: string;
    finished_at: Date | null;
    rolled_back_at: Date | null;
  }>>`SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"`;
  return rows
    .filter((row) => row.finished_at && !row.rolled_back_at)
    .map((row) => row.migration_name);
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isExecutiveRole(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const checks: ReadinessCheck[] = [];

  for (const name of requiredEnv) {
    checks.push(check(
      `env:${name}`,
      `Environment ${name}`,
      envPresent(name) ? "pass" : "fail",
      envPresent(name) ? "Configured" : "Missing required production environment variable",
    ));
  }

  const storageProvider = String(process.env.DOCUMENT_STORAGE_PROVIDER || "database").toLowerCase();
  if (storageProvider === "supabase") {
    const storageEnv = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_STORAGE_BUCKET"];
    for (const name of storageEnv) {
      checks.push(check(
        `env:${name}`,
        `Storage ${name}`,
        envPresent(name) ? "pass" : "fail",
        envPresent(name) ? "Configured" : "Required when DOCUMENT_STORAGE_PROVIDER=supabase",
      ));
    }
  } else if (storageProvider !== "database") {
    checks.push(check(
      "storage:provider",
      "Document storage provider",
      "fail",
      `Unsupported DOCUMENT_STORAGE_PROVIDER value: ${storageProvider}`,
    ));
  } else {
    checks.push(check(
      "storage:provider",
      "Document storage provider",
      "warn",
      "Using database-backed document storage. Good for testing; Supabase Storage is recommended for production durability.",
    ));
  }

  checks.push(check(
    "env:NEXTAUTH_URL",
    "Environment NEXTAUTH_URL",
    envPresent("NEXTAUTH_URL") ? "pass" : "warn",
    envPresent("NEXTAUTH_URL") ? "Configured" : "Recommended for stable production auth callbacks on Vercel",
  ));

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.push(check("db:connect", "Database connection", "pass", "Database query succeeded"));
  } catch (error) {
    checks.push(check(
      "db:connect",
      "Database connection",
      "fail",
      error instanceof Error ? error.message : "Database query failed",
    ));
  }

  try {
    const applied = await appliedMigrationNames();
    if (!applied) {
      checks.push(check(
        "migrations:table",
        "Prisma migration table",
        "warn",
        "_prisma_migrations table was not found. Schema column checks will still run, but migration history cannot be verified.",
      ));
    } else {
      const appliedSet = new Set(applied);
      const missing = expectedMigrations.filter((name) => !appliedSet.has(name));
      checks.push(check(
        "migrations:expected",
        "Expected Prisma migrations",
        missing.length ? "fail" : "pass",
        missing.length
          ? `Missing applied migrations: ${missing.join(", ")}`
          : `All ${expectedMigrations.length} expected migrations are applied`,
      ));
    }
  } catch (error) {
    checks.push(check(
      "migrations:expected",
      "Expected Prisma migrations",
      "fail",
      error instanceof Error ? error.message : "Migration history check failed",
    ));
  }

  for (const [table, columns] of Object.entries(expectedSchema)) {
    try {
      const exists = await tableExists(table);
      if (!exists) {
        checks.push(check(`table:${table}`, `Table ${table}`, "fail", "Table is missing"));
        continue;
      }
      checks.push(check(`table:${table}`, `Table ${table}`, "pass", "Table exists"));
      const present = await existingColumns(table);
      const missing = columns.filter((column) => !present.has(column));
      checks.push(check(
        `columns:${table}`,
        `Columns ${table}`,
        missing.length ? "fail" : "pass",
        missing.length ? `Missing columns: ${missing.join(", ")}` : "Expected production columns exist",
      ));
    } catch (error) {
      checks.push(check(
        `schema:${table}`,
        `Schema ${table}`,
        "fail",
        error instanceof Error ? error.message : "Schema check failed",
      ));
    }
  }

  const failed = checks.filter((item) => item.status === "fail").length;
  const warnings = checks.filter((item) => item.status === "warn").length;
  const overall: CheckStatus = failed ? "fail" : warnings ? "warn" : "pass";

  return NextResponse.json({
    success: true,
    generatedAt: new Date().toISOString(),
    overall,
    summary: {
      total: checks.length,
      pass: checks.filter((item) => item.status === "pass").length,
      warn: warnings,
      fail: failed,
    },
    checks,
  }, { headers: { "Cache-Control": "no-store" } });
}
