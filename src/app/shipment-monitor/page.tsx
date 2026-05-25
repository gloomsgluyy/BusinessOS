"use client";

import React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useCommercialStore } from "@/store/commercial-store";
import { useDailyDeliveryStore } from "@/store/daily-delivery-store";
import { SHIPMENT_STATUSES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { DailyDeliveryDocument, ProjectDocument, ShipmentBargeChangeLog, ShipmentDetail, ShipmentDocument, ShipmentDocumentChecklistItem, ShipmentDocumentGroup, ShipmentIssueLog, ShipmentSourceChangeRequest, ShipmentStatus, ShippingInstructionRecord } from "@/types";
import {
    Ship, Calendar, Plus, ExternalLink, Activity, Anchor, FileText, CheckCircle2,
    AlertTriangle, Package, DollarSign, TrendingUp, Filter, Search, Edit, Trash2, X, Download, Truck, Droplets, Flame, Beaker, Clock, ShieldCheck, CloudLightning, Leaf, Loader2, Wand2,
    Map as MapIcon, MapPin, ChevronUp, ChevronDown, Eye, List, Info, CreditCard, UploadCloud, Upload, Save
} from "lucide-react";
import { AIAgent } from "@/lib/ai-agent";
import { ReportModal } from "@/components/shared/report-modal";
import { Toast, ToastType } from "@/components/shared/toast";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { canWriteModuleForRole, normalizeRole } from "@/lib/role-access";

const safeNum = (v: number | null | undefined): number => (v != null && !isNaN(v) ? v : 0);
const safeFmt = (v: number | null | undefined, decimals = 2): string => safeNum(v).toFixed(decimals);
const normalizeKey = (v?: string | null) => (v || "").toUpperCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
const shipmentQty = (s: ShipmentDetail) => safeNum(s.quantity_loaded ?? s.qty_plan ?? s.qty_cob);
const shipmentSellPrice = (s: ShipmentDetail) => safeNum(s.sales_price ?? s.sp ?? s.harga_actual_fob_mv);
const shipmentBuyPrice = (s: ShipmentDetail) => safeNum(s.buying_price ?? s.harga_actual_fob ?? s.hpb);
const shipmentCostPerMt = (s: ShipmentDetail) =>
    shipmentBuyPrice(s) +
    safeNum(s.price_freight ?? s.shipping_rate) +
    safeNum(s.royalty_cost) +
    safeNum(s.tax_export_cost) +
    safeNum(s.survey_cost) +
    safeNum(s.payment_finance_cost);
const shipmentMargin = (s: ShipmentDetail) => {
    const manualMargin = safeNum(s.margin_mt);
    if (manualMargin) return manualMargin;
    const sell = shipmentSellPrice(s);
    const buy = shipmentBuyPrice(s);
    return sell && buy ? sell - buy : 0;
};
const monthToNumber: Record<string, number> = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
    JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
    MEI: 4, AGU: 7, OKT: 9, DES: 11,
};

const DOCUMENT_ACCEPT = "image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.docx,.jpg,.jpeg,.png,.webp,.gif";

const formatShortDate = (value?: string | null) => value ? new Date(value).toLocaleDateString() : "-";
const daysSince = (value?: string | null) => {
    if (!value) return 0;
    const start = new Date(value).setHours(0, 0, 0, 0);
    const today = new Date().setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor((today - start) / 86400000));
};

const getDomesticHandoverSummary = (d: any) => {
    const tracks = [
        { label: "SKAB", done: d.skab_finance_received_at, last: d.skab_traffic_sent_finance_at || d.skab_traffic_received_at || d.skab_operation_sent_at || d.skab_operation_received_at || d.skab_supplier_sent_at, stuck: d.skab_finance_received_at ? "Finance received" : d.skab_traffic_sent_finance_at ? "Finance" : d.skab_traffic_received_at ? "Traffic" : d.skab_operation_received_at ? "Operation" : d.skab_supplier_sent_at ? "Operation" : "Supplier" },
        { label: "DSR", done: d.dsr_traffic_received_at, last: d.dsr_operation_sent_at || d.dsr_operation_received_at || d.dsr_supplier_sent_at, stuck: d.dsr_traffic_received_at ? "Traffic received" : d.dsr_operation_sent_at ? "Traffic" : d.dsr_operation_received_at ? "Operation" : d.dsr_supplier_sent_at ? "Operation" : "Supplier" },
        { label: "BL/CM", done: d.bl_cm_finance_received_at, last: d.bl_cm_traffic_sent_finance_at || d.bl_cm_traffic_received_at || d.bl_cm_operation_sent_at || d.bl_date, stuck: d.bl_cm_finance_received_at ? "Finance received" : d.bl_cm_traffic_sent_finance_at ? "Finance" : d.bl_cm_traffic_received_at ? "Traffic" : d.bl_cm_operation_sent_at ? "Traffic" : "Operation" },
        { label: "COA POL", done: d.coa_pol_finance_received_at, last: d.coa_pol_traffic_received_at || d.coa_pol_surveyor_sent_at || d.coa_pol_date, stuck: d.coa_pol_finance_received_at ? "Finance received" : d.coa_pol_traffic_received_at ? "Finance" : d.coa_pol_surveyor_sent_at ? "Traffic" : "Surveyor" },
        { label: "COA POD", done: d.vendor_paid_at || d.vendor_received_full_set_at, last: d.approval_dt_at || d.vendor_received_full_set_at || d.finance_submit_full_set_at || d.coa_pod_received_at, stuck: d.vendor_paid_at ? "Paid" : d.approval_dt_at ? "Vendor payment" : d.vendor_received_full_set_at ? "Approval DT" : d.finance_submit_full_set_at ? "Vendor" : d.coa_pod_received_at ? "Finance" : "Quality/Traffic" },
    ];
    const completed = tracks.filter((track) => track.done).length;
    const active = tracks.find((track) => !track.done && track.last) || tracks.find((track) => !track.done);
    return {
        completed,
        total: tracks.length,
        activeLabel: active?.label || "Complete",
        stuckAt: active?.stuck || "Complete",
        agingDays: active?.last ? daysSince(active.last) : 0,
        tracks,
    };
};

