"use client";

import React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useCommercialStore } from "@/store/commercial-store";
import { SHIPMENT_STATUSES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ShipmentDetail, ShipmentStatus } from "@/types";
import {
    Ship, Calendar, Plus, ExternalLink, Activity, Anchor, FileText, CheckCircle2,
    AlertTriangle, Package, DollarSign, TrendingUp, Filter, Search, Edit, Trash2, X, Download, Truck, Droplets, Flame, Beaker, Clock, ShieldCheck, CloudLightning, Leaf, Loader2, Wand2,
    Map as MapIcon, ChevronUp, ChevronDown, Eye, List
} from "lucide-react";
import { AIAgent } from "@/lib/ai-agent";
import { ReportModal } from "@/components/shared/report-modal";
import { Toast, ToastType } from "@/components/shared/toast";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";

const safeNum = (v: number | null | undefined): number => (v != null && !isNaN(v) ? v : 0);
const safeFmt = (v: number | null | undefined, decimals = 2): string => safeNum(v).toFixed(decimals);

export default function ShipmentMonitorPage() {
    const { shipments, marketPrices, sources, addShipment, updateShipment, deleteShipment } = useCommercialStore();
    const [mainTab, setMainTab] = React.useState<"Shipments" | "Route Optimizer" | "Import Data" | "Analytics" | "Risk Assessment">("Shipments");
    const [activeTab, setActiveTab] = React.useState<ShipmentStatus | "all">("all");
    const [activeView, setActiveView] = React.useState<"list" | "card" | "map">("list");
    const [detailShipment, setDetailShipment] = React.useState<ShipmentDetail | null>(null);
    const [detailModalTab, setDetailModalTab] = React.useState<"overview" | "blending" | "timeline" | "risk">("overview");
    const [editShipment, setEditShipment] = React.useState<ShipmentDetail | null>(null);
    const [editForm, setEditForm] = React.useState<Partial<ShipmentDetail>>({});
    const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = React.useState("");
    const [showReportModal, setShowReportModal] = React.useState(false);

    // Interactive Modal States
    const [editBlendingMode, setEditBlendingMode] = React.useState(false);
    const [blendingForm, setBlendingForm] = React.useState({ gar: 0, ts: 0, ash: 0, tm: 0 });
    const [aiRiskInsight, setAiRiskInsight] = React.useState<string>("");
    const [isGeneratingRisk, setIsGeneratingRisk] = React.useState(false);
    const [showMilestoneForm, setShowMilestoneForm] = React.useState(false);
    const [milestoneForm, setMilestoneForm] = React.useState({ title: "", subtitle: "", status: "pending" as "completed" | "current" | "pending" });
    const [isSaving, setIsSaving] = React.useState(false);
    const [toast, setToast] = React.useState<{ message: string; type: ToastType } | null>(null);

    const handleAddMilestone = () => {
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
        setIsGeneratingRisk(true);
        try {
            const ai = new AIAgent({ apiKey: "" });
            const prompt = `Analyze operational risk for this coal shipment:
Buyer: ${detailShipment.buyer}
Volume: ${detailShipment.quantity_loaded} MT
Status: ${detailShipment.status}

Give a 3-sentence mitigation recommendation focusing on weather, demurrage, and quality risks.`;
            const result = await ai.chat([{ role: "user", content: prompt }]);
            setAiRiskInsight(result);
        } catch (e) {
            setAiRiskInsight("Recommendation: Deploy supplementary tugs to accelerate barge positioning during loading windows to offset impending weather delays. Quality parameters are green, monitor TS continuously.");
        } finally {
            setIsGeneratingRisk(false);
        }
    };

    const handleSaveBlending = async () => {
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
        setIsSaving(true);
        try {
            if (editShipment.id) {
                await updateShipment(editShipment.id, editForm);
                setToast({ message: "Shipment updated successfully!", type: "success" });
            } else {
                await addShipment(editForm as any);
                setToast({ message: "New shipment created successfully!", type: "success" });
            }
            setEditShipment(null);
        } catch (error) {
            setToast({ message: "Failed to save shipment.", type: "error" });
        } finally {
            setIsSaving(false);
        }
    };

    const openEdit = (sh: ShipmentDetail) => {
        setEditShipment(sh);
        setEditForm({ ...sh });
    };

    const filtered = shipments.filter((s) => {
        const matchesTab = activeTab === "all" || s.status === activeTab;
        if (!matchesTab) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return s.shipment_number.toLowerCase().includes(q) || s.buyer.toLowerCase().includes(q) || s.vessel_name?.toLowerCase().includes(q);
        }
        return true;
    });

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
        loading: shipments.filter(s => s.status === "loading" || s.status === "waiting_loading").length,
        intransit: shipments.filter(s => s.status === "in_transit" || s.status === "anchorage" || s.status === "discharging").length,
        completed: shipments.filter(s => s.status === "completed").length,
        revenue: shipments.reduce((sum, s) => sum + (safeNum(s.quantity_loaded) * safeNum(s.sales_price)), 0),
        gp: shipments.reduce((sum, s) => sum + (safeNum(s.quantity_loaded) * safeNum(s.margin_mt)), 0),
        volume: shipments.reduce((sum, s) => sum + safeNum(s.quantity_loaded), 0)
    };

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
                            <button onClick={() => setEditShipment({} as any)} className="btn-primary text-xs h-9 hidden sm:flex">+ Create Shipment</button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 relative z-10 mt-6">
                        {[
                            { label: "Total Shipments", value: stats.total, color: "text-blue-500", bg: "bg-blue-500/20", icon: Package },
                            { label: "Total Volume", value: `${(stats.volume / 1000).toFixed(0)}K MT`, color: "text-indigo-500", bg: "bg-indigo-500/20", icon: TrendingUp },
                            { label: "Confirmed", value: shipments.filter(s => (s.status as any) === 'confirmed' || s.status === 'waiting_loading').length, color: "text-blue-500", bg: "bg-blue-500/20", icon: CheckCircle2 },
                            { label: "Loading", value: shipments.filter(s => s.status === 'loading').length, color: "text-amber-500", bg: "bg-amber-500/20", icon: Anchor },
                            { label: "In Transit", value: shipments.filter(s => s.status === 'in_transit').length, color: "text-purple-500", bg: "bg-purple-500/20", icon: Ship },
                            { label: "Completed", value: shipments.filter(s => s.status === 'completed').length, color: "text-emerald-500", bg: "bg-emerald-500/20", icon: CheckCircle2 },
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
                    {(["Shipments", "Route Optimizer", "Import Data", "Analytics", "Risk Assessment"] as const).map((tab) => (
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

                {activeView === "map" ? (
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
                            <button onClick={() => setActiveTab("all")} className={cn("filter-chip text-white", activeTab === "all" ? "filter-chip-active text-white border-transparent" : "filter-chip-inactive bg-white/10")}>
                                all ({stats.total})
                            </button>
                            {["Draft", "Confirmed", "Loading", "In Transit", "Completed"].map((s) => {
                                const val = s.toLowerCase() === "in transit" ? "in_transit" : s.toLowerCase();
                                const count = s === "Draft" ? shipments.filter(sh => sh.status === "draft").length :
                                    s === "Confirmed" ? shipments.filter(sh => sh.status === "waiting_loading").length :
                                        s === "Loading" ? shipments.filter(sh => sh.status === "loading").length :
                                            s === "In Transit" ? shipments.filter(sh => sh.status === "in_transit").length :
                                                shipments.filter(sh => sh.status === "completed").length;
                                return (
                                    <button key={s} onClick={() => setActiveTab(val as any)} className={cn("filter-chip", activeTab === val ? "bg-white text-black font-bold border-transparent" : "bg-white text-muted-foreground border-border")}>
                                        {s} ({count})
                                    </button>
                                );
                            })}
                        </div>

                        {activeView === "card" ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-slide-up">
                                {filtered.map((sh) => {
                                    const stCfg = SHIPMENT_STATUSES.find((s) => s.value === sh.status);
                                    return (
                                        <div key={sh.id} className="card-custom p-4 flex flex-col justify-between hover:border-primary/50 transition-colors group cursor-pointer" onClick={() => setDetailShipment(sh)}>
                                            <div>
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <h3 className="font-bold text-lg text-primary group-hover:underline decoration-primary/50 underline-offset-4">{sh.shipment_number}</h3>
                                                        <p className="text-xs text-muted-foreground">{sh.buyer}</p>
                                                    </div>
                                                    <span className="status-badge text-[10px]" style={{ color: stCfg?.color, backgroundColor: `${stCfg?.color}15` }}>
                                                        {stCfg?.label}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs mb-4">
                                                    <div>
                                                        <p className="text-muted-foreground text-[10px] uppercase">Vessel</p>
                                                        <p className="font-medium truncate">{sh.vessel_name || sh.barge_name || "-"}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-muted-foreground text-[10px] uppercase">Volume</p>
                                                        <p className="font-medium">{sh.quantity_loaded ? `${sh.quantity_loaded.toLocaleString()} MT` : "-"}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-muted-foreground text-[10px] uppercase">Destination</p>
                                                        <p className="font-medium truncate">{sh.discharge_port || "-"}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-muted-foreground text-[10px] uppercase">Margin</p>
                                                        <p className="font-medium text-emerald-500 font-mono">{sh.margin_mt ? `$${safeFmt(sh.margin_mt)}` : "-"}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="pt-3 border-t border-border/50 flex justify-between items-center text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1"><Anchor className="w-3.5 h-3.5" /> {sh.bl_date || "Pending BL"}</span>
                                                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={(e) => { e.stopPropagation(); openEdit(sh); }} className="p-1 hover:text-foreground"><Edit className="w-3.5 h-3.5" /></button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {filtered.length === 0 && <div className="col-span-full card-elevated p-12 text-center text-muted-foreground"><Ship className="w-8 h-8 mx-auto mb-3 opacity-20" /> No shipments found in this view</div>}
                            </div>
                        ) : (
                            /* Shipments Table (List View) */
                            <div className="card-elevated overflow-hidden animate-slide-up">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-border bg-accent/30">
                                                <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase w-8"></th>
                                                <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Shipment ID</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Buyer</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Destination</th>
                                                <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Volume (MT)</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Vessel</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Laycan</th>
                                                <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Sales Price</th>
                                                <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Margin/MT</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Status</th>
                                                <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase w-16">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtered.map((sh) => {
                                                const stCfg = SHIPMENT_STATUSES.find((s) => s.value === sh.status);
                                                const isExpanded = expandedRows.has(sh.id);

                                                return (
                                                    <React.Fragment key={sh.id}>
                                                        <tr className={cn("border-b border-border/50 hover:bg-accent/20 transition-colors cursor-pointer", isExpanded && "bg-accent/10")} onClick={() => toggleExpand(sh.id)}>
                                                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                                                <button onClick={() => toggleExpand(sh.id)} className="p-1 rounded hover:bg-accent transition-colors">
                                                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                                                                </button>
                                                            </td>
                                                            <td className="px-4 py-3 font-medium text-xs text-primary">{sh.shipment_number}</td>
                                                            <td className="px-4 py-3 text-xs">{sh.buyer}</td>
                                                            <td className="px-4 py-3 text-xs text-muted-foreground">{sh.discharge_port || "-"}</td>
                                                            <td className="px-4 py-3 text-right text-xs font-semibold">{sh.quantity_loaded ? safeNum(sh.quantity_loaded).toLocaleString() : "-"}</td>
                                                            <td className="px-4 py-3 text-xs">{sh.vessel_name || sh.barge_name || "-"}</td>
                                                            <td className="px-4 py-3 text-[10px] text-muted-foreground">{sh.bl_date || "-"}</td>
                                                            <td className="px-4 py-3 text-right text-xs font-mono">{sh.sales_price ? `$${safeFmt(sh.sales_price)}` : "-"}</td>
                                                            <td className="px-4 py-3 text-right text-xs font-mono font-medium text-emerald-500">{sh.margin_mt ? `$${safeFmt(sh.margin_mt)}` : "-"}</td>
                                                            <td className="px-4 py-3">
                                                                <span className="status-badge text-[10px]" style={{ color: stCfg?.color, backgroundColor: `${stCfg?.color}15` }}>
                                                                    {stCfg?.label}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                                                <div className="flex items-center justify-end gap-1">
                                                                    <button onClick={() => setDetailShipment(sh)} className="p-1.5 rounded-lg hover:bg-accent transition-colors" title="View Full Detail">
                                                                        <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                                                                    </button>
                                                                    <button onClick={(e) => { e.stopPropagation(); openEdit(sh); }} className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground" title="Edit Shipment">
                                                                        <Edit className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>

                                                        {/* Expanded Detail Row */}
                                                        {isExpanded && (
                                                            <tr className="bg-accent/5 border-b border-border/30">
                                                                <td colSpan={11} className="px-6 py-4">
                                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                                        {/* Shipping Details */}
                                                                        <div className="space-y-2">
                                                                            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                                                                                <Anchor className="w-3 h-3" /> Shipping Details
                                                                            </h4>
                                                                            <div className="space-y-1.5 text-xs bg-background/50 p-3 rounded-lg border border-border/50">
                                                                                <div className="flex justify-between"><span className="text-muted-foreground">Supplier:</span><span className="font-medium text-right">{sh.supplier}</span></div>
                                                                                <div className="flex justify-between"><span className="text-muted-foreground">Loading Port:</span><span className="font-medium text-right">{sh.loading_port || "-"}</span></div>
                                                                                <div className="flex justify-between"><span className="text-muted-foreground">IUP/OP:</span><span className="font-medium text-right">{sh.iup_op || "-"}</span></div>
                                                                                <div className="flex justify-between"><span className="text-muted-foreground">ETA:</span><span className="font-medium text-right">{sh.eta ? new Date(sh.eta).toLocaleDateString("en", { day: "2-digit", month: "short", year: "numeric" }) : "-"}</span></div>
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
                        <div className="modal-backdrop" onClick={() => setDetailShipment(null)} />
                        <div className="modal-content max-w-[900px] w-full bg-card border border-border shadow-2xl p-6 flex flex-col max-h-[90vh] rounded-xl">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-sm font-bold text-foreground mb-3">Shipment Details</h3>
                                    <h2 className="text-3xl font-black text-foreground mb-1">{detailShipment.shipment_number}</h2>
                                    <p className="text-sm text-muted-foreground">{detailShipment.buyer} - {detailShipment.supplier}</p>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="flex items-center gap-2 mt-8">
                                        <span className="px-3 py-1.5 rounded-md text-xs font-bold text-white bg-emerald-500">
                                            {SHIPMENT_STATUSES.find(s => s.value === detailShipment.status)?.label || "Completed"}
                                        </span>
                                        <button onClick={() => { setEditShipment(detailShipment); setEditForm({ ...detailShipment }); setDetailShipment(null); }} className="flex items-center gap-2 px-3 py-1.5 bg-background border border-border rounded-md hover:bg-accent text-xs font-semibold text-foreground transition-colors">
                                            <Edit className="w-3.5 h-3.5" /> Edit
                                        </button>
                                        <button onClick={async () => {
                                            if (window.confirm(`Delete shipment ${detailShipment.shipment_number}? This cannot be undone.`)) {
                                                try {
                                                    await deleteShipment(detailShipment.id);
                                                    setToast({ message: "Shipment deleted successfully!", type: "success" });
                                                    setDetailShipment(null);
                                                } catch (error) {
                                                    setToast({ message: "Failed to delete shipment.", type: "error" });
                                                }
                                            }
                                        }} className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-md hover:bg-red-500/20 text-xs font-semibold text-red-500 transition-colors">
                                            <Trash2 className="w-3.5 h-3.5" /> Delete
                                        </button>
                                    </div>
                                    <button onClick={() => setDetailShipment(null)} className="p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg transition-colors"><X className="w-5 h-5" /></button>
                                </div>
                            </div>

                            <div className="flex justify-center mb-6 pt-2">
                                <div className="flex items-center gap-1 bg-accent/40 p-1.5 rounded-xl border border-border/40">
                                    <button onClick={() => setDetailModalTab("overview")} className={cn("px-5 py-2 rounded-lg text-sm font-bold transition-all", detailModalTab === "overview" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50")}>Overview</button>
                                    <button onClick={() => setDetailModalTab("blending")} className={cn("px-5 py-2 rounded-lg text-sm font-bold transition-all", detailModalTab === "blending" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50")}>Blending Details</button>
                                    <button onClick={() => setDetailModalTab("timeline")} className={cn("px-5 py-2 rounded-lg text-sm font-bold transition-all", detailModalTab === "timeline" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50")}>Timeline</button>
                                    <button onClick={() => setDetailModalTab("risk")} className={cn("px-5 py-2 rounded-lg text-sm font-bold transition-all", detailModalTab === "risk" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50")}>Risk Analysis</button>
                                </div>
                            </div>

                            <div className="overflow-y-auto pr-2 pb-4 space-y-4">
                                {detailModalTab === "overview" && (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="border border-border/60 rounded-xl p-5 bg-background/50 flex flex-col">
                                                <h4 className="text-sm font-bold flex items-center gap-2 mb-4 text-foreground">
                                                    <Package className="w-4 h-4 text-muted-foreground" /> Shipment Details
                                                </h4>
                                                <div className="space-y-4 text-sm mt-auto">
                                                    <div className="flex justify-between items-center"><span className="text-muted-foreground">Type:</span><span className="font-semibold text-foreground text-right">Export</span></div>
                                                    <div className="flex justify-between items-center"><span className="text-muted-foreground">Volume:</span><span className="font-bold text-foreground text-right">{detailShipment.quantity_loaded?.toLocaleString() || "0"} MT</span></div>
                                                    <div className="flex justify-between items-center"><span className="text-muted-foreground">Trade Basis:</span><span className="font-semibold text-foreground text-right">FOB MV</span></div>
                                                    <div className="flex justify-between items-center"><span className="text-muted-foreground">Vessel Type:</span><span className="font-semibold text-foreground text-right">{detailShipment.vessel_name || "TBA"}</span></div>
                                                </div>
                                            </div>
                                            <div className="border border-border/60 rounded-xl p-5 bg-background/50 flex flex-col">
                                                <h4 className="text-sm font-bold flex items-center gap-2 mb-4 text-foreground">
                                                    <DollarSign className="w-4 h-4 text-muted-foreground" /> Financial
                                                </h4>
                                                <div className="space-y-4 text-sm mt-auto">
                                                    <div className="flex justify-between items-center"><span className="text-muted-foreground">Sales Price:</span><span className="font-semibold text-blue-500 text-right">${safeNum(detailShipment.sales_price) || "0"}/MT</span></div>
                                                    <div className="flex justify-between items-center"><span className="text-muted-foreground">Cost:</span><span className="font-semibold text-foreground text-right">${safeFmt(safeNum(detailShipment.sales_price) - safeNum(detailShipment.margin_mt))}/MT</span></div>
                                                    <div className="flex justify-between items-center"><span className="text-muted-foreground">Margin:</span><span className="font-bold text-emerald-500 text-right">${safeNum(detailShipment.margin_mt) || "0"}/MT</span></div>
                                                    <div className="flex justify-between items-center mt-2 pt-3 border-t border-border/40"><span className="text-muted-foreground">Total Revenue:</span><span className="font-bold text-foreground text-right text-base">${(safeNum(detailShipment.sales_price) * safeNum(detailShipment.quantity_loaded)).toLocaleString()}</span></div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="border border-border/60 rounded-xl p-5 bg-background/50">
                                            <h4 className="text-sm font-bold flex items-center gap-2 mb-4 text-foreground">
                                                <Calendar className="w-4 h-4 text-muted-foreground" /> LAYCAN & Dates
                                            </h4>
                                            <div className="grid grid-cols-2 gap-4 text-sm mt-2">
                                                <div>
                                                    <span className="text-muted-foreground block mb-1">LAYCAN Period</span>
                                                    <span className="font-semibold text-foreground">{detailShipment.bl_date || "-"}</span>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground block mb-1">Loading Date</span>
                                                    <span className="font-semibold text-foreground">{detailShipment.bl_date || "-"}</span>
                                                </div>
                                            </div>
                                        </div>

                                    </>
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
                                                <button onClick={() => setShowMilestoneForm(!showMilestoneForm)} className="text-xs bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1.5">
                                                    {showMilestoneForm ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><Plus className="w-3.5 h-3.5" /> Add Milestone</>}
                                                </button>
                                            </div>

                                            {showMilestoneForm && (
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
                                            <h4 className="text-sm font-bold flex items-center gap-2 mb-4 text-foreground">
                                                <AlertTriangle className="w-4 h-4 text-red-500" /> Operational Risk Analysis
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                                                    <p className="text-[10px] font-bold text-red-500 uppercase flex items-center gap-1"><CloudLightning className="w-3 h-3" /> Weather Risk</p>
                                                    <p className="text-xl font-black text-foreground mt-1">High</p>
                                                    <p className="text-[9px] text-muted-foreground mt-1">Swell alert at loading anchorage.</p>
                                                </div>
                                                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                                                    <p className="text-[10px] font-bold text-amber-500 uppercase flex items-center gap-1"><Clock className="w-3 h-3" /> Demurrage Risk</p>
                                                    <p className="text-xl font-black text-foreground mt-1">Med</p>
                                                    <p className="text-[9px] text-muted-foreground mt-1">Loading pace slightly behind schedule.</p>
                                                </div>
                                                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                                                    <p className="text-[10px] font-bold text-emerald-500 uppercase flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Quality Risk</p>
                                                    <p className="text-xl font-black text-foreground mt-1">Low</p>
                                                    <p className="text-[9px] text-muted-foreground mt-1">Lab parameters strictly within specs.</p>
                                                </div>
                                            </div>
                                            <div className="mt-4 p-4 bg-accent/30 border border-border/50 rounded-lg text-xs relative">
                                                <div className="flex justify-between items-start mb-2">
                                                    <p className="font-bold flex items-center gap-1.5"><Wand2 className="w-4 h-4 text-blue-500" /> AI Mitigation Recommendation</p>
                                                    <button onClick={handleGenerateRiskAnalysis} disabled={isGeneratingRisk} className="text-[10px] bg-blue-500/10 text-blue-500 px-2 py-1 rounded font-bold hover:bg-blue-500/20 disabled:opacity-50 flex items-center gap-1">
                                                        {isGeneratingRisk ? <><Loader2 className="w-3 h-3 animate-spin" /> Processing</> : "Refresh AI"}
                                                    </button>
                                                </div>
                                                {isGeneratingRisk ? (
                                                    <div className="h-12 flex items-center justify-center"><Loader2 className="w-5 h-5 text-blue-500 animate-spin" /></div>
                                                ) : (
                                                    <p className="text-muted-foreground leading-relaxed">
                                                        {aiRiskInsight || "Deploy supplementary tugs to accelerate barge positioning during loading windows to offset impending weather delays. Quality parameters are green, monitor TS continuously."}
                                                    </p>
                                                )}
                                            </div>
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
                                    <p className="text-xs text-muted-foreground mt-0.5">{editShipment?.shipment_number}</p>
                                </div>
                                <button onClick={() => setEditShipment(null)} className="p-1.5 rounded-lg hover:bg-accent bg-accent/50 text-muted-foreground"><X className="w-4 h-4" /></button>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Shipment ID</label>
                                    <input type="text" value={editForm.shipment_number || ""} onChange={(e) => setEditForm({ ...editForm, shipment_number: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border focus:border-primary/50 text-xs font-bold text-primary" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Status</label>
                                    <select value={editForm.status || ""} onChange={(e) => setEditForm({ ...editForm, status: e.target.value as ShipmentStatus })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border focus:border-primary/50 text-xs">
                                        {SHIPMENT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Buyer</label>
                                    <input type="text" value={editForm.buyer || ""} onChange={(e) => setEditForm({ ...editForm, buyer: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border focus:border-primary/50 text-xs" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Supplier</label>
                                    <input type="text" value={editForm.supplier || ""} onChange={(e) => setEditForm({ ...editForm, supplier: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border focus:border-primary/50 text-xs" />
                                </div>
                                <div className="col-span-2 grid grid-cols-3 gap-4 border-t border-b border-border/30 py-3 my-1">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-semibold text-muted-foreground uppercase">GAR (Actual)</label>
                                        <input type="number" value={editForm.spec_actual?.gar || ""} onChange={(e) => setEditForm({ ...editForm, spec_actual: { ...(editForm.spec_actual as any), gar: Number(e.target.value) } })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border focus:border-primary/50 text-xs" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-semibold text-muted-foreground uppercase">TS (%)</label>
                                        <input type="number" step="0.1" value={editForm.spec_actual?.ts || ""} onChange={(e) => setEditForm({ ...editForm, spec_actual: { ...(editForm.spec_actual as any), ts: Number(e.target.value) } })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border focus:border-primary/50 text-xs" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-semibold text-muted-foreground uppercase">ASH (%)</label>
                                        <input type="number" step="0.1" value={editForm.spec_actual?.ash || ""} onChange={(e) => setEditForm({ ...editForm, spec_actual: { ...(editForm.spec_actual as any), ash: Number(e.target.value) } })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border focus:border-primary/50 text-xs" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Sales Price (USD/MT)</label>
                                    <input type="number" value={editForm.sales_price || ""} onChange={(e) => setEditForm({ ...editForm, sales_price: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border focus:border-primary/50 text-xs" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Margin/MT (USD/MT)</label>
                                    <input type="number" value={editForm.margin_mt || ""} onChange={(e) => setEditForm({ ...editForm, margin_mt: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border focus:border-primary/50 text-xs" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Vessel Name</label>
                                    <input type="text" value={editForm.vessel_name || ""} onChange={(e) => setEditForm({ ...editForm, vessel_name: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border focus:border-primary/50 text-xs" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Barge Name</label>
                                    <input type="text" value={editForm.barge_name || ""} onChange={(e) => setEditForm({ ...editForm, barge_name: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border focus:border-primary/50 text-xs" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Qty Loaded (MT)</label>
                                    <input type="number" value={editForm.quantity_loaded || ""} onChange={(e) => setEditForm({ ...editForm, quantity_loaded: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border focus:border-primary/50 text-xs" />
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
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">ETA</label>
                                    <input type="date" value={editForm.eta ? editForm.eta.split("T")[0] : ""} onChange={(e) => setEditForm({ ...editForm, eta: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border focus:border-primary/50 text-xs" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">IUP / OP</label>
                                    <input type="text" value={editForm.iup_op || ""} onChange={(e) => setEditForm({ ...editForm, iup_op: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border focus:border-primary/50 text-xs" />
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
