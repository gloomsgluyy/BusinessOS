"use client";

import React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useCommercialStore } from "@/store/commercial-store";
import { KYC_STATUSES, PSI_STATUSES } from "@/lib/constants";
import { cn, generateId } from "@/lib/utils";
import { SourceSupplier, CoalSpec } from "@/types";
import {
    MapPin, Package, Download, Plus, Search, Filter,
    Anchor, Ship, MoreVertical, LayoutGrid, List, AlertTriangle, TrendingUp, TrendingDown,
    Building2, Users, FileSignature, Factory, X, Navigation, Truck, Settings, Shield, FlaskConical,
    Loader2
} from "lucide-react";
import { ReportModal } from "@/components/shared/report-modal";
import { Toast } from "@/components/shared/toast";

const safeNum = (v: number | null | undefined): number => (v != null && !isNaN(v) ? v : 0);
const safeFmt = (v: number | null | undefined, decimals = 2): string => safeNum(v).toFixed(decimals);

const emptySource: Partial<SourceSupplier> = {
    name: "", region: "", calorie_range: "",
    spec: { gar: 0, ts: 0, ash: 0, tm: 0, im: 0, fc: 0, adb: 0, nar: 0 },
    stock_available: 0, min_stock_alert: 0,
    fob_barge_only: false, requires_transshipment: false,
    price_linked_index: "", fob_barge_price_usd: 0, fob_barge_price_idr: 0,
    jetty_port: "", anchorage: "",
    kyc_status: "not_started", psi_status: "not_started",
    contact_person: "", phone: "", email: "", iup_number: "", notes: "", contract_type: ""
};

