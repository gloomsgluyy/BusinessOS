"use client";

import React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useCommercialStore } from "@/store/commercial-store";
import { useAuthStore } from "@/store/auth-store";
import { Target, TrendingUp, Filter, Plus, Search, DollarSign, Package, Ship, ChevronDown, CheckCircle2, MessageSquare, Trash2, Send, XCircle } from "lucide-react";
import { cn, formatRupiah, generateId } from "@/lib/utils";
import { SALES_DEAL_STATUSES, COUNTRIES } from "@/lib/constants";
import { SalesDeal } from "@/types";

const safeNum = (v: number | null | undefined): number => (v != null && !isNaN(v) ? v : 0);
const safeFmt = (v: number | null | undefined, decimals = 2): string => safeNum(v).toFixed(decimals);

export default function SalesPlanPage() {
    const { deals, shipments, addDeal, confirmDeal, deleteDeal } = useCommercialStore();
    const { currentUser, hasPermission } = useAuthStore();

    const [timeFilter, setTimeFilter] = React.useState<"30d" | "90d" | "ytd">("30d");
    const [statusFilter, setStatusFilter] = React.useState("all");
    const [buyerAreaFilter, setBuyerAreaFilter] = React.useState("all");
    const [dealTypeFilter, setDealTypeFilter] = React.useState("all");
    const [search, setSearch] = React.useState("");
    const [showFilters, setShowFilters] = React.useState(false);

    // Form states
    const [showAdd, setShowAdd] = React.useState(false);
    const [form, setForm] = React.useState({
        buyer: "", buyer_country: "Indonesia", type: "local" as "local" | "export",
        shipping_terms: "FOB" as any, quantity: 0, price_per_mt: 0,
        laycan_start: "", laycan_end: "", vessel_name: "",
        gar: 4200, ts: 0.8, ash: 5.0, tm: 30, notes: "",
    });

    const currentMonthDeals = deals.filter(d => true); // Assume all for demo
    const currentMonthShipments = shipments.filter(s => true); // Assume all for demo

    // Metrics calculation
    const currentRevenue = currentMonthDeals.reduce((sum, d) => sum + ((d.quantity || 0) * (d.price_per_mt || 0)), 0);
    const totalVolume = currentMonthDeals.reduce((sum, d) => sum + (d.quantity || 0), 0);
    const numShipments = currentMonthShipments.length;
    // Mock Avg Margin logic (Price - $45 base cost)
    const avgMargin = currentMonthDeals.length > 0 ? currentMonthDeals.reduce((sum, d) => sum + ((d.price_per_mt || 0) - 45), 0) / currentMonthDeals.length : 0;

    const filtered = currentMonthDeals.filter((d) => {
        if (statusFilter !== "all" && d.status !== statusFilter) return false;
        if (dealTypeFilter !== "all" && d.type !== dealTypeFilter) return false;
        if (buyerAreaFilter !== "all") {
            if (buyerAreaFilter === "domestic" && d.buyer_country !== "Indonesia") return false;
            if (buyerAreaFilter === "international" && d.buyer_country === "Indonesia") return false;
        }
        if (search) {
            const q = search.toLowerCase();
            return d.buyer.toLowerCase().includes(q) || d.deal_number.toLowerCase().includes(q);
        }
        return true;
    });

    const handleAddDeal = () => {
        addDeal({
            status: "pre_sale", buyer: form.buyer, buyer_country: form.buyer_country,
            type: form.type, shipping_terms: form.shipping_terms,
            quantity: form.quantity, price_per_mt: form.price_per_mt,
            laycan_start: form.laycan_start, laycan_end: form.laycan_end,
            vessel_name: form.vessel_name,
            spec: { gar: form.gar, ts: form.ts, ash: form.ash, tm: form.tm },
            notes: form.notes, created_by: currentUser.id, created_by_name: currentUser.name,
        });
        setShowAdd(false);
    };

    return (
        <AppShell>
            <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6">

                {/* Header & Add Deal (Top Right) */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fade-in relative z-20">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Monthly Sales Plan</h1>
                        <p className="text-sm text-muted-foreground mt-1">Monitor revenue targets, sales volumes, and current deal pipeline.</p>
                    </div>
                    <button onClick={() => setShowAdd(true)} className="btn-primary shadow-lg shadow-primary/20">
                        <Plus className="w-4 h-4 mr-1.5" /> Add Deal
                    </button>
                </div>

                {/* Top Metrics */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up relative z-10">
                    <div className="card-elevated p-5 relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 w-16 h-16 bg-primary/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
                        <div className="flex items-center gap-2 text-muted-foreground mb-3">
                            <DollarSign className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs font-semibold uppercase">Current Month Revenue</span>
                        </div>
                        <p className="text-2xl font-bold font-mono text-emerald-500">${currentRevenue.toLocaleString()}</p>
                    </div>
                    <div className="card-elevated p-5 relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 w-16 h-16 bg-primary/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
                        <div className="flex items-center gap-2 text-muted-foreground mb-3">
                            <Package className="w-4 h-4 text-blue-500" />
                            <span className="text-xs font-semibold uppercase">Volume (MT)</span>
                        </div>
                        <p className="text-2xl font-bold font-mono">{totalVolume.toLocaleString()}</p>
                    </div>
                    <div className="card-elevated p-5 relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 w-16 h-16 bg-primary/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
                        <div className="flex items-center gap-2 text-muted-foreground mb-3">
                            <Ship className="w-4 h-4 text-amber-500" />
                            <span className="text-xs font-semibold uppercase">Shipments</span>
                        </div>
                        <p className="text-2xl font-bold font-mono text-amber-500">{numShipments}</p>
                    </div>
                    <div className="card-elevated p-5 relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 w-16 h-16 bg-primary/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
                        <div className="flex items-center gap-2 text-muted-foreground mb-3">
                            <TrendingUp className="w-4 h-4 text-violet-500" />
                            <span className="text-xs font-semibold uppercase">Avg Margin/MT</span>
                        </div>
                        <p className="text-2xl font-bold font-mono text-violet-400">${safeFmt(Math.max(0, avgMargin))}</p>
                    </div>
                </div>

                {/* Filters & Search */}
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex bg-accent/30 p-1 rounded-xl shrink-0">
                        {["30d", "90d", "ytd"].map(t => (
                            <button key={t} onClick={() => setTimeFilter(t as any)} className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold transition-all uppercase", timeFilter === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
                                {t === "30d" ? "Last 30 Days" : t === "90d" ? "Last 90 Days" : "YTD"}
                            </button>
                        ))}
                    </div>
                    <button onClick={() => setShowFilters(!showFilters)} className={cn("btn-outline text-xs h-8", showFilters && "bg-accent text-foreground")}>
                        <Filter className="w-3.5 h-3.5 mr-1.5" /> Filters
                    </button>
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search buyer..." className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-accent/30 border border-border text-xs outline-none focus:border-primary/50 transition-colors" />
                    </div>
                </div>

                {/* Group Filters Panel */}
                {showFilters && (
                    <div className="card-elevated p-4 animate-slide-up grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase font-semibold text-muted-foreground">Status</label>
                            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full px-3 py-2 bg-accent/30 rounded border border-border text-xs outline-none focus:border-primary/50">
                                <option value="all">All Statuses</option>
                                {SALES_DEAL_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase font-semibold text-muted-foreground">Buyer Area</label>
                            <select value={buyerAreaFilter} onChange={e => setBuyerAreaFilter(e.target.value)} className="w-full px-3 py-2 bg-accent/30 rounded border border-border text-xs outline-none focus:border-primary/50">
                                <option value="all">Global</option>
                                <option value="domestic">Domestic (Indonesia)</option>
                                <option value="international">International (Export)</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase font-semibold text-muted-foreground">Deal Type</label>
                            <select value={dealTypeFilter} onChange={e => setDealTypeFilter(e.target.value)} className="w-full px-3 py-2 bg-accent/30 rounded border border-border text-xs outline-none focus:border-primary/50">
                                <option value="all">All Types</option>
                                <option value="local">Local</option>
                                <option value="export">Export</option>
                            </select>
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
                                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Deal Amount</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Margin/MT</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Expected Date</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Status</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase w-16">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((d) => {
                                    const stCfg = SALES_DEAL_STATUSES.find((s) => s.value === d.status);
                                    const totalVal = (d.quantity || 0) * (d.price_per_mt || 0);
                                    const marginMt = (d.price_per_mt || 0) - 45; // mock margin calculation

                                    return (
                                        <tr key={d.id} className="border-b border-border/50 hover:bg-accent/20 transition-colors">
                                            <td className="px-4 py-3">
                                                <p className="font-semibold text-xs text-primary">{d.buyer}</p>
                                                <p className="text-[10px] text-muted-foreground">{d.buyer_country}</p>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <p className="font-mono text-xs font-semibold">${totalVal.toLocaleString()}</p>
                                                <p className="text-[10px] text-muted-foreground">{d.quantity?.toLocaleString() || 0} MT @ ${d.price_per_mt || 0}</p>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={cn("font-mono text-xs font-medium", marginMt > 0 ? "text-emerald-500" : "text-red-500")}>
                                                    ${safeFmt(Math.max(0, marginMt))}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-muted-foreground">
                                                {d.laycan_start ? new Date(d.laycan_start).toLocaleDateString("en", { day: '2-digit', month: 'short', year: 'numeric' }) : "-"}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="status-badge text-[10px]" style={{ color: stCfg?.color, backgroundColor: `${stCfg?.color}15` }}>
                                                    {stCfg?.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {d.status === "pre_sale" && (
                                                        <button onClick={() => confirmDeal(d.id)} className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 text-[10px] font-semibold hover:bg-emerald-500/20 transition-colors">
                                                            Confirm
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {filtered.length === 0 && <div className="p-12 text-center text-muted-foreground text-sm flex flex-col items-center">
                        <Package className="w-8 h-8 opacity-20 mb-3" />
                        No deals matched your filters.
                    </div>}
                </div>

                {/* Add Deal Modal */}
                {showAdd && (
                    <div className="modal-overlay z-50 fixed inset-0 flex items-center justify-center p-4">
                        <div className="modal-backdrop absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
                        <div className="modal-content relative bg-card border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl animate-scale-in p-6">
                            <h2 className="text-xl font-bold mb-6 text-foreground">Add New Deal</h2>
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5"><label className="text-[10px] font-semibold text-muted-foreground uppercase">Buyer Name</label>
                                        <input value={form.buyer} onChange={e => setForm({ ...form, buyer: e.target.value })} className="w-full px-3 py-2 bg-accent/30 rounded border border-border text-xs outline-none focus:border-primary/50" /></div>
                                    <div className="space-y-1.5"><label className="text-[10px] font-semibold text-muted-foreground uppercase">Buyer Country</label>
                                        <select value={form.buyer_country} onChange={e => setForm({ ...form, buyer_country: e.target.value })} className="w-full px-3 py-2 bg-accent/30 rounded border border-border text-xs outline-none focus:border-primary/50">
                                            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select></div>
                                    <div className="space-y-1.5"><label className="text-[10px] font-semibold text-muted-foreground uppercase">Deal Type</label>
                                        <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as any })} className="w-full px-3 py-2 bg-accent/30 rounded border border-border text-xs outline-none focus:border-primary/50">
                                            <option value="local">Local</option><option value="export">Export</option>
                                        </select></div>
                                    <div className="space-y-1.5"><label className="text-[10px] font-semibold text-muted-foreground uppercase">Expected Date (Laycan Start)</label>
                                        <input type="date" value={form.laycan_start} onChange={e => setForm({ ...form, laycan_start: e.target.value })} className="w-full px-3 py-2 bg-accent/30 rounded border border-border text-xs outline-none focus:border-primary/50" /></div>
                                    <div className="space-y-1.5"><label className="text-[10px] font-semibold text-muted-foreground uppercase">Quantity (MT)</label>
                                        <input type="number" value={form.quantity || ""} onChange={e => setForm({ ...form, quantity: +e.target.value })} className="w-full px-3 py-2 bg-accent/30 rounded border border-border text-xs outline-none focus:border-primary/50" /></div>
                                    <div className="space-y-1.5"><label className="text-[10px] font-semibold text-muted-foreground uppercase">Price / MT (USD)</label>
                                        <input type="number" step="0.5" value={form.price_per_mt || ""} onChange={e => setForm({ ...form, price_per_mt: +e.target.value })} className="w-full px-3 py-2 bg-accent/30 rounded border border-border text-xs outline-none focus:border-primary/50" /></div>
                                </div>
                                <div className="flex gap-2 justify-end mt-6 pt-4 border-t border-border/50">
                                    <button onClick={() => setShowAdd(false)} className="px-5 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors font-medium">Cancel</button>
                                    <button onClick={handleAddDeal} disabled={!form.buyer} className="btn-primary">Save Deal</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AppShell>
    );
}
