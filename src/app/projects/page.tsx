"use client";

import React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { cn } from "@/lib/utils";
import { FolderKanban, Search, Plus, X, Edit, Trash2, CheckCircle2, XCircle, Clock3, ClipboardCheck, Wand2, AlertTriangle, Loader2, Download, UploadCloud, FileText, ExternalLink } from "lucide-react";
import { useCommercialStore } from "@/store/commercial-store";
import { useAuthStore } from "@/store/auth-store";
import { ProjectItem, ShipmentDetail } from "@/types";
import { useSearchParams } from "next/navigation";
import { jsPDF } from "jspdf";

type ProjectStatus = "waiting_approval" | "approved" | "rejected" | "upcoming" | "ongoing" | "completed" | "cancelled";

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
  if (!r) return "Unmapped Project";
  return (
    extractProjectName(r.mv_project_name) ||
    extractProjectName(r.vessel_name) ||
    cleanText(r.mv_project_name) ||
    cleanText(r.vessel_name) ||
    "Unmapped Project"
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
  if (key.includes("WAITING") || key.includes("PENDING_APPROVAL") || key.includes("WAITING_APPROVAL")) return "waiting_approval";
  if (key.includes("APPROVE")) return "approved";
  if (key.includes("REJECT")) return "rejected";
  if (key.includes("CANCEL")) return "cancelled";
  if (key.includes("COMPLETE") || key.includes("DONE")) return "completed";
  if (key.includes("LOAD") || key.includes("ONGOING") || key.includes("TRANSIT")) return "ongoing";
  return "upcoming";
};

const statusLabel: Record<ProjectStatus, string> = {
  waiting_approval: "Waiting Approval",
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
    status === "waiting_approval" && "bg-amber-500/10 text-amber-600",
    status === "approved" && "bg-sky-500/10 text-sky-600",
    status === "rejected" && "bg-rose-500/10 text-rose-600",
    status === "completed" && "bg-emerald-500/10 text-emerald-600",
    status === "ongoing" && "bg-indigo-500/10 text-indigo-600",
    status === "upcoming" && "bg-blue-500/10 text-blue-600",
    status === "cancelled" && "bg-red-500/10 text-red-600",
  );

