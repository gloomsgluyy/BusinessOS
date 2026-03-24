"use client";

import React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useCommercialStore } from "@/store/commercial-store";
import { cn } from "@/lib/utils";
import {
    FlaskConical, CheckCircle, XCircle, Clock, AlertTriangle,
    Plus, X, Search, Download, Loader2, Pencil, Trash2, TriangleAlert
} from "lucide-react";
import { ReportModal } from "@/components/shared/report-modal";
import { Toast } from "@/components/shared/toast";

const STATUS_CFG = {
    pending: { label: "Pending", color: "#f59e0b", icon: Clock },
    passed: { label: "Passed", color: "#10b981", icon: CheckCircle },
    rejected: { label: "Rejected", color: "#ef4444", icon: XCircle },
    on_hold: { label: "On Hold", color: "#6b7280", icon: AlertTriangle },
};

const EMPTY_FORM = {
    cargo_id: "", cargo_name: "", surveyor: "", sampling_date: "",
    gar: 4200, ts: 0.8, ash: 5.0, tm: 30,
    status: "pending" as "pending" | "passed" | "rejected" | "on_hold",
};

export default function QualityPage() {
    const { qualityResults, syncFromMemory, addQualityResult, updateQualityResult, shipments } = useCommercialStore();

    React.useEffect(() => { syncFromMemory(); }, [syncFromMemory]);

    // ── UI State ──────────────────────────────────────────────
    const [mode, setMode] = React.useState<"idle" | "add" | "edit">("idle");
    const [editingId, setEditingId] = React.useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = React.useState<{ id: string; name: string } | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [toast, setToast] = React.useState<{ message: string; type: "success" | "error" } | null>(null);
    const [search, setSearch] = React.useState("");
    const [showReportModal, setShowReportModal] = React.useState(false);
    const [filterStatus, setFilterStatus] = React.useState<string>("all");
    const [form, setForm] = React.useState(EMPTY_FORM);

    // ── Helpers ───────────────────────────────────────────────
    const showToast = (message: string, type: "success" | "error") =>
        setToast({ message, type });

    const openAdd = () => {
        setForm(EMPTY_FORM);
        setEditingId(null);
        setMode("add");
    };

    const openEdit = (q: any) => {
        setForm({
            cargo_id: q.cargo_id || "",
            cargo_name: q.cargo_name || "",
            surveyor: q.surveyor || "",
            sampling_date: q.sampling_date ? q.sampling_date.split("T")[0] : "",
            gar: q.spec_result?.gar ?? 4200,
            ts: q.spec_result?.ts ?? 0.8,
            ash: q.spec_result?.ash ?? 5.0,
            tm: q.spec_result?.tm ?? 30,
            status: (q.status || "pending") as any,
        });
        setEditingId(q.id);
        setMode("edit");
    };

    const closeForm = () => { setMode("idle"); setEditingId(null); };

    // ── CRUD ──────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!form.cargo_name.trim()) return showToast("Cargo name is required", "error");
        setIsSaving(true);
        try {
            const payload = {
                cargo_id: form.cargo_id || "manual",
                cargo_name: form.cargo_name,
                surveyor: form.surveyor,
                sampling_date: form.sampling_date || new Date().toISOString(),
                spec_result: { gar: form.gar, ts: form.ts, ash: form.ash, tm: form.tm },
                status: form.status,
            };
            if (mode === "add") {
                await addQualityResult(payload);
                showToast("Quality result added!", "success");
            } else if (mode === "edit" && editingId) {
                await updateQualityResult(editingId, payload);
                showToast("Quality result updated!", "success");
            }
            closeForm();
        } catch {
            showToast(`Failed to ${mode === "add" ? "add" : "update"} quality result`, "error");
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
            // Refresh data from server after delete
            await syncFromMemory();
            showToast("Quality result deleted", "success");
        } catch {
            showToast("Failed to delete quality result", "error");
        } finally {
            setIsDeleting(false);
            setDeleteTarget(null);
        }
    };

    // ── Filtered list ─────────────────────────────────────────
    const filtered = qualityResults.filter((q) => {
        if (filterStatus !== "all" && q.status !== filterStatus) return false;
        if (search) {
            const s = search.toLowerCase();
            return q.cargo_name.toLowerCase().includes(s) || (q.surveyor || "").toLowerCase().includes(s);
        }
        return true;
    });

    // ── Shared Form JSX ───────────────────────────────────────
    const renderForm = (title: string) => (
        <div className="card-elevated p-5 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{title}</h3>
                <button onClick={closeForm} className="p-1 rounded hover:bg-accent"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Cargo / Shipment</label>
                    <select value={form.cargo_id} onChange={(e) => {
                        const sh = shipments.find((s) => s.id === e.target.value);
                        setForm({ ...form, cargo_id: e.target.value, cargo_name: sh ? `${sh.buyer} - ${sh.vessel_name || sh.barge_name}` : form.cargo_name });
                    }} className="w-full mt-1 px-3 py-2 rounded-lg bg-accent/50 border border-border text-sm outline-none">
                        <option value="">Select shipment or type manually...</option>
                        {shipments.map((sh) => <option key={sh.id} value={sh.id}>{sh.buyer} - {sh.vessel_name || sh.barge_name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Cargo Name</label>
                    <input value={form.cargo_name} onChange={(e) => setForm({ ...form, cargo_name: e.target.value })}
                        placeholder="e.g. Cargo Batch A"
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
                <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Status</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                        className="w-full mt-1 px-3 py-2 rounded-lg bg-accent/50 border border-border text-sm outline-none">
                        <option value="pending">Pending</option>
                        <option value="passed">Passed</option>
                        <option value="rejected">Rejected</option>
                        <option value="on_hold">On Hold</option>
                    </select>
                </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(["GAR (kcal/kg)", "TS (%)", "ASH (%)", "TM (%)"] as const).map((label, i) => {
                    const key = (["gar", "ts", "ash", "tm"] as const)[i];
                    return (
                        <div key={key}>
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase">{label}</label>
                            <input type="number" step={key === "gar" ? 1 : 0.01} value={(form as any)[key]}
                                onChange={(e) => setForm({ ...form, [key]: +e.target.value })}
                                className="w-full mt-1 px-3 py-2 rounded-lg bg-accent/50 border border-border text-sm outline-none focus:border-primary/50" />
                        </div>
                    );
                })}
            </div>
            <div className="flex gap-2">
                <button onClick={handleSubmit} className="btn-primary" disabled={isSaving}>
                    {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><Plus className="w-4 h-4 mr-1.5" />{mode === "add" ? "Submit Result" : "Save Changes"}</>}
                </button>
                <button onClick={closeForm} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors" disabled={isSaving}>Cancel</button>
            </div>
        </div>
    );

    // ── Render ────────────────────────────────────────────────
    return (
        <AppShell>
            <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6">

                {/* Header */}
                <div className="card-elevated p-6 animate-fade-in border-l-4 border-l-violet-500 relative overflow-hidden">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Quality</h1>
                            <p className="text-sm text-muted-foreground mt-1 max-w-xl">Track cargo sampling and inspection results, maintaining coal standard compliance.</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={openAdd} className="btn-primary h-9"><Plus className="w-4 h-4 mr-1.5" /> Add Result</button>
                            <button onClick={() => setShowReportModal(true)} className="btn-outline text-xs h-9 hidden sm:flex"><Download className="w-3.5 h-3.5 mr-1.5" /> Export</button>
                        </div>
                    </div>
                </div>

                {/* Search + Filter */}
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

                {/* Add / Edit Form */}
                {mode === "add" && renderForm("New Quality Result")}
                {mode === "edit" && renderForm("Edit Quality Result")}

                {/* Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((q, i) => {
                        const cfg = STATUS_CFG[q.status as keyof typeof STATUS_CFG] || { label: q.status, color: "#6b7280", icon: AlertTriangle };
                        const Icon = cfg.icon;
                        const samplingDateStr = q.sampling_date
                            ? (() => { try { return new Date(q.sampling_date).toLocaleDateString("en", { day: "2-digit", month: "short", year: "numeric" }); } catch { return q.sampling_date; } })()
                            : "-";

                        return (
                            <div key={q.id} className={cn("card-elevated p-5 space-y-3 animate-slide-up", `delay-${Math.min(i + 1, 6)}`)}>
                                {/* Card Header */}
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 shrink-0 rounded-xl bg-violet-500/10 flex items-center justify-center">
                                            <FlaskConical className="w-5 h-5 text-violet-500" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold truncate">{q.cargo_name}</p>
                                            <p className="text-[10px] text-muted-foreground truncate">Surveyor: {q.surveyor || "-"}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <span className="status-badge text-[10px] flex items-center gap-1" style={{ color: cfg.color, backgroundColor: `${cfg.color}15` }}>
                                            <Icon className="w-3 h-3" />{cfg.label}
                                        </span>
                                    </div>
                                </div>

                                {/* Sampling Date */}
                                <div className="text-xs text-muted-foreground">
                                    Sampling: <span className="font-medium text-foreground">{samplingDateStr}</span>
                                </div>

                                {/* Spec Grid */}
                                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border/30">
                                    {[
                                        { label: "GAR", value: q.spec_result?.gar, unit: "" },
                                        { label: "TS", value: q.spec_result?.ts, unit: "%" },
                                        { label: "ASH", value: q.spec_result?.ash, unit: "%" },
                                        { label: "TM", value: q.spec_result?.tm, unit: "%" },
                                    ].map((s) => (
                                        <div key={s.label} className="text-center">
                                            <p className="text-[9px] text-muted-foreground uppercase">{s.label}</p>
                                            <p className="text-sm font-bold">{s.value ?? "-"}{s.value != null ? s.unit : ""}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Actions */}
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

                {/* Delete Confirmation Modal */}
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
                                This will also remove it from Google Sheets.
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
