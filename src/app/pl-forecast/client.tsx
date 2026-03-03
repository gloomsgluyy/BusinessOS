"use client";

import React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useAuthStore } from "@/store/auth-store";
import { useCommercialStore } from "@/store/commercial-store";
import { useRouter } from "next/navigation";
import { DollarSign, TrendingUp, TrendingDown, ArrowRight, Activity, Percent, Plus, X, Loader2, Edit3, Trash2 } from "lucide-react";
import { Toast } from "@/components/shared/toast";
import { cn } from "@/lib/utils";
import { PLForecastItem } from "@/types";

const safeNum = (v: number | null | undefined): number => (v != null && !isNaN(v) ? v : 0);
const safeFmt = (v: number | null | undefined, decimals = 2): string => safeNum(v).toFixed(decimals);

const formatCurrency = (n: number) => `$${safeNum(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export default function PLForecastClient() {
    const { hasRole, currentUser } = useAuthStore();
    const router = useRouter();
    const { plForecasts, addPLForecast, updatePLForecast, deletePLForecast, deals, syncFromMemory } = useCommercialStore();

    const hasAccess = hasRole(["ceo", "director", "operation", "marketing", "purchasing"]);
    const isHighLevel = hasRole(["ceo", "director"]);

    React.useEffect(() => {
        if (!hasAccess) {
            router.push("/");
        }
    }, [hasAccess, router]);

    const [showForm, setShowForm] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [toast, setToast] = React.useState<{ message: string; type: "success" | "error" } | null>(null);
    const [editingId, setEditingId] = React.useState<string | null>(null);

    const [form, setForm] = React.useState({
        deal_id: "",
        deal_number: "",
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
                    buying_price: form.buying_price,
                    freight_cost: form.freight_cost,
                    other_cost: form.other_cost,
                });
                console.log("Update successful");
                setToast({ message: "Costs updated successfully!", type: "success" });
            } else {
                console.log("Calling addPLForecast", form);
                await addPLForecast({
                    ...form,
                    type: form.type as "local" | "export",
                    status: "forecast",
                    created_by: currentUser.id || "system",
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
        setForm({ deal_id: "", deal_number: "", buyer: "", type: "", quantity: 0, selling_price: 0, buying_price: 0, freight_cost: 0, other_cost: 0 });
        setEditingId(null);
    };

    const handleEdit = (f: PLForecastItem) => {
        setForm({
            deal_id: f.deal_id,
            deal_number: f.deal_number,
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
    const visibleForecasts = (isHighLevel ? plForecasts : (plForecasts || []).filter((f) => f.created_by === currentUser.id || f.buyer.includes(currentUser.name))) || [];

    // Summary stats for CEO view
    const totalRevenue = visibleForecasts.reduce((sum, f) => sum + f.quantity * f.selling_price, 0);
    const totalCOGS = visibleForecasts.reduce((sum, f) => sum + f.quantity * (f.buying_price + f.freight_cost + f.other_cost), 0);
    const totalProfit = visibleForecasts.reduce((sum, f) => sum + f.total_gross_profit, 0);
    const overallMargin = totalRevenue ? (totalProfit / totalRevenue) * 100 : 0;

    const handleLoadDeal = (dealId: string) => {
        const d = deals.find(x => x.id === dealId);
        if (d) {
            setForm({
                ...form,
                deal_id: d.id,
                deal_number: d.deal_number,
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

    if (!hasAccess) return null;

    return (
        <AppShell>
            <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fade-in">
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold">P&amp;L Forecast</h1>
                        <p className="text-sm text-muted-foreground">Collaborative profit margin simulation. CEO creates, team members input costs.</p>
                    </div>
                    {isHighLevel && (
                        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary flex items-center gap-1.5 shadow-lg shadow-primary/20">
                            <Plus className="w-4 h-4" /> Create Forecast
                        </button>
                    )}
                </div>

                {/* Summary Cards */}
                {isHighLevel && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-slide-up">
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
                    </div>
                )}

                {/* Form Section */}
                {showForm && (
                    <div className="card-elevated p-5 space-y-4 animate-scale-in border border-primary/30 bg-primary/5 shadow-xl">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold uppercase tracking-tight text-primary">
                                {editingId ? `Update Costs: ${form.deal_number}` : "Create New P&L Forecast"}
                            </h3>
                            <button onClick={() => { setShowForm(false); resetForm(); }} className="p-1 rounded-lg hover:bg-accent"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {!editingId && (
                                    <div className="sm:col-span-2">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Link Sales Deal</label>
                                        <select onChange={(e) => handleLoadDeal(e.target.value)} className="w-full mt-1 px-3 py-2.5 rounded-xl bg-background border border-border text-sm outline-none focus:border-primary">
                                            <option value="">Select Existing Deal...</option>
                                            {deals.map(d => <option key={d.id} value={d.id}>{d.deal_number} - {d.buyer}</option>)}
                                        </select>
                                    </div>
                                )}
                                <div className="p-3 rounded-lg bg-accent/30 space-y-2">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Deal Info</p>
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
                            <button onClick={handleAddOrUpdate} className="btn-primary px-8" disabled={isSaving || !form.deal_id}>
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
                                    <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase">Deal / Project</th>
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
                                    return (
                                        <tr key={f.id} className="border-b border-border/30 hover:bg-accent/20 transition-colors">
                                            <td className="px-4 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-primary">{f.deal_number}</span>
                                                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">{f.buyer}</span>
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
