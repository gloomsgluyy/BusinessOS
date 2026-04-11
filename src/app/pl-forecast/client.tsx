"use client";

import React from "react";
import GlobalLoading from "@/app/loading";
import { AppShell } from "@/components/layout/app-shell";
import { useSession } from "next-auth/react";
import { useCommercialStore } from "@/store/commercial-store";
import { useRouter } from "next/navigation";
import { DollarSign, TrendingUp, TrendingDown, Activity, Percent, Plus, X, Loader2, Edit3, Trash2, RefreshCw } from "lucide-react";
import { Toast } from "@/components/shared/toast";
import { cn } from "@/lib/utils";
import { PLForecastItem, ShipmentDetail } from "@/types";

const safeNum = (v: number | null | undefined): number => (v != null && !isNaN(v) ? v : 0);
const safeFmt = (v: number | null | undefined, decimals = 2): string => safeNum(v).toFixed(decimals);

const formatCurrency = (n: number) => `$${safeNum(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

const normalizeKey = (v?: string | null): string =>
    (v || "").toUpperCase().replace(/\s+/g, " ").trim();

const cleanText = (v?: string | null): string | null => {
    if (!v) return null;
    const t = String(v).replace(/\s+/g, " ").trim();
    return t || null;
};

const firstLine = (v?: string | null): string => {
    if (!v) return "";
    return String(v).split(/\r?\n/)[0]?.trim() || "";
};

const extractProjectName = (raw?: string | null): string | null => {
    const text = cleanText(raw);
    if (!text) return null;
    const explicit = text.match(/project\s*:\s*([^\n\r]+)/i);
    if (explicit?.[1]) return cleanText(explicit[1]);
    const code = text.match(/\b([A-Z]{2,}[A-Z0-9_.\-\/]*_\d{2})\b/i);
    if (code?.[1]) return cleanText(code[1]);
    return null;
};

const extractMVName = (raw?: string | null): string | null => {
    const line = firstLine(raw);
    if (!line) return null;
    const mv = line.match(/(MV\.?\s*[A-Z0-9 .\-\/]+?)(?:\s+OR\s+SUBS.*)?$/i);
    if (mv?.[1]) return cleanText(mv[1]);
    return cleanText(line);
};

const shipmentProjectName = (sh: ShipmentDetail): string =>
    extractProjectName(sh.mv_project_name) ||
    extractProjectName(sh.vessel_name) ||
    extractMVName(sh.mv_project_name) ||
    extractMVName(sh.vessel_name) ||
    cleanText(sh.mv_project_name) ||
    cleanText(sh.vessel_name) ||
    "Unmapped Project";

export default function PLForecastClient() {
    const [isInitializing, setIsInitializing] = React.useState(true);

    const { data: session, status } = useSession();
    const router = useRouter();
    const { plForecasts, addPLForecast, updatePLForecast, deletePLForecast, deals, shipments, syncFromMemory } = useCommercialStore();

    const userRole = session?.user?.role?.toLowerCase() || "";
    const allowedRoles = ["ceo", "director", "operation", "marketing", "purchasing"];
    const hasAccess = allowedRoles.includes(userRole);
    const isHighLevel = ["ceo", "director"].includes(userRole);

    React.useEffect(() => {
        Promise.all([
            syncFromMemory()
        ]).finally(() => setIsInitializing(false));
    }, [hasAccess, router, syncFromMemory, status]);

    const [showForm, setShowForm] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [isSyncing, setIsSyncing] = React.useState(false);
    const [toast, setToast] = React.useState<{ message: string; type: "success" | "error" } | null>(null);
    const [editingId, setEditingId] = React.useState<string | null>(null);

    const [form, setForm] = React.useState({
        deal_id: "",
        deal_number: "",
        project_name: "",
        mv_name: "",
        buyer: "",
        type: "",
        quantity: 0,
        selling_price: 0,
        buying_price: 0,
        freight_cost: 0,
        other_cost: 0,
    });

    const handleAddOrUpdate = async () => {
        console.log("handleAddOrUpdate started", { editingId, form });
        setIsSaving(true);
        try {
            if (editingId) {
                console.log("Calling updatePLForecast", editingId);
                await updatePLForecast(editingId, {
                    project_name: form.project_name,
                    buying_price: form.buying_price,
                    freight_cost: form.freight_cost,
                    other_cost: form.other_cost,
                });
                console.log("Update successful");
                setToast({ message: "Costs updated successfully!", type: "success" });
            } else {
                console.log("Calling addPLForecast", form);
                await addPLForecast({
                    deal_id: form.deal_id,
                    deal_number: form.deal_number,
                    project_name: form.project_name,
                    buyer: form.buyer,
                    type: form.type as "local" | "export",
                    quantity: form.quantity,
                    selling_price: form.selling_price,
                    buying_price: form.buying_price,
                    freight_cost: form.freight_cost,
                    other_cost: form.other_cost,
                    status: "forecast",
                    created_by: session?.user?.id || "system",
                });
                console.log("Create successful");
                setToast({ message: "P&L Forecast created!", type: "success" });
            }
            setShowForm(false);
            resetForm();
        } catch (error) {
            console.error("handleAddOrUpdate error:", error);
            setToast({ message: `Failed to ${editingId ? "update" : "create"} forecast`, type: "error" });
        } finally {
            setIsSaving(false);
            console.log("handleAddOrUpdate finished");
        }
    };

    const resetForm = () => {
        setForm({
            deal_id: "",
            deal_number: "",
            project_name: "",
            mv_name: "",
            buyer: "",
            type: "",
            quantity: 0,
            selling_price: 0,
            buying_price: 0,
            freight_cost: 0,
            other_cost: 0
        });
        setEditingId(null);
    };

    const handleManualSync = async () => {
        setIsSyncing(true);
        try {
            await syncFromMemory();
            setToast({ message: "Data synced successfully from Google Sheets!", type: "success" });
        } catch (error) {
            console.error("Manual sync error:", error);
            setToast({ message: "Failed to sync data", type: "error" });
        } finally {
            setIsSyncing(false);
        }
    };

    const handleEdit = (f: PLForecastItem) => {
        const ctxProject = cleanText(f.project_name) || f.deal_number || "Unmapped Project";
        const shipmentCtx = shipmentByProject.get(normalizeKey(ctxProject));
        setForm({
            deal_id: f.deal_id,
            deal_number: f.deal_number,
            project_name: ctxProject,
            mv_name: shipmentCtx?.mvName || "-",
            buyer: f.buyer,
            type: f.type,
            quantity: f.quantity,
            selling_price: f.selling_price,
            buying_price: f.buying_price,
            freight_cost: f.freight_cost,
            other_cost: f.other_cost,
        });
        setEditingId(f.id);
        setShowForm(true);
    };

    // Filter forecasts based on role
    const visibleForecasts = (isHighLevel ? plForecasts : (plForecasts || []).filter((f) => f.created_by === session?.user?.id || f.buyer.includes(session?.user?.name || ""))) || [];

    const dealById = React.useMemo(() => {
        const map = new Map<string, (typeof deals)[number]>();
        deals.forEach((d) => map.set(d.id, d));
        return map;
    }, [deals]);

    const dealByNumber = React.useMemo(() => {
        const map = new Map<string, (typeof deals)[number]>();
        deals.forEach((d) => map.set(normalizeKey(d.deal_number), d));
        return map;
    }, [deals]);

    const shipmentByProject = React.useMemo(() => {
        const map = new Map<string, { projectName: string; mvName: string; buyer: string }>();
        shipments.forEach((sh) => {
            const projectName = shipmentProjectName(sh);
            const projectKey = normalizeKey(projectName);
            if (!projectKey) return;
            if (!map.has(projectKey)) {
                map.set(projectKey, {
                    projectName,
                    mvName: extractMVName(sh.vessel_name || sh.mv_project_name) || "-",
                    buyer: cleanText(sh.buyer) || "-",
                });
            }
        });
        return map;
    }, [shipments]);

    const resolveContext = React.useCallback((f: PLForecastItem) => {
        const linkedDeal = dealById.get(f.deal_id) || dealByNumber.get(normalizeKey(f.deal_number));
        const dealProject =
            cleanText(linkedDeal?.project_id) ||
            extractProjectName(linkedDeal?.vessel_name) ||
            extractMVName(linkedDeal?.vessel_name);
        const forecastProject = cleanText(f.project_name);
        const projectName = forecastProject || dealProject || f.deal_number || "Unmapped Project";
        const shipmentCtx = shipmentByProject.get(normalizeKey(projectName));
        const mvName =
            shipmentCtx?.mvName ||
            extractMVName(linkedDeal?.vessel_name) ||
            extractMVName(projectName) ||
            "-";
        const buyer = cleanText(f.buyer) || cleanText(linkedDeal?.buyer) || shipmentCtx?.buyer || "-";
        return {
            projectName,
            projectKey: normalizeKey(projectName),
            mvName,
            buyer,
            dealNumber: linkedDeal?.deal_number || f.deal_number || "-",
        };
    }, [dealById, dealByNumber, shipmentByProject]);

    const projectRollup = React.useMemo(() => {
        const map = new Map<string, { projectName: string; mvName: string; qty: number; revenue: number; cogs: number; gp: number }>();
        visibleForecasts.forEach((f) => {
            const ctx = resolveContext(f);
            const key = ctx.projectKey || normalizeKey(f.id);
            const row = map.get(key) || {
                projectName: ctx.projectName,
                mvName: ctx.mvName,
                qty: 0,
                revenue: 0,
                cogs: 0,
                gp: 0,
            };
            const revenue = f.quantity * f.selling_price;
            const cogs = f.quantity * (f.buying_price + f.freight_cost + f.other_cost);
            row.qty += f.quantity;
            row.revenue += revenue;
            row.cogs += cogs;
            row.gp += f.total_gross_profit;
            map.set(key, row);
        });
        return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
    }, [visibleForecasts, resolveContext]);

    // Summary stats for CEO view
    const totalRevenue = visibleForecasts.reduce((sum, f) => sum + f.quantity * f.selling_price, 0);
    const totalCOGS = visibleForecasts.reduce((sum, f) => sum + f.quantity * (f.buying_price + f.freight_cost + f.other_cost), 0);
    const totalProfit = visibleForecasts.reduce((sum, f) => sum + f.total_gross_profit, 0);
    const overallMargin = totalRevenue ? (totalProfit / totalRevenue) * 100 : 0;

    const handleLoadDeal = (dealId: string) => {
        const d = deals.find(x => x.id === dealId);
        if (d) {
            const projectName =
                cleanText(d.project_id) ||
                extractProjectName(d.vessel_name) ||
                extractMVName(d.vessel_name) ||
                d.deal_number;
            const projectShipment = shipmentByProject.get(normalizeKey(projectName));
            setForm({
                ...form,
                deal_id: d.id,
                deal_number: d.deal_number,
                project_name: projectName,
                mv_name: projectShipment?.mvName || extractMVName(d.vessel_name) || "-",
                buyer: d.buyer,
                type: d.type,
                quantity: d.quantity,
                selling_price: d.price_per_mt || 0,
            });
        }
    };

    // Live preview
    const liveRevenue = form.quantity * form.selling_price;
    const liveCogs = form.quantity * (form.buying_price + form.freight_cost + form.other_cost);
    const liveProfit = liveRevenue - liveCogs;
    const liveMargin = liveRevenue ? (liveProfit / liveRevenue) * 100 : 0;

    // Show loading while checking authentication
    if (status === "loading") {
        if (isInitializing) return <GlobalLoading />;
        return (
            <AppShell>
                <div className="p-8 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin" />
                </div>
            </AppShell>
        );
    }

    // Redirect if not authenticated or no access
    if (status === "unauthenticated" || !hasAccess) return null;

    return (
        <AppShell>
            <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fade-in">
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold">P&amp;L Forecast</h1>
                        <p className="text-sm text-muted-foreground">MV/Project centric margin simulation. Primary grouping by Project, secondary by MV.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handleManualSync}
                            disabled={isSyncing}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent transition-colors disabled:opacity-50"
                            title="Sync from Google Sheets"
                        >
                            <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
                            {isSyncing ? "Syncing..." : "Sync"}
                        </button>
                        {isHighLevel && (
                            <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary flex items-center gap-1.5 shadow-lg shadow-primary/20">
                                <Plus className="w-4 h-4" /> Create Forecast
                            </button>
                        )}
                    </div>
                </div>

                {/* Summary Cards */}
                {isHighLevel && (
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 animate-slide-up">
                        <div className="card-elevated p-4 border-l-4 border-emerald-500">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Est. Revenue</p>
                            <p className="text-xl font-bold text-emerald-600 mt-1">{formatCurrency(totalRevenue)}</p>
                        </div>
                        <div className="card-elevated p-4 border-l-4 border-rose-500">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5"><TrendingDown className="w-3.5 h-3.5" /> Est. COGS</p>
                            <p className="text-xl font-bold text-rose-500 mt-1">{formatCurrency(totalCOGS)}</p>
                        </div>
                        <div className="card-elevated p-4 border-l-4 border-primary">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Total GP</p>
                            <p className="text-xl font-bold mt-1 text-primary">{formatCurrency(totalProfit)}</p>
                        </div>
                        <div className="card-elevated p-4 border-l-4 border-violet-500">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5"><Percent className="w-3.5 h-3.5" /> Overall Margin</p>
                            <p className={cn("text-xl font-bold mt-1", overallMargin >= 0 ? "text-violet-600" : "text-red-500")}>{safeFmt(overallMargin)}% </p>
                        </div>
                        <div className="card-elevated p-4 border-l-4 border-sky-500">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase">Covered Projects</p>
                            <p className="text-xl font-bold mt-1 text-sky-600">{projectRollup.length}</p>
                        </div>
                    </div>
                )}

                {/* Project Rollup */}
                <div className="card-elevated p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold">Project Rollup</h3>
                        <span className="text-[10px] text-muted-foreground">Aggregated by Project name</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="border-b border-border/50 text-muted-foreground">
                                <tr>
                                    <th className="text-left py-2 pr-3">Project</th>
                                    <th className="text-right py-2 pr-3">Qty (MT)</th>
                                    <th className="text-right py-2 pr-3">Revenue</th>
                                    <th className="text-right py-2 pr-3">COGS</th>
                                    <th className="text-right py-2">GP</th>
                                </tr>
                            </thead>
                            <tbody>
                                {projectRollup.slice(0, 8).map((r) => (
                                    <tr key={`${r.projectName}-${r.mvName}`} className="border-b border-border/30">
                                        <td className="py-2 pr-3">
                                            <p className="font-semibold text-primary">{r.projectName}</p>
                                            <p className="text-[10px] text-muted-foreground">{r.mvName}</p>
                                        </td>
                                        <td className="py-2 pr-3 text-right font-mono">{safeNum(r.qty).toLocaleString()}</td>
                                        <td className="py-2 pr-3 text-right font-mono">{formatCurrency(r.revenue)}</td>
                                        <td className="py-2 pr-3 text-right font-mono text-rose-500">{formatCurrency(r.cogs)}</td>
                                        <td className="py-2 text-right font-mono font-semibold">{formatCurrency(r.gp)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {projectRollup.length === 0 && (
                        <div className="text-center text-sm text-muted-foreground py-6">No project rollup data.</div>
                    )}
                </div>

                {/* Form Section */}
                {showForm && (
                    <div className="card-elevated p-5 space-y-4 animate-scale-in border border-primary/30 bg-primary/5 shadow-xl">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold uppercase tracking-tight text-primary">
                                {editingId ? `Update Costs: ${form.project_name || form.deal_number}` : "Create New P&L Forecast"}
                            </h3>
                            <button onClick={() => { setShowForm(false); resetForm(); }} className="p-1 rounded-lg hover:bg-accent"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {!editingId && (
                                    <div className="sm:col-span-2">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Link Deal (for Project/MV Context)</label>
                                        <select onChange={(e) => handleLoadDeal(e.target.value)} className="w-full mt-1 px-3 py-2.5 rounded-xl bg-background border border-border text-sm outline-none focus:border-primary">
                                            <option value="">Select Existing Deal...</option>
                                            {deals.map(d => {
                                                const projectLabel = cleanText(d.project_id) || extractProjectName(d.vessel_name) || extractMVName(d.vessel_name) || d.deal_number;
                                                const mvLabel = extractMVName(d.vessel_name) || "-";
                                                return (
                                                    <option key={d.id} value={d.id}>
                                                        {projectLabel} | {mvLabel} | {d.deal_number}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                )}
                                <div className="p-3 rounded-lg bg-accent/30 space-y-2">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Project Context</p>
                                    <p className="text-xs font-semibold">Project: <span className="text-primary">{form.project_name || "-"}</span></p>
                                    <p className="text-xs font-semibold">MV: <span className="text-primary">{form.mv_name || "-"}</span></p>
                                    <p className="text-xs font-semibold">Buyer: <span className="text-primary">{form.buyer || "-"}</span></p>
                                    <p className="text-xs font-semibold">Qty: <span className="font-mono">{form.quantity.toLocaleString()} MT</span></p>
                                    <p className="text-xs font-semibold">Selling: <span className="font-mono text-emerald-600">${form.selling_price}/MT</span></p>
                                </div>

                                <div className="space-y-4 pt-1">
                                    <div><label className="text-[10px] font-bold text-muted-foreground uppercase">Buying Price (USD/MT)</label><input type="number" step="0.01" value={form.buying_price || ""} onChange={(e) => setForm({ ...form, buying_price: +e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-xs outline-none focus:border-primary" /></div>
                                    <div><label className="text-[10px] font-bold text-muted-foreground uppercase">Freight Cost (USD/MT)</label><input type="number" step="0.01" value={form.freight_cost || ""} onChange={(e) => setForm({ ...form, freight_cost: +e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-xs outline-none focus:border-primary" /></div>
                                    <div><label className="text-[10px] font-bold text-muted-foreground uppercase">Other Costs (USD/MT)</label><input type="number" step="0.01" value={form.other_cost || ""} onChange={(e) => setForm({ ...form, other_cost: +e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-xs outline-none focus:border-primary" /></div>
                                </div>
                            </div>

                            {/* Live Preview Pane */}
                            <div className="bg-white/50 backdrop-blur border border-border rounded-2xl p-5 flex flex-col justify-between shadow-inner">
                                <div>
                                    <p className="text-[10px] font-bold uppercase text-primary flex items-center gap-1.5 mb-4"><Activity className="w-3.5 h-3.5" /> Margin Simulation</p>
                                    <div className="space-y-3 text-xs">
                                        <div className="flex justify-between font-medium"><span className="text-muted-foreground">Volume:</span> <span className="font-mono">{form.quantity.toLocaleString()} MT</span></div>
                                        <div className="flex justify-between font-medium"><span className="text-muted-foreground">Revenue:</span> <span className="font-mono">{formatCurrency(liveRevenue)}</span></div>
                                        <div className="flex justify-between font-medium"><span className="text-muted-foreground">Total COGS:</span> <span className="font-mono text-rose-500">{formatCurrency(liveCogs)}</span></div>
                                        <div className="w-full h-px bg-border my-2" />
                                        <div className="flex justify-between font-bold text-base"><span className="text-foreground">Total Profit:</span> <span className={cn("font-mono", liveProfit >= 0 ? "text-emerald-600" : "text-red-500")}>{formatCurrency(liveProfit)}</span></div>
                                    </div>
                                </div>
                                <div className={cn("mt-6 p-4 rounded-xl border text-center transition-all", liveProfit >= 0 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" : "bg-red-500/10 border-red-500/20 text-red-600")}>
                                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1">Projected Margin</p>
                                    <p className="text-3xl font-bold">{safeFmt(liveMargin)}%</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-4 pt-4 border-t border-border/50">
                            <button onClick={handleAddOrUpdate} className="btn-primary px-8" disabled={isSaving || (!editingId && !form.deal_id)}>
                                {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : editingId ? "Update Costs" : "Create Forecast"}
                            </button>
                            <button onClick={() => { setShowForm(false); resetForm(); }} className="px-6 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent transition-colors" disabled={isSaving}>Cancel</button>
                        </div>
                    </div>
                )}

                {/* Forecast Table */}
                <div className="card-elevated overflow-hidden animate-slide-up">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-accent/30 border-b border-border">
                                <tr>
                                    <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase">Project / MV</th>
                                    <th className="px-4 py-3 text-right text-[10px] font-bold text-muted-foreground uppercase">Qty (MT)</th>
                                    <th className="px-4 py-3 text-right text-[10px] font-bold text-muted-foreground uppercase">Revenue</th>
                                    <th className="px-4 py-3 text-right text-[10px] font-bold text-muted-foreground uppercase">COGS</th>
                                    <th className="px-4 py-3 text-right text-[10px] font-bold text-muted-foreground uppercase">Margin %</th>
                                    <th className="px-4 py-3 text-right text-[10px] font-bold text-muted-foreground uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleForecasts.map((f) => {
                                    const revenue = f.quantity * f.selling_price;
                                    const cogs = f.quantity * (f.buying_price + f.freight_cost + f.other_cost);
                                    const profit = revenue - cogs;
                                    const margin = revenue ? (profit / revenue) * 100 : 0;
                                    const isProfitable = profit >= 0;
                                    const ctx = resolveContext(f);
                                    return (
                                        <tr key={f.id} className="border-b border-border/30 hover:bg-accent/20 transition-colors">
                                            <td className="px-4 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-primary">{ctx.projectName}</span>
                                                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">{ctx.mvName}</span>
                                                    <span className="text-[10px] text-muted-foreground">{ctx.dealNumber} • {ctx.buyer}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-right font-mono text-xs">{f.quantity.toLocaleString()}</td>
                                            <td className="px-4 py-4 text-right font-mono text-xs">{formatCurrency(revenue)}</td>
                                            <td className="px-4 py-4 text-right font-mono text-xs text-rose-500">{formatCurrency(cogs)}</td>
                                            <td className="px-4 py-4 text-right">
                                                <span className={cn("px-2 py-1 rounded-md text-[10px] font-bold", isProfitable ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600")}>
                                                    {safeFmt(margin)}%
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-right flex justify-end gap-1">
                                                <button onClick={() => handleEdit(f)} className="p-2 rounded-lg hover:bg-primary/10 text-primary transition-colors" title="Input Costs">
                                                    <Edit3 className="w-4 h-4" />
                                                </button>
                                                {isHighLevel && (
                                                    <button
                                                        onClick={async () => {
                                                            if (confirm("Are you sure you want to delete this forecast?")) {
                                                                try {
                                                                    await deletePLForecast(f.id);
                                                                    setToast({ message: "Forecast deleted", type: "success" });
                                                                } catch (err: any) {
                                                                    setToast({ message: err.message || "Failed to delete", type: "error" });
                                                                }
                                                            }
                                                        }}
                                                        className="p-2 rounded-lg hover:bg-rose-500/10 text-rose-500 transition-colors"
                                                        title="Delete Forecast"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {visibleForecasts.length === 0 && <div className="text-center py-12 text-muted-foreground text-sm font-medium">No active P&L Forecasts available.</div>}
                </div>
                {toast && (
                    <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
                )}
            </div>
        </AppShell>
    );
}