export default function SourcesPage() {
    const { sources, addSource, updateSource, deleteSource } = useCommercialStore();
    const [activeTab, setActiveTab] = React.useState<"sources" | "alerts" | "performance">("sources");
    const [viewMode, setViewMode] = React.useState<"card" | "table">("table");
    const [search, setSearch] = React.useState("");
    const [regionFilter, setRegionFilter] = React.useState("all");

    const uniqueRegions = Array.from(new Set(sources.map(s => s.region))).filter(Boolean);

    // Modal states
    const [showForm, setShowForm] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [toast, setToast] = React.useState<{ message: string; type: "success" | "error" } | null>(null);
    const [isEditing, setIsEditing] = React.useState(false);
    const [form, setForm] = React.useState<Partial<SourceSupplier>>(emptySource);
    const [showReportModal, setShowReportModal] = React.useState(false);

    const lowStockSources = sources.filter(s => s.min_stock_alert && s.stock_available <= s.min_stock_alert);

    const displaySources = activeTab === "alerts" ? lowStockSources : sources;
    const filtered = displaySources.filter((s) => {
        const matchesRegion = regionFilter === "all" || s.region === regionFilter;
        if (!matchesRegion) return false;
        if (!search) return true;
        const q = search.toLowerCase();
        return s.name.toLowerCase().includes(q) || (s.jetty_port || "").toLowerCase().includes(q) || s.region.toLowerCase().includes(q);
    });

    const handleOpenAdd = () => {
        setForm({ ...emptySource });
        setIsEditing(false);
        setShowForm(true);
    };

    const handleOpenEdit = (src: SourceSupplier) => {
        setForm({ ...src });
        setIsEditing(true);
        setShowForm(true);
    };

    const handleSubmit = async () => {
        setIsSaving(true);
        try {
            if (isEditing && form.id) {
                await updateSource(form.id, form);
                setToast({ message: "Source updated successfully!", type: "success" });
            } else {
                await addSource({
                    ...form,
                    id: generateId("src"),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                } as SourceSupplier);
                setToast({ message: "New source added successfully!", type: "success" });
            }
            setShowForm(false);
        } catch (error) {
            setToast({ message: "Failed to save source", type: "error" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this supplier?")) return;
        try {
            await deleteSource(id);
            setToast({ message: "Supplier removed successfully", type: "success" });
            setShowForm(false);
        } catch (error) {
            setToast({ message: "Failed to delete supplier", type: "error" });
        }
    };

    const regionStats = sources.reduce((acc, curr) => {
        if (!acc[curr.region]) acc[curr.region] = { count: 0, totalStock: 0 };
        acc[curr.region].count += 1;
        acc[curr.region].totalStock += curr.stock_available;
        return acc;
    }, {} as Record<string, { count: number, totalStock: number }>);

    return (
        <AppShell>
            <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6">

                {/* Module Summary & Top Metrics */}
                <div className="card-elevated p-6 animate-fade-in border-l-4 border-l-emerald-500 relative overflow-hidden">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <div className="relative z-10">
                            <h1 className="text-2xl font-bold tracking-tight">Source</h1>
                            <p className="text-sm text-muted-foreground mt-1 max-w-xl">Manage supplier pipeline, monitor real-time stock levels, and evaluate origin quality metrics.</p>
                        </div>
                        <div className="flex gap-2 relative z-10">
                            <button onClick={() => setShowReportModal(true)} className="btn-outline text-xs h-9 hidden sm:flex"><Download className="w-3.5 h-3.5 mr-1.5" /> Download Report</button>
                            <button onClick={handleOpenAdd} className="btn-primary"><Plus className="w-4 h-4 mr-1.5" /> Add Origin</button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 relative z-10">
                        <div className="bg-background/60 p-4 rounded-xl border border-border/50 text-center">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase">Total Origins</p>
                            <p className="text-2xl font-bold mt-2 text-foreground">{sources.length}</p>
                        </div>
                        <div className="bg-background/60 p-4 rounded-xl border border-border/50 text-center">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center justify-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-500" /> Low Stock</p>
                            <p className="text-2xl font-bold mt-2 text-amber-500">{lowStockSources.length}</p>
                        </div>
                        <div className="bg-background/60 p-4 rounded-xl border border-border/50 text-center">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase">Avg Stock / Origin</p>
                            <p className="text-2xl font-bold mt-2 text-blue-500">{sources.length > 0 ? safeFmt((sources.reduce((a, b) => a + safeNum(b.stock_available), 0) / sources.length / 1000), 1) : 0}K</p>
                        </div>
                        <div className="col-span-2 bg-background/60 p-4 rounded-xl border border-border/50">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">Top Region Density</p>
                            <div className="flex flex-wrap gap-2 text-xs font-medium">
                                {Object.entries(regionStats).slice(0, 3).map(([reg, data]) => (
                                    <span key={reg} className="bg-emerald-500/10 text-emerald-600 px-2.5 py-1 rounded border border-emerald-500/20">{reg}: {data.count} Origins</span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sub-Navigation Tabs */}
                <div className="flex items-center gap-6 border-b border-border text-sm font-medium overflow-x-auto hide-scrollbar">
                    <button onClick={() => setActiveTab("sources")} className={cn("pb-3 border-b-2 whitespace-nowrap transition-colors", activeTab === "sources" ? "border-emerald-500 text-emerald-500" : "border-transparent text-muted-foreground hover:text-foreground")}>
                        Coal Sources
                    </button>
                    <button onClick={() => setActiveTab("alerts")} className={cn("pb-3 border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5", activeTab === "alerts" ? "border-emerald-500 text-emerald-500" : "border-transparent text-muted-foreground hover:text-foreground")}>
                        Stock Alerts {lowStockSources.length > 0 && <span className="flex items-center justify-center w-4 h-4 text-[10px] text-white bg-red-500 rounded-full">{lowStockSources.length}</span>}
                    </button>
                    <button onClick={() => setActiveTab("performance")} className={cn("pb-3 border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5", activeTab === "performance" ? "border-emerald-500 text-emerald-500" : "border-transparent text-muted-foreground hover:text-foreground")}>
                        Supplier Performance
                    </button>
                </div>

                {/* Filters & View Toggles */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex bg-accent/30 p-1 rounded-xl">
                        <button onClick={() => setViewMode("card")} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all", viewMode === "card" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}><LayoutGrid className="w-3.5 h-3.5" /> Grid</button>
                        <button onClick={() => setViewMode("table")} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all", viewMode === "table" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}><List className="w-3.5 h-3.5" /> List</button>
                    </div>

                    <div className="flex items-center gap-3 flex-1 md:justify-end">
                        <select
                            value={regionFilter}
                            onChange={(e) => setRegionFilter(e.target.value)}
                            className="px-3 py-2 rounded-xl bg-accent/30 border border-border text-xs outline-none focus:border-primary/50 transition-colors"
                        >
                            <option value="all">All Regions</option>
                            {uniqueRegions.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <div className="relative md:w-64 max-w-sm w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or jetty port..." className="w-full pl-9 pr-4 py-2 rounded-xl bg-accent/30 border border-border text-xs outline-none focus:border-primary/50 transition-colors" />
                        </div>
                    </div>
                </div>

                {/* CONTENT VIEWS */}
                {viewMode === "card" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filtered.map((src, i) => {
                            const kycCfg = KYC_STATUSES.find((s) => s.value === src.kyc_status);
                            const psiCfg = PSI_STATUSES.find((s) => s.value === src.psi_status);
                            const isLowStock = src.min_stock_alert && src.stock_available <= src.min_stock_alert;

                            return (
                                <div key={src.id} onClick={() => handleOpenEdit(src)} className={cn("card-elevated p-5 space-y-4 animate-slide-up cursor-pointer hover:border-emerald-500/50 transition-colors group", `delay-${Math.min(i + 1, 6)}`, isLowStock && "border-amber-500/50 bg-amber-500/5")}>
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", isLowStock ? "bg-amber-500/10" : "bg-emerald-500/10")}>
                                                <Factory className={cn("w-5 h-5", isLowStock ? "text-amber-500" : "text-emerald-500")} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold truncate group-hover:text-emerald-500 transition-colors">{src.name}</p>
                                                <p className="text-[10px] text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{src.region}</p>
                                            </div>
                                        </div>
                                        {isLowStock && <span className="flex items-center gap-1 text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full"><AlertTriangle className="w-3 h-3" /> LOW STOCK</span>}
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <div className="flex flex-wrap gap-1.5">
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-mono text-[10px] font-semibold">GAR {src.spec.gar}</span>
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-accent font-mono text-[10px]">TS {src.spec.ts}%</span>
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-accent font-mono text-[10px]">ASH {src.spec.ash}%</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 text-xs bg-accent/20 p-3 rounded-lg border border-border/50">
                                        <div className="space-y-1 text-[10px]">
                                            <p className="text-muted-foreground uppercase font-semibold">Stock Aval</p>
                                            <p className={cn("font-bold text-sm", isLowStock ? "text-amber-500" : "text-foreground")}>{src.stock_available.toLocaleString()} MT</p>
                                        </div>
                                        <div className="space-y-1 text-[10px]">
                                            <p className="text-muted-foreground uppercase font-semibold">Min Alert</p>
                                            <p className="font-semibold text-sm">{src.min_stock_alert ? `${src.min_stock_alert.toLocaleString()} MT` : "-"}</p>
                                        </div>
                                        <div className="space-y-1 text-[10px]">
                                            <p className="text-muted-foreground uppercase font-semibold">Jetty</p>
                                            <p className="font-medium truncate" title={src.jetty_port}>{src.jetty_port || "-"}</p>
                                        </div>
                                        <div className="space-y-1 text-[10px]">
                                            <p className="text-muted-foreground uppercase font-semibold">FOB Price</p>
                                            <p className="font-mono text-emerald-500 font-medium">{src.fob_barge_price_usd ? `$${src.fob_barge_price_usd}` : "-"}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between text-[10px] pt-1 border-t border-border/30">
                                        <div className="flex gap-2">
                                            <span className="flex items-center gap-1.5 text-muted-foreground"><Shield className="w-3 h-3" /> <span style={{ color: kycCfg?.color }}>{kycCfg?.label}</span></span>
                                            <span className="flex items-center gap-1.5 text-muted-foreground"><FlaskConical className="w-3 h-3" /> <span style={{ color: psiCfg?.color }}>{psiCfg?.label}</span></span>
                                        </div>
                                        {src.pic_name && <span className="text-muted-foreground">PIC: {src.pic_name}</span>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="card-elevated overflow-hidden animate-slide-up">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-accent/30">
                                        <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Source Name</th>
                                        <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Region</th>
                                        <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Jetty Port</th>
                                        <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">GAR</th>
                                        <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">TM%</th>
                                        <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">TS%</th>
                                        <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">ASH%</th>
                                        <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Stock (MT)</th>
                                        <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">FOB Barge (USD)</th>
                                        <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Min Stock Level</th>
                                        <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Landed Cost</th>
                                        <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">PSI</th>
                                        <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Contract</th>
                                        <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase w-16">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((src) => {
                                        const psiCfg = PSI_STATUSES.find((s) => s.value === src.psi_status);
                                        const isLowStock = src.min_stock_alert && src.stock_available <= src.min_stock_alert;

                                        return (
                                            <tr key={src.id} onClick={() => handleOpenEdit(src)} className={cn("border-b border-border/30 hover:bg-accent/20 transition-colors cursor-pointer", isLowStock && "bg-amber-500/5 hover:bg-amber-500/10")}>
                                                <td className="px-4 py-3 font-semibold text-xs text-emerald-500">{src.name}</td>
                                                <td className="px-4 py-3 text-xs">{src.region}</td>
                                                <td className="px-4 py-3 text-xs">{src.jetty_port || "-"}</td>
                                                <td className="px-4 py-3 text-right text-xs font-mono">{src.spec.gar}</td>
                                                <td className="px-4 py-3 text-right text-xs font-mono">{src.spec.tm || "-"}</td>
                                                <td className="px-4 py-3 text-right text-xs font-mono">{src.spec.ts}</td>
                                                <td className="px-4 py-3 text-right text-xs font-mono">{src.spec.ash || "-"}</td>
                                                <td className="px-4 py-3 text-right font-bold text-xs">
                                                    <span className={isLowStock ? "text-amber-500" : "text-foreground"}>{src.stock_available.toLocaleString()}</span>
                                                </td>
                                                <td className="px-4 py-3 text-right text-xs font-mono">{src.fob_barge_price_usd ? `$${safeFmt(src.fob_barge_price_usd)}` : "-"}</td>
                                                <td className="px-4 py-3 text-right text-xs">{src.min_stock_alert ? src.min_stock_alert.toLocaleString() : "-"}</td>
                                                <td className="px-4 py-3 text-right text-xs font-mono text-muted-foreground">{src.fob_barge_price_usd ? `$${safeFmt(safeNum(src.fob_barge_price_usd) + 2.50)}` : "-"}</td>
                                                <td className="px-4 py-3 text-[10px]">
                                                    <span className="px-1.5 py-0.5 rounded" style={{ color: psiCfg?.color, backgroundColor: `${psiCfg?.color}15` }}>{psiCfg?.label}</span>
                                                </td>
                                                <td className="px-4 py-3 text-[10px] text-muted-foreground">{src.contract_type || "Spot"}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <button onClick={(e) => { e.stopPropagation(); handleOpenEdit(src); }} className="text-muted-foreground hover:text-emerald-500">Edit</button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {filtered.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No sources found.</div>}
                    </div>
                )}

                {/* Add / Edit Form Modal */}
                {showForm && (
                    <div className="modal-overlay z-50 fixed inset-0 flex items-center justify-center p-4">
                        <div className="modal-backdrop absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowForm(false)} />
                        <div className="modal-content relative bg-card border border-border w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl animate-scale-in">
                            <div className="sticky top-0 bg-card/90 backdrop-blur border-b border-border/50 p-6 flex justify-between items-center z-10">
                                <div>
                                    <h2 className="text-xl font-bold flex items-center gap-2">
                                        <Factory className="w-5 h-5 text-emerald-500" />
                                        {isEditing ? "Edit Coal Origin" : "Register New Origin"}
                                    </h2>
                                    <p className="text-xs text-muted-foreground mt-1">Complete the supplier and specifications database for accurate logistics mapping.</p>
                                </div>
                                <button onClick={() => setShowForm(false)} className="p-2 hover:bg-accent rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                            </div>

                            <div className="p-6 space-y-8">
                                {/* Section 1: Basic Info */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold flex items-center gap-2 border-b border-border/30 pb-2"><Ship className="w-4 h-4 text-emerald-500" /> Core Details & Location</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                                        <div className="space-y-1.5"><label className="text-[10px] font-semibold text-muted-foreground uppercase">Supplier Name *</label>
                                            <input value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 bg-accent/30 rounded border border-border focus:border-emerald-500/50 outline-none" /></div>
                                        <div className="space-y-1.5"><label className="text-[10px] font-semibold text-muted-foreground uppercase">Region / Province *</label>
                                            <input value={form.region || ""} onChange={e => setForm({ ...form, region: e.target.value })} className="w-full px-3 py-2 bg-accent/30 rounded border border-border focus:border-emerald-500/50 outline-none" /></div>
                                        <div className="space-y-1.5"><label className="text-[10px] font-semibold text-muted-foreground uppercase">IUP / License Number</label>
                                            <input value={form.iup_number || ""} onChange={e => setForm({ ...form, iup_number: e.target.value })} className="w-full px-3 py-2 bg-accent/30 rounded border border-border focus:border-emerald-500/50 outline-none" /></div>
                                        <div className="space-y-1.5"><label className="text-[10px] font-semibold text-muted-foreground uppercase">Jetty Port</label>
                                            <input value={form.jetty_port || ""} onChange={e => setForm({ ...form, jetty_port: e.target.value })} className="w-full px-3 py-2 bg-accent/30 rounded border border-border focus:border-emerald-500/50 outline-none" /></div>
                                        <div className="space-y-1.5"><label className="text-[10px] font-semibold text-muted-foreground uppercase">Anchorage Point</label>
                                            <input value={form.anchorage || ""} onChange={e => setForm({ ...form, anchorage: e.target.value })} className="w-full px-3 py-2 bg-accent/30 rounded border border-border focus:border-emerald-500/50 outline-none" /></div>
                                        <div className="space-y-1.5 pt-6">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" checked={form.requires_transshipment || false} onChange={e => setForm({ ...form, requires_transshipment: e.target.checked })} className="rounded text-emerald-500 focus:ring-emerald-500 bg-accent/30 border-border" />
                                                <span className="text-xs font-semibold">Requires Transshipment Cargo</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Quality Details */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold flex items-center gap-2 border-b border-border/30 pb-2"><FlaskConical className="w-4 h-4 text-emerald-500" /> Quality Specification (Typical)</h3>
                                    <div className="space-y-1.5 mb-4 max-w-sm"><label className="text-[10px] font-semibold text-muted-foreground uppercase">Calorie Range Label (e.g. GAR 4000-4200)</label>
                                        <input value={form.calorie_range || ""} onChange={e => setForm({ ...form, calorie_range: e.target.value })} className="w-full px-3 py-2 bg-accent/30 rounded border border-border focus:border-emerald-500/50 outline-none text-xs" /></div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                                        {[
                                            ["GAR (kcal/kg)", "gar"], ["NAR (kcal/kg)", "nar"], ["ADB (kcal/kg)", "adb"], ["Total Sulphur (%)", "ts"],
                                            ["Ash Content (%)", "ash"], ["Total Moisture (%)", "tm"], ["Inherent Moisture (%)", "im"], ["Fixed Carbon (%)", "fc"]
                                        ].map(([label, key]) => (
                                            <div key={key} className="space-y-1.5">
                                                <label className="text-[10px] font-semibold text-muted-foreground uppercase font-sans">{label}</label>
                                                <input type="number" step="0.01" value={(form.spec as any)?.[key] || ""} onChange={e => setForm({ ...form, spec: { ...form.spec, [key]: Number(e.target.value) } as any })} className="w-full px-3 py-2 bg-accent/30 rounded border border-border focus:border-emerald-500/50 outline-none" />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Section 3: Inventory & Pricing */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold flex items-center gap-2 border-b border-border/30 pb-2"><TrendingUp className="w-4 h-4 text-emerald-500" /> Inventory & Pricing Details</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                                        <div className="space-y-1.5"><label className="text-[10px] font-semibold text-muted-foreground uppercase">Stock Available (MT)</label>
                                            <input type="number" value={form.stock_available || ""} onChange={e => setForm({ ...form, stock_available: Number(e.target.value) })} className="w-full px-3 py-2 bg-accent/30 rounded border border-border focus:border-emerald-500/50 outline-none" /></div>
                                        <div className="space-y-1.5"><label className="text-[10px] font-semibold text-amber-500 uppercase flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Min Stock Alert</label>
                                            <input type="number" value={form.min_stock_alert || ""} onChange={e => setForm({ ...form, min_stock_alert: Number(e.target.value) })} className="w-full px-3 py-2 bg-accent/30 rounded border border-border focus:border-amber-500/50 outline-none" /></div>
                                        <div className="space-y-1.5"><label className="text-[10px] font-semibold text-muted-foreground uppercase">Linked Index Price</label>
                                            <select value={form.price_linked_index || ""} onChange={e => setForm({ ...form, price_linked_index: e.target.value })} className="w-full px-3 py-2 bg-accent/30 rounded border border-border focus:border-emerald-500/50 outline-none">
                                                <option value="">Fixed / Spot</option>
                                                <option value="ICI 1">ICI 1</option><option value="ICI 2">ICI 2</option>
                                                <option value="ICI 3">ICI 3</option><option value="ICI 4">ICI 4</option>
                                                <option value="HBA">HBA</option>
                                            </select></div>
                                        <div className="space-y-1.5"><label className="text-[10px] font-semibold text-emerald-500 uppercase">FOB Barge Price (USD)</label>
                                            <input type="number" step="0.5" value={form.fob_barge_price_usd || ""} onChange={e => setForm({ ...form, fob_barge_price_usd: Number(e.target.value) })} className="w-full px-3 py-2 bg-emerald-500/10 rounded border border-emerald-500/30 focus:border-emerald-500/50 outline-none text-emerald-500 font-mono font-semibold" /></div>
                                    </div>
                                </div>

                                {/* Section 4: Compliance & Contacts */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold flex items-center gap-2 border-b border-border/30 pb-2"><Shield className="w-4 h-4 text-emerald-500" /> Compliance & Operations</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                                        <div className="space-y-1.5"><label className="text-[10px] font-semibold text-muted-foreground uppercase">KYC Status</label>
                                            <select value={form.kyc_status} onChange={e => setForm({ ...form, kyc_status: e.target.value as any })} className="w-full px-3 py-2 bg-accent/30 rounded border border-border focus:border-emerald-500/50 outline-none">
                                                {KYC_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                            </select></div>
                                        <div className="space-y-1.5"><label className="text-[10px] font-semibold text-muted-foreground uppercase">PSI Status</label>
                                            <select value={form.psi_status} onChange={e => setForm({ ...form, psi_status: e.target.value as any })} className="w-full px-3 py-2 bg-accent/30 rounded border border-border focus:border-emerald-500/50 outline-none">
                                                {PSI_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                            </select></div>
                                        <div className="space-y-1.5"><label className="text-[10px] font-semibold text-muted-foreground uppercase">Contact Person</label>
                                            <input value={form.contact_person || ""} onChange={e => setForm({ ...form, contact_person: e.target.value })} className="w-full px-3 py-2 bg-accent/30 rounded border border-border focus:border-emerald-500/50 outline-none" /></div>
                                        <div className="space-y-1.5"><label className="text-[10px] font-semibold text-muted-foreground uppercase">Phone</label>
                                            <input value={form.phone || ""} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 bg-accent/30 rounded border border-border focus:border-emerald-500/50 outline-none" /></div>
                                    </div>
                                    <div className="space-y-1.5 mt-4"><label className="text-[10px] font-semibold text-muted-foreground uppercase">Additional Notes</label>
                                        <textarea rows={3} value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full px-3 py-2 bg-accent/30 rounded border border-border focus:border-emerald-500/50 outline-none resize-none text-xs" /></div>
                                </div>
                            </div>

                            <div className="sticky bottom-0 bg-card/90 backdrop-blur border-t border-border/50 p-6 flex justify-between items-center z-10">
                                {isEditing && form.id ? (
                                    <button onClick={() => handleDelete(form.id!)} className="text-red-500 text-xs font-semibold hover:underline" disabled={isSaving}>Delete Supplier</button>
                                ) : <div />}
                                <div className="flex gap-3">
                                    <button onClick={() => setShowForm(false)} className="px-5 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors font-medium" disabled={isSaving}>Cancel</button>
                                    <button onClick={handleSubmit} className="btn-primary" disabled={!form.name || !form.region || isSaving}>
                                        {isSaving ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Saving...
                                            </>
                                        ) : (
                                            isEditing ? "Save Changes" : "Register Origin"
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                <ReportModal
                    isOpen={showReportModal}
                    onClose={() => setShowReportModal(false)}
                    moduleName="Source"
                    onExport={(format, options) => { console.log(`Exporting sources as ${format}`, options); }}
                />
                {toast && (
                    <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
                )}
            </div>
        </AppShell >
    );
}
