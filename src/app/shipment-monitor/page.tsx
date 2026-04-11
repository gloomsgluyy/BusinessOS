"use client";

import React from "react";
import GlobalLoading from "@/app/loading";
import { AppShell } from "@/components/layout/app-shell";
import { useCommercialStore } from "@/store/commercial-store";
import { useDailyDeliveryStore } from "@/store/daily-delivery-store";
import { SHIPMENT_STATUSES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ShipmentDetail, ShipmentStatus } from "@/types";
import {
    Ship, Calendar, Plus, ExternalLink, Activity, Anchor, FileText, CheckCircle2,
    AlertTriangle, Package, DollarSign, TrendingUp, Filter, Search, Edit, Trash2, X, Download, Truck, Droplets, Flame, Beaker, Clock, ShieldCheck, CloudLightning, Leaf, Loader2, Wand2,
    Map as MapIcon, ChevronUp, ChevronDown, Eye, List, Info, CreditCard
} from "lucide-react";
import { AIAgent } from "@/lib/ai-agent";
import { ReportModal } from "@/components/shared/report-modal";
import { Toast, ToastType } from "@/components/shared/toast";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";

const safeNum = (v: number | null | undefined): number => (v != null && !isNaN(v) ? v : 0);
const safeFmt = (v: number | null | undefined, decimals = 2): string => safeNum(v).toFixed(decimals);
const normalizeKey = (v?: string | null) => (v || "").toUpperCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
const monthToNumber: Record<string, number> = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
    JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
    MEI: 4, AGU: 7, OKT: 9, DES: 11,
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

