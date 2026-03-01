"use client";

import React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useSalesStore } from "@/store/sales-store";
import { useAuthStore } from "@/store/auth-store";
import { SALES_DEAL_STATUSES, COUNTRIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { SalesOrder, OrderStatus } from "@/types";
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
    const { orders, addOrder } = useSalesStore();
    const { currentUser, hasPermission } = useAuthStore();
    const [activeTab, setActiveTab] = React.useState<OrderStatus | "all">("all");
    const [search, setSearch] = React.useState("");
    const [showForm, setShowForm] = React.useState(false);
    const [detailDeal, setDetailDeal] = React.useState<SalesOrder | null>(null);
    const [showReportModal, setShowReportModal] = React.useState(false);

    // Form state
    const [form, setForm] = React.useState({
        client: "", description: "", amount: 0, priority: "medium" as any, status: "pending" as any
    });

    const filtered = orders.filter((o) => {
        if (activeTab !== "all" && o.status !== activeTab) return false;
        if (search) {
            const q = search.toLowerCase();
            return o.client.toLowerCase().includes(q) || o.order_number.toLowerCase().includes(q);
        }
        return true;
    });

    const handleSubmit = () => {
        addOrder({
            client: form.client,
            description: form.description,
            amount: form.amount,
            status: form.status,
            priority: form.priority,
            image_url: "",
            created_by: currentUser.id,
            created_by_name: currentUser.name,
        });
        setShowForm(false);
        setForm({ client: "", description: "", amount: 0, priority: "medium", status: "pending" });
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
                        All ({orders.length})
                    </button>
                    {[{ value: "pending", label: "Pending" }, { value: "approved", label: "Approved" }, { value: "rejected", label: "Rejected" }].map((s) => (
                        <button key={s.value} onClick={() => setActiveTab(s.value as any)} className={cn("filter-chip", activeTab === s.value ? "filter-chip-active" : "filter-chip-inactive")}>
                            {s.label} ({orders.filter((o) => o.status === s.value).length})
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
                            <div><label className="text-[10px] font-semibold text-muted-foreground uppercase">Client</label>
                                <input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-accent/50 border border-border text-sm outline-none focus:border-primary/50" /></div>
                            <div><label className="text-[10px] font-semibold text-muted-foreground uppercase">Amount (USD)</label>
                                <input type="number" step="0.01" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: +e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-accent/50 border border-border text-sm outline-none focus:border-primary/50" /></div>
                            <div><label className="text-[10px] font-semibold text-muted-foreground uppercase">Priority</label>
                                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as any })} className="w-full mt-1 px-3 py-2 rounded-lg bg-accent/50 border border-border text-sm outline-none">
                                    <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                                </select></div>
                            <div className="md:col-span-3"><label className="text-[10px] font-semibold text-muted-foreground uppercase">Description</label>
                                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-accent/50 border border-border text-sm outline-none focus:border-primary/50" /></div>
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
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Priority</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Client</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Description</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Amount (USD)</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Status</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((o) => {
                                    const stColors: Record<string, string> = { pending: "#f59e0b", approved: "#10b981", rejected: "#ef4444" };
                                    const col = stColors[o.status] || "#94a3b8";
                                    return (
                                        <tr key={o.id} className="border-b border-border/50 hover:bg-accent/20 transition-colors">
                                            <td className="px-4 py-3 uppercase text-[10px] font-semibold">{o.priority}</td>
                                            <td className="px-4 py-3">
                                                <div>
                                                    <p className="font-medium text-xs">{o.client}</p>
                                                    <p className="text-[10px] text-muted-foreground">{o.order_number}</p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-xs w-[300px] truncate">{o.description || "-"}</td>
                                            <td className="px-4 py-3 text-right text-xs font-semibold">${o.amount.toLocaleString()}</td>
                                            <td className="px-4 py-3">
                                                <span className="status-badge text-[10px]" style={{ color: col, backgroundColor: `${col}15` }}>
                                                    {o.status.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button onClick={() => setDetailDeal(o)} className="p-1.5 rounded-lg hover:bg-accent transition-colors" title="View Detail">
                                                        <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                                                    </button>
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
                                <h2 className="text-lg font-bold">{detailDeal.order_number}</h2>
                                <button onClick={() => setDetailDeal(null)} className="p-1 rounded-lg hover:bg-accent"><X className="w-4 h-4" /></button>
                            </div>
                            <div className="space-y-3 text-sm">
                                {[
                                    ["Client", detailDeal.client], ["Description", detailDeal.description || "-"],
                                    ["Priority", detailDeal.priority], ["Status", detailDeal.status],
                                    ["Amount", `$${detailDeal.amount.toLocaleString()}`],
                                    ["Created By", detailDeal.created_by_name || "-"],
                                ].map(([k, v]) => (
                                    <div key={k} className="flex justify-between border-b border-border/30 pb-2">
                                        <span className="text-muted-foreground">{k}</span>
                                        <span className="font-medium">{v}</span>
                                    </div>
                                ))}
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
