"use client";

import React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useCommercialStore } from "@/store/commercial-store";
import { useAuthStore } from "@/store/auth-store";
import { SALES_DEAL_STATUSES, COUNTRIES, COAL_SPEC_FIELDS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { SalesDeal, SalesDealStatus } from "@/types";
import {
    TrendingUp, Plus, Search, Filter, ChevronDown, X,
    Ship, Globe, MapPin, Package, ArrowUpRight, Eye, Download, Loader2,
    DollarSign, Target, Activity
} from "lucide-react";
import { ReportModal } from "@/components/shared/report-modal";
import { Toast } from "@/components/shared/toast";

const safeNum = (v: number | null | undefined): number => (v != null && !isNaN(v) ? v : 0);
const safeFmt = (v: number | null | undefined, decimals = 2): string => safeNum(v).toFixed(decimals);
const cleanText = (v?: string | null): string => (v || "").replace(/\s+/g, " ").trim();
const normalizeKey = (v?: string | null): string => cleanText(v).toUpperCase();

const extractProjectName = (raw?: string | null): string | null => {
    const text = cleanText(raw);
    if (!text) return null;
    const explicit = text.match(/project\s*:\s*([^\n\r]+)/i);
    if (explicit?.[1]) return cleanText(explicit[1]);
    const code = text.match(/\b([A-Z]{2,}[A-Z0-9_.\-\/]*_\d{2})\b/i);
    if (code?.[1]) return cleanText(code[1]);
    return null;
};

type ProjectSalesStatus =
    | "waiting_approval"
    | "waiting_buyer"
    | "offer_submitted"
    | "confirmed"
    | "in_transit"
    | "completed"
    | "cancelled"
    | "rejected";

const PROJECT_SALES_STATUS_META: Record<ProjectSalesStatus, { label: string; color: string }> = {
    waiting_approval: { label: "Waiting Approval", color: "#f59e0b" },
    waiting_buyer: { label: "Waiting Buyer", color: "#6b7280" },
    offer_submitted: { label: "Offer Submitted", color: "#3b82f6" },
    confirmed: { label: "Confirmed", color: "#10b981" },
    in_transit: { label: "In Transit / Loading", color: "#6366f1" },
    completed: { label: "Completed", color: "#059669" },
    cancelled: { label: "Cancelled", color: "#ef4444" },
    rejected: { label: "Rejected", color: "#f43f5e" },
};

export default function SalesMonitorPage() {
    const [, setIsInitializing] = React.useState(false);

    const { deals, syncFromMemory, addDeal, confirmDeal, shipments, projects } = useCommercialStore();

    React.useEffect(() => {
        syncFromMemory().finally(() => setIsInitializing(false));
    }, [syncFromMemory]);
    const { currentUser } = useAuthStore();
    const [activeTab, setActiveTab] = React.useState<SalesDealStatus | "all">("all");
    const [projectTab, setProjectTab] = React.useState<ProjectSalesStatus | "all">("all");
    const [search, setSearch] = React.useState("");
    const [showForm, setShowForm] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [toast, setToast] = React.useState<{ message: string; type: "success" | "error" } | null>(null);
    const [detailDeal, setDetailDeal] = React.useState<SalesDeal | null>(null);
    const [showReportModal, setShowReportModal] = React.useState(false);

    // Form state
    const [form, setForm] = React.useState({
        buyer: "", buyer_country: "Indonesia", type: "local" as "local" | "export",
        shipping_terms: "FOB" as any, quantity: 0, price_per_mt: 0,
        laycan_start: "", laycan_end: "", vessel_name: "",
        gar: 4200, ts: 0.8, ash: 5.0, tm: 30, notes: "",
    });

    // Metrics Calculation
    const currentRevenue = deals.reduce((sum, d) => sum + ((d.quantity || 0) * (d.price_per_mt || 0)), 0);
    const totalVolume = deals.reduce((sum, d) => sum + (d.quantity || 0), 0);
    const numShipments = shipments.length;
    const avgMargin = deals.length > 0 ? deals.reduce((sum, d) => sum + ((d.price_per_mt || 0) - 45), 0) / deals.length : 0;

    const filtered = deals.filter((d) => {
        if (activeTab !== "all" && d.status !== activeTab) return false;
        if (search) {
            const q = search.toLowerCase();
            return d.buyer.toLowerCase().includes(q) || d.deal_number.toLowerCase().includes(q) || (d.vessel_name && d.vessel_name.toLowerCase().includes(q));
        }
        return true;
    });

    const projectMonitoring = React.useMemo(() => {
        type Roll = {
            projectKey: string;
            projectName: string;
            buyer: string;
            segment: string;
            masterStatus: string;
            salesStatus: ProjectSalesStatus;
            shipmentCount: number;
            dealCount: number;
            qty: number;
            revenue: number;
            mvName: string;
        };

        const statusKey = (s?: string | null) => normalizeKey(s);
        const shipStatusPriority = (rows: any[]): ProjectSalesStatus | null => {
            const joined = rows.map((r) => statusKey(r.status || r.shipment_status)).join(" ");
            if (joined.includes("CANCEL")) return "cancelled";
            if (joined.includes("LOADING") || joined.includes("TRANSIT")) return "in_transit";
            if (joined.includes("COMPLETE") || joined.includes("DONE_SHIPMENT") || joined.includes("DISCHARGE")) return "completed";
            return null;
        };

        const map = new Map<string, Roll>();
        const ensure = (key: string, fallbackName: string): Roll => {
            const existing = map.get(key);
            if (existing) return existing;
            const seed: Roll = {
                projectKey: key,
                projectName: fallbackName,
                buyer: "-",
                segment: "-",
                masterStatus: "",
                salesStatus: "waiting_buyer",
                shipmentCount: 0,
                dealCount: 0,
                qty: 0,
                revenue: 0,
                mvName: "-",
            };
            map.set(key, seed);
            return seed;
        };

        projects.forEach((p) => {
            const key = normalizeKey(p.name);
            if (!key) return;
            const row = ensure(key, cleanText(p.name) || "Unmapped Project");
            row.projectName = cleanText(p.name) || row.projectName;
            row.buyer = cleanText(p.buyer) || row.buyer;
            row.segment = cleanText(p.segment) || row.segment;
            row.masterStatus = cleanText(p.status) || row.masterStatus;
        });

        shipments.forEach((s: any) => {
            const derivedName =
                extractProjectName(s.mv_project_name) ||
                extractProjectName(s.vessel_name) ||
                cleanText(s.mv_project_name) ||
                cleanText(s.vessel_name) ||
                cleanText(s.shipment_number) ||
                "Unmapped Project";
            const key = normalizeKey(derivedName);
            if (!key) return;
            const row = ensure(key, derivedName);
            row.shipmentCount += 1;
            row.qty += safeNum(s.qty_plan || s.quantity_loaded);
            row.revenue += safeNum(s.qty_plan || s.quantity_loaded) * safeNum(s.harga_actual_fob_mv || s.sales_price);
            if (row.buyer === "-" && cleanText(s.buyer)) row.buyer = cleanText(s.buyer);
            if (row.mvName === "-" && cleanText(s.vessel_name || s.mv_project_name)) row.mvName = cleanText(s.vessel_name || s.mv_project_name);
        });

        deals.forEach((d) => {
            const derivedName =
                cleanText(d.project_id) ||
                extractProjectName(d.vessel_name) ||
                cleanText(d.vessel_name) ||
                cleanText(d.deal_number) ||
                "Unmapped Project";
            const key = normalizeKey(derivedName);
            if (!key) return;
            const row = ensure(key, derivedName);
            row.dealCount += 1;
            row.qty += safeNum(d.quantity);
            row.revenue += safeNum(d.quantity) * safeNum(d.price_per_mt);
            if (row.buyer === "-" && cleanText(d.buyer)) row.buyer = cleanText(d.buyer);
            if (row.mvName === "-" && cleanText(d.vessel_name)) row.mvName = cleanText(d.vessel_name);
        });

        const rolls = Array.from(map.values());
        return rolls.map((row) => {
            const master = statusKey(row.masterStatus);
            const dealRows = deals.filter((d) => {
                const dKey = normalizeKey(cleanText(d.project_id) || extractProjectName(d.vessel_name) || cleanText(d.vessel_name) || cleanText(d.deal_number));
                return dKey && dKey === row.projectKey;
            });
            const shipRows = shipments.filter((s: any) => {
                const sName =
                    extractProjectName(s.mv_project_name) ||
                    extractProjectName(s.vessel_name) ||
                    cleanText(s.mv_project_name) ||
                    cleanText(s.vessel_name) ||
                    cleanText(s.shipment_number);
                const sKey = normalizeKey(sName);
                return sKey && sKey === row.projectKey;
            });

            let salesStatus: ProjectSalesStatus = "waiting_buyer";
            if (master.includes("WAITING") || master.includes("PENDING_APPROVAL")) salesStatus = "waiting_approval";
            else if (master.includes("REJECT")) salesStatus = "rejected";
            else {
                const shipmentStatus = shipStatusPriority(shipRows);
                if (shipmentStatus) salesStatus = shipmentStatus;
                else if (dealRows.some((d) => d.status === "confirmed")) salesStatus = "confirmed";
                else if (dealRows.some((d) => d.status === "pre_sale" || d.status === "forecast")) salesStatus = "offer_submitted";
                else if (row.buyer === "-" || !cleanText(row.buyer)) salesStatus = "waiting_buyer";
            }

            return { ...row, salesStatus };
        }).sort((a, b) => b.qty - a.qty);
    }, [projects, shipments, deals]);

    const filteredProjectMonitoring = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        return projectMonitoring.filter((p) => {
            if (projectTab !== "all" && p.salesStatus !== projectTab) return false;
            if (!q) return true;
            return [p.projectName, p.buyer, p.segment, p.mvName].some((x) => (x || "").toLowerCase().includes(q));
        });
    }, [projectMonitoring, projectTab, search]);

    const handleSubmit = async () => {
        if (!form.buyer || form.quantity <= 0) {
            setToast({ message: "Please fill in buyer and quantity", type: "error" });
            return;
        }
        setIsSaving(true);
        try {
            await addDeal({
                status: "pre_sale",
                buyer: form.buyer,
                buyer_country: form.buyer_country,
                type: form.type,
                shipping_terms: form.shipping_terms,
                quantity: form.quantity,
                price_per_mt: form.price_per_mt,
                laycan_start: form.laycan_start,
                laycan_end: form.laycan_end,
                vessel_name: form.vessel_name,
                spec: { gar: form.gar, ts: form.ts, ash: form.ash, tm: form.tm },
                notes: form.notes,
                created_by: currentUser?.id || "system",
                created_by_name: currentUser?.name || "System",
            });
            setToast({ message: "Sales deal created successfully!", type: "success" });
            setShowForm(false);
            setForm({
                buyer: "", buyer_country: "Indonesia", type: "local",
                shipping_terms: "FOB" as any, quantity: 0, price_per_mt: 0,
                laycan_start: "", laycan_end: "", vessel_name: "",
                gar: 4200, ts: 0.8, ash: 5.0, tm: 30, notes: "",
            });
        } catch (error) {
            setToast({ message: "Failed to create sales deal", type: "error" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleConfirm = async (id: string) => {
        setIsSaving(true);
        try {
            await confirmDeal(id);
            setToast({ message: "Deal confirmed and flowing to Projects!", type: "success" });
        } catch (error) {
            setToast({ message: "Failed to confirm deal", type: "error" });
        } finally {
            setIsSaving(false);
        }
    };


    return (
        <AppShell>
            <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6">
                {/* Module Summary */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fade-in relative z-20">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Sales Monitor</h1>
                        <p className="text-sm text-muted-foreground mt-1">Project-centric sales monitoring with deal-level tracking.</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setShowForm(!showForm)} className="btn-primary h-9"><Plus className="w-4 h-4 mr-1.5" /> New Deal</button>
                        <button onClick={() => setShowReportModal(true)} className="btn-outline text-xs h-9 hidden sm:flex"><Download className="w-3.5 h-3.5 mr-1.5" /> Download Report</button>
                    </div>
                </div>

                {/* Metrics Summary Header (Moved from Sales Plan) */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up relative z-10">
                    <div className="card-elevated p-5 relative overflow-hidden group border-l-4 border-emerald-500">
                        <div className="flex items-center gap-2 text-muted-foreground mb-3">
                            <DollarSign className="w-4 h-4 text-emerald-500" />
                            <span className="text-[10px] font-bold uppercase">Estimated Revenue</span>
                        </div>
                        <p className="text-2xl font-bold font-mono text-emerald-500">${currentRevenue.toLocaleString()}</p>
                    </div>
                    <div className="card-elevated p-5 relative overflow-hidden group border-l-4 border-blue-500">
                        <div className="flex items-center gap-2 text-muted-foreground mb-3">
                            <Package className="w-4 h-4 text-blue-500" />
                            <span className="text-[10px] font-bold uppercase">Total Volume (MT)</span>
                        </div>
                        <p className="text-2xl font-bold font-mono">{totalVolume.toLocaleString()}</p>
                    </div>
                    <div className="card-elevated p-5 relative overflow-hidden group border-l-4 border-amber-500">
                        <div className="flex items-center gap-2 text-muted-foreground mb-3">
                            <Ship className="w-4 h-4 text-amber-500" />
                            <span className="text-[10px] font-bold uppercase">Active Shipments</span>
                        </div>
                        <p className="text-2xl font-bold font-mono text-amber-500">{numShipments}</p>
                    </div>
                    <div className="card-elevated p-5 relative overflow-hidden group border-l-4 border-violet-500">
                        <div className="flex items-center gap-2 text-muted-foreground mb-3">
                            <TrendingUp className="w-4 h-4 text-violet-500" />
                            <span className="text-[10px] font-bold uppercase">Avg Margin/MT</span>
                        </div>
                        <p className="text-2xl font-bold font-mono text-violet-400">${safeFmt(Math.max(0, avgMargin))}</p>
                    </div>
                </div>

                {/* Status Tabs */}
                <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => setActiveTab("all")} className={cn("filter-chip", activeTab === "all" ? "filter-chip-active" : "filter-chip-inactive")}>
                        All ({deals.length})
                    </button>
                    {SALES_DEAL_STATUSES.map((s) => (
                        <button key={s.value} onClick={() => setActiveTab(s.value as any)} className={cn("filter-chip", activeTab === s.value ? "filter-chip-active" : "filter-chip-inactive")}>
                            {s.label} ({deals.filter((d) => d.status === s.value).length})
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search buyer, deal number, vessel..."
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-accent/50 border border-border text-sm outline-none focus:border-primary/50 transition-colors" />
                </div>

                {/* Project-Centric Sales Monitoring */}
                <div className="card-elevated p-4 md:p-5 space-y-4 animate-slide-up">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-semibold">Project Sales Monitoring</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">Status sales per project (base on Project + Shipment + Deal)</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={() => setProjectTab("all")}
                                className={cn("filter-chip", projectTab === "all" ? "filter-chip-active" : "filter-chip-inactive")}
                            >
                                All ({projectMonitoring.length})
                            </button>
                            {(Object.keys(PROJECT_SALES_STATUS_META) as ProjectSalesStatus[]).map((st) => (
                                <button
                                    key={st}
                                    onClick={() => setProjectTab(st)}
                                    className={cn("filter-chip", projectTab === st ? "filter-chip-active" : "filter-chip-inactive")}
                                >
                                    {PROJECT_SALES_STATUS_META[st].label} ({projectMonitoring.filter((p) => p.salesStatus === st).length})
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-accent/20">
                                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Project</th>
                                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Buyer / Segment</th>
                                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Sales Status</th>
                                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Deals</th>
                                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Shipments</th>
                                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Volume (MT)</th>
                                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Revenue</th>
                                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredProjectMonitoring.map((p) => {
                                    const st = PROJECT_SALES_STATUS_META[p.salesStatus];
                                    return (
                                        <tr key={p.projectKey} className="border-b border-border/40 hover:bg-accent/20 transition-colors">
                                            <td className="px-3 py-2">
                                                <p className="text-xs font-semibold text-primary">{p.projectName}</p>
                                                <p className="text-[10px] text-muted-foreground">{p.mvName || "-"}</p>
                                            </td>
                                            <td className="px-3 py-2">
                                                <p className="text-xs">{p.buyer || "-"}</p>
                                                <p className="text-[10px] text-muted-foreground">{p.segment || "-"}</p>
                                            </td>
                                            <td className="px-3 py-2">
                                                <span className="status-badge text-[10px]" style={{ color: st.color, backgroundColor: `${st.color}15` }}>
                                                    {st.label}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-right text-xs font-semibold">{p.dealCount}</td>
                                            <td className="px-3 py-2 text-right text-xs font-semibold">{p.shipmentCount}</td>
                                            <td className="px-3 py-2 text-right text-xs font-semibold">{Math.round(p.qty).toLocaleString()}</td>
                                            <td className="px-3 py-2 text-right text-xs font-semibold">${Math.round(p.revenue).toLocaleString()}</td>
                                            <td className="px-3 py-2 text-right">
                                                <a href={`/projects?q=${encodeURIComponent(p.projectName)}`} className="text-[11px] text-primary hover:underline font-semibold">
                                                    View
                                                </a>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {filteredProjectMonitoring.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">No project monitoring rows matched your filters.</p>
                    )}
                </div>

                {/* New Deal Form (Rich Fields) */}
                {showForm && (
                    <div className="card-elevated p-5 space-y-4 animate-scale-in border border-primary/20 bg-primary/5">
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-semibold text-primary">Add New Sales Deal</h3>
                            <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-accent"><X className="w-4 h-4" /></button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Buyer Name</label>
                                <input value={form.buyer} onChange={e => setForm({ ...form, buyer: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs outline-none focus:border-primary/50" /></div>

                            <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Country</label>
                                <select value={form.buyer_country} onChange={e => setForm({ ...form, buyer_country: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs outline-none">
                                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select></div>

                            <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Type</label>
                                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as any })} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs outline-none">
                                    <option value="export">Export</option><option value="local">Local</option>
                                </select></div>

                            <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Shipping Terms</label>
                                <select value={form.shipping_terms} onChange={e => setForm({ ...form, shipping_terms: e.target.value as any })} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs outline-none">
                                    <option value="FOB">FOB</option><option value="CIF">CIF</option><option value="CFR">CFR</option>
                                </select></div>

                            <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Quantity (MT)</label>
                                <input type="number" value={form.quantity || ""} onChange={e => setForm({ ...form, quantity: +e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs outline-none" /></div>

                            <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Price / MT (USD)</label>
                                <input type="number" step="0.5" value={form.price_per_mt || ""} onChange={e => setForm({ ...form, price_per_mt: +e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs outline-none" /></div>

                            <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Laycan Start</label>
                                <input type="date" value={form.laycan_start} onChange={e => setForm({ ...form, laycan_start: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs outline-none" /></div>

                            <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Vessel Name</label>
                                <input value={form.vessel_name} onChange={e => setForm({ ...form, vessel_name: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs outline-none" placeholder="TBN" /></div>
                        </div>

                        <div className="pt-2 border-t border-border/50">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase mb-2 block">Specifications (Target Quality)</label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="space-y-1"><label className="text-[10px] font-semibold text-muted-foreground">GAR</label>
                                    <input type="number" value={form.gar} onChange={e => setForm({ ...form, gar: +e.target.value })} className="w-full px-2 py-1.5 rounded-lg bg-background border border-border text-xs" /></div>
                                <div className="space-y-1"><label className="text-[10px] font-semibold text-muted-foreground">TS (%)</label>
                                    <input type="number" step="0.01" value={form.ts} onChange={e => setForm({ ...form, ts: +e.target.value })} className="w-full px-2 py-1.5 rounded-lg bg-background border border-border text-xs" /></div>
                                <div className="space-y-1"><label className="text-[10px] font-semibold text-muted-foreground">ASH (%)</label>
                                    <input type="number" step="0.1" value={form.ash} onChange={e => setForm({ ...form, ash: +e.target.value })} className="w-full px-2 py-1.5 rounded-lg bg-background border border-border text-xs" /></div>
                                <div className="space-y-1"><label className="text-[10px] font-semibold text-muted-foreground">TM (%)</label>
                                    <input type="number" step="0.1" value={form.tm} onChange={e => setForm({ ...form, tm: +e.target.value })} className="w-full px-2 py-1.5 rounded-lg bg-background border border-border text-xs" /></div>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button onClick={handleSubmit} className="btn-primary" disabled={isSaving}>
                                {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : <><Plus className="w-4 h-4 mr-1" /> Save Deal</>}
                            </button>
                            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors" disabled={isSaving}>Cancel</button>
                        </div>
                    </div>
                )}

                {/* Deals Table */}
                <div className="card-elevated overflow-hidden animate-slide-up">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-accent/30">
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Buyer</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Qty (MT)</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Price / MT</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Laycan</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Status</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((d) => {
                                    const stCfg = SALES_DEAL_STATUSES.find((s) => s.value === d.status);
                                    return (
                                        <tr key={d.id} className="border-b border-border/50 hover:bg-accent/20 transition-colors">
                                            <td className="px-4 py-3">
                                                <p className="font-semibold text-xs text-primary">{d.buyer}</p>
                                                <p className="text-[10px] text-muted-foreground">{d.deal_number} • {d.buyer_country}</p>
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-xs font-semibold">{d.quantity?.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right font-mono text-xs font-semibold">${d.price_per_mt?.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-xs text-muted-foreground">{d.laycan_start || "-"}</td>
                                            <td className="px-4 py-3">
                                                <span className="status-badge text-[10px]" style={{ color: stCfg?.color, backgroundColor: `${stCfg?.color}15` }}>
                                                    {stCfg?.label.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <select
                                                        value={d.status}
                                                        onChange={(e) => useCommercialStore.getState().updateDealStatus(d.id, e.target.value as any)}
                                                        className="text-[10px] font-bold bg-accent/50 border border-border rounded-md px-2 py-1 outline-none focus:border-primary/50 cursor-pointer appearance-none hover:bg-accent transition-colors"
                                                    >
                                                        <option value="pre_sale">PRE-SALE</option>
                                                        <option value="confirmed">CONFIRMED</option>
                                                        <option value="forecast">FORECAST</option>
                                                    </select>
                                                    <button onClick={() => setDetailDeal(d)} className="p-1.5 rounded-lg hover:bg-accent transition-colors" title="View Detail">
                                                        <Eye className="w-4 h-4 text-muted-foreground" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-12">No sales deals matched your filters.</p>}
                </div>

                {/* Detail Modal */}
                {detailDeal && (
                    <div className="modal-overlay">
                        <div className="modal-backdrop" onClick={() => setDetailDeal(null)} />
                        <div className="modal-content bg-card border border-border rounded-xl shadow-lg p-6 max-w-lg w-full">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-lg font-bold">{detailDeal.buyer}</h2>
                                    <p className="text-xs text-muted-foreground font-mono">{detailDeal.deal_number}</p>
                                </div>
                                <button onClick={() => setDetailDeal(null)} className="p-1 rounded-lg hover:bg-accent"><X className="w-4 h-4" /></button>
                            </div>

                            <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                                {[
                                    ["Status", detailDeal.status.toUpperCase()],
                                    ["Type", detailDeal.type.toUpperCase()],
                                    ["Shipping Terms", detailDeal.shipping_terms],
                                    ["Buyer Country", detailDeal.buyer_country || "-"],
                                    ["Quantity", `${detailDeal.quantity?.toLocaleString()} MT`],
                                    ["Price / MT", `$${detailDeal.price_per_mt?.toLocaleString()}`],
                                    ["Vessel", detailDeal.vessel_name || "TBN"],
                                    ["Laycan POL", detailDeal.laycan_start || "-"],
                                ].map(([k, v]) => (
                                    <div key={k} className="border-b border-border/30 pb-1.5">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase mb-0.5">{k}</p>
                                        <p className="font-semibold">{v}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-6 pt-4 border-t border-border/50">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-3">Technical Specifications</p>
                                <div className="grid grid-cols-4 gap-2">
                                    {COAL_SPEC_FIELDS.map(f => {
                                        const val = (detailDeal.spec as any)?.[f.key];
                                        if (val === undefined || val === null) return null;
                                        return (
                                            <div key={f.key} className="p-2 rounded-lg bg-accent/30 text-center">
                                                <p className="text-[10px] font-bold text-muted-foreground">{f.label}</p>
                                                <p className="text-xs font-bold">{val}{f.unit}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <ReportModal
                    isOpen={showReportModal}
                    onClose={() => setShowReportModal(false)}
                    moduleName="Sales Monitor"
                    onExport={(format, options) => {
                        console.log(`Exporting sales data as ${format}`, options);
                        setToast({ message: `Exporting as ${format.toUpperCase()}...`, type: "success" });
                    }}
                />
                {toast && (
                    <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
                )}
            </div>
        </AppShell>
    );
}