export default function ShipmentMonitorPage() {
    const [isInitializing, setIsInitializing] = React.useState(true);

    const { shipments, syncFromMemory, marketPrices, sources, addShipment, updateShipment, deleteShipment } = useCommercialStore();
    const { dailyDeliveries, syncDeliveries, addDelivery, updateDelivery, deleteDelivery } = useDailyDeliveryStore();

    React.useEffect(() => {
        syncFromMemory().finally(() => setIsInitializing(false));
        syncDeliveries();
    }, [syncFromMemory, syncDeliveries]);
    const [mainTab, setMainTab] = React.useState<"MV Barge" | "Daily Delivery" | "Route Optimizer" | "Analytics" | "Risk Assessment">("MV Barge");
    const [activeTab, setActiveTab] = React.useState<ShipmentStatus | "all">("all");
    const [activeView, setActiveView] = React.useState<"list" | "card" | "map">("list");
    const [detailShipment, setDetailShipment] = React.useState<ShipmentDetail | null>(null);
    const [detailModalTab, setDetailModalTab] = React.useState<"overview" | "blending" | "timeline" | "risk">("overview");
    const [editShipment, setEditShipment] = React.useState<ShipmentDetail | null>(null);
    const [editForm, setEditForm] = React.useState<Partial<ShipmentDetail>>({});
    const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = React.useState("");
    const [yearFilter, setYearFilter] = React.useState<string>("all");
    const [dateFrom, setDateFrom] = React.useState("");
    const [dateTo, setDateTo] = React.useState("");
    const [sortBy, setSortBy] = React.useState<"latest" | "oldest" | "qty_desc" | "qty_asc">("latest");
    const [showReportModal, setShowReportModal] = React.useState(false);

    // Interactive Modal States
    const [showDailyForm, setShowDailyForm] = React.useState(false);
    const [editDailyData, setEditDailyData] = React.useState<any>(null);
    const [dailyForm, setDailyForm] = React.useState<Partial<any>>({ report_type: "domestic", year: 2026, buyer: "", mv_barge_nomination: "", bl_quantity: 0, issue: "" });

    const [activeDailyTab, setActiveDailyTab] = React.useState<"general" | "logistics" | "quality" | "commercial">("general");

    const handleOpenDailyForm = (data?: any) => {
        if (data) {
            setEditDailyData(data);
            setDailyForm({ ...data });
        } else {
            setEditDailyData(null);
            setDailyForm({ 
                report_type: "domestic", year: 2026, buyer: "", mv_barge_nomination: "", 
                bl_quantity: 0, issue: "", shipment_status: "upcoming", pod: "", 
                shipping_term: "FOB", pol: "", area: "", supplier: "", project: "", flow: "" 
            });
        }
        setActiveDailyTab("general");
        setShowDailyForm(true);
    };

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
            setShowDailyForm(false);
        } catch(e) {
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
        } catch(e) {
            setToast({ message: "Failed to delete log", type: "error" });
        }
    };


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

    const uniqueYears = React.useMemo(() => {
        return Array.from(new Set(
            shipments
                .map((s) => getShipmentYear(s))
                .filter((y): y is number => y !== null)
        )).sort((a, b) => b - a);
    }, [shipments]);

    const filtered = React.useMemo(() => {
        const start = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
        const end = dateTo ? new Date(`${dateTo}T23:59:59`) : null;

        const rows = shipments.filter((s) => {
            const matchesTab = activeTab === "all" || s.status === activeTab;
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
        revenue: shipments.reduce((sum, s) => sum + (safeNum(s.qty_plan || s.quantity_loaded) * safeNum(s.harga_actual_fob_mv || s.sales_price)), 0),
        gp: shipments.reduce((sum, s) => sum + (safeNum(s.qty_plan || s.quantity_loaded) * safeNum(s.margin_mt)), 0),
        volume: shipments.reduce((sum, s) => sum + safeNum(s.qty_plan || s.quantity_loaded), 0)
    };

    if (isInitializing) return <GlobalLoading />;

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
                    {(["MV Barge", "Daily Delivery", "Route Optimizer", "Analytics", "Risk Assessment"] as const).map((tab) => (
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
                                Sorted by: {sortBy === "latest" ? "Year latest first, then date/no desc" : sortBy === "oldest" ? "Year oldest first, then date/no asc" : sortBy === "qty_desc" ? "Volume largest first" : "Volume smallest first"}
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
                                        <th className="px-6 py-4 font-semibold">Issue</th>
                                        <th className="px-6 py-4 font-semibold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50 bg-card">
                                    {dailyDeliveries.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-8 text-center text-xs text-muted-foreground">
                                                No daily delivery data fetched for current filter.
                                            </td>
                                        </tr>
                                    ) : dailyDeliveries.map(d => (
                                        <tr key={d.id} className="hover:bg-accent/40 transition-colors">
                                            <td className="px-6 py-4"><span className="px-2 py-1 bg-accent rounded text-[10px] font-bold uppercase">{d.report_type}</span></td>
                                            <td className="px-6 py-4 text-xs font-semibold">{d.year}</td>
                                            <td className="px-6 py-4 text-xs font-bold text-foreground">{d.buyer || "-"}</td>
                                            <td className="px-6 py-4 text-xs font-semibold">{d.mv_barge_nomination || "-"}</td>
                                            <td className="px-6 py-4 text-xs font-bold text-blue-500">{d.bl_quantity ? `${d.bl_quantity.toLocaleString()} MT` : "-"}</td>
                                            <td className="px-6 py-4 text-[10px] text-muted-foreground truncate max-w-[200px]">{d.issue || "No Issues"}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button onClick={(e) => { e.stopPropagation(); handleOpenDailyForm(d); }} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><Edit className="w-3.5 h-3.5" /></button>
                                                    <button onClick={(e) => handleDeleteDaily(d.id, e)} className="p-1.5 rounded-lg hover:bg-rose-500/20 text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Daily Form Modal - Expanded with Tabs */}
                        {showDailyForm && (
                            <div className="modal-overlay z-50 fixed inset-0 flex items-center justify-center p-4">
                                <div className="modal-backdrop absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowDailyForm(false)} />
                                <div className="modal-content relative bg-card border border-border w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-xl shadow-2xl animate-scale-in flex flex-col z-[60]">
                                    <div className="flex items-center justify-between p-6 border-b border-border">
                                        <div>
                                            <h2 className="text-lg font-bold">{editDailyData ? "Edit" : "New"} Daily Log</h2>
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Unified Delivery Recap System</p>
                                        </div>
                                        <button onClick={() => setShowDailyForm(false)} className="p-2 hover:bg-accent rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                                    </div>

                                    {/* Tabs Header */}
                                    <div className="flex items-center px-6 border-b border-border bg-accent/10">
                                        {[
                                            { id: "general", label: "General Info", icon: Info },
                                            { id: "logistics", label: "Logistics & Tracking", icon: Anchor },
                                            { id: "quality", label: "Surveyor & Quality", icon: Beaker },
                                            { id: "commercial", label: "Commercial & Finance", icon: CreditCard },
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
                                                <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Project</label>
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
                                    </div>

                                    <div className="p-6 border-t border-border bg-accent/5 flex justify-end gap-3">
                                        <button onClick={() => setShowDailyForm(false)} className="px-4 py-2 hover:bg-accent rounded-lg text-sm font-semibold transition-colors text-muted-foreground" disabled={isSaving}>Cancel</button>
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
                            <button onClick={() => setActiveTab("all")} className={cn("filter-chip text-white", activeTab === "all" ? "filter-chip-active text-white border-transparent" : "filter-chip-inactive bg-white/10")}>
                                all ({stats.total})
                            </button>
                            {["Done Shipment", "Upcoming", "Loading", "In Transit", "Completed"].map((s) => {
                                const val = s.toLowerCase() === "in transit" ? "in_transit" : s === "Done Shipment" ? "done_shipment" : s.toLowerCase();
                                const count = s === "Done Shipment" ? shipments.filter(sh => sh.status === "done_shipment").length :
                                    s === "Upcoming" ? shipments.filter(sh => sh.status === "upcoming").length :
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
                                                        <h3 className="font-bold text-lg text-primary group-hover:underline decoration-primary/50 underline-offset-4">{sh.mv_project_name || sh.vessel_name || sh.shipment_number || `#${sh.no}`}</h3>
                                                        <p className="text-xs text-muted-foreground">{sh.source || sh.buyer} | {sh.origin || "-"} | Year {getShipmentYear(sh) || "-"}</p>
                                                    </div>
                                                    <span className="status-badge text-[10px]" style={{ color: stCfg?.color, backgroundColor: `${stCfg?.color}15` }}>
                                                        {stCfg?.label}
                                                    </span>
                                                </div>
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
                                                        <p className="text-muted-foreground text-[10px] uppercase">Harga FOB MV</p>
                                                        <p className="font-medium text-emerald-500 font-mono">{sh.harga_actual_fob_mv ? `$${safeFmt(sh.harga_actual_fob_mv)}` : (sh.sales_price ? `$${safeFmt(sh.sales_price)}` : "-")}</p>
                                                    </div>
                                                </div>
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
                                                <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">MV / Project</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Year</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Source</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Nomination</th>
                                                <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Qty Plan</th>
                                                <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Laycan</th>
                                                <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">FOB MV</th>
                                                <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">HPB</th>
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
                                                            <td className="px-4 py-3 font-medium text-xs text-primary">{sh.no || "-"}</td>
                                                            <td className="px-4 py-3 text-xs">{sh.export_dmo || "-"}</td>
                                                            <td className="px-4 py-3 text-xs font-semibold">{sh.mv_project_name || sh.vessel_name || sh.shipment_number || "-"}</td>
                                                            <td className="px-4 py-3 text-xs font-semibold text-primary/90">{getShipmentYear(sh) || "-"}</td>
                                                            <td className="px-4 py-3 text-xs text-muted-foreground">{sh.source || sh.supplier || "-"}</td>
                                                            <td className="px-4 py-3 text-xs">{sh.nomination || sh.vessel_name || sh.barge_name || "-"}</td>
                                                            <td className="px-4 py-3 text-right text-xs font-semibold">{(sh.qty_plan || sh.quantity_loaded) ? safeNum(sh.qty_plan || sh.quantity_loaded).toLocaleString() : "-"}</td>
                                                            <td className="px-4 py-3 text-[10px] text-muted-foreground">{formatLaycanWithYear(sh)}</td>
                                                            <td className="px-4 py-3 text-right text-xs font-mono">{(sh.harga_actual_fob_mv || sh.sales_price) ? `$${safeFmt(sh.harga_actual_fob_mv || sh.sales_price)}` : "-"}</td>
                                                            <td className="px-4 py-3 text-right text-xs font-mono font-medium text-emerald-500">{sh.hpb ? `$${safeFmt(sh.hpb)}` : (sh.margin_mt ? `$${safeFmt(sh.margin_mt)}` : "-")}</td>
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
                                                                <td colSpan={14} className="px-6 py-4">
                                                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                                                        {/* Shipping Details */}
                                                                        <div className="space-y-2">
                                                                            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                                                                                <Anchor className="w-3 h-3" /> Shipping Details
                                                                            </h4>
                                                                            <div className="space-y-1.5 text-xs bg-background/50 p-3 rounded-lg border border-border/50">
                                                                                <div className="flex justify-between"><span className="text-muted-foreground">Source:</span><span className="font-medium text-right">{sh.source || sh.supplier}</span></div>
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
                                    <button onClick={() => setDetailShipment(null)} className="p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg transition-colors shrink-0">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="flex items-center gap-2 flex-wrap">
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
                                </div>
                            </div>

                            <div className="mb-4">
                                <div className="grid grid-cols-2 md:flex md:items-center gap-1.5 bg-accent/40 p-1.5 rounded-xl border border-border/40">
                                    <button onClick={() => setDetailModalTab("overview")} className={cn("px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all", detailModalTab === "overview" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50")}>Overview</button>
                                    <button onClick={() => setDetailModalTab("blending")} className={cn("px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all", detailModalTab === "blending" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50")}>Blending Details</button>
                                    <button onClick={() => setDetailModalTab("timeline")} className={cn("px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all", detailModalTab === "timeline" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50")}>Timeline</button>
                                    <button onClick={() => setDetailModalTab("risk")} className={cn("px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all", detailModalTab === "risk" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50")}>Risk Analysis</button>
                                </div>
                            </div>

                            <div className="overflow-y-auto overflow-x-hidden pr-1 sm:pr-2 pb-2 sm:pb-4 space-y-4">
                                {detailModalTab === "overview" && (
                                    <div className="space-y-6 animate-fade-in">
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                                            {/* Unified Shipment Identity */}
                                            <div className="border border-border/60 rounded-xl p-4 sm:p-5 bg-background/60 shadow-sm">
                                                <h4 className="text-[11px] sm:text-xs font-bold flex items-center gap-2 mb-3 text-primary uppercase tracking-wider">
                                                    <Package className="w-4 h-4" /> Logistics Identity
                                                </h4>
                                                <div className="space-y-2.5 text-xs sm:text-[13px]">
                                                    <div className="grid grid-cols-[96px_1fr] gap-3"><span className="text-muted-foreground uppercase">Project</span><span className="font-semibold text-foreground break-words">{detailShipment.mv_project_name || detailShipment.vessel_name || "-"}</span></div>
                                                    <div className="grid grid-cols-[96px_1fr] gap-3"><span className="text-muted-foreground uppercase">Vessel</span><span className="font-semibold text-foreground break-words">{detailShipment.vessel_name || detailShipment.nomination || "-"}</span></div>
                                                    <div className="grid grid-cols-[96px_1fr] gap-3"><span className="text-muted-foreground uppercase">Barge</span><span className="font-medium text-foreground break-words">{detailShipment.barge_name || "-"}</span></div>
                                                    <div className="grid grid-cols-[96px_1fr] gap-3"><span className="text-muted-foreground uppercase">Source</span><span className="font-bold text-primary break-words">{detailShipment.source || "-"}</span></div>
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
                                                    <div className="grid grid-cols-[96px_1fr] gap-3"><span className="text-muted-foreground uppercase">Qty Loaded</span><span className="font-black text-foreground break-words">{detailShipment.quantity_loaded?.toLocaleString() || "0"} MT</span></div>
                                                    <div className="grid grid-cols-[96px_1fr] gap-3"><span className="text-muted-foreground uppercase">Sales Price</span><span className="font-bold text-emerald-600 break-words">${safeNum(detailShipment.sales_price || detailShipment.sp)}/MT</span></div>
                                                    <div className="grid grid-cols-[96px_1fr] gap-3"><span className="text-muted-foreground uppercase">Margin</span><span className="font-bold text-blue-600 break-words">${safeNum(detailShipment.margin_mt)}/MT</span></div>
                                                    <div className="grid grid-cols-[96px_1fr] gap-3 border-t border-emerald-500/10 pt-2"><span className="text-muted-foreground uppercase">Est. Revenue</span><span className="font-black text-emerald-700 break-words">${((detailShipment.quantity_loaded || 0) * safeNum(detailShipment.sales_price || detailShipment.sp)).toLocaleString()}</span></div>
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
                                                <div className="space-y-1"><p className="text-muted-foreground uppercase text-[10px]">Nomination</p><p className="font-semibold text-foreground break-words">{detailShipment.nomination || "-"}</p></div>
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
                                                <h5 className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase mb-3 flex items-center gap-1.5">
                                                    <Anchor className="w-3 h-3" /> Child Barge Details ({shipmentFamily.length})
                                                </h5>
                                                <div className="md:hidden space-y-2">
                                                    {shipmentFamily.slice(0, 8).map((item) => (
                                                        <div key={item.id} className="rounded-lg border border-border/50 bg-background/60 p-3 text-xs space-y-1.5">
                                                            <p className="font-semibold text-foreground break-words">{item.nomination || item.barge_name || "-"}</p>
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
                                                <div className="hidden md:block overflow-x-auto">
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
                                                                    <td className="py-2 pr-3 font-semibold text-foreground">{item.nomination || item.barge_name || "-"}</td>
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
                                                    <div className="mt-2 text-muted-foreground italic border-t border-border/30 pt-2">
                                                        {detailShipment.remarks || "No additional operational remarks for this shipment."}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
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
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">MV / Project Name</label>
                                    <input type="text" value={editForm.mv_project_name || ""} onChange={(e) => setEditForm({ ...editForm, mv_project_name: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border focus:border-primary/50 text-xs font-bold text-primary" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Status</label>
                                    <select value={editForm.status || ""} onChange={(e) => setEditForm({ ...editForm, status: e.target.value as ShipmentStatus })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border focus:border-primary/50 text-xs">
                                        {SHIPMENT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Buyer (End User)</label>
                                    <input type="text" value={editForm.buyer || ""} onChange={(e) => setEditForm({ ...editForm, buyer: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border focus:border-primary/50 text-xs" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Source (Supplier)</label>
                                    <input type="text" value={editForm.source || ""} onChange={(e) => setEditForm({ ...editForm, source: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/50 border border-border focus:border-primary/50 text-xs" />
                                </div>

                                {/* Logistics Section */}
                                <div className="col-span-2 border-b border-border/30 pb-2 mb-1 mt-3">
                                    <h3 className="text-[10px] font-bold text-primary uppercase flex items-center gap-1.5"><Anchor className="w-3 h-3" /> Logistics & Vessel Tracking</h3>
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

                                {/* Financial section */}
                                <div className="col-span-2 border-b border-border/30 pb-2 mb-1 mt-3">
                                    <h3 className="text-[10px] font-bold text-emerald-500 uppercase flex items-center gap-1.5"><DollarSign className="w-3 h-3" /> Commercials & P&L</h3>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-emerald-500 uppercase">Sales Price (USD/MT)</label>
                                    <input type="number" step="0.01" value={editForm.sales_price || 0} onChange={(e) => setEditForm({ ...editForm, sales_price: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs font-bold text-emerald-600" />
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

                                {/* Quality Section */}
                                <div className="col-span-2 border-b border-border/30 pb-2 mb-1 mt-3">
                                    <h3 className="text-[10px] font-bold text-amber-500 uppercase flex items-center gap-1.5"><Beaker className="w-3 h-3" /> Quality Parameters</h3>
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
