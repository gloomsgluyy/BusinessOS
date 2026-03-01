"use client";

import React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useCommercialStore } from "@/store/commercial-store";
import { useAuthStore } from "@/store/auth-store";
import { SALES_DEAL_STATUSES, COUNTRIES, COAL_SPEC_FIELDS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { SalesDeal, SalesDealStatus, CoalSpec } from "@/types";
import {
    TrendingUp, Plus, Search, Filter, ChevronDown, X,
    Ship, Globe, MapPin, Package, ArrowUpRight, Eye, Download
} from "lucide-react";
import { ReportModal } from "@/components/shared/report-modal";

function SpecBadge({ label, value, unit }: { label: string; value?: number; unit: string }) {
    if (!value && value !== 0) return null;
    return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent/60 text-[10px] font-mono">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-semibold">{value}{unit && ` ${unit}`}</span>
        </span>
    );
}

export default function SalesMonitorPage() {
    const { deals, addDeal, updateDeal, deleteDeal, confirmDeal } = useCommercialStore();
    const { currentUser, hasPermission } = useAuthStore();
    const [activeTab, setActiveTab] = React.useState<SalesDealStatus | "all">("all");
    const [search, setSearch] = React.useState("");
    const [showForm, setShowForm] = React.useState(false);
    const [detailDeal, setDetailDeal] = React.useState<SalesDeal | null>(null);
    const [showReportModal, setShowReportModal] = React.useState(false);

    // Form state
    const [form, setForm] = React.useState({
        buyer: "", buyer_country: "Indonesia", type: "local" as "local" | "export",
        shipping_terms: "FOB" as any, quantity: 0, price_per_mt: 0,
        laycan_start: "", laycan_end: "", vessel_name: "",
        gar: 4200, ts: 0.8, ash: 5.0, tm: 30, notes: "",
    });

    const filtered = deals.filter((d) => {
        if (activeTab !== "all" && d.status !== activeTab) return false;
        if (search) {
            const q = search.toLowerCase();
            return d.buyer.toLowerCase().includes(q) || d.deal_number.toLowerCase().includes(q) || (d.vessel_name || "").toLowerCase().includes(q);
        }
        return true;
    });

    const handleSubmit = () => {
        addDeal({
            status: "pre_sale", buyer: form.buyer, buyer_country: form.buyer_country,
            type: form.type, shipping_terms: form.shipping_terms,
            quantity: form.quantity, price_per_mt: form.price_per_mt,
            laycan_start: form.laycan_start, laycan_end: form.laycan_end,
            vessel_name: form.vessel_name,
            spec: { gar: form.gar, ts: form.ts, ash: form.ash, tm: form.tm },
            notes: form.notes, created_by: currentUser.id, created_by_name: currentUser.name,
        });
        setShowForm(false);
        setForm({ buyer: "", buyer_country: "Indonesia", type: "local", shipping_terms: "FOB", quantity: 0, price_per_mt: 0, laycan_start: "", laycan_end: "", vessel_name: "", gar: 4200, ts: 0.8, ash: 5.0, tm: 30, notes: "" });
    };

    return (
        <AppShell>
            <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6">
                {/* Module Summary */}
                <div className="card-elevated p-6 animate-fade-in border-l-4 border-l-emerald-500 relative overflow-hidden">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Sales Monitor</h1>
                            <p className="text-sm text-muted-foreground mt-1 max-w-xl">Track sales deals from pre-sale negotiation to confirmed projects and fulfillment.</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setShowForm(!showForm)} className="btn-primary h-9"><Plus className="w-4 h-4 mr-1.5" /> New Deal</button>
                            <button onClick={() => setShowReportModal(true)} className="btn-outline text-xs h-9 hidden sm:flex"><Download className="w-3.5 h-3.5 mr-1.5" /> Download Report</button>
                        </div>
                    </div>
                </div>

                {/* Status Tabs */}
                <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => setActiveTab("all")} className={cn("filter-chip", activeTab === "all" ? "filter-chip-active" : "filter-chip-inactive")}>
                        All ({deals.length})
                    </button>
                    {SALES_DEAL_STATUSES.map((s) => (
                        <button key={s.value} onClick={() => setActiveTab(s.value)} className={cn("filter-chip", activeTab === s.value ? "filter-chip-active" : "filter-chip-inactive")}>
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

                {/* Add Deal Form */}
                {showForm && (
                    <div className="card-elevated p-5 space-y-4 animate-scale-in">
                        <h3 className="text-sm font-semibold">New Sales Deal</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div><label className="text-[10px] font-semibold text-muted-foreground uppercase">Buyer</label>
                                <input value={form.buyer} onChange={(e) => setForm({ ...form, buyer: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-accent/50 border border-border text-sm outline-none focus:border-primary/50" /></div>
                            <div><label className="text-[10px] font-semibold text-muted-foreground uppercase">Country</label>
                                <select value={form.buyer_country} onChange={(e) => setForm({ ...form, buyer_country: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-accent/50 border border-border text-sm outline-none">
                                    {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                                </select></div>
                            <div><label className="text-[10px] font-semibold text-muted-foreground uppercase">Type</label>
                                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })} className="w-full mt-1 px-3 py-2 rounded-lg bg-accent/50 border border-border text-sm outline-none">
                                    <option value="local">Local</option><option value="export">Export</option>
                                </select></div>
                            <div><label className="text-[10px] font-semibold text-muted-foreground uppercase">Shipping Terms</label>
                                <select value={form.shipping_terms} onChange={(e) => setForm({ ...form, shipping_terms: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-accent/50 border border-border text-sm outline-none">
                                    {["FOB", "CIF", "CFR", "FAS", "DAP"].map((t) => <option key={t} value={t}>{t}</option>)}
                                </select></div>
                            <div><label className="text-[10px] font-semibold text-muted-foreground uppercase">Quantity (MT)</label>
                                <input type="number" value={form.quantity || ""} onChange={(e) => setForm({ ...form, quantity: +e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-accent/50 border border-border text-sm outline-none focus:border-primary/50" /></div>
                            <div><label className="text-[10px] font-semibold text-muted-foreground uppercase">Price (USD/MT)</label>
                                <input type="number" step="0.01" value={form.price_per_mt || ""} onChange={(e) => setForm({ ...form, price_per_mt: +e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-accent/50 border border-border text-sm outline-none focus:border-primary/50" /></div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div><label className="text-[10px] font-semibold text-muted-foreground uppercase">GAR (kcal/kg)</label>
                                <input type="number" value={form.gar} onChange={(e) => setForm({ ...form, gar: +e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-accent/50 border border-border text-sm outline-none focus:border-primary/50" /></div>
                            <div><label className="text-[10px] font-semibold text-muted-foreground uppercase">TS (%)</label>
                                <input type="number" step="0.01" value={form.ts} onChange={(e) => setForm({ ...form, ts: +e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-accent/50 border border-border text-sm outline-none focus:border-primary/50" /></div>
                            <div><label className="text-[10px] font-semibold text-muted-foreground uppercase">ASH (%)</label>
                                <input type="number" step="0.01" value={form.ash} onChange={(e) => setForm({ ...form, ash: +e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-accent/50 border border-border text-sm outline-none focus:border-primary/50" /></div>
                            <div><label className="text-[10px] font-semibold text-muted-foreground uppercase">TM (%)</label>
                                <input type="number" step="0.01" value={form.tm} onChange={(e) => setForm({ ...form, tm: +e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-accent/50 border border-border text-sm outline-none focus:border-primary/50" /></div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleSubmit} className="btn-primary"><Plus className="w-4 h-4" /> Create Deal</button>
                            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
                        </div>
                    </div>
                )}

                {/* Deals Table */}
                <div className="card-elevated overflow-hidden animate-slide-up">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-accent/30">
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Status</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Buyer</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Terms</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Qty (MT)</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Laycan</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Vessel</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Spec</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((d) => {
                                    const stCfg = SALES_DEAL_STATUSES.find((s) => s.value === d.status);
                                    return (
                                        <tr key={d.id} className="border-b border-border/50 hover:bg-accent/20 transition-colors">
                                            <td className="px-4 py-3">
                                                <span className="status-badge text-[10px]" style={{ color: stCfg?.color, backgroundColor: `${stCfg?.color}15` }}>
                                                    {stCfg?.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div>
                                                    <p className="font-medium text-xs">{d.buyer}</p>
                                                    <p className="text-[10px] text-muted-foreground">{d.deal_number} · {d.type === "export" ? "Export" : "Local"}</p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-xs">{d.shipping_terms}</td>
                                            <td className="px-4 py-3 text-right text-xs font-semibold">{d.quantity.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-xs text-muted-foreground">
                                                {d.laycan_start ? `${new Date(d.laycan_start).toLocaleDateString("en", { day: "2-digit", month: "short" })}` : "-"}
                                            </td>
                                            <td className="px-4 py-3 text-xs">{d.vessel_name || "-"}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-1">
                                                    <SpecBadge label="GAR" value={d.spec.gar} unit="" />
                                                    <SpecBadge label="TS" value={d.spec.ts} unit="%" />
                                                    <SpecBadge label="ASH" value={d.spec.ash} unit="%" />
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button onClick={() => setDetailDeal(d)} className="p-1.5 rounded-lg hover:bg-accent transition-colors" title="View Detail">
                                                        <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                                                    </button>
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
                    {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No deals found</p>}
                </div>

                {/* Detail Modal */}
                {detailDeal && (
                    <div className="modal-overlay">
                        <div className="modal-backdrop" onClick={() => setDetailDeal(null)} />
                        <div className="modal-content bg-card border border-border rounded-xl shadow-lg p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold">{detailDeal.deal_number}</h2>
                                <button onClick={() => setDetailDeal(null)} className="p-1 rounded-lg hover:bg-accent"><X className="w-4 h-4" /></button>
                            </div>
                            <div className="space-y-3 text-sm">
                                {[
                                    ["Buyer", detailDeal.buyer], ["Country", detailDeal.buyer_country || "-"],
                                    ["Type", detailDeal.type], ["Terms", detailDeal.shipping_terms],
                                    ["Quantity", `${detailDeal.quantity.toLocaleString()} MT`],
                                    ["Price", detailDeal.price_per_mt ? `$${detailDeal.price_per_mt}/MT` : "-"],
                                    ["Total Value", detailDeal.total_value ? `$${detailDeal.total_value.toLocaleString()}` : "-"],
                                    ["Laycan", detailDeal.laycan_start ? `${detailDeal.laycan_start} - ${detailDeal.laycan_end}` : "-"],
                                    ["Vessel", detailDeal.vessel_name || "-"],
                                    ["PIC", detailDeal.pic_name || "-"],
                                ].map(([k, v]) => (
                                    <div key={k} className="flex justify-between border-b border-border/30 pb-2">
                                        <span className="text-muted-foreground">{k}</span>
                                        <span className="font-medium">{v}</span>
                                    </div>
                                ))}
                                <h4 className="text-xs font-semibold uppercase text-muted-foreground pt-2">Coal Specifications</h4>
                                <div className="flex flex-wrap gap-2">
                                    <SpecBadge label="GAR" value={detailDeal.spec.gar} unit="kcal/kg" />
                                    <SpecBadge label="TS" value={detailDeal.spec.ts} unit="%" />
                                    <SpecBadge label="ASH" value={detailDeal.spec.ash} unit="%" />
                                    <SpecBadge label="TM" value={detailDeal.spec.tm} unit="%" />
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
                    }}
                />
            </div>
        </AppShell>
    );
}
