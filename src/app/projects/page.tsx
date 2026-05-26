"use client";

import React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { cn } from "@/lib/utils";
import { FolderKanban, Search, Plus, X, Edit, Trash2, CheckCircle2, ClipboardCheck, Wand2, AlertTriangle, Loader2, Download, UploadCloud, FileText, ExternalLink, ChevronDown } from "lucide-react";
import { useCommercialStore } from "@/store/commercial-store";
import { useAuthStore } from "@/store/auth-store";
import { ProjectItem, ProjectSupplierCandidate, ShipmentDetail, ShipmentDocument, SourceSupplier } from "@/types";
import { useSearchParams } from "next/navigation";
import { jsPDF } from "jspdf";
import { Toast } from "@/components/shared/toast";

type ProjectStatus = "draft" | "waiting_approval" | "revision_requested" | "approved" | "rejected" | "upcoming" | "ongoing" | "completed" | "cancelled";

type ProjectCard = {
  id: string;
  projectKey: string;
  projectName: string;
  buyer: string;
  segment: string;
  status: ProjectStatus;
  year: number | null;
  laycan: string;
  shippingTerm: string;
  shipmentCount: number;
  volume: number;
  revenue: number;
  grossProfit: number;
  rows: ShipmentDetail[];
  sourceKind: "master" | "derived";
  createdAt: string | null;
  projectRecord?: ProjectItem;
};

type ProjectForm = {
  name: string;
  segment: string;
  buyer: string;
  status: string;
  notes: string;
  buyer_country: string;
  commodity: string;
  quantity: string;
  laycan_start: string;
  laycan_end: string;
  port_of_loading: string;
  sales_term: string;
  target_selling_price: string;
  price_basis: string;
  payment_terms: string;
  surveyor: string;
  gar: string;
  tm: string;
  ts: string;
  ash: string;
  vm: string;
  size: string;
  supplier_candidates: string;
  below_spec_reason: string;
  blending_scenario: string;
  template_type: string;
  template_checklist: string;
};

type TemplateItem = {
  code?: string;
  label: string;
  owner: string;
  done: boolean;
  required?: boolean;
  fileName?: string;
  fileUrl?: string;
  uploadedAt?: string;
  uploadedByName?: string;
};

type ApprovalHistoryItem = {
  status: string;
  comment?: string;
  userId?: string;
  userName?: string;
  createdAt?: string;
};

type RevisionHistoryItem = {
  changes?: Array<{ field: string; label: string; oldValue?: string | null; newValue?: string | null }>;
  reason?: string;
  statusAtChange?: string;
  userId?: string;
  userName?: string;
  createdAt?: string;
};

type FcoHistoryItem = {
  version?: number;
  action?: string;
  fcoNumber?: string | null;
  previousFcoNumber?: string | null;
  generatedAt?: string;
  userName?: string;
  createdAt?: string;
};

type BuyerFeedbackHistoryItem = {
  status?: string;
  previousStatus?: string | null;
  reason?: string | null;
  fcoNumber?: string | null;
  userName?: string;
  createdAt?: string;
};

type ApprovalDecision = "" | "approved" | "revision_requested" | "rejected";

type RoughPnlSnapshot = {
  generatedAt?: string;
  quantity?: number;
  sellingPrice?: number;
  supplierPrice?: number;
  freightCost?: number;
  blendingCost?: number;
  surveyorCost?: number;
  royaltyCost?: number;
  taxExportCost?: number;
  otherCost?: number;
  variableCostPerMt?: number;
  revenue?: number;
  totalCost?: number;
  estimatedGrossProfit?: number;
  marginPerMt?: number;
  marginPercent?: number;
  selectedSupplierName?: string;
  selectedSupplierFitScore?: number;
  notes?: string;
};

type DashboardBucketKey =
  | "total"
  | "draft"
  | "waitingApproval"
  | "approved"
  | "fcoSent"
  | "pendingBuyer"
  | "deal"
  | "failed";

type DashboardBucketEntry = {
  id: string;
  projectName: string;
  buyer: string;
  offerBy: string;
  statusText: string;
  card: ProjectCard;
};

const buyerFeedbackLabels: Record<string, string> = {
  fco_sent: "FCO Sent",
  waiting_feedback: "Waiting Feedback",
  negotiation: "Negotiation",
  deal: "Deal",
  failed: "Failed",
};

const safeNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const cleanText = (v?: string | null): string | null => {
  if (!v) return null;
  const t = String(v).replace(/\s+/g, " ").trim();
  return t || null;
};

const normalizeKey = (v?: string | null): string =>
  (v || "").toUpperCase().replace(/\s+/g, " ").trim();

const extractProjectName = (raw?: string | null): string | null => {
  const text = cleanText(raw);
  if (!text) return null;
  const explicit = text.match(/project\s*:\s*([^\n\r]+)/i);
  if (explicit?.[1]) return cleanText(explicit[1]);
  const code = text.match(/\b([A-Z]{2,}[A-Z0-9_.\-\/]*_\d{2})\b/i);
  if (code?.[1]) return cleanText(code[1]);
  return null;
};

const deriveProjectName = (r?: ShipmentDetail): string => {
  if (!r) return "Unmapped Forecast Sales";
  return (
    extractProjectName(r.mv_project_name) ||
    extractProjectName(r.vessel_name) ||
    cleanText(r.mv_project_name) ||
    cleanText(r.vessel_name) ||
    "Unmapped Forecast Sales"
  );
};

const detectStatus = (rows: ShipmentDetail[]): ProjectStatus => {
  const key = rows.map((r) => normalizeKey(r.status || r.shipment_status || "")).join(" ");
  if (key.includes("CANCEL")) return "cancelled";
  if (key.includes("LOADING") || key.includes("TRANSIT")) return "ongoing";
  if (key.includes("UPCOMING") || key.includes("WAITING")) return "upcoming";
  return "completed";
};

const mapMasterStatus = (s?: string | null): ProjectStatus => {
  const key = normalizeKey(s);
  if (key.includes("DRAFT")) return "draft";
  if (key.includes("REVISION")) return "revision_requested";
  if (key.includes("WAITING") || key.includes("PENDING_APPROVAL") || key.includes("WAITING_APPROVAL")) return "waiting_approval";
  if (key.includes("APPROVE")) return "approved";
  if (key.includes("REJECT")) return "rejected";
  if (key.includes("CANCEL")) return "cancelled";
  if (key.includes("COMPLETE") || key.includes("DONE")) return "completed";
  if (key.includes("LOAD") || key.includes("ONGOING") || key.includes("TRANSIT")) return "ongoing";
  return "upcoming";
};

const statusLabel: Record<ProjectStatus, string> = {
  draft: "Draft",
  waiting_approval: "Waiting Approval",
  revision_requested: "Revision",
  approved: "Approved",
  rejected: "Rejected",
  upcoming: "Upcoming",
  ongoing: "Ongoing",
  completed: "Completed",
  cancelled: "Cancelled",
};

const statusBadgeClass = (status: ProjectStatus) =>
  cn(
    "text-[10px] font-bold px-2.5 py-1 rounded-md uppercase",
    status === "draft" && "bg-slate-500/10 text-slate-600",
    status === "waiting_approval" && "bg-amber-500/10 text-amber-600",
    status === "revision_requested" && "bg-orange-500/10 text-orange-600",
    status === "approved" && "bg-sky-500/10 text-sky-600",
    status === "rejected" && "bg-rose-500/10 text-rose-600",
    status === "completed" && "bg-emerald-500/10 text-emerald-600",
    status === "ongoing" && "bg-indigo-500/10 text-indigo-600",
    status === "upcoming" && "bg-blue-500/10 text-blue-600",
    status === "cancelled" && "bg-red-500/10 text-red-600",
  );