const SHIPMENT_REQUIRED_DOCUMENTS = [
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

const CHECKLIST_STATUS_OPTIONS = [
    { value: "pending", label: "Pending" },
    { value: "received", label: "Received" },
    { value: "submitted", label: "Submitted" },
    { value: "completed", label: "Completed" },
    { value: "not_required", label: "Not Required" },
    { value: "rejected", label: "Rejected" },
];

const HARDCOPY_STATUS_OPTIONS = [
    { value: "", label: "Hardcopy -" },
    { value: "pending", label: "Pending" },
    { value: "received", label: "Received" },
    { value: "submitted", label: "Submitted" },
    { value: "archived", label: "Archived" },
    { value: "not_required", label: "Not Required" },
];

type DocumentUploadDraft = {
    title: string;
    status: string;
    notes: string;
    file: File | null;
};

const parseFlexibleDate = (value?: string | null): Date | null => {
    if (!value) return null;
    const raw = String(value).trim();
    if (!raw) return null;

    const direct = new Date(raw);
    if (!Number.isNaN(direct.getTime())) return direct;

    const dmY = raw.match(/^(\d{1,2})\s*[-\/]?\s*([A-Za-z]{3,})(?:\s+(\d{2,4}))?$/);
    if (dmY) {
        const day = Number(dmY[1]);
        const monthKey = dmY[2].slice(0, 3).toUpperCase();
        const month = monthToNumber[monthKey];
        const yearPart = dmY[3] ? Number(dmY[3]) : null;
        if (month !== undefined && yearPart) {
            const year = yearPart < 100 ? 2000 + yearPart : yearPart;
            const d = new Date(year, month, day);
            if (!Number.isNaN(d.getTime())) return d;
        }
    }

    return null;
};

const parseYearFromLaycan = (laycan?: string | null): number | null => {
    if (!laycan) return null;
    const m = String(laycan).match(/\b(19|20)\d{2}\b/);
    return m ? Number(m[0]) : null;
};

const getShipmentYear = (s: ShipmentDetail): number | null => {
    if (s.year && Number.isFinite(s.year)) return s.year;
    const byLaycan = parseYearFromLaycan(s.laycan);
    if (byLaycan) return byLaycan;
    const byBl = parseFlexibleDate(s.bl_date);
    if (byBl) return byBl.getFullYear();
    const byCreated = parseFlexibleDate(s.created_at);
    if (byCreated) return byCreated.getFullYear();
    return null;
};

const getShipmentDate = (s: ShipmentDetail): Date | null => {
    const byBl = parseFlexibleDate(s.bl_date);
    if (byBl) return byBl;
    const byEta = parseFlexibleDate(s.eta);
    if (byEta) return byEta;
    const byCreated = parseFlexibleDate(s.created_at);
    if (byCreated) return byCreated;
    return null;
};

const formatLaycanWithYear = (s: ShipmentDetail): string => {
    if (!s.laycan) {
        const d = getShipmentDate(s);
        return d
            ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
            : "-";
    }
    const laycanRaw = String(s.laycan).trim();
    if (/\b(19|20)\d{2}\b/.test(laycanRaw)) return laycanRaw;
    const y = getShipmentYear(s);
    return y ? `${laycanRaw} ${y}` : laycanRaw;
};

const toDateInputValue = (value?: string | null): string => {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

const getDaysBetween = (from?: string | null, to = new Date()): number | null => {
    if (!from) return null;
    const date = new Date(from);
    if (Number.isNaN(date.getTime())) return null;
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const end = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
    return Math.floor((end - start) / 86400000);
};

const getChecklistAging = (item?: ShipmentDocumentChecklistItem | null) => {
    if (!item) return { label: "Pending target date", tone: "muted" as const };
    const status = (item.status || "pending").toLowerCase();
    if (status === "completed" || status === "not_required") return { label: "No aging", tone: "ok" as const };
    if (status === "pending") {
        const days = getDaysBetween(item.expectedDate);
        if (days === null) return { label: "Pending target date", tone: "muted" as const };
        if (days > 0) return { label: `Overdue ${days}d`, tone: "danger" as const };
        if (days === 0) return { label: "Due today", tone: "warn" as const };
        return { label: `Due in ${Math.abs(days)}d`, tone: "ok" as const };
    }
    if (status === "received") {
        const days = getDaysBetween(item.receivedDate);
        return { label: days === null ? "Received date empty" : `Received aging ${days}d`, tone: days !== null && days > 3 ? "warn" as const : "muted" as const };
    }
    if (status === "submitted") {
        const days = getDaysBetween(item.submittedDate);
        return { label: days === null ? "Submitted date empty" : `Submitted aging ${days}d`, tone: days !== null && days > 3 ? "warn" as const : "muted" as const };
    }
    return { label: "Need review", tone: status === "rejected" ? "danger" as const : "muted" as const };
};

const isShipmentClosingStatus = (value?: string | null): boolean => {
    const status = normalizeKey(value || "");
    return status.includes("COMPLETED") || status.includes("DONE_SHIPMENT") || status.includes("DONE") || status.includes("CLOSED") || status.includes("DISCHARGED");
};

const getDocumentClosingBlockers = (items: ShipmentDocumentChecklistItem[]) => {
    const ready = new Set(["submitted", "completed", "not_required"]);
    return items
        .filter((item) => item.documentGroup === "required" && item.required !== false && !ready.has((item.status || "pending").toLowerCase()))
        .map((item) => `${item.requirementCode ? `${item.requirementCode}. ` : ""}${item.requirementLabel} (${(item.status || "pending").replace("_", " ")})`);
};

const getSiClosingBlockers = (records: ShippingInstructionRecord[]) => {
    const ready = records.some((record) => ["approved", "generated"].includes((record.status || "").toLowerCase()));
    if (ready) return [];
    if (records.length === 0) return ["Shipping Instruction has not been recorded."];
    const latest = [...records].sort((a, b) => b.version - a.version)[0];
    return [`Latest SI ${latest.siNumber} v${latest.version} is ${latest.status}.`];
};

const isExportType = (s: ShipmentDetail): boolean => {
    const t = normalizeKey(s.type || s.export_dmo || "");
    if (t.includes("LOCAL") || t.includes("DMO") || t.includes("DOMESTIC")) return false;
    return true;
};

const getCounterparty = (s: ShipmentDetail): { role: "Buyer" | "Vendor"; value: string } => {
    const buyer = (s.buyer || "").trim();
    const vendor = (s.source || s.supplier || s.iup_op || "").trim();
    if (isExportType(s)) {
        return { role: "Buyer", value: buyer || vendor || "-" };
    }
    return { role: "Vendor", value: vendor || buyer || "-" };
};

const hasUsefulText = (...values: unknown[]): boolean =>
    values.some((value) => {
        const text = String(value ?? "").replace(/\s+/g, " ").trim();
        if (!text) return false;
        return !["-", "N/A", "NA", "TBA", "TBD", "UNKNOWN", "NULL", "0"].includes(text.toUpperCase());
    });

const hasUsefulNumber = (...values: unknown[]): boolean =>
    values.some((value) => {
        const number = Number(value);
        return Number.isFinite(number) && number > 0;
    });

const isReadyStatus = (value: unknown, allowed: string[]) => {
    const status = normalizeKey(String(value || ""));
    return allowed.some((item) => status.includes(item));
};

const getCommercialClosingBlockers = (shipment: Partial<ShipmentDetail>) => {
    const blockers: string[] = [];
    const paymentReady = isReadyStatus(shipment.payment_status, ["PAID", "SETTLED", "COMPLETED", "COMPLETE", "NOT_REQUIRED", "N/A"]);
    if (!paymentReady) blockers.push(`Payment status is ${shipment.payment_status || "empty"}`);
    if (!hasUsefulText(shipment.no_invoice_mkls)) blockers.push("Invoice number is missing");
    if (!hasUsefulNumber(shipment.quantity_loaded, shipment.qty_plan, shipment.qty_cob)) blockers.push("Final/loaded quantity is missing");
    if (!hasUsefulNumber(shipment.sales_price, shipment.sp, shipment.harga_actual_fob_mv)) blockers.push("Sales price is missing");
    if (!hasUsefulNumber(shipment.buying_price, shipment.harga_actual_fob, shipment.hpb)) blockers.push("Buying price is missing");
    return blockers;
};

const getQualityClosingBlockers = (shipment: Partial<ShipmentDetail>) => {
    const qualityReady = isReadyStatus(shipment.quality_status, ["PASSED", "APPROVED", "ACCEPTED", "COMPLETED", "COMPLETE", "NOT_REQUIRED"]);
    const qualityNotRequired = isReadyStatus(shipment.quality_status, ["NOT_REQUIRED", "N/A"]);
    const hasResult = hasUsefulNumber(shipment.result_gar) || hasUsefulText(shipment.coa_date);
    if (!qualityReady) return [`Quality status is ${shipment.quality_status || "empty"}`];
    if (!qualityNotRequired && !hasResult) return ["Quality evidence is missing"];
    return [];
};

const getIssueClosingBlockers = (shipment: Partial<ShipmentDetail>) => {
    const text = [shipment.status_reason, shipment.issue_notes, shipment.remarks]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .join(" ");
    if (!/(pending|waiting|delay|issue|problem|hold|claim|dispute|short|loss|not clear|belum|menunggu|kendala)/i.test(text)) return [];
    if (isReadyStatus(shipment.issue_status, ["RESOLVED", "CLOSED", "CLEARED", "DONE", "NOT_REQUIRED", "N/A"])) return [];
    return [`Issue status is ${shipment.issue_status || "empty"}`];
};

const getStructuredIssueClosingBlockers = (issues: ShipmentIssueLog[] = []) =>
    issues
        .filter((issue) => !["resolved", "closed", "not_required"].includes((issue.status || "").toLowerCase()))
        .map((issue) => `Issue Log: ${issue.category} is ${issue.status || "open"}`);

const getSourceChangeClosingBlockers = (changes: ShipmentSourceChangeRequest[] = []) =>
    changes
        .filter((change) => (change.status || "").toLowerCase() === "pending")
        .map((change) => `Source Change: v${change.version} ${change.oldSource || "-"} -> ${change.newSource} is pending`);

const getSourceConfirmationClosingBlockers = (shipment: Partial<ShipmentDetail>) => {
    const blockers: string[] = [];
    const status = shipment.source_confirmation_status;
    const legal = shipment.source_legal_readiness_status;
    const cargo = shipment.source_cargo_readiness_status;
    if (status && !isReadyStatus(status, ["CONFIRMED", "APPROVED", "READY", "NOT_REQUIRED", "N/A"])) blockers.push(`Source confirmation is ${status}`);
    if (legal && !isReadyStatus(legal, ["READY", "CLEARED", "APPROVED", "NOT_REQUIRED", "N/A"])) blockers.push(`Source legal readiness is ${legal}`);
    if (cargo && !isReadyStatus(cargo, ["READY", "CLEARED", "APPROVED", "NOT_REQUIRED", "N/A"])) blockers.push(`Source cargo readiness is ${cargo}`);
    if (isReadyStatus(status, ["CONFIRMED", "APPROVED", "READY"]) && !shipment.source_confirmation_document_id) blockers.push("Source confirmation evidence is missing");
    return blockers;
};

const getBargeChangeClosingBlockers = (changes: ShipmentBargeChangeLog[] = []) =>
    changes
        .filter((change) => (change.status || "").toLowerCase() === "pending")
        .map((change) => `Barge Change: v${change.version} pending`);

const getShipmentClosingBlockers = (
    shipment: Partial<ShipmentDetail>,
    checklist: ShipmentDocumentChecklistItem[],
    siRecords: ShippingInstructionRecord[],
    issues: ShipmentIssueLog[] = [],
    sourceChanges: ShipmentSourceChangeRequest[] = [],
    bargeChanges: ShipmentBargeChangeLog[] = [],
) => [
    ...getDocumentClosingBlockers(checklist).map((item) => `Document: ${item}`),
    ...getSiClosingBlockers(siRecords).map((item) => `SI: ${item}`),
    ...getCommercialClosingBlockers(shipment).map((item) => `Commercial: ${item}`),
    ...getQualityClosingBlockers(shipment).map((item) => `Quality: ${item}`),
    ...getIssueClosingBlockers(shipment).map((item) => `Issue: ${item}`),
    ...getStructuredIssueClosingBlockers(issues),
    ...getSourceChangeClosingBlockers(sourceChanges),
    ...getSourceConfirmationClosingBlockers(shipment),
    ...getBargeChangeClosingBlockers(bargeChanges),
];

const getShipmentCompleteness = (shipment: ShipmentDetail) => {
    const checks = [
        { label: "Forecast Sales/MV", filled: hasUsefulText(shipment.mv_project_name, shipment.forecast_sales_name, shipment.vessel_name) },
        { label: "Buyer/Vendor", filled: hasUsefulText(shipment.buyer, shipment.supplier, shipment.source, shipment.iup_op) },
        { label: "Source confirmation", filled: hasUsefulText(shipment.source_confirmation_status) || hasUsefulText(shipment.source_confirmation_document_id) },
        { label: "Product", filled: hasUsefulText(shipment.product) },
        { label: "Export/DMO Type", filled: hasUsefulText(shipment.export_dmo, shipment.type) },
        { label: "Vessel/Nomination", filled: hasUsefulText(shipment.vessel_name, shipment.nomination, shipment.barge_name) },
        { label: "Load Port", filled: hasUsefulText(shipment.jetty_loading_port, shipment.loading_port) },
        { label: "Discharge Port", filled: hasUsefulText(shipment.discharge_port) },
        { label: "Laycan", filled: hasUsefulText(shipment.laycan) },
        { label: "Planned Quantity", filled: hasUsefulNumber(shipment.qty_plan, shipment.quantity_loaded, shipment.qty_cob) },
        { label: "Sales Price", filled: hasUsefulNumber(shipment.sales_price, shipment.sp, shipment.harga_actual_fob_mv) },
        { label: "Buying Price", filled: hasUsefulNumber(shipment.buying_price, shipment.harga_actual_fob, shipment.hpb) },
        { label: "Shipping Term", filled: hasUsefulText(shipment.shipping_term) },
        { label: "Surveyor", filled: hasUsefulText(shipment.surveyor_lhv) },
        { label: "PIC", filled: hasUsefulText(shipment.pic, shipment.pic_name) },
        { label: "Status Reason/Remarks", filled: hasUsefulText(shipment.status_reason, shipment.remarks, shipment.issue_notes) },
    ];
    const filled = checks.filter((item) => item.filled).length;
    return {
        percent: Math.round((filled / checks.length) * 100),
        filled,
        total: checks.length,
        missing: checks.filter((item) => !item.filled).map((item) => item.label),
    };
};

const completenessClass = (percent: number) =>
    percent >= 85
        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/25"
        : percent >= 60
            ? "bg-amber-500/10 text-amber-700 border-amber-500/25"
            : "bg-rose-500/10 text-rose-600 border-rose-500/25";

type SummaryStatus = "upcoming" | "loading" | "in_transit" | "completed" | "cancelled" | "unknown";

const normalizeShipmentStatus = (raw?: string | null): SummaryStatus => {
    const s = normalizeKey(raw);
    if (!s) return "unknown";

    if (s.includes("CANCEL")) return "cancelled";

    if (
        s.includes("DONE") ||
        s.includes("COMPLETE") ||
        s.includes("COMPLETELY") ||
        s.includes("DISCHARGED") ||
        s === "DONE SHIPMENT"
    ) return "completed";

    if (s.includes("IN TRANSIT") || s.includes("ANCHORAGE") || s.includes("DISCH")) return "in_transit";
    if (s.includes("LOADING PROCESS") || s.includes("LOADING PROSES") || s === "LOADING") return "loading";
    if (s.includes("UPCOMING") || s.includes("WAITING") || s.includes("DRAFT") || s.includes("PLANNED")) return "upcoming";

    return "unknown";
};

function parseNominationEntries(value?: string | null): string[] {
    const raw = String(value || "").replace(/\r/g, "\n").trim();
    if (!raw) return [];

    const normalized = raw
        .replace(/\s+/g, " ")
        .replace(/\s+i\s*[\.\/]?\s*o\s*\.?\s+/gi, " | ")
        .replace(/\n+/g, " | ");

    const entries = normalized
        .split("|")
        .map((x) => x.trim().replace(/^[-,.;:]+/, "").trim())
        .filter(Boolean);

    const unique: string[] = [];
    for (const e of entries) {
        if (!unique.some((u) => normalizeKey(u) === normalizeKey(e))) unique.push(e);
    }
    return unique;
}

function NominationDisplay({
    value,
    compact = false,
}: {
    value?: string | null;
    compact?: boolean;
}) {
    const entries = React.useMemo(() => parseNominationEntries(value), [value]);
    const [open, setOpen] = React.useState(false);

    if (entries.length === 0) {
        return <p className="font-semibold text-foreground break-words">-</p>;
    }

    const primary = entries[0];
    const extra = Math.max(0, entries.length - 1);
    const summary = extra > 0 ? `${primary} (+${extra} more)` : primary;

    if (compact) {
        return (
            <div className="space-y-1">
                <p className="font-semibold text-foreground break-words">{summary}</p>
                {extra > 0 && (
                    <button
                        type="button"
                        onClick={() => setOpen((v) => !v)}
                        className="text-[10px] font-semibold text-primary hover:underline"
                    >
                        {open ? "Hide list" : "Show list"}
                    </button>
                )}
                {open && (
                    <ul className="space-y-1">
                        {entries.map((entry, idx) => (
                            <li key={`${entry}-${idx}`} className="text-[11px] text-foreground/90 break-words">
                                {idx + 1}. {entry}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        );
    }

    return <p className="font-semibold text-foreground break-words">{summary}</p>;
}

function ExpandableText({
    text,
    maxChars = 120,
    className = "",
}: {
    text?: string | null;
    maxChars?: number;
    className?: string;
}) {
    const [expanded, setExpanded] = React.useState(false);
    const normalized = String(text || "-").replace(/\s+/g, " ").trim();

    if (normalized.length <= maxChars) {
        return <p className={className}>{normalized}</p>;
    }

    const compact = `${normalized.slice(0, maxChars).trimEnd()}...`;

    return (
        <div className="space-y-1">
            <p className={className}>{expanded ? normalized : compact}</p>
            <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="text-[10px] font-semibold text-primary hover:underline"
            >
                {expanded ? "Show less" : "Show more"}
            </button>
        </div>
    );
}

export default function ShipmentMonitorPage() {
    const [, setIsInitializing] = React.useState(false);
    const { data: session } = useSession();
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const didApplyDeepLinkRef = React.useRef<string | null>(null);
    const didApplyTabFromUrlRef = React.useRef(false);
    const didApplyMainTabFromUrlRef = React.useRef(false);
    const didApplyDailyDeepLinkRef = React.useRef<string | null>(null);
    const openedViaDeepLinkRef = React.useRef(false);
    const openedDailyViaDeepLinkRef = React.useRef(false);

    const { shipments, projects, syncFromMemory, marketPrices, sources, addShipment, updateShipment, deleteShipment } = useCommercialStore();
    const { dailyDeliveries, syncDeliveries, addDelivery, updateDelivery, deleteDelivery } = useDailyDeliveryStore();

    React.useEffect(() => {
        syncFromMemory().finally(() => setIsInitializing(false));
        syncDeliveries();
    }, [syncFromMemory, syncDeliveries]);
    const [mainTab, setMainTab] = React.useState<"MV Barge" | "Daily Delivery" | "Route Optimizer" | "Analytics" | "Risk Assessment">("MV Barge");
    const [activeTab, setActiveTab] = React.useState<"all" | "upcoming" | "loading" | "in_transit" | "completed" | "cancelled">("all");
    const [activeView, setActiveView] = React.useState<"list" | "card" | "map">("list");
    const [highlightedDailyId, setHighlightedDailyId] = React.useState<string | null>(null);
    const [detailShipment, setDetailShipment] = React.useState<ShipmentDetail | null>(null);
    const [detailModalTab, setDetailModalTab] = React.useState<"overview" | "documents" | "blending" | "timeline" | "risk">("overview");
    const [showChildBargeDetails, setShowChildBargeDetails] = React.useState(false);
    const [editShipment, setEditShipment] = React.useState<ShipmentDetail | null>(null);
    const [editForm, setEditForm] = React.useState<Partial<ShipmentDetail>>({});
    const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = React.useState("");
    const [yearFilter, setYearFilter] = React.useState<string>("all");
    const [dateFrom, setDateFrom] = React.useState("");
    const [dateTo, setDateTo] = React.useState("");
    const [sortBy, setSortBy] = React.useState<"latest" | "oldest" | "qty_desc" | "qty_asc" | "risk_desc" | "risk_asc">("latest");
    const [showReportModal, setShowReportModal] = React.useState(false);

    React.useEffect(() => {
        setShowChildBargeDetails(false);
    }, [detailShipment?.id]);

    React.useEffect(() => {
        if (didApplyTabFromUrlRef.current) return;
        const tabParam = (searchParams.get("tab") || "").toLowerCase();
        const validTabs = new Set(["all", "upcoming", "loading", "in_transit", "completed", "cancelled"]);
        if (validTabs.has(tabParam)) {
            setActiveTab(tabParam as "all" | "upcoming" | "loading" | "in_transit" | "completed" | "cancelled");
        }
        didApplyTabFromUrlRef.current = true;
    }, [searchParams]);

    React.useEffect(() => {
        if (didApplyMainTabFromUrlRef.current) return;
        const mainParam = (searchParams.get("main") || searchParams.get("view") || "").toLowerCase();
        if (["daily", "daily_delivery", "delivery", "domestic"].includes(mainParam)) {
            setMainTab("Daily Delivery");
        }
        didApplyMainTabFromUrlRef.current = true;
    }, [searchParams]);

    React.useEffect(() => {
        const openId = searchParams.get("open");
        if (!openId) return;
        if (shipments.length === 0) return;
        if (didApplyDeepLinkRef.current === openId) return;

        const target =
            shipments.find((s) => String(s.id) === openId) ||
            shipments.find((s) => String(s.no || "") === openId);

        if (!target) return;

        setMainTab("MV Barge");
        setDetailShipment(target);
        didApplyDeepLinkRef.current = openId;
        openedViaDeepLinkRef.current = true;
    }, [searchParams, shipments]);

    const closeDetailModal = React.useCallback(() => {
        setDetailShipment(null);
        setShowChildBargeDetails(false);

        if (openedViaDeepLinkRef.current) {
            openedViaDeepLinkRef.current = false;
            didApplyDeepLinkRef.current = null;
            setActiveTab("all");
            router.replace(pathname, { scroll: false });
        }
    }, [router, pathname]);

    React.useEffect(() => {
        if (!detailShipment) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                closeDetailModal();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [detailShipment, closeDetailModal]);

    // Interactive Modal States
    const [showDailyForm, setShowDailyForm] = React.useState(false);
    const [editDailyData, setEditDailyData] = React.useState<any>(null);
    const [dailyHandoverDocuments, setDailyHandoverDocuments] = React.useState<DailyDeliveryDocument[]>([]);
    const [dailyDocumentAction, setDailyDocumentAction] = React.useState<string | null>(null);
    const [dailyForm, setDailyForm] = React.useState<Partial<any>>({
        report_type: "domestic",
        year: 2026,
        buyer: "",
        mv_barge_nomination: "",
        bl_quantity: 0,
        issue: "",
        full_set_document_status: "pending",
        hardcopy_status: "pending",
        softcopy_status: "pending",
    });

    const [activeDailyTab, setActiveDailyTab] = React.useState<"general" | "logistics" | "quality" | "commercial" | "handover">("general");

    const loadDailyHandoverDocuments = React.useCallback(async (dailyDeliveryId: string) => {
        try {
            const res = await fetch(`/api/daily-delivery/${dailyDeliveryId}/documents`, { cache: "no-store" });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || "Failed to load daily delivery documents");
            setDailyHandoverDocuments(Array.isArray(data.documents) ? data.documents : []);
        } catch {
            setDailyHandoverDocuments([]);
        }
    }, []);

    const handleOpenDailyForm = (data?: any) => {
        if (data) {
            setEditDailyData(data);
            setDailyForm({ ...data });
            loadDailyHandoverDocuments(data.id);
        } else {
            setEditDailyData(null);
            setDailyHandoverDocuments([]);
            setDailyForm({
                report_type: "domestic", year: 2026, buyer: "", mv_barge_nomination: "",
                bl_quantity: 0, issue: "", shipment_status: "upcoming", pod: "",
                shipping_term: "FOB", pol: "", area: "", supplier: "", project: "", flow: "",
                full_set_document_status: "pending", hardcopy_status: "pending", softcopy_status: "pending",
            });
        }
        setActiveDailyTab("general");
        setShowDailyForm(true);
    };

    React.useEffect(() => {
        const dailyId = searchParams.get("daily");
        if (!dailyId) return;
        if (dailyDeliveries.length === 0) return;
        if (didApplyDailyDeepLinkRef.current === dailyId) return;

        const target = dailyDeliveries.find((delivery) => String(delivery.id) === dailyId);
        if (!target) return;

        setMainTab("Daily Delivery");
        setHighlightedDailyId(dailyId);
        setEditDailyData(target);
        setDailyForm({ ...target });
        setActiveDailyTab((searchParams.get("dailyTab") || "").toLowerCase() === "handover" ? "handover" : "general");
        setShowDailyForm(true);
        loadDailyHandoverDocuments(target.id);
        didApplyDailyDeepLinkRef.current = dailyId;
        openedDailyViaDeepLinkRef.current = true;
    }, [dailyDeliveries, loadDailyHandoverDocuments, searchParams]);

    const closeDailyForm = React.useCallback(() => {
        setShowDailyForm(false);

        if (openedDailyViaDeepLinkRef.current) {
            openedDailyViaDeepLinkRef.current = false;
            didApplyDailyDeepLinkRef.current = null;
            setHighlightedDailyId(null);
            router.replace(pathname, { scroll: false });
        }
    }, [pathname, router]);

    const handleSaveDaily = async () => {
        setIsSaving(true);
        try {
            if (editDailyData) {
                await updateDelivery(editDailyData.id, dailyForm);
                setToast({ message: "Daily log updated", type: "success" });
            } else {
                await addDelivery(dailyForm as any);
                setToast({ message: "Daily log added", type: "success" });
            }
            closeDailyForm();
        } catch (e) {
            setToast({ message: "Failed to save daily log", type: "error" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteDaily = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Delete this daily log?")) return;
        try {
            await deleteDelivery(id);
            setToast({ message: "Daily log deleted", type: "success" });
        } catch (e) {
            setToast({ message: "Failed to delete log", type: "error" });
        }
    };

    const dailyEvidenceByType = React.useMemo(() => {
        const map = new Map<string, DailyDeliveryDocument[]>();
        dailyHandoverDocuments.forEach((doc) => {
            const list = map.get(doc.documentType) || [];
            list.push(doc);
            map.set(doc.documentType, list);
        });
        return map;
    }, [dailyHandoverDocuments]);

    const uploadDailyHandoverEvidence = async (documentType: string, evidenceField: string, title: string, file: File | null) => {
        if (!file) return;
        if (!editDailyData?.id) {
            setToast({ message: "Save the daily log first before uploading evidence.", type: "error" });
            return;
        }
        if (!canManageShipments) {
            setToast({ message: "You do not have permission to upload domestic handover evidence.", type: "error" });
            return;
        }
        const actionKey = `daily:${documentType}`;
        setDailyDocumentAction(actionKey);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("documentType", documentType);
            formData.append("title", title);
            const res = await fetch(`/api/daily-delivery/${editDailyData.id}/documents`, { method: "POST", body: formData });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || "Upload failed");
            setDailyHandoverDocuments((current) => [data.document, ...current]);
            const patch = { [evidenceField]: data.document.id };
            setDailyForm((current) => ({ ...current, ...patch }));
            await updateDelivery(editDailyData.id, patch);
            setEditDailyData((current: any) => current ? { ...current, ...patch } : current);
            setToast({ message: "Domestic handover evidence uploaded", type: "success" });
        } catch (error: any) {
            setToast({ message: error?.message || "Failed to upload domestic handover evidence", type: "error" });
        } finally {
            setDailyDocumentAction(null);
        }
    };

    const deleteDailyHandoverEvidence = async (doc: DailyDeliveryDocument) => {
        if (!editDailyData?.id || !confirm("Delete this domestic evidence file?")) return;
        setDailyDocumentAction(`daily-delete:${doc.id}`);
        try {
            const res = await fetch(`/api/daily-delivery/${editDailyData.id}/documents/${doc.id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || "Delete failed");
            setDailyHandoverDocuments((current) => current.filter((item) => item.id !== doc.id));
            setToast({ message: "Domestic evidence deleted", type: "success" });
        } catch (error: any) {
            setToast({ message: error?.message || "Failed to delete domestic evidence", type: "error" });
        } finally {
            setDailyDocumentAction(null);
        }
    };


    const [editBlendingMode, setEditBlendingMode] = React.useState(false);
    const [blendingForm, setBlendingForm] = React.useState({ gar: 0, ts: 0, ash: 0, tm: 0 });
    const [aiRiskInsight, setAiRiskInsight] = React.useState<string>(""); // Deprecated
    const [isGeneratingRisk, setIsGeneratingRisk] = React.useState(false);
    const [showMilestoneForm, setShowMilestoneForm] = React.useState(false);
    const [milestoneForm, setMilestoneForm] = React.useState({ title: "", subtitle: "", status: "pending" as "completed" | "current" | "pending" });
    const [isSaving, setIsSaving] = React.useState(false);
    const [toast, setToast] = React.useState<{ message: string; type: ToastType } | null>(null);
    const [shipmentDocuments, setShipmentDocuments] = React.useState<ShipmentDocument[]>([]);
    const [shipmentDocumentChecklist, setShipmentDocumentChecklist] = React.useState<ShipmentDocumentChecklistItem[]>([]);
    const [projectReferenceDocs, setProjectReferenceDocs] = React.useState<ProjectDocument[]>([]);
    const [isLoadingProjectReferenceDocs, setIsLoadingProjectReferenceDocs] = React.useState(false);
    const [isLoadingDocuments, setIsLoadingDocuments] = React.useState(false);
    const [documentAction, setDocumentAction] = React.useState<string | null>(null);
    const [shipmentIssues, setShipmentIssues] = React.useState<ShipmentIssueLog[]>([]);
    const [issueDraft, setIssueDraft] = React.useState({ category: "", impact: "", action: "", pic: "", targetDate: "", status: "open", evidence: "", notes: "" });
    const [issueAction, setIssueAction] = React.useState<string | null>(null);
    const [sourceChanges, setSourceChanges] = React.useState<ShipmentSourceChangeRequest[]>([]);
    const [sourceChangeDraft, setSourceChangeDraft] = React.useState({ newSource: "", reason: "", evidence: "", impact: "" });
    const [sourceChangeAction, setSourceChangeAction] = React.useState<string | null>(null);
    const [bargeChanges, setBargeChanges] = React.useState<ShipmentBargeChangeLog[]>([]);
    const [bargeChangeDraft, setBargeChangeDraft] = React.useState({ newMv: "", newTb: "", newBg: "", newNomination: "", reason: "", evidence: "", impact: "" });
    const [bargeChangeAction, setBargeChangeAction] = React.useState<string | null>(null);
    const [shippingInstructions, setShippingInstructions] = React.useState<ShippingInstructionRecord[]>([]);
    const [isLoadingSiRecords, setIsLoadingSiRecords] = React.useState(false);
    const [siAction, setSiAction] = React.useState(false);
    const [additionalDraft, setAdditionalDraft] = React.useState<DocumentUploadDraft>({ title: "", status: "draft", notes: "", file: null });
    const [criticalDraft, setCriticalDraft] = React.useState<DocumentUploadDraft>({ title: "", status: "draft", notes: "", file: null });
    const [editingDocumentId, setEditingDocumentId] = React.useState<string | null>(null);
    const [editingDocumentDraft, setEditingDocumentDraft] = React.useState({ title: "", status: "draft", notes: "" });
    const [draggingDocumentKey, setDraggingDocumentKey] = React.useState<string | null>(null);
    const normalizedRole = normalizeRole((session?.user as any)?.role);
    const canManageShipments = canWriteModuleForRole((session?.user as any)?.role, "OPERATIONS_TRAFFIC");
    const canAccessCriticalDocuments = Boolean(normalizedRole && ["CEO", "DIRUT", "ASS_DIRUT", "COO"].includes(normalizedRole));
    const canRunRiskAnalysis = Boolean(normalizedRole && [
        "CEO",
        "DIRUT",
        "ASS_DIRUT",
        "COO",
        "ADMIN_OPERATION",
        "TRAFFIC_HEAD",
        "TRAFFIC_TEAM_1",
        "TRAFFIC_TEAM_2",
        "TRAFFIC_TEAM_3",
        "TRAFFIC_TEAM_4",
        "QC_MANAGER",
        "QC_ADMIN_1",
        "QC_ADMIN_2",
    ].includes(normalizedRole));

    const loadShipmentDocuments = React.useCallback(async (shipmentId: string) => {
        setIsLoadingDocuments(true);
        try {
            const res = await fetch(`/api/shipments/${shipmentId}/documents`);
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || "Failed to load shipment documents");
            setShipmentDocuments(data.documents || []);
            setShipmentDocumentChecklist(data.checklistItems || []);
        } catch (error: any) {
            setShipmentDocuments([]);
            setShipmentDocumentChecklist([]);
            setToast({ message: error?.message || "Failed to load shipment documents", type: "error" });
        } finally {
            setIsLoadingDocuments(false);
        }
    }, []);

    const loadProjectReferenceDocs = React.useCallback(async (projectId?: string | null) => {
        if (!projectId) {
            setProjectReferenceDocs([]);
            return;
        }
        setIsLoadingProjectReferenceDocs(true);
        try {
            const res = await fetch(`/api/projects/${projectId}/documents`);
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || "Failed to load Forecast Sales documents");
            setProjectReferenceDocs((data.documents || []).map((doc: ProjectDocument) => ({
                ...doc,
                url: `/api/projects/${projectId}/documents/${doc.id}`,
            })));
        } catch {
            setProjectReferenceDocs([]);
        } finally {
            setIsLoadingProjectReferenceDocs(false);
        }
    }, []);

    const loadShipmentIssues = React.useCallback(async (shipmentId: string) => {
        try {
            const res = await fetch(`/api/shipments/${shipmentId}/issues`);
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || "Failed to load shipment issues");
            setShipmentIssues(data.issues || []);
        } catch {
            setShipmentIssues([]);
        }
    }, []);

    const loadSourceChanges = React.useCallback(async (shipmentId: string) => {
        try {
            const res = await fetch(`/api/shipments/${shipmentId}/source-changes`);
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || "Failed to load source changes");
            setSourceChanges(data.changes || []);
        } catch {
            setSourceChanges([]);
        }
    }, []);

    const loadBargeChanges = React.useCallback(async (shipmentId: string) => {
        try {
            const res = await fetch(`/api/shipments/${shipmentId}/barge-changes`);
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || "Failed to load barge changes");
            setBargeChanges(data.changes || []);
        } catch {
            setBargeChanges([]);
        }
    }, []);

    const loadShippingInstructions = React.useCallback(async (shipmentId: string) => {
        setIsLoadingSiRecords(true);
        try {
            const res = await fetch(`/api/shipments/${shipmentId}/shipping-instructions`);
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || "Failed to load SI records");
            setShippingInstructions(data.records || []);
        } catch (error: any) {
            setShippingInstructions([]);
            setToast({ message: error?.message || "Failed to load SI records", type: "error" });
        } finally {
            setIsLoadingSiRecords(false);
        }
    }, []);

    React.useEffect(() => {
        if (!detailShipment?.id) {
            setShipmentDocuments([]);
            setShipmentDocumentChecklist([]);
            setShipmentIssues([]);
            setSourceChanges([]);
            setBargeChanges([]);
            setShippingInstructions([]);
            return;
        }
        loadShipmentDocuments(detailShipment.id);
        loadShipmentIssues(detailShipment.id);
        loadSourceChanges(detailShipment.id);
        loadBargeChanges(detailShipment.id);
        loadShippingInstructions(detailShipment.id);
    }, [detailShipment?.id, loadShipmentDocuments, loadShipmentIssues, loadSourceChanges, loadBargeChanges, loadShippingInstructions]);

    const uploadShipmentDocument = async (params: {
        group: ShipmentDocumentGroup;
        file: File | null;
        title: string;
        status?: string;
        notes?: string;
        requirementCode?: string;
        requirementLabel?: string;
    }) => {
        if (!detailShipment?.id || !params.file) return;
        if (params.group === "critical" && !canAccessCriticalDocuments) {
            setToast({ message: "Critical document can only be managed by executive roles.", type: "error" });
            return;
        }
        if (params.group !== "critical" && !canManageShipments) {
            setToast({ message: "You do not have permission to upload shipment documents.", type: "error" });
            return;
        }

        const key = `${params.group}:${params.requirementCode || params.title}`;
        setDocumentAction(key);
        try {
            const formData = new FormData();
            formData.append("file", params.file);
            formData.append("documentGroup", params.group);
            formData.append("title", params.title);
            formData.append("status", params.status || "draft");
            formData.append("notes", params.notes || "");
            formData.append("requirementCode", params.requirementCode || "");
            formData.append("requirementLabel", params.requirementLabel || "");
            const res = await fetch(`/api/shipments/${detailShipment.id}/documents`, { method: "POST", body: formData });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || "Upload failed");
            setShipmentDocuments((current) => [data.document, ...current]);
            if (data.checklistItem) {
                setShipmentDocumentChecklist((current) => {
                    const exists = current.some((item) => item.id === data.checklistItem.id);
                    return exists
                        ? current.map((item) => item.id === data.checklistItem.id ? { ...item, ...data.checklistItem } : item)
                        : [...current, data.checklistItem];
                });
            }
            setToast({ message: "Document uploaded", type: "success" });
        } catch (error: any) {
            setToast({ message: error?.message || "Failed to upload document", type: "error" });
        } finally {
            setDocumentAction(null);
        }
    };

    const saveCustomDocument = async (group: "additional" | "critical") => {
        const draft = group === "critical" ? criticalDraft : additionalDraft;
        await uploadShipmentDocument({
            group,
            file: draft.file,
            title: draft.title || (group === "critical" ? "Critical document" : "Additional document"),
            status: draft.status || "draft",
            notes: draft.notes,
        });
        if (draft.file) {
            if (group === "critical") setCriticalDraft({ title: "", status: "draft", notes: "", file: null });
            else setAdditionalDraft({ title: "", status: "draft", notes: "", file: null });
        }
    };

    const renderDailyDateInput = (field: string, label: string) => (
        <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase">{label}</label>
            <input
                type="date"
                value={dailyForm[field] ? new Date(dailyForm[field]).toISOString().split("T")[0] : ""}
                onChange={(e) => setDailyForm({ ...dailyForm, [field]: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-primary/50"
            />
        </div>
    );

    const uploadSourceConfirmationEvidence = async (file: File | null) => {
        if (!detailShipment?.id || !file) return;
        if (!canManageShipments) {
            setToast({ message: "You do not have permission to confirm shipment source.", type: "error" });
            return;
        }
        setDocumentAction("source-confirmation");
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("documentGroup", "additional");
            formData.append("title", "Source Confirmation Evidence");
            formData.append("status", "submitted");
            formData.append("notes", "Source legal/cargo readiness confirmation evidence.");
            formData.append("requirementCode", "SOURCE_CONFIRMATION");
            formData.append("requirementLabel", "Source Confirmation Evidence");
            const res = await fetch(`/api/shipments/${detailShipment.id}/documents`, { method: "POST", body: formData });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || "Upload failed");
            const now = new Date().toISOString();
            const patch: Partial<ShipmentDetail> = {
                source_confirmation_status: "confirmed",
                source_confirmation_document_id: data.document.id,
                source_confirmed_by: (session?.user as any)?.id,
                source_confirmed_by_name: session?.user?.name || session?.user?.email || "User",
                source_confirmed_at: now,
            };
            await updateShipment(detailShipment.id, patch);
            setShipmentDocuments((current) => [data.document, ...current]);
            setDetailShipment((current) => current ? { ...current, ...patch } : current);
            setToast({ message: "Source confirmation evidence linked", type: "success" });
        } catch (error: any) {
            setToast({ message: error?.message || "Failed to upload source confirmation evidence", type: "error" });
        } finally {
            setDocumentAction(null);
        }
    };

    const uploadRequiredFiles = async (req: { code: string; label: string }, files: File[]) => {
        for (const file of files) {
            await uploadShipmentDocument({
                group: "required",
                file,
                title: req.label,
                status: "received",
                requirementCode: req.code,
                requirementLabel: req.label,
            });
        }
    };

    const updateChecklistItem = async (item: ShipmentDocumentChecklistItem | { documentGroup: ShipmentDocumentGroup; requirementCode?: string | null; requirementLabel: string; title: string }, updates: Partial<ShipmentDocumentChecklistItem>) => {
        if (!detailShipment?.id) return;
        const actionKey = `checklist:${"id" in item ? item.id : item.requirementCode || item.title}`;
        setDocumentAction(actionKey);
        try {
            const res = await fetch(`/api/shipments/${detailShipment.id}/documents`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...item,
                    ...updates,
                    documentGroup: item.documentGroup,
                    requirementCode: item.requirementCode || "",
                    requirementLabel: item.requirementLabel,
                    title: item.title,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || "Failed to update checklist");
            setShipmentDocumentChecklist((current) => {
                const exists = current.some((row) => row.id === data.checklistItem.id);
                return exists
                    ? current.map((row) => row.id === data.checklistItem.id ? { ...row, ...data.checklistItem } : row)
                    : [...current, data.checklistItem];
            });
            setToast({ message: "Checklist updated", type: "success" });
        } catch (error: any) {
            setToast({ message: error?.message || "Failed to update checklist", type: "error" });
        } finally {
            setDocumentAction(null);
        }
    };

    const saveShipmentIssue = async () => {
        if (!detailShipment?.id) return;
        if (!canManageShipments) {
            setToast({ message: "You do not have permission to add shipment issues.", type: "error" });
            return;
        }
        if (!issueDraft.category.trim()) {
            setToast({ message: "Issue category is required.", type: "error" });
            return;
        }
        setIssueAction("create");
        try {
            const res = await fetch(`/api/shipments/${detailShipment.id}/issues`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(issueDraft),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || "Failed to save issue");
            setShipmentIssues((current) => [data.issue, ...current]);
            setIssueDraft({ category: "", impact: "", action: "", pic: "", targetDate: "", status: "open", evidence: "", notes: "" });
            setToast({ message: "Issue log added.", type: "success" });
        } catch (error: any) {
            setToast({ message: error?.message || "Failed to save issue", type: "error" });
        } finally {
            setIssueAction(null);
        }
    };

    const updateShipmentIssueStatus = async (issue: ShipmentIssueLog, status: string) => {
        if (!detailShipment?.id) return;
        setIssueAction(issue.id);
        try {
            const res = await fetch(`/api/shipments/${detailShipment.id}/issues`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: issue.id, status }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || "Failed to update issue");
            setShipmentIssues((current) => current.map((item) => item.id === issue.id ? data.issue : item));
        } catch (error: any) {
            setToast({ message: error?.message || "Failed to update issue", type: "error" });
        } finally {
            setIssueAction(null);
        }
    };

    const saveSourceChange = async () => {
        if (!detailShipment?.id) return;
        if (!canManageShipments) {
            setToast({ message: "You do not have permission to request source changes.", type: "error" });
            return;
        }
        if (!sourceChangeDraft.newSource.trim() || !sourceChangeDraft.reason.trim()) {
            setToast({ message: "New source and reason are required.", type: "error" });
            return;
        }
        setSourceChangeAction("create");
        try {
            const res = await fetch(`/api/shipments/${detailShipment.id}/source-changes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(sourceChangeDraft),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || "Failed to request source change");
            setSourceChanges((current) => [data.change, ...current]);
            setSourceChangeDraft({ newSource: "", reason: "", evidence: "", impact: "" });
            setToast({ message: "Source change request created.", type: "success" });
        } catch (error: any) {
            setToast({ message: error?.message || "Failed to request source change", type: "error" });
        } finally {
            setSourceChangeAction(null);
        }
    };

    const decideSourceChange = async (change: ShipmentSourceChangeRequest, action: "approve" | "reject") => {
        if (!detailShipment?.id) return;
        const comment = window.prompt(action === "approve" ? "Approval comment:" : "Reject reason:", action === "approve" ? "Approved source change" : "Rejected source change");
        if (comment === null) return;
        setSourceChangeAction(change.id);
        try {
            const res = await fetch(`/api/shipments/${detailShipment.id}/source-changes`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: change.id, action, comment }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || "Failed to decide source change");
            setSourceChanges((current) => current.map((item) => item.id === change.id ? data.change : { ...item, active: action === "approve" ? false : item.active }));
            if (action === "approve") {
                setDetailShipment((current) => current ? { ...current, source: data.change.newSource, supplier: data.change.newSource } : current);
            }
            setToast({ message: `Source change ${action === "approve" ? "approved" : "rejected"}.`, type: "success" });
        } catch (error: any) {
            setToast({ message: error?.message || "Failed to decide source change", type: "error" });
        } finally {
            setSourceChangeAction(null);
        }
    };

    const saveBargeChange = async () => {
        if (!detailShipment?.id) return;
        if (!canManageShipments) {
            setToast({ message: "You do not have permission to request barge changes.", type: "error" });
            return;
        }
        if (!bargeChangeDraft.reason.trim()) {
            setToast({ message: "Barge change reason is required.", type: "error" });
            return;
        }
        setBargeChangeAction("create");
        try {
            const res = await fetch(`/api/shipments/${detailShipment.id}/barge-changes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(bargeChangeDraft),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || "Failed to request barge change");
            setBargeChanges((current) => [data.change, ...current]);
            setBargeChangeDraft({ newMv: "", newTb: "", newBg: "", newNomination: "", reason: "", evidence: "", impact: "" });
            setToast({ message: "Barge change request created.", type: "success" });
        } catch (error: any) {
            setToast({ message: error?.message || "Failed to request barge change", type: "error" });
        } finally {
            setBargeChangeAction(null);
        }
    };

    const decideBargeChange = async (change: ShipmentBargeChangeLog, action: "approve" | "reject") => {
        if (!detailShipment?.id) return;
        const comment = window.prompt(action === "approve" ? "Approval comment:" : "Reject reason:", action === "approve" ? "Approved barge change" : "Rejected barge change");
        if (comment === null) return;
        setBargeChangeAction(change.id);
        try {
            const res = await fetch(`/api/shipments/${detailShipment.id}/barge-changes`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: change.id, action, comment }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || "Failed to decide barge change");
            setBargeChanges((current) => current.map((item) => item.id === change.id ? data.change : { ...item, active: action === "approve" ? false : item.active }));
            if (action === "approve") {
                setDetailShipment((current) => current ? {
                    ...current,
                    vessel_name: data.change.newMv || current.vessel_name,
                    mv_project_name: data.change.newMv || current.mv_project_name,
                    barge_name: data.change.newTb || data.change.newBg || current.barge_name,
                    nomination: data.change.newNomination || current.nomination,
                } : current);
            }
            setToast({ message: `Barge change ${action === "approve" ? "approved" : "rejected"}.`, type: "success" });
        } catch (error: any) {
            setToast({ message: error?.message || "Failed to decide barge change", type: "error" });
        } finally {
            setBargeChangeAction(null);
        }
    };

    const renderDocumentDropzone = (params: {
        id: string;
        actionKey: string;
        disabled?: boolean;
        multiple?: boolean;
        selectedFileName?: string;
        tone?: "primary" | "red";
        onFiles: (files: File[]) => void;
    }) => {
        const active = draggingDocumentKey === params.actionKey;
        const busy = documentAction === params.actionKey;
        const color = params.tone === "red" ? "red" : "primary";
        return (
            <label
                htmlFor={params.id}
                onDragEnter={(e) => {
                    e.preventDefault();
                    if (!params.disabled) setDraggingDocumentKey(params.actionKey);
                }}
                onDragOver={(e) => {
                    e.preventDefault();
                    if (!params.disabled) e.dataTransfer.dropEffect = "copy";
                }}
                onDragLeave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                    setDraggingDocumentKey(null);
                }}
                onDrop={(e) => {
                    e.preventDefault();
                    setDraggingDocumentKey(null);
                    if (params.disabled) return;
                    const files = Array.from(e.dataTransfer.files || []);
                    if (files.length) params.onFiles(params.multiple ? files : files.slice(0, 1));
                }}
                className={cn(
                    "flex min-h-20 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-3 py-3 text-center text-xs transition-colors",
                    color === "red"
                        ? "border-red-500/30 bg-red-500/5 hover:bg-red-500/10"
                        : "border-primary/30 bg-primary/5 hover:bg-primary/10",
                    active && (color === "red" ? "border-red-500 bg-red-500/15" : "border-primary bg-primary/15"),
                    params.disabled && "pointer-events-none opacity-50",
                )}
            >
                <input
                    id={params.id}
                    type="file"
                    multiple={params.multiple}
                    className="hidden"
                    accept={DOCUMENT_ACCEPT}
                    onChange={(e) => {
                        const files = Array.from(e.currentTarget.files || []);
                        if (files.length) params.onFiles(params.multiple ? files : files.slice(0, 1));
                        e.currentTarget.value = "";
                    }}
                />
                {busy ? <Loader2 className="mb-1.5 h-4 w-4 animate-spin" /> : <UploadCloud className="mb-1.5 h-4 w-4" />}
                <span className="font-bold">{busy ? "Uploading..." : "Drop files or choose file"}</span>
                <span className="mt-0.5 max-w-full truncate text-[10px] text-muted-foreground">
                    {params.selectedFileName || "Images, PDF, DOCX"}
                </span>
            </label>
        );
    };

    const renderDailyEvidenceUpload = (params: {
        documentType: string;
        evidenceField: string;
        title: string;
    }) => {
        const docs = dailyEvidenceByType.get(params.documentType) || [];
        return (
            <div className="space-y-2">
                {renderDocumentDropzone({
                    id: `daily-evidence-${params.documentType}`,
                    actionKey: `daily:${params.documentType}`,
                    disabled: !editDailyData?.id || !canManageShipments || Boolean(dailyDocumentAction),
                    selectedFileName: !editDailyData?.id ? "Save daily log first" : undefined,
                    onFiles: (files) => uploadDailyHandoverEvidence(params.documentType, params.evidenceField, params.title, files[0] || null),
                })}
                {docs.length > 0 && (
                    <div className="space-y-1">
                        {docs.map((doc) => (
                            <div key={doc.id} className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-background px-2 py-1 text-[10px]">
                                <a href={doc.url || `/api/daily-delivery/${doc.dailyDeliveryId}/documents/${doc.id}`} target="_blank" rel="noreferrer" className="min-w-0 truncate font-semibold text-primary">
                                    {doc.title}: {doc.fileName}
                                </a>
                                {canManageShipments && (
                                    <button
                                        type="button"
                                        onClick={() => deleteDailyHandoverEvidence(doc)}
                                        disabled={dailyDocumentAction === `daily-delete:${doc.id}`}
                                        className="rounded p-1 text-red-500 hover:bg-red-500/10 disabled:opacity-50"
                                        title="Delete evidence"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const startEditDocument = (doc: ShipmentDocument) => {
        setEditingDocumentId(doc.id);
        setEditingDocumentDraft({ title: doc.title || "", status: doc.status || "draft", notes: doc.notes || "" });
    };

    const saveDocumentEdit = async (doc: ShipmentDocument) => {
        if (!detailShipment?.id) return;
        setDocumentAction(`edit:${doc.id}`);
        try {
            const res = await fetch(`/api/shipments/${detailShipment.id}/documents/${doc.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editingDocumentDraft),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || "Failed to update document");
            setShipmentDocuments((current) => current.map((item) => item.id === doc.id ? data.document : item));
            setEditingDocumentId(null);
            setToast({ message: "Document saved", type: "success" });
        } catch (error: any) {
            setToast({ message: error?.message || "Failed to save document", type: "error" });
        } finally {
            setDocumentAction(null);
        }
    };

    const deleteShipmentDocument = async (doc: ShipmentDocument) => {
        if (!detailShipment?.id) return;
        if (!window.confirm(`Delete ${doc.title || doc.fileName}?`)) return;
        setDocumentAction(`delete:${doc.id}`);
        try {
            const res = await fetch(`/api/shipments/${detailShipment.id}/documents/${doc.id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || "Failed to delete document");
            setShipmentDocuments((current) => current.filter((item) => item.id !== doc.id));
            await loadShipmentDocuments(detailShipment.id);
            setToast({ message: "Document deleted", type: "success" });
        } catch (error: any) {
            setToast({ message: error?.message || "Failed to delete document", type: "error" });
        } finally {
            setDocumentAction(null);
        }
    };

    const generateSiRecord = async () => {
        if (!detailShipment?.id || siAction) return;
        const revisionReason = shippingInstructions.length > 0
            ? window.prompt("Revision reason for this SI version:", "SI data updated")
            : "Initial SI generated";
        if (revisionReason === null) return;
        const laycanDate = parseFlexibleDate(detailShipment.laycan);
        const isEarly = laycanDate ? Math.ceil((laycanDate.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000) > 10 : false;
        const earlyApprovalReason = isEarly
            ? window.prompt("SI dibuat sebelum H-10. Isi alasan early approval:", revisionReason || "Operational preparation required")
            : "";
        if (isEarly && !earlyApprovalReason?.trim()) return;
        setSiAction(true);
        try {
            const res = await fetch(`/api/shipments/${detailShipment.id}/shipping-instructions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason: revisionReason, earlyApprovalReason }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || "Failed to generate SI version");
            setShippingInstructions((current) => [data.record, ...current]);
            setToast({ message: `SI version ${data.record.version} recorded.`, type: "success" });
        } catch (error: any) {
            setToast({ message: error?.message || "Failed to generate SI version", type: "error" });
        } finally {
            setSiAction(false);
        }
    };

    const decideSiRecord = async (record: ShippingInstructionRecord, action: "approve" | "reject") => {
        if (!detailShipment?.id) return;
        const comment = window.prompt(`${action === "approve" ? "Approve" : "Reject"} SI ${record.siNumber}:`, action === "approve" ? "Approved" : "Rejected");
        if (!comment?.trim()) return;
        setSiAction(true);
        try {
            const res = await fetch(`/api/shipments/${detailShipment.id}/shipping-instructions`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: record.id, action, comment }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || "Failed to update SI approval");
            setShippingInstructions((current) => current.map((item) => item.id === record.id ? data.record : item));
            setToast({ message: `SI ${action === "approve" ? "approved" : "rejected"}.`, type: "success" });
        } catch (error: any) {
            setToast({ message: error?.message || "Failed to update SI approval", type: "error" });
        } finally {
            setSiAction(false);
        }
    };

    const cancelSiRecord = async (record: ShippingInstructionRecord) => {
        if (!detailShipment?.id) return;
        const comment = window.prompt(`Cancel SI ${record.siNumber}. Isi alasan cancellation:`, "SI cancelled");
        if (!comment?.trim()) return;
        setSiAction(true);
        try {
            const res = await fetch(`/api/shipments/${detailShipment.id}/shipping-instructions`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: record.id, action: "cancel", comment }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || "Failed to cancel SI");
            setShippingInstructions((current) => current.map((item) => item.id === record.id ? data.record : item));
            setToast({ message: "SI cancelled.", type: "success" });
        } catch (error: any) {
            setToast({ message: error?.message || "Failed to cancel SI", type: "error" });
        } finally {
            setSiAction(false);
        }
    };

    const renderShipmentDocumentList = (docs: ShipmentDocument[]) => {
        if (docs.length === 0) {
            return <p className="text-[10px] text-muted-foreground">No files uploaded yet.</p>;
        }
        return (
            <div className="space-y-1.5">
                {docs.map((doc) => {
                    const isEditing = editingDocumentId === doc.id;
                    const canManageThisDoc = doc.documentGroup === "critical" ? canAccessCriticalDocuments : canManageShipments;
                    const isSupersededCritical = doc.documentGroup === "critical" && Boolean(doc.replacedByDocumentId);
                    return (
                        <div key={doc.id} className={cn(
                            "rounded-lg border border-border/50 bg-background/70 p-2.5 text-xs",
                            isSupersededCritical && "bg-accent/30 opacity-80"
                        )}>
                            {isEditing ? (
                                <div className="space-y-2">
                                    <input
                                        value={editingDocumentDraft.title}
                                        onChange={(e) => setEditingDocumentDraft({ ...editingDocumentDraft, title: e.target.value })}
                                        className="w-full px-2 py-1.5 rounded-md bg-accent/50 border border-border text-xs"
                                    />
                                    <div className="grid grid-cols-2 gap-2">
                                        <select
                                            value={editingDocumentDraft.status}
                                            onChange={(e) => setEditingDocumentDraft({ ...editingDocumentDraft, status: e.target.value })}
                                            className="w-full px-2 py-1.5 rounded-md bg-accent/50 border border-border text-xs"
                                        >
                                            <option value="draft">Draft</option>
                                            <option value="received">Received</option>
                                            <option value="reviewed">Reviewed</option>
                                            <option value="final">Final</option>
                                        </select>
                                        <input
                                            value={editingDocumentDraft.notes}
                                            onChange={(e) => setEditingDocumentDraft({ ...editingDocumentDraft, notes: e.target.value })}
                                            placeholder="Notes"
                                            className="w-full px-2 py-1.5 rounded-md bg-accent/50 border border-border text-xs"
                                        />
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => setEditingDocumentId(null)} className="px-2 py-1 rounded-md hover:bg-accent text-[10px]">Cancel</button>
                                        <button onClick={() => saveDocumentEdit(doc)} disabled={documentAction === `edit:${doc.id}`} className="px-2 py-1 rounded-md bg-primary text-primary-foreground text-[10px] font-semibold disabled:opacity-60">
                                            {documentAction === `edit:${doc.id}` ? "Saving..." : "Save"}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <a href={doc.url || `/api/shipments/${doc.shipmentId}/documents/${doc.id}`} target="_blank" rel="noreferrer" className="min-w-0 inline-flex items-center gap-1.5 font-semibold text-foreground hover:text-primary">
                                        <FileText className="w-3.5 h-3.5 shrink-0" />
                                        <span className="truncate max-w-[220px]">{doc.title || doc.fileName}</span>
                                        {doc.documentGroup === "critical" && (
                                            <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[9px] font-bold text-red-600">
                                                v{doc.version || 1}
                                            </span>
                                        )}
                                        <ExternalLink className="w-3 h-3 shrink-0 text-muted-foreground" />
                                    </a>
                                    <div className="flex items-center gap-1.5">
                                        <span className="rounded bg-accent px-1.5 py-0.5 text-[9px] font-bold uppercase text-muted-foreground">{doc.status || "draft"}</span>
                                        {isSupersededCritical && (
                                            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-700">history</span>
                                        )}
                                        {canManageThisDoc && (
                                            <>
                                                <button onClick={() => startEditDocument(doc)} disabled={isSupersededCritical} className="p-1 rounded hover:bg-accent disabled:opacity-40" title={isSupersededCritical ? "Superseded critical document is retained as history" : "Edit document metadata"}><Edit className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => deleteShipmentDocument(doc)} disabled={documentAction === `delete:${doc.id}`} className="p-1 rounded hover:bg-red-500/10 text-red-500 disabled:opacity-50" title="Delete document"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </>
                                        )}
                                    </div>
                                    {doc.notes && <p className="w-full text-[10px] text-muted-foreground">{doc.notes}</p>}
                                    {isSupersededCritical && (
                                        <p className="w-full text-[10px] text-amber-700">
                                            Superseded by newer critical document. {doc.replacementReason || "Kept for replacement history."}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    const handleAddMilestone = () => {
        if (!canManageShipments) {
            setToast({ message: "You do not have permission to edit shipment milestones.", type: "error" });
            return;
        }
        if (!detailShipment || !milestoneForm.title) return;
        const currentMilestones = detailShipment.milestones || [
            { title: "Contract Confirmed", subtitle: "Documents signed and LC established.", status: "completed" },
            { title: "Vessel Arrived at Load Port", subtitle: `${detailShipment.loading_port || "Port"} Anchorage.`, status: "completed" },
            { title: "Commenced Loading", subtitle: "Barges alongside vessel.", status: "current" },
            { title: "Bill of Lading Issued", subtitle: "Pending completion of loading.", status: "pending" },
            { title: "Arrival at Destination", subtitle: `${detailShipment.discharge_port || "TBA"}`, status: "pending" }
        ];
        const updated = { ...detailShipment, milestones: [...currentMilestones, milestoneForm] };
        updateShipment(detailShipment.id, updated);
        setDetailShipment(updated);
        setShowMilestoneForm(false);
        setMilestoneForm({ title: "", subtitle: "", status: "pending" });
    };

    const handleGenerateRiskAnalysis = async () => {
        if (!detailShipment) return;
        if (!canRunRiskAnalysis) {
            setToast({ message: "You do not have permission to run shipment risk analysis.", type: "error" });
            return;
        }
        setIsGeneratingRisk(true);
        try {
            const res = await fetch(`/api/shipments/${detailShipment.id}/risk-analysis`, { method: "POST" });
            const data = await res.json();
            if (data.success && data.data) {
                updateShipment(detailShipment.id, data.data);
                setDetailShipment(data.data);
                setToast({ message: "Risk analysis completed successfully", type: "success" });
            } else {
                throw new Error(data.error || "Failed to analyze risk");
            }
        } catch (e: any) {
            setToast({ message: e.message || "Risk analysis failed", type: "error" });
        } finally {
            setIsGeneratingRisk(false);
        }
    };

    const handleSaveBlending = async () => {
        if (!canManageShipments) {
            setToast({ message: "You do not have permission to edit shipment blending data.", type: "error" });
            return;
        }
        if (detailShipment) {
            const updated = { ...detailShipment, spec_actual: { ...detailShipment.spec_actual, ...blendingForm } };
            await updateShipment(detailShipment.id, updated);
            setDetailShipment(updated);
            setToast({ message: "Blending specs updated!", type: "success" });
        }
        setEditBlendingMode(false);
    };

    const handleSaveEdit = async () => {
        if (!editShipment) return;
        if (!canManageShipments) {
            setToast({ message: "You do not have permission to save shipment changes.", type: "error" });
            return;
        }
        const requiresStatusReason = ["upcoming", "loading", "in_transit"].includes(editForm.status || "");
        if (requiresStatusReason && !(editForm.status_reason || "").trim()) {
            setToast({ message: "Status reason is required for on-going shipments.", type: "error" });
            return;
        }
        if (isShipmentClosingStatus(editForm.status)) {
            const checklistLoadedForEdit = detailShipment?.id === editShipment.id && shipmentDocumentChecklist.length > 0;
            const blockers = getShipmentClosingBlockers(
                editForm,
                checklistLoadedForEdit ? shipmentDocumentChecklist : [],
                detailShipment?.id === editShipment.id ? shippingInstructions : [],
                detailShipment?.id === editShipment.id ? shipmentIssues : [],
                detailShipment?.id === editShipment.id ? sourceChanges : [],
                detailShipment?.id === editShipment.id ? bargeChanges : [],
            );
            if (blockers.length > 0) {
                setToast({ message: `Cannot close shipment. Resolve closing blockers first: ${blockers.slice(0, 2).join("; ")}`, type: "error" });
                return;
            }
        }
        setIsSaving(true);
        try {
            const payload = { ...editForm };
            if (
                payload.source_confirmation_status === "confirmed" &&
                !payload.source_confirmed_at
            ) {
                payload.source_confirmed_by = (session?.user as any)?.id;
                payload.source_confirmed_by_name = session?.user?.name || session?.user?.email || "User";
                payload.source_confirmed_at = new Date().toISOString();
            }
            if (editShipment.id) {
                await updateShipment(editShipment.id, payload);
                setToast({ message: "Shipment updated successfully!", type: "success" });
            } else {
                await addShipment(payload as any);
                setToast({ message: "New shipment created successfully!", type: "success" });
            }
            setEditShipment(null);
        } catch (error) {
            setToast({ message: error instanceof Error ? error.message : "Failed to save shipment.", type: "error" });
        } finally {
            setIsSaving(false);
        }
    };

    const openEdit = (sh: ShipmentDetail) => {
        if (!canManageShipments) return;
        setEditShipment(sh);
        setEditForm({ ...sh });
    };

    const openCreateShipment = () => {
        if (!canManageShipments) return;
        setEditShipment({} as any);
        setEditForm({
            status: "upcoming",
            year: new Date().getFullYear(),
            type: "export",
            export_dmo: "EXPORT",
        });
    };

    const projectOptions = React.useMemo(() => {
        const names = new Set<string>();
        projects.forEach((p) => {
            const name = (p.name || "").trim();
            if (name) names.add(name);
        });
        shipments.forEach((s) => {
            const name = (s.mv_project_name || "").trim();
            if (name) names.add(name);
        });
        return Array.from(names).sort((a, b) => a.localeCompare(b));
    }, [projects, shipments]);

    const selectedProjectMeta = React.useMemo(() => {
        if (editForm.forecast_sales_id) {
            const byId = projects.find((p) => p.id === editForm.forecast_sales_id);
            if (byId) return byId;
        }
        const key = normalizeKey(editForm.mv_project_name || "");
        if (!key) return null;
        return projects.find((p) => normalizeKey(p.name) === key) || null;
    }, [editForm.forecast_sales_id, editForm.mv_project_name, projects]);

    React.useEffect(() => {
        if (!selectedProjectMeta) return;
        setEditForm((prev) => {
            if (prev.buyer) return prev;
            if (!selectedProjectMeta.buyer) return prev;
            return { ...prev, buyer: selectedProjectMeta.buyer };
        });
    }, [selectedProjectMeta]);

    React.useEffect(() => {
        if (!editShipment) return;
        loadProjectReferenceDocs(selectedProjectMeta?.id || editForm.forecast_sales_id || null);
    }, [editShipment, selectedProjectMeta?.id, editForm.forecast_sales_id, loadProjectReferenceDocs]);

    const uniqueYears = React.useMemo(() => {
        return Array.from(new Set(
            shipments
                .map((s) => getShipmentYear(s))
                .filter((y): y is number => y !== null)
        )).sort((a, b) => b - a);
    }, [shipments]);

    const statusCounts = React.useMemo(() => {
        const counts = {
            upcoming: 0,
            loading: 0,
            in_transit: 0,
            completed: 0,
            cancelled: 0,
            unknown: 0,
        };
        for (const s of shipments) {
            const key = normalizeShipmentStatus(s.status);
            counts[key] += 1;
        }
        return counts;
    }, [shipments]);

    const filtered = React.useMemo(() => {
        const start = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
        const end = dateTo ? new Date(`${dateTo}T23:59:59`) : null;

        const rows = shipments.filter((s) => {
            const canonicalStatus = normalizeShipmentStatus(s.status);
            const matchesTab = activeTab === "all" || canonicalStatus === activeTab;
            if (!matchesTab) return false;

            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const matchesSearch = (s.mv_project_name || s.shipment_number || "").toLowerCase().includes(q)
                    || (s.source || s.buyer || "").toLowerCase().includes(q)
                    || (s.nomination || s.vessel_name || "").toLowerCase().includes(q);
                if (!matchesSearch) return false;
            }

            if (yearFilter !== "all") {
                const yr = getShipmentYear(s);
                if (!yr || String(yr) !== yearFilter) return false;
            }

            if (start || end) {
                const d = getShipmentDate(s);
                if (!d) return false;
                if (start && d < start) return false;
                if (end && d > end) return false;
            }

            return true;
        });

        rows.sort((a, b) => {
            const aYear = getShipmentYear(a) || 0;
            const bYear = getShipmentYear(b) || 0;
            const aNo = a.no || 0;
            const bNo = b.no || 0;
            const aQty = safeNum(a.qty_plan || a.quantity_loaded);
            const bQty = safeNum(b.qty_plan || b.quantity_loaded);
            const aDate = getShipmentDate(a)?.getTime() || 0;
            const bDate = getShipmentDate(b)?.getTime() || 0;

            if (sortBy === "qty_desc") return bQty - aQty;
            if (sortBy === "qty_asc") return aQty - bQty;
            if (sortBy === "risk_desc") return (b.riskScore || 0) - (a.riskScore || 0);
            if (sortBy === "risk_asc") return (a.riskScore || 0) - (b.riskScore || 0);
            if (sortBy === "oldest") {
                if (aYear !== bYear) return aYear - bYear;
                if (aDate !== bDate) return aDate - bDate;
                return aNo - bNo;
            }
            if (aYear !== bYear) return bYear - aYear;
            if (aDate !== bDate) return bDate - aDate;
            return bNo - aNo;
        });

        return rows;
    }, [shipments, activeTab, searchQuery, yearFilter, dateFrom, dateTo, sortBy]);

    const shipmentFamily = React.useMemo(() => {
        if (!detailShipment) return [];
        const detailVessel = normalizeKey(detailShipment.vessel_name || detailShipment.mv_project_name);
        const detailProject = normalizeKey(detailShipment.mv_project_name);
        const detailYear = detailShipment.year;

        return shipments
            .filter((s) => {
                if (detailYear && s.year && detailYear !== s.year) return false;
                const vessel = normalizeKey(s.vessel_name || s.mv_project_name);
                const project = normalizeKey(s.mv_project_name);
                const sameProject = detailProject && project && detailProject === project;
                const sameVessel = detailVessel && vessel && (vessel.includes(detailVessel) || detailVessel.includes(vessel));
                return sameProject || sameVessel;
            })
            .sort((a, b) => (a.no || 99999) - (b.no || 99999));
    }, [detailShipment, shipments]);

    const linkedForecast = React.useMemo(() => {
        if (!detailShipment) return null;
        const byId = detailShipment.forecast_sales_id
            ? projects.find((project) => project.id === detailShipment.forecast_sales_id)
            : undefined;
        if (byId) return byId;
        const shipmentForecastName = normalizeKey(detailShipment.forecast_sales_name || detailShipment.mv_project_name);
        if (!shipmentForecastName) return null;
        return projects.find((project) => normalizeKey(project.name) === shipmentForecastName) || null;
    }, [detailShipment, projects]);

    React.useEffect(() => {
        if (!detailShipment) return;
        loadProjectReferenceDocs(linkedForecast?.id || null);
    }, [detailShipment, linkedForecast?.id, loadProjectReferenceDocs]);

    const selectedMomDoc = React.useMemo(() => {
        if (!detailShipment?.commercial_mom_document_id) return null;
        return projectReferenceDocs.find((doc) => doc.id === detailShipment.commercial_mom_document_id) || null;
    }, [detailShipment?.commercial_mom_document_id, projectReferenceDocs]);

    const selectedPoDoc = React.useMemo(() => {
        if (!detailShipment?.commercial_po_document_id) return null;
        return projectReferenceDocs.find((doc) => doc.id === detailShipment.commercial_po_document_id) || null;
    }, [detailShipment?.commercial_po_document_id, projectReferenceDocs]);

    const sourceConfirmationDoc = React.useMemo(() => {
        if (!detailShipment?.source_confirmation_document_id) return null;
        return shipmentDocuments.find((doc) => doc.id === detailShipment.source_confirmation_document_id) || null;
    }, [detailShipment?.source_confirmation_document_id, shipmentDocuments]);

    const toggleExpand = (id: string) => {
        setExpandedRows((prev) => {
            const n = new Set(prev);
            if (n.has(id)) n.delete(id); else n.add(id);
            return n;
        });
    };

    const latestPrice = marketPrices[0];

    const stats = {
        total: shipments.length,
        upcoming: statusCounts.upcoming,
        loading: statusCounts.loading,
        intransit: statusCounts.in_transit,
        completed: statusCounts.completed,
        cancelled: statusCounts.cancelled,
        revenue: shipments.reduce((sum, s) => sum + (shipmentQty(s) * shipmentSellPrice(s)), 0),
        gp: shipments.reduce((sum, s) => sum + (shipmentQty(s) * shipmentMargin(s)), 0),
        volume: shipments.reduce((sum, s) => sum + shipmentQty(s), 0)
    };

    const { page, pageSize, setPage, setPageSize } = usePagination({ defaultPageSize: activeView === "card" ? 9 : 20 });
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const paginatedData = filtered.slice((page - 1) * pageSize, page * pageSize);


    return (
        <AppShell>
            <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6">

                {/* Module Summary & Top Metrics */}
                <div className="card-elevated p-6 animate-fade-in border-l-4 border-l-primary relative overflow-hidden">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <div className="relative z-10 flex items-center gap-3">
                            <Ship className="w-8 h-8 text-primary" />
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight">Shipment Monitor</h1>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Track and manage coal shipments with blending plan integration</p>
                            </div>
                        </div>
                        <div className="flex gap-2 relative z-10">
                            <button onClick={() => setShowReportModal(true)} className="btn-outline text-xs h-9 hidden sm:flex"><Download className="w-3.5 h-3.5 mr-1.5" /> Download Report</button>
                            {canManageShipments && <button onClick={openCreateShipment} className="btn-primary text-xs h-9 hidden sm:flex">+ Create Shipment</button>}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 relative z-10 mt-6">
                        {[
                            { label: "Total Shipments", value: stats.total, color: "text-blue-500", bg: "bg-blue-500/20", icon: Package },
                            { label: "Total Volume", value: `${(stats.volume / 1000).toFixed(0)}K MT`, color: "text-indigo-500", bg: "bg-indigo-500/20", icon: TrendingUp },
                            { label: "Upcoming", value: stats.upcoming, color: "text-blue-500", bg: "bg-blue-500/20", icon: Clock },
                            { label: "Loading", value: stats.loading, color: "text-amber-500", bg: "bg-amber-500/20", icon: Anchor },
                            { label: "In Transit", value: stats.intransit, color: "text-purple-500", bg: "bg-purple-500/20", icon: Ship },
                            { label: "Completed", value: stats.completed, color: "text-emerald-500", bg: "bg-emerald-500/20", icon: CheckCircle2 },
                        ].map((metric, i) => {
                            const Icon = metric.icon;
                            return (
                                <div key={i} className="bg-card shadow-sm p-4 rounded-xl border border-border/30 flex items-center gap-3">
                                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", metric.bg)}>
                                        <Icon className={cn("w-5 h-5", metric.color)} />
                                    </div>
                                    <div>
                                        <p className="text-xl font-bold text-foreground leading-none mb-1">{metric.value}</p>
                                        <p className="text-[10px] text-muted-foreground">{metric.label}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Sub-Navigation Tabs */}
                <div className="flex items-center gap-6 border-b border-border text-sm font-medium overflow-x-auto hide-scrollbar">
                    {(["MV Barge", "Analytics", "Risk Assessment"] as const).map((tab) => (
                        <button key={tab} onClick={() => setMainTab(tab)} className={cn("pb-3 border-b-2 whitespace-nowrap transition-colors", mainTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Latest Price Indices */}
                <div className="bg-card shadow-sm border border-border/50 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-slide-up">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                        <span className="text-sm font-semibold text-white">Latest Price Indices</span>
                    </div>
                    <div className="flex flex-wrap gap-3 flex-1 md:justify-end">
                        {latestPrice ? [
                            { name: "ICI 1", val: `$${safeFmt(latestPrice.ici_1)}` },
                            { name: "ICI 2", val: `$${safeFmt(latestPrice.ici_2)}` },
                            { name: "ICI 3", val: `$${safeFmt(latestPrice.ici_3)}` },
                            { name: "ICI 4", val: `$${safeFmt(latestPrice.ici_4)}` },
                            { name: "Newcastle", val: `$${safeFmt(latestPrice.newcastle)}` },
                            { name: "HBA", val: `$${safeFmt(latestPrice.hba)}` },
                        ].map((idx, i) => (
                            <div key={i} className="bg-background/50 px-3 py-1.5 rounded-lg border border-border/30 flex flex-col min-w-[100px] shadow-sm">
                                <span className="text-[10px] text-muted-foreground uppercase">{idx.name}</span>
                                <span className="text-sm font-bold text-foreground">{idx.val}</span>
                            </div>
                        )) : <div className="text-sm text-muted-foreground">Market Price Data Unavailable. Sync DB.</div>}
                    </div>
                </div>

                {/* Filters & View Toggles */}
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex bg-accent/30 p-1 rounded-xl">
                            <button onClick={() => setActiveView("list")} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all", activeView === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}><List className="w-3.5 h-3.5" /> List View</button>
                            <button onClick={() => setActiveView("card")} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all", activeView === "card" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}><Package className="w-3.5 h-3.5" /> Card View</button>
                            <button onClick={() => setActiveView("map")} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all", activeView === "map" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}><MapIcon className="w-3.5 h-3.5" /> Map View</button>
                        </div>

                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <div className="relative flex-1 md:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search shipments..." className="w-full pl-9 pr-4 py-2 rounded-xl bg-accent/30 border border-border text-xs outline-none focus:border-primary/50 transition-colors" />
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-accent/20 text-xs text-muted-foreground xl:col-span-2">
                            <Filter className="w-3.5 h-3.5" />
                            <span>
                                Sorted by: {sortBy === "latest" ? "Year latest first, then date/no desc" : sortBy === "oldest" ? "Year oldest first, then date/no asc" : sortBy === "qty_desc" ? "Volume largest first" : sortBy === "qty_asc" ? "Volume smallest first" : sortBy === "risk_desc" ? "Highest Risk First" : "Lowest Risk First"}
                            </span>
                        </div>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="px-3 py-2 rounded-xl bg-accent/30 border border-border text-xs outline-none focus:border-primary/50"
                        >
                            <option value="latest">Sort: Latest</option>
                            <option value="oldest">Sort: Oldest</option>
                            <option value="qty_desc">Sort: Volume Desc</option>
                            <option value="qty_asc">Sort: Volume Asc</option>
                            <option value="risk_desc">Sort: High Risk First</option>
                            <option value="risk_asc">Sort: Low Risk First</option>
                        </select>
                        <select
                            value={yearFilter}
                            onChange={(e) => setYearFilter(e.target.value)}
                            className="px-3 py-2 rounded-xl bg-accent/30 border border-border text-xs outline-none focus:border-primary/50"
                        >
                            <option value="all">All Years</option>
                            {uniqueYears.map((y) => (
                                <option key={y} value={String(y)}>{y}</option>
                            ))}
                        </select>
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl bg-accent/30 border border-border text-xs outline-none focus:border-primary/50"
                                title="Date from (BL Date / ETA / Created)"
                            />
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl bg-accent/30 border border-border text-xs outline-none focus:border-primary/50"
                                title="Date to (BL Date / ETA / Created)"
                            />
                        </div>
                    </div>
                </div>

                {mainTab === "Daily Delivery" ? (
                    <div className="card-elevated animate-fade-in overflow-hidden">
                        <div className="p-4 border-b border-border flex justify-between items-center bg-accent/20">
                            <div>
                                <h3 className="text-sm font-bold text-foreground">Daily Delivery Logs</h3>
                                <p className="text-[10px] text-muted-foreground mt-0.5">Track precise daily loading/discharging progress</p>
                            </div>
                            <button onClick={() => handleOpenDailyForm()} className="btn-primary py-1.5 px-3 text-xs">+ Add Daily Log</button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left whitespace-nowrap">
                                <thead className="text-[10px] text-muted-foreground uppercase bg-muted/50 border-b border-border">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold">Report Type</th>
                                        <th className="px-6 py-4 font-semibold">Tahun</th>
                                        <th className="px-6 py-4 font-semibold">Buyer</th>
                                        <th className="px-6 py-4 font-semibold">MV/Barge Nom.</th>
                                        <th className="px-6 py-4 font-semibold">BL Quantity</th>
                                        <th className="px-6 py-4 font-semibold">Domestic Handover</th>
                                        <th className="px-6 py-4 font-semibold">Issue</th>
                                        <th className="px-6 py-4 font-semibold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50 bg-card">
                                    {dailyDeliveries.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-8 text-center text-xs text-muted-foreground">
                                                No daily delivery data fetched for current filter.
                                            </td>
                                        </tr>
                                    ) : dailyDeliveries.map(d => {
                                        const handover = getDomesticHandoverSummary(d);
                                        return (
                                            <tr
                                                key={d.id}
                                                id={`daily-${d.id}`}
                                                onClick={() => handleOpenDailyForm(d)}
                                                className={cn(
                                                    "cursor-pointer transition-colors hover:bg-accent/40",
                                                    highlightedDailyId === String(d.id) && "bg-amber-500/10 ring-1 ring-inset ring-amber-500/40",
                                                )}
                                            >
                                                <td className="px-6 py-4"><span className="px-2 py-1 bg-accent rounded text-[10px] font-bold uppercase">{d.report_type}</span></td>
                                                <td className="px-6 py-4 text-xs font-semibold">{d.year}</td>
                                                <td className="px-6 py-4 text-xs font-bold text-foreground">{d.buyer || "-"}</td>
                                                <td className="px-6 py-4 text-xs font-semibold">{d.mv_barge_nomination || "-"}</td>
                                                <td className="px-6 py-4 text-xs font-bold text-blue-500">{d.bl_quantity ? `${d.bl_quantity.toLocaleString()} MT` : "-"}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1">
                                                        <span className={cn("w-fit rounded px-2 py-1 text-[10px] font-bold", handover.completed === handover.total ? "bg-emerald-500/10 text-emerald-600" : handover.agingDays > 3 ? "bg-amber-500/10 text-amber-700" : "bg-blue-500/10 text-blue-600")}>
                                                            {handover.completed}/{handover.total} docs
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground">
                                                            {handover.activeLabel} at {handover.stuckAt}{handover.agingDays ? ` (${handover.agingDays}d)` : ""}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-[10px] text-muted-foreground truncate max-w-[200px]">{d.issue || "No Issues"}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button onClick={(e) => { e.stopPropagation(); handleOpenDailyForm(d); }} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><Edit className="w-3.5 h-3.5" /></button>
                                                        <button onClick={(e) => handleDeleteDaily(d.id, e)} className="p-1.5 rounded-lg hover:bg-rose-500/20 text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Daily Form Modal - Expanded with Tabs */}
                        {showDailyForm && (
                            <div className="modal-overlay z-50 fixed inset-0 flex items-center justify-center p-4">
                                <div className="modal-backdrop absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={closeDailyForm} />
                                <div className="modal-content relative bg-card border border-border w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-xl shadow-2xl animate-scale-in flex flex-col z-[60]">
                                    <div className="flex items-center justify-between p-6 border-b border-border">
                                        <div>
                                            <h2 className="text-lg font-bold">{editDailyData ? "Edit" : "New"} Daily Log</h2>
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Unified Delivery Recap System</p>
                                        </div>
                                        <button onClick={closeDailyForm} className="p-2 hover:bg-accent rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                                    </div>

                                    {/* Tabs Header */}
                                    <div className="flex items-center px-6 border-b border-border bg-accent/10">
                                        {[
                                            { id: "general", label: "General Info", icon: Info },
                                            { id: "logistics", label: "Logistics & Tracking", icon: Anchor },
                                            { id: "quality", label: "Surveyor & Quality", icon: Beaker },
                                            { id: "commercial", label: "Commercial & Finance", icon: CreditCard },
                                            { id: "handover", label: "Domestic Handover", icon: FileText },
                                        ].map((t) => (
                                            <button
                                                key={t.id}
                                                onClick={() => setActiveDailyTab(t.id as any)}
                                                className={cn(
                                                    "flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all",
                                                    activeDailyTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                                                )}
                                            >
                                                <t.icon className="w-3.5 h-3.5" /> {t.label}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="p-6 overflow-y-auto flex-1">
                                        {activeDailyTab === "general" && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
                                                <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Report Type</label>
                                                    <select value={dailyForm.report_type} onChange={e => setDailyForm({ ...dailyForm, report_type: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-primary/50">
                                                        <option value="domestic">Domestic</option><option value="export">Export</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Year</label>
                                                    <input type="number" value={dailyForm.year} onChange={e => setDailyForm({ ...dailyForm, year: +e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-primary/50" /></div>
                                                <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Forecast Sales</label>
                                                    <input value={dailyForm.project || ""} onChange={e => setDailyForm({ ...dailyForm, project: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-primary/50" placeholder="e.g. 11GAWE-01" /></div>
                                                <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Buyer</label>
                                                    <input value={dailyForm.buyer} onChange={e => setDailyForm({ ...dailyForm, buyer: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-primary/50" /></div>
                                                <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Supplier</label>
                                                    <input value={dailyForm.supplier || ""} onChange={e => setDailyForm({ ...dailyForm, supplier: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-primary/50" /></div>
                                                <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Area</label>
                                                    <input value={dailyForm.area || ""} onChange={e => setDailyForm({ ...dailyForm, area: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-primary/50" /></div>
                                                <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Shipment Status</label>
                                                    <input value={dailyForm.shipment_status || ""} onChange={e => setDailyForm({ ...dailyForm, shipment_status: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-primary/50" placeholder="e.g. LOADING, COMPLETED" /></div>
                                                <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-bold text-muted-foreground uppercase">Issue / Remarks</label>
                                                    <input value={dailyForm.issue} onChange={e => setDailyForm({ ...dailyForm, issue: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-primary/50" /></div>
                                            </div>
                                        )}

                                        {activeDailyTab === "logistics" && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
                                                <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">MV/Barge Nomination</label>
                                                    <input value={dailyForm.mv_barge_nomination} onChange={e => setDailyForm({ ...dailyForm, mv_barge_nomination: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-primary/50" /></div>
                                                <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">POL</label>
                                                    <input value={dailyForm.pol || ""} onChange={e => setDailyForm({ ...dailyForm, pol: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-primary/50" /></div>
                                                <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">POD</label>
                                                    <input value={dailyForm.pod || ""} onChange={e => setDailyForm({ ...dailyForm, pod: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-primary/50" /></div>
                                                <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Flow</label>
                                                    <input value={dailyForm.flow || ""} onChange={e => setDailyForm({ ...dailyForm, flow: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-primary/50" placeholder="e.g. MV TO BARGE" /></div>
                                                <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">BL Date</label>
                                                    <input type="date" value={dailyForm.bl_date ? new Date(dailyForm.bl_date).toISOString().split('T')[0] : ""} onChange={e => setDailyForm({ ...dailyForm, bl_date: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-primary/50" /></div>
                                                <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Arrive at POL</label>
                                                    <input type="date" value={dailyForm.arrive_at_pol ? new Date(dailyForm.arrive_at_pol).toISOString().split('T')[0] : ""} onChange={e => setDailyForm({ ...dailyForm, arrive_at_pol: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-primary/50" /></div>
                                                <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Commence Loading</label>
                                                    <input type="date" value={dailyForm.commence_loading ? new Date(dailyForm.commence_loading).toISOString().split('T')[0] : ""} onChange={e => setDailyForm({ ...dailyForm, commence_loading: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-primary/50" /></div>
                                                <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Complete Loading</label>
                                                    <input type="date" value={dailyForm.complete_loading ? new Date(dailyForm.complete_loading).toISOString().split('T')[0] : ""} onChange={e => setDailyForm({ ...dailyForm, complete_loading: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-primary/50" /></div>
                                                <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Arrive at POD</label>
                                                    <input type="date" value={dailyForm.arrive_at_pod ? new Date(dailyForm.arrive_at_pod).toISOString().split('T')[0] : ""} onChange={e => setDailyForm({ ...dailyForm, arrive_at_pod: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-primary/50" /></div>
                                            </div>
                                        )}

                                        {activeDailyTab === "quality" && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
                                                <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Surveyor POL</label>
                                                    <input value={dailyForm.surveyor_pol || ""} onChange={e => setDailyForm({ ...dailyForm, surveyor_pol: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-primary/50" /></div>
                                                <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Surveyor POD</label>
                                                    <input value={dailyForm.surveyor_pod || ""} onChange={e => setDailyForm({ ...dailyForm, surveyor_pod: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-primary/50" /></div>
                                                <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Analysis Method</label>
                                                    <input value={dailyForm.analysis_method || ""} onChange={e => setDailyForm({ ...dailyForm, analysis_method: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-primary/50" placeholder="e.g. ASTM, ISO" /></div>
                                                <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl md:col-span-3 grid grid-cols-2 lg:grid-cols-4 gap-4">
                                                    <div className="space-y-1"><label className="text-[10px] font-bold text-primary uppercase text-center block">Actual GCV (GAR)</label>
                                                        <input type="number" value={dailyForm.actual_gcv_gar} onChange={e => setDailyForm({ ...dailyForm, actual_gcv_gar: +e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-primary/30 text-sm font-bold text-center" /></div>
                                                    <div className="space-y-1"><label className="text-[10px] font-bold text-primary uppercase text-center block">Actual TS (%)</label>
                                                        <input type="number" step="0.01" value={dailyForm.actual_ts} onChange={e => setDailyForm({ ...dailyForm, actual_ts: +e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-primary/30 text-sm font-bold text-center" /></div>
                                                    <div className="space-y-1"><label className="text-[10px] font-bold text-primary uppercase text-center block">Actual ASH (%)</label>
                                                        <input type="number" step="0.01" value={dailyForm.actual_ash} onChange={e => setDailyForm({ ...dailyForm, actual_ash: +e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-primary/30 text-sm font-bold text-center" /></div>
                                                    <div className="space-y-1"><label className="text-[10px] font-bold text-primary uppercase text-center block">Actual TM (%)</label>
                                                        <input type="number" step="0.01" value={dailyForm.actual_tm} onChange={e => setDailyForm({ ...dailyForm, actual_tm: +e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-primary/30 text-sm font-bold text-center" /></div>
                                                </div>
                                            </div>
                                        )}

                                        {activeDailyTab === "commercial" && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
                                                <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">BL Quantity (MT)</label>
                                                    <input type="number" value={dailyForm.bl_quantity} onChange={e => setDailyForm({ ...dailyForm, bl_quantity: +e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-primary/50" /></div>
                                                <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">POD Quantity (MT)</label>
                                                    <input type="number" value={dailyForm.pod_quantity || 0} onChange={e => setDailyForm({ ...dailyForm, pod_quantity: +e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-primary/50" /></div>
                                                <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">PO Number</label>
                                                    <input value={dailyForm.po_no || ""} onChange={e => setDailyForm({ ...dailyForm, po_no: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-primary/50" /></div>
                                                <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Base Price</label>
                                                    <input type="number" value={dailyForm.base_price || 0} onChange={e => setDailyForm({ ...dailyForm, base_price: +e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-primary/50" /></div>
                                                <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Invoice Price</label>
                                                    <input type="number" value={dailyForm.invoice_price || 0} onChange={e => setDailyForm({ ...dailyForm, invoice_price: +e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-primary/50" /></div>
                                                <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Payment Status</label>
                                                    <select value={dailyForm.payment_status || "UNPAID"} onChange={e => setDailyForm({ ...dailyForm, payment_status: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-primary/50">
                                                        <option value="UNPAID">Unpaid</option><option value="PARTIAL">Partial</option><option value="PAID">Paid</option>
                                                    </select>
                                                </div>
                                            </div>
                                        )}

                                        {activeDailyTab === "handover" && (
                                            <div className="space-y-5 animate-fade-in">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Full Set Docs</label>
                                                        <select value={dailyForm.full_set_document_status || "pending"} onChange={e => setDailyForm({ ...dailyForm, full_set_document_status: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm">
                                                            <option value="pending">Pending</option>
                                                            <option value="partial">Partial</option>
                                                            <option value="submitted">Submitted</option>
                                                            <option value="approved">Approved</option>
                                                            <option value="completed">Completed</option>
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Hardcopy</label>
                                                        <select value={dailyForm.hardcopy_status || "pending"} onChange={e => setDailyForm({ ...dailyForm, hardcopy_status: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm">
                                                            <option value="pending">Pending</option>
                                                            <option value="partial">Partial</option>
                                                            <option value="received">Received</option>
                                                            <option value="submitted">Submitted</option>
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Softcopy</label>
                                                        <select value={dailyForm.softcopy_status || "pending"} onChange={e => setDailyForm({ ...dailyForm, softcopy_status: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm">
                                                            <option value="pending">Pending</option>
                                                            <option value="partial">Partial</option>
                                                            <option value="received">Received</option>
                                                            <option value="submitted">Submitted</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                <div className="rounded-xl border border-border bg-accent/10 p-4">
                                                    <h3 className="text-xs font-bold text-primary uppercase mb-3">SKAB-SK: Supplier to Operation to Traffic to Finance</h3>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                        {renderDailyDateInput("skab_supplier_sent_at", "Supplier Sent")}
                                                        {renderDailyDateInput("skab_operation_received_at", "Operation Received")}
                                                        {renderDailyDateInput("skab_operation_sent_at", "Operation Sent")}
                                                        {renderDailyDateInput("skab_traffic_received_at", "Traffic Received")}
                                                        {renderDailyDateInput("skab_traffic_sent_finance_at", "Traffic Sent Finance")}
                                                        {renderDailyDateInput("skab_finance_received_at", "Finance Received")}
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-bold text-muted-foreground uppercase">Evidence Ref</label>
                                                            <input value={dailyForm.skab_evidence_document_id || ""} onChange={e => setDailyForm({ ...dailyForm, skab_evidence_document_id: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm" />
                                                        </div>
                                                        <div className="md:col-span-3">
                                                            {renderDailyEvidenceUpload({ documentType: "skab", evidenceField: "skab_evidence_document_id", title: "SKAB-SK Evidence" })}
                                                        </div>
                                                        <div className="space-y-1 md:col-span-2">
                                                            <label className="text-[10px] font-bold text-muted-foreground uppercase">Notes</label>
                                                            <input value={dailyForm.skab_notes || ""} onChange={e => setDailyForm({ ...dailyForm, skab_notes: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm" />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="rounded-xl border border-border bg-accent/10 p-4">
                                                    <h3 className="text-xs font-bold text-primary uppercase mb-3">DSR Carbon: Supplier to Operation to Traffic</h3>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                        {renderDailyDateInput("dsr_supplier_sent_at", "Supplier Sent")}
                                                        {renderDailyDateInput("dsr_operation_received_at", "Operation Received")}
                                                        {renderDailyDateInput("dsr_operation_sent_at", "Operation Sent")}
                                                        {renderDailyDateInput("dsr_traffic_received_at", "Traffic Received")}
                                                        <div className="space-y-1 md:col-span-2">
                                                            <label className="text-[10px] font-bold text-muted-foreground uppercase">Evidence Ref</label>
                                                            <input value={dailyForm.dsr_evidence_document_id || ""} onChange={e => setDailyForm({ ...dailyForm, dsr_evidence_document_id: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm" />
                                                        </div>
                                                        <div className="md:col-span-3">
                                                            {renderDailyEvidenceUpload({ documentType: "dsr", evidenceField: "dsr_evidence_document_id", title: "DSR Carbon Evidence" })}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="rounded-xl border border-border bg-accent/10 p-4">
                                                    <h3 className="text-xs font-bold text-primary uppercase mb-3">BL/CM: Operation to Traffic to Finance</h3>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                        {renderDailyDateInput("bl_date", "BL Date")}
                                                        {renderDailyDateInput("bl_cm_operation_sent_at", "Operation Sent")}
                                                        {renderDailyDateInput("bl_cm_traffic_received_at", "Traffic Received")}
                                                        {renderDailyDateInput("bl_cm_traffic_sent_finance_at", "Traffic Sent Finance")}
                                                        {renderDailyDateInput("bl_cm_finance_received_at", "Finance Received")}
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-bold text-muted-foreground uppercase">Evidence Ref</label>
                                                            <input value={dailyForm.bl_cm_evidence_document_id || ""} onChange={e => setDailyForm({ ...dailyForm, bl_cm_evidence_document_id: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm" />
                                                        </div>
                                                        <div className="md:col-span-3">
                                                            {renderDailyEvidenceUpload({ documentType: "bl_cm", evidenceField: "bl_cm_evidence_document_id", title: "BL/CM Evidence" })}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="rounded-xl border border-border bg-accent/10 p-4">
                                                    <h3 className="text-xs font-bold text-primary uppercase mb-3">COA POL: Surveyor to Traffic to Finance</h3>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                        {renderDailyDateInput("coa_pol_date", "COA Date")}
                                                        {renderDailyDateInput("coa_pol_surveyor_sent_at", "Surveyor Sent")}
                                                        {renderDailyDateInput("coa_pol_traffic_received_at", "Traffic Received")}
                                                        {renderDailyDateInput("coa_pol_finance_received_at", "Finance Received")}
                                                        <div className="space-y-1 md:col-span-2">
                                                            <label className="text-[10px] font-bold text-muted-foreground uppercase">Evidence Ref</label>
                                                            <input value={dailyForm.coa_pol_evidence_document_id || ""} onChange={e => setDailyForm({ ...dailyForm, coa_pol_evidence_document_id: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm" />
                                                        </div>
                                                        <div className="md:col-span-3">
                                                            {renderDailyEvidenceUpload({ documentType: "coa_pol", evidenceField: "coa_pol_evidence_document_id", title: "COA POL Evidence" })}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="rounded-xl border border-border bg-accent/10 p-4">
                                                    <h3 className="text-xs font-bold text-primary uppercase mb-3">COA POD / Final Docs</h3>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                        {renderDailyDateInput("coa_pod_received_at", "COA POD Received")}
                                                        {renderDailyDateInput("finance_submit_full_set_at", "Finance Submit Full Set")}
                                                        {renderDailyDateInput("vendor_received_full_set_at", "Vendor Received")}
                                                        {renderDailyDateInput("approval_dt_at", "Approval DT")}
                                                        {renderDailyDateInput("vendor_paid_at", "Paid to Vendor")}
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-bold text-muted-foreground uppercase">Evidence Ref</label>
                                                            <input value={dailyForm.coa_pod_evidence_document_id || ""} onChange={e => setDailyForm({ ...dailyForm, coa_pod_evidence_document_id: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm" />
                                                        </div>
                                                        <div className="md:col-span-3">
                                                            {renderDailyEvidenceUpload({ documentType: "coa_pod", evidenceField: "coa_pod_evidence_document_id", title: "COA POD / Final Docs Evidence" })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-6 border-t border-border bg-accent/5 flex justify-end gap-3">
                                        <button onClick={closeDailyForm} className="px-4 py-2 hover:bg-accent rounded-lg text-sm font-semibold transition-colors text-muted-foreground" disabled={isSaving}>Cancel</button>
                                        <button onClick={handleSaveDaily} className="btn-primary" disabled={isSaving}>
                                            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : (editDailyData ? "Update Record" : "Create Record")}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : activeView === "map" ? (
                    <div className="card-elevated h-[600px] bg-accent/10 border border-border animate-fade-in relative overflow-hidden rounded-xl">
                        {/* Interactive OpenStreetMap iframe of Indonesia */}
                        <iframe
                            className="absolute inset-0 w-full h-full opacity-80"
                            src="https://www.openstreetmap.org/export/embed.html?bbox=95.0%2C-11.0%2C141.0%2C6.0&layer=mapnik"
                            style={{ filter: 'grayscale(15%)', pointerEvents: 'none' }}
                        ></iframe>

                        {/* Floating Control Panel */}
                        <div className="absolute top-4 left-4 z-10 w-80 space-y-3 p-4 bg-background/90 backdrop-blur-md rounded-2xl border border-border shadow-2xl">
                            <div className="flex items-center gap-3 border-b border-border/50 pb-3">
                                <div className="p-2 bg-primary/10 rounded-lg"><MapIcon className="w-5 h-5 text-primary" /></div>
                                <div>
                                    <h3 className="text-sm font-bold">Interactive Vessel Map</h3>
                                    <p className="text-[10px] text-muted-foreground">Live AIS Tracking</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> {stats.loading + stats.intransit} Active Vessels</span>
                            </div>

                            {/* Coordinate Sync Mock */}
                            <div className="pt-2 border-t border-border/50 space-y-2 mt-2">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase">Sync Coordinates</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <input type="text" placeholder="Lat (e.g. -1.23)" className="w-full px-2 py-1.5 rounded bg-accent/50 border border-border text-xs outline-none focus:border-primary/50" />
                                    <input type="text" placeholder="Lng (e.g. 116.8)" className="w-full px-2 py-1.5 rounded bg-accent/50 border border-border text-xs outline-none focus:border-primary/50" />
                                </div>
                                <button
                                    onClick={(e) => { e.preventDefault(); alert("System: AIS coordinates synced to map overlay."); }}
                                    className="w-full py-1.5 rounded bg-primary text-primary-foreground text-xs font-bold hover:shadow-md transition-all active:scale-95"
                                >
                                    Update Positions
                                </button>
                            </div>
                        </div>

                        {/* Dummy Map Pins */}
                        <div className="absolute z-10 p-2 bg-background border border-border rounded-lg shadow-lg flex items-center gap-2 animate-pulse" style={{ top: '35%', left: '42%' }}>
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                            <div>
                                <p className="text-[10px] font-bold text-emerald-500 leading-tight">MV Global Star</p>
                                <p className="text-[9px] text-muted-foreground">In Transit • 5.5K MT</p>
                            </div>
                        </div>

                        <div className="absolute z-10 p-2 bg-background border border-border rounded-lg shadow-lg flex items-center gap-2 animate-pulse" style={{ top: '65%', left: '25%', animationDelay: '0.5s' }}>
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
                            <div>
                                <p className="text-[10px] font-bold text-amber-500 leading-tight">BG Oceanic</p>
                                <p className="text-[9px] text-muted-foreground">Loading • Anchorage</p>
                            </div>
                        </div>

                        <div className="absolute z-10 p-2 bg-background border border-border rounded-lg shadow-lg flex items-center gap-2 animate-pulse" style={{ top: '48%', left: '78%', animationDelay: '1s' }}>
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                            <div>
                                <p className="text-[10px] font-bold text-blue-500 leading-tight">MV TransNusa</p>
                                <p className="text-[9px] text-muted-foreground">Discharging • Manila</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                            <button onClick={() => setActiveTab("all")} className={cn("filter-chip", activeTab === "all" ? "bg-white text-black font-bold border-transparent" : "bg-white text-muted-foreground border-border hover:text-foreground")}>
                                all ({stats.total})
                            </button>
                            {[
                                { label: "Upcoming", value: "upcoming" as const, count: stats.upcoming },
                                { label: "Loading", value: "loading" as const, count: stats.loading },
                                { label: "In Transit", value: "in_transit" as const, count: stats.intransit },
                                { label: "Completed", value: "completed" as const, count: stats.completed },
                            ].map((item) => {
                                return (
                                    <button key={item.value} onClick={() => setActiveTab(item.value)} className={cn("filter-chip", activeTab === item.value ? "bg-white text-black font-bold border-transparent" : "bg-white text-muted-foreground border-border")}>
                                        {item.label} ({item.count})
                                    </button>
                                );
                            })}
                        </div>

                        {activeView === "card" ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-slide-up">
                                    {paginatedData.map((sh) => {
                                        const stCfg = SHIPMENT_STATUSES.find((s) => s.value === sh.status);
                                        const cp = getCounterparty(sh);
                                        const completeness = getShipmentCompleteness(sh);
                                        return (
                                            <div key={sh.id} className="card-custom p-4 flex flex-col justify-between hover:border-primary/50 transition-colors group cursor-pointer" onClick={() => setDetailShipment(sh)}>
                                                <div>
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div>
                                                            <h3 className="font-bold text-lg text-primary group-hover:underline decoration-primary/50 underline-offset-4">{sh.mv_project_name || sh.vessel_name || sh.shipment_number || `#${sh.no}`}</h3>
                                                            <p className="text-xs text-muted-foreground">{cp.role}: {cp.value} | {sh.origin || "-"} | Year {getShipmentYear(sh) || "-"}</p>
                                                        </div>
                                                        <div className="flex flex-col items-end gap-1">
                                                            <span className="status-badge text-[10px]" style={{ color: stCfg?.color, backgroundColor: `${stCfg?.color}15` }}>
                                                                {stCfg?.label}
                                                            </span>
                                                            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-md border", completenessClass(completeness.percent))}>
                                                                {completeness.percent}% filled
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {sh.status_reason && ["upcoming", "loading", "in_transit"].includes(sh.status) && (
                                                        <p className="text-[10px] text-amber-500/90 mt-1 line-clamp-2"><AlertTriangle className="w-3 h-3 inline mr-1" />{sh.status_reason}</p>
                                                    )}
                                                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs mb-4">
                                                        <div>
                                                            <p className="text-muted-foreground text-[10px] uppercase">MV/Nomination</p>
                                                            <p className="font-medium truncate">{sh.nomination || sh.vessel_name || sh.barge_name || "-"}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-muted-foreground text-[10px] uppercase">Qty Plan</p>
                                                            <p className="font-medium">{(sh.qty_plan || sh.quantity_loaded) ? `${(sh.qty_plan || sh.quantity_loaded)!.toLocaleString()} MT` : "-"}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-muted-foreground text-[10px] uppercase">Jetty/Port</p>
                                                            <p className="font-medium truncate">{sh.jetty_loading_port || sh.loading_port || "-"}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-muted-foreground text-[10px] uppercase">Sales Price</p>
                                                            <p className="font-medium text-emerald-500 font-mono">{shipmentSellPrice(sh) ? `$${safeFmt(shipmentSellPrice(sh))}` : "-"}</p>
                                                        </div>
                                                    </div>
                                                    {completeness.missing.length > 0 && (
                                                        <p className="text-[10px] text-muted-foreground mb-3 line-clamp-1">
                                                            Missing: {completeness.missing.slice(0, 3).join(", ")}{completeness.missing.length > 3 ? ` +${completeness.missing.length - 3}` : ""}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="pt-3 border-t border-border/50 flex justify-between items-center text-xs text-muted-foreground">
                                                    <span className="flex items-center gap-1"><Anchor className="w-3.5 h-3.5" /> {formatLaycanWithYear(sh)}</span>
                                                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={(e) => { e.stopPropagation(); openEdit(sh); }} className="p-1 hover:text-foreground"><Edit className="w-3.5 h-3.5" /></button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {filtered.length === 0 && <div className="col-span-full card-elevated p-12 text-center text-muted-foreground"><Ship className="w-8 h-8 mx-auto mb-3 opacity-20" /> No shipments found in this view</div>}
                                </div>
                                {filtered.length > 0 && (
                                    <div className="flex justify-center mt-4">
                                        <PaginationControls
                                            page={page}
                                            pageSize={pageSize}
                                            totalItems={totalItems}
                                            totalPages={totalPages}
                                            hasNextPage={page < totalPages}
                                            hasPrevPage={page > 1}
                                            onPageChange={setPage}
                                            onPageSizeChange={setPageSize}
                                        />
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* Shipments Table (List View) */
                            <div className="card-elevated overflow-hidden animate-slide-up">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-border bg-accent/30">
                                                <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase w-8"></th>
                                                <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">NO</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">EXP/DMO</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">MV / Forecast Sales</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Year</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Buyer/Vendor</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Nomination</th>
                                                <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Qty Plan</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Laycan</th>
                                                <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Sales</th>
                                                <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Buy/Margin</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Filled</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Status</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Pending Reason</th>
                                                {mainTab === "Risk Assessment" && <th className="text-center px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Risk</th>}
                                                <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase w-16">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paginatedData.map((sh) => {
                                                const stCfg = SHIPMENT_STATUSES.find((s) => s.value === sh.status);
                                                const isExpanded = expandedRows.has(sh.id);
                                                const cp = getCounterparty(sh);
                                                const completeness = getShipmentCompleteness(sh);

                                                return (
                                                    <React.Fragment key={sh.id}>
                                                        <tr className={cn("border-b border-border/50 hover:bg-accent/20 transition-colors cursor-pointer", isExpanded && "bg-accent/10")} onClick={() => toggleExpand(sh.id)}>
                                                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                                                <button onClick={() => toggleExpand(sh.id)} className="p-1 rounded hover:bg-accent transition-colors">
                                                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                                                                </button>
                                                            </td>
                                                            <td className="px-4 py-3 font-medium text-xs text-primary">{sh.no || "-"}</td>
                                                            <td className="px-4 py-3 text-xs">{sh.export_dmo || "-"}</td>
                                                            <td className="px-4 py-3 text-xs font-semibold">{sh.mv_project_name || sh.vessel_name || sh.shipment_number || "-"}</td>
                                                            <td className="px-4 py-3 text-xs font-semibold text-primary/90">{getShipmentYear(sh) || "-"}</td>
                                                            <td className="px-4 py-3 text-xs text-muted-foreground">{cp.value}</td>
                                                            <td className="px-4 py-3 text-xs">{sh.nomination || sh.vessel_name || sh.barge_name || "-"}</td>
                                                            <td className="px-4 py-3 text-right text-xs font-semibold">{(sh.qty_plan || sh.quantity_loaded) ? safeNum(sh.qty_plan || sh.quantity_loaded).toLocaleString() : "-"}</td>
                                                            <td className="px-4 py-3 text-[10px] text-muted-foreground">{formatLaycanWithYear(sh)}</td>
                                                            <td className="px-4 py-3 text-right text-xs font-mono">{shipmentSellPrice(sh) ? `$${safeFmt(shipmentSellPrice(sh))}` : "-"}</td>
                                                            <td className="px-4 py-3 text-right text-xs font-mono font-medium text-emerald-500">
                                                                {shipmentBuyPrice(sh) ? `$${safeFmt(shipmentBuyPrice(sh))}` : "-"} / {shipmentMargin(sh) ? `$${safeFmt(shipmentMargin(sh))}` : "-"}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <span className={cn("text-[10px] font-bold px-2 py-1 rounded-md border", completenessClass(completeness.percent))} title={completeness.missing.length ? `Missing: ${completeness.missing.join(", ")}` : "Complete"}>
                                                                    {completeness.percent}%
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <span className="status-badge text-[10px]" style={{ color: stCfg?.color, backgroundColor: `${stCfg?.color}15` }}>
                                                                    {stCfg?.label}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px]" title={sh.status_reason || ""}>
                                                                {sh.status_reason ? (
                                                                    <span className="truncate block">{sh.status_reason.length > 60 ? sh.status_reason.slice(0, 60) + "..." : sh.status_reason}</span>
                                                                ) : (
                                                                    <span className="text-muted-foreground/50">-</span>
                                                                )}
                                                            </td>
                                                            {mainTab === "Risk Assessment" && (
                                                                <td className="px-4 py-3 text-center">
                                                                    {sh.riskScore ? (
                                                                        <span className={cn("px-2 py-1 rounded text-[10px] font-bold border", sh.riskScore >= 70 ? "bg-red-500/10 text-red-500 border-red-500/20" : sh.riskScore >= 40 ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20")}>
                                                                            {sh.riskScore} • {sh.riskLevel}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-muted-foreground text-[10px]">-</span>
                                                                    )}
                                                                </td>
                                                            )}
                                                            <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                                                <div className="flex items-center justify-end gap-1">
                                                                    <button onClick={() => setDetailShipment(sh)} className="p-1.5 rounded-lg hover:bg-accent transition-colors" title="View Full Detail">
                                                                        <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                                                                    </button>
                                                                    {canManageShipments && (
                                                                        <button onClick={(e) => { e.stopPropagation(); openEdit(sh); }} className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground" title="Edit Shipment">
                                                                            <Edit className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>

                                                        {/* Expanded Detail Row */}
                                                        {isExpanded && (
                                                            <tr className="bg-accent/5 border-b border-border/30">
                                                                <td colSpan={mainTab === "Risk Assessment" ? 16 : 15} className="px-6 py-4">
                                                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                                                        {/* Shipping Details */}
                                                                        <div className="space-y-2">
                                                                            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                                                                                <Anchor className="w-3 h-3" /> Shipping Details
                                                                            </h4>
                                                                            <div className="space-y-1.5 text-xs bg-background/50 p-3 rounded-lg border border-border/50">
                                                                                <div className="flex justify-between"><span className="text-muted-foreground">{cp.role}:</span><span className="font-medium text-right">{cp.value}</span></div>
                                                                                <div className="flex justify-between"><span className="text-muted-foreground">Jetty/Port:</span><span className="font-medium text-right">{sh.jetty_loading_port || sh.loading_port || "-"}</span></div>
                                                                                <div className="flex justify-between"><span className="text-muted-foreground">IUP/OP:</span><span className="font-medium text-right">{sh.iup_op || "-"}</span></div>
                                                                                <div className="flex justify-between"><span className="text-muted-foreground">Shipment Flow:</span><span className="font-medium text-right">{sh.shipment_flow || "-"}</span></div>
                                                                            </div>
                                                                        </div>

                                                                        {/* Blending / Cargo Overview */}
                                                                        <div className="space-y-2">
                                                                            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                                                                                <Package className="w-3 h-3" /> Cargo Origin (Blending)
                                                                            </h4>
                                                                            <div className="bg-background/50 p-3 rounded-lg border border-border/50">
                                                                                {sh.is_blending && sh.blend_sources ? (
                                                                                    <div className="space-y-2">
                                                                                        {sh.blend_sources.map((sid, idx) => {
                                                                                            const src = sources.find((s) => s.id === sid);
                                                                                            return (
                                                                                                <div key={sid} className="pb-2 border-b border-border/30 last:border-0 last:pb-0 text-xs">
                                                                                                    <p className="font-semibold text-violet-400">Source {idx + 1}: {src?.name || sid}</p>
                                                                                                    {src && (
                                                                                                        <p className="text-muted-foreground">GAR {src.spec.gar} · Region: {src.region}</p>
                                                                                                    )}
                                                                                                </div>
                                                                                            );
                                                                                        })}
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="text-xs">
                                                                                        <p className="font-medium">{sh.supplier}</p>
                                                                                        <p className="text-muted-foreground mt-0.5">Single source cargo (no blending)</p>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        {/* Spec & Pending */}
                                                                        <div className="space-y-3">
                                                                            {sh.spec_actual && (
                                                                                <div>
                                                                                    <h4 className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">Actual Quality Spec</h4>
                                                                                    <div className="flex flex-wrap gap-1.5">
                                                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent/60 text-[10px] font-mono">
                                                                                            <span className="text-muted-foreground">GAR</span> <span className="font-semibold">{sh.spec_actual.gar}</span>
                                                                                        </span>
                                                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent/60 text-[10px] font-mono">
                                                                                            <span className="text-muted-foreground">TS</span> <span className="font-semibold">{sh.spec_actual.ts}%</span>
                                                                                        </span>
                                                                                        {(sh.spec_actual.ash ?? 0) > 0 && (
                                                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent/60 text-[10px] font-mono">
                                                                                                <span className="text-muted-foreground">ASH</span> <span className="font-semibold">{sh.spec_actual.ash}%</span>
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            )}

                                                                            {sh.pending_items && sh.pending_items.length > 0 && (
                                                                                <div>
                                                                                    <h4 className="text-[10px] font-semibold text-amber-500 uppercase flex items-center gap-1 mb-1.5">
                                                                                        <AlertTriangle className="w-3 h-3" /> Pending action / Items
                                                                                    </h4>
                                                                                    <div className="space-y-1.5 bg-amber-500/5 p-2.5 rounded-lg border border-amber-500/20">
                                                                                        {sh.pending_items.map((item, j) => (
                                                                                            <div key={j} className="flex gap-2 text-xs">
                                                                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1 shrink-0" />
                                                                                                <span className="text-muted-foreground">{item}</span>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {/* Documentation & Extras */}
                                                                        <div className="space-y-2">
                                                                            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                                                                                <ShieldCheck className="w-3 h-3" /> Documentation & Extras
                                                                            </h4>
                                                                            <div className="space-y-1.5 text-xs bg-background/50 p-3 rounded-lg border border-border/50">
                                                                                <div className="flex justify-between"><span className="text-muted-foreground">No. SPAL:</span><span className="font-medium text-right text-foreground">{sh.no_spal || "-"}</span></div>
                                                                                <div className="flex justify-between"><span className="text-muted-foreground">No. SI:</span><span className="font-medium text-right text-foreground">{sh.no_si || "-"}</span></div>
                                                                                <div className="flex justify-between"><span className="text-muted-foreground">Surveyor LHV:</span><span className="font-medium text-right text-foreground">{sh.surveyor_lhv || "-"}</span></div>
                                                                                <div className="flex justify-between"><span className="text-muted-foreground">Jarak (NM):</span><span className="font-medium text-right text-foreground">{sh.jarak ? `${sh.jarak} NM` : "-"}</span></div>
                                                                                <div className="flex justify-between"><span className="text-muted-foreground">Deadfreight:</span><span className="font-medium text-right text-foreground">{sh.deadfreight || "-"}</span></div>
                                                                                <div className="flex justify-between"><span className="text-muted-foreground">LHV Terbit:</span><span className="font-medium text-right text-foreground">{sh.lhv_terbit ? "✅ YES" : "❌ NO"}</span></div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                {filtered.length === 0 && <div className="card-elevated p-12 text-center text-muted-foreground"><Ship className="w-8 h-8 mx-auto mb-3 opacity-20" /> No shipments found in this view</div>}
                                {filtered.length > 0 && (
                                    <div className="p-4 border-t border-border bg-accent/10">
                                        <PaginationControls
                                            page={page}
                                            pageSize={pageSize}
                                            totalItems={totalItems}
                                            totalPages={totalPages}
                                            hasNextPage={page < totalPages}
                                            hasPrevPage={page > 1}
                                            onPageChange={setPage}
                                            onPageSizeChange={setPageSize}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}

                {mainTab === "Analytics" && (
                    <div className="space-y-6 animate-fade-in text-sm">
                        {/* Filters */}
                        <div className="card-elevated p-4">
                            <div className="flex items-center gap-2 mb-4 text-muted-foreground font-semibold">
                                <Search className="w-4 h-4" /> Analytics Filters
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="space-y-1.5"><label className="text-[10px] text-muted-foreground uppercase">Date From</label><input type="date" className="w-full bg-accent/30 border border-border rounded-lg px-3 py-1.5 focus:border-primary/50 text-xs" /></div>
                                <div className="space-y-1.5"><label className="text-[10px] text-muted-foreground uppercase">Date To</label><input type="date" className="w-full bg-accent/30 border border-border rounded-lg px-3 py-1.5 focus:border-primary/50 text-xs" /></div>
                                <div className="space-y-1.5"><label className="text-[10px] text-muted-foreground uppercase">Status</label><select className="w-full bg-accent/30 border border-border rounded-lg px-3 py-1.5 focus:border-primary/50 text-xs"><option>All Status</option></select></div>
                                <div className="space-y-1.5"><label className="text-[10px] text-muted-foreground uppercase">Period View</label><select className="w-full bg-accent/30 border border-border rounded-lg px-3 py-1.5 focus:border-primary/50 text-xs"><option>Monthly</option></select></div>
                            </div>
                        </div>

                        {/* Top 5 Metrics */}
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                            <div className="bg-card shadow-sm border border-border/30 rounded-xl p-4 flex flex-col justify-center">
                                <p className="text-[10px] text-muted-foreground">Total Volume</p>
                                <p className="text-xl font-bold text-blue-400 mt-1">8,072,785.747</p>
                                <p className="text-[10px] text-blue-400/70 mt-1">MT</p>
                            </div>
                            <div className="bg-card shadow-sm border border-border/30 rounded-xl p-4 relative overflow-hidden flex flex-col justify-center">
                                <p className="text-[10px] text-muted-foreground">Total Revenue</p>
                                <p className="text-xl font-bold text-emerald-400 mt-1">$496.05M</p>
                                <p className="text-[10px] text-emerald-400/70 mt-1">200 shipments</p>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400/20"><TrendingUp className="w-12 h-12" /></div>
                            </div>
                            <div className="bg-card shadow-sm border border-border/30 rounded-xl p-4 relative overflow-hidden flex flex-col justify-center">
                                <p className="text-[10px] text-muted-foreground">Gross Profit</p>
                                <p className="text-xl font-bold text-emerald-400 mt-1">$18.15M</p>
                                <p className="text-[10px] text-emerald-400/70 mt-1">total profit</p>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400/20"><TrendingUp className="w-12 h-12" /></div>
                            </div>
                            <div className="bg-card shadow-sm border border-border/30 rounded-xl p-4 relative overflow-hidden flex flex-col justify-center">
                                <p className="text-[10px] text-muted-foreground">GP Margin</p>
                                <p className="text-xl font-bold text-amber-400 mt-1">3.66%</p>
                                <p className="text-[10px] text-amber-400/70 mt-1">$2.42/MT</p>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border-4 border-amber-400/20 w-8 h-8 flex items-center justify-center"><div className="w-2 h-2 bg-amber-400/40 rounded-full" /></div>
                            </div>
                            <div className="bg-card shadow-sm border border-border/30 rounded-xl p-4 relative overflow-hidden flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] text-muted-foreground">On-Time Delivery</p>
                                    <p className="text-xl font-bold text-blue-400 mt-1">0.0%</p>
                                    <p className="text-[10px] text-blue-400/70 mt-1">195 completed</p>
                                </div>
                                <div className="text-blue-400"><CheckCircle2 className="w-8 h-8" /></div>
                            </div>
                        </div>

                        {/* Status Distribution */}
                        <div className="card-elevated p-6">
                            <h3 className="text-xs font-bold mb-6 text-foreground">Shipment Status Distribution</h3>
                            <div className="h-64 flex justify-center items-center">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={[
                                            { name: 'Completed', value: 195, fill: '#0ea5e9' },
                                            { name: 'Draft', value: 5, fill: '#8b5cf6' },
                                            { name: 'Confirmed', value: 0, fill: '#10b981' },
                                            { name: 'Loading', value: 0, fill: '#f59e0b' },
                                        ]} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={2} label={({ name, value }) => `${name}: ${value}`} labelLine={false} stroke="none">
                                            {
                                                [
                                                    { name: 'Completed', value: 195, fill: '#0ea5e9' },
                                                    { name: 'Draft', value: 5, fill: '#8b5cf6' },
                                                    { name: 'Confirmed', value: 0, fill: '#10b981' },
                                                    { name: 'Loading', value: 0, fill: '#f59e0b' },
                                                ].map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                                ))
                                            }
                                        </Pie>
                                        <Tooltip contentStyle={{ backgroundColor: '#1C2136', borderColor: '#2e3552', borderRadius: '8px', fontSize: '12px' }} />
                                        <Legend verticalAlign="bottom" height={36} iconType="square" wrapperStyle={{ fontSize: '11px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* 4 Extra Mini Metrics */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="bg-card shadow-sm border border-border/30 rounded-xl p-4 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] text-muted-foreground">On-Time Delivery</p>
                                    <p className="text-xl font-bold text-foreground mt-1">0.0%</p>
                                    <p className="text-[10px] text-blue-400 mt-0.5">195 completed</p>
                                </div>
                                <div className="w-8 h-8 rounded-full border border-blue-400/50 flex items-center justify-center text-blue-400"><CheckCircle2 className="w-4 h-4" /></div>
                            </div>
                            <div className="bg-card shadow-sm border border-border/30 rounded-xl p-4 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] text-muted-foreground">Avg Transit Time</p>
                                    <p className="text-xl font-bold text-foreground mt-1">0.0</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">days</p>
                                </div>
                                <div className="w-8 h-8 rounded-full border border-purple-400/50 flex items-center justify-center text-purple-400"><div className="w-4 h-4 rounded-full border-2 border-current flex items-center justify-center"><div className="w-1 h-1 bg-current rounded-full" /></div></div>
                            </div>
                            <div className="bg-card shadow-sm border border-border/30 rounded-xl p-4 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] text-muted-foreground">Avg Cost per MT</p>
                                    <p className="text-xl font-bold text-foreground mt-1">$58.91</p>
                                    <p className="text-[10px] text-emerald-400 mt-0.5">weighted average</p>
                                </div>
                                <div className="text-emerald-400 text-2xl font-serif font-bold">$</div>
                            </div>
                            <div className="bg-card shadow-sm border border-amber-500/30 rounded-xl p-4 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] text-amber-500/70">Avg Margin</p>
                                    <p className="text-xl font-bold text-foreground mt-1">$2.42</p>
                                    <p className="text-[10px] text-amber-500 mt-0.5">per MT</p>
                                </div>
                                <div className="text-amber-500"><TrendingUp className="w-6 h-6" /></div>
                            </div>
                        </div>

                        {/* AI Anomaly Detection */}
                        <div className="card-elevated border-red-500/20 bg-gradient-to-r from-red-500/5 to-transparent p-6 text-center">
                            <div className="flex items-center justify-center gap-2 text-red-400 font-bold text-sm mb-4">
                                <AlertTriangle className="w-4 h-4" /> AI Anomaly Detection
                            </div>
                            <p className="text-xs text-muted-foreground mb-6">Detect cost anomalies, timeline deviations, and performance issues using AI</p>
                            <button className="bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 mx-auto">
                                <AlertTriangle className="w-3.5 h-3.5" /> Run AI Anomaly Detection
                            </button>
                        </div>

                        {/* Bottom Chart Tabs */}
                        <div className="flex gap-2 text-[10px] font-bold">
                            <button className="bg-white text-black px-4 py-2 rounded-lg">Monthly Trends</button>
                            <button className="bg-white/5 text-muted-foreground px-4 py-2 rounded-lg hover:bg-white/10">Regional</button>
                            <button className="bg-white/5 text-muted-foreground px-4 py-2 rounded-lg hover:bg-white/10">Vessels</button>
                            <button className="bg-white/5 text-muted-foreground px-4 py-2 rounded-lg hover:bg-white/10">Buyers</button>
                        </div>

                        {/* Trends Charts */}
                        <div className="card-elevated p-6 space-y-6">
                            <div>
                                <h3 className="text-xs font-bold mb-4">Monthly Performance Trends</h3>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={[
                                            { name: "Apr 2025", rev: 100, prof: 10 }, { name: "May 2025", rev: 150, prof: 15 },
                                            { name: "Nov 2025", rev: 120, prof: 20 }, { name: "Dec 2025", rev: 250, prof: 25 },
                                            { name: "Jun 2025", rev: 80, prof: 10 }, { name: "Jul 2025", rev: 30, prof: 5 },
                                            { name: "Aug 2025", rev: 200, prof: 25 }, { name: "Sep 2025", rev: 180, prof: 20 },
                                            { name: "Oct 2025", rev: 150, prof: 18 }, { name: "Jan 2026", rev: 40, prof: 5 },
                                            { name: "Feb 2026", rev: 10, prof: 2 }, { name: "Mar 2026", rev: 20, prof: 8 }
                                        ]}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                            <XAxis dataKey="name" stroke="#888" fontSize={10} tickLine={false} axisLine={false} />
                                            <YAxis stroke="#888" fontSize={10} tickLine={false} axisLine={false} />
                                            <Tooltip contentStyle={{ backgroundColor: '#1C2136', borderColor: '#2e3552', borderRadius: '8px' }} />
                                            <Legend verticalAlign="bottom" height={20} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                                            <Area type="monotone" dataKey="rev" name="Revenue ($)" stroke="#0ea5e9" fillOpacity={0.2} fill="#0ea5e9" />
                                            <Area type="monotone" dataKey="prof" name="Profit ($)" stroke="#10b981" fillOpacity={0.2} fill="#10b981" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="card-elevated p-6">
                                <h3 className="text-xs font-bold mb-4">Volume Trends</h3>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={[
                                            { name: "May 2025", vol: 6000000 }, { name: "Dec 2025", vol: 9000000 },
                                            { name: "Jul 2025", vol: 4000000 }, { name: "Sep 2025", vol: 5000000 },
                                            { name: "Jan 2026", vol: 2000000 }, { name: "Mar 2026", vol: 800000 }
                                        ]}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                            <XAxis dataKey="name" stroke="#888" fontSize={10} tickLine={false} axisLine={false} />
                                            <YAxis stroke="#888" fontSize={10} tickLine={false} axisLine={false} />
                                            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#1C2136', borderColor: '#2e3552', borderRadius: '8px' }} />
                                            <Bar dataKey="vol" name="Volume (MT)" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                                            <Legend verticalAlign="bottom" height={20} iconType="square" wrapperStyle={{ fontSize: '10px' }} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <div className="card-elevated p-6">
                                <h3 className="text-xs font-bold mb-4">GP Margin % Trends</h3>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={[
                                            { name: "Apr 2025", margin: 2 }, { name: "Nov 2025", margin: 2 },
                                            { name: "Jun 2025", margin: 2.5 }, { name: "Aug 2025", margin: 2.2 },
                                            { name: "Oct 2025", margin: 2.1 }, { name: "Mar 2026", margin: 60 }
                                        ]}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                            <XAxis dataKey="name" stroke="#888" fontSize={10} tickLine={false} axisLine={false} />
                                            <YAxis stroke="#888" fontSize={10} tickLine={false} axisLine={false} />
                                            <Tooltip contentStyle={{ backgroundColor: '#1C2136', borderColor: '#2e3552', borderRadius: '8px' }} />
                                            <Line type="monotone" dataKey="margin" name="GP Margin (%)" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} />
                                            <Legend verticalAlign="bottom" height={20} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        <div className="card-elevated p-6">
                            <h3 className="text-xs font-bold mb-4">Cost Trend Analysis</h3>
                            <div className="h-48">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={[
                                        { name: "Apr 2025", cost: 65 }, { name: "May 2025", cost: 62 },
                                        { name: "Nov 2025", cost: 58 }, { name: "Dec 2025", cost: 63 },
                                        { name: "Jun 2025", cost: 55 }, { name: "Jul 2025", cost: 42 },
                                        { name: "Aug 2025", cost: 68 }, { name: "Sep 2025", cost: 50 },
                                        { name: "Oct 2025", cost: 58 }, { name: "Jan 2026", cost: 42 },
                                        { name: "Feb 2026", cost: 62 }, { name: "Mar 2026", cost: 5 }
                                    ]}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                        <XAxis dataKey="name" stroke="#888" fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#888" fontSize={10} tickLine={false} axisLine={false} />
                                        <Tooltip contentStyle={{ backgroundColor: '#1C2136', borderColor: '#2e3552', borderRadius: '8px' }} />
                                        <Line type="monotone" dataKey="cost" name="Avg Cost/MT ($)" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 3 }} />
                                        <Legend verticalAlign="bottom" height={20} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                )}

                {/* Detail Modal (Keep current structure for View detail) */}
                {detailShipment && (
                    <div className="modal-overlay">
                        <div className="modal-backdrop" onClick={closeDetailModal} />
                        <div className="modal-content w-full max-w-5xl bg-card border border-border shadow-2xl p-4 sm:p-6 flex flex-col max-h-[92vh] overflow-hidden rounded-xl">
                            <div className="flex flex-col gap-4 mb-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <h3 className="text-xs sm:text-sm font-bold text-foreground mb-2">Shipment Details</h3>
                                        <h2 className="text-3xl sm:text-4xl font-black text-foreground leading-[1.05] break-words">
                                            {detailShipment.vessel_name || detailShipment.mv_project_name || detailShipment.shipment_number || "Shipment Detail"}
                                        </h2>
                                        <p className="text-xs sm:text-sm text-muted-foreground mt-1 break-words">
                                            {[detailShipment.buyer, detailShipment.supplier].filter(Boolean).join(" • ") || "-"}
                                        </p>
                                    </div>
                                    <button onClick={closeDetailModal} className="p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg transition-colors shrink-0">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="px-3 py-1.5 rounded-md text-xs font-bold text-white bg-emerald-500">
                                            {SHIPMENT_STATUSES.find(s => s.value === detailShipment.status)?.label || "Completed"}
                                        </span>
                                        {(() => {
                                            const completeness = getShipmentCompleteness(detailShipment);
                                            return (
                                                <span className={cn("px-3 py-1.5 rounded-md text-xs font-bold border", completenessClass(completeness.percent))} title={completeness.missing.length ? `Missing: ${completeness.missing.join(", ")}` : "Complete"}>
                                                    {completeness.percent}% data filled
                                                </span>
                                            );
                                        })()}
                                        {canManageShipments && (
                                            <>
                                                <button onClick={() => { setEditShipment(detailShipment); setEditForm({ ...detailShipment }); closeDetailModal(); }} className="flex items-center gap-2 px-3 py-1.5 bg-background border border-border rounded-md hover:bg-accent text-xs font-semibold text-foreground transition-colors">
                                                    <Edit className="w-3.5 h-3.5" /> Edit
                                                </button>
                                                <button onClick={async () => {
                                                    if (window.confirm(`Delete shipment ${detailShipment.shipment_number}? This cannot be undone.`)) {
                                                        try {
                                                            await deleteShipment(detailShipment.id);
                                                            setToast({ message: "Shipment deleted successfully!", type: "success" });
                                                            closeDetailModal();
                                                        } catch (error) {
                                                            setToast({ message: "Failed to delete shipment.", type: "error" });
                                                        }
                                                    }
                                                }} className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-md hover:bg-red-500/20 text-xs font-semibold text-red-500 transition-colors">
                                                    <Trash2 className="w-3.5 h-3.5" /> Delete
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="mb-4">
                                <div className="grid grid-cols-2 md:flex md:items-center gap-1.5 bg-accent/40 p-1.5 rounded-xl border border-border/40">
                                    <button onClick={() => setDetailModalTab("overview")} className={cn("px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all", detailModalTab === "overview" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50")}>Overview</button>
                                    <button onClick={() => setDetailModalTab("documents")} className={cn("px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all", detailModalTab === "documents" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50")}>Documents</button>
                                    <button onClick={() => setDetailModalTab("blending")} className={cn("px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all", detailModalTab === "blending" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50")}>Blending Details</button>
                                    <button onClick={() => setDetailModalTab("timeline")} className={cn("px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all", detailModalTab === "timeline" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50")}>Timeline</button>
                                    <button onClick={() => setDetailModalTab("risk")} className={cn("px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all", detailModalTab === "risk" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50")}>Risk Analysis</button>
                                </div>
                            </div>

                            <div className="overflow-y-auto overflow-x-hidden pr-1 sm:pr-2 pb-2 sm:pb-4 space-y-4">
                                {detailModalTab === "overview" && (
                                    <div className="space-y-6 animate-fade-in">
                                        {(() => {
                                            const completeness = getShipmentCompleteness(detailShipment);
                                            return (
                                                <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                                        <div>
                                                            <p className="text-xs font-bold text-foreground">Shipment Data Completeness</p>
                                                            <p className="text-xs text-muted-foreground mt-1">
                                                                {completeness.filled} of {completeness.total} required operational/commercial fields filled.
                                                            </p>
                                                        </div>
                                                        <span className={cn("w-fit text-sm font-black px-3 py-2 rounded-lg border", completenessClass(completeness.percent))}>{completeness.percent}%</span>
                                                    </div>
                                                    <div className="mt-3 h-2 rounded-full bg-accent overflow-hidden">
                                                        <div className={cn("h-full", completeness.percent >= 85 ? "bg-emerald-500" : completeness.percent >= 60 ? "bg-amber-500" : "bg-rose-500")} style={{ width: `${completeness.percent}%` }} />
                                                    </div>
                                                    {completeness.missing.length > 0 && (
                                                        <p className="text-[11px] text-muted-foreground mt-2">
                                                            Missing: {completeness.missing.slice(0, 8).join(", ")}{completeness.missing.length > 8 ? ` +${completeness.missing.length - 8}` : ""}
                                                        </p>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                        <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
                                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-xs font-bold text-sky-600">Shipping Instruction Versions</p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {isLoadingSiRecords
                                                            ? "Loading SI records..."
                                                            : shippingInstructions.length
                                                                ? `${shippingInstructions.length} SI version(s) recorded for this shipment.`
                                                                : "No SI version has been recorded yet."}
                                                    </p>
                                                </div>
                                                {canManageShipments && (
                                                    <button
                                                        onClick={generateSiRecord}
                                                        disabled={siAction}
                                                        className="w-fit px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 text-white disabled:opacity-50"
                                                    >
                                                        {siAction ? <Loader2 className="w-3.5 h-3.5 inline mr-1.5 animate-spin" /> : <FileText className="w-3.5 h-3.5 inline mr-1.5" />}
                                                        {shippingInstructions.length ? "Create SI Revision" : "Record SI v1"}
                                                    </button>
                                                )}
                                            </div>
                                            {shippingInstructions.length > 0 && (
                                                <div className="mt-3 space-y-2">
                                                    {shippingInstructions.slice(0, 4).map((record) => (
                                                        <div key={record.id} className="rounded-lg border border-border/60 bg-card p-3 text-xs">
                                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                                <div>
                                                                    <p className="font-bold text-foreground">{record.siNumber}</p>
                                                                    <p className="text-[10px] text-muted-foreground">Version {record.version} | {record.status}</p>
                                                                </div>
                                                                <span className="text-[10px] text-muted-foreground">
                                                                    {record.generatedByName || "Unknown"} | {new Date(record.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                                                                </span>
                                                            </div>
                                                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                                                <a
                                                                    href={record.pdfUrl || `/api/shipments/${detailShipment.id}/shipping-instructions/${record.id}/pdf`}
                                                                    className="inline-flex items-center gap-1.5 rounded-md border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[10px] font-semibold text-sky-600 hover:bg-sky-500/15"
                                                                >
                                                                    <Download className="h-3.5 w-3.5" />
                                                                    Download SI PDF v{record.version}
                                                                </a>
                                                                {record.pdfGeneratedAt && (
                                                                    <span className="text-[10px] text-muted-foreground">
                                                                        PDF snapshot: {new Date(record.pdfGeneratedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {record.reason && <p className="mt-2 text-muted-foreground">{record.reason}</p>}
                                                            {record.earlyApprovalReason && (
                                                                <p className="mt-1 text-amber-600">Early approval reason: {record.earlyApprovalReason}</p>
                                                            )}
                                                            {record.approvalComment && (
                                                                <p className="mt-1 text-muted-foreground">
                                                                    Decision by {record.approvedByName || "Unknown"}: {record.approvalComment}
                                                                </p>
                                                            )}
                                                            {record.cancellationReason && (
                                                                <p className="mt-1 text-rose-600">
                                                                    Cancelled by {record.cancelledByName || "Unknown"}: {record.cancellationReason}
                                                                </p>
                                                            )}
                                                            {record.status === "early_pending_approval" && canAccessCriticalDocuments && (
                                                                <div className="mt-2 flex flex-wrap gap-2">
                                                                    <button
                                                                        onClick={() => decideSiRecord(record, "approve")}
                                                                        disabled={siAction}
                                                                        className="px-2.5 py-1 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 disabled:opacity-50"
                                                                    >
                                                                        Approve Early SI
                                                                    </button>
                                                                    <button
                                                                        onClick={() => decideSiRecord(record, "reject")}
                                                                        disabled={siAction}
                                                                        className="px-2.5 py-1 rounded-md text-[10px] font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/30 disabled:opacity-50"
                                                                    >
                                                                        Reject
                                                                    </button>
                                                                </div>
                                                            )}
                                                            {!["cancelled", "superseded"].includes(record.status) && canManageShipments && (
                                                                <div className="mt-2">
                                                                    <button
                                                                        onClick={() => cancelSiRecord(record)}
                                                                        disabled={siAction}
                                                                        className="px-2.5 py-1 rounded-md text-[10px] font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/30 disabled:opacity-50"
                                                                    >
                                                                        Cancel SI
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        {(linkedForecast || detailShipment.fco_number || detailShipment.forecast_sales_name) && (
                                            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                                                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                                                    <div>
                                                        <p className="text-xs font-bold text-blue-600">Commercial Reference</p>
                                                        <h4 className="text-sm font-black text-foreground mt-1">
                                                            {linkedForecast?.name || detailShipment.forecast_sales_name || detailShipment.mv_project_name || "-"}
                                                        </h4>
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            FCO: <span className="font-semibold text-foreground">{linkedForecast?.fco_number || detailShipment.fco_number || "-"}</span>
                                                            {" | "}
                                                            Buyer Feedback: <span className="font-semibold text-foreground">{linkedForecast?.buyer_feedback_status || "-"}</span>
                                                        </p>
                                                    </div>
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs min-w-0 lg:min-w-[520px]">
                                                        <div>
                                                            <p className="text-[10px] uppercase text-muted-foreground">Target Price</p>
                                                            <p className="font-bold text-foreground">{linkedForecast?.target_selling_price ? `$${safeFmt(linkedForecast.target_selling_price)}` : (shipmentSellPrice(detailShipment) ? `$${safeFmt(shipmentSellPrice(detailShipment))}` : "-")}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] uppercase text-muted-foreground">Payment</p>
                                                            <p className="font-bold text-foreground truncate">{linkedForecast?.payment_terms || "-"}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] uppercase text-muted-foreground">Surveyor</p>
                                                            <p className="font-bold text-foreground truncate">{linkedForecast?.surveyor || detailShipment.surveyor_lhv || "-"}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] uppercase text-muted-foreground">Source</p>
                                                            <p className="font-bold text-foreground truncate">{detailShipment.supplier || detailShipment.source || linkedForecast?.supplier_candidates || "-"}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {[
                                                        { label: "MoM Reference", doc: selectedMomDoc, empty: detailShipment.commercial_mom_document_id ? "Linked MoM not found" : "No MoM linked" },
                                                        { label: "PO Reference", doc: selectedPoDoc, empty: detailShipment.commercial_po_document_id ? "Linked PO not found" : "No PO linked" },
                                                    ].map((item) => (
                                                        <div key={item.label} className="rounded-lg border border-blue-500/15 bg-background/70 p-3">
                                                            <p className="text-[10px] uppercase text-muted-foreground font-semibold">{item.label}</p>
                                                            {item.doc ? (
                                                                <a
                                                                    href={item.doc.url || `/api/projects/${item.doc.projectId}/documents/${item.doc.id}`}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="mt-1 inline-flex max-w-full items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline"
                                                                >
                                                                    <FileText className="w-3.5 h-3.5 shrink-0" />
                                                                    <span className="truncate">{item.doc.fileName}</span>
                                                                </a>
                                                            ) : (
                                                                <p className="mt-1 text-xs text-muted-foreground">{isLoadingProjectReferenceDocs ? "Loading reference docs..." : item.empty}</p>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                                {linkedForecast && (
                                                    <a
                                                        href={`/forecast-sales?q=${encodeURIComponent(linkedForecast.name)}`}
                                                        className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold text-blue-600 hover:underline"
                                                    >
                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                        Open Forecast Sales
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                        {(detailShipment.source || detailShipment.supplier || detailShipment.source_confirmation_status) && (
                                            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                                                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                                                    <div>
                                                        <p className="text-xs font-bold text-emerald-600">Source Confirmation</p>
                                                        <h4 className="text-sm font-black text-foreground mt-1">{detailShipment.supplier || detailShipment.source || "-"}</h4>
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            Status: <span className="font-semibold text-foreground">{detailShipment.source_confirmation_status || "not set"}</span>
                                                            {" | "}
                                                            Legal: <span className="font-semibold text-foreground">{detailShipment.source_legal_readiness_status || "-"}</span>
                                                            {" | "}
                                                            Cargo: <span className="font-semibold text-foreground">{detailShipment.source_cargo_readiness_status || "-"}</span>
                                                        </p>
                                                        {detailShipment.source_confirmation_notes && (
                                                            <p className="text-xs text-muted-foreground mt-2">{detailShipment.source_confirmation_notes}</p>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0 lg:min-w-[280px]">
                                                        {sourceConfirmationDoc ? (
                                                            <a
                                                                href={sourceConfirmationDoc.url || `/api/shipments/${detailShipment.id}/documents/${sourceConfirmationDoc.id}`}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="inline-flex max-w-full items-center gap-1.5 text-xs font-bold text-emerald-600 hover:underline"
                                                            >
                                                                <FileText className="w-3.5 h-3.5 shrink-0" />
                                                                <span className="truncate">{sourceConfirmationDoc.fileName}</span>
                                                            </a>
                                                        ) : (
                                                            <p className="text-xs text-muted-foreground">No source evidence linked.</p>
                                                        )}
                                                        {canManageShipments && (
                                                            <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-emerald-500/25 bg-background px-3 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-500/10">
                                                                <Upload className="w-3.5 h-3.5" />
                                                                {documentAction === "source-confirmation" ? "Uploading..." : "Upload Evidence"}
                                                                <input type="file" className="hidden" accept="image/*,.pdf,.doc,.docx" onChange={(e) => uploadSourceConfirmationEvidence(e.target.files?.[0] || null)} disabled={documentAction === "source-confirmation"} />
                                                            </label>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                                            {/* Unified Shipment Identity */}
                                            <div className="border border-border/60 rounded-xl p-4 sm:p-5 bg-background/60 shadow-sm">
                                                <h4 className="text-[11px] sm:text-xs font-bold flex items-center gap-2 mb-3 text-primary uppercase tracking-wider">
                                                    <Package className="w-4 h-4" /> Logistics Identity
                                                </h4>
                                                <div className="space-y-2.5 text-xs sm:text-[13px]">
                                                    <div className="grid grid-cols-[96px_1fr] gap-3"><span className="text-muted-foreground uppercase">Forecast Sales</span><span className="font-semibold text-foreground break-words">{detailShipment.mv_project_name || detailShipment.vessel_name || "-"}</span></div>
                                                    <div className="grid grid-cols-[96px_1fr] gap-3"><span className="text-muted-foreground uppercase">Vessel</span><span className="font-semibold text-foreground break-words">{detailShipment.vessel_name || detailShipment.nomination || "-"}</span></div>
                                                    <div className="grid grid-cols-[96px_1fr] gap-3"><span className="text-muted-foreground uppercase">Barge</span><span className="font-medium text-foreground break-words">{detailShipment.barge_name || "-"}</span></div>
                                                    <div className="grid grid-cols-[96px_1fr] gap-3"><span className="text-muted-foreground uppercase">{getCounterparty(detailShipment).role}</span><span className="font-bold text-primary break-words">{getCounterparty(detailShipment).value}</span></div>
                                                </div>
                                            </div>

                                            {/* Port & Period Details */}
                                            <div className="border border-border/60 rounded-xl p-4 sm:p-5 bg-background/60 shadow-sm">
                                                <h4 className="text-[11px] sm:text-xs font-bold flex items-center gap-2 mb-3 text-primary uppercase tracking-wider">
                                                    <Anchor className="w-4 h-4" /> Port & Timeline
                                                </h4>
                                                <div className="space-y-2.5 text-xs sm:text-[13px]">
                                                    <div className="grid grid-cols-[96px_1fr] gap-3"><span className="text-muted-foreground uppercase">Load Port</span><span className="font-semibold text-foreground break-words">{detailShipment.jetty_loading_port || detailShipment.loading_port || "-"}</span></div>
                                                    <div className="grid grid-cols-[96px_1fr] gap-3"><span className="text-muted-foreground uppercase">Discharge</span><span className="font-medium text-foreground break-words">{detailShipment.discharge_port || "-"}</span></div>
                                                    <div className="grid grid-cols-[96px_1fr] gap-3"><span className="text-muted-foreground uppercase">Laycan</span><span className="font-semibold text-foreground break-words">{formatLaycanWithYear(detailShipment)}</span></div>
                                                    <div className="grid grid-cols-[96px_1fr] gap-3"><span className="text-muted-foreground uppercase">Region</span><span className="font-medium text-muted-foreground break-words">{detailShipment.origin || "-"}</span></div>
                                                </div>
                                            </div>

                                            {/* Financial & Quantities */}
                                            <div className="border border-emerald-500/20 rounded-xl p-4 sm:p-5 bg-emerald-500/5 shadow-sm">
                                                <h4 className="text-[11px] sm:text-xs font-bold flex items-center gap-2 mb-3 text-emerald-600 uppercase tracking-wider">
                                                    <DollarSign className="w-4 h-4" /> Commercials
                                                </h4>
                                                <div className="space-y-2.5 text-xs sm:text-[13px]">
                                                    <div className="grid grid-cols-[96px_1fr] gap-3"><span className="text-muted-foreground uppercase">Qty Loaded</span><span className="font-black text-foreground break-words">{shipmentQty(detailShipment).toLocaleString()} MT</span></div>
                                                    <div className="grid grid-cols-[96px_1fr] gap-3"><span className="text-muted-foreground uppercase">Sales Price</span><span className="font-bold text-emerald-600 break-words">${safeFmt(shipmentSellPrice(detailShipment))}/MT</span></div>
                                                    <div className="grid grid-cols-[96px_1fr] gap-3"><span className="text-muted-foreground uppercase">Buying Price</span><span className="font-bold text-amber-600 break-words">${safeFmt(shipmentBuyPrice(detailShipment))}/MT</span></div>
                                                    <div className="grid grid-cols-[96px_1fr] gap-3"><span className="text-muted-foreground uppercase">Freight</span><span className="font-medium text-foreground break-words">${safeFmt(detailShipment.price_freight ?? detailShipment.shipping_rate)}/MT</span></div>
                                                    <div className="grid grid-cols-[96px_1fr] gap-3"><span className="text-muted-foreground uppercase">Royalty/Tax</span><span className="font-medium text-foreground break-words">${safeFmt(safeNum(detailShipment.royalty_cost) + safeNum(detailShipment.tax_export_cost))}/MT</span></div>
                                                    <div className="grid grid-cols-[96px_1fr] gap-3"><span className="text-muted-foreground uppercase">Survey/Pay</span><span className="font-medium text-foreground break-words">${safeFmt(safeNum(detailShipment.survey_cost) + safeNum(detailShipment.payment_finance_cost))}/MT</span></div>
                                                    <div className="grid grid-cols-[96px_1fr] gap-3"><span className="text-muted-foreground uppercase">Margin</span><span className="font-bold text-blue-600 break-words">${safeFmt(shipmentMargin(detailShipment))}/MT</span></div>
                                                    <div className="grid grid-cols-[96px_1fr] gap-3 border-t border-emerald-500/10 pt-2"><span className="text-muted-foreground uppercase">Est. Revenue</span><span className="font-black text-emerald-700 break-words">${(shipmentQty(detailShipment) * shipmentSellPrice(detailShipment)).toLocaleString()}</span></div>
                                                    <div className="grid grid-cols-[96px_1fr] gap-3"><span className="text-muted-foreground uppercase">Est. GP</span><span className="font-black text-blue-700 break-words">${(shipmentQty(detailShipment) * (shipmentSellPrice(detailShipment) - shipmentCostPerMt(detailShipment))).toLocaleString()}</span></div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Operational & Legal Details */}
                                        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 sm:p-5 shadow-sm">
                                            <h4 className="text-[11px] sm:text-xs font-bold flex items-center gap-2 mb-3 text-blue-600 uppercase tracking-wider">
                                                <ShieldCheck className="w-4 h-4" /> Operational & Legal
                                            </h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs sm:text-[13px]">
                                                <div className="space-y-1"><p className="text-muted-foreground uppercase text-[10px]">IUP OP</p><p className="font-semibold text-foreground break-words">{detailShipment.iup_op || "-"}</p></div>
                                                <div className="space-y-1"><p className="text-muted-foreground uppercase text-[10px]">Shipment Flow</p><p className="font-semibold text-foreground break-words">{detailShipment.shipment_flow || "-"}</p></div>
                                                <div className="space-y-1"><p className="text-muted-foreground uppercase text-[10px]">Product</p><p className="font-semibold text-foreground break-words">{detailShipment.product || "-"}</p></div>
                                                <div className="space-y-1"><p className="text-muted-foreground uppercase text-[10px]">Analysis Method</p><p className="font-semibold text-foreground break-words">{detailShipment.analysis_method || "-"}</p></div>
                                                <div className="space-y-1"><p className="text-muted-foreground uppercase text-[10px]">DMO / Export</p><p className="font-semibold text-foreground break-words">{detailShipment.export_dmo || "EXPORT"}</p></div>
                                                <div className="space-y-1"><p className="text-muted-foreground uppercase text-[10px]">BL Date</p><p className="font-semibold text-foreground break-words">{detailShipment.bl_date ? new Date(detailShipment.bl_date).toLocaleDateString() : "-"}</p></div>
                                                <div className="space-y-1">
                                                    <p className="text-muted-foreground uppercase text-[10px]">Nomination</p>
                                                    <NominationDisplay value={detailShipment.nomination} compact />
                                                </div>
                                                <div className="space-y-1"><p className="text-muted-foreground uppercase text-[10px]">Buyer</p><p className="font-semibold text-foreground break-words">{detailShipment.buyer || "-"}</p></div>
                                                {/* New Fields */}
                                                <div className="space-y-1"><p className="text-muted-foreground uppercase text-[10px]">No. SPAL</p><p className="font-semibold text-foreground break-words">{detailShipment.no_spal || "-"}</p></div>
                                                <div className="space-y-1"><p className="text-muted-foreground uppercase text-[10px]">No. SI</p><p className="font-semibold text-foreground break-words">{detailShipment.no_si || "-"}</p></div>
                                                <div className="space-y-1"><p className="text-muted-foreground uppercase text-[10px]">Surveyor LHV</p><p className="font-semibold text-foreground break-words">{detailShipment.surveyor_lhv || "-"}</p></div>
                                                <div className="space-y-1"><p className="text-muted-foreground uppercase text-[10px]">LHV Terbit</p><p className="font-semibold text-foreground">{detailShipment.lhv_terbit ? "YES" : "NO"}</p></div>
                                            </div>
                                        </div>

                                        {shipmentFamily.length > 0 && (
                                            <div className="p-4 bg-accent/20 rounded-xl border border-border/50">
                                                <div className="flex items-center justify-between gap-3">
                                                    <h5 className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                                                        <Anchor className="w-3 h-3" /> Child Barge Details ({shipmentFamily.length})
                                                    </h5>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowChildBargeDetails((v) => !v)}
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-background/70 hover:bg-accent text-[10px] font-semibold"
                                                    >
                                                        {showChildBargeDetails ? "Hide Detail" : "Show Detail"}
                                                        {showChildBargeDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                    </button>
                                                </div>

                                                {showChildBargeDetails && (
                                                    <>
                                                        <div className="md:hidden space-y-2 mt-3">
                                                            {shipmentFamily.slice(0, 8).map((item) => (
                                                                <div key={item.id} className="rounded-lg border border-border/50 bg-background/60 p-3 text-xs space-y-1.5">
                                                                    <NominationDisplay value={item.nomination || item.barge_name || "-"} />
                                                                    <p className="text-muted-foreground break-words">{item.jetty_loading_port || item.loading_port || "-"}</p>
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-muted-foreground">Plan</span>
                                                                        <span className="font-semibold text-blue-500">{safeNum(item.qty_plan).toLocaleString()} MT</span>
                                                                    </div>
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-muted-foreground">Actual</span>
                                                                        <span className="font-semibold text-emerald-500">{safeNum(item.qty_cob || item.quantity_loaded).toLocaleString()} MT</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="hidden md:block overflow-x-auto mt-3">
                                                            <table className="w-full text-[11px]">
                                                                <thead>
                                                                    <tr className="text-left text-[10px] text-muted-foreground uppercase border-b border-border/40">
                                                                        <th className="py-2 pr-3">Nomination</th>
                                                                        <th className="py-2 pr-3">Jetty / Loading Port</th>
                                                                        <th className="py-2 pr-3">Source</th>
                                                                        <th className="py-2 pr-3 text-right">Plan (MT)</th>
                                                                        <th className="py-2 pr-3 text-right">Actual (MT)</th>
                                                                        <th className="py-2 pr-3">Status</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {shipmentFamily.slice(0, 12).map((item) => (
                                                                        <tr key={item.id} className="border-b border-border/20">
                                                                            <td className="py-2 pr-3 font-semibold text-foreground">
                                                                                <NominationDisplay value={item.nomination || item.barge_name || "-"} />
                                                                            </td>
                                                                            <td className="py-2 pr-3 text-muted-foreground">{item.jetty_loading_port || item.loading_port || "-"}</td>
                                                                            <td className="py-2 pr-3 text-foreground">{item.source || "-"}</td>
                                                                            <td className="py-2 pr-3 text-right text-blue-500 font-semibold">{safeNum(item.qty_plan).toLocaleString()}</td>
                                                                            <td className="py-2 pr-3 text-right text-emerald-500 font-semibold">{safeNum(item.qty_cob || item.quantity_loaded).toLocaleString()}</td>
                                                                            <td className="py-2 pr-3">{item.shipment_status || item.status || "-"}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                        {shipmentFamily.length > 12 && (
                                                            <p className="text-[10px] text-muted-foreground mt-2">
                                                                Showing first 12 details. Total child rows: {shipmentFamily.length}.
                                                            </p>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        )}

                                        {/* Bottom Extended Info */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="p-4 bg-accent/20 rounded-xl border border-border/50">
                                                <h5 className="text-[10px] font-bold text-muted-foreground uppercase mb-3 flex items-center gap-1.5"><Beaker className="w-3 h-3" /> Technical Specs</h5>
                                                <div className="grid grid-cols-3 gap-4 text-sm">
                                                    <div className="text-center p-2 bg-background rounded-lg border border-border/30">
                                                        <p className="text-[9px] text-muted-foreground uppercase">HBA/HPB</p>
                                                        <p className="font-black text-emerald-500">${safeNum(detailShipment.hpb)}</p>
                                                    </div>
                                                    <div className="text-center p-2 bg-background rounded-lg border border-border/30">
                                                        <p className="text-[9px] text-muted-foreground uppercase">FOB Barge</p>
                                                        <p className="font-black text-foreground">${safeNum(detailShipment.harga_actual_fob)}</p>
                                                    </div>
                                                    <div className="text-center p-2 bg-background rounded-lg border border-border/30">
                                                        <p className="text-[9px] text-muted-foreground uppercase">Term</p>
                                                        <p className="font-bold text-foreground">{detailShipment.shipping_term || "FOB"}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="p-4 bg-accent/20 rounded-xl border border-border/50">
                                                <h5 className="text-[10px] font-bold text-muted-foreground uppercase mb-3 flex items-center gap-1.5"><Info className="w-3 h-3" /> Operational Info</h5>
                                                <div className="space-y-2 text-[11px]">
                                                    <div className="flex justify-between"><span className="text-muted-foreground">PIC:</span><span className="font-medium">{detailShipment.pic || "-"}</span></div>
                                                    <div className="flex justify-between"><span className="text-muted-foreground">Internal No:</span><span className="font-mono text-muted-foreground">#{detailShipment.no || "NEW"}</span></div>
                                                    <div className="mt-2 border-t border-border/30 pt-2">
                                                        <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">Status Reason</p>
                                                        <p className="text-foreground">
                                                            {detailShipment.status_reason || detailShipment.issue_notes || "No issue reason captured."}
                                                        </p>
                                                    </div>
                                                    <div className="mt-2 border-t border-border/30 pt-2">
                                                        <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">Operational Info</p>
                                                        <p className="text-foreground">
                                                            {detailShipment.operational_info || "Operational info has not been filled."}
                                                        </p>
                                                        {(detailShipment.demurrage_rate || detailShipment.demurrage_source) && (
                                                            <div className="mt-2 rounded-lg bg-background/60 border border-border/50 p-2">
                                                                <div className="flex justify-between gap-3">
                                                                    <span className="text-muted-foreground">Demurrage:</span>
                                                                    <span className="font-bold text-amber-500">
                                                                        {detailShipment.demurrage_currency || "USD"} {safeNum(detailShipment.demurrage_rate).toLocaleString("en-US")}/day
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between gap-3">
                                                                    <span className="text-muted-foreground">Source:</span>
                                                                    <span className="font-medium">{detailShipment.demurrage_source || "Operational Info"}</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {detailShipment.pending_items && detailShipment.pending_items.length > 0 && (
                                                        <div className="mt-2">
                                                            <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">Pending Items</p>
                                                            <ul className="list-disc ml-4 space-y-0.5">
                                                                {detailShipment.pending_items.slice(0, 6).map((item, idx) => (
                                                                    <li key={`${item}-${idx}`} className="text-foreground">
                                                                        {item}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                    <div className="mt-2 text-muted-foreground italic border-t border-border/30 pt-2">
                                                        {detailShipment.remarks || "No additional operational remarks for this shipment."}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 sm:p-5">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <h4 className="text-[11px] sm:text-xs font-bold flex items-center gap-2 text-blue-700 uppercase tracking-wider">
                                                    <ShieldCheck className="w-4 h-4" /> Source Change Request
                                                </h4>
                                                <span className="rounded bg-background/70 px-2 py-1 text-[10px] font-bold text-muted-foreground">
                                                    {sourceChanges.filter((item) => (item.status || "").toLowerCase() === "pending").length} pending
                                                </span>
                                            </div>
                                            {canManageShipments && (
                                                <div className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-2">
                                                    <input value={sourceChangeDraft.newSource} onChange={(e) => setSourceChangeDraft({ ...sourceChangeDraft, newSource: e.target.value })} placeholder="New source / supplier" className="rounded-lg border border-border bg-background/70 px-3 py-2 text-xs md:col-span-2" />
                                                    <input value={sourceChangeDraft.reason} onChange={(e) => setSourceChangeDraft({ ...sourceChangeDraft, reason: e.target.value })} placeholder="Reason" className="rounded-lg border border-border bg-background/70 px-3 py-2 text-xs" />
                                                    <input value={sourceChangeDraft.evidence} onChange={(e) => setSourceChangeDraft({ ...sourceChangeDraft, evidence: e.target.value })} placeholder="Evidence / link" className="rounded-lg border border-border bg-background/70 px-3 py-2 text-xs" />
                                                    <button onClick={saveSourceChange} disabled={sourceChangeAction === "create"} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">
                                                        {sourceChangeAction === "create" ? "Saving..." : "Request Change"}
                                                    </button>
                                                    <input value={sourceChangeDraft.impact} onChange={(e) => setSourceChangeDraft({ ...sourceChangeDraft, impact: e.target.value })} placeholder="Impact note" className="rounded-lg border border-border bg-background/70 px-3 py-2 text-xs md:col-span-5" />
                                                </div>
                                            )}
                                            <div className="mt-3 space-y-2">
                                                {sourceChanges.length === 0 ? (
                                                    <p className="text-xs text-muted-foreground">No source change request recorded.</p>
                                                ) : sourceChanges.slice(0, 6).map((change) => (
                                                    <div key={change.id} className="rounded-lg border border-border/50 bg-background/70 p-3 text-xs">
                                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                                            <div>
                                                                <p className="font-bold text-foreground">v{change.version}: {change.oldSource || "-"} -&gt; {change.newSource}</p>
                                                                <p className="text-muted-foreground">{change.reason}</p>
                                                                {change.impact && <p className="mt-1 text-[10px] text-muted-foreground">Impact: {change.impact}</p>}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className={cn(
                                                                    "rounded px-2 py-1 text-[10px] font-bold uppercase",
                                                                    change.status === "approved" ? "bg-emerald-500/10 text-emerald-600" :
                                                                        change.status === "rejected" ? "bg-rose-500/10 text-rose-600" :
                                                                            "bg-amber-500/10 text-amber-700"
                                                                )}>{change.active ? "active" : change.status}</span>
                                                                {canAccessCriticalDocuments && change.status === "pending" && (
                                                                    <>
                                                                        <button onClick={() => decideSourceChange(change, "approve")} disabled={sourceChangeAction === change.id} className="rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white disabled:opacity-60">Approve</button>
                                                                        <button onClick={() => decideSourceChange(change, "reject")} disabled={sourceChangeAction === change.id} className="rounded-md bg-rose-600 px-2 py-1 text-[10px] font-bold text-white disabled:opacity-60">Reject</button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                                                            <span>By: {change.requestedByName || "-"}</span>
                                                            <span>Evidence: {change.evidence || "-"}</span>
                                                            {change.approvedByName && <span>Decision: {change.approvedByName}</span>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 sm:p-5">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <h4 className="text-[11px] sm:text-xs font-bold flex items-center gap-2 text-indigo-700 uppercase tracking-wider">
                                                    <Anchor className="w-4 h-4" /> Barge Change Log
                                                </h4>
                                                <span className="rounded bg-background/70 px-2 py-1 text-[10px] font-bold text-muted-foreground">
                                                    {bargeChanges.filter((item) => (item.status || "").toLowerCase() === "pending").length} pending
                                                </span>
                                            </div>
                                            {canManageShipments && (
                                                <div className="mt-3 grid grid-cols-1 md:grid-cols-6 gap-2">
                                                    <input value={bargeChangeDraft.newMv} onChange={(e) => setBargeChangeDraft({ ...bargeChangeDraft, newMv: e.target.value })} placeholder="New MV" className="rounded-lg border border-border bg-background/70 px-3 py-2 text-xs" />
                                                    <input value={bargeChangeDraft.newTb} onChange={(e) => setBargeChangeDraft({ ...bargeChangeDraft, newTb: e.target.value })} placeholder="New TB" className="rounded-lg border border-border bg-background/70 px-3 py-2 text-xs" />
                                                    <input value={bargeChangeDraft.newBg} onChange={(e) => setBargeChangeDraft({ ...bargeChangeDraft, newBg: e.target.value })} placeholder="New BG" className="rounded-lg border border-border bg-background/70 px-3 py-2 text-xs" />
                                                    <input value={bargeChangeDraft.newNomination} onChange={(e) => setBargeChangeDraft({ ...bargeChangeDraft, newNomination: e.target.value })} placeholder="New nomination" className="rounded-lg border border-border bg-background/70 px-3 py-2 text-xs" />
                                                    <input value={bargeChangeDraft.reason} onChange={(e) => setBargeChangeDraft({ ...bargeChangeDraft, reason: e.target.value })} placeholder="Reason" className="rounded-lg border border-border bg-background/70 px-3 py-2 text-xs" />
                                                    <button onClick={saveBargeChange} disabled={bargeChangeAction === "create"} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">
                                                        {bargeChangeAction === "create" ? "Saving..." : "Request Change"}
                                                    </button>
                                                    <input value={bargeChangeDraft.evidence} onChange={(e) => setBargeChangeDraft({ ...bargeChangeDraft, evidence: e.target.value })} placeholder="Evidence / link" className="rounded-lg border border-border bg-background/70 px-3 py-2 text-xs md:col-span-3" />
                                                    <input value={bargeChangeDraft.impact} onChange={(e) => setBargeChangeDraft({ ...bargeChangeDraft, impact: e.target.value })} placeholder="Impact note" className="rounded-lg border border-border bg-background/70 px-3 py-2 text-xs md:col-span-3" />
                                                </div>
                                            )}
                                            <div className="mt-3 space-y-2">
                                                {bargeChanges.length === 0 ? (
                                                    <p className="text-xs text-muted-foreground">No barge change request recorded.</p>
                                                ) : bargeChanges.slice(0, 6).map((change) => (
                                                    <div key={change.id} className="rounded-lg border border-border/50 bg-background/70 p-3 text-xs">
                                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                                            <div>
                                                                <p className="font-bold text-foreground">
                                                                    v{change.version}: {(change.oldMv || "-")} / {(change.oldTb || "-")} / {(change.oldNomination || "-")} -&gt; {(change.newMv || "-")} / {(change.newTb || change.newBg || "-")} / {(change.newNomination || "-")}
                                                                </p>
                                                                <p className="text-muted-foreground">{change.reason}</p>
                                                                {change.impact && <p className="mt-1 text-[10px] text-muted-foreground">Impact: {change.impact}</p>}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className={cn(
                                                                    "rounded px-2 py-1 text-[10px] font-bold uppercase",
                                                                    change.status === "approved" ? "bg-emerald-500/10 text-emerald-600" :
                                                                        change.status === "rejected" ? "bg-rose-500/10 text-rose-600" :
                                                                            "bg-amber-500/10 text-amber-700"
                                                                )}>{change.active ? "active" : change.status}</span>
                                                                {canAccessCriticalDocuments && change.status === "pending" && (
                                                                    <>
                                                                        <button onClick={() => decideBargeChange(change, "approve")} disabled={bargeChangeAction === change.id} className="rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white disabled:opacity-60">Approve</button>
                                                                        <button onClick={() => decideBargeChange(change, "reject")} disabled={bargeChangeAction === change.id} className="rounded-md bg-rose-600 px-2 py-1 text-[10px] font-bold text-white disabled:opacity-60">Reject</button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                                                            <span>By: {change.requestedByName || "-"}</span>
                                                            <span>Evidence: {change.evidence || "-"}</span>
                                                            {change.approvedByName && <span>Decision: {change.approvedByName}</span>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 sm:p-5">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <h4 className="text-[11px] sm:text-xs font-bold flex items-center gap-2 text-amber-700 uppercase tracking-wider">
                                                    <AlertTriangle className="w-4 h-4" /> Issue Log
                                                </h4>
                                                <span className="rounded bg-background/70 px-2 py-1 text-[10px] font-bold text-muted-foreground">
                                                    {shipmentIssues.filter((item) => !["resolved", "closed", "not_required"].includes((item.status || "").toLowerCase())).length} open
                                                </span>
                                            </div>
                                            {canManageShipments && (
                                                <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-2">
                                                    <input value={issueDraft.category} onChange={(e) => setIssueDraft({ ...issueDraft, category: e.target.value })} placeholder="Category" className="rounded-lg border border-border bg-background/70 px-3 py-2 text-xs" />
                                                    <input value={issueDraft.impact} onChange={(e) => setIssueDraft({ ...issueDraft, impact: e.target.value })} placeholder="Impact" className="rounded-lg border border-border bg-background/70 px-3 py-2 text-xs" />
                                                    <input value={issueDraft.action} onChange={(e) => setIssueDraft({ ...issueDraft, action: e.target.value })} placeholder="Action plan" className="rounded-lg border border-border bg-background/70 px-3 py-2 text-xs" />
                                                    <input value={issueDraft.pic} onChange={(e) => setIssueDraft({ ...issueDraft, pic: e.target.value })} placeholder="PIC" className="rounded-lg border border-border bg-background/70 px-3 py-2 text-xs" />
                                                    <input type="date" value={issueDraft.targetDate} onChange={(e) => setIssueDraft({ ...issueDraft, targetDate: e.target.value })} className="rounded-lg border border-border bg-background/70 px-3 py-2 text-xs" />
                                                    <select value={issueDraft.status} onChange={(e) => setIssueDraft({ ...issueDraft, status: e.target.value })} className="rounded-lg border border-border bg-background/70 px-3 py-2 text-xs">
                                                        <option value="open">Open</option>
                                                        <option value="monitoring">Monitoring</option>
                                                        <option value="resolved">Resolved</option>
                                                        <option value="closed">Closed</option>
                                                    </select>
                                                    <input value={issueDraft.evidence} onChange={(e) => setIssueDraft({ ...issueDraft, evidence: e.target.value })} placeholder="Evidence / link" className="rounded-lg border border-border bg-background/70 px-3 py-2 text-xs" />
                                                    <button onClick={saveShipmentIssue} disabled={issueAction === "create"} className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">
                                                        {issueAction === "create" ? "Saving..." : "Add Issue"}
                                                    </button>
                                                </div>
                                            )}
                                            <div className="mt-3 space-y-2">
                                                {shipmentIssues.length === 0 ? (
                                                    <p className="text-xs text-muted-foreground">No structured issue has been logged.</p>
                                                ) : shipmentIssues.slice(0, 8).map((issue) => (
                                                    <div key={issue.id} className="rounded-lg border border-border/50 bg-background/70 p-3 text-xs">
                                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                                            <div>
                                                                <p className="font-bold text-foreground">{issue.category}</p>
                                                                <p className="text-muted-foreground">{issue.impact || "-"} {issue.action ? `| ${issue.action}` : ""}</p>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="rounded bg-accent px-2 py-1 text-[10px] font-bold uppercase">{issue.status}</span>
                                                                {canManageShipments && (
                                                                    <select value={issue.status} disabled={issueAction === issue.id} onChange={(e) => updateShipmentIssueStatus(issue, e.target.value)} className="rounded-md border border-border bg-background px-2 py-1 text-[10px]">
                                                                        <option value="open">Open</option>
                                                                        <option value="monitoring">Monitoring</option>
                                                                        <option value="resolved">Resolved</option>
                                                                        <option value="closed">Closed</option>
                                                                        <option value="not_required">Not Required</option>
                                                                    </select>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                                                            <span>PIC: {issue.pic || "-"}</span>
                                                            <span>Target: {issue.targetDate ? new Date(issue.targetDate).toLocaleDateString("id-ID") : "-"}</span>
                                                            {issue.evidence && <span>Evidence: {issue.evidence}</span>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {detailModalTab === "documents" && (
                                    <div className="space-y-5 animate-fade-in">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div>
                                                <h4 className="text-sm font-bold flex items-center gap-2 text-foreground">
                                                    <FileText className="w-4 h-4 text-primary" /> Shipment Documents
                                                </h4>
                                                <p className="text-xs text-muted-foreground mt-1">{detailShipment.mv_project_name || "-"} / {detailShipment.nomination || detailShipment.barge_name || "-"}</p>
                                            </div>
                                            <button
                                                onClick={() => detailShipment.id && loadShipmentDocuments(detailShipment.id)}
                                                disabled={isLoadingDocuments}
                                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-background border border-border hover:bg-accent disabled:opacity-60"
                                            >
                                                {isLoadingDocuments ? <Loader2 className="w-3.5 h-3.5 inline mr-1 animate-spin" /> : <Activity className="w-3.5 h-3.5 inline mr-1" />}
                                                Refresh
                                            </button>
                                        </div>

                                        {isLoadingDocuments ? (
                                            <div className="rounded-xl border border-border/60 bg-background/50 p-8 text-center text-sm text-muted-foreground">
                                                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                                                Loading documents...
                                            </div>
                                        ) : (
                                            <>
                                                <div className="rounded-xl border border-border/60 bg-background/50 p-4">
                                                    <div className="flex items-center justify-between gap-3 mb-3">
                                                        <h5 className="text-[11px] font-bold uppercase text-primary flex items-center gap-1.5">
                                                            <FileText className="w-3.5 h-3.5" /> Required Documents
                                                        </h5>
                                                        <span className="text-[10px] font-semibold text-muted-foreground">
                                                            {shipmentDocuments.filter((doc) => doc.documentGroup === "required").length} files
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                                        {SHIPMENT_REQUIRED_DOCUMENTS.map((req) => {
                                                            const docs = shipmentDocuments.filter((doc) => doc.documentGroup === "required" && doc.requirementCode === req.code);
                                                            const checklistItem = shipmentDocumentChecklist.find((item) => item.documentGroup === "required" && item.requirementCode === req.code);
                                                            const checklistPayload = checklistItem || {
                                                                documentGroup: "required" as ShipmentDocumentGroup,
                                                                requirementCode: req.code,
                                                                requirementLabel: req.label,
                                                                title: req.label,
                                                            };
                                                            const inputId = `shipment-required-${detailShipment.id}-${req.code}`;
                                                            const actionKey = `required:${req.code}`;
                                                            const checklistActionKey = `checklist:${checklistItem?.id || req.code}`;
                                                            const aging = getChecklistAging(checklistItem);
                                                            return (
                                                                <div key={req.code} className="rounded-lg border border-border/50 bg-card/60 p-3 space-y-2">
                                                                    <div className="flex items-start justify-between gap-3">
                                                                        <div className="min-w-0">
                                                                            <p className="text-xs font-bold text-foreground break-words">{req.code}. {req.label}</p>
                                                                            <p className="text-[10px] text-muted-foreground">
                                                                                {docs.length} uploaded
                                                                                {checklistItem?.ownerRole ? ` | Owner: ${checklistItem.ownerRole}` : ""}
                                                                                {checklistItem?.responsibleParty ? ` | PIC: ${checklistItem.responsibleParty}` : ""}
                                                                            </p>
                                                                        </div>
                                                                        <span className={cn(
                                                                            "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase",
                                                                            (checklistItem?.status || "pending") === "completed" ? "bg-emerald-500/10 text-emerald-600" :
                                                                                (checklistItem?.status || "pending") === "received" || (checklistItem?.status || "pending") === "submitted" ? "bg-blue-500/10 text-blue-600" :
                                                                                    (checklistItem?.status || "pending") === "rejected" ? "bg-red-500/10 text-red-600" :
                                                                                        "bg-amber-500/10 text-amber-600"
                                                                        )}>
                                                                            {(checklistItem?.status || "pending").replace("_", " ")}
                                                                        </span>
                                                                    </div>
                                                                    <div className={cn(
                                                                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                                                        aging.tone === "danger" ? "bg-red-500/10 text-red-600" :
                                                                            aging.tone === "warn" ? "bg-amber-500/10 text-amber-600" :
                                                                                aging.tone === "ok" ? "bg-emerald-500/10 text-emerald-600" :
                                                                                    "bg-accent text-muted-foreground"
                                                                    )}>
                                                                        <Clock className="mr-1 h-3 w-3" /> {aging.label}
                                                                    </div>
                                                                    {canManageShipments && (
                                                                        <div className="space-y-2">
                                                                            <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-2">
                                                                            <select
                                                                                value={checklistItem?.status || "pending"}
                                                                                disabled={documentAction === checklistActionKey}
                                                                                onChange={(e) => updateChecklistItem(checklistPayload, { status: e.target.value })}
                                                                                className="px-2 py-1.5 rounded-md bg-accent/50 border border-border text-xs"
                                                                            >
                                                                                {CHECKLIST_STATUS_OPTIONS.map((option) => (
                                                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                                                ))}
                                                                            </select>
                                                                            <input
                                                                                value={checklistItem?.notes || ""}
                                                                                disabled={documentAction === checklistActionKey}
                                                                                onBlur={(e) => {
                                                                                    if ((checklistItem?.notes || "") !== e.currentTarget.value) {
                                                                                        updateChecklistItem(checklistPayload, { notes: e.currentTarget.value });
                                                                                    }
                                                                                }}
                                                                                onChange={(e) => {
                                                                                    const value = e.currentTarget.value;
                                                                                    setShipmentDocumentChecklist((current) => {
                                                                                        if (!checklistItem) return current;
                                                                                        return current.map((item) => item.id === checklistItem.id ? { ...item, notes: value } : item);
                                                                                    });
                                                                                }}
                                                                                placeholder="Checklist notes"
                                                                                className="px-2 py-1.5 rounded-md bg-accent/50 border border-border text-xs"
                                                                            />
                                                                            </div>
                                                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                                                <label className="space-y-1">
                                                                                    <span className="block text-[9px] font-bold uppercase text-muted-foreground">Expected</span>
                                                                                    <input
                                                                                        type="date"
                                                                                        value={toDateInputValue(checklistItem?.expectedDate)}
                                                                                        disabled={documentAction === checklistActionKey}
                                                                                        onChange={(e) => updateChecklistItem(checklistPayload, { expectedDate: e.target.value || null })}
                                                                                        className="w-full px-2 py-1.5 rounded-md bg-accent/50 border border-border text-xs"
                                                                                    />
                                                                                </label>
                                                                                <label className="space-y-1">
                                                                                    <span className="block text-[9px] font-bold uppercase text-muted-foreground">Received</span>
                                                                                    <input
                                                                                        type="date"
                                                                                        value={toDateInputValue(checklistItem?.receivedDate)}
                                                                                        disabled={documentAction === checklistActionKey}
                                                                                        onChange={(e) => updateChecklistItem(checklistPayload, { receivedDate: e.target.value || null, status: e.target.value ? "received" : checklistItem?.status || "pending" })}
                                                                                        className="w-full px-2 py-1.5 rounded-md bg-accent/50 border border-border text-xs"
                                                                                    />
                                                                                </label>
                                                                                <label className="space-y-1">
                                                                                    <span className="block text-[9px] font-bold uppercase text-muted-foreground">Submitted</span>
                                                                                    <input
                                                                                        type="date"
                                                                                        value={toDateInputValue(checklistItem?.submittedDate)}
                                                                                        disabled={documentAction === checklistActionKey}
                                                                                        onChange={(e) => updateChecklistItem(checklistPayload, { submittedDate: e.target.value || null, status: e.target.value ? "submitted" : checklistItem?.status || "pending" })}
                                                                                        className="w-full px-2 py-1.5 rounded-md bg-accent/50 border border-border text-xs"
                                                                                    />
                                                                                </label>
                                                                            </div>
                                                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                                                <label className="space-y-1">
                                                                                    <span className="block text-[9px] font-bold uppercase text-muted-foreground">Owner</span>
                                                                                    <input
                                                                                        defaultValue={checklistItem?.ownerRole || "Traffic"}
                                                                                        disabled={documentAction === checklistActionKey}
                                                                                        onBlur={(e) => updateChecklistItem(checklistPayload, { ownerRole: e.currentTarget.value })}
                                                                                        placeholder="Owner role"
                                                                                        className="w-full px-2 py-1.5 rounded-md bg-accent/50 border border-border text-xs"
                                                                                    />
                                                                                </label>
                                                                                <label className="space-y-1">
                                                                                    <span className="block text-[9px] font-bold uppercase text-muted-foreground">PIC</span>
                                                                                    <input
                                                                                        defaultValue={checklistItem?.responsibleParty || ""}
                                                                                        disabled={documentAction === checklistActionKey}
                                                                                        onBlur={(e) => updateChecklistItem(checklistPayload, { responsibleParty: e.currentTarget.value })}
                                                                                        placeholder="Responsible party"
                                                                                        className="w-full px-2 py-1.5 rounded-md bg-accent/50 border border-border text-xs"
                                                                                    />
                                                                                </label>
                                                                                <label className="space-y-1">
                                                                                    <span className="block text-[9px] font-bold uppercase text-muted-foreground">Hardcopy</span>
                                                                                    <select
                                                                                        value={checklistItem?.hardcopyStatus || ""}
                                                                                        disabled={documentAction === checklistActionKey}
                                                                                        onChange={(e) => updateChecklistItem(checklistPayload, { hardcopyStatus: e.target.value || null })}
                                                                                        className="w-full px-2 py-1.5 rounded-md bg-accent/50 border border-border text-xs"
                                                                                    >
                                                                                        {HARDCOPY_STATUS_OPTIONS.map((option) => (
                                                                                            <option key={option.value || "empty"} value={option.value}>{option.label}</option>
                                                                                        ))}
                                                                                    </select>
                                                                                </label>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {canManageShipments && renderDocumentDropzone({
                                                                        id: inputId,
                                                                        actionKey,
                                                                        multiple: true,
                                                                        onFiles: (files) => uploadRequiredFiles(req, files),
                                                                    })}
                                                                    {renderShipmentDocumentList(docs)}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                                    <div className="rounded-xl border border-border/60 bg-background/50 p-4 space-y-3">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <h5 className="text-[11px] font-bold uppercase text-emerald-600 flex items-center gap-1.5">
                                                                <FileText className="w-3.5 h-3.5" /> Additional Documents
                                                            </h5>
                                                            <span className="text-[10px] font-semibold text-muted-foreground">{shipmentDocuments.filter((doc) => doc.documentGroup === "additional").length} files</span>
                                                        </div>
                                                        {canManageShipments && (
                                                            <div className="rounded-lg border border-border/50 bg-card/60 p-3 space-y-2">
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                    <input value={additionalDraft.title} onChange={(e) => setAdditionalDraft({ ...additionalDraft, title: e.target.value })} placeholder="Document title" className="px-2 py-1.5 rounded-md bg-accent/50 border border-border text-xs" />
                                                                    <select value={additionalDraft.status} onChange={(e) => setAdditionalDraft({ ...additionalDraft, status: e.target.value })} className="px-2 py-1.5 rounded-md bg-accent/50 border border-border text-xs">
                                                                        <option value="draft">Draft</option>
                                                                        <option value="received">Received</option>
                                                                        <option value="reviewed">Reviewed</option>
                                                                        <option value="final">Final</option>
                                                                    </select>
                                                                    <input value={additionalDraft.notes} onChange={(e) => setAdditionalDraft({ ...additionalDraft, notes: e.target.value })} placeholder="Notes" className="px-2 py-1.5 rounded-md bg-accent/50 border border-border text-xs sm:col-span-2" />
                                                                </div>
                                                                {renderDocumentDropzone({
                                                                    id: `shipment-additional-${detailShipment.id}`,
                                                                    actionKey: `additional:${additionalDraft.title || "Additional document"}`,
                                                                    selectedFileName: additionalDraft.file?.name,
                                                                    onFiles: (files) => setAdditionalDraft({ ...additionalDraft, file: files[0] || null }),
                                                                })}
                                                                <button onClick={() => saveCustomDocument("additional")} disabled={!additionalDraft.file || documentAction === `additional:${additionalDraft.title || "Additional document"}`} className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold disabled:opacity-60">
                                                                    <Save className="w-3.5 h-3.5" /> Save
                                                                </button>
                                                            </div>
                                                        )}
                                                        {renderShipmentDocumentList(shipmentDocuments.filter((doc) => doc.documentGroup === "additional"))}
                                                    </div>

                                                    {canAccessCriticalDocuments && (
                                                        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-3">
                                                            <div className="flex items-center justify-between gap-3">
                                                                <h5 className="text-[11px] font-bold uppercase text-red-600 flex items-center gap-1.5">
                                                                    <ShieldCheck className="w-3.5 h-3.5" /> Critical Documents
                                                                </h5>
                                                                <span className="text-[10px] font-semibold text-red-600/80">{shipmentDocuments.filter((doc) => doc.documentGroup === "critical").length} files</span>
                                                            </div>
                                                            <div className="rounded-lg border border-red-500/20 bg-card/70 p-3 space-y-2">
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                    <input value={criticalDraft.title} onChange={(e) => setCriticalDraft({ ...criticalDraft, title: e.target.value })} placeholder="Critical document title" className="px-2 py-1.5 rounded-md bg-accent/50 border border-border text-xs" />
                                                                    <select value={criticalDraft.status} onChange={(e) => setCriticalDraft({ ...criticalDraft, status: e.target.value })} className="px-2 py-1.5 rounded-md bg-accent/50 border border-border text-xs">
                                                                        <option value="draft">Draft</option>
                                                                        <option value="received">Received</option>
                                                                        <option value="reviewed">Reviewed</option>
                                                                        <option value="final">Final</option>
                                                                    </select>
                                                                    <input value={criticalDraft.notes} onChange={(e) => setCriticalDraft({ ...criticalDraft, notes: e.target.value })} placeholder="Notes" className="px-2 py-1.5 rounded-md bg-accent/50 border border-border text-xs sm:col-span-2" />
                                                                </div>
                                                                {renderDocumentDropzone({
                                                                    id: `shipment-critical-${detailShipment.id}`,
                                                                    actionKey: `critical:${criticalDraft.title || "Critical document"}`,
                                                                    selectedFileName: criticalDraft.file?.name,
                                                                    tone: "red",
                                                                    onFiles: (files) => setCriticalDraft({ ...criticalDraft, file: files[0] || null }),
                                                                })}
                                                                <button onClick={() => saveCustomDocument("critical")} disabled={!criticalDraft.file || documentAction === `critical:${criticalDraft.title || "Critical document"}`} className="inline-flex items-center gap-1.5 rounded-md bg-red-600 text-white px-3 py-1.5 text-xs font-semibold disabled:opacity-60">
                                                                    <Save className="w-3.5 h-3.5" /> Save
                                                                </button>
                                                            </div>
                                                            {renderShipmentDocumentList(shipmentDocuments.filter((doc) => doc.documentGroup === "critical"))}
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}

                                {detailModalTab === "blending" && (
                                    <div className="space-y-4 animate-fade-in">
                                        <div className="border border-border/60 rounded-xl p-5 bg-background/50">
                                            <h4 className="text-sm font-bold flex items-center gap-2 mb-4 text-foreground">
                                                <Beaker className="w-4 h-4 text-pink-500" /> Blending Specifications
                                            </h4>
                                            {detailShipment.is_blending ? (
                                                <div className="space-y-4">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <h5 className="text-xs font-bold text-muted-foreground uppercase">Target vs Actual</h5>
                                                        {!editBlendingMode ? (
                                                            <button onClick={() => { setBlendingForm({ gar: detailShipment.spec_actual?.gar || 4200, ts: detailShipment.spec_actual?.ts || 0, ash: detailShipment.spec_actual?.ash || 0, tm: detailShipment.spec_actual?.tm || 0 }); setEditBlendingMode(true); }} className="text-blue-500 hover:text-blue-400 text-xs font-bold flex items-center gap-1"><Edit className="w-3.5 h-3.5" /> Edit Custom</button>
                                                        ) : (
                                                            <div className="flex gap-2">
                                                                <button onClick={() => setEditBlendingMode(false)} className="text-muted-foreground hover:text-foreground text-xs font-semibold">Cancel</button>
                                                                <button onClick={handleSaveBlending} className="text-emerald-500 hover:text-emerald-400 text-xs font-bold">Save</button>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {editBlendingMode ? (
                                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 bg-accent/20 p-4 rounded-lg border border-blue-500/30">
                                                            <div><label className="text-[10px] text-muted-foreground">GAR</label><input type="number" value={blendingForm.gar} onChange={e => setBlendingForm({ ...blendingForm, gar: Number(e.target.value) })} className="w-full mt-1 bg-background border border-border px-2 py-1 rounded text-xs" /></div>
                                                            <div><label className="text-[10px] text-muted-foreground">TS (%)</label><input type="number" step="0.1" value={blendingForm.ts} onChange={e => setBlendingForm({ ...blendingForm, ts: Number(e.target.value) })} className="w-full mt-1 bg-background border border-border px-2 py-1 rounded text-xs" /></div>
                                                            <div><label className="text-[10px] text-muted-foreground">Ash (%)</label><input type="number" step="0.1" value={blendingForm.ash} onChange={e => setBlendingForm({ ...blendingForm, ash: Number(e.target.value) })} className="w-full mt-1 bg-background border border-border px-2 py-1 rounded text-xs" /></div>
                                                            <div><label className="text-[10px] text-muted-foreground">TM (%)</label><input type="number" step="0.1" value={blendingForm.tm} onChange={e => setBlendingForm({ ...blendingForm, tm: Number(e.target.value) })} className="w-full mt-1 bg-background border border-border px-2 py-1 rounded text-xs" /></div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-4 p-4 bg-accent/30 rounded-lg">
                                                            <div className="w-16 h-16 rounded-full border-4 border-pink-500/20 flex flex-col items-center justify-center relative">
                                                                <div className="absolute inset-0 rounded-full border-4 border-pink-500 border-l-transparent border-t-transparent rotate-45"></div>
                                                                <span className="text-[10px] text-muted-foreground">GAR</span>
                                                                <span className="text-xs font-bold text-foreground">{detailShipment.spec_actual?.gar || 4200}</span>
                                                            </div>
                                                            <div className="flex-1 space-y-2 text-xs">
                                                                <div className="flex justify-between"><span className="text-muted-foreground">Total Sulphur (TS):</span><span className="font-semibold">{detailShipment.spec_actual?.ts || 0}%</span></div>
                                                                <div className="flex justify-between"><span className="text-muted-foreground">Ash Content:</span><span className="font-semibold">{detailShipment.spec_actual?.ash || 0}%</span></div>
                                                                <div className="flex justify-between"><span className="text-muted-foreground">Total Moisture:</span><span className="font-semibold">{detailShipment.spec_actual?.tm || 0}%</span></div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="text-xs space-y-2">
                                                        <p className="font-bold text-muted-foreground uppercase">Origin Sources</p>
                                                        {detailShipment.blend_sources?.map((sid, idx) => (
                                                            <div key={sid} className="flex justify-between p-2 rounded bg-accent/20 border border-border/50 hover:border-blue-500/30 transition-colors">
                                                                <span className="font-semibold">Source {idx + 1} ({sid.substring(0, 8)})</span>
                                                                <span className="text-muted-foreground">Proportion: {(100 / (detailShipment.blend_sources?.length || 1)).toFixed(0)}%</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-center p-8">
                                                    <Package className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                                                    <p className="text-sm font-bold">Single Origin Cargo</p>
                                                    <p className="text-xs text-muted-foreground mt-1">This shipment does not utilize blending.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {detailModalTab === "timeline" && (
                                    <div className="space-y-4 animate-fade-in">
                                        <div className="border border-border/60 rounded-xl p-5 bg-background/50">
                                            <div className="flex justify-between items-center mb-4">
                                                <h4 className="text-sm font-bold flex items-center gap-2 text-foreground">
                                                    <Clock className="w-4 h-4 text-emerald-500" /> Voyage Milestones
                                                </h4>
                                                {canManageShipments && (
                                                    <button onClick={() => setShowMilestoneForm(!showMilestoneForm)} className="text-xs bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1.5">
                                                        {showMilestoneForm ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><Plus className="w-3.5 h-3.5" /> Add Milestone</>}
                                                    </button>
                                                )}
                                            </div>

                                            {canManageShipments && showMilestoneForm && (
                                                <div className="bg-accent/30 border border-border/50 rounded-lg p-4 mb-6 animate-fade-in">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                                        <div><label className="text-[10px] text-muted-foreground">Title</label><input type="text" value={milestoneForm.title} onChange={e => setMilestoneForm({ ...milestoneForm, title: e.target.value })} className="w-full mt-1 bg-background border border-border px-3 py-1.5 rounded-lg text-xs" placeholder="e.g. Cleared Customs" /></div>
                                                        <div><label className="text-[10px] text-muted-foreground">Status</label><select value={milestoneForm.status} onChange={e => setMilestoneForm({ ...milestoneForm, status: e.target.value as any })} className="w-full mt-1 bg-background border border-border px-3 py-1.5 rounded-lg text-xs"><option value="completed">Completed</option><option value="current">Current</option><option value="pending">Pending</option></select></div>
                                                        <div className="md:col-span-2"><label className="text-[10px] text-muted-foreground">Description</label><input type="text" value={milestoneForm.subtitle} onChange={e => setMilestoneForm({ ...milestoneForm, subtitle: e.target.value })} className="w-full mt-1 bg-background border border-border px-3 py-1.5 rounded-lg text-xs" placeholder="Short description..." /></div>
                                                    </div>
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={handleAddMilestone} className="text-xs bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-1.5 rounded-lg font-bold transition-colors">Save Milestone</button>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="relative pl-4 space-y-6">
                                                <div className="absolute left-1.5 top-2 bottom-2 w-px bg-border/80"></div>

                                                {(detailShipment.milestones || [
                                                    { title: "Contract Confirmed", subtitle: "Documents signed and LC established.", status: "completed" },
                                                    { title: "Vessel Arrived at Load Port", subtitle: `${detailShipment.loading_port || "Port"} Anchorage.`, status: "completed" },
                                                    { title: "Commenced Loading", subtitle: "Barges alongside vessel.", status: "current" },
                                                    { title: "Bill of Lading Issued", subtitle: "Pending completion of loading.", status: "pending" },
                                                    { title: "Arrival at Destination", subtitle: `${detailShipment.discharge_port || "TBA"}`, status: "pending" }
                                                ]).map((ms, idx) => (
                                                    <div key={idx} className={cn("relative flex items-start gap-4", ms.status === "pending" ? "opacity-50" : "")}>
                                                        {ms.status === "completed" && <div className="w-3 h-3 rounded-full bg-emerald-500 mt-1 relative z-10 ring-4 ring-background"></div>}
                                                        {ms.status === "current" && <div className={cn("w-3 h-3 rounded-full mt-1 relative z-10 ring-4 ring-background", detailShipment.status === "loading" || detailShipment.status === "in_transit" || detailShipment.status === "completed" ? "bg-emerald-500" : "bg-amber-500 animate-pulse")} />}
                                                        {ms.status === "pending" && <div className="w-3 h-3 rounded-full bg-muted-foreground mt-1 relative z-10 ring-4 ring-background"></div>}
                                                        <div>
                                                            <p className="text-xs font-bold text-foreground">{ms.title}</p>
                                                            <p className="text-[10px] text-muted-foreground mt-0.5">{ms.subtitle}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {detailModalTab === "risk" && (
                                    <div className="space-y-4 animate-fade-in">
                                        <div className="border border-border/60 rounded-xl p-5 bg-background/50">
                                            <div className="flex justify-between items-center mb-4">
                                                <h4 className="text-sm font-bold flex items-center gap-2 text-foreground">
                                                    <AlertTriangle className="w-4 h-4 text-red-500" /> AI Operational Risk Analysis
                                                </h4>
                                                {canRunRiskAnalysis && (
                                                    <button onClick={handleGenerateRiskAnalysis} disabled={isGeneratingRisk} className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg font-bold disabled:opacity-50 flex items-center gap-1.5 transition-colors shadow-sm">
                                                        {isGeneratingRisk ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing...</> : <><Wand2 className="w-3.5 h-3.5" /> Run Risk Analysis</>}
                                                    </button>
                                                )}
                                            </div>

                                            {detailShipment.riskReport ? (() => {
                                                let report;
                                                try {
                                                    report = JSON.parse(detailShipment.riskReport);
                                                } catch (e) {
                                                    report = null;
                                                }
                                                if (!report) return <p className="text-sm text-muted-foreground">Error parsing risk report data.</p>;

                                                const isHigh = report.score >= 70;
                                                const isMedium = report.score >= 40 && report.score < 70;
                                                const colorClass = isHigh ? "text-red-500 bg-red-500/10 border-red-500/20" : isMedium ? "text-amber-500 bg-amber-500/10 border-amber-500/20" : "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
                                                const textClass = isHigh ? "text-red-500" : isMedium ? "text-amber-500" : "text-emerald-500";

                                                return (
                                                    <div className="space-y-4">
                                                        <div className={cn("border rounded-lg p-4 flex items-center gap-4", colorClass)}>
                                                            <div className="w-16 h-16 rounded-full border-4 flex items-center justify-center shrink-0 border-current">
                                                                <span className="text-xl font-black">{report.score}</span>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-bold uppercase tracking-wider opacity-80">Risk Level: {report.level}</p>
                                                                <p className="text-sm font-medium mt-1 text-foreground">{report.summary}</p>
                                                                {detailShipment.lastAnalyzedAt && <p className="text-[10px] opacity-60 mt-1">Last analyzed: {new Date(detailShipment.lastAnalyzedAt).toLocaleString()}</p>}
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <div className="bg-accent/30 border border-border/50 rounded-lg p-4">
                                                                <p className="text-xs font-bold flex items-center gap-1.5 mb-2"><ShieldCheck className="w-4 h-4 text-primary" /> Key Risk Factors</p>
                                                                <ul className="list-disc pl-4 space-y-1">
                                                                    {report.factors?.map((f: string, i: number) => (
                                                                        <li key={i} className="text-xs text-muted-foreground">{f}</li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                            <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
                                                                <p className="text-xs font-bold flex items-center gap-1.5 mb-2"><Wand2 className="w-4 h-4 text-blue-500" /> Recommendations</p>
                                                                <p className="text-xs text-muted-foreground leading-relaxed">{report.recommendations}</p>
                                                            </div>
                                                            {Array.isArray(report.routeFindings) && report.routeFindings.length > 0 && (
                                                                <div className="bg-background/60 border border-border/50 rounded-lg p-4">
                                                                    <p className="text-xs font-bold flex items-center gap-1.5 mb-2"><MapPin className="w-4 h-4 text-amber-500" /> Route Findings</p>
                                                                    <ul className="list-disc pl-4 space-y-1">
                                                                        {report.routeFindings.slice(0, 5).map((f: string, i: number) => (
                                                                            <li key={i} className="text-xs text-muted-foreground">{f}</li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}
                                                            {(report.decision || report.consultantDecision) && (
                                                                <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
                                                                    <p className="text-xs font-bold uppercase text-blue-600 mb-1">Decision Helper</p>
                                                                    <p className="text-xs font-bold text-foreground">
                                                                        {report.decision?.label || report.consultantDecision?.suggestedDecision} - {report.decision?.owner || report.consultantDecision?.owner}
                                                                    </p>
                                                                    {report.decision?.confidence && (
                                                                        <p className="text-[10px] text-blue-600 font-bold mt-1">Confidence: {report.decision.confidence}</p>
                                                                    )}
                                                                    <p className="text-xs text-muted-foreground mt-1">{report.decision?.nextAction || report.consultantDecision?.nextStep}</p>
                                                                    {report.decision?.deadline && <p className="text-[10px] text-muted-foreground mt-1">Deadline: {report.decision.deadline}</p>}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {Array.isArray(report.mitigationPlan) && report.mitigationPlan.length > 0 && (
                                                            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4">
                                                                <p className="text-xs font-bold flex items-center gap-1.5 mb-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> AI Mitigation Plan</p>
                                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                                                    {report.mitigationPlan.map((item: any, i: number) => (
                                                                        <div key={i} className="rounded-lg bg-background/70 border border-border/50 p-3">
                                                                            <p className="text-xs font-bold">{item.action}</p>
                                                                            <p className="text-[10px] text-muted-foreground mt-1">Owner: {item.owner || "-"}</p>
                                                                            <p className="text-[10px] text-muted-foreground">Due: {item.due || "-"}</p>
                                                                            <span className="inline-block mt-2 rounded-md bg-emerald-500/10 text-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase">{item.status || "standby"}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {report.sourceSnapshot && (
                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                                <div className="rounded-lg border border-border/50 bg-background/60 p-3">
                                                                    <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Load Weather</p>
                                                                    <p className="text-xs font-semibold">{report.sourceSnapshot.weatherLoad?.description || "-"}</p>
                                                                    <p className="text-[10px] text-muted-foreground">Wind {safeFmt(report.sourceSnapshot.weatherLoad?.windKnots, 1)} kn</p>
                                                                </div>
                                                                <div className="rounded-lg border border-border/50 bg-background/60 p-3">
                                                                    <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Discharge Weather</p>
                                                                    <p className="text-xs font-semibold">{report.sourceSnapshot.weatherDischarge?.description || "-"}</p>
                                                                    <p className="text-[10px] text-muted-foreground">Wind {safeFmt(report.sourceSnapshot.weatherDischarge?.windKnots, 1)} kn</p>
                                                                </div>
                                                                <div className="rounded-lg border border-border/50 bg-background/60 p-3">
                                                                    <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Marine</p>
                                                                    <p className="text-xs font-semibold">Wave {safeFmt(report.sourceSnapshot.marineData?.waveHeight, 1)} m</p>
                                                                    <p className="text-[10px] text-muted-foreground">{report.sourceSnapshot.marineData?.source || "-"}</p>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {(report.dataQuality || report.humanApproval || Array.isArray(report.sourceAttribution)) && (
                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                                {report.dataQuality && (
                                                                    <div className="rounded-lg border border-border/50 bg-background/60 p-3">
                                                                        <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Data Quality</p>
                                                                        <p className="text-xs font-bold text-foreground">{report.dataQuality.completenessScore ?? 0}% complete</p>
                                                                        {(report.dataQuality.missingFields || []).slice(0, 3).map((field: string, i: number) => (
                                                                            <p key={i} className="text-[10px] text-muted-foreground mt-1">Missing: {field}</p>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                {report.humanApproval && (
                                                                    <div className="rounded-lg border border-border/50 bg-background/60 p-3">
                                                                        <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Human Approval</p>
                                                                        <p className="text-xs font-bold text-foreground">{report.humanApproval.required ? "Required" : "Not required"}</p>
                                                                        <p className="text-[10px] text-muted-foreground mt-1">{(report.humanApproval.approverRoles || []).join(", ") || "PIC Shipment"}</p>
                                                                    </div>
                                                                )}
                                                                {Array.isArray(report.sourceAttribution) && (
                                                                    <div className="rounded-lg border border-border/50 bg-background/60 p-3">
                                                                        <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Evidence Sources</p>
                                                                        {report.sourceAttribution.slice(0, 3).map((source: any, i: number) => (
                                                                            <p key={i} className="text-[10px] text-muted-foreground truncate">
                                                                                {source.url ? <ExternalLink className="w-3 h-3 inline mr-1" /> : null}
                                                                                {source.label || source.source} ({source.reliability || "UNKNOWN"})
                                                                            </p>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })() : (
                                                <div className="py-8 text-center border border-dashed border-border rounded-lg bg-accent/20">
                                                    <Wand2 className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                                                    <p className="text-sm font-semibold text-foreground">No Risk Analysis Found</p>
                                                    <p className="text-xs text-muted-foreground mt-1">Click the button above to generate an AI operational risk report.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit Modal */}
                {editShipment && (
                    <div className="modal-overlay">
                        <div className="modal-backdrop" onClick={() => setEditShipment(null)} />
                        <div className="modal-content max-w-2xl w-full bg-card border border-border rounded-xl shadow-lg p-6">
                            <div className="flex items-center justify-between mb-4 border-b border-border/30 pb-3">
                                <div>
                                    <h2 className="text-xl font-bold text-foreground">Edit Shipment</h2>
                                    <p className="text-xs text-muted-foreground mt-0.5">{editShipment?.mv_project_name || editShipment?.shipment_number}</p>
                                </div>
                                <button onClick={() => setEditShipment(null)} className="p-1.5 rounded-lg hover:bg-accent bg-accent/50 text-muted-foreground"><X className="w-4 h-4" /></button>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm mt-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                                {/* Core Identity Section */}
                                <div className="col-span-2 border-b border-border/30 pb-2 mb-1">
                                    <h3 className="text-[10px] font-bold text-primary uppercase flex items-center gap-1.5"><Package className="w-3 h-3" /> Shipment Identity</h3>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Select Forecast Sales (Primary)</label>
                                    <input
                                        list="shipment-project-options"
                                        type="text"
                                        value={editForm.mv_project_name || ""}
                                        onChange={(e) => {
                                            const name = e.target.value;
                                            const selected = projects.find((p) => normalizeKey(p.name) === normalizeKey(name));
                                            setEditForm({
                                                ...editForm,
                                                mv_project_name: name,
                                                forecast_sales_id: selected?.id || editForm.forecast_sales_id,
                                                forecast_sales_name: selected?.name || name,
                                                fco_number: selected?.fco_number || editForm.fco_number,
                                                commercial_mom_document_id: selected?.id === editForm.forecast_sales_id ? editForm.commercial_mom_document_id : undefined,
                                                commercial_po_document_id: selected?.id === editForm.forecast_sales_id ? editForm.commercial_po_document_id : undefined,
                                            });
                                        }}
                                        placeholder="Type project name (e.g. SRE...)"
                                        className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border focus:border-primary/50 text-xs font-bold text-primary"
                                    />
                                    <datalist id="shipment-project-options">
                                        {projectOptions.map((name) => (
                                            <option key={name} value={name} />
                                        ))}
                                    </datalist>
                                    <p className="text-[10px] text-muted-foreground">
                                        {selectedProjectMeta
                                            ? `Forecast Sales found • Segment: ${selectedProjectMeta.segment || "-"} • Buyer: ${selectedProjectMeta.buyer || "-"} • Created: ${selectedProjectMeta.created_at ? new Date(selectedProjectMeta.created_at).toLocaleDateString("en-GB") : "-"}`
                                            : "Forecast Sales not found in master yet. You can still save, or add this Forecast Sales first in Forecast Sales module."}
                                    </p>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Status</label>
                                    <select value={editForm.status || ""} onChange={(e) => setEditForm({ ...editForm, status: e.target.value as ShipmentStatus })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border focus:border-primary/50 text-xs">
                                        {SHIPMENT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                    {isShipmentClosingStatus(editForm.status) && detailShipment?.id === editShipment?.id && (() => {
                                        const blockers = getShipmentClosingBlockers(editForm, shipmentDocumentChecklist, shippingInstructions, shipmentIssues, sourceChanges, bargeChanges);
                                        if (!blockers.length) return null;
                                        return (
                                            <p className="rounded-md bg-red-500/10 px-2 py-1 text-[10px] font-semibold text-red-600">
                                                Closing blocked by {blockers.length} item(s): {blockers.slice(0, 2).join("; ")}
                                            </p>
                                        );
                                    })()}
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Buyer (End User)</label>
                                    <input type="text" value={editForm.buyer || ""} onChange={(e) => setEditForm({ ...editForm, buyer: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border focus:border-primary/50 text-xs" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Source (Supplier)</label>
                                    <input type="text" value={editForm.source || ""} onChange={(e) => setEditForm({ ...editForm, source: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border focus:border-primary/50 text-xs" />
                                    {editShipment?.source && (
                                        <p className="text-[9px] text-blue-600">Existing source changes must use Source Change Request.</p>
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Source Confirmation</label>
                                    <select value={editForm.source_confirmation_status || "pending"} onChange={(e) => setEditForm({ ...editForm, source_confirmation_status: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border text-xs">
                                        <option value="pending">Pending</option>
                                        <option value="confirmed">Confirmed</option>
                                        <option value="need_review">Need Review</option>
                                        <option value="rejected">Rejected</option>
                                        <option value="not_required">Not Required</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Legal Readiness</label>
                                    <select value={editForm.source_legal_readiness_status || "pending"} onChange={(e) => setEditForm({ ...editForm, source_legal_readiness_status: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border text-xs">
                                        <option value="pending">Pending</option>
                                        <option value="ready">Ready</option>
                                        <option value="cleared">Cleared</option>
                                        <option value="need_review">Need Review</option>
                                        <option value="not_required">Not Required</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Cargo Readiness</label>
                                    <select value={editForm.source_cargo_readiness_status || "pending"} onChange={(e) => setEditForm({ ...editForm, source_cargo_readiness_status: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border text-xs">
                                        <option value="pending">Pending</option>
                                        <option value="ready">Ready</option>
                                        <option value="cleared">Cleared</option>
                                        <option value="need_review">Need Review</option>
                                        <option value="not_required">Not Required</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5 col-span-2">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Source Confirmation Notes</label>
                                    <textarea value={editForm.source_confirmation_notes || ""} onChange={(e) => setEditForm({ ...editForm, source_confirmation_notes: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border text-xs resize-none" />
                                </div>

                                {/* Logistics Section */}
                                <div className="col-span-2 border-b border-border/30 pb-2 mb-1 mt-3">
                                    <h3 className="text-[10px] font-bold text-primary uppercase flex items-center gap-1.5"><Anchor className="w-3 h-3" /> Logistics & Vessel Tracking</h3>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Vessel Name</label>
                                    <input type="text" value={editForm.vessel_name || ""} onChange={(e) => setEditForm({ ...editForm, vessel_name: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border focus:border-primary/50 text-xs" />
                                    {editShipment?.vessel_name && (
                                        <p className="text-[9px] text-indigo-600">Existing MV changes must use Barge Change Log.</p>
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Barge Name</label>
                                    <input type="text" value={editForm.barge_name || ""} onChange={(e) => setEditForm({ ...editForm, barge_name: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border focus:border-primary/50 text-xs" />
                                    {editShipment?.barge_name && (
                                        <p className="text-[9px] text-indigo-600">Existing TB/BG changes must use Barge Change Log.</p>
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Loading Port</label>
                                    <input type="text" value={editForm.loading_port || ""} onChange={(e) => setEditForm({ ...editForm, loading_port: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border focus:border-primary/50 text-xs" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Discharge Port</label>
                                    <input type="text" value={editForm.discharge_port || ""} onChange={(e) => setEditForm({ ...editForm, discharge_port: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border focus:border-primary/50 text-xs" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Laycan</label>
                                    <input type="text" value={editForm.laycan || ""} onChange={(e) => setEditForm({ ...editForm, laycan: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border focus:border-primary/50 text-xs" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Shipping Term</label>
                                    <input type="text" value={editForm.shipping_term || ""} onChange={(e) => setEditForm({ ...editForm, shipping_term: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border focus:border-primary/50 text-xs" />
                                </div>

                                {/* Shipping Instruction Section */}
                                <div className="col-span-2 border-b border-border/30 pb-2 mb-1 mt-3">
                                    <h3 className="text-[10px] font-bold text-sky-500 uppercase flex items-center gap-1.5"><FileText className="w-3 h-3" /> Shipping Instruction Data</h3>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">SI To</label>
                                    <input type="text" value={editForm.si_to || ""} onChange={(e) => setEditForm({ ...editForm, si_to: e.target.value })} placeholder="PT. FONTANA RESOURCES INDONESIA" className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border focus:border-primary/50 text-xs" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Shipper</label>
                                    <input type="text" value={editForm.si_shipper || ""} onChange={(e) => setEditForm({ ...editForm, si_shipper: e.target.value })} placeholder="PT. FONTANA RESOURCES INDONESIA" className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border focus:border-primary/50 text-xs" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Consignee</label>
                                    <input type="text" value={editForm.consignee || ""} onChange={(e) => setEditForm({ ...editForm, consignee: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border focus:border-primary/50 text-xs" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Notify Party</label>
                                    <input type="text" value={editForm.notify_party || ""} onChange={(e) => setEditForm({ ...editForm, notify_party: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border focus:border-primary/50 text-xs" />
                                </div>
                                <div className="space-y-1.5 col-span-2">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Consignee Address</label>
                                    <textarea value={editForm.consignee_address || ""} onChange={(e) => setEditForm({ ...editForm, consignee_address: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border focus:border-primary/50 text-xs resize-none" />
                                </div>
                                <div className="space-y-1.5 col-span-2">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Notify Party Address</label>
                                    <textarea value={editForm.notify_party_address || ""} onChange={(e) => setEditForm({ ...editForm, notify_party_address: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border focus:border-primary/50 text-xs resize-none" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Quantity Tolerance</label>
                                    <input type="text" value={editForm.quantity_tolerance || ""} onChange={(e) => setEditForm({ ...editForm, quantity_tolerance: e.target.value })} placeholder="+/- 5% (TIDAK BOLEH LEBIH)" className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border focus:border-primary/50 text-xs" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Marked Clause</label>
                                    <input type="text" value={editForm.si_marked || ""} onChange={(e) => setEditForm({ ...editForm, si_marked: e.target.value })} placeholder='"CLEAN ON BOARD"; "FREIGHT PAYABLE AS PER CHARTER PARTY"' className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border focus:border-primary/50 text-xs" />
                                </div>

                                {/* Financial section */}
                                <div className="col-span-2 border-b border-border/30 pb-2 mb-1 mt-3">
                                    <h3 className="text-[10px] font-bold text-emerald-500 uppercase flex items-center gap-1.5"><DollarSign className="w-3 h-3" /> Commercials & P&L</h3>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-emerald-500 uppercase">Sales Price (USD/MT)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editForm.sales_price || 0}
                                        onChange={(e) => {
                                            const sales = Number(e.target.value);
                                            const buying = safeNum(editForm.buying_price);
                                            setEditForm({ ...editForm, sales_price: sales, margin_mt: buying ? sales - buying : editForm.margin_mt });
                                        }}
                                        className="w-full px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs font-bold text-emerald-600"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-amber-500 uppercase">Buying Price (USD/MT)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editForm.buying_price || 0}
                                        onChange={(e) => {
                                            const buying = Number(e.target.value);
                                            const sales = safeNum(editForm.sales_price);
                                            setEditForm({ ...editForm, buying_price: buying, margin_mt: sales ? sales - buying : editForm.margin_mt });
                                        }}
                                        className="w-full px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs font-bold text-amber-600"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-blue-500 uppercase">Margin (USD/MT)</label>
                                    <input type="number" step="0.01" value={editForm.margin_mt || 0} onChange={(e) => setEditForm({ ...editForm, margin_mt: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg bg-blue-500/5 border border-blue-500/20 text-xs font-bold text-blue-600" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Qty Plan (MT)</label>
                                    <input type="number" value={editForm.qty_plan || 0} onChange={(e) => setEditForm({ ...editForm, qty_plan: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border text-xs" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Qty Actual / Loaded (MT)</label>
                                    <input type="number" value={editForm.quantity_loaded || 0} onChange={(e) => setEditForm({ ...editForm, quantity_loaded: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border text-xs font-bold text-primary" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Freight Cost (USD/MT)</label>
                                    <input type="number" step="0.01" value={editForm.price_freight || 0} onChange={(e) => setEditForm({ ...editForm, price_freight: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border text-xs" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Royalty Cost (USD/MT)</label>
                                    <input type="number" step="0.01" value={editForm.royalty_cost || 0} onChange={(e) => setEditForm({ ...editForm, royalty_cost: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border text-xs" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Tax/Export Levy Cost (USD/MT)</label>
                                    <input type="number" step="0.01" value={editForm.tax_export_cost || 0} onChange={(e) => setEditForm({ ...editForm, tax_export_cost: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border text-xs" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Survey Cost (USD/MT)</label>
                                    <input type="number" step="0.01" value={editForm.survey_cost || 0} onChange={(e) => setEditForm({ ...editForm, survey_cost: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border text-xs" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Payment/Finance Cost (USD/MT)</label>
                                    <input type="number" step="0.01" value={editForm.payment_finance_cost || 0} onChange={(e) => setEditForm({ ...editForm, payment_finance_cost: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border text-xs" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Payment Status</label>
                                    <select value={editForm.payment_status || "pending"} onChange={(e) => setEditForm({ ...editForm, payment_status: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border text-xs">
                                        <option value="pending">Pending</option>
                                        <option value="partial">Partial</option>
                                        <option value="paid">Paid</option>
                                        <option value="settled">Settled</option>
                                        <option value="not_required">Not Required</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Payment Due Date</label>
                                    <input type="date" value={editForm.payment_due_date ? new Date(editForm.payment_due_date).toISOString().split("T")[0] : ""} onChange={(e) => setEditForm({ ...editForm, payment_due_date: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border text-xs" />
                                </div>
                                <div className="space-y-1.5 col-span-2">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Invoice Number</label>
                                    <input type="text" value={editForm.no_invoice_mkls || ""} onChange={(e) => setEditForm({ ...editForm, no_invoice_mkls: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border text-xs" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">MoM Reference</label>
                                    <select
                                        value={editForm.commercial_mom_document_id || ""}
                                        onChange={(e) => setEditForm({ ...editForm, commercial_mom_document_id: e.target.value || undefined })}
                                        disabled={!selectedProjectMeta || isLoadingProjectReferenceDocs}
                                        className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border text-xs disabled:opacity-60"
                                    >
                                        <option value="">{selectedProjectMeta ? "No MoM linked" : "Select Forecast Sales first"}</option>
                                        {projectReferenceDocs.map((doc) => (
                                            <option key={doc.id} value={doc.id}>{doc.requirementLabel || "Document"} - {doc.fileName}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">PO Reference</label>
                                    <select
                                        value={editForm.commercial_po_document_id || ""}
                                        onChange={(e) => setEditForm({ ...editForm, commercial_po_document_id: e.target.value || undefined })}
                                        disabled={!selectedProjectMeta || isLoadingProjectReferenceDocs}
                                        className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border text-xs disabled:opacity-60"
                                    >
                                        <option value="">{selectedProjectMeta ? "No PO linked" : "Select Forecast Sales first"}</option>
                                        {projectReferenceDocs.map((doc) => (
                                            <option key={doc.id} value={doc.id}>{doc.requirementLabel || "Document"} - {doc.fileName}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Quality Section */}
                                <div className="col-span-2 border-b border-border/30 pb-2 mb-1 mt-3">
                                    <h3 className="text-[10px] font-bold text-amber-500 uppercase flex items-center gap-1.5"><Beaker className="w-3 h-3" /> Quality Parameters</h3>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Quality Status</label>
                                    <select value={editForm.quality_status || "pending"} onChange={(e) => setEditForm({ ...editForm, quality_status: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border text-xs">
                                        <option value="pending">Pending</option>
                                        <option value="passed">Passed</option>
                                        <option value="approved">Approved</option>
                                        <option value="on_hold">On Hold</option>
                                        <option value="rejected">Rejected</option>
                                        <option value="not_required">Not Required</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Result GAR</label>
                                    <input type="number" value={editForm.result_gar || 0} onChange={(e) => setEditForm({ ...editForm, result_gar: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border text-xs" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Origin (Region)</label>
                                    <input type="text" value={editForm.origin || ""} onChange={(e) => setEditForm({ ...editForm, origin: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border text-xs" />
                                </div>

                                <div className="space-y-1.5 col-span-2 mt-2">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">General Remarks</label>
                                    <input type="text" value={editForm.remarks || ""} onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border text-xs" />
                                </div>
                                <div className="space-y-1.5 col-span-2 mt-2">
                                    <label className="text-[10px] font-semibold text-amber-500 uppercase flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Status Reason (Pending/Waiting)</label>
                                    <textarea
                                        value={editForm.status_reason || ""}
                                        onChange={(e) => setEditForm({ ...editForm, status_reason: e.target.value })}
                                        maxLength={500}
                                        rows={3}
                                        placeholder="Describe why this shipment is pending/waiting..."
                                        className="w-full px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/20 focus:border-amber-500/50 text-xs resize-none"
                                    />
                                    <p className="text-[9px] text-muted-foreground">{(editForm.status_reason || "").length}/500 characters</p>
                                    {["upcoming", "loading", "in_transit"].includes(editForm.status || "") && !editForm.status_reason && (
                                        <p className="text-[10px] text-amber-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Required for on-going shipments</p>
                                    )}
                                </div>
                                <div className="space-y-1.5 col-span-2">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Issue Status</label>
                                    <select value={editForm.issue_status || "none"} onChange={(e) => setEditForm({ ...editForm, issue_status: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border text-xs">
                                        <option value="none">No Issue</option>
                                        <option value="open">Open</option>
                                        <option value="monitoring">Monitoring</option>
                                        <option value="resolved">Resolved</option>
                                        <option value="closed">Closed</option>
                                    </select>
                                </div>

                                <div className="col-span-2 border-b border-border/30 pb-2 mb-1 mt-3">
                                    <h3 className="text-[10px] font-bold text-emerald-500 uppercase flex items-center gap-1.5"><Activity className="w-3 h-3" /> Operational Info & Demurrage</h3>
                                </div>
                                <div className="space-y-1.5 col-span-2">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Operational Info</label>
                                    <textarea
                                        value={editForm.operational_info || ""}
                                        onChange={(e) => setEditForm({ ...editForm, operational_info: e.target.value, demurrage_source: e.target.value ? "Operational Info" : editForm.demurrage_source })}
                                        rows={3}
                                        placeholder="Example: Vessel waiting at anchorage, demurrage USD 12k/day after laytime."
                                        className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border text-xs resize-none"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Demurrage Rate / Day</label>
                                    <input type="number" value={editForm.demurrage_rate || 0} onChange={(e) => setEditForm({ ...editForm, demurrage_rate: Number(e.target.value), demurrage_source: "Operational Info", demurrage_updated_at: new Date().toISOString() })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border text-xs" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Currency / Source</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <input type="text" value={editForm.demurrage_currency || "USD"} onChange={(e) => setEditForm({ ...editForm, demurrage_currency: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border text-xs" />
                                        <input type="text" value={editForm.demurrage_source || ""} onChange={(e) => setEditForm({ ...editForm, demurrage_source: e.target.value })} placeholder="Source" className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border text-xs" />
                                    </div>
                                </div>

                                {/* Operational & Legal (Historical Data) */}
                                <div className="col-span-2 border-b border-border/30 pb-2 mb-1 mt-3">
                                    <h3 className="text-[10px] font-bold text-blue-400 uppercase flex items-center gap-1.5"><ShieldCheck className="w-3 h-3" /> Operational & Legal</h3>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">IUP OP (Mine Source)</label>
                                    <input type="text" value={editForm.iup_op || ""} onChange={(e) => setEditForm({ ...editForm, iup_op: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border text-xs" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Nomination Number</label>
                                    <input type="text" value={editForm.nomination || ""} onChange={(e) => setEditForm({ ...editForm, nomination: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border text-xs" />
                                    {editShipment?.nomination && (
                                        <p className="text-[9px] text-indigo-600">Existing nomination changes must use Barge Change Log.</p>
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Product</label>
                                    <input type="text" value={editForm.product || ""} onChange={(e) => setEditForm({ ...editForm, product: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border text-xs" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Analysis Method</label>
                                    <input type="text" value={editForm.analysis_method || ""} onChange={(e) => setEditForm({ ...editForm, analysis_method: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border text-xs" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Shipment Flow</label>
                                    <input type="text" value={editForm.shipment_flow || ""} onChange={(e) => setEditForm({ ...editForm, shipment_flow: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border text-xs" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">No. SPAL</label>
                                    <input type="text" value={editForm.no_spal || ""} onChange={(e) => setEditForm({ ...editForm, no_spal: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border text-xs" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">No. SI</label>
                                    <input type="text" value={editForm.no_si || ""} onChange={(e) => setEditForm({ ...editForm, no_si: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border text-xs" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Surveyor LHV</label>
                                    <input type="text" value={editForm.surveyor_lhv || ""} onChange={(e) => setEditForm({ ...editForm, surveyor_lhv: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border text-xs" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Jarak (NM)</label>
                                    <input type="number" value={editForm.jarak || 0} onChange={(e) => setEditForm({ ...editForm, jarak: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border text-xs" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Deadfreight</label>
                                    <input type="number" value={editForm.deadfreight || 0} onChange={(e) => setEditForm({ ...editForm, deadfreight: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border text-xs" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">LHV Terbit (Boolean)</label>
                                    <select
                                        value={editForm.lhv_terbit ? "true" : "false"}
                                        onChange={(e) => setEditForm({
                                            ...editForm,
                                            lhv_terbit: e.target.value === "true" ? new Date().toISOString() : ""
                                        })}
                                        className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border text-xs"
                                    >
                                        <option value="true">YES</option>
                                        <option value="false">NO</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">BL Date</label>
                                    <input type="date" value={editForm.bl_date ? new Date(editForm.bl_date).toISOString().split('T')[0] : ""} onChange={(e) => setEditForm({ ...editForm, bl_date: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border text-xs" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">DMO/Export Scope</label>
                                    <select value={editForm.export_dmo || "EXPORT"} onChange={(e) => setEditForm({ ...editForm, export_dmo: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border text-xs">
                                        <option value="EXPORT">EXPORT</option>
                                        <option value="DMO">DMO</option>
                                        <option value="LOCAL">LOCAL</option>
                                    </select>
                                </div>
                            </div>

                            <div className="mt-6 flex justify-end gap-2 border-t border-border/30 pt-4">
                                <button onClick={() => setEditShipment(null)} className="px-4 py-2 hover:bg-accent text-sm rounded-lg transition-colors" disabled={isSaving}>Cancel</button>
                                <button onClick={handleSaveEdit} className="btn-primary flex items-center gap-2" disabled={isSaving}>
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Saving...
                                        </>
                                    ) : "Save Changes"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <ReportModal
                    isOpen={showReportModal}
                    onClose={() => setShowReportModal(false)}
                    moduleName="Shipment Operations"
                    onExport={(format, options) => {
                        console.log(`Exporting shipmets as ${format}`, options);
                    }}
                />

                {toast && (
                    <Toast
                        message={toast.message}
                        type={toast.type}
                        onClose={() => setToast(null)}
                    />
                )}
            </div>
        </AppShell>
    );
}
