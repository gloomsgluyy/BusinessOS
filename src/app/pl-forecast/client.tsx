"use client";

import React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useAuthStore } from "@/store/auth-store";
import { useCommercialStore } from "@/store/commercial-store";
import { useRouter } from "next/navigation";
import { DollarSign, TrendingUp, TrendingDown, ArrowRight, Activity, Percent, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

const safeNum = (v: number | null | undefined): number => (v != null && !isNaN(v) ? v : 0);
const safeFmt = (v: number | null | undefined, decimals = 2): string => safeNum(v).toFixed(decimals);

const formatCurrency = (n: number) => `$${safeNum(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export default function PLForecastClient() {
    const { hasRole } = useAuthStore();
    const router = useRouter();
    const forecasts = useCommercialStore((s) => s.plForecasts);
    const addPLForecast = useCommercialStore((s) => s.addPLForecast);

    const hasAccess = hasRole(["ceo", "director", "operation", "marketing", "purchasing"]);
    React.useEffect(() => {
        if (!hasAccess) {
            router.push("/");
        }
    }, [hasAccess, router]);

    const [showForm, setShowForm] = React.useState(false);
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

    const handleAdd = () => {
        const total_gross_profit = form.quantity * (form.selling_price - (form.buying_price + form.freight_cost + form.other_cost));
        const gross_profit_mt = total_gross_profit / form.quantity;
        addPLForecast({
            ...form,
            type: form.type as "local" | "export",
            status: "forecast",
            created_by: "system",
        });
        setShowForm(false);
        setForm({ deal_id: "", deal_number: "", buyer: "", type: "", quantity: 0, selling_price: 0, buying_price: 0, freight_cost: 0, other_cost: 0 });
    };
    const { currentUser } = useAuthStore();
    const deals = useCommercialStore((s) => s.deals);

    const isHighLevel = hasRole(["ceo", "director"]);

    // Filter forecasts based on role
    const visibleForecasts = isHighLevel ? forecasts : forecasts.filter((f) => f.created_by === currentUser.id || f.buyer.includes(currentUser.name));

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
                        <h1 className="text-xl md:text-2xl font-bold">P&amp;L</h1>
                        <p className="text-sm text-muted-foreground">Predictive Gross Profit Margin simulations based on live sales and cost matrices.</p>
                    </div>
                    <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-1.5"><Plus className="w-4 h-4" /> Add Project</button>
                </div>

                {/* Summary Cards */}
                {isHighLevel && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="card-elevated p-4 border-border/50">
                            <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Total Global Revenue</p>
                            <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(totalRevenue)}</p>
                        </div>
                        <div className="card-elevated p-4 border-border/50">
                            <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5"><TrendingDown className="w-3.5 h-3.5" /> Total Global COGS</p>
                            <p className="text-2xl font-bold text-rose-500 mt-1">{formatCurrency(totalCOGS)}</p>
                        </div>
                        <div className="card-elevated p-4 border-border/50">
                            <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5"><Percent className="w-3.5 h-3.5" /> Overall Global Margin</p>
                            <p className={cn("text-2xl font-bold mt-1", overallMargin >= 0 ? "text-emerald-500" : "text-red-500")}>{safeFmt(overallMargin)}% </p>
                        </div>
                    </div>
                )}

                {/* Add Project Form */}
                {showForm && (
                    <div className="card-elevated p-5 space-y-4 animate-scale-in">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold">New Project Forecast</h3>
                            <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-accent"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Link Sales Deal</label>
                                    <select onChange={(e) => handleLoadDeal(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg bg-accent/50 border border-border text-sm outline-none focus:border-primary/50">
                                        <option value="">Select Existing Deal...</option>
                                        {deals.map(d => <option key={d.id} value={d.id}>{d.deal_number} - {d.buyer}</option>)}
                                    </select>
                                </div>
                                <div className="hidden sm:block" />
                                <div><label className="text-[10px] font-semibold text-muted-foreground uppercase">Deal Number</label><input placeholder="Manual Deal Number" value={form.deal_number} onChange={(e) => setForm({ ...form, deal_number: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-accent/50 border border-border text-sm outline-none" /></div>
                                <div><label className="text-[10px] font-semibold text-muted-foreground uppercase">Buyer</label><input placeholder="Buyer Name" value={form.buyer} onChange={(e) => setForm({ ...form, buyer: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-accent/50 border border-border text-sm outline-none" /></div>
                                <div><label className="text-[10px] font-semibold text-muted-foreground uppercase">Deal Type</label><input placeholder="Local/Export" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-accent/50 border border-border text-sm outline-none" /></div>
                                <div><label className="text-[10px] font-semibold text-muted-foreground uppercase">Quantity (MT)</label><input type="number" value={form.quantity || ""} onChange={(e) => setForm({ ...form, quantity: +e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-accent/50 border border-border text-sm outline-none" /></div>

                                <div className="sm:col-span-2 mt-2 pt-2 border-t border-border/50 text-[10px] font-bold text-muted-foreground uppercase">Cost Components (USD/MT)</div>
                                <div><label className="text-[10px] font-semibold text-muted-foreground uppercase">Selling Price</label><input type="number" step="0.01" value={form.selling_price || ""} onChange={(e) => setForm({ ...form, selling_price: +e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-accent/50 border border-border text-sm outline-none" /></div>
                                <div><label className="text-[10px] font-semibold text-muted-foreground uppercase">Buying Price</label><input type="number" step="0.01" value={form.buying_price || ""} onChange={(e) => setForm({ ...form, buying_price: +e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-accent/50 border border-border text-sm outline-none" /></div>
                                <div><label className="text-[10px] font-semibold text-muted-foreground uppercase">Freight Cost</label><input type="number" step="0.01" value={form.freight_cost || ""} onChange={(e) => setForm({ ...form, freight_cost: +e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-accent/50 border border-border text-sm outline-none" /></div>
                                <div><label className="text-[10px] font-semibold text-muted-foreground uppercase">Other Cost</label><input type="number" step="0.01" value={form.other_cost || ""} onChange={(e) => setForm({ ...form, other_cost: +e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-accent/50 border border-border text-sm outline-none" /></div>
                            </div>

                            {/* Live Preview Pane */}
                            <div className="bg-accent/20 border border-border rounded-xl p-4 flex flex-col justify-between">
                                <div>
                                    <p className="text-xs font-bold uppercase text-primary flex items-center gap-1.5 mb-4"><Activity className="w-3.5 h-3.5" /> Live GP Preview</p>
                                    <div className="space-y-3 text-sm">
                                        <div className="flex justify-between"><span className="text-muted-foreground">Est. Revenue:</span> <span className="font-mono">{formatCurrency(liveRevenue)}</span></div>
                                        <div className="flex justify-between"><span className="text-muted-foreground">Est. COGS:</span> <span className="font-mono text-rose-500">{formatCurrency(liveCogs)}</span></div>
                                        <div className="w-full h-[1px] bg-border my-1" />
                                        <div className="flex justify-between font-bold"><span className="text-foreground">Est. Profit:</span> <span className={cn("font-mono", liveProfit >= 0 ? "text-emerald-500" : "text-red-500")}>{formatCurrency(liveProfit)}</span></div>
                                    </div>
                                </div>
                                <div className={cn("mt-4 p-3 rounded-xl border text-center", liveProfit >= 0 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" : "bg-red-500/10 border-red-500/20 text-red-600")}>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-1">Projected Margin</p>
                                    <p className="text-2xl font-bold">{safeFmt(liveMargin)}%</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-4 pt-4 border-t border-border/50">
                            <button onClick={handleAdd} className="btn-primary flex items-center gap-1.5"><Plus className="w-4 h-4" /> Save</button>
                            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
                        </div>
                    </div>
                )}

                {/* Forecast Table */}
                <div className="card-elevated overflow-x-auto animate-slide-up">
                    <table className="w-full text-sm">
                        <thead className="bg-accent/30 border-b border-border">
                            <tr>
                                <th className="px-4 py-2 text-left font-semibold text-muted-foreground uppercase">Deal</th>
                                <th className="px-4 py-2 text-right font-semibold text-muted-foreground uppercase">Qty (MT)</th>
                                <th className="px-4 py-2 text-right font-semibold text-muted-foreground uppercase">Revenue</th>
                                <th className="px-4 py-2 text-right font-semibold text-muted-foreground uppercase">COGS</th>
                                <th className="px-4 py-2 text-right font-semibold text-muted-foreground uppercase">Profit</th>
                                <th className="px-4 py-2 text-right font-semibold text-muted-foreground uppercase">Margin</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleForecasts.map((f) => {
                                const revenue = f.quantity * f.selling_price;
                                const cogs = f.quantity * (f.buying_price + f.freight_cost + f.other_cost);
                                const profit = f.total_gross_profit;
                                const margin = revenue ? (profit / revenue) * 100 : 0;
                                const isProfitable = profit >= 0;
                                return (
                                    <tr key={f.id} className="border-b border-border/30 hover:bg-accent/20">
                                        <td className="px-4 py-2 text-sm font-medium">
                                            {f.deal_number}
                                            <p className="text-[10px] text-muted-foreground">{f.buyer}</p>
                                        </td>
                                        <td className="px-4 py-2 text-right text-sm font-mono">{f.quantity.toLocaleString()}</td>
                                        <td className="px-4 py-2 text-right text-sm font-mono">{formatCurrency(revenue)}</td>
                                        <td className="px-4 py-2 text-right text-sm font-mono text-rose-500">{formatCurrency(cogs)}</td>
                                        <td className="px-4 py-2 text-right text-xs font-bold" style={{ color: isProfitable ? "#10b981" : "#ef4444" }}>{safeFmt(margin)}%</td>
                                    </tr>
                                );
                            })}
                            {visibleForecasts.length === 0 && (
                                <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">No active P&L Forecasts available.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </AppShell>
    );
}
