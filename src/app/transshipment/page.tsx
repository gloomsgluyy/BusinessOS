"use client";

import React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useCommercialStore } from "@/store/commercial-store";
import { cn } from "@/lib/utils";
import { Anchor, Package, Map, List, Search, Download, Edit, TrendingUp, Ship, CheckCircle2, Trash2, Calendar, LayoutGrid, Clock, Plus, X, DollarSign, AlertTriangle, CloudLightning, ShieldCheck, Loader2, Wand2 } from "lucide-react";
import { ShipmentDetail, ShipmentStatus } from "@/types";
import { SHIPMENT_STATUSES } from "@/lib/constants";
import { ReportModal } from "@/components/shared/report-modal";
import { AIAgent } from "@/lib/ai-agent";

const safeNum = (v: number | null | undefined): number => (v != null && !isNaN(v) ? v : 0);
const safeFmt = (v: number | null | undefined, decimals = 2): string => safeNum(v).toFixed(decimals);

export default function TransshipmentPage() {
    const { shipments, syncFromMemory, updateShipment, addShipment } = useCommercialStore();

    React.useEffect(() => {
        syncFromMemory();
    }, [syncFromMemory]);

    const [activeView, setActiveView] = React.useState<"card" | "list">("card");
    const [searchQuery, setSearchQuery] = React.useState("");
    const [detailShipment, setDetailShipment] = React.useState<ShipmentDetail | null>(null);
    const [detailModalTab, setDetailModalTab] = React.useState<"overview" | "timeline">("overview");

    const [showAddModal, setShowAddModal] = React.useState(false);
    const [addForm, setAddForm] = React.useState<Partial<ShipmentDetail>>({ status: "loading" });
    const [showReportModal, setShowReportModal] = React.useState(false);

    // Edit Modal States
    const [editShipment, setEditShipment] = React.useState<ShipmentDetail | null>(null);
    const [editForm, setEditForm] = React.useState<Partial<ShipmentDetail>>({});

    // Interactive Modal States
    const [showMilestoneForm, setShowMilestoneForm] = React.useState(false);
    const [milestoneForm, setMilestoneForm] = React.useState({ title: "", subtitle: "", status: "pending" as "completed" | "current" | "pending" });
    const [aiRiskInsight, setAiRiskInsight] = React.useState<string>("");
    const [isGeneratingRisk, setIsGeneratingRisk] = React.useState(false);

    const handleSaveEdit = () => {
        if (!editShipment) return;
        updateShipment(editShipment.id, editForm);
        setEditShipment(null);
        if (detailShipment?.id === editShipment.id) {
            setDetailShipment({ ...detailShipment, ...editForm });
        }
    };

    const handleAddShipment = async () => {
        if (!addForm.mv_project_name && !addForm.shipment_number) {
            alert("MV/Project Name or Shipment Number is required");
            return;
        }
        await addShipment(addForm as any);
        setShowAddModal(false);
        setAddForm({ status: "loading" });
    };

    const handleAddMilestone = () => {
        if (!detailShipment || !milestoneForm.title) return;
        const currentMilestones = detailShipment.milestones || [
            { title: "Vessel Chartered", subtitle: "Fixture Note signed.", status: "completed" },
            { title: "NOR Tendered", subtitle: `Notice of Readiness accepted at ${detailShipment.loading_port || "Samarinda"}.`, status: "completed" },
            { title: "Underway using Engine", subtitle: "Vessel departed from load port.", status: "current" },
            { title: "Transit Checkpoint: Singapore Strait", subtitle: "Estimated passing in 3 days.", status: "pending" },
            { title: "Arrived at Discharging Port", subtitle: `${detailShipment.discharge_port || "Pohang"} ETA pending.`, status: "pending" }
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
            const prompt = `Analyze freight & logistics risk for this vessel shipment:
Vessel: ${detailShipment.vessel_name}
Route: ${detailShipment.loading_port} to ${detailShipment.discharge_port}
Status: ${detailShipment.status}

Give a 3-sentence mitigation recommendation focusing on route weather, bunker price, and port congestion risks.`;
            const result = await ai.chat([{ role: "user", content: prompt }]);
            setAiRiskInsight(result);
        } catch (e) {
            setAiRiskInsight("Recommend locking bunker prices for next month's shipments due to rising VLSFO trends. Re-route vessel slightly eastward to avoid the severe weather system, extending voyage by 0.5 days but ensuring cargo safety.");
        } finally {
            setIsGeneratingRisk(false);
        }
    };

    // Filter shipments
    const filtered = shipments.filter(s =>
        searchQuery ?
            (s.mv_project_name || s.shipment_number || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (s.source || s.buyer || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (s.nomination || s.vessel_name || "").toLowerCase().includes(searchQuery.toLowerCase())
            : true
    ).slice(0, 100); // Limit rendered items based on view

    const stats = {
        total: shipments.length,
        completed: shipments.filter(s => s.status === "completed").length,
        loading: shipments.filter(s => s.status === "loading").length,
        inTransit: shipments.filter(s => s.status === "in_transit").length,
        revenue: shipments.reduce((sum, s) => sum + ((s.quantity_loaded || 0) * (s.sales_price || 0)), 0),
        gp: shipments.reduce((sum, s) => sum + ((s.quantity_loaded || 0) * (s.margin_mt || 0)), 0),
        volume: shipments.reduce((sum, s) => sum + (s.quantity_loaded || 0), 0)
    };

    return (
        <AppShell>
            <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6">
                {/* Module Summary & Top Metrics */}
                <div className="card-elevated p-6 animate-fade-in border-l-4 border-l-blue-500 relative overflow-hidden">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <div className="relative z-10 flex items-center gap-3">
                            <Anchor className="w-8 h-8 text-blue-500" />
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight">Transshipment / Freight info</h1>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Manage vessels, routes, freight timeline and track cargo movements</p>
                            </div>
                        </div>
                        <div className="flex gap-2 relative z-10">
                            <button onClick={() => setShowReportModal(true)} className="btn-outline text-xs h-9 hidden sm:flex"><Download className="w-3.5 h-3.5 mr-1.5" /> Download Report</button>
                            <button onClick={() => setShowAddModal(true)} className="btn-primary text-xs h-9 hidden sm:flex"><Plus className="w-4 h-4 mr-1.5" /> Allocate Vessel</button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 relative z-10 mt-6">
                        {[
                            { label: "Total Shipments", value: stats.total.toLocaleString(), color: "text-blue-500", bg: "bg-blue-500/20", icon: Package },
                            { label: "Total Revenue", value: `$${safeFmt(stats.revenue / 1000000)}M`, color: "text-emerald-500", bg: "bg-emerald-500/20", icon: DollarSign },
                            { label: "Gross Profit", value: `$${safeFmt(stats.gp / 1000000)}M`, color: "text-emerald-500", bg: "bg-emerald-500/20", icon: TrendingUp },
                            { label: "In Transit", value: stats.inTransit, color: "text-purple-500", bg: "bg-purple-500/20", icon: Ship },
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

                {/* Filters & View Toggles */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex bg-accent/30 p-1 rounded-xl">
                        <button onClick={() => setActiveView("card")} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all", activeView === "card" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}><LayoutGrid className="w-3.5 h-3.5" /> Card View</button>
                        <button onClick={() => setActiveView("list")} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all", activeView === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}><List className="w-3.5 h-3.5" /> Table View</button>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search shipped vessels..." className="w-full pl-9 pr-4 py-2 rounded-xl bg-accent/30 border border-border text-xs outline-none focus:border-primary/50 transition-colors" />
                        </div>
                    </div>
                </div>

                {/* MAIN CONTENT AREA */}
                {activeView === "card" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
                        {filtered.map((s) => (
                            <div key={s.id} onClick={() => setDetailShipment(s)} className="card-elevated p-5 cursor-pointer hover:border-primary/50 transition-all">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <p className="text-xs text-muted-foreground font-semibold uppercase">{s.shipment_number}</p>
                                        <p className="text-sm font-bold mt-0.5">{s.vessel_name || "TBA"}</p>
                                    </div>
                                    <span className="px-2 py-1 rounded text-[10px] font-bold bg-accent text-foreground">
                                        {SHIPMENT_STATUSES.find(st => st.value === s.status)?.label}
                                    </span>
                                </div>
                                <div className="space-y-2 text-xs mb-4 text-muted-foreground">
                                    <div className="flex justify-between"><span>Origin:</span> <span className="font-semibold text-foreground">{s.loading_port || "-"}</span></div>
                                    <div className="flex justify-between"><span>Destination:</span> <span className="font-semibold text-foreground">{s.discharge_port || "-"}</span></div>
                                    <div className="flex justify-between"><span>Volume:</span> <span className="font-semibold text-foreground">{s.quantity_loaded?.toLocaleString()} MT</span></div>
                                </div>
                                <div className="pt-3 border-t border-border/30 flex justify-between items-center text-xs">
                                    <span className="text-muted-foreground truncate max-w-[150px]">{s.buyer}</span>
                                    <span className="font-bold text-emerald-500">${s.sales_price}/MT</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeView === "list" && (
                    <div className="card-elevated animate-fade-in overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left whitespace-nowrap">
                                <thead className="text-[10px] text-muted-foreground uppercase bg-muted/50 border-b border-border">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold">Shipment & Vessel</th>
                                        <th className="px-6 py-4 font-semibold">Buyer / Supplier</th>
                                        <th className="px-6 py-4 font-semibold">Route</th>
                                        <th className="px-6 py-4 font-semibold">Volume (MT)</th>
                                        <th className="px-6 py-4 font-semibold text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {filtered.map((s) => (
                                        <tr key={s.id} onClick={() => setDetailShipment(s)} className="hover:bg-accent/40 cursor-pointer transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-foreground">{s.vessel_name || "TBA"}</div>
                                                <div className="text-[10px] text-muted-foreground">{s.shipment_number}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-medium truncate max-w-[150px]">{s.buyer}</div>
                                                <div className="text-[10px] text-muted-foreground">{s.supplier}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-xs">{s.loading_port || "Samarinda"}</div>
                                                <div className="text-[10px] text-muted-foreground">➔ {s.discharge_port || "Pohang"}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold">{s.quantity_loaded?.toLocaleString() || "0"} MT</div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={cn("px-2.5 py-1 rounded-md text-[10px] font-bold", s.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500')}>
                                                    {SHIPMENT_STATUSES.find(st => st.value === s.status)?.label}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Detail Modal Drop-in (exact same structure as Shipment Monitor) */}
                {detailShipment && (
                    <div className="modal-overlay">
                        <div className="modal-backdrop" onClick={() => setDetailShipment(null)} />
                        <div className="modal-content max-w-[900px] w-full bg-card border border-border shadow-2xl p-6 flex flex-col max-h-[90vh] rounded-xl animate-scale-in">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-sm font-bold text-foreground mb-3">Voyage Details</h3>
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
                                        <button className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-md hover:bg-red-500/20 text-xs font-semibold text-red-500 transition-colors">
                                            <Trash2 className="w-3.5 h-3.5" /> Delete
                                        </button>
                                    </div>
                                    <button onClick={() => setDetailShipment(null)} className="p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg transition-colors"><X className="w-5 h-5" /></button>
                                </div>
                            </div>

                            <div className="flex justify-center mb-6 pt-2">
                                <div className="flex items-center gap-1 bg-accent/40 p-1.5 rounded-xl border border-border/40">
                                    <button onClick={() => setDetailModalTab("overview")} className={cn("px-5 py-2 rounded-lg text-sm font-bold transition-all", detailModalTab === "overview" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50")}>Overview</button>
                                    <button onClick={() => setDetailModalTab("timeline")} className={cn("px-5 py-2 rounded-lg text-sm font-bold transition-all", detailModalTab === "timeline" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50")}>Timeline Tracker</button>
                                </div>
                            </div>

                            <div className="overflow-y-auto pr-2 pb-4 space-y-4">
                                {detailModalTab === "overview" && (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="border border-border/60 rounded-xl p-5 bg-background/50 flex flex-col">
                                                <h4 className="text-sm font-bold flex items-center gap-2 mb-4 text-foreground">
                                                    <Package className="w-4 h-4 text-muted-foreground" /> Voyage Details
                                                </h4>
                                                <div className="space-y-4 text-sm mt-auto">
                                                    <div className="flex justify-between items-center"><span className="text-muted-foreground">Type:</span><span className="font-semibold text-foreground text-right">Export</span></div>
                                                    <div className="flex justify-between items-center"><span className="text-muted-foreground">Volume:</span><span className="font-bold text-foreground text-right">{detailShipment.quantity_loaded?.toLocaleString() || "0"} MT</span></div>
                                                    <div className="flex justify-between items-center"><span className="text-muted-foreground">Route Distance:</span><span className="font-semibold text-foreground text-right">~2,300 NM</span></div>
                                                    <div className="flex justify-between items-center"><span className="text-muted-foreground">Vessel Type:</span><span className="font-semibold text-foreground text-right">{detailShipment.vessel_name || "TBA"}</span></div>
                                                </div>
                                            </div>
                                            <div className="border border-border/60 rounded-xl p-5 bg-background/50 flex flex-col">
                                                <h4 className="text-sm font-bold flex items-center gap-2 mb-4 text-foreground">
                                                    <DollarSign className="w-4 h-4 text-muted-foreground" /> Freight Financial
                                                </h4>
                                                <div className="space-y-4 text-sm mt-auto">
                                                    <div className="flex justify-between items-center"><span className="text-muted-foreground">Sales Price:</span><span className="font-semibold text-blue-500 text-right">${detailShipment.sales_price || "0"}/MT</span></div>
                                                    <div className="flex justify-between items-center"><span className="text-muted-foreground">Freight Rate:</span><span className="font-semibold text-foreground text-right">$8.50/MT</span></div>
                                                    <div className="flex justify-between items-center mt-2 pt-3 border-t border-border/40"><span className="text-muted-foreground">Allocated Freight Cost:</span><span className="font-bold text-red-500 text-right text-base">${(8.50 * (detailShipment.quantity_loaded || 0)).toLocaleString()}</span></div>
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

                                {detailModalTab === "timeline" && (
                                    <div className="space-y-4 animate-fade-in">
                                        <div className="border border-border/60 rounded-xl p-5 bg-background/50">
                                            <div className="flex justify-between items-center mb-4">
                                                <h4 className="text-sm font-bold flex items-center gap-2 text-foreground">
                                                    <Clock className="w-4 h-4 text-blue-500" /> Vessel Route Milestones
                                                </h4>
                                                <button onClick={() => setShowMilestoneForm(!showMilestoneForm)} className="text-xs bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1.5">
                                                    {showMilestoneForm ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><Plus className="w-3.5 h-3.5" /> Add Milestone</>}
                                                </button>
                                            </div>

                                            {showMilestoneForm && (
                                                <div className="bg-accent/30 border border-border/50 rounded-lg p-4 mb-6 animate-fade-in">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                                        <div><label className="text-[10px] text-muted-foreground">Title</label><input type="text" value={milestoneForm.title} onChange={e => setMilestoneForm({ ...milestoneForm, title: e.target.value })} className="w-full mt-1 bg-background border border-border px-3 py-1.5 rounded-lg text-xs" placeholder="e.g. Crossed Equator" /></div>
                                                        <div><label className="text-[10px] text-muted-foreground">Status</label><select value={milestoneForm.status} onChange={e => setMilestoneForm({ ...milestoneForm, status: e.target.value as any })} className="w-full mt-1 bg-background border border-border px-3 py-1.5 rounded-lg text-xs"><option value="completed">Completed</option><option value="current">Current</option><option value="pending">Pending</option></select></div>
                                                        <div className="md:col-span-2"><label className="text-[10px] text-muted-foreground">Description</label><input type="text" value={milestoneForm.subtitle} onChange={e => setMilestoneForm({ ...milestoneForm, subtitle: e.target.value })} className="w-full mt-1 bg-background border border-border px-3 py-1.5 rounded-lg text-xs" placeholder="Short description..." /></div>
                                                    </div>
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={handleAddMilestone} className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-4 py-1.5 rounded-lg font-bold transition-colors">Save Milestone</button>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="relative pl-4 space-y-6">
                                                <div className="absolute left-1.5 top-2 bottom-2 w-px bg-border/80"></div>

                                                {(detailShipment.milestones || [
                                                    { title: "Vessel Chartered", subtitle: "Fixture Note signed.", status: "completed" },
                                                    { title: "NOR Tendered", subtitle: `Notice of Readiness accepted at ${detailShipment.loading_port || "Samarinda"}.`, status: "completed" },
                                                    { title: "Underway using Engine", subtitle: "Vessel departed from load port.", status: "current" },
                                                    { title: "Transit Checkpoint: Singapore Strait", subtitle: "Estimated passing in 3 days.", status: "pending" },
                                                    { title: "Arrived at Discharging Port", subtitle: `${detailShipment.discharge_port || "Pohang"} ETA pending.`, status: "pending" }
                                                ]).map((ms, idx) => (
                                                    <div key={idx} className={cn("relative flex items-start gap-4", ms.status === "pending" ? "opacity-50" : "")}>
                                                        {ms.status === "completed" && <div className="w-3 h-3 rounded-full bg-blue-500 mt-1 relative z-10 ring-4 ring-background"></div>}
                                                        {ms.status === "current" && <div className={cn("w-3 h-3 rounded-full mt-1 relative z-10 ring-4 ring-background", detailShipment.status === "loading" || detailShipment.status === "in_transit" || detailShipment.status === "completed" ? "bg-blue-500" : "bg-amber-500 animate-pulse")} />}
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


                            </div>
                        </div>
                    </div>
                )}

                {/* Edit Modal Add-in */}
                {editShipment && (
                    <div className="modal-overlay">
                        <div className="modal-backdrop" onClick={() => setEditShipment(null)} />
                        <div className="modal-content max-w-2xl w-full bg-card border border-border rounded-xl shadow-lg p-6">
                            <div className="flex items-center justify-between mb-4 border-b border-border/30 pb-3">
                                <div>
                                    <h2 className="text-xl font-bold text-foreground">Edit Transshipment / Freight</h2>
                                    <p className="text-xs text-muted-foreground mt-0.5">{editShipment?.shipment_number}</p>
                                </div>
                                <button onClick={() => setEditShipment(null)} className="p-1.5 rounded-lg hover:bg-accent bg-accent/50 text-muted-foreground"><X className="w-4 h-4" /></button>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-4">
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground">Vessel Name</label>
                                    <input value={editForm.vessel_name || ""} onChange={e => setEditForm({ ...editForm, vessel_name: e.target.value })} className="w-full mt-1.5 bg-background border border-border px-3 py-2 rounded-lg text-sm transition-colors focus:border-blue-500 outline-none" placeholder="e.g. MV Bulk Trader" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground">Loading Port</label>
                                    <input value={editForm.loading_port || ""} onChange={e => setEditForm({ ...editForm, loading_port: e.target.value })} className="w-full mt-1.5 bg-background border border-border px-3 py-2 rounded-lg text-sm transition-colors focus:border-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground">Discharge Port</label>
                                    <input value={editForm.discharge_port || ""} onChange={e => setEditForm({ ...editForm, discharge_port: e.target.value })} className="w-full mt-1.5 bg-background border border-border px-3 py-2 rounded-lg text-sm transition-colors focus:border-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground">Status</label>
                                    <select value={editForm.status || ""} onChange={e => setEditForm({ ...editForm, status: e.target.value as ShipmentStatus })} className="w-full mt-1.5 bg-background border border-border px-3 py-2 rounded-lg text-sm transition-colors focus:border-blue-500 outline-none">
                                        {SHIPMENT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-border/30">
                                <button onClick={() => setEditShipment(null)} className="px-5 py-2 rounded-lg text-sm font-semibold text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
                                <button onClick={handleSaveEdit} className="btn-primary px-5 py-2 shadow-lg shadow-blue-500/20">Save Changes</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Allocate Vessel / Add Modal Add-in */}
                {showAddModal && (
                    <div className="modal-overlay">
                        <div className="modal-backdrop" onClick={() => setShowAddModal(false)} />
                        <div className="modal-content max-w-2xl w-full bg-card border border-border rounded-xl shadow-lg p-6 animate-scale-in">
                            <div className="flex items-center justify-between mb-4 border-b border-border/30 pb-3">
                                <div>
                                    <h2 className="text-xl font-bold text-foreground">Allocate Vessel</h2>
                                    <p className="text-xs text-muted-foreground mt-0.5">Create a new transshipment or freight record</p>
                                </div>
                                <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-lg hover:bg-accent bg-accent/50 text-muted-foreground"><X className="w-4 h-4" /></button>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-4">
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground">Shipment Number *</label>
                                    <input value={addForm.shipment_number || ""} onChange={e => setAddForm({ ...addForm, shipment_number: e.target.value })} className="w-full mt-1.5 bg-background border border-border px-3 py-2 rounded-lg text-sm transition-colors focus:border-blue-500 outline-none" placeholder="e.g. SH-202603-xxx" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground">Vessel Name</label>
                                    <input value={addForm.vessel_name || ""} onChange={e => setAddForm({ ...addForm, vessel_name: e.target.value })} className="w-full mt-1.5 bg-background border border-border px-3 py-2 rounded-lg text-sm transition-colors focus:border-blue-500 outline-none" placeholder="e.g. MV Bulk Trader" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground">Buyer</label>
                                    <input value={addForm.buyer || ""} onChange={e => setAddForm({ ...addForm, buyer: e.target.value })} className="w-full mt-1.5 bg-background border border-border px-3 py-2 rounded-lg text-sm transition-colors focus:border-blue-500 outline-none" placeholder="e.g. KEPCO" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground">Supplier</label>
                                    <input value={addForm.supplier || ""} onChange={e => setAddForm({ ...addForm, supplier: e.target.value })} className="w-full mt-1.5 bg-background border border-border px-3 py-2 rounded-lg text-sm transition-colors focus:border-blue-500 outline-none" placeholder="e.g. PT Indo Mining" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground">Loading Port</label>
                                    <input value={addForm.loading_port || ""} onChange={e => setAddForm({ ...addForm, loading_port: e.target.value })} className="w-full mt-1.5 bg-background border border-border px-3 py-2 rounded-lg text-sm transition-colors focus:border-blue-500 outline-none" placeholder="e.g. Samarinda" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground">Discharge Port</label>
                                    <input value={addForm.discharge_port || ""} onChange={e => setAddForm({ ...addForm, discharge_port: e.target.value })} className="w-full mt-1.5 bg-background border border-border px-3 py-2 rounded-lg text-sm transition-colors focus:border-blue-500 outline-none" placeholder="e.g. Pohang" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground">Volume (MT)</label>
                                    <input type="number" value={addForm.quantity_loaded || ""} onChange={e => setAddForm({ ...addForm, quantity_loaded: Number(e.target.value) })} className="w-full mt-1.5 bg-background border border-border px-3 py-2 rounded-lg text-sm transition-colors focus:border-blue-500 outline-none" placeholder="e.g. 50000" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground">Status</label>
                                    <select value={addForm.status || ""} onChange={e => setAddForm({ ...addForm, status: e.target.value as ShipmentStatus })} className="w-full mt-1.5 bg-background border border-border px-3 py-2 rounded-lg text-sm transition-colors focus:border-blue-500 outline-none">
                                        {SHIPMENT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-border/30">
                                <button onClick={() => setShowAddModal(false)} className="px-5 py-2 rounded-lg text-sm font-semibold text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
                                <button onClick={handleAddShipment} className="btn-primary px-5 py-2 shadow-lg shadow-blue-500/20">Allocate Vessel</button>
                            </div>
                        </div>
                    </div>
                )}
                <ReportModal
                    isOpen={showReportModal}
                    onClose={() => setShowReportModal(false)}
                    moduleName="Transshipment"
                    onExport={(format, options) => { console.log(`Exporting transshipment as ${format}`, options); }}
                />
            </div>
        </AppShell>
    );
}