const fmtInt = (n: number): string => safeNum(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
const fmtUsd = (n: number): string => `$${safeNum(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

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
  status: "waiting_approval",
  notes: "",
  template_type: "export_shipment",
  template_checklist: JSON.stringify(PROJECT_TEMPLATES.export_shipment),
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

const qtyText = (value: number) => {
  if (!value) return "-";
  return `${fmtInt(value)} MT +/- 5% (TIDAK BOLEH LEBIH)`;
};

const buildSiNumber = (project: ProjectCard, row?: ShipmentDetail) => {
  const raw = pickText(row?.no_si, row?.shipment_number);
  if (raw !== "-") return raw;
  const date = project.createdAt ? new Date(project.createdAt) : new Date();
  const no = row?.no ? String(row.no).padStart(3, "0") : String(project.projectName.length).padStart(3, "0");
  return `${no} SI-SUPPLIER/${romanMonth(date)}/${date.getFullYear()}`;
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
  const { shipments, projects, syncFromMemory, addProject, updateProject, deleteProject } = useCommercialStore();
  const [, setIsInitializing] = React.useState(false);
  const [search, setSearch] = React.useState(() => searchParams.get("q") || "");
  const [yearFilter, setYearFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState<"all" | ProjectStatus>("all");
  const [selectedProject, setSelectedProject] = React.useState<ProjectCard | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  const [editingProject, setEditingProject] = React.useState<ProjectItem | null>(null);
  const [form, setForm] = React.useState<ProjectForm>(defaultForm);
  const [saving, setSaving] = React.useState(false);
  const [urgencyLoading, setUrgencyLoading] = React.useState<string | null>(null);
  const [uploadingDoc, setUploadingDoc] = React.useState<string | null>(null);
  const role = String(currentUser?.role || "").toUpperCase();
  const canApprove = ["CEO", "DIRUT", "ASS_DIRUT", "COO"].includes(role);
  const canAnalyzeUrgency = ["CEO", "DIRUT", "ASS_DIRUT"].includes(role);

  React.useEffect(() => {
    syncFromMemory().finally(() => setIsInitializing(false));
  }, [syncFromMemory]);
  React.useEffect(() => {
    const q = searchParams.get("q");
    if (q) setSearch(q);
  }, [searchParams]);

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
      const year = years.length ? Math.max(...years) : (p.created_at ? new Date(p.created_at).getFullYear() : null);
      const volume = rows.reduce((s, r) => s + safeNum(r.qty_plan || r.quantity_loaded), 0);
      const revenue = rows.reduce((s, r) => s + safeNum(r.qty_plan || r.quantity_loaded) * safeNum(r.harga_actual_fob_mv || r.sales_price), 0);
      const grossProfit = rows.reduce((s, r) => {
        const qty = safeNum(r.qty_plan || r.quantity_loaded);
        const margin = safeNum(r.margin_mt) || (safeNum(r.harga_actual_fob_mv || r.sales_price) - safeNum(r.harga_actual_fob));
        return s + qty * margin;
      }, 0);
      out.push({
        id: p.id,
        projectKey: key,
        projectName: p.name,
        buyer: cleanText(p.buyer) || cleanText(rows.find((r) => r.buyer)?.buyer) || "-",
        segment: cleanText(p.segment) || "-",
        status: (() => {
          const masterStatus = mapMasterStatus(p.status);
          if (["waiting_approval", "approved", "rejected", "cancelled"].includes(masterStatus)) {
            return masterStatus;
          }
          return rows.length ? detectStatus(rows) : masterStatus;
        })(),
        year,
        laycan: cleanText(rows.find((r) => r.laycan)?.laycan) || "TBA",
        shippingTerm: cleanText(rows.find((r) => r.shipping_term)?.shipping_term) || "-",
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
        volume: rows.reduce((s, r) => s + safeNum(r.qty_plan || r.quantity_loaded), 0),
        revenue: rows.reduce((s, r) => s + safeNum(r.qty_plan || r.quantity_loaded) * safeNum(r.harga_actual_fob_mv || r.sales_price), 0),
        grossProfit: rows.reduce((s, r) => s + safeNum(r.qty_plan || r.quantity_loaded) * (safeNum(r.margin_mt) || (safeNum(r.harga_actual_fob_mv || r.sales_price) - safeNum(r.harga_actual_fob))), 0),
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

  const openCreate = () => {
    setEditingProject(null);
    setForm({ ...defaultForm });
    setShowForm(true);
  };

  const openEdit = (p: ProjectItem) => {
    setEditingProject(p);
    setForm({
      name: p.name || "",
      segment: p.segment || "",
      buyer: p.buyer || "",
      status: p.status || "waiting_approval",
      notes: p.notes || "",
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

  const downloadProjectShippingInstruction = (project: ProjectCard) => {
    const row = project.rows[0];
    const checklist = parseTemplateChecklist(project.projectRecord?.template_checklist)
      .filter((item) => item.required !== false);
    const docs = checklist.length ? checklist : PROJECT_TEMPLATES.export_shipment;
    const siNo = buildSiNumber(project, row);
    const shipper = pickText(row?.supplier, row?.source, "PT. FONTANA RESOURCES INDONESIA");
    const consignee = pickText(project.buyer, row?.buyer);
    const notifyParty = consignee;
    const quantity = safeNum(row?.qty_plan || row?.quantity_loaded || project.volume);
    const nomination = pickText(row?.nomination, row?.barge_name, row?.vessel_name, project.projectName);
    const loadingPort = pickText(row?.jetty_loading_port, row?.loading_port);
    const dischargePort = pickText(row?.discharge_port);
    const laycan = pickText(row?.laycan, project.laycan);
    const shippingTerm = pickText(row?.shipping_term, project.shippingTerm, "CIF");
    const method = pickText(row?.analysis_method, "ASTM");
    const goods = pickText(row?.product, "BATUBARA").toUpperCase();

    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const left = 54;
    const labelX = 54;
    const colonX = 236;
    const valueX = 246;
    const valueWidth = 290;

    doc.setProperties({ title: `Shipping Instruction - ${project.projectName}` });
    doc.setFont("helvetica");

    // Compact vector mark approximating the company logo placement in the reference SI.
    doc.setFillColor(0, 143, 181);
    doc.roundedRect(left, 45, 16, 12, 2, 2, "F");
    doc.setFillColor(23, 73, 145);
    doc.roundedRect(left + 13, 45, 16, 12, 2, 2, "F");
    doc.setFillColor(229, 57, 53);
    doc.roundedRect(left + 26, 51, 22, 10, 2, 2, "F");
    doc.setFontSize(4.5);
    doc.setTextColor(30, 64, 114);
    doc.text("PT MAHAKARYA SENTRA ENERGI", left, 68);

    doc.setFontSize(5.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 64, 114);
    doc.text("PT MAHAKARYA SENTRA ENERGI", 410, 43);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text("Jalan Pulau Saliara Raya No. 106, Pluit,", 410, 51);
    doc.text("Penjaringan, Jakarta Utara 14450, Indonesia", 410, 58);
    doc.text("Tel: +62 21 66660996, +62 21 66660990", 410, 65);

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
    doc.text(shipper.toUpperCase(), labelX + 7, y);
    y += 23;

    drawField("Shipper", `${shipper.toUpperCase()}\nQQ PT. MAHAKARYA SENTRA ENERGI`);
    drawField("Consignee", consignee.toUpperCase());
    drawField("Notify Party", notifyParty.toUpperCase());
    y += 6;
    drawField("Shipping Term", shippingTerm.toUpperCase());
    drawField("Description of Goods", goods);
    drawField("Marked", '" CLEAN ON BOARD "\n" FREIGHT PAYABLE AS PER CHARTER PARTY "');
    drawField("Quantity", qtyText(quantity), true);
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
      const label = item.label.toUpperCase();
      const lines = doc.splitTextToSize(label, 480);
      doc.text(`${code}.`, labelX + 10, docY);
      doc.text(lines, labelX + 26, docY);
      docY += Math.max(9.5, lines.length * 8.5);
    });

    doc.save(`shipping-instruction-${slugFile(project.projectName)}.pdf`);
  };

  const uploadProjectDocument = async (project: ProjectItem, index: number, file: File | null) => {
    if (!file) return;
    const key = `${project.id}:${index}`;
    setUploadingDoc(key);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Upload failed");

      const items = parseTemplateChecklist(project.template_checklist);
      if (!items[index]) return;
      items[index] = {
        ...items[index],
        done: true,
        fileName: file.name,
        fileUrl: data.url,
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

  const saveProject = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editingProject) {
        await updateProject(editingProject.id, { ...form, name: form.name.trim() });
      } else {
        await addProject({ ...form, name: form.name.trim() } as Omit<ProjectItem, "id" | "created_at" | "updated_at">);
      }
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold border-l-4 border-emerald-500 pl-3">Projects (MV/Project Centric)</h1>
            <p className="text-sm text-muted-foreground mt-1 ml-4">Project sudah bisa add/edit dan jadi acuan shipment.</p>
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
            <button onClick={openCreate} className="btn-primary text-xs h-9"><Plus className="w-3.5 h-3.5 mr-1.5" />Add Project</button>
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
              <option value="waiting_approval">Waiting Approval</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="upcoming">Upcoming</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

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
                  <p className="text-[10px] text-muted-foreground">{p.sourceKind === "master" ? "Master project" : "Derived from shipments"}</p>
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

        {filtered.length === 0 && (
          <div className="text-center py-16 px-8 card-elevated border-dashed border-2">
            <FolderKanban className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
            <h3 className="text-lg font-bold mb-1">No Project Data</h3>
            <p className="text-sm text-muted-foreground">Tidak ada project yang cocok dengan filter saat ini.</p>
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowForm(false)} />
            <div className="relative w-full max-w-xl rounded-2xl bg-card border border-border shadow-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">{editingProject ? "Edit Project" : "Add Project"}</h2>
                <button onClick={() => setShowForm(false)} className="p-2 rounded-md hover:bg-accent"><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Project Name *" className="md:col-span-2 px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm" />
                <input value={form.segment} onChange={(e) => setForm((f) => ({ ...f, segment: e.target.value }))} placeholder="Segment" className="px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm" />
                <input value={form.buyer} onChange={(e) => setForm((f) => ({ ...f, buyer: e.target.value }))} placeholder="Buyer" className="px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm" />
                <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm">
                  <option value="waiting_approval">Waiting Approval</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
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
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Notes" className="md:col-span-2 px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm resize-none" />
              </div>
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
                    if (!window.confirm("Delete this project?")) return;
                    await deleteProject(editingProject.id);
                    setShowForm(false);
                  }} className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-semibold hover:bg-red-500/20">
                    <Trash2 className="w-3.5 h-3.5 mr-1.5 inline" />Delete
                  </button>
                ) : <span />}
                <div className="flex gap-2">
                  <button onClick={() => setShowForm(false)} className="px-3 py-2 rounded-lg text-sm hover:bg-accent">Cancel</button>
                  <button onClick={saveProject} disabled={saving || !form.name.trim()} className="btn-primary text-sm px-3 py-2 disabled:opacity-60">{saving ? "Saving..." : "Save Project"}</button>
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
                    onClick={() => downloadProjectShippingInstruction(selectedProject)}
                    className="px-3 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:shadow-md"
                    title="Download Shipping Instruction PDF"
                  >
                    <Download className="w-3.5 h-3.5 inline mr-1.5" />
                    Download PDF
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
                        <div className="flex flex-wrap items-center gap-2">
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
                          <button
                            onClick={async () => {
                              if (!selectedProject.projectRecord) return;
                              await updateProject(selectedProject.projectRecord.id, { status: "approved" });
                              await syncFromMemory({ force: true });
                              setSelectedProject(null);
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 hover:bg-emerald-500/20"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                            Approve
                          </button>
                          <button
                            onClick={async () => {
                              if (!selectedProject.projectRecord) return;
                              await updateProject(selectedProject.projectRecord.id, { status: "rejected" });
                              await syncFromMemory({ force: true });
                              setSelectedProject(null);
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/30 hover:bg-rose-500/20"
                          >
                            <XCircle className="w-3.5 h-3.5 inline mr-1" />
                            Reject
                          </button>
                          <button
                            onClick={async () => {
                              if (!selectedProject.projectRecord) return;
                              await updateProject(selectedProject.projectRecord.id, { status: "waiting_approval" });
                              await syncFromMemory({ force: true });
                              setSelectedProject(null);
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-700 border border-amber-500/30 hover:bg-amber-500/20"
                          >
                            <Clock3 className="w-3.5 h-3.5 inline mr-1" />
                            Set Waiting
                          </button>
                        </div>
                      )}
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
                          <p className="text-xs font-bold flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-blue-500" /> AI Project Urgency</p>
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
                        {report.decisionMemo && (
                          <div className="md:col-span-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                            <p className="text-[10px] font-bold uppercase text-blue-600 mb-1">Consultant Decision Memo</p>
                            <p className="text-xs font-bold text-foreground">{report.decisionMemo.suggestedDecision} - {report.decisionMemo.owner}</p>
                            <p className="text-xs text-muted-foreground mt-1">{report.decisionMemo.nextStep}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
                {selectedProject.projectRecord?.template_checklist && (
                  <div className="card-elevated p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <h4 className="text-sm font-bold flex items-center gap-1.5"><ClipboardCheck className="w-4 h-4 text-primary" /> Project Document Requirements</h4>
                      <button
                        onClick={() => downloadProjectShippingInstruction(selectedProject)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
                      >
                        <Download className="w-3.5 h-3.5 inline mr-1" />
                        Shipping Instruction PDF
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {parseTemplateChecklist(selectedProject.projectRecord.template_checklist).map((item, index) => {
                        const inputId = `project-doc-${selectedProject.projectRecord!.id}-${index}`;
                        const uploadKey = `${selectedProject.projectRecord!.id}:${index}`;
                        return (
                          <div
                            key={`${item.label}-${index}`}
                            className={cn(
                              "rounded-lg border p-3 text-xs transition-colors space-y-2",
                              item.done ? "border-emerald-500/30 bg-emerald-500/10" : "border-border/50 bg-background/50",
                            )}
                          >
                            <div className="flex items-start gap-2">
                              <button
                                type="button"
                                onClick={() => selectedProject.projectRecord && toggleTemplateItem(selectedProject.projectRecord, index)}
                                className="mt-0.5"
                                title="Toggle completed"
                              >
                                <CheckCircle2 className={cn("w-4 h-4", item.done ? "text-emerald-500" : "text-muted-foreground/40")} />
                              </button>
                              <div className="min-w-0 flex-1">
                                <span className="font-semibold block break-words">{item.code ? `${item.code}. ` : ""}{item.label}</span>
                                <span className="text-[10px] text-muted-foreground">{item.owner}</span>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 pl-6">
                              {item.fileUrl ? (
                                <a
                                  href={item.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex max-w-full items-center gap-1 rounded-md bg-background/70 border border-border px-2 py-1 text-[10px] font-semibold text-foreground hover:bg-accent"
                                >
                                  <FileText className="w-3 h-3 shrink-0" />
                                  <span className="truncate max-w-[180px]">{item.fileName || "Uploaded document"}</span>
                                  <ExternalLink className="w-3 h-3 shrink-0 text-muted-foreground" />
                                </a>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">No document uploaded</span>
                              )}
                              <input
                                id={inputId}
                                type="file"
                                className="hidden"
                                accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx,.csv"
                                onChange={(e) => {
                                  const file = e.currentTarget.files?.[0] || null;
                                  uploadProjectDocument(selectedProject.projectRecord!, index, file);
                                  e.currentTarget.value = "";
                                }}
                              />
                              <label
                                htmlFor={inputId}
                                className={cn(
                                  "inline-flex cursor-pointer items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-semibold hover:bg-accent",
                                  uploadingDoc === uploadKey && "pointer-events-none opacity-60",
                                )}
                              >
                                {uploadingDoc === uploadKey ? <Loader2 className="w-3 h-3 animate-spin" /> : <UploadCloud className="w-3 h-3" />}
                                {item.fileUrl ? "Replace" : "Upload"}
                              </label>
                            </div>
                            {item.uploadedAt && (
                              <p className="pl-6 text-[10px] text-muted-foreground">
                                Uploaded {new Date(item.uploadedAt).toLocaleDateString("id-ID")} by {item.uploadedByName || "-"}
                              </p>
                            )}
                          </div>
                        );
                      })}
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
                        </tr>
                      </thead>
                      <tbody>
                        {selectedProject.rows.slice(0, 15).map((r) => (
                          <tr key={r.id} className="border-b border-border/30">
                            <td className="py-2 pr-3">{r.nomination || r.barge_name || "-"}</td>
                            <td className="py-2 pr-3">{r.jetty_loading_port || r.loading_port || "-"}</td>
                            <td className="py-2 pr-3">{r.laycan || "-"}</td>
                            <td className="py-2 pr-3">{r.shipment_status || r.status || "-"}</td>
                            <td className="py-2 pr-3 text-right">{fmtInt(safeNum(r.qty_plan || r.quantity_loaded))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
