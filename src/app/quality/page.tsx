"use client";

import React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useCommercialStore } from "@/store/commercial-store";
import { cn } from "@/lib/utils";
import { FlaskConical, CheckCircle, XCircle, Clock, AlertTriangle, Plus, X, Search, Download, Loader2 } from "lucide-react";
import { ReportModal } from "@/components/shared/report-modal";
import { Toast } from "@/components/shared/toast";

const STATUS_CFG = {
    pending: { label: "Pending", color: "#f59e0b", icon: Clock },
    passed: { label: "Passed", color: "#10b981", icon: CheckCircle },
    rejected: { label: "Rejected", color: "#ef4444", icon: XCircle },
    on_hold: { label: "On Hold", color: "#6b7280", icon: AlertTriangle },
};

export default function QualityPage() {
    const { qualityResults, addQualityResult, shipments } = useCommercialStore();
    const [showForm, setShowForm] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [toast, setToast] = React.useState<{ message: string; type: "success" | "error" } | null>(null);
    const [search, setSearch] = React.useState("");
    const [showReportModal, setShowReportModal] = React.useState(false);
    const [filterStatus, setFilterStatus] = React.useState<string>("all");
    const [form, setForm] = React.useState({
        cargo_id: "", cargo_name: "", surveyor: "", sampling_date: "",
        gar: 4200, ts: 0.8, ash: 5.0, tm: 30,
        status: "pending" as "pending" | "passed" | "rejected" | "on_hold",
    });

    const filtered = qualityResults.filter((q) => {
        if (filterStatus !== "all" && q.status !== filterStatus) return false;
        if (search) {
            const s = search.toLowerCase();
            return q.cargo_name.toLowerCase().includes(s) || q.surveyor.toLowerCase().includes(s);
        }
        return true;
    });

    const handleSubmit = async () => {
        setIsSaving(true);
        try {
            await addQualityResult({
                cargo_id: form.cargo_id || "manual",
                cargo_name: form.cargo_name,
                surveyor: form.surveyor,
                sampling_date: form.sampling_date || new Date().toISOString(),
                spec_result: { gar: form.gar, ts: form.ts, ash: form.ash, tm: form.tm },
                status: form.status,
            });
            setToast({ message: "Quality result added successfully!", type: "success" });
            setShowForm(false);
            setForm({ cargo_id: "", cargo_name: "", surveyor: "", sampling_date: "", gar: 4200, ts: 0.8, ash: 5.0, tm: 30, status: "pending" });
        } catch (error) {
            setToast({ message: "Failed to add quality result", type: "error" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <AppShell>
            <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6">
                {/* Module Summary */}
                <div className="card-elevated p-6 animate-fade-in border-l-4 border-l-violet-500 relative overflow-hidden">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Quality</h1>
                            <p className="text-sm text-muted-foreground mt-1 max-w-xl">Track cargo sampling and inspection results, maintaining coal standard compliance.</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setShowForm(!showForm)} className="btn-primary h-9"><Plus className="w-4 h-4 mr-1.5" /> Add Result</button>
                            <button onClick={() => setShowReportModal(true)} className="btn-outline text-xs h-9 hidden sm:flex"><Download className="w-3.5 h-3.5 mr-1.5" /> Download Report</button>
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

                {/* Add Form */}
                {showForm && (
                    <div className="card-elevated p-5 space-y-4 animate-scale-in">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold">New Quality Result</h3>
                            <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-accent"><X className="w-4 h-4" /></button>
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
                                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Cargo Name (manual)</label>
                                <input value={form.cargo_name} onChange={(e) => setForm({ ...form, cargo_name: e.target.value })}
                                    className="w-full mt-1 px-3 py-2 rounded-lg bg-accent/50 border border-border text-sm outline-none focus:border-primary/50" />
                            </div>
                            <div>
                                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Surveyor</label>
                                <input value={form.surveyor} onChange={(e) => setForm({ ...form, surveyor: e.target.value })}
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
                            {[["GAR", "gar", 4200], ["TS (%)", "ts", 0.8], ["ASH (%)", "ash", 5.0], ["TM (%)", "tm", 30]].map(([label, key, def]) => (
                                <div key={key as string}>
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">{label as string}</label>
                                    <input type="number" step={key === "gar" ? 1 : 0.01} value={(form as any)[key]}
                                        onChange={(e) => setForm({ ...form, [key as string]: +e.target.value })}
                                        className="w-full mt-1 px-3 py-2 rounded-lg bg-accent/50 border border-border text-sm outline-none focus:border-primary/50" />
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleSubmit} className="btn-primary" disabled={isSaving}>
                                {isSaving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-4 h-4 mr-1.5" /> Submit Result
                                    </>
                                )}
                            </button>
                            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors" disabled={isSaving}>Cancel</button>
                        </div>
                    </div>
                )}

                {/* Quality Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((q, i) => {
                        const cfg = STATUS_CFG[q.status];
                        const Icon = cfg.icon;
                        return (
                            <div key={q.id} className={cn("card-elevated p-5 space-y-3 animate-slide-up", `delay-${Math.min(i + 1, 6)}`)}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                            <FlaskConical className="w-5 h-5 text-blue-500" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold">{q.cargo_name}</p>
                                            <p className="text-[10px] text-muted-foreground">Surveyor: {q.surveyor}</p>
                                        </div>
                                    </div>
                                    <span className="status-badge text-[10px] flex items-center gap-1" style={{ color: cfg.color, backgroundColor: `${cfg.color}15` }}>
                                        <Icon className="w-3 h-3" />{cfg.label}
                                    </span>
                                </div>
                                <div className="text-xs text-muted-foreground">Sampling: {new Date(q.sampling_date).toLocaleDateString("en", { day: "2-digit", month: "short", year: "numeric" })}</div>
                                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border/30">
                                    {[
                                        { label: "GAR", value: q.spec_result.gar, unit: "" },
                                        { label: "TS", value: q.spec_result.ts, unit: "%" },
                                        { label: "ASH", value: q.spec_result.ash, unit: "%" },
                                        { label: "TM", value: q.spec_result.tm, unit: "%" },
                                    ].map((s) => (
                                        <div key={s.label} className="text-center">
                                            <p className="text-[9px] text-muted-foreground uppercase">{s.label}</p>
                                            <p className="text-sm font-bold">{s.value}{s.unit}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
                {filtered.length === 0 && <div className="card-elevated p-8 text-center"><p className="text-sm text-muted-foreground">No quality results found</p></div>}
                <ReportModal
                    isOpen={showReportModal}
                    onClose={() => setShowReportModal(false)}
                    moduleName="Quality"
                    onExport={(format, options) => {
                        console.log(`Exporting Quality Data as ${format} with options:`, options);
                    }}
                />
                {toast && (
                    <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
                )}
            </div>
        </AppShell>
    );
}
