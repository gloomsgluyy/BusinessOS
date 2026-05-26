"use client";

import React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useCommercialStore } from "@/store/commercial-store";
import { cn } from "@/lib/utils";
import {
    FlaskConical, CheckCircle, XCircle, Clock, AlertTriangle,
    Plus, X, Search, Download, Loader2, Pencil, Trash2, TriangleAlert, ShieldCheck, Upload, ExternalLink
} from "lucide-react";
import { ReportModal } from "@/components/shared/report-modal";
import { Toast } from "@/components/shared/toast";
import { ModulePageSkeleton } from "@/components/shared/module-page-skeleton";
import type { CoalSpec, QualityResult } from "@/types";

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    pending: { label: "Pending", color: "#f59e0b", icon: Clock },
    passed: { label: "Passed", color: "#10b981", icon: CheckCircle },
    warning: { label: "Warning", color: "#f97316", icon: AlertTriangle },
    need_review: { label: "Need Review", color: "#8b5cf6", icon: AlertTriangle },
    claim_potential: { label: "Claim Potential", color: "#dc2626", icon: TriangleAlert },
    rejected: { label: "Rejected", color: "#ef4444", icon: XCircle },
    on_hold: { label: "On Hold", color: "#6b7280", icon: AlertTriangle },
};

const SPEC_FIELDS: Array<{ key: keyof CoalSpec; label: string; step: number; placeholder: string }> = [
    { key: "gar", label: "GAR", step: 1, placeholder: "4200" },
    { key: "ts", label: "TS %", step: 0.01, placeholder: "0.8" },
    { key: "ash", label: "Ash %", step: 0.01, placeholder: "5.0" },
    { key: "tm", label: "TM %", step: 0.01, placeholder: "30" },
];

type SpecForm = Record<keyof CoalSpec, string>;

type QualityForm = {
    cargo_id: string;
    cargo_name: string;
    surveyor: string;
    sampling_date: string;
    spec_result: SpecForm;
    contract_spec: SpecForm;
    source_estimate: SpecForm;
    qc_result: SpecForm;
    qc_document_id: string;
    psi_result: SpecForm;
    psi_document_id: string;
    coa_pol_result: SpecForm;
    coa_pol_document_id: string;
    coa_pod_result: SpecForm;
    coa_pod_document_id: string;
    comparison_status: string;
    warning_notes: string;
    status: string;
};

const blankSpec = (): SpecForm => ({ gar: "", ts: "", ash: "", tm: "", im: "", fc: "", hgi: "", adb: "", nar: "" });

const EMPTY_FORM: QualityForm = {
    cargo_id: "",
    cargo_name: "",
    surveyor: "",
    sampling_date: "",
    spec_result: { ...blankSpec(), gar: "4200", ts: "0.8", ash: "5.0", tm: "30" },
    contract_spec: blankSpec(),
    source_estimate: blankSpec(),
    qc_result: blankSpec(),
    qc_document_id: "",
    psi_result: blankSpec(),
    psi_document_id: "",
    coa_pol_result: blankSpec(),
    coa_pol_document_id: "",
    coa_pod_result: blankSpec(),
    coa_pod_document_id: "",
    comparison_status: "",
    warning_notes: "",
    status: "pending",
};

function specToForm(spec?: Partial<CoalSpec> | null): SpecForm {
    const next = blankSpec();
    for (const field of SPEC_FIELDS) {
        const value = spec?.[field.key];
        next[field.key] = value === null || value === undefined ? "" : String(value);
    }
    return next;
}

function specFromForm(spec: SpecForm): CoalSpec | undefined {
    const next: Partial<CoalSpec> = {};
    for (const field of SPEC_FIELDS) {
        const raw = spec[field.key];
        if (raw === "" || raw === undefined || raw === null) continue;
        const numeric = Number(raw);
        if (Number.isFinite(numeric)) next[field.key] = numeric;
    }
    return Object.keys(next).length ? next as CoalSpec : undefined;
}

function hasSpec(spec?: Partial<CoalSpec>) {
    return !!spec && SPEC_FIELDS.some((field) => spec[field.key] !== undefined && spec[field.key] !== null);
}