const fmtInt = (n: number): string => safeNum(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
const fmtUsd = (n: number): string => `$${safeNum(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const formatDocDate = (value?: string | Date | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "2-digit" });
};
const documentRequirementKey = (doc: ShipmentDocument) =>
  cleanText(doc.requirementCode || undefined)?.toLowerCase() ||
  normalizeKey(doc.requirementLabel || doc.title || doc.fileName);
const compactDocumentTitle = (doc: ShipmentDocument) => {
  const code = cleanText(doc.requirementCode || undefined);
  const label = cleanText(doc.requirementLabel || doc.title || doc.fileName) || "Required document";
  const normalized = label
    .replace(/^1\s+ORIGINAL\s+/i, "")
    .replace(/^COPY OF\s+/i, "")
    .replace(/^3\/3\s+/i, "")
    .replace(/\s+ISSUED BY .+$/i, "")
    .trim();
  return `${code ? `${code}. ` : ""}${normalized || label}`;
};
const fileNameFromContentDisposition = (value: string | null, fallback: string) => {
  if (!value) return fallback;
  const utfName = value.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (utfName) {
    try {
      return decodeURIComponent(utfName);
    } catch {
      return utfName;
    }
  }
  return value.match(/filename="?([^";]+)"?/i)?.[1] || fallback;
};
const rowQty = (r: ShipmentDetail) => safeNum(r.qty_plan ?? r.quantity_loaded ?? r.qty_cob);
const rowSellPrice = (r: ShipmentDetail) => safeNum(r.sales_price ?? r.sp ?? r.harga_actual_fob_mv);
const rowBuyPrice = (r: ShipmentDetail) => safeNum(r.buying_price ?? r.harga_actual_fob ?? r.hpb);
const rowMargin = (r: ShipmentDetail) => {
  const manual = safeNum(r.margin_mt);
  if (manual) return manual;
  const sell = rowSellPrice(r);
  const buy = rowBuyPrice(r);
  return sell && buy ? sell - buy : 0;
};

const PROJECT_TEMPLATES: Record<string, TemplateItem[]> = {
  export_shipment: [
    { code: "a", label: "COPY OF LAPORAN HASIL VERIFIKASI", owner: "QC / Surveyor", required: true, done: false },
    { code: "b", label: "1 ORIGINAL DRAUGHT SURVEY REPORT", owner: "Traffic / Surveyor", required: true, done: false },
    { code: "c", label: "1 ORIGINAL SURAT KETERANGAN ASAL BARANG", owner: "Sourcing", required: true, done: false },
    { code: "d", label: "1 ORIGINAL SURAT KEBENARAN DOKUMEN", owner: "Operation", required: true, done: false },
    { code: "e", label: "1 ORIGINAL SURAT KIRIM BARANG", owner: "Operation", required: true, done: false },
    { code: "f", label: "1 ORIGINAL BUKTI BAYAR ROYALTI", owner: "Finance / Sourcing", required: true, done: false },
    { code: "g", label: "3/3 ORIGINAL BILL OF LADING ISSUED BY LOADPORT AGENT", owner: "Traffic", required: true, done: false },
    { code: "h", label: "3/3 COPIES NON NEGOTIABLE BILL OF LADING ISSUED BY LOADPORT AGENT", owner: "Traffic", required: true, done: false },
    { code: "i", label: "1 ORIGINAL AND 4 COPIES OF CERTIFICATE OF SAMPLING AND ANALYSIS ISSUED BY INDEPENDENT SURVEYOR AT LOADING PORT (IF ANY)", owner: "QC", required: true, done: false },
    { code: "j", label: "1 ORIGINAL AND 4 COPIES OF CERTIFICATE OF WEIGHT ISSUED BY INDEPENDENT SURVEYOR AT LOADING PORT (IF ANY)", owner: "QC", required: true, done: false },
    { code: "k", label: "1 ORIGINAL AND 2 COPIES OF CERTIFICATE OF DRAUGHT SURVEY REPORT BY INDEPENDENT SURVEYOR AT LOADING PORT", owner: "QC / Surveyor", required: true, done: false },
  ],
  domestic_delivery: [
    { code: "a", label: "Buyer PO and delivery schedule confirmed", owner: "Trader", required: true, done: false },
    { code: "b", label: "Supplier stock and loading window confirmed", owner: "Sourcing", required: true, done: false },
    { code: "c", label: "Transport/fleet readiness confirmed", owner: "Traffic", required: true, done: false },
    { code: "d", label: "Operational Info updated", owner: "Operation", required: true, done: false },
    { code: "e", label: "Payment terms and due date reviewed", owner: "Finance/Admin", required: true, done: false },
  ],
  spot_purchase: [
    { code: "a", label: "Supplier KYC/legal documents checked", owner: "Sourcing", required: true, done: false },
    { code: "b", label: "Coal specs and price index benchmarked", owner: "QC/Trader", required: true, done: false },
    { code: "c", label: "Purchase request submitted", owner: "Sourcing", required: true, done: false },
    { code: "d", label: "Logistics and demurrage assumptions captured", owner: "Traffic", required: true, done: false },
    { code: "e", label: "Approval decision recorded", owner: "Executive", required: true, done: false },
  ],
};

const defaultForm: ProjectForm = {
  name: "",
  segment: "",
  buyer: "",
  status: "draft",
  notes: "",
  buyer_country: "",
  commodity: "Coal",
  quantity: "",
  laycan_start: "",
  laycan_end: "",
  port_of_loading: "",
  sales_term: "FOB",
  target_selling_price: "",
  price_basis: "Fixed",
  payment_terms: "",
  surveyor: "",
  gar: "",
  tm: "",
  ts: "",
  ash: "",
  vm: "",
  size: "",
  supplier_candidates: "",
  below_spec_reason: "",
  blending_scenario: "",
  template_type: "export_shipment",
  template_checklist: JSON.stringify(PROJECT_TEMPLATES.export_shipment),
};

const offerSubmitRequiredFields: { key: keyof ProjectForm; label: string }[] = [
  { key: "name", label: "Forecast Sales Name" },
  { key: "buyer", label: "Buyer Name" },
  { key: "buyer_country", label: "Buyer Country" },
  { key: "commodity", label: "Commodity" },
  { key: "quantity", label: "Quantity" },
  { key: "laycan_start", label: "Laycan Start" },
  { key: "laycan_end", label: "Laycan End" },
  { key: "port_of_loading", label: "Port of Loading" },
  { key: "sales_term", label: "Sales Term" },
  { key: "target_selling_price", label: "Target Selling Price" },
  { key: "price_basis", label: "Price Basis" },
  { key: "payment_terms", label: "Payment Terms" },
  { key: "surveyor", label: "Surveyor" },
  { key: "gar", label: "GAR" },
  { key: "tm", label: "TM" },
  { key: "ts", label: "TS" },
  { key: "ash", label: "Ash" },
];

const numericOrUndefined = (value: string): number | undefined => {
  const text = value.trim();
  if (!text) return undefined;
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
};

const dateInputValue = (value?: string | null): string => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const parseTemplateChecklist = (value?: string | null): TemplateItem[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.map((item) => ({
        code: cleanText(item?.code) || undefined,
        label: cleanText(item?.label) || "Checklist item",
        owner: cleanText(item?.owner) || "Team",
        done: Boolean(item?.done),
        required: item?.required !== undefined ? Boolean(item.required) : true,
        fileName: cleanText(item?.fileName) || undefined,
        fileUrl: cleanText(item?.fileUrl) || undefined,
        uploadedAt: cleanText(item?.uploadedAt) || undefined,
        uploadedByName: cleanText(item?.uploadedByName) || undefined,
      }))
      : [];
  } catch {
    return [];
  }
};

const parseApprovalHistory = (value?: string | null): ApprovalHistoryItem[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const parseRevisionHistory = (value?: string | null): RevisionHistoryItem[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const parseFcoHistory = (value?: string | null): FcoHistoryItem[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const parseBuyerFeedbackHistory = (value?: string | null): BuyerFeedbackHistoryItem[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const parseJsonObject = (value?: string | null): any | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const romanMonth = (date = new Date()) => {
  const months = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  return months[date.getMonth()] || "I";
};

const slugFile = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "project";

const pickText = (...values: Array<string | number | null | undefined>) => {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).replace(/\s+/g, " ").trim();
    if (text) return text;
  }
  return "-";
};

const qtyText = (value: number, tolerance?: string | null) => {
  if (!value) return "-";
  return `${fmtInt(value)} MT ${pickText(tolerance, "+/- 5% (TIDAK BOLEH LEBIH)")}`;
};

const formatSummaryDate = (value: Date) =>
  value.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).replace(",", "");

const fmtReportMoney = (value: number) => `$${safeNum(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

const avgNonZero = (values: Array<number | null | undefined>) => {
  const numbers = values.map(safeNum).filter((value) => value > 0);
  if (!numbers.length) return 0;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
};

const firstPositive = (...values: Array<number | null | undefined>) =>
  values.map(safeNum).find((value) => value > 0) || 0;

const buildSiNumber = (project: ProjectCard, row?: ShipmentDetail) => {
  const raw = pickText(row?.no_si, row?.shipment_number);
  if (raw !== "-") return raw;
  const date = project.createdAt ? new Date(project.createdAt) : new Date();
  const no = row?.no ? String(row.no).padStart(3, "0") : String(project.projectName.length).padStart(3, "0");
  return `${no} SI-SUPPLIER/${romanMonth(date)}/${date.getFullYear()}`;
};

const buildFcoNumber = (project: ProjectCard) => {
  if (project.projectRecord?.fco_number) return project.projectRecord.fco_number;
  const date = project.createdAt ? new Date(project.createdAt) : new Date();
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const suffix = project.id.replace(/[^a-z0-9]/gi, "").slice(-4).toUpperCase().padStart(4, "0");
  return `FCO.C${yy}${mm}-${suffix}`;
};

const urgencyBadgeClass = (level?: string | null) =>
  cn(
    "text-[10px] font-bold px-2 py-1 rounded-md uppercase border",
    level === "CRITICAL" && "bg-red-500/10 text-red-600 border-red-500/30",
    level === "HIGH" && "bg-orange-500/10 text-orange-600 border-orange-500/30",
    level === "MEDIUM" && "bg-amber-500/10 text-amber-600 border-amber-500/30",
    (!level || level === "LOW") && "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  );

export default function ProjectsPage() {
  const searchParams = useSearchParams();
  const { currentUser } = useAuthStore();
  const { shipments, projects, sources, marketPrices, syncFromMemory, addProject, updateProject, deleteProject, addShipment, updateShipment } = useCommercialStore();
  const [isInitializing, setIsInitializing] = React.useState(true);
  const [search, setSearch] = React.useState(() => searchParams.get("q") || "");
  const [yearFilter, setYearFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState<"all" | ProjectStatus>("all");
  const [openDashboardBucket, setOpenDashboardBucket] = React.useState<DashboardBucketKey | null>(null);
  const [selectedProject, setSelectedProject] = React.useState<ProjectCard | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  const [editingProject, setEditingProject] = React.useState<ProjectItem | null>(null);
  const [form, setForm] = React.useState<ProjectForm>(defaultForm);
  const [saving, setSaving] = React.useState(false);
  const [urgencyLoading, setUrgencyLoading] = React.useState<string | null>(null);
  const [uploadingDoc, setUploadingDoc] = React.useState<string | null>(null);
  const [shipmentDocDownloads, setShipmentDocDownloads] = React.useState<Record<string, ShipmentDocument[]>>({});
  const [loadingShipmentDocs, setLoadingShipmentDocs] = React.useState(false);
  const [downloadingRequiredZip, setDownloadingRequiredZip] = React.useState<Record<string, boolean>>({});
  const [downloadingFco, setDownloadingFco] = React.useState<string | null>(null);
  const [approvalDecision, setApprovalDecision] = React.useState<ApprovalDecision>("");
  const [approvalComment, setApprovalComment] = React.useState("");
  const [approvalSaving, setApprovalSaving] = React.useState(false);
  const [buyerFeedbackReason, setBuyerFeedbackReason] = React.useState("");
  const [convertingShipment, setConvertingShipment] = React.useState(false);
  const [revisionReason, setRevisionReason] = React.useState("");
  const [blendQuantities, setBlendQuantities] = React.useState<Record<string, string>>({});
  const [supplierCandidates, setSupplierCandidates] = React.useState<ProjectSupplierCandidate[]>([]);
  const [candidateAction, setCandidateAction] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<{ message: string; type: "success" | "error" } | null>(null);
  const role = String(currentUser?.role || "").toUpperCase();
  const canApprove = ["CEO", "DIRUT", "ASS_DIRUT"].includes(role);
  const canAnalyzeUrgency = ["CEO", "DIRUT", "ASS_DIRUT"].includes(role);
  const roughPnl = React.useMemo<RoughPnlSnapshot | null>(() => {
    const parsed = parseJsonObject(selectedProject?.projectRecord?.rough_pnl || null);
    return parsed ? (parsed as RoughPnlSnapshot) : null;
  }, [selectedProject?.projectRecord?.rough_pnl]);
  const latestMarketPrice = React.useMemo(() => {
    return [...marketPrices]
      .filter((item) => !item.is_deleted)
      .sort((a, b) => new Date(b.date || b.updated_at || 0).getTime() - new Date(a.date || a.updated_at || 0).getTime())[0] || null;
  }, [marketPrices]);

  React.useEffect(() => {
    let active = true;
    setIsInitializing(true);
    syncFromMemory().finally(() => {
      if (active) setIsInitializing(false);
    });
    return () => {
      active = false;
    };
  }, [syncFromMemory]);
  React.useEffect(() => {
    const q = searchParams.get("q");
    if (q) setSearch(q);
  }, [searchParams]);

  React.useEffect(() => {
    setApprovalDecision("");
    setApprovalComment("");
    setBuyerFeedbackReason(selectedProject?.projectRecord?.buyer_feedback_reason || "");
  }, [selectedProject?.id]);

  const loadProjectSupplierCandidates = React.useCallback(async (projectId?: string | null) => {
    if (!projectId) {
      setSupplierCandidates([]);
      return;
    }
    try {
      const res = await fetch(`/api/projects/${projectId}/supplier-candidates`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      setSupplierCandidates(res.ok && Array.isArray(data.candidates) ? data.candidates : []);
    } catch {
      setSupplierCandidates([]);
    }
  }, []);

  React.useEffect(() => {
    loadProjectSupplierCandidates(selectedProject?.projectRecord?.id || editingProject?.id || null);
  }, [editingProject?.id, loadProjectSupplierCandidates, selectedProject?.projectRecord?.id]);

  React.useEffect(() => {
    if (!selectedProject?.rows.length) {
      setShipmentDocDownloads({});
      return;
    }
    let active = true;
    const shipmentIds = selectedProject.rows.map((row) => row.id).filter(Boolean);
    const startedAt = performance.now();
    setLoadingShipmentDocs(true);
    fetch("/api/shipments/documents/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ shipmentIds, group: "required" }),
    }).then(async (res) => {
      const trace = res.headers.get("x-bos-doc-trace");
      const serverTiming = res.headers.get("server-timing");
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to load shipment documents");
      const clientMs = Math.round(performance.now() - startedAt);
      const payload = {
        project: selectedProject.projectName,
        shipmentCount: shipmentIds.length,
        docCount: Array.isArray(data.documents) ? data.documents.length : 0,
        clientMs,
        trace,
        serverTiming,
      };
      if (clientMs > 3000) {
        console.warn("[projects] Required document batch load is slow", payload);
      } else {
        console.info("[projects] Required document batch load", payload);
      }
      return data.documentsByShipment || {};
    }).catch((error) => {
      console.warn("[projects] Failed to load required document batch", {
        project: selectedProject.projectName,
        shipmentCount: shipmentIds.length,
        clientMs: Math.round(performance.now() - startedAt),
        error: error instanceof Error ? error.message : String(error),
      });
      return {};
    }).then((documentsByShipment) => {
      if (!active) return;
      const next = Object.fromEntries(shipmentIds.map((id) => [id, documentsByShipment[id] || []]));
      setShipmentDocDownloads(next);
      setLoadingShipmentDocs(false);
    });
    return () => {
      active = false;
    };
  }, [selectedProject?.id, selectedProject?.rows]);

  const groupedShipments = React.useMemo(() => {
    const map = new Map<string, ShipmentDetail[]>();
    shipments.forEach((s) => {
      const name = deriveProjectName(s);
      const key = normalizeKey(name);
      map.set(key, [...(map.get(key) || []), s]);
    });
    return map;
  }, [shipments]);

  const masterMap = React.useMemo(() => {
    const map = new Map<string, ProjectItem>();
    projects.forEach((p) => map.set(normalizeKey(p.name), p));
    return map;
  }, [projects]);

  const cards = React.useMemo<ProjectCard[]>(() => {
    const out: ProjectCard[] = [];

    projects.forEach((p) => {
      const key = normalizeKey(p.name);
      const rows = groupedShipments.get(key) || [];
      const years = rows.map((r) => safeNum(r.year)).filter((y) => y > 0);
      const laycanStartYear = p.laycan_start ? new Date(p.laycan_start).getFullYear() : null;
      const offerQty = safeNum(p.quantity);
      const offerPrice = safeNum(p.target_selling_price);
      const year = years.length ? Math.max(...years) : (laycanStartYear || (p.created_at ? new Date(p.created_at).getFullYear() : null));
      const shipmentVolume = rows.reduce((s, r) => s + rowQty(r), 0);
      const volume = shipmentVolume || offerQty;
      const shipmentRevenue = rows.reduce((s, r) => s + rowQty(r) * rowSellPrice(r), 0);
      const revenue = shipmentRevenue || (offerQty * offerPrice);
      const grossProfit = rows.reduce((s, r) => {
        return s + rowQty(r) * rowMargin(r);
      }, 0);
      out.push({
        id: p.id,
        projectKey: key,
        projectName: p.name,
        buyer: cleanText(p.buyer) || cleanText(rows.find((r) => r.buyer)?.buyer) || "-",
        segment: cleanText(p.segment) || "-",
        status: (() => {
          const masterStatus = mapMasterStatus(p.status);
          if (["draft", "waiting_approval", "revision_requested", "approved", "rejected", "cancelled"].includes(masterStatus)) {
            return masterStatus;
          }
          return rows.length ? detectStatus(rows) : masterStatus;
        })(),
        year,
        laycan: cleanText(rows.find((r) => r.laycan)?.laycan) || [p.laycan_start, p.laycan_end].filter(Boolean).join(" - ") || "TBA",
        shippingTerm: cleanText(rows.find((r) => r.shipping_term)?.shipping_term) || cleanText(p.sales_term) || "-",
        shipmentCount: rows.length,
        volume,
        revenue,
        grossProfit,
        rows,
        sourceKind: "master",
        createdAt: p.created_at || null,
        projectRecord: p,
      });
    });

    groupedShipments.forEach((rows, key) => {
      if (masterMap.has(key)) return;
      const years = rows.map((r) => safeNum(r.year)).filter((y) => y > 0);
      out.push({
        id: `derived:${key}`,
        projectKey: key,
        projectName: deriveProjectName(rows[0]),
        buyer: cleanText(rows.find((r) => r.buyer)?.buyer) || "-",
        segment: "-",
        status: detectStatus(rows),
        year: years.length ? Math.max(...years) : null,
        laycan: cleanText(rows.find((r) => r.laycan)?.laycan) || "TBA",
        shippingTerm: cleanText(rows.find((r) => r.shipping_term)?.shipping_term) || "-",
        shipmentCount: rows.length,
        volume: rows.reduce((s, r) => s + rowQty(r), 0),
        revenue: rows.reduce((s, r) => s + rowQty(r) * rowSellPrice(r), 0),
        grossProfit: rows.reduce((s, r) => s + rowQty(r) * rowMargin(r), 0),
        rows,
        sourceKind: "derived",
        createdAt: null,
      });
    });

    return out.sort((a, b) => (b.year || 0) - (a.year || 0) || b.volume - a.volume);
  }, [groupedShipments, projects, masterMap]);

  const years = React.useMemo(
    () => Array.from(new Set(cards.map((c) => c.year).filter((y): y is number => y !== null))).sort((a, b) => b - a),
    [cards],
  );

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return cards.filter((p) => {
      if (yearFilter !== "all" && String(p.year || "") !== yearFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      return [p.projectName, p.buyer, p.segment].some((x) => x.toLowerCase().includes(q));
    });
  }, [cards, search, yearFilter, statusFilter]);

  const forecastDashboard = React.useMemo(() => {
    const master = projects.filter((project) => !project.is_deleted);
    const countStatus = (status: ProjectStatus) =>
      master.filter((project) => mapMasterStatus(project.status) === status).length;
    const feedback = (status: string) =>
      master.filter((project) => String(project.buyer_feedback_status || "").toLowerCase() === status).length;
    const pendingBuyer = master.filter((project) =>
      ["fco_sent", "waiting_feedback", "negotiation"].includes(String(project.buyer_feedback_status || "").toLowerCase()),
    ).length;
    const fcoSent = master.filter((project) =>
      Boolean(project.fco_number) || Boolean(project.buyer_feedback_status),
    ).length;
    const estimatedRevenue = master.reduce((sum, project) =>
      sum + safeNum(project.quantity) * safeNum(project.target_selling_price), 0);
    const shipmentGrossProfit = cards.reduce((sum, project) => sum + safeNum(project.grossProfit), 0);
    return {
      total: master.length,
      draft: countStatus("draft"),
      waitingApproval: countStatus("waiting_approval"),
      approved: countStatus("approved"),
      fcoSent,
      pendingBuyer,
      deal: feedback("deal"),
      failed: feedback("failed"),
      estimatedRevenue,
      shipmentGrossProfit,
    };
  }, [cards, projects]);

  const forecastDashboardBuckets = React.useMemo<Record<DashboardBucketKey, DashboardBucketEntry[]>>(() => {
    const masterCards = cards.filter((card) => card.projectRecord && !card.projectRecord.is_deleted);
    const entryFor = (card: ProjectCard): DashboardBucketEntry => {
      const record = card.projectRecord;
      const feedback = String(record?.buyer_feedback_status || "").toLowerCase();
      return {
        id: card.id,
        projectName: card.projectName,
        buyer: card.buyer || record?.buyer || "-",
        offerBy: record?.created_by_name || "Unknown",
        statusText: feedback ? (buyerFeedbackLabels[feedback] || feedback.replace(/_/g, " ")) : (statusLabel[card.status] || card.status),
        card,
      };
    };
    const byStatus = (status: ProjectStatus) =>
      masterCards.filter((card) => mapMasterStatus(card.projectRecord?.status) === status).map(entryFor);
    const byFeedback = (statuses: string[]) =>
      masterCards.filter((card) => statuses.includes(String(card.projectRecord?.buyer_feedback_status || "").toLowerCase())).map(entryFor);

    return {
      total: masterCards.map(entryFor),
      draft: byStatus("draft"),
      waitingApproval: byStatus("waiting_approval"),
      approved: byStatus("approved"),
      fcoSent: masterCards.filter((card) =>
        Boolean(card.projectRecord?.fco_number) || Boolean(card.projectRecord?.buyer_feedback_status),
      ).map(entryFor),
      pendingBuyer: byFeedback(["fco_sent", "waiting_feedback", "negotiation"]),
      deal: byFeedback(["deal"]),
      failed: byFeedback(["failed"]),
    };
  }, [cards]);

  const isInitialForecastLoading = isInitializing && projects.length === 0 && shipments.length === 0;

  const sourceCandidateRows = React.useMemo(() => {
    const target = {
      gar: safeNum(form.gar),
      tm: safeNum(form.tm),
      ts: safeNum(form.ts),
      ash: safeNum(form.ash),
      qty: safeNum(form.quantity),
    };
    const scoreSource = (source: SourceSupplier) => {
      const warnings: string[] = [];
      let score = 100;
      const spec = source.spec || ({} as SourceSupplier["spec"]);
      if (target.gar && safeNum(spec.gar) < target.gar) {
        const diff = target.gar - safeNum(spec.gar);
        score -= Math.min(35, diff / Math.max(target.gar, 1) * 120);
        warnings.push(`GAR below ${fmtInt(diff)}`);
      }
      ([
        ["tm", "TM"],
        ["ts", "TS"],
        ["ash", "Ash"],
      ] as const).forEach(([key, label]) => {
        const targetValue = safeNum(target[key]);
        const actualValue = safeNum(spec[key]);
        if (targetValue && actualValue > targetValue) {
          score -= Math.min(20, (actualValue - targetValue) * 6);
          warnings.push(`${label} above target`);
        }
      });
      if (target.qty && safeNum(source.stock_available) < target.qty) {
        score -= 15;
        warnings.push("stock below qty");
      }
      if (source.kyc_status !== "verified") {
        score -= 8;
        warnings.push("KYC not verified");
      }
      if (source.psi_status === "failed") {
        score -= 12;
        warnings.push("PSI failed");
      }
      return {
        source,
        score: Math.max(0, Math.min(100, Math.round(score))),
        warnings,
      };
    };
    return sources
      .filter((source) => !source.is_deleted)
      .map(scoreSource)
      .sort((a, b) => b.score - a.score || safeNum(b.source.stock_available) - safeNum(a.source.stock_available))
      .slice(0, 6);
  }, [form.ash, form.gar, form.quantity, form.tm, form.ts, sources]);

  const priceReference = React.useMemo(() => {
    const basis = normalizeKey(form.price_basis);
    const targetGar = safeNum(form.gar);
    const targetPrice = safeNum(form.target_selling_price);
    const market = latestMarketPrice;
    const iciByGar = (() => {
      if (!market) return { label: "ICI", value: 0 };
      if (targetGar >= 6200) return { label: "ICI 1", value: safeNum(market.ici_1) };
      if (targetGar >= 5600) return { label: "ICI 2", value: safeNum(market.ici_2) };
      if (targetGar >= 4600) return { label: "ICI 3", value: safeNum(market.ici_3) };
      if (targetGar >= 3800) return { label: "ICI 4", value: safeNum(market.ici_4) };
      return { label: "ICI 5", value: safeNum(market.ici_5) || safeNum(market.ici_4) };
    })();
    const marketRef = (() => {
      if (!market) return { label: "No market reference", value: 0 };
      if (basis.includes("NEWCASTLE")) return { label: "Newcastle", value: safeNum(market.newcastle) };
      if (basis.includes("HBA")) return { label: "HBA", value: safeNum(market.hba) };
      if (basis.includes("ICI")) return iciByGar;
      return iciByGar.value ? iciByGar : { label: "HBA", value: safeNum(market.hba) };
    })();
    const commodityKey = normalizeKey(form.commodity);
    const buyerKey = normalizeKey(form.buyer);
    const historicalRows = shipments
      .filter((shipment) => !shipment.is_deleted)
      .filter((shipment) => {
        const price = rowSellPrice(shipment);
        if (!price) return false;
        const buyerMatches = !buyerKey || normalizeKey(shipment.buyer).includes(buyerKey) || buyerKey.includes(normalizeKey(shipment.buyer));
        const commodityMatches = !commodityKey || normalizeKey(shipment.product).includes(commodityKey) || commodityKey.includes(normalizeKey(shipment.product));
        return buyerMatches && commodityMatches;
      })
      .sort((a, b) => new Date(b.bl_date || b.updated_at || 0).getTime() - new Date(a.bl_date || a.updated_at || 0).getTime())
      .slice(0, 8);
    const historicalAverage = historicalRows.length
      ? historicalRows.reduce((sum, shipment) => sum + rowSellPrice(shipment), 0) / historicalRows.length
      : 0;
    const referenceValue = marketRef.value || historicalAverage;
    const gap = targetPrice && referenceValue ? targetPrice - referenceValue : 0;
    const gapPercent = targetPrice && referenceValue ? (gap / referenceValue) * 100 : 0;
    const warning = Boolean(targetPrice && referenceValue && targetPrice < referenceValue * 0.98);
    return {
      market,
      marketLabel: marketRef.label,
      marketValue: marketRef.value,
      historicalAverage,
      historicalCount: historicalRows.length,
      referenceValue,
      gap,
      gapPercent,
      warning,
    };
  }, [form.buyer, form.commodity, form.gar, form.price_basis, form.target_selling_price, latestMarketPrice, shipments]);

  const selectedCandidateNeedsAcknowledgement = React.useMemo(() => {
    const text = form.supplier_candidates || "";
    const fitScores = Array.from(text.matchAll(/fit\s+(\d{1,3})%/gi)).map((match) => Number(match[1]));
    return (
      fitScores.some((score) => Number.isFinite(score) && score < 80) ||
      /below|above target|stock below|kyc not verified|psi failed/i.test(text)
    );
  }, [form.supplier_candidates]);

  const blendSimulation = React.useMemo(() => {
    const inputs = sourceCandidateRows
      .map(({ source }) => ({
        source,
        quantity: safeNum(blendQuantities[source.id]),
      }))
      .filter((item) => item.quantity > 0);
    const totalQty = inputs.reduce((sum, item) => sum + item.quantity, 0);
    const weighted = (key: "gar" | "tm" | "ts" | "ash") => {
      if (!totalQty) return 0;
      return inputs.reduce((sum, item) => sum + safeNum(item.source.spec?.[key]) * item.quantity, 0) / totalQty;
    };
    const avgCost = totalQty
      ? inputs.reduce((sum, item) => sum + safeNum(item.source.fob_barge_price_usd) * item.quantity, 0) / totalQty
      : 0;
    const targetQty = safeNum(form.quantity);
    const result = {
      inputs,
      totalQty,
      avgCost,
      gar: weighted("gar"),
      tm: weighted("tm"),
      ts: weighted("ts"),
      ash: weighted("ash"),
      targetQty,
    };
    const warnings: string[] = [];
    if (targetQty && totalQty && totalQty !== targetQty) warnings.push(`Quantity differs from target by ${fmtInt(Math.abs(targetQty - totalQty))} MT`);
    if (safeNum(form.gar) && result.gar && result.gar < safeNum(form.gar)) warnings.push("Final GAR below target");
    if (safeNum(form.tm) && result.tm && result.tm > safeNum(form.tm)) warnings.push("Final TM above target");
    if (safeNum(form.ts) && result.ts && result.ts > safeNum(form.ts)) warnings.push("Final TS above target");
    if (safeNum(form.ash) && result.ash && result.ash > safeNum(form.ash)) warnings.push("Final Ash above target");
    return { ...result, warnings };
  }, [blendQuantities, form.ash, form.gar, form.quantity, form.tm, form.ts, sourceCandidateRows]);

  const addSourceCandidateToForm = (source: SourceSupplier, score: number) => {
    const line = [
      source.name,
      source.region ? `Region ${source.region}` : null,
      source.spec?.gar ? `GAR ${source.spec.gar}` : null,
      source.spec?.tm ? `TM ${source.spec.tm}` : null,
      source.spec?.ts ? `TS ${source.spec.ts}` : null,
      source.spec?.ash ? `Ash ${source.spec.ash}` : null,
      `Stock ${fmtInt(safeNum(source.stock_available))} MT`,
      `Fit ${score}%`,
    ].filter(Boolean).join(" | ");
    setForm((current) => {
      const existing = current.supplier_candidates || "";
      if (normalizeKey(existing).includes(normalizeKey(source.name))) return current;
      return {
        ...current,
        supplier_candidates: [existing.trim(), line].filter(Boolean).join("\n"),
      };
    });
  };

  const saveStructuredCandidate = async (source: SourceSupplier, score: number, warnings: string[] = []) => {
    const projectId = editingProject?.id || selectedProject?.projectRecord?.id;
    if (!projectId) return;
    const actionKey = `candidate:${source.id}`;
    setCandidateAction(actionKey);
    try {
      const res = await fetch(`/api/projects/${projectId}/supplier-candidates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: source.id,
          supplierName: source.name,
          sourceName: source.name,
          region: source.region,
          fitScore: score,
          warningText: warnings.join(", "),
          stockAvailable: source.stock_available,
          gar: source.spec?.gar,
          tm: source.spec?.tm,
          ts: source.spec?.ts,
          ash: source.spec?.ash,
          priceUsd: source.fob_barge_price_usd,
          status: "candidate",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to save supplier candidate");
      await loadProjectSupplierCandidates(projectId);
    } finally {
      setCandidateAction(null);
    }
  };

  const addSourceCandidate = async (source: SourceSupplier, score: number, warnings: string[] = []) => {
    addSourceCandidateToForm(source, score);
    if (editingProject?.id || selectedProject?.projectRecord?.id) {
      await saveStructuredCandidate(source, score, warnings).catch(() => null);
    }
  };

  const selectStructuredCandidate = async (candidate: ProjectSupplierCandidate) => {
    const projectId = selectedProject?.projectRecord?.id || editingProject?.id;
    if (!projectId) return;
    const actionKey = `select:${candidate.id}`;
    setCandidateAction(actionKey);
    try {
      const res = await fetch(`/api/projects/${projectId}/supplier-candidates`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: candidate.id, selected: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to select supplier candidate");
      await loadProjectSupplierCandidates(projectId);
      await syncFromMemory();
    } finally {
      setCandidateAction(null);
    }
  };

  const selectedSupplierCandidateFor = React.useCallback((project?: ProjectItem | null) => {
    if (!project?.id) return undefined;
    return supplierCandidates.find((candidate) => candidate.projectId === project.id && candidate.selected && !candidate.isDeleted);
  }, [supplierCandidates]);

  const openCreate = () => {
    setEditingProject(null);
    setRevisionReason("");
    setBlendQuantities({});
    setForm({ ...defaultForm });
    setShowForm(true);
  };

  const openEdit = (p: ProjectItem) => {
    setEditingProject(p);
    setRevisionReason("");
    setBlendQuantities({});
    setForm({
      name: p.name || "",
      segment: p.segment || "",
      buyer: p.buyer || "",
      status: p.status || "draft",
      notes: p.notes || "",
      buyer_country: p.buyer_country || "",
      commodity: p.commodity || "Coal",
      quantity: p.quantity ? String(p.quantity) : "",
      laycan_start: dateInputValue(p.laycan_start),
      laycan_end: dateInputValue(p.laycan_end),
      port_of_loading: p.port_of_loading || "",
      sales_term: p.sales_term || "FOB",
      target_selling_price: p.target_selling_price ? String(p.target_selling_price) : "",
      price_basis: p.price_basis || "Fixed",
      payment_terms: p.payment_terms || "",
      surveyor: p.surveyor || "",
      gar: p.gar ? String(p.gar) : "",
      tm: p.tm ? String(p.tm) : "",
      ts: p.ts ? String(p.ts) : "",
      ash: p.ash ? String(p.ash) : "",
      vm: p.vm ? String(p.vm) : "",
      size: p.size || "",
      supplier_candidates: p.supplier_candidates || "",
      below_spec_reason: p.below_spec_reason || "",
      blending_scenario: p.blending_scenario || "",
      template_type: p.template_type || "export_shipment",
      template_checklist: p.template_checklist || JSON.stringify(PROJECT_TEMPLATES[p.template_type || "export_shipment"] || PROJECT_TEMPLATES.export_shipment),
    });
    setShowForm(true);
  };

  const handleTemplateChange = (value: string) => {
    setForm((current) => ({
      ...current,
      template_type: value,
      template_checklist: JSON.stringify(PROJECT_TEMPLATES[value] || []),
    }));
  };

  const runUrgencyAnalysis = async (projectId?: string) => {
    setUrgencyLoading(projectId || "batch");
    try {
      const res = await fetch("/api/projects/urgent-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectId ? { projectId } : {}),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to analyze urgency");
      await syncFromMemory({ force: true });
      setSelectedProject(null);
    } finally {
      setUrgencyLoading(null);
    }
  };

  const downloadRequiredDocumentsZip = async (shipmentId: string) => {
    if (downloadingRequiredZip[shipmentId]) return;
    setDownloadingRequiredZip((current) => ({ ...current, [shipmentId]: true }));
    try {
      const res = await fetch(`/api/shipments/${encodeURIComponent(shipmentId)}/documents/download-all?group=required`, {
        cache: "no-store",
      });
      if (!res.ok) {
        let message = "Failed to prepare required documents ZIP";
        try {
          const data = await res.json();
          message = data.error || message;
        } catch {
          message = res.statusText || message;
        }
        throw new Error(message);
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileNameFromContentDisposition(
        res.headers.get("content-disposition"),
        `required-documents-${shipmentId}.zip`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to prepare required documents ZIP");
    } finally {
      setDownloadingRequiredZip((current) => {
        const next = { ...current };
        delete next[shipmentId];
        return next;
      });
    }
  };

  const downloadProjectShippingInstruction = async (project: ProjectCard, shipmentRow?: ShipmentDetail) => {
    const row = shipmentRow || project.rows[0];
    let requiredDocsForShipment = row?.id ? (shipmentDocDownloads[row.id] || []) : [];
    if (row?.id && !shipmentDocDownloads[row.id]) {
      try {
        const res = await fetch("/api/shipments/documents/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ shipmentIds: [row.id], group: "required" }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          requiredDocsForShipment = data.documentsByShipment?.[row.id] || [];
          setShipmentDocDownloads((current) => ({ ...current, [row.id]: requiredDocsForShipment }));
        }
      } catch {
        requiredDocsForShipment = [];
      }
    }
    const checklist = parseTemplateChecklist(project.projectRecord?.template_checklist)
      .filter((item) => item.required !== false);
    const docs = checklist.length ? checklist : PROJECT_TEMPLATES.export_shipment;
    const siNo = buildSiNumber(project, row);
    const projectName = pickText(row?.mv_project_name, project.projectName);
    const siTo = pickText(row?.si_to, "PT. FONTANA RESOURCES INDONESIA");
    const shipper = pickText(row?.si_shipper, row?.supplier, row?.source, "PT. FONTANA RESOURCES INDONESIA");
    const consignee = pickText(row?.consignee, project.buyer, row?.buyer);
    const consigneeText = row?.consignee_address ? `${consignee.toUpperCase()}\n${row.consignee_address.toUpperCase()}` : consignee.toUpperCase();
    const notifyParty = pickText(row?.notify_party, consignee);
    const notifyPartyText = row?.notify_party_address ? `${notifyParty.toUpperCase()}\n${row.notify_party_address.toUpperCase()}` : notifyParty.toUpperCase();
    const quantity = safeNum(row?.qty_plan || row?.quantity_loaded || project.volume);
    const nomination = pickText(row?.nomination, row?.barge_name, row?.vessel_name, project.projectName);
    const loadingPort = pickText(row?.jetty_loading_port, row?.loading_port);
    const dischargePort = pickText(row?.discharge_port);
    const laycan = pickText(row?.laycan, project.laycan);
    const shippingTerm = pickText(row?.shipping_term, project.shippingTerm, "CIF");
    const method = pickText(row?.analysis_method, "ASTM");
    const goods = pickText(row?.product, "BATUBARA").toUpperCase();
    const marked = (row?.si_marked?.trim() || '" CLEAN ON BOARD "\n" FREIGHT PAYABLE AS PER CHARTER PARTY "').replace(/;\s*/g, "\n");

    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const left = 54;
    const labelX = 54;
    const colonX = 236;
    const valueX = 246;
    const valueWidth = 290;

    doc.setProperties({ title: `Shipping Instruction - ${projectName}` });
    doc.setFont("helvetica");

    doc.setDrawColor(20, 57, 112);
    doc.setLineWidth(1.4);
    doc.line(36, 86, pageWidth - 36, 86);

    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("SHIPPING INSTRUCTION", pageWidth / 2, 106, { align: "center" });
    doc.setLineWidth(0.4);
    doc.line(pageWidth / 2 - 54, 108, pageWidth / 2 + 54, 108);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(`NO.: ${siNo}`, pageWidth / 2, 118, { align: "center" });

    let y = 143;
    const drawField = (label: string, value: string, emphasis = false) => {
      doc.setFont("helvetica", emphasis ? "bold" : "normal");
      doc.setFontSize(7.5);
      doc.text(label.toUpperCase(), labelX, y);
      doc.text(":", colonX, y);
      const lines = doc.splitTextToSize(value, valueWidth);
      doc.text(lines, valueX, y);
      y += Math.max(11, lines.length * 8.5 + 2);
    };

    doc.setFont("helvetica", "bold");
    doc.text("TO", labelX - 24, y);
    doc.text(":", labelX - 6, y);
    doc.text(siTo.toUpperCase(), labelX + 7, y);
    y += 23;

    drawField("Forecast Sales / From MV", projectName.toUpperCase(), true);
    drawField("Shipper", `${shipper.toUpperCase()}\nQQ PT. MAHAKARYA SENTRA ENERGI`);
    drawField("Consignee", consigneeText);
    drawField("Notify Party", notifyPartyText);
    y += 6;
    drawField("Shipping Term", shippingTerm.toUpperCase());
    drawField("Description of Goods", goods);
    drawField("Marked", marked.toUpperCase());
    drawField("Quantity", qtyText(quantity, row?.quantity_tolerance), true);
    drawField("Barge Nomination", nomination.toUpperCase(), true);
    drawField("Laycan", laycan.toUpperCase());
    drawField("Port of Loading", loadingPort.toUpperCase());
    drawField("Port of Discharge", dischargePort.toUpperCase());
    drawField("Method", method.toUpperCase());

    let docY = Math.max(y + 42, 405);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text("DOCUMENT REQUIRED", labelX + 28, docY);
    doc.line(labelX + 28, docY + 2, labelX + 101, docY + 2);
    docY += 11;

    docs.forEach((item, index) => {
      const code = (item.code || String.fromCharCode(97 + index)).replace(/\.$/, "");
      const uploadedCount = requiredDocsForShipment.filter((doc) => {
        if (doc.documentGroup !== "required") return false;
        const sameCode = (doc.requirementCode || "").toLowerCase() === code.toLowerCase();
        const sameLabel = normalizeKey(doc.requirementLabel || doc.title) === normalizeKey(item.label);
        return sameCode || sameLabel;
      }).length;
      const uploadStatus = uploadedCount > 0
        ? ` (Filled, ${uploadedCount} Document${uploadedCount > 1 ? "s" : ""} Uploaded)`
        : "";
      const label = `${item.label}${uploadStatus}`.toUpperCase();
      const lines = doc.splitTextToSize(label, 480);
      doc.text(`${code}.`, labelX + 10, docY);
      doc.text(lines, labelX + 26, docY);
      docY += Math.max(9.5, lines.length * 8.5);
    });

    doc.save(`shipping-instruction-${slugFile(projectName)}-${slugFile(nomination)}.pdf`);
  };

  const downloadProjectSummaryReport = (project: ProjectCard) => {
    const rows = project.rows;
    const first = rows[0];
    const now = new Date();
    const reportTime = formatSummaryDate(now);
    const roughPnl = parseJsonObject(project.projectRecord?.rough_pnl) as RoughPnlSnapshot | null;
    const blendingScenario = parseJsonObject(project.projectRecord?.blending_scenario);
    const blendingResult = blendingScenario?.result || {};
    const quantity = project.volume || rows.reduce((sum, row) => sum + rowQty(row), 0);
    const bargeCount = (() => {
      const names = new Set(rows.map((row) => pickText(row.nomination, row.barge_name)).filter((value) => value !== "-"));
      return names.size || rows.length || 0;
    })();
    const loadedValues = rows.map((row) => safeNum(row.quantity_loaded || row.qty_cob));
    const dischargedValues = rows.map((row) => safeNum(row.quantity_discharged));
    const timbangValues = rows.map((row) => safeNum(row.qty_cob));
    const totalLoaded = loadedValues.reduce((sum, value) => sum + value, 0);
    const totalDischarged = dischargedValues.reduce((sum, value) => sum + value, 0);
    const totalTimbang = timbangValues.reduce((sum, value) => sum + value, 0);
    const manualOverLoss = rows.reduce((sum, row) => sum + safeNum(row.loss_gain_cargo), 0);
    const overLoss = manualOverLoss || (totalLoaded && totalDischarged ? totalLoaded - totalDischarged : 0);
    const rowActualRevenue = rows.reduce((sum, row) => sum + safeNum(row.quantity_loaded || row.qty_cob || row.qty_plan) * rowSellPrice(row), 0);
    const rowActualCost = rows.reduce((sum, row) => sum + safeNum(row.quantity_loaded || row.qty_cob || row.qty_plan) * rowBuyPrice(row), 0);
    const actualRevenue = rowActualRevenue || safeNum(roughPnl?.revenue) || project.revenue;
    const actualCost = rowActualCost || safeNum(roughPnl?.totalCost);
    const actualProfit = (rowActualRevenue || rowActualCost)
      ? actualRevenue - actualCost
      : safeNum(roughPnl?.estimatedGrossProfit) || project.grossProfit;
    const budgetRevenue = rows.reduce((sum, row) => sum + safeNum(row.qty_plan || row.quantity_loaded || row.qty_cob) * rowSellPrice(row), 0)
      || safeNum(roughPnl?.revenue)
      || actualRevenue;
    const budgetCost = rows.reduce((sum, row) => sum + safeNum(row.qty_plan || row.quantity_loaded || row.qty_cob) * rowBuyPrice(row), 0)
      || safeNum(roughPnl?.totalCost)
      || actualCost;
    const budgetProfit = budgetRevenue - budgetCost || safeNum(roughPnl?.estimatedGrossProfit);
    const specs = {
      tm: avgNonZero(rows.map((row) => row.spec_actual?.tm)) || firstPositive(blendingResult.tm, project.projectRecord?.tm),
      im: avgNonZero(rows.map((row) => row.spec_actual?.im)),
      ash: avgNonZero(rows.map((row) => row.spec_actual?.ash)) || firstPositive(blendingResult.ash, project.projectRecord?.ash),
      vm: firstPositive(project.projectRecord?.vm),
      fc: avgNonZero(rows.map((row) => row.spec_actual?.fc)),
      ts: avgNonZero(rows.map((row) => row.spec_actual?.ts)) || firstPositive(blendingResult.ts, project.projectRecord?.ts),
      adb: avgNonZero(rows.map((row) => row.spec_actual?.adb)),
      gar: avgNonZero(rows.map((row) => row.result_gar || row.spec_actual?.gar)) || firstPositive(blendingResult.gar, project.projectRecord?.gar),
      hgi: avgNonZero(rows.map((row) => row.spec_actual?.hgi)),
      size: cleanText(project.projectRecord?.size) || "-",
    };
    const fmtSpec = (value: number) => safeNum(value).toLocaleString("en-US", { maximumFractionDigits: 2 });
    const approvalStatus = project.projectRecord ? mapMasterStatus(project.projectRecord.status) : project.status;
    const approvedText = approvalStatus === "approved"
      ? `Approved${project.projectRecord?.approved_by_name ? ` by ${project.projectRecord.approved_by_name}` : ""}`
      : "n/a";
    const transhipmentRows = rows.filter((row) => {
      const text = normalizeKey(`${row.shipment_flow || ""} ${row.shipping_term || ""} ${row.status || ""} ${row.shipment_status || ""}`);
      return text.includes("TRANS");
    });
    const transhipmentText = transhipmentRows.length
      ? transhipmentRows.map((row) => `${pickText(row.nomination, row.barge_name)} - ${pickText(row.shipment_status, row.status)}`).join("; ")
      : "No data shipment.";
    const loadNote = pickText(first?.remarks, project.projectRecord?.notes);
    const sailingNote = pickText(first?.operational_info, first?.sent_to_supplier, first?.sent_to_barge_owner);
    const dischargeNote = pickText(first?.issue_notes, first?.status_reason);

    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const left = 36;
    const right = pageWidth - 36;
    const subjectW = 164;
    const detailX = left + subjectW + 44;
    const detailRightX = left + subjectW + 250;
    const detailW = right - detailX;

    doc.setProperties({ title: `Summary Report - ${project.projectName}` });
    doc.setFont("helvetica");
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.text("PT Borneo Pasifik Global", left, 62);
    doc.setFont("helvetica", "normal");
    doc.text("Jl. Pluit Selatan Raya no. 106-107", left, 72);
    doc.text("Jakarta 14440, Indonesia", left, 82);
    doc.text("Telp. 021 22664955, 021 22664746", left, 92);
    doc.setFontSize(14);
    doc.text("SUMMARY", pageWidth / 2, 78, { align: "center" });
    doc.setFont("times", "italic");
    doc.setFontSize(26);
    doc.setTextColor(27, 82, 156);
    doc.text("B", right - 70, 86);
    doc.setTextColor(30, 145, 77);
    doc.text("PG", right - 51, 86);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Subjek", left + subjectW / 2, 150, { align: "center" });
    doc.text("Detail", left + subjectW + (right - left - subjectW) / 2, 150, { align: "center" });
    doc.setDrawColor(190, 190, 190);
    doc.setLineWidth(0.8);
    doc.line(left, 164, right, 164);

    const writeLines = (text: string, x: number, y: number, width = detailW, lineHeight = 8.5) => {
      const lines = doc.splitTextToSize(text, width);
      doc.text(lines, x, y);
      return y + Math.max(lineHeight, lines.length * lineHeight);
    };
    const drawSection = (y: number, height: number, subject: string, drawDetail: (startY: number) => void) => {
      doc.setDrawColor(205, 205, 205);
      doc.setLineWidth(0.6);
      doc.line(left, y, right, y);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.3);
      doc.text(subject, left + subjectW / 2, y + 20, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      drawDetail(y + 20);
      return y + height;
    };
    const drawBudgetChart = (x: number, y: number, width: number, height: number) => {
      const categories = [
        { label: "Revenue", actual: actualRevenue, budget: budgetRevenue },
        { label: "Cost", actual: actualCost, budget: budgetCost },
        { label: "Profit/Loss", actual: actualProfit, budget: budgetProfit },
      ];
      const maxValue = Math.max(1, ...categories.flatMap((item) => [Math.abs(item.actual), Math.abs(item.budget)]));
      const chartBottom = y + height - 18;
      const chartTop = y + 18;
      const chartH = chartBottom - chartTop;
      doc.setFontSize(5.2);
      doc.text("dalam USD", x + 5, y + 9);
      doc.setFillColor(68, 140, 205);
      doc.rect(x + 55, y + 4, 5, 5, "F");
      doc.text("Aktual", x + 63, y + 9);
      doc.setFillColor(220, 220, 220);
      doc.rect(x + 91, y + 4, 5, 5, "F");
      doc.text("Budget", x + 99, y + 9);
      doc.setDrawColor(225, 225, 225);
      for (let i = 0; i <= 5; i += 1) {
        const gy = chartBottom - (chartH / 5) * i;
        doc.line(x + 24, gy, x + width - 6, gy);
      }
      doc.setDrawColor(110, 110, 110);
      doc.line(x + 24, chartTop, x + 24, chartBottom);
      doc.line(x + 24, chartBottom, x + width - 6, chartBottom);
      const groupW = (width - 38) / categories.length;
      categories.forEach((item, index) => {
        const baseX = x + 32 + index * groupW;
        const actualH = (Math.abs(item.actual) / maxValue) * chartH;
        const budgetH = (Math.abs(item.budget) / maxValue) * chartH;
        doc.setFillColor(120, 180, 225);
        doc.rect(baseX, chartBottom - actualH, 18, Math.max(1, actualH), "F");
        doc.setFillColor(220, 220, 220);
        doc.rect(baseX + 21, chartBottom - budgetH, 18, Math.max(1, budgetH), "F");
        doc.setTextColor(32, 72, 180);
        doc.text(String(Math.round(item.actual)), baseX - 1, chartBottom - actualH - 3);
        doc.setTextColor(0, 0, 0);
        doc.text(item.label, baseX - 2, chartBottom + 9);
      });
    };

    let y = 164;
    y = drawSection(y, 76, "Deskripsi Forecast Sales", (startY) => {
      doc.setFont("helvetica", "normal");
      writeLines(`Nama Forecast Sales: ${project.projectName}`, detailX, startY, 175);
      writeLines(`Nama Klien: ${pickText(project.buyer, first?.buyer)}`, detailX, startY + 10, 175);
      writeLines(`Quantity: ${quantity ? `${fmtInt(quantity)} MT` : "n/a"}`, detailX, startY + 20, 175);
      writeLines(`Kalori: ${specs.gar ? fmtSpec(specs.gar) : "n/a"}`, detailX, startY + 30, 175);
      writeLines(`Contract Term: ${pickText(project.shippingTerm, first?.shipping_term, "n/a")}`, detailRightX, startY, 160);
      writeLines(`Destinasi: ${pickText(first?.vessel_name, first?.mv_project_name, first?.discharge_port, "n/a")}`, detailRightX, startY + 10, 160);
      writeLines(`Jumlah Barge: ${bargeCount || "n/a"}`, detailRightX, startY + 20, 160);
    });
    y = drawSection(y, 54, "Spesifikasi", (startY) => {
      writeLines(`TM: ${fmtSpec(specs.tm)} , IM: ${fmtSpec(specs.im)} , ASH: ${fmtSpec(specs.ash)} , VM: ${fmtSpec(specs.vm)} , FC: ${fmtSpec(specs.fc)} , TS: ${fmtSpec(specs.ts)} ,`, detailX, startY, 360);
      writeLines(`ADB: ${fmtSpec(specs.adb)} , GAR: ${fmtSpec(specs.gar)} , HGI: ${fmtSpec(specs.hgi)} , SIZE: ${specs.size}`, detailX, startY + 11, 360);
    });
    y = drawSection(y, 170, "Grafik Budget vs Aktual", (startY) => {
      drawBudgetChart(detailX, startY - 8, 175, 130);
      doc.setFont("helvetica", "italic");
      writeLines(`Aktual sampai ${reportTime}`, detailRightX, startY, 160);
      doc.setFont("helvetica", "normal");
      writeLines(`Pemasukan: ${fmtReportMoney(actualRevenue)}`, detailRightX, startY + 14, 160);
      writeLines(`Pengeluaran: ${fmtReportMoney(actualCost)}`, detailRightX, startY + 24, 160);
      writeLines(`P/L: ${fmtReportMoney(actualProfit)}`, detailRightX, startY + 34, 160);
    });
    y = drawSection(y, 54, "CA Approved", (startY) => {
      writeLines(`Sales Analysis Approved: ${approvedText}`, detailX, startY, 185);
      writeLines("Ops Analysis Approved: n/a", detailX, startY + 11, 185);
      writeLines("Finance Verified: n/a", detailRightX, startY, 160);
      writeLines(`BOD Approved: ${project.projectRecord?.approved_by_name || "n/a"}`, detailRightX, startY + 11, 160);
    });
    y = drawSection(y, 42, "Transhipment", (startY) => {
      writeLines(transhipmentText, detailX, startY, 340);
    });
    y = drawSection(y, 62, "Cargo Over/Loss", (startY) => {
      doc.setFont("helvetica", "bold");
      writeLines(`${overLoss.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MT`, detailX, startY, 120);
      doc.setFont("helvetica", "normal");
      writeLines(`Total cargo loaded: ${totalLoaded ? `${fmtInt(totalLoaded)} MT` : "n/a MT"}`, detailRightX, startY, 170);
      writeLines(`Total cargo discharged: ${totalDischarged ? `${fmtInt(totalDischarged)} MT` : "n/a MT"}`, detailRightX, startY + 11, 170);
      writeLines(`Total cargo timbang: ${totalTimbang ? `${fmtInt(totalTimbang)} MT` : "n/a MT"}`, detailRightX, startY + 22, 170);
    });
    y = drawSection(y, 38, "", (startY) => {
      writeLines(`Catatan Muat: ${loadNote === "-" ? "" : loadNote}`, left + 64, startY, 150);
      writeLines(`Catatan Sailing: ${sailingNote === "-" ? "" : sailingNote}`, detailX, startY, 150);
      writeLines(`Catatan Bongkar: ${dischargeNote === "-" ? "" : dischargeNote}`, detailRightX, startY, 150);
    });
    doc.line(left, y, right, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const reportBy = currentUser?.name || currentUser?.email || "System";
    writeLines(`Report dibuat oleh\n${reportBy}\non ${reportTime}`, detailRightX, y + 18, 160, 9);

    doc.save(`summary-report-${slugFile(project.projectName)}.pdf`);
  };

  const downloadForecastSalesFco = async (project: ProjectCard) => {
    if (downloadingFco) return;
    if (!project.projectRecord) {
      window.alert("FCO hanya tersedia untuk Forecast Sales master record.");
      return;
    }
    if (mapMasterStatus(project.projectRecord.status) !== "approved") {
      window.alert("FCO hanya bisa di-download setelah Offer Profile approved oleh CEO/DIRUT/ASS_DIRUT.");
      return;
    }

    setDownloadingFco(project.id);
    const fcoNumber = buildFcoNumber(project);
    const generatedAt = new Date().toISOString();
    const p = project.projectRecord;
    try {
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const left = 42;
    const right = pageWidth - 42;
    const contentWidth = right - left;
    const labelW = 118;
    let y = 48;

    const fcoDate = formatSummaryDate(new Date()).replace(/:\d{2}$/, "");
    const quantityText = p.quantity ? `${fmtInt(p.quantity)} Metric Tons +/-10%` : "-";
    const laycanText = [p.laycan_start, p.laycan_end].filter(Boolean).map((v) => dateInputValue(v)).join(" - ") || "-";
    const basePriceText = p.target_selling_price
      ? `${fmtUsd(p.target_selling_price)} per Metric Ton basis ${p.gar || "-"} Kcal/Kg GAR`
      : "-";
    const selectedSupplier = selectedSupplierCandidateFor(p);
    const selectedSupplierText = selectedSupplier
      ? [
        selectedSupplier.supplierName,
        selectedSupplier.region ? `Region ${selectedSupplier.region}` : null,
        selectedSupplier.fitScore != null ? `Fit ${selectedSupplier.fitScore}%` : null,
        selectedSupplier.priceUsd ? `Price ${fmtUsd(selectedSupplier.priceUsd)}/MT` : null,
        selectedSupplier.gar ? `GAR ${selectedSupplier.gar}` : null,
        selectedSupplier.tm ? `TM ${selectedSupplier.tm}%` : null,
        selectedSupplier.ts ? `TS ${selectedSupplier.ts}%` : null,
        selectedSupplier.ash ? `Ash ${selectedSupplier.ash}%` : null,
      ].filter(Boolean).join(" | ")
      : pickText(p.supplier_candidates, "To be mutually agreed.");
    const sellerName = "PT BORNEO PASIFIK GLOBAL";
    const buyerName = pickText(p.buyer, "Buyer");

    doc.setProperties({ title: `${fcoNumber} - ${project.projectName}` });

    const ensureSpace = (needed = 48) => {
      if (y + needed <= pageHeight - 54) return;
      doc.addPage();
      y = 48;
    };

    const writeParagraph = (text: string, x = left, width = contentWidth, size = 8.2, lineHeight = 10.5) => {
      ensureSpace(36);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(size);
      const lines = doc.splitTextToSize(text, width);
      doc.text(lines, x, y);
      y += Math.max(lineHeight, lines.length * lineHeight);
    };

    const clause = (letter: string, title: string, value: string, minHeight = 0) => {
      const startY = y;
      ensureSpace(Math.max(28, minHeight));
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.1);
      doc.text(`${letter}.`, left, y);
      doc.text(title.toUpperCase(), left + 18, y);
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(value || "-", contentWidth - labelW - 18);
      doc.text(lines, left + labelW, y);
      y += Math.max(15, lines.length * 10.2, minHeight);
      doc.setDrawColor(235, 235, 235);
      doc.line(left, y - 5, right, y - 5);
      if (y === startY) y += 15;
    };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("FULL CORPORATE OFFER", pageWidth / 2, y, { align: "center" });
    y += 22;
    doc.setFontSize(8.5);
    doc.text("Date", left, y);
    doc.text(":", left + 32, y);
    doc.setFont("helvetica", "normal");
    doc.text(fcoDate, left + 42, y);
    doc.setFont("helvetica", "bold");
    doc.text("To", pageWidth / 2 + 20, y);
    doc.text(":", pageWidth / 2 + 50, y);
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(buyerName, 180), pageWidth / 2 + 60, y);
    y += 14;
    doc.setFont("helvetica", "bold");
    doc.text("No", left, y);
    doc.text(":", left + 32, y);
    doc.setFont("helvetica", "normal");
    doc.text(fcoNumber, left + 42, y);
    doc.setFont("helvetica", "bold");
    doc.text("For Attention", pageWidth / 2 + 20, y);
    doc.text(":", pageWidth / 2 + 80, y);
    doc.setFont("helvetica", "normal");
    doc.text("Purchasing / Commercial Team", pageWidth / 2 + 90, y);
    y += 24;
    doc.setDrawColor(35, 68, 120);
    doc.setLineWidth(0.8);
    doc.line(left, y, right, y);
    y += 20;

    writeParagraph(
      `We, ${sellerName}, hereby declare and confirm that we are ready, willing and capable to sell commodity as specified in the terms and conditions as hereinafter:`,
      left,
      contentWidth,
      8.3,
      11,
    );
    y += 8;

    clause("A", "Commodity", p.commodity || "Indonesian Steam Coal");
    ensureSpace(126);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.1);
    doc.text("B.", left, y);
    doc.text("COAL QUALITY", left + 18, y);
    doc.setFont("helvetica", "normal");
    doc.text("As per ISO / ASTM Standards", left + labelW, y);
    y += 12;
    const tableX = left + labelW;
    const colW = [118, 45, 38, 72, 72];
    const headers = ["PARAMETER", "BASIS", "UNIT", "TYPICAL", "LOWEST LIMIT"];
    const rows = [
      ["Gross Calorific Value", "ARB", "kcal/kg", pickText(p.gar), p.gar ? `Below ${Math.max(0, safeNum(p.gar) - 200)}` : "-"],
      ["Total Moisture", "ARB", "%", p.tm ? `${p.tm}` : "-", "-"],
      ["Inherent Moisture", "ADB", "%", "-", "-"],
      ["Total Sulphur", "ADB", "%", p.ts ? `${p.ts} Max` : "-", "-"],
      ["Ash Content", "ADB", "%", p.ash ? `${p.ash} Max` : "-", "-"],
      ["Volatile Matter", "ADB", "%", p.vm ? `${p.vm} Approx` : "-", "-"],
      ["Fixed Carbon", "ADB", "%", "By Difference", "-"],
      ["HGI", "", "", "-", "-"],
      [`Size ${p.size || "0-50 mm"}`, "", "%", p.size ? "As agreed" : "90", "-"],
    ];
    doc.setFontSize(6.8);
    doc.setFillColor(242, 245, 249);
    doc.rect(tableX, y - 8, colW.reduce((a, b) => a + b, 0), 14, "F");
    let tx = tableX;
    headers.forEach((h, idx) => {
      doc.setFont("helvetica", "bold");
      doc.text(h, tx + 3, y);
      tx += colW[idx];
    });
    y += 12;
    rows.forEach((row) => {
      ensureSpace(14);
      tx = tableX;
      row.forEach((cell, idx) => {
        doc.setFont("helvetica", "normal");
        doc.text(String(cell), tx + 3, y);
        tx += colW[idx];
      });
      y += 10;
    });
    y += 7;

    clause("C", "Origin", "Indonesia");
    clause("D", "Quantity", quantityText);
    clause("E", "Laycan", laycanText);
    clause("F", "Port of Loading", pickText(p.port_of_loading));
    clause("G", "Base Price", basePriceText);
    clause(
      "H",
      "Price Adjustment",
      p.gar
        ? `If actual GAR is above and below ${p.gar} kcal/kg, then the price shall be adjusted as follows: Base Price x Actual GAR / ${p.gar} kcal/kg GAR. No other penalty shall apply.`
        : "To be mutually agreed based on final coal quality.",
      34,
    );
    clause(
      "I",
      "Shipping Terms",
      `${p.sales_term || "FOB"} Geared and Grabbed or Gearless Mother Vessel at Loading Port. Buyer to nominate vessel 7 days before the first day of laycan. Vessel holds shall be clean and ready for loading.`,
      44,
    );
    clause(
      "J",
      "Loading Rate",
      "8,000 MT (Geared and Grabbed) or 10,000 MT (Gearless) PWWD SHINC except Indonesian major holidays. Laytime shall commence 12 hours after free pratique granted at the loading port or when loading commences, whichever is earlier. If vessel tenders NOR outside agreed laycan, berthing/loading shall be subject to availability of berth and coal, and detention/demurrage claims shall follow valid supporting evidence.",
      88,
    );
    clause("K", "Payment Terms", pickText(p.payment_terms), 36);
    clause(
      "L",
      "Independent Surveyor",
      `${pickText(p.surveyor)} mutually agreed by both parties. Buyer sample and certificate challenge procedure shall follow mutually agreed terms and applicable surveyor standards.`,
      44,
    );
    clause("M", "Supplier / Source Reference", [selectedSupplierText, p.notes].filter(Boolean).join("\n") || "To be mutually agreed.", 38);
    clause("N", "Validity", "Subject to cargo unsold.");
    y += 12;
    writeParagraph("We hope that the above offer will meet your requirement and will be the beginning of a long and prosperous relationship.", left, contentWidth, 8.3, 11);
    y += 18;
    writeParagraph("Yours sincerely,", left, contentWidth, 8.3, 11);
    y += 44;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(sellerName, left, y);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated from approved Forecast Sales by ${p.approved_by_name || "Executive"}`, left, y + 14);

    doc.save(`${slugFile(fcoNumber)}-${slugFile(project.projectName)}.pdf`);

    const optimisticRecord = {
      ...p,
      fco_number: fcoNumber,
      fco_generated_at: generatedAt,
    };
    setSelectedProject((current) =>
      current?.id === project.id
        ? { ...current, projectRecord: optimisticRecord }
        : current,
    );

    void updateProject(project.projectRecord.id, {
      fco_number: fcoNumber,
      fco_generated_at: generatedAt,
    } as Partial<ProjectItem>)
      .then(() => syncFromMemory())
      .catch((error: any) => {
        console.error("[forecast-sales] FCO history update failed", error);
        window.alert("PDF sudah ter-download, tapi history FCO gagal tersimpan. Coba refresh lalu cek FCO Control.");
      })
      .finally(() => setDownloadingFco(null));
    } catch (error: any) {
      console.error("[forecast-sales] FCO download failed", error);
      setDownloadingFco(null);
      window.alert(error?.message || "FCO gagal di-download.");
    }
  };

  const uploadProjectDocument = async (project: ProjectItem, index: number, file: File | null) => {
    if (!file) return;
    const key = `${project.id}:${index}`;
    setUploadingDoc(key);
    try {
      const items = parseTemplateChecklist(project.template_checklist);
      if (!items[index]) return;
      const formData = new FormData();
      formData.append("file", file);
      formData.append("requirementCode", items[index]?.code || "");
      formData.append("requirementLabel", items[index]?.label || "Forecast Sales document");
      const res = await fetch(`/api/projects/${project.id}/documents`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Upload failed");

      items[index] = {
        ...items[index],
        done: true,
        fileName: file.name,
        fileUrl: data.url || `/api/projects/${project.id}/documents/${data.document?.id}`,
        uploadedAt: new Date().toISOString(),
        uploadedByName: currentUser?.name || currentUser?.email || "User",
      };
      const nextChecklist = JSON.stringify(items);
      await updateProject(project.id, { template_checklist: nextChecklist });
      setSelectedProject((current) => {
        if (!current?.projectRecord || current.projectRecord.id !== project.id) return current;
        return { ...current, projectRecord: { ...current.projectRecord, template_checklist: nextChecklist } };
      });
      await syncFromMemory({ force: true });
    } catch (error: any) {
      window.alert(error?.message || "Failed to upload document");
    } finally {
      setUploadingDoc(null);
    }
  };

  const toggleTemplateItem = async (project: ProjectItem, index: number) => {
    const items = parseTemplateChecklist(project.template_checklist);
    if (!items[index]) return;
    items[index] = { ...items[index], done: !items[index].done };
    const nextChecklist = JSON.stringify(items);
    await updateProject(project.id, { template_checklist: nextChecklist });
    setSelectedProject((current) => {
      if (!current?.projectRecord || current.projectRecord.id !== project.id) return current;
      return { ...current, projectRecord: { ...current.projectRecord, template_checklist: nextChecklist } };
    });
    await syncFromMemory({ force: true });
  };

  const buildProjectPayload = (statusOverride?: string): Partial<ProjectItem> & Pick<ProjectItem, "name"> => ({
    name: form.name.trim(),
    segment: form.segment.trim(),
    buyer: form.buyer.trim(),
    status: statusOverride || form.status || "draft",
    notes: form.notes.trim(),
    buyer_country: form.buyer_country.trim(),
    commodity: form.commodity.trim(),
    quantity: numericOrUndefined(form.quantity),
    laycan_start: form.laycan_start,
    laycan_end: form.laycan_end,
    port_of_loading: form.port_of_loading.trim(),
    sales_term: form.sales_term.trim(),
    target_selling_price: numericOrUndefined(form.target_selling_price),
    price_basis: form.price_basis.trim(),
    payment_terms: form.payment_terms.trim(),
    surveyor: form.surveyor.trim(),
    gar: numericOrUndefined(form.gar),
    tm: numericOrUndefined(form.tm),
    ts: numericOrUndefined(form.ts),
    ash: numericOrUndefined(form.ash),
    vm: numericOrUndefined(form.vm),
    size: form.size.trim(),
    supplier_candidates: form.supplier_candidates.trim(),
    below_spec_reason: form.below_spec_reason.trim(),
    blending_scenario: form.blending_scenario.trim(),
    template_type: form.template_type,
    template_checklist: form.template_checklist,
  });

  const criticalRevisionChanged = React.useMemo(() => {
    if (!editingProject) return false;
    const current = [
      String(numericOrUndefined(form.quantity) || ""),
      form.laycan_start || "",
      form.laycan_end || "",
      String(numericOrUndefined(form.target_selling_price) || ""),
      form.supplier_candidates.trim(),
    ].join("|");
    const previous = [
      String(editingProject.quantity || ""),
      dateInputValue(editingProject.laycan_start),
      dateInputValue(editingProject.laycan_end),
      String(editingProject.target_selling_price || ""),
      (editingProject.supplier_candidates || "").trim(),
    ].join("|");
    return current !== previous;
  }, [editingProject, form.laycan_end, form.laycan_start, form.quantity, form.supplier_candidates, form.target_selling_price]);

  const missingSubmitFields = () =>
    offerSubmitRequiredFields
      .filter((item) => !String(form[item.key] || "").trim())
      .map((item) => item.label);

  const saveProject = async (statusOverride?: string) => {
    if (!form.name.trim()) return;
    if (statusOverride === "waiting_approval") {
      const missing = missingSubmitFields();
      if (missing.length) {
        window.alert(`Lengkapi mandatory field sebelum Submit Offer Profile:\n- ${missing.join("\n- ")}`);
        return;
      }
      if (selectedCandidateNeedsAcknowledgement && !form.below_spec_reason.trim()) {
        window.alert("Below-spec acknowledgement wajib diisi karena supplier candidate memiliki fit score rendah atau warning.");
        return;
      }
    }
    if (editingProject && criticalRevisionChanged && mapMasterStatus(editingProject.status) !== "draft" && !revisionReason.trim()) {
      window.alert("Revision reason wajib diisi untuk perubahan quantity, laycan, price, atau supplier candidate setelah draft.");
      return;
    }
    setSaving(true);
    try {
      const payload = buildProjectPayload(statusOverride);
      if (revisionReason.trim()) {
        (payload as any).revision_reason = revisionReason.trim();
      }
      if (editingProject) {
        await updateProject(editingProject.id, payload);
      } else {
        await addProject(payload as Omit<ProjectItem, "id" | "created_at" | "updated_at">);
      }
      await syncFromMemory({ force: true });
      setShowForm(false);
      setRevisionReason("");
    } finally {
      setSaving(false);
    }
  };

  const applyApprovalDecision = async () => {
    if (!selectedProject?.projectRecord) return;
    const status = approvalDecision;
    if (!status) {
      setToast({ message: "Pilih status approval terlebih dahulu.", type: "error" });
      return;
    }
    const comment = approvalComment.trim();
    if (status === "rejected" && !comment) {
      setToast({ message: "Reject wajib memakai comment/alasan.", type: "error" });
      return;
    }
    const statusText = status === "approved" ? "Approved" : status === "revision_requested" ? "Revision Requested" : "Rejected";
    setApprovalSaving(true);
    try {
      await updateProject(selectedProject.projectRecord.id, {
        status,
        approval_comment: status === "rejected" ? comment : statusText,
      } as any);
      await syncFromMemory({ force: true });
      setApprovalDecision("");
      setApprovalComment("");
      setSelectedProject(null);
      setToast({ message: `Status changed to ${statusText}.`, type: "success" });
    } catch (error) {
      setToast({ message: "Failed to change approval status.", type: "error" });
    } finally {
      setApprovalSaving(false);
    }
  };

  const linkedShipmentFor = React.useCallback((project: ProjectCard | null) => {
    const projectId = project?.projectRecord?.id;
    if (!projectId) return undefined;
    return shipments.find((shipment) => shipment.forecast_sales_id === projectId);
  }, [shipments]);

  const formatLaycanRange = (project: ProjectItem) => {
    const start = project.laycan_start ? new Date(project.laycan_start).toLocaleDateString("en-GB") : "";
    const end = project.laycan_end ? new Date(project.laycan_end).toLocaleDateString("en-GB") : "";
    return [start, end].filter(Boolean).join(" - ") || undefined;
  };

  const primarySupplierCandidate = (value?: string | null) => {
    const first = String(value || "")
      .split(/\r?\n|;|,/)
      .map((item) => item.trim())
      .find(Boolean);
    return first || undefined;
  };

  const convertForecastSalesToShipment = async (project: ProjectCard, options: { silent?: boolean } = {}) => {
    const record = project.projectRecord;
    if (!record) return;
    if (record.buyer_feedback_status !== "deal" && !options.silent) {
      window.alert("Set buyer feedback ke Deal terlebih dahulu sebelum membuat shipment.");
      return;
    }

    const existing = linkedShipmentFor(project);
    const selectedSupplier = selectedSupplierCandidateFor(record);
    const supplier = selectedSupplier?.supplierName || primarySupplierCandidate(record.supplier_candidates);
    const supplierNotes = selectedSupplier
      ? [
        `Selected supplier: ${selectedSupplier.supplierName}`,
        selectedSupplier.fitScore != null ? `Fit score: ${selectedSupplier.fitScore}%` : null,
        selectedSupplier.priceUsd ? `Price: ${fmtUsd(selectedSupplier.priceUsd)}/MT` : null,
        selectedSupplier.warningText ? `Warning: ${selectedSupplier.warningText}` : null,
      ].filter(Boolean).join(" | ")
      : null;
    const quantity = safeNum(record.quantity);
    const sellingPrice = safeNum(record.target_selling_price);
    const specText = [
      record.gar ? `GAR ${record.gar}` : null,
      record.tm ? `TM ${record.tm}` : null,
      record.ts ? `TS ${record.ts}` : null,
      record.ash ? `ASH ${record.ash}` : null,
      record.vm ? `VM ${record.vm}` : null,
      record.size ? `Size ${record.size}` : null,
    ].filter(Boolean).join(", ");
    const conversionPayload: Partial<ShipmentDetail> = {
      status: "upcoming",
      forecast_sales_id: record.id,
      forecast_sales_name: record.name,
      fco_number: record.fco_number,
      mv_project_name: record.name,
      buyer: record.buyer,
      supplier,
      source: supplier,
      product: record.commodity || "Coal",
      laycan: formatLaycanRange(record),
      qty_plan: quantity || undefined,
      quantity_loaded: quantity || undefined,
      loading_port: record.port_of_loading,
      jetty_loading_port: record.port_of_loading,
      shipping_term: record.sales_term,
      sales_price: sellingPrice || undefined,
      sp: sellingPrice || undefined,
      harga_actual_fob_mv: sellingPrice || undefined,
      surveyor_lhv: record.surveyor,
      result_gar: record.gar,
      type: /dmo|local|domestic/i.test(record.sales_term || "") ? "local" : "export",
      pic: record.created_by_name,
      pic_name: record.created_by_name,
      shipment_status: "Converted from Forecast Sales deal",
      status_reason: "Commercial deal confirmed; waiting operational scheduling.",
      analysis_method: "Forecast Sales conversion",
      source_confirmation_status: selectedSupplier ? "pending" : undefined,
      source_confirmation_notes: supplierNotes || undefined,
      remarks: [
        record.fco_number ? `FCO: ${record.fco_number}` : null,
        record.price_basis ? `Price basis: ${record.price_basis}` : null,
        record.payment_terms ? `Payment: ${record.payment_terms}` : null,
        supplierNotes,
        specText || null,
        record.notes || null,
      ].filter(Boolean).join(" | "),
      year: record.laycan_start ? new Date(record.laycan_start).getFullYear() : new Date().getFullYear(),
    };

    setConvertingShipment(true);
    try {
      if (existing) {
        await updateShipment(existing.id, conversionPayload);
      } else {
        await addShipment(conversionPayload as Omit<ShipmentDetail, "id" | "created_at" | "updated_at">);
      }
      await syncFromMemory({ force: true });
      if (!options.silent) {
        window.alert(existing ? "Shipment berhasil diperbarui dari Forecast Sales." : "Shipment berhasil dibuat dari Forecast Sales.");
      }
    } finally {
      setConvertingShipment(false);
    }
  };

  const updateBuyerFeedback = async (status: string) => {
    if (!selectedProject?.projectRecord) return;
    if (!selectedProject.projectRecord.fco_number && status !== "fco_sent") {
      window.alert("Download/generate FCO terlebih dahulu sebelum update buyer feedback.");
      return;
    }
    const reason = buyerFeedbackReason.trim();
    if (status === "failed" && !reason) {
      window.alert("Reason wajib diisi jika buyer feedback Failed.");
      return;
    }
    await updateProject(selectedProject.projectRecord.id, {
      buyer_feedback_status: status,
      buyer_feedback_reason: status === "failed" ? reason : reason || undefined,
      buyer_feedback_updated_at: new Date().toISOString(),
    });
    if (status === "deal") {
      await convertForecastSalesToShipment(
        {
          ...selectedProject,
          projectRecord: {
            ...selectedProject.projectRecord,
            buyer_feedback_status: "deal",
            buyer_feedback_reason: reason || selectedProject.projectRecord.buyer_feedback_reason,
            buyer_feedback_updated_at: new Date().toISOString(),
          },
        },
        { silent: true },
      );
    } else {
      await syncFromMemory({ force: true });
    }
    setSelectedProject(null);
  };

  return (
    <AppShell>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold border-l-4 border-emerald-500 pl-3">Forecast Sales</h1>
            <p className="text-sm text-muted-foreground mt-1 ml-4">Forecast Sales bisa add/edit dan jadi acuan shipment.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canAnalyzeUrgency && (
              <button
                onClick={() => runUrgencyAnalysis()}
                disabled={urgencyLoading !== null}
                className="btn-outline text-xs h-9"
              >
                {urgencyLoading === "batch" ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5 mr-1.5" />}
                Analyze Urgency
              </button>
            )}
            <button onClick={openCreate} className="btn-primary text-xs h-9"><Plus className="w-3.5 h-3.5 mr-1.5" />Add Forecast Sales</button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-9 pr-4 py-2 w-56 rounded-lg bg-accent/30 border border-border text-xs outline-none focus:border-emerald-500" />
            </div>
            <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="px-3 py-2 rounded-lg bg-accent/30 border border-border text-xs">
              <option value="all">All Year</option>
              {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="px-3 py-2 rounded-lg bg-accent/30 border border-border text-xs">
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="waiting_approval">Waiting Approval</option>
              <option value="revision_requested">Revision</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="upcoming">Upcoming</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 items-start">
          {[
            { key: "total" as const, label: "Total Forecast", value: isInitialForecastLoading ? "..." : fmtInt(forecastDashboard.total), tone: "border-emerald-500/20" },
            { key: "draft" as const, label: "Draft", value: isInitialForecastLoading ? "..." : fmtInt(forecastDashboard.draft), tone: "border-slate-500/20" },
            { key: "waitingApproval" as const, label: "CEO Review", value: isInitialForecastLoading ? "..." : fmtInt(forecastDashboard.waitingApproval), tone: "border-amber-500/25" },
            { key: "approved" as const, label: "Approved", value: isInitialForecastLoading ? "..." : fmtInt(forecastDashboard.approved), tone: "border-blue-500/25" },
            { key: "fcoSent" as const, label: "FCO Sent", value: isInitialForecastLoading ? "..." : fmtInt(forecastDashboard.fcoSent), tone: "border-cyan-500/25" },
            { key: "pendingBuyer" as const, label: "Buyer Pending", value: isInitialForecastLoading ? "..." : fmtInt(forecastDashboard.pendingBuyer), tone: "border-orange-500/25" },
            { key: "deal" as const, label: "Deal", value: isInitialForecastLoading ? "..." : fmtInt(forecastDashboard.deal), tone: "border-emerald-500/25" },
            { key: "failed" as const, label: "Failed", value: isInitialForecastLoading ? "..." : fmtInt(forecastDashboard.failed), tone: "border-rose-500/25" },
          ].map((item) => (
            <div key={item.label} className={cn("self-start rounded-lg border bg-card p-3 min-h-[88px]", item.tone)}>
              <button
                type="button"
                onClick={() => setOpenDashboardBucket((current) => current === item.key ? null : item.key)}
                className="flex w-full items-start justify-between gap-1 text-left"
              >
                <span>
                  <span className="block text-[10px] uppercase font-bold text-muted-foreground leading-tight">{item.label}</span>
                  <span className="mt-2 block text-xl font-bold leading-none">{item.value}</span>
                </span>
                <ChevronDown className={cn("mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", openDashboardBucket === item.key && "rotate-180")} />
              </button>
              {openDashboardBucket === item.key && (
                <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                  {forecastDashboardBuckets[item.key].length === 0 ? (
                    <p className="rounded-md bg-accent/40 px-2 py-2 text-[10px] text-muted-foreground">Tidak ada record.</p>
                  ) : (
                    forecastDashboardBuckets[item.key].slice(0, 8).map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => setSelectedProject(entry.card)}
                        className="w-full rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-left hover:border-primary/40 hover:bg-accent"
                      >
                        <span className="block truncate text-xs font-bold">{entry.projectName}</span>
                        <span className="mt-1 block truncate text-[11px] text-muted-foreground">Buyer: {entry.buyer}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">Offer by: {entry.offerBy}</span>
                        <span className="mt-2 inline-flex rounded-md bg-accent px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">{entry.statusText}</span>
                      </button>
                    ))
                  )}
                  {forecastDashboardBuckets[item.key].length > 8 && (
                    <p className="px-2 pt-1 text-[10px] font-semibold text-muted-foreground">
                      +{forecastDashboardBuckets[item.key].length - 8} more
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
          <div className="self-start rounded-lg border border-violet-500/20 bg-card p-3 min-h-[88px]">
            <p className="text-[10px] uppercase font-bold text-muted-foreground leading-tight">Revenue</p>
            <p className="mt-2 text-lg font-bold leading-none">{isInitialForecastLoading ? "Syncing..." : canApprove ? fmtUsd(forecastDashboard.estimatedRevenue) : "Restricted"}</p>
          </div>
          <div className="self-start rounded-lg border border-fuchsia-500/20 bg-card p-3 min-h-[88px]">
            <p className="text-[10px] uppercase font-bold text-muted-foreground leading-tight">Shipment GP</p>
            <p className="mt-2 text-lg font-bold leading-none">{isInitialForecastLoading ? "Syncing..." : canApprove ? fmtUsd(forecastDashboard.shipmentGrossProfit) : "Restricted"}</p>
          </div>
        </div>

        {isInitialForecastLoading && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="rounded-xl border border-border/60 bg-card p-5 space-y-4 animate-pulse">
                  <div className="flex justify-between gap-3">
                    <div className="space-y-2 flex-1">
                      <div className="h-4 w-2/3 rounded bg-accent" />
                      <div className="h-3 w-1/2 rounded bg-accent/70" />
                    </div>
                    <div className="h-6 w-20 rounded bg-accent" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-12 rounded bg-accent/70" />
                    <div className="h-12 rounded bg-accent/70" />
                    <div className="h-12 rounded bg-accent/70" />
                    <div className="h-12 rounded bg-accent/70" />
                  </div>
                  <div className="h-16 rounded bg-accent/50" />
                </div>
              ))}
            </div>
          </div>
        )}

        {!isInitialForecastLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((p) => (
            <div key={p.id} onClick={() => setSelectedProject(p)} className="card-interactive cursor-pointer p-5 space-y-3">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <h3 className="font-bold text-base truncate">{p.projectName}</h3>
                  <p className="text-[11px] text-muted-foreground">Buyer: {p.buyer} • Segment: {p.segment}</p>
                  {p.projectRecord?.approved_by_name && (
                    <p className="text-[10px] text-muted-foreground">Approved by: {p.projectRecord.approved_by_name}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground">{p.sourceKind === "master" ? "Master forecast sales" : "Derived from shipments"}</p>
                </div>
                <div className="flex items-center gap-1">
                  <span className={statusBadgeClass(p.status)}>{statusLabel[p.status] || p.status}</span>
                  {p.projectRecord?.urgency_level && (
                    <span className={urgencyBadgeClass(p.projectRecord.urgency_level)}>
                      {p.projectRecord.urgency_score || 0}
                    </span>
                  )}
                  {p.projectRecord && (
                    <button onClick={(e) => { e.stopPropagation(); openEdit(p.projectRecord!); }} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground" title="Edit">
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><p className="text-muted-foreground">Volume</p><p className="font-bold">{fmtInt(p.volume)} MT</p></div>
                <div><p className="text-muted-foreground">Revenue</p><p className="font-bold">{fmtUsd(p.revenue)}</p></div>
                <div><p className="text-muted-foreground">Rows</p><p className="font-bold">{fmtInt(p.shipmentCount)}</p></div>
                <div><p className="text-muted-foreground">Year</p><p className="font-bold">{p.year || "-"}</p></div>
              </div>
              {p.projectRecord && (
                <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
                  <p>Term: <span className="font-semibold text-foreground">{p.projectRecord.sales_term || "-"}</span></p>
                  <p>Target: <span className="font-semibold text-foreground">{p.projectRecord.target_selling_price ? fmtUsd(p.projectRecord.target_selling_price) : "-"}</span></p>
                  <p>Basis: <span className="font-semibold text-foreground">{p.projectRecord.price_basis || "-"}</span></p>
                  <p>GAR: <span className="font-semibold text-foreground">{p.projectRecord.gar || "-"}</span></p>
                </div>
              )}
              {p.projectRecord?.template_checklist && (
                <div className="pt-3 border-t border-border/50">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><ClipboardCheck className="w-3 h-3" />Template</span>
                    <span>
                      {parseTemplateChecklist(p.projectRecord.template_checklist).filter((item) => item.done).length}/
                      {parseTemplateChecklist(p.projectRecord.template_checklist).length} done
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        )}

        {!isInitialForecastLoading && filtered.length === 0 && (
          <div className="text-center py-16 px-8 card-elevated border-dashed border-2">
            <FolderKanban className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
            <h3 className="text-lg font-bold mb-1">No Forecast Sales Data</h3>
            <p className="text-sm text-muted-foreground">Tidak ada Forecast Sales yang cocok dengan filter saat ini.</p>
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowForm(false)} />
            <div className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">{editingProject ? "Edit Forecast Sales" : "Add Forecast Sales"}</h2>
                <button onClick={() => setShowForm(false)} className="p-2 rounded-md hover:bg-accent"><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Forecast Sales Name *" className="md:col-span-2 px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm" />
                <input value={form.segment} onChange={(e) => setForm((f) => ({ ...f, segment: e.target.value }))} placeholder="Segment" className="px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm" />
                <input value={form.buyer} onChange={(e) => setForm((f) => ({ ...f, buyer: e.target.value }))} placeholder="Buyer *" className="px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm" />
                <input value={form.buyer_country} onChange={(e) => setForm((f) => ({ ...f, buyer_country: e.target.value }))} placeholder="Buyer Country *" className="px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm" />
                <input value={form.commodity} onChange={(e) => setForm((f) => ({ ...f, commodity: e.target.value }))} placeholder="Commodity *" className="px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm" />
                <input type="number" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} placeholder="Quantity MT *" className="px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm" />
                <input type="date" value={form.laycan_start} onChange={(e) => setForm((f) => ({ ...f, laycan_start: e.target.value }))} className="px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm" />
                <input type="date" value={form.laycan_end} onChange={(e) => setForm((f) => ({ ...f, laycan_end: e.target.value }))} className="px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm" />
                <input value={form.port_of_loading} onChange={(e) => setForm((f) => ({ ...f, port_of_loading: e.target.value }))} placeholder="Port of Loading *" className="px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm" />
                <select value={form.sales_term} onChange={(e) => setForm((f) => ({ ...f, sales_term: e.target.value }))} className="px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm">
                  <option value="FOB">FOB</option>
                  <option value="CIF">CIF</option>
                  <option value="CFR">CFR</option>
                  <option value="FAS">FAS</option>
                  <option value="CNF">CNF</option>
                </select>
                <input type="number" value={form.target_selling_price} onChange={(e) => setForm((f) => ({ ...f, target_selling_price: e.target.value }))} placeholder="Target Price USD/MT *" className="px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm" />
                <select value={form.price_basis} onChange={(e) => setForm((f) => ({ ...f, price_basis: e.target.value }))} className="px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm">
                  <option value="Fixed">Fixed</option>
                  <option value="ICI">ICI</option>
                  <option value="Newcastle">Newcastle</option>
                  <option value="HBA">HBA</option>
                  <option value="Formula">Formula</option>
                </select>
                <input value={form.payment_terms} onChange={(e) => setForm((f) => ({ ...f, payment_terms: e.target.value }))} placeholder="Payment Terms *" className="px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm" />
                <input value={form.surveyor} onChange={(e) => setForm((f) => ({ ...f, surveyor: e.target.value }))} placeholder="Surveyor *" className="px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm" />
                <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm">
                  <option value="draft">Draft</option>
                  <option value="waiting_approval">Waiting Approval</option>
                  {canApprove && <option value="revision_requested">Revision Requested</option>}
                  {canApprove && <option value="approved">Approved</option>}
                  {canApprove && <option value="rejected">Rejected</option>}
                  <option value="upcoming">Upcoming</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <select value={form.template_type} onChange={(e) => handleTemplateChange(e.target.value)} className="px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm">
                  <option value="export_shipment">Export Shipment Template</option>
                  <option value="domestic_delivery">Domestic Delivery Template</option>
                  <option value="spot_purchase">Spot Purchase Template</option>
                </select>
              </div>
              <div className={cn(
                "rounded-xl border p-3",
                priceReference.warning
                  ? "border-amber-500/30 bg-amber-500/10"
                  : "border-emerald-500/20 bg-emerald-500/5",
              )}>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <p className={cn("text-xs font-bold", priceReference.warning ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300")}>
                      Market Price Reference
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {priceReference.market
                        ? `${priceReference.marketLabel} latest ${formatDocDate(priceReference.market.date)} from ${priceReference.market.source || "market price table"}`
                        : "Belum ada market price tersinkron. Reference memakai historical selling price jika tersedia."}
                    </p>
                    {priceReference.warning && (
                      <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Target price lebih rendah dari reference sekitar {Math.abs(priceReference.gapPercent).toFixed(1)}%.
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4 md:min-w-[520px]">
                    <div className="rounded-lg bg-background/70 border border-border/60 p-2">
                      <p className="text-[10px] text-muted-foreground">Target</p>
                      <p className="font-bold">{form.target_selling_price ? fmtUsd(safeNum(form.target_selling_price)) : "-"}/MT</p>
                    </div>
                    <div className="rounded-lg bg-background/70 border border-border/60 p-2">
                      <p className="text-[10px] text-muted-foreground">{priceReference.marketLabel}</p>
                      <p className="font-bold">{priceReference.marketValue ? fmtUsd(priceReference.marketValue) : "-"}/MT</p>
                    </div>
                    <div className="rounded-lg bg-background/70 border border-border/60 p-2">
                      <p className="text-[10px] text-muted-foreground">Historical Avg</p>
                      <p className="font-bold">{priceReference.historicalAverage ? fmtUsd(priceReference.historicalAverage) : "-"}/MT</p>
                      <p className="text-[10px] text-muted-foreground">{priceReference.historicalCount} rows</p>
                    </div>
                    <div className="rounded-lg bg-background/70 border border-border/60 p-2">
                      <p className="text-[10px] text-muted-foreground">Gap</p>
                      <p className={cn("font-bold", priceReference.gap < 0 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300")}>
                        {priceReference.referenceValue && form.target_selling_price ? `${priceReference.gap >= 0 ? "+" : ""}${fmtUsd(priceReference.gap)}` : "-"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{priceReference.referenceValue && form.target_selling_price ? `${priceReference.gapPercent.toFixed(1)}%` : ""}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-accent/20 p-3 space-y-3">
                <p className="text-xs font-bold uppercase text-muted-foreground">Target Coal Specification</p>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  <input type="number" value={form.gar} onChange={(e) => setForm((f) => ({ ...f, gar: e.target.value }))} placeholder="GAR *" className="px-3 py-2 rounded-lg bg-background border border-border text-sm" />
                  <input type="number" value={form.tm} onChange={(e) => setForm((f) => ({ ...f, tm: e.target.value }))} placeholder="TM % *" className="px-3 py-2 rounded-lg bg-background border border-border text-sm" />
                  <input type="number" value={form.ts} onChange={(e) => setForm((f) => ({ ...f, ts: e.target.value }))} placeholder="TS % *" className="px-3 py-2 rounded-lg bg-background border border-border text-sm" />
                  <input type="number" value={form.ash} onChange={(e) => setForm((f) => ({ ...f, ash: e.target.value }))} placeholder="Ash % *" className="px-3 py-2 rounded-lg bg-background border border-border text-sm" />
                  <input type="number" value={form.vm} onChange={(e) => setForm((f) => ({ ...f, vm: e.target.value }))} placeholder="VM %" className="px-3 py-2 rounded-lg bg-background border border-border text-sm" />
                  <input value={form.size} onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))} placeholder="Size" className="px-3 py-2 rounded-lg bg-background border border-border text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <textarea value={form.supplier_candidates} onChange={(e) => setForm((f) => ({ ...f, supplier_candidates: e.target.value }))} rows={3} placeholder="Supplier candidates / source options" className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm resize-none" />
                  <div className="rounded-xl border border-border/60 bg-background/60 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">Source candidates</p>
                      <span className="text-[10px] text-muted-foreground">{sourceCandidateRows.length} ranked</span>
                    </div>
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {sourceCandidateRows.map(({ source, score, warnings }) => (
                        <button
                          key={source.id}
                          type="button"
                          onClick={() => addSourceCandidate(source, score, warnings)}
                          className="w-full text-left rounded-lg border border-border/60 hover:border-emerald-500/50 bg-card p-2 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-bold truncate">{source.name}</p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                {source.region || "-"} | Stock {fmtInt(safeNum(source.stock_available))} MT | GAR {source.spec?.gar || "-"} / TM {source.spec?.tm || "-"} / TS {source.spec?.ts || "-"} / Ash {source.spec?.ash || "-"}
                              </p>
                              {warnings.length > 0 && <p className="text-[10px] text-amber-600 mt-1">{warnings.slice(0, 2).join(", ")}</p>}
                            </div>
                            <span className={cn("shrink-0 text-[10px] font-bold px-2 py-1 rounded-md", score >= 80 ? "bg-emerald-500/10 text-emerald-600" : score >= 60 ? "bg-amber-500/10 text-amber-700" : "bg-rose-500/10 text-rose-600")}>
                              {score}%
                            </span>
                          </div>
                        </button>
                      ))}
                      {sourceCandidateRows.length === 0 && <p className="text-xs text-muted-foreground">Source belum tersedia atau belum tersinkron.</p>}
                    </div>
                    {(editingProject?.id || supplierCandidates.length > 0) && (
                      <div className="pt-2 border-t border-border/60 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] font-bold uppercase text-muted-foreground">Structured candidates</p>
                          <span className="text-[10px] text-muted-foreground">{supplierCandidates.length} saved</span>
                        </div>
                        {supplierCandidates.length === 0 ? (
                          <p className="text-[10px] text-muted-foreground">Klik source candidate untuk menyimpan structured candidate pada Forecast Sales ini.</p>
                        ) : (
                          supplierCandidates.slice(0, 4).map((candidate) => (
                            <div key={candidate.id} className={cn("rounded-lg border p-2 text-xs", candidate.selected ? "border-emerald-500/40 bg-emerald-500/10" : "border-border/60 bg-card")}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-bold truncate">{candidate.supplierName}</p>
                                  <p className="text-[10px] text-muted-foreground truncate">
                                    Fit {candidate.fitScore ?? "-"}% | Stock {fmtInt(safeNum(candidate.stockAvailable))} MT | GAR {candidate.gar || "-"} / TM {candidate.tm || "-"} / TS {candidate.ts || "-"} / Ash {candidate.ash || "-"}
                                  </p>
                                  {candidate.warningText && <p className="text-[10px] text-amber-600 mt-0.5">{candidate.warningText}</p>}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => selectStructuredCandidate(candidate)}
                                  disabled={candidate.selected || candidateAction === `select:${candidate.id}`}
                                  className="shrink-0 rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-50"
                                >
                                  {candidateAction === `select:${candidate.id}` ? "Saving..." : candidate.selected ? "Selected" : "Select"}
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  {selectedCandidateNeedsAcknowledgement && (
                    <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 space-y-2">
                      <p className="text-xs font-bold text-rose-600">Below-Spec Acknowledgement</p>
                      <textarea
                        value={form.below_spec_reason}
                        onChange={(e) => setForm((f) => ({ ...f, below_spec_reason: e.target.value }))}
                        rows={2}
                        placeholder="Jelaskan alasan tetap lanjut dengan kandidat ini, misalnya blending plan, price advantage, stock urgency, atau approval reference."
                        className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm resize-none"
                      />
                    </div>
                  )}
                  <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-blue-600">Blending Simulation</p>
                        <p className="text-[10px] text-muted-foreground">Allocate MT per source candidate to estimate final quality and cost.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const qty = safeNum(form.quantity);
                          const candidates = sourceCandidateRows.slice(0, Math.min(3, sourceCandidateRows.length));
                          if (!qty || !candidates.length) return;
                          const split = Math.floor(qty / candidates.length);
                          const next: Record<string, string> = {};
                          candidates.forEach(({ source }, index) => {
                            next[source.id] = String(index === candidates.length - 1 ? qty - split * (candidates.length - 1) : split);
                          });
                          setBlendQuantities(next);
                        }}
                        className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-background border border-border hover:bg-accent"
                      >
                        Auto split target
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!blendSimulation.totalQty) return;
                          setForm((current) => ({
                            ...current,
                            blending_scenario: JSON.stringify({
                              inputs: blendSimulation.inputs.map(({ source, quantity }) => ({
                                sourceId: source.id,
                                sourceName: source.name,
                                quantity,
                                gar: source.spec?.gar || null,
                                tm: source.spec?.tm || null,
                                ts: source.spec?.ts || null,
                                ash: source.spec?.ash || null,
                                priceUsd: source.fob_barge_price_usd || null,
                              })),
                              result: {
                                totalQty: blendSimulation.totalQty,
                                gar: blendSimulation.gar,
                                tm: blendSimulation.tm,
                                ts: blendSimulation.ts,
                                ash: blendSimulation.ash,
                                avgCost: blendSimulation.avgCost,
                              },
                              warnings: blendSimulation.warnings,
                              savedAt: new Date().toISOString(),
                            }),
                          }));
                        }}
                        disabled={!blendSimulation.totalQty}
                        className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Save scenario
                      </button>
                    </div>
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {sourceCandidateRows.map(({ source, score }) => (
                        <div key={`blend-${source.id}`} className="grid grid-cols-[1fr_104px] gap-2 items-center rounded-lg bg-background/70 border border-border/60 p-2">
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate">{source.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              Fit {score}% | GAR {source.spec?.gar || "-"} / TM {source.spec?.tm || "-"} / TS {source.spec?.ts || "-"} / Ash {source.spec?.ash || "-"} | Cost {source.fob_barge_price_usd ? `$${source.fob_barge_price_usd.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "-"}
                            </p>
                          </div>
                          <input
                            type="number"
                            value={blendQuantities[source.id] || ""}
                            onChange={(e) => setBlendQuantities((current) => ({ ...current, [source.id]: e.target.value }))}
                            placeholder="MT"
                            className="px-2 py-1.5 rounded-md bg-card border border-border text-xs text-right"
                          />
                        </div>
                      ))}
                    </div>
                    {blendSimulation.totalQty > 0 ? (
                      <div className="rounded-lg border border-border/60 bg-card p-3">
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
                          <div><p className="text-[10px] text-muted-foreground">Total</p><p className="font-bold">{fmtInt(blendSimulation.totalQty)} MT</p></div>
                          <div><p className="text-[10px] text-muted-foreground">GAR</p><p className="font-bold">{blendSimulation.gar.toFixed(0)}</p></div>
                          <div><p className="text-[10px] text-muted-foreground">TM</p><p className="font-bold">{blendSimulation.tm.toFixed(2)}%</p></div>
                          <div><p className="text-[10px] text-muted-foreground">TS</p><p className="font-bold">{blendSimulation.ts.toFixed(2)}%</p></div>
                          <div><p className="text-[10px] text-muted-foreground">Ash</p><p className="font-bold">{blendSimulation.ash.toFixed(2)}%</p></div>
                          <div><p className="text-[10px] text-muted-foreground">Avg Cost</p><p className="font-bold">{blendSimulation.avgCost ? `$${blendSimulation.avgCost.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "-"}</p></div>
                        </div>
                        {blendSimulation.warnings.length > 0 && (
                          <p className="text-[10px] text-amber-600 mt-2">{blendSimulation.warnings.join(", ")}</p>
                        )}
                        {form.blending_scenario && (
                          <p className="text-[10px] text-emerald-600 mt-2 font-semibold">Scenario saved to this Forecast Sales draft.</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Enter source quantities to simulate blended quality.</p>
                    )}
                  </div>
                </div>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Internal Notes" className="px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm resize-none" />
              </div>
              {editingProject && criticalRevisionChanged && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                  <p className="text-xs font-bold text-amber-700">Revision Reason</p>
                  <textarea
                    value={revisionReason}
                    onChange={(e) => setRevisionReason(e.target.value)}
                    rows={2}
                    placeholder="Wajib diisi untuk perubahan quantity, laycan, target price, atau supplier candidate setelah draft"
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm resize-none"
                  />
                </div>
              )}
              <div className="rounded-xl border border-border/60 bg-accent/20 p-3 space-y-2">
                <p className="text-xs font-bold flex items-center gap-1.5"><ClipboardCheck className="w-3.5 h-3.5" /> Template Checklist</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {parseTemplateChecklist(form.template_checklist).map((item, index) => (
                    <label key={`${item.label}-${index}`} className="flex gap-2 rounded-lg bg-background/60 border border-border/50 p-2 text-xs">
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => {
                          const items = parseTemplateChecklist(form.template_checklist);
                          items[index] = { ...items[index], done: !items[index].done };
                          setForm((current) => ({ ...current, template_checklist: JSON.stringify(items) }));
                        }}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="font-semibold block">{item.label}</span>
                        <span className="text-[10px] text-muted-foreground">{item.owner}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-border">
                {editingProject ? (
                  <button onClick={async () => {
                    if (!window.confirm("Delete this Forecast Sales record?")) return;
                    await deleteProject(editingProject.id);
                    setShowForm(false);
                  }} className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-semibold hover:bg-red-500/20">
                    <Trash2 className="w-3.5 h-3.5 mr-1.5 inline" />Delete
                  </button>
                ) : <span />}
                <div className="flex gap-2">
                  <button onClick={() => setShowForm(false)} className="px-3 py-2 rounded-lg text-sm hover:bg-accent">Cancel</button>
                  <button onClick={() => saveProject("draft")} disabled={saving || !form.name.trim()} className="px-3 py-2 rounded-lg text-sm font-semibold bg-accent hover:bg-accent/80 disabled:opacity-60">{saving ? "Saving..." : "Save Draft"}</button>
                  <button onClick={() => saveProject("waiting_approval")} disabled={saving || !form.name.trim()} className="btn-primary text-sm px-3 py-2 disabled:opacity-60">{saving ? "Saving..." : "Submit Offer Profile"}</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setSelectedProject(null)} />
            <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div>
                  <h2 className="text-xl font-bold">{selectedProject.projectName}</h2>
                  <p className="text-xs text-muted-foreground">Buyer: {selectedProject.buyer} • Segment: {selectedProject.segment}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => downloadForecastSalesFco(selectedProject)}
                    disabled={downloadingFco === selectedProject.id}
                    className={cn(
                      "px-3 py-2 rounded-lg text-xs font-semibold hover:shadow-md",
                      downloadingFco === selectedProject.id && "opacity-70 cursor-wait",
                      selectedProject.projectRecord && mapMasterStatus(selectedProject.projectRecord.status) === "approved"
                        ? "bg-blue-600 text-white"
                        : "bg-accent text-muted-foreground",
                    )}
                    title="Download FCO PDF"
                  >
                    {downloadingFco === selectedProject.id ? (
                      <Loader2 className="w-3.5 h-3.5 inline mr-1.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5 inline mr-1.5" />
                    )}
                    {downloadingFco === selectedProject.id ? "Preparing..." : "FCO"}
                  </button>
                  <button
                    onClick={() => downloadProjectSummaryReport(selectedProject)}
                    className="px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-500 text-white hover:shadow-md"
                    title="Download Forecast Sales Summary PDF"
                  >
                    <Download className="w-3.5 h-3.5 inline mr-1.5" />
                    Summary
                  </button>
                  <button
                    onClick={() => downloadProjectShippingInstruction(selectedProject)}
                    className="px-3 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:shadow-md"
                    title="Download Shipping Instruction PDF"
                  >
                    <Download className="w-3.5 h-3.5 inline mr-1.5" />
                    SI
                  </button>
                  <button onClick={() => setSelectedProject(null)} className="p-2 rounded-lg hover:bg-accent"><X className="w-4 h-4 text-muted-foreground" /></button>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div className="card-elevated p-3"><p className="text-[10px] text-muted-foreground">Rows</p><p className="font-bold">{fmtInt(selectedProject.shipmentCount)}</p></div>
                  <div className="card-elevated p-3"><p className="text-[10px] text-muted-foreground">Volume</p><p className="font-bold">{fmtInt(selectedProject.volume)} MT</p></div>
                  <div className="card-elevated p-3"><p className="text-[10px] text-muted-foreground">Revenue</p><p className="font-bold">{fmtUsd(selectedProject.revenue)}</p></div>
                  <div className="card-elevated p-3"><p className="text-[10px] text-muted-foreground">Gross Profit</p><p className="font-bold">{fmtUsd(selectedProject.grossProfit)}</p></div>
                </div>
                {selectedProject.projectRecord && (
                  <div className="card-elevated p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Approval Status</p>
                        <div className="flex items-center gap-2">
                          <span className={statusBadgeClass(mapMasterStatus(selectedProject.projectRecord.status))}>
                            {statusLabel[mapMasterStatus(selectedProject.projectRecord.status)]}
                          </span>
                          {selectedProject.projectRecord.approved_by_name && (
                            <span className="text-xs text-muted-foreground">
                              by {selectedProject.projectRecord.approved_by_name}
                            </span>
                          )}
                        </div>
                      </div>
                      {canApprove && (
                        <div className="w-full md:w-auto space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-[minmax(180px,240px)_auto] gap-2">
                            <select
                              value={approvalDecision}
                              onChange={(e) => {
                                const next = e.target.value as ApprovalDecision;
                                setApprovalDecision(next);
                                if (next !== "rejected") setApprovalComment("");
                              }}
                              className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-semibold outline-none focus:border-primary/50"
                            >
                              <option value="">Set Approval</option>
                              <option value="approved">Approve</option>
                              <option value="revision_requested">Request Revision</option>
                              <option value="rejected">Reject</option>
                            </select>
                            <button
                              onClick={applyApprovalDecision}
                              disabled={!approvalDecision || approvalSaving}
                              className="h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {approvalSaving ? <Loader2 className="w-3.5 h-3.5 inline mr-1.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 inline mr-1.5" />}
                              Apply
                            </button>
                          </div>
                          {approvalDecision === "rejected" && (
                            <textarea
                              value={approvalComment}
                              onChange={(e) => setApprovalComment(e.target.value)}
                              rows={2}
                              placeholder="Reject reason wajib diisi"
                              className="w-full md:w-96 px-3 py-2 rounded-lg bg-background border border-border text-xs resize-none"
                            />
                          )}
                          <div className="flex flex-wrap items-center justify-end gap-2">
                          {canAnalyzeUrgency && (
                            <button
                              onClick={() => selectedProject.projectRecord && runUrgencyAnalysis(selectedProject.projectRecord.id)}
                              disabled={urgencyLoading !== null}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/30 hover:bg-blue-500/20"
                            >
                              {urgencyLoading === selectedProject.projectRecord.id ? <Loader2 className="w-3.5 h-3.5 inline mr-1 animate-spin" /> : <Wand2 className="w-3.5 h-3.5 inline mr-1" />}
                              Analyze Urgency
                            </button>
                          )}
                          </div>
                        </div>
                      )}
                    </div>
                    {parseApprovalHistory(selectedProject.projectRecord.approval_history).length > 0 && (
                      <div className="mt-4 pt-4 border-t border-border/60 space-y-2">
                        <p className="text-xs font-bold uppercase text-muted-foreground">Approval History</p>
                        {parseApprovalHistory(selectedProject.projectRecord.approval_history).slice(0, 5).map((item, index) => (
                          <div key={`${item.createdAt}-${index}`} className="rounded-lg bg-accent/30 border border-border/50 p-3 text-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className={statusBadgeClass(mapMasterStatus(item.status))}>{statusLabel[mapMasterStatus(item.status)] || item.status}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {item.userName || "Unknown"} • {formatDocDate(item.createdAt)}
                              </span>
                            </div>
                            {item.comment && <p className="mt-2 text-muted-foreground">{item.comment}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                    {parseRevisionHistory(selectedProject.projectRecord.revision_history).length > 0 && (
                      <div className="mt-4 pt-4 border-t border-border/60 space-y-2">
                        <p className="text-xs font-bold uppercase text-muted-foreground">Revision Log</p>
                        {parseRevisionHistory(selectedProject.projectRecord.revision_history).slice(0, 5).map((item, index) => (
                          <div key={`${item.createdAt}-${index}`} className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 text-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-bold text-amber-700">{item.reason || "Forecast Sales updated"}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {item.userName || "Unknown"} | {formatDocDate(item.createdAt)}
                              </span>
                            </div>
                            <div className="mt-2 space-y-1">
                              {(item.changes || []).slice(0, 6).map((change, changeIndex) => (
                                <p key={`${change.field}-${changeIndex}`} className="text-muted-foreground">
                                  <span className="font-semibold text-foreground">{change.label || change.field}</span>: {change.oldValue || "-"} &rarr; {change.newValue || "-"}
                                </p>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {selectedProject.projectRecord?.below_spec_reason && (
                  <div className="card-elevated p-4 border-rose-500/20 bg-rose-500/5">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-rose-600">Below-Spec Acknowledgement</p>
                        <p className="text-sm text-muted-foreground mt-1">{selectedProject.projectRecord.below_spec_reason}</p>
                      </div>
                      {selectedProject.projectRecord.below_spec_acknowledged_at && (
                        <span className="text-[10px] text-muted-foreground">
                          {selectedProject.projectRecord.below_spec_acknowledged_by_name || "Unknown"} | {formatDocDate(selectedProject.projectRecord.below_spec_acknowledged_at)}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {selectedProject.projectRecord && (
                  <div className="card-elevated p-4">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="text-xs font-bold text-emerald-700">Structured Supplier Candidates</p>
                        <p className="text-xs text-muted-foreground mt-1">Persistent candidate rows from Source, including selected winner and fit warning history.</p>
                      </div>
                      <span className="text-[10px] rounded-md bg-accent px-2 py-1 text-muted-foreground">{supplierCandidates.length} saved</span>
                    </div>
                    {supplierCandidates.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No structured candidate yet. Edit this Forecast Sales and click Source candidates to save them.</p>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                        {supplierCandidates.map((candidate) => (
                          <div key={candidate.id} className={cn("rounded-xl border p-3", candidate.selected ? "border-emerald-500/40 bg-emerald-500/10" : "border-border/60 bg-accent/20")}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-bold truncate">{candidate.supplierName}</p>
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {candidate.region || "-"} | v{candidate.version} | Status {candidate.status}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={cn("rounded-md px-2 py-1 text-[10px] font-bold", safeNum(candidate.fitScore) >= 80 ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-700")}>
                                  {candidate.fitScore ?? "-"}%
                                </span>
                                <button
                                  type="button"
                                  onClick={() => selectStructuredCandidate(candidate)}
                                  disabled={candidate.selected || candidateAction === `select:${candidate.id}`}
                                  className="rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-50"
                                >
                                  {candidate.selected ? "Winner" : "Select"}
                                </button>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-3 text-xs">
                              <div><p className="text-[10px] text-muted-foreground">Stock</p><p className="font-bold">{fmtInt(safeNum(candidate.stockAvailable))}</p></div>
                              <div><p className="text-[10px] text-muted-foreground">GAR</p><p className="font-bold">{candidate.gar || "-"}</p></div>
                              <div><p className="text-[10px] text-muted-foreground">TM</p><p className="font-bold">{candidate.tm || "-"}</p></div>
                              <div><p className="text-[10px] text-muted-foreground">TS</p><p className="font-bold">{candidate.ts || "-"}</p></div>
                              <div><p className="text-[10px] text-muted-foreground">Ash</p><p className="font-bold">{candidate.ash || "-"}</p></div>
                              <div><p className="text-[10px] text-muted-foreground">Price</p><p className="font-bold">{candidate.priceUsd ? `$${candidate.priceUsd}` : "-"}</p></div>
                            </div>
                            {candidate.warningText && <p className="text-[10px] text-amber-600 mt-2">{candidate.warningText}</p>}
                            {candidate.selectedAt && <p className="text-[10px] text-muted-foreground mt-2">Selected by {candidate.selectedByName || "Unknown"} | {formatDocDate(candidate.selectedAt)}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {selectedProject.projectRecord?.blending_scenario && (() => {
                  const scenario = parseJsonObject(selectedProject.projectRecord?.blending_scenario);
                  if (!scenario?.result) return null;
                  return (
                    <div className="card-elevated p-4 border-blue-500/20 bg-blue-500/5">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold text-blue-600">Saved Blending Scenario</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {(scenario.inputs || []).map((input: any) => `${input.sourceName} ${fmtInt(safeNum(input.quantity))} MT`).join(" + ") || "-"}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs min-w-0 md:min-w-[520px]">
                          <div><p className="text-[10px] text-muted-foreground">Total</p><p className="font-bold">{fmtInt(safeNum(scenario.result.totalQty))} MT</p></div>
                          <div><p className="text-[10px] text-muted-foreground">GAR</p><p className="font-bold">{safeNum(scenario.result.gar).toFixed(0)}</p></div>
                          <div><p className="text-[10px] text-muted-foreground">TM</p><p className="font-bold">{safeNum(scenario.result.tm).toFixed(2)}%</p></div>
                          <div><p className="text-[10px] text-muted-foreground">TS</p><p className="font-bold">{safeNum(scenario.result.ts).toFixed(2)}%</p></div>
                          <div><p className="text-[10px] text-muted-foreground">Avg Cost</p><p className="font-bold">{scenario.result.avgCost ? `$${safeNum(scenario.result.avgCost).toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "-"}</p></div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                {selectedProject.projectRecord && (
                  <div className={cn(
                    "card-elevated p-4",
                    canApprove ? "border-emerald-500/20 bg-emerald-500/5" : "border-border/60 bg-accent/20"
                  )}>
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                      <div>
                        <p className={cn("text-xs font-bold", canApprove ? "text-emerald-700" : "text-muted-foreground")}>
                          Restricted Rough P&amp;L
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {canApprove
                            ? (roughPnl?.notes || "Auto generated from Forecast Sales quantity, target selling price, and supplier cost signal.")
                            : "Restricted to executive approval roles."}
                        </p>
                        {canApprove && roughPnl?.selectedSupplierName && (
                          <p className="text-[10px] text-emerald-700 mt-1 font-semibold">
                            Selected supplier: {roughPnl.selectedSupplierName} {roughPnl.selectedSupplierFitScore != null ? `(${roughPnl.selectedSupplierFitScore}% fit)` : ""}
                          </p>
                        )}
                      </div>
                      {canApprove && roughPnl?.generatedAt && (
                        <span className="text-[10px] text-muted-foreground">
                          Generated {formatDocDate(roughPnl.generatedAt)}
                        </span>
                      )}
                    </div>
                    {canApprove ? (
                      roughPnl ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-xs">
                          <div><p className="text-[10px] text-muted-foreground">Revenue</p><p className="font-bold">{fmtUsd(safeNum(roughPnl.revenue))}</p></div>
                          <div><p className="text-[10px] text-muted-foreground">Supplier Price</p><p className="font-bold">{fmtUsd(safeNum(roughPnl.supplierPrice))}/MT</p></div>
                          <div><p className="text-[10px] text-muted-foreground">Variable Cost</p><p className="font-bold">{fmtUsd(safeNum(roughPnl.variableCostPerMt))}/MT</p></div>
                          <div><p className="text-[10px] text-muted-foreground">Total Cost</p><p className="font-bold">{fmtUsd(safeNum(roughPnl.totalCost))}</p></div>
                          <div><p className="text-[10px] text-muted-foreground">Gross Profit</p><p className="font-bold">{fmtUsd(safeNum(roughPnl.estimatedGrossProfit))}</p></div>
                          <div><p className="text-[10px] text-muted-foreground">Margin / MT</p><p className="font-bold">{fmtUsd(safeNum(roughPnl.marginPerMt))}</p></div>
                          <div><p className="text-[10px] text-muted-foreground">Margin %</p><p className="font-bold">{safeNum(roughPnl.marginPercent).toFixed(2)}%</p></div>
                          <div><p className="text-[10px] text-muted-foreground">Quantity</p><p className="font-bold">{fmtInt(safeNum(roughPnl.quantity))} MT</p></div>
                        </div>
                      ) : (
                        <p className="mt-4 text-xs text-muted-foreground">
                          Rough P&amp;L belum terbentuk. Simpan Forecast Sales untuk membuat snapshot otomatis.
                        </p>
                      )
                    ) : null}
                  </div>
                )}
                {selectedProject.projectRecord && (
                  <div className="card-elevated p-4">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">FCO Control</p>
                        <p className="mt-1 text-sm font-bold">{selectedProject.projectRecord.fco_number || "Not generated"}</p>
                        {selectedProject.projectRecord.fco_generated_at && (
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            Last generated {formatDocDate(selectedProject.projectRecord.fco_generated_at)}
                          </p>
                        )}
                      </div>
                      <div className="w-full lg:w-[520px]">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">FCO History</p>
                        <div className="mt-2 max-h-32 space-y-1 overflow-y-auto pr-1">
                          {parseFcoHistory(selectedProject.projectRecord.fco_history).length === 0 ? (
                            <p className="rounded-lg bg-accent/30 px-3 py-2 text-xs text-muted-foreground">
                              Belum ada FCO generation/download history.
                            </p>
                          ) : (
                            parseFcoHistory(selectedProject.projectRecord.fco_history).slice(0, 5).map((item, index) => (
                              <div key={`${item.createdAt}-${index}`} className="rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-xs">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-semibold">{item.fcoNumber || "-"} v{item.version || index + 1}</span>
                                  <span className="text-[10px] uppercase text-muted-foreground">{item.action || "generate"}</span>
                                </div>
                                <p className="mt-1 text-[10px] text-muted-foreground">
                                  {item.userName || "Unknown"} - {formatDocDate(item.createdAt || item.generatedAt)}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {selectedProject.projectRecord && (
                  <div className="card-elevated p-4">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Buyer Feedback</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-md uppercase bg-primary/10 text-primary">
                            {buyerFeedbackLabels[selectedProject.projectRecord.buyer_feedback_status || ""] || "Not Sent"}
                          </span>
                          {selectedProject.projectRecord.buyer_feedback_updated_at && (
                            <span className="text-[10px] text-muted-foreground">
                              Updated {formatDocDate(selectedProject.projectRecord.buyer_feedback_updated_at)}
                            </span>
                          )}
                        </div>
                        {selectedProject.projectRecord.buyer_feedback_reason && (
                          <p className="text-xs text-muted-foreground max-w-xl">{selectedProject.projectRecord.buyer_feedback_reason}</p>
                        )}
                        {parseBuyerFeedbackHistory(selectedProject.projectRecord.buyer_feedback_history).length > 0 && (
                          <div className="mt-3 max-h-32 space-y-1 overflow-y-auto pr-1">
                            {parseBuyerFeedbackHistory(selectedProject.projectRecord.buyer_feedback_history).slice(0, 5).map((item, index) => (
                              <div key={`${item.createdAt}-${index}`} className="rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-xs">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-semibold">{buyerFeedbackLabels[item.status || ""] || item.status || "-"}</span>
                                  <span className="text-[10px] text-muted-foreground">{formatDocDate(item.createdAt)}</span>
                                </div>
                                <p className="mt-1 text-[10px] text-muted-foreground">
                                  {item.userName || "Unknown"}{item.fcoNumber ? ` - ${item.fcoNumber}` : ""}
                                </p>
                                {item.reason && <p className="mt-1 text-[10px] text-muted-foreground">{item.reason}</p>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="w-full lg:w-[460px] space-y-2">
                        <textarea
                          value={buyerFeedbackReason}
                          onChange={(e) => setBuyerFeedbackReason(e.target.value)}
                          rows={2}
                          placeholder="Feedback note / failed reason"
                          className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs resize-none"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => updateBuyerFeedback("fco_sent")} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/30">FCO Sent</button>
                          <button onClick={() => updateBuyerFeedback("waiting_feedback")} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-500/10 text-slate-600 border border-slate-500/30">Waiting</button>
                          <button onClick={() => updateBuyerFeedback("negotiation")} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-700 border border-amber-500/30">Negotiation</button>
                          <button onClick={() => updateBuyerFeedback("deal")} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">Deal</button>
                          <button onClick={() => updateBuyerFeedback("failed")} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/30">Failed</button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            onClick={() => convertForecastSalesToShipment(selectedProject)}
                            disabled={convertingShipment || selectedProject.projectRecord.buyer_feedback_status !== "deal"}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {convertingShipment ? <Loader2 className="w-3.5 h-3.5 inline mr-1.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 inline mr-1.5" />}
                            {linkedShipmentFor(selectedProject) ? "Update Shipment" : "Create Shipment"}
                          </button>
                          {linkedShipmentFor(selectedProject) ? (
                            <a
                              href={`/shipment-monitor?open=${encodeURIComponent(linkedShipmentFor(selectedProject)!.id)}`}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent hover:bg-accent/80 inline-flex items-center gap-1.5"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Open Shipment
                            </a>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">Shipment dibuat otomatis saat status buyer menjadi Deal.</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {selectedProject.projectRecord?.urgency_report && (() => {
                  let report: any = null;
                  try {
                    report = JSON.parse(selectedProject.projectRecord.urgency_report || "{}");
                  } catch {
                    report = null;
                  }
                  if (!report) return null;
                  return (
                    <div className="card-elevated p-4 border-blue-500/20 bg-blue-500/5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-blue-500" /> AI Forecast Sales Urgency</p>
                          <p className="text-sm mt-1 text-muted-foreground">{report.summary}</p>
                        </div>
                        <span className={urgencyBadgeClass(report.level)}>{report.level} {report.score}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                        <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                          <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Factors</p>
                          <ul className="list-disc pl-4 space-y-1">
                            {(report.factors || []).slice(0, 5).map((factor: string, index: number) => (
                              <li key={index} className="text-xs text-muted-foreground">{factor}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                          <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Recommended Action</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">{report.recommendedAction}</p>
                        </div>
                        <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                          <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Document Gaps</p>
                          {(report.documentGaps || []).length > 0 ? (
                            <ul className="list-disc pl-4 space-y-1">
                              {(report.documentGaps || []).slice(0, 5).map((gap: string, index: number) => (
                                <li key={index} className="text-xs text-muted-foreground">{gap}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-muted-foreground">No missing required document detected.</p>
                          )}
                        </div>
                        <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                          <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Commercial Signal</p>
                          <ul className="list-disc pl-4 space-y-1">
                            {(report.commercialSignals || []).slice(0, 4).map((signal: string, index: number) => (
                              <li key={index} className="text-xs text-muted-foreground">{signal}</li>
                            ))}
                          </ul>
                        </div>
                        {(report.decision || report.decisionMemo) && (
                          <div className="md:col-span-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                            <p className="text-[10px] font-bold uppercase text-blue-600 mb-1">Decision Helper</p>
                            <p className="text-xs font-bold text-foreground">
                              {report.decision?.label || report.decisionMemo?.suggestedDecision} - {report.decision?.owner || report.decisionMemo?.owner}
                            </p>
                            {report.decision?.confidence && (
                              <p className="text-[10px] text-blue-600 font-bold mt-1">Confidence: {report.decision.confidence}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">{report.decision?.nextAction || report.decisionMemo?.nextStep}</p>
                            {report.decision?.deadline && <p className="text-[10px] text-muted-foreground mt-1">Deadline: {report.decision.deadline}</p>}
                          </div>
                        )}
                        {(report.dataQuality || report.humanApproval || Array.isArray(report.sourceAttribution)) && (
                          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3">
                            {report.dataQuality && (
                              <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                                <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Data Quality</p>
                                <p className="text-xs font-bold text-foreground">{report.dataQuality.completenessScore ?? 0}% complete</p>
                                {(report.dataQuality.missingFields || []).slice(0, 3).map((field: string, index: number) => (
                                  <p key={index} className="text-[10px] text-muted-foreground mt-1">Missing: {field}</p>
                                ))}
                              </div>
                            )}
                            {report.humanApproval && (
                              <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                                <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Human Approval</p>
                                <p className="text-xs font-bold text-foreground">{report.humanApproval.required ? "Required" : "Not required"}</p>
                                <p className="text-[10px] text-muted-foreground mt-1">{(report.humanApproval.approverRoles || []).join(", ") || "Forecast Sales owner"}</p>
                              </div>
                            )}
                            {Array.isArray(report.sourceAttribution) && (
                              <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                                <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Evidence Sources</p>
                                {report.sourceAttribution.slice(0, 3).map((source: any, index: number) => (
                                  <p key={index} className="text-[10px] text-muted-foreground truncate">
                                    {source.url ? <ExternalLink className="w-3 h-3 inline mr-1" /> : null}
                                    {source.label || source.source} ({source.reliability || "UNKNOWN"})
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
                {selectedProject.projectRecord?.template_checklist && (
                  <div className="card-elevated p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <h4 className="text-sm font-bold flex items-center gap-1.5"><ClipboardCheck className="w-4 h-4 text-primary" /> Required Document Template</h4>
                      <span className="text-[10px] font-semibold text-muted-foreground">Per Shipment</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {parseTemplateChecklist(selectedProject.projectRecord.template_checklist).map((item, index) => (
                        <div key={`${item.label}-${index}`} className="rounded-lg border border-border/50 bg-background/50 p-3 text-xs">
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className={cn("w-4 h-4 mt-0.5", item.done ? "text-emerald-500" : "text-muted-foreground/40")} />
                            <div className="min-w-0">
                              <span className="font-semibold block break-words">{item.code ? `${item.code}. ` : ""}{item.label}</span>
                              <span className="text-[10px] text-muted-foreground">{item.owner}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="card-elevated p-4">
                  <h4 className="text-sm font-bold mb-3">Child Shipment Details</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/60 text-muted-foreground">
                          <th className="text-left py-2 pr-3">Nomination</th>
                          <th className="text-left py-2 pr-3">Jetty/Port</th>
                          <th className="text-left py-2 pr-3">Laycan</th>
                          <th className="text-left py-2 pr-3">Status</th>
                          <th className="text-right py-2 pr-3">Qty</th>
                          <th className="text-left py-2 pr-3">Downloads</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedProject.rows.slice(0, 15).map((r) => {
                          const docs = shipmentDocDownloads[r.id] || [];
                          const isDownloadingZip = Boolean(downloadingRequiredZip[r.id]);
                          const canDownloadRequiredZip = docs.length > 0 && !loadingShipmentDocs && !isDownloadingZip;
                          const duplicateTotals = docs.reduce<Record<string, number>>((acc, doc) => {
                            const key = documentRequirementKey(doc);
                            acc[key] = (acc[key] || 0) + 1;
                            return acc;
                          }, {});
                          const duplicateSeen = new Map<string, number>();
                          return (
                            <tr key={r.id} className="border-b border-border/30 align-top">
                              <td className="py-2 pr-3">{r.nomination || r.barge_name || "-"}</td>
                              <td className="py-2 pr-3">{r.jetty_loading_port || r.loading_port || "-"}</td>
                              <td className="py-2 pr-3">{r.laycan || "-"}</td>
                              <td className="py-2 pr-3">{r.shipment_status || r.status || "-"}</td>
                              <td className="py-2 pr-3 text-right">{fmtInt(rowQty(r))}</td>
                              <td className="py-2 pr-3 min-w-[420px]">
                                <div className="flex flex-wrap items-start gap-2">
                                  <button
                                    onClick={() => downloadProjectShippingInstruction(selectedProject, r)}
                                    className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 text-primary border border-primary/20 px-3 py-2 text-xs font-semibold hover:bg-primary/20"
                                  >
                                    <Download className="w-4 h-4" /> SI
                                  </button>
                                  <button
                                    onClick={() => downloadRequiredDocumentsZip(r.id)}
                                    disabled={!canDownloadRequiredZip}
                                    className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 px-3 py-2 text-xs font-bold hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-300"
                                    title="Download semua required document dalam satu file ZIP"
                                  >
                                    {isDownloadingZip ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : loadingShipmentDocs && docs.length === 0 ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Download className="w-4 h-4" />
                                    )}
                                    {isDownloadingZip ? "Preparing ZIP..." : "All Required ZIP"}
                                  </button>
                                  <details className="group relative">
                                    <summary className={cn(
                                      "list-none inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-semibold hover:bg-accent",
                                      docs.length === 0 && !loadingShipmentDocs && "opacity-70",
                                    )}>
                                      {loadingShipmentDocs ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                                      {loadingShipmentDocs ? "Loading Docs" : `Choose File (${docs.length})`}
                                      <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                                    </summary>
                                    <div className="absolute right-0 top-10 z-20 w-[420px] max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-card p-3 shadow-xl">
                                      <button
                                        onClick={() => downloadRequiredDocumentsZip(r.id)}
                                        disabled={!canDownloadRequiredZip}
                                        className="mb-2 flex w-full items-center justify-between gap-2 rounded-md bg-primary/10 px-3 py-2 text-left text-xs font-bold text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        <span className="inline-flex items-center gap-1.5">
                                          {isDownloadingZip ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                          {isDownloadingZip ? "Preparing ZIP..." : "Download All (.zip)"}
                                        </span>
                                        <span>{isDownloadingZip || loadingShipmentDocs ? "..." : docs.length}</span>
                                      </button>
                                      <div className="max-h-72 overflow-y-auto space-y-1">
                                        {loadingShipmentDocs ? (
                                          <div className="rounded-md border border-border/50 bg-background/70 px-3 py-5 text-center">
                                            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                                            <p className="text-xs font-bold text-foreground">Loading required documents</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">Checking all files for this shipment...</p>
                                          </div>
                                        ) : docs.length === 0 ? (
                                          <div className="rounded-md border border-border/50 bg-background/70 px-3 py-4 text-center">
                                            <FileText className="w-5 h-5 mx-auto mb-2 text-muted-foreground/60" />
                                            <p className="text-xs font-bold text-foreground">No required document yet</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">Upload from Shipment Monitor.</p>
                                          </div>
                                        ) : docs.map((doc) => {
                                          const duplicateKey = documentRequirementKey(doc);
                                          const duplicateIndex = (duplicateSeen.get(duplicateKey) || 0) + 1;
                                          duplicateSeen.set(duplicateKey, duplicateIndex);
                                          const hasDuplicate = duplicateTotals[duplicateKey] > 1;
                                          const title = `${compactDocumentTitle(doc)}${hasDuplicate ? ` #${duplicateIndex}` : ""}`;
                                          return (
                                            <a
                                              key={doc.id}
                                              href={doc.url || `/api/shipments/${r.id}/documents/${doc.id}`}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="flex items-start gap-2 rounded-md px-2.5 py-2.5 text-xs hover:bg-accent"
                                              title={`${doc.title || doc.requirementLabel || "Document"} - ${doc.fileName}`}
                                            >
                                              <FileText className="w-4 h-4 shrink-0 text-muted-foreground mt-0.5" />
                                              <span className="min-w-0 flex-1">
                                                <span className="block truncate font-bold text-foreground">{title}</span>
                                                <span className="block truncate text-[11px] text-muted-foreground">{doc.fileName}</span>
                                                <span className="block text-[11px] text-muted-foreground">
                                                  Uploaded {formatDocDate(doc.createdAt)}
                                                  {hasDuplicate ? ` - ${duplicateIndex} of ${duplicateTotals[duplicateKey]}` : ""}
                                                </span>
                                              </span>
                                              <ExternalLink className="w-3.5 h-3.5 shrink-0 text-muted-foreground mt-0.5" />
                                            </a>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </details>
                                </div>
                                {loadingShipmentDocs && (
                                  <div className="mt-1.5 h-1.5 w-40 overflow-hidden rounded-full bg-accent">
                                    <div className="h-full w-1/2 animate-pulse rounded-full bg-primary/60" />
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
      </div>
    </AppShell>
  );
}