function formatDate(value?: string) {
    if (!value) return "-";
    try {
        return new Date(value).toLocaleDateString("en", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
        return value;
    }
}

function formatSpec(spec?: Partial<CoalSpec>) {
    if (!hasSpec(spec)) return "-";
    return SPEC_FIELDS
        .filter((field) => spec?.[field.key] !== undefined && spec?.[field.key] !== null)
        .map((field) => `${field.label}: ${spec?.[field.key]}`)
        .join(" | ");
}

export default function QualityPage() {
    const [isInitializing, setIsInitializing] = React.useState(true);
    const { qualityResults, syncFromMemory, addQualityResult, updateQualityResult, shipments } = useCommercialStore();

    React.useEffect(() => {
        setIsInitializing(true);
        Promise.all([syncFromMemory()]).finally(() => setIsInitializing(false));
    }, [syncFromMemory]);

    const [mode, setMode] = React.useState<"idle" | "add" | "edit">("idle");
    const [editingId, setEditingId] = React.useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = React.useState<{ id: string; name: string } | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [toast, setToast] = React.useState<{ message: string; type: "success" | "error" } | null>(null);
    const [search, setSearch] = React.useState("");
    const [showReportModal, setShowReportModal] = React.useState(false);
    const [filterStatus, setFilterStatus] = React.useState<string>("all");
    const [form, setForm] = React.useState<QualityForm>(EMPTY_FORM);
    const [docFiles, setDocFiles] = React.useState<Record<"qc" | "psi" | "coa_pol" | "coa_pod", File | null>>({
        qc: null,
        psi: null,
        coa_pol: null,
        coa_pod: null,
    });

    const showToast = (message: string, type: "success" | "error") => setToast({ message, type });

    const setSpecField = (section: keyof Pick<QualityForm, "spec_result" | "contract_spec" | "source_estimate" | "qc_result" | "psi_result" | "coa_pol_result" | "coa_pod_result">, key: keyof CoalSpec, value: string) => {
        setForm((current) => ({ ...current, [section]: { ...current[section], [key]: value } }));
    };

    const openAdd = () => {
        setForm({ ...EMPTY_FORM, spec_result: { ...EMPTY_FORM.spec_result }, contract_spec: blankSpec(), source_estimate: blankSpec(), qc_result: blankSpec(), psi_result: blankSpec(), coa_pol_result: blankSpec(), coa_pod_result: blankSpec() });
        setDocFiles({ qc: null, psi: null, coa_pol: null, coa_pod: null });
        setEditingId(null);
        setMode("add");
    };

    const openEdit = (q: QualityResult) => {
        setForm({
            cargo_id: q.cargo_id || "",
            cargo_name: q.cargo_name || "",
            surveyor: q.surveyor || "",
            sampling_date: q.sampling_date ? q.sampling_date.split("T")[0] : "",
            spec_result: specToForm(q.spec_result),
            contract_spec: specToForm(q.contract_spec),
            source_estimate: specToForm(q.source_estimate),
            qc_result: specToForm(q.qc_result),
            qc_document_id: q.qc_document_id || "",
            psi_result: specToForm(q.psi_result),
            psi_document_id: q.psi_document_id || "",
            coa_pol_result: specToForm(q.coa_pol_result),
            coa_pol_document_id: q.coa_pol_document_id || "",
            coa_pod_result: specToForm(q.coa_pod_result),
            coa_pod_document_id: q.coa_pod_document_id || "",
            comparison_status: q.comparison_status || "",
            warning_notes: q.warning_notes || "",
            status: q.status || "pending",
        });
        setDocFiles({ qc: null, psi: null, coa_pol: null, coa_pod: null });
        setEditingId(q.id);
        setMode("edit");
    };

    const closeForm = () => { setMode("idle"); setEditingId(null); };

    const uploadQualityDocument = async (file: File, kind: "qc" | "psi" | "coa_pol" | "coa_pod") => {
        if (!form.cargo_id) throw new Error("Linked shipment is required before uploading quality documents");
        const meta = {
            qc: { code: "QUALITY_QC", label: "Quality QC Result", title: "QC Result" },
            psi: { code: "QUALITY_PSI", label: "Quality PSI Result", title: "PSI Result" },
            coa_pol: { code: "QUALITY_COA_POL", label: "COA POL", title: "COA POL" },
            coa_pod: { code: "QUALITY_COA_POD", label: "COA POD", title: "COA POD" },
        }[kind];
        const formData = new FormData();
        formData.append("file", file);
        formData.append("documentGroup", "additional");
        formData.append("requirementCode", meta.code);
        formData.append("requirementLabel", meta.label);
        formData.append("title", `${meta.title} - ${form.cargo_name || form.cargo_id}`);
        formData.append("status", "received");
        formData.append("notes", `Linked from Quality module for ${form.cargo_name || form.cargo_id}`);

        const res = await fetch(`/api/shipments/${form.cargo_id}/documents`, { method: "POST", body: formData });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to upload quality document");
        return data.document?.id as string | undefined;
    };

    const handleSubmit = async () => {
        if (!form.cargo_name.trim()) return showToast("Cargo name is required", "error");
        setIsSaving(true);
        try {
            let qcDocumentId = form.qc_document_id;
            let psiDocumentId = form.psi_document_id;
            let coaPolDocumentId = form.coa_pol_document_id;
            let coaPodDocumentId = form.coa_pod_document_id;
            if (docFiles.qc) qcDocumentId = await uploadQualityDocument(docFiles.qc, "qc") || qcDocumentId;
            if (docFiles.psi) psiDocumentId = await uploadQualityDocument(docFiles.psi, "psi") || psiDocumentId;
            if (docFiles.coa_pol) coaPolDocumentId = await uploadQualityDocument(docFiles.coa_pol, "coa_pol") || coaPolDocumentId;
            if (docFiles.coa_pod) coaPodDocumentId = await uploadQualityDocument(docFiles.coa_pod, "coa_pod") || coaPodDocumentId;
            const payload = {
                cargo_id: form.cargo_id || "manual",
                cargo_name: form.cargo_name,
                surveyor: form.surveyor,
                sampling_date: form.sampling_date || new Date().toISOString(),
                spec_result: specFromForm(form.spec_result) || { gar: 0, ts: 0, ash: 0, tm: 0 },
                contract_spec: specFromForm(form.contract_spec),
                source_estimate: specFromForm(form.source_estimate),
                qc_result: specFromForm(form.qc_result),
                qc_document_id: qcDocumentId,
                psi_result: specFromForm(form.psi_result),
                psi_document_id: psiDocumentId,
                coa_pol_result: specFromForm(form.coa_pol_result),
                coa_pol_document_id: coaPolDocumentId,
                coa_pod_result: specFromForm(form.coa_pod_result),
                coa_pod_document_id: coaPodDocumentId,
                comparison_status: form.comparison_status || undefined,
                warning_notes: form.warning_notes,
                status: form.status,
            };
            if (mode === "add") {
                await addQualityResult(payload);
                showToast("Quality result added", "success");
            } else if (mode === "edit" && editingId) {
                await updateQualityResult(editingId, payload);
                showToast("Quality result updated", "success");
            }
            setDocFiles({ qc: null, psi: null, coa_pol: null, coa_pod: null });
            closeForm();
        } catch (error: any) {
            showToast(error?.message || `Failed to ${mode === "add" ? "add" : "update"} quality result`, "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/memory/quality?id=${deleteTarget.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error();
            await syncFromMemory({ force: true });
            showToast("Quality result deleted", "success");
        } catch {
            showToast("Failed to delete quality result", "error");
        } finally {
            setIsDeleting(false);
            setDeleteTarget(null);
        }
    };

    const filtered = qualityResults.filter((q) => {
        const displayStatus = q.comparison_status || q.status;
        if (filterStatus !== "all" && displayStatus !== filterStatus && q.status !== filterStatus) return false;
        if (search) {
            const s = search.toLowerCase();
            return q.cargo_name.toLowerCase().includes(s) || (q.surveyor || "").toLowerCase().includes(s);
        }
        return true;
    });

    const renderSpecFields = (
        section: keyof Pick<QualityForm, "spec_result" | "contract_spec" | "source_estimate" | "qc_result" | "psi_result" | "coa_pol_result" | "coa_pod_result">,
        title: string
    ) => (
        <div className="rounded-lg border border-border/60 bg-accent/20 p-3 space-y-2">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">{title}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {SPEC_FIELDS.map((field) => (
                    <div key={`${section}-${field.key}`}>
                        <label className="text-[9px] font-semibold text-muted-foreground uppercase">{field.label}</label>
                        <input
                            type="number"
                            step={field.step}
                            value={form[section][field.key] || ""}
                            placeholder={field.placeholder}
                            onChange={(e) => setSpecField(section, field.key, e.target.value)}
                            className="w-full mt-1 px-2.5 py-2 rounded-lg bg-background/70 border border-border text-xs outline-none focus:border-primary/50"
                        />
                    </div>
                ))}
            </div>
        </div>
    );

    const renderDocumentInput = (
        kind: "qc" | "psi" | "coa_pol" | "coa_pod",
        label: string,
        documentId: string
    ) => (
        <div className="rounded-lg border border-border/60 bg-accent/20 p-3 space-y-2">
            <label className="text-[10px] font-semibold uppercase text-muted-foreground flex items-center gap-1">
                <Upload className="w-3.5 h-3.5" /> {label}
            </label>
            {form.cargo_id && documentId && (
                <a href={`/api/shipments/${form.cargo_id}/documents/${documentId}`} target="_blank" className="text-xs text-violet-600 hover:underline inline-flex items-center gap-1">
                    Current document <ExternalLink className="w-3 h-3" />
                </a>
            )}
            <input
                type="file"
                accept="image/*,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => setDocFiles((current) => ({ ...current, [kind]: e.target.files?.[0] || null }))}
                className="w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-violet-500 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
            />
            <p className="text-[10px] text-muted-foreground">Stored under the linked shipment documents.</p>
        </div>
    );

    const renderForm = (title: string) => (
        <div className="card-elevated p-5 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{title}</h3>
                <button onClick={closeForm} className="p-1 rounded hover:bg-accent"><X className="w-4 h-4" /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Shipment Link</label>
                    <select value={form.cargo_id} onChange={(e) => {
                        const sh = shipments.find((s) => s.id === e.target.value);
                        setForm({
                            ...form,
                            cargo_id: e.target.value,
                            cargo_name: sh ? `${sh.buyer || "Shipment"} - ${sh.vessel_name || sh.barge_name || sh.nomination || sh.id}` : form.cargo_name,
                            contract_spec: sh?.result_gar ? { ...form.contract_spec, gar: String(sh.result_gar) } : form.contract_spec,
                        });
                    }} className="w-full mt-1 px-3 py-2 rounded-lg bg-accent/50 border border-border text-sm outline-none">
                        <option value="">Select shipment or type manually...</option>
                        {shipments.map((sh) => <option key={sh.id} value={sh.id}>{sh.buyer || sh.forecast_sales_name || sh.id} - {sh.vessel_name || sh.barge_name || sh.nomination || "No vessel"}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Cargo Name</label>
                    <input value={form.cargo_name} onChange={(e) => setForm({ ...form, cargo_name: e.target.value })}
                        placeholder="e.g. TB ABHIPRAMA 107 / BG ALARA 107"
                        className="w-full mt-1 px-3 py-2 rounded-lg bg-accent/50 border border-border text-sm outline-none focus:border-primary/50" />
                </div>
                <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Surveyor</label>
                    <input value={form.surveyor} onChange={(e) => setForm({ ...form, surveyor: e.target.value })}
                        placeholder="e.g. SGS Indonesia"
                        className="w-full mt-1 px-3 py-2 rounded-lg bg-accent/50 border border-border text-sm outline-none focus:border-primary/50" />
                </div>
                <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Sampling Date</label>
                    <input type="date" value={form.sampling_date} onChange={(e) => setForm({ ...form, sampling_date: e.target.value })}
                        className="w-full mt-1 px-3 py-2 rounded-lg bg-accent/50 border border-border text-sm outline-none focus:border-primary/50" />
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {renderSpecFields("contract_spec", "Contract Spec")}
                {renderSpecFields("source_estimate", "Source Quality Estimate")}
                {renderSpecFields("qc_result", "QC Result")}
                {renderSpecFields("psi_result", "PSI Result")}
                {renderSpecFields("coa_pol_result", "COA POL")}
                {renderSpecFields("coa_pod_result", "COA POD")}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                {renderDocumentInput("qc", "QC Document", form.qc_document_id)}
                {renderDocumentInput("psi", "PSI Document", form.psi_document_id)}
                {renderDocumentInput("coa_pol", "COA POL Document", form.coa_pol_document_id)}
                {renderDocumentInput("coa_pod", "COA POD Document", form.coa_pod_document_id)}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {renderSpecFields("spec_result", "Latest / Final Snapshot")}
                <div className="rounded-lg border border-border/60 bg-accent/20 p-3 space-y-2">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Comparison Status</label>
                    <select value={form.comparison_status} onChange={(e) => setForm({ ...form, comparison_status: e.target.value, status: e.target.value || form.status })}
                        className="w-full px-3 py-2 rounded-lg bg-background/70 border border-border text-sm outline-none">
                        <option value="">Auto calculate</option>
                        <option value="passed">Passed</option>
                        <option value="warning">Warning</option>
                        <option value="need_review">Need Review</option>
                        <option value="claim_potential">Claim Potential</option>
                        <option value="rejected">Rejected</option>
                    </select>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase block pt-2">Workflow Status</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-background/70 border border-border text-sm outline-none">
                        {Object.entries(STATUS_CFG).map(([value, cfg]) => <option key={value} value={value}>{cfg.label}</option>)}
                    </select>
                </div>
                <div className="rounded-lg border border-border/60 bg-accent/20 p-3">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Warning / Review Notes</label>
                    <textarea value={form.warning_notes} onChange={(e) => setForm({ ...form, warning_notes: e.target.value })}
                        placeholder="Quality deviation, claim risk, or review notes..."
                        className="w-full mt-1 min-h-[104px] px-3 py-2 rounded-lg bg-background/70 border border-border text-sm outline-none focus:border-primary/50 resize-none" />
                </div>
            </div>

            <div className="flex gap-2">
                <button onClick={handleSubmit} className="btn-primary" disabled={isSaving}>
                    {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><Plus className="w-4 h-4 mr-1.5" />{mode === "add" ? "Submit Result" : "Save Changes"}</>}
                </button>
                <button onClick={closeForm} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors" disabled={isSaving}>Cancel</button>
            </div>
        </div>
    );

    if (isInitializing && qualityResults.length === 0 && shipments.length === 0) {
        return (
            <AppShell>
                <ModulePageSkeleton titleWidth="w-44" subtitleWidth="w-[30rem]" metricCount={5} cardCount={5} />
            </AppShell>
        );
    }

    return (
        <AppShell>
            <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6">
                <div className="card-elevated p-6 animate-fade-in border-l-4 border-l-violet-500 relative overflow-hidden">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Quality</h1>
                            <p className="text-sm text-muted-foreground mt-1 max-w-xl">Track contract spec, source estimate, QC, PSI, COA, and final quality comparison.</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={openAdd} className="btn-primary h-9"><Plus className="w-4 h-4 mr-1.5" /> Add Result</button>
                            <button onClick={() => setShowReportModal(true)} className="btn-outline text-xs h-9 hidden sm:flex"><Download className="w-3.5 h-3.5 mr-1.5" /> Export</button>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search cargo or surveyor..."
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-accent/50 border border-border text-sm outline-none focus:border-primary/50 transition-colors" />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {[{ value: "all", label: "All" }, ...Object.entries(STATUS_CFG).map(([k, v]) => ({ value: k, label: v.label }))].map((f) => (
                            <button key={f.value} onClick={() => setFilterStatus(f.value)}
                                className={cn("filter-chip", filterStatus === f.value ? "filter-chip-active" : "filter-chip-inactive")}>
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                {mode === "add" && renderForm("New Quality Result")}
                {mode === "edit" && renderForm("Edit Quality Result")}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {filtered.map((q, i) => {
                        const displayStatus = q.comparison_status || q.status || "pending";
                        const cfg = STATUS_CFG[displayStatus] || STATUS_CFG[q.status] || { label: displayStatus, color: "#6b7280", icon: AlertTriangle };
                        const Icon = cfg.icon;

                        return (
                            <div key={q.id} className={cn("card-elevated p-5 space-y-4 animate-slide-up", `delay-${Math.min(i + 1, 6)}`)}>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 shrink-0 rounded-xl bg-violet-500/10 flex items-center justify-center">
                                            <FlaskConical className="w-5 h-5 text-violet-500" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold truncate">{q.cargo_name}</p>
                                            <p className="text-[10px] text-muted-foreground truncate">Surveyor: {q.surveyor || "-"} | Sampling: {formatDate(q.sampling_date)}</p>
                                        </div>
                                    </div>
                                    <span className="status-badge text-[10px] flex items-center gap-1 shrink-0" style={{ color: cfg.color, backgroundColor: `${cfg.color}15` }}>
                                        <Icon className="w-3 h-3" />{cfg.label}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-border/30">
                                    {SPEC_FIELDS.map((field) => (
                                        <div key={field.key} className="text-center">
                                            <p className="text-[9px] text-muted-foreground uppercase">{field.label}</p>
                                            <p className="text-sm font-bold">{q.spec_result?.[field.key] ?? "-"}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                    {[
                                        ["Contract", q.contract_spec],
                                        ["Source Estimate", q.source_estimate],
                                        ["QC", q.qc_result],
                                        ["PSI", q.psi_result],
                                        ["COA POL", q.coa_pol_result],
                                        ["COA POD", q.coa_pod_result],
                                    ].map(([label, spec]) => (
                                        <div key={String(label)} className="rounded-lg border border-border/50 bg-accent/25 p-2">
                                            <p className="text-[9px] uppercase font-semibold text-muted-foreground">{String(label)}</p>
                                            <p className="mt-1 text-[11px] text-foreground/80 break-words">{formatSpec(spec as CoalSpec | undefined)}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="rounded-lg bg-accent/30 border border-border/50 p-3 flex gap-2">
                                    <ShieldCheck className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold">Quality Comparison</p>
                                        <p className="text-[11px] text-muted-foreground break-words">{q.warning_notes || "No warning notes yet."}</p>
                                        <p className="text-[10px] text-muted-foreground mt-1">Reviewed by {q.reviewed_by_name || "-"} {q.reviewed_at ? `on ${formatDate(q.reviewed_at)}` : ""}</p>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {[
                                                ["QC", q.qc_document_id],
                                                ["PSI", q.psi_document_id],
                                                ["COA POL", q.coa_pol_document_id],
                                                ["COA POD", q.coa_pod_document_id],
                                            ].map(([label, docId]) => q.cargo_id && docId ? (
                                                <a key={String(label)} href={`/api/shipments/${q.cargo_id}/documents/${docId}`} target="_blank" className="inline-flex items-center gap-1 rounded-md bg-background/80 px-2 py-1 text-[10px] font-semibold text-violet-600 hover:underline">
                                                    {String(label)} <ExternalLink className="w-3 h-3" />
                                                </a>
                                            ) : null)}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-1 border-t border-border/20">
                                    <button
                                        onClick={() => openEdit(q)}
                                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent/60 hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                                    >
                                        <Pencil className="w-3 h-3" /> Edit
                                    </button>
                                    <button
                                        onClick={() => setDeleteTarget({ id: q.id, name: q.cargo_name })}
                                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 hover:bg-red-500/20 transition-colors text-red-500"
                                    >
                                        <Trash2 className="w-3 h-3" /> Delete
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {filtered.length === 0 && (
                    <div className="card-elevated p-8 text-center">
                        <FlaskConical className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No quality results found</p>
                    </div>
                )}

                {deleteTarget && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                        <div className="card-elevated p-6 max-w-sm w-full space-y-4 animate-scale-in">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                                    <TriangleAlert className="w-5 h-5 text-red-500" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold">Delete Quality Result</h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">This action cannot be undone</p>
                                </div>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Are you sure you want to delete <span className="font-semibold text-foreground">{deleteTarget.name}</span>?
                            </p>
                            <div className="flex gap-2">
                                <button onClick={handleDelete} disabled={isDeleting}
                                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors disabled:opacity-60">
                                    {isDeleting ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting...</> : <><Trash2 className="w-4 h-4" /> Delete</>}
                                </button>
                                <button onClick={() => setDeleteTarget(null)} disabled={isDeleting}
                                    className="flex-1 py-2 rounded-lg text-sm font-medium bg-accent hover:bg-accent/80 transition-colors">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <ReportModal isOpen={showReportModal} onClose={() => setShowReportModal(false)} moduleName="Quality"
                    onExport={(format, options) => console.log(`Exporting Quality as ${format}`, options)} />

                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            </div>
        </AppShell>
    );
}
