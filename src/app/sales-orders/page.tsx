"use client";

import React from "react";
import { Plus, Search, Filter, Trash2, Send, CheckCircle2, XCircle, ArrowUpDown, Shield, MessageSquare } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { useAuthStore } from "@/store/auth-store";
import { useSalesStore } from "@/store/sales-store";
import { cn, formatRupiah, generateId } from "@/lib/utils";
import { ORDER_STATUSES } from "@/lib/constants";
import { sendWhatsAppInvoice } from "@/lib/whatsapp-client";
import { ImageUpload } from "@/components/ui/image-upload";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationControls } from "@/components/shared/pagination-controls";

export default function SalesOrdersPage() {
    const [, setIsInitializing] = React.useState(false);

    const { currentUser, hasPermission } = useAuthStore();
    const orders = useSalesStore((s) => s.orders);
    const syncFromMemory = useSalesStore((s) => s.syncFromMemory);
    const addOrder = useSalesStore((s) => s.addOrder);
    const deleteOrder = useSalesStore((s) => s.deleteOrder);
    const submitOrder = useSalesStore((s) => s.submitOrder);
    const approveOrder = useSalesStore((s) => s.approveOrder);
    const rejectOrder = useSalesStore((s) => s.rejectOrder);

    React.useEffect(() => {
        syncFromMemory().finally(() => setIsInitializing(false));
    }, [syncFromMemory]);

    const [filterStatus, setFilterStatus] = React.useState("all");
    const [search, setSearch] = React.useState("");
    const [showAdd, setShowAdd] = React.useState(false);

    // Form State
    const [newDesc, setNewDesc] = React.useState("");
    const [newClient, setNewClient] = React.useState("");
    const [newAmount, setNewAmount] = React.useState("");
    const [newPriority, setNewPriority] = React.useState("medium");
    const [useDummyImage, setUseDummyImage] = React.useState(true);
    const [newImageUrl, setNewImageUrl] = React.useState("");

    // Detail Modal State
    const [selectedOrder, setSelectedOrder] = React.useState<any>(null);

    if (!hasPermission("sales_orders")) {
        return (
            <AppShell><div className="flex items-center justify-center h-full animate-fade-in"><div className="text-center space-y-2"><Shield className="w-10 h-10 text-muted-foreground/30 mx-auto" /><p className="text-sm text-muted-foreground">Access Restricted</p></div></div></AppShell>
        );
    }

    const filtered = orders.filter((o) => {
        if (filterStatus !== "all" && o.status !== filterStatus) return false;
        if (search) {
            const q = search.toLowerCase();
            return o.description.toLowerCase().includes(q) || o.order_number.toLowerCase().includes(q) || o.client.toLowerCase().includes(q);
        }
        return true;
    });

    const { page, pageSize, setPage, setPageSize } = usePagination({ defaultPageSize: 10 });
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const paginatedData = filtered.slice((page - 1) * pageSize, page * pageSize);

    const handleAdd = () => {
        const amt = parseFloat(newAmount);
        if (!newDesc.trim() || !newClient.trim() || !newAmount || amt < 0) return;

        addOrder({
            description: newDesc,
            client: newClient,
            amount: amt,
            status: "draft",
            priority: newPriority as any,
            image_url: newImageUrl,
            created_by: currentUser?.id || "system",
            created_by_name: currentUser?.name || "System",
        });

        // Reset
        setNewDesc(""); setNewClient(""); setNewAmount(""); setNewPriority("medium");
        setNewImageUrl(""); setUseDummyImage(true); setShowAdd(false);
    };

    return (
        <AppShell>
            <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto">
                <div className="flex items-center justify-between mb-6 animate-fade-in">
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold">Sales Orders</h1>
                        <p className="text-sm text-muted-foreground">Manage client sales orders.</p>
                    </div>
                    <button onClick={() => setShowAdd(true)} className="btn-primary">
                        <Plus className="w-4 h-4" /> New Order
                    </button>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2 mb-4 animate-fade-in delay-1">
                    <div className="flex items-center gap-1 flex-wrap">
                        {["all", ...ORDER_STATUSES.map((s) => s.value)].map((s) => (
                            <button key={s} onClick={() => setFilterStatus(s)}
                                className={cn("filter-chip", filterStatus === s ? "filter-chip-active" : "filter-chip-inactive")}>
                                {s === "all" ? "All" : ORDER_STATUSES.find((st) => st.value === s)?.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex-1" />
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input value={search} onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search orders..."
                            className="pl-9 pr-3 py-2 rounded-xl border border-border bg-transparent text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-shadow w-48" />
                    </div>
                </div>

                {/* Table */}
                <div className="card-elevated overflow-hidden animate-slide-up delay-2">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-accent/30">
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase text-muted-foreground tracking-wider border-r border-border/30 w-12 text-center">ID</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase text-muted-foreground tracking-wider border-r border-border/30">Order #</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase text-muted-foreground tracking-wider border-r border-border/30">Date</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase text-muted-foreground tracking-wider border-r border-border/30">Client</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase text-muted-foreground tracking-wider border-r border-border/30">Description</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-semibold uppercase text-muted-foreground tracking-wider border-r border-border/30">Amount</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase text-muted-foreground tracking-wider border-r border-border/30">Priority</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase text-muted-foreground tracking-wider border-r border-border/30">Status</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">Created By</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedData.map((o) => {
                                    const statusCfg = ORDER_STATUSES.find((s) => s.value === o.status);
                                    const priorityColor = o.priority === "urgent" ? "text-red-500 bg-red-500/10" : o.priority === "high" ? "text-orange-500 bg-orange-500/10" : o.priority === "medium" ? "text-blue-500 bg-blue-500/10" : "text-slate-500 bg-slate-500/10";
                                    return (
                                        <tr key={o.id} className="border-b border-border/50 last:border-0 hover:bg-accent/20 transition-colors cursor-pointer group" onClick={() => setSelectedOrder(o)}>
                                            <td className="px-4 py-3 text-xs text-muted-foreground border-r border-border/30 text-center">{o.id.substring(0, 5)}</td>
                                            <td className="px-4 py-3 font-medium text-xs text-primary border-r border-border/30">{o.order_number}</td>
                                            <td className="px-4 py-3 text-xs text-muted-foreground border-r border-border/30">{new Date(o.created_at).toISOString().split('T')[0]}</td>
                                            <td className="px-4 py-3 text-xs border-r border-border/30">{o.client}</td>
                                            <td className="px-4 py-3 text-muted-foreground text-xs max-w-[200px] truncate border-r border-border/30">{o.description}</td>
                                            <td className="px-4 py-3 text-right font-semibold text-xs border-r border-border/30">{o.amount.toString()}</td>
                                            <td className="px-4 py-3 border-r border-border/30">
                                                <span className={cn("text-xs font-medium lowercase", priorityColor.replace('bg-', 'text-').replace('/10', ''))}>
                                                    {o.priority || "medium"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 border-r border-border/30">
                                                <span className="text-xs capitalize" style={{ color: statusCfg?.color }}>{statusCfg?.label?.toLowerCase() || o.status}</span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-muted-foreground relative flex items-center justify-between">
                                                <span>{o.created_by_name}</span>
                                                {/* Hidden Actions that show on hover */}
                                                <div className="hidden group-hover:flex items-center gap-1.5 absolute right-4 bg-background px-2 py-1 rounded shadow-sm border border-border">
                                                    <button onClick={(e) => { e.stopPropagation(); sendWhatsAppInvoice(o); }} className="p-1 hover:text-green-500 transition-colors" title="Share via WhatsApp">
                                                        <MessageSquare className="w-3.5 h-3.5" />
                                                    </button>
                                                    {o.status === "draft" && (
                                                        <>
                                                            <button onClick={(e) => { e.stopPropagation(); submitOrder(o.id); }} className="p-1 hover:text-blue-500 transition-colors" title="Submit">
                                                                <Send className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button onClick={(e) => { e.stopPropagation(); deleteOrder(o.id); }} className="p-1 hover:text-red-500 transition-colors" title="Delete">
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </>
                                                    )}
                                                    {o.status === "pending" && hasPermission("approve_sales") && (
                                                        <>
                                                            <button onClick={(e) => { e.stopPropagation(); approveOrder(o.id, currentUser?.name || "System"); }} className="p-1 hover:text-emerald-500 transition-colors" title="Approve">
                                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button onClick={(e) => { e.stopPropagation(); rejectOrder(o.id); }} className="p-1 hover:text-red-500 transition-colors" title="Reject">
                                                                <XCircle className="w-3.5 h-3.5" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {filtered.length > 0 && (
                    <div className="mt-4 flex justify-end">
                        <PaginationControls
                            page={page}
                            pageSize={pageSize}
                            totalItems={totalItems}
                            totalPages={totalPages}
                            hasNextPage={page < totalPages}
                            hasPrevPage={page > 1}
                            onPageChange={setPage}
                            onPageSizeChange={setPageSize}
                        />
                    </div>
                )}

                {/* Add Dialog */}
                {showAdd && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6" onClick={() => setShowAdd(false)}>
                        <div className="absolute inset-0 bg-black/20 animate-backdrop-in" />
                        <div className="relative w-full max-w-lg bg-white dark:bg-[#13141b] rounded-2xl border border-border flex flex-col shadow-2xl animate-scale-in max-h-[90vh] overflow-hidden"
                            onClick={e => e.stopPropagation()}>
                            <div className="p-6 border-b border-border">
                                <h3 className="text-lg font-bold">New Sales Order</h3>
                                <p className="text-sm text-muted-foreground mt-1">Create a new client sales order.</p>
                            </div>

                            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-muted-foreground uppercase">Description</label>
                                    <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Project description..." className="w-full px-3 py-2.5 rounded-xl border border-border bg-transparent text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-shadow" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-muted-foreground uppercase">Client</label>
                                        <input value={newClient} onChange={(e) => setNewClient(e.target.value)} placeholder="Client name" className="w-full px-3 py-2.5 rounded-xl border border-border bg-transparent text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-shadow" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-muted-foreground uppercase">Priority</label>
                                        <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-border bg-transparent text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-shadow">
                                            <option value="low">Low</option>
                                            <option value="medium">Medium</option>
                                            <option value="high">High</option>
                                            <option value="urgent">Urgent</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-muted-foreground uppercase">Amount</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">Rp</span>
                                        <input type="number" min="0" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} placeholder="0" className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-border bg-transparent text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-shadow" />
                                    </div>
                                </div>
                                <div className="space-y-2 pt-2 border-t border-border/50">
                                    <label className="text-xs font-semibold text-muted-foreground uppercase">Image Attachment</label>
                                    <ImageUpload value={newImageUrl} onChange={setNewImageUrl} />
                                </div>
                            </div>

                            <div className="p-4 border-t border-border bg-accent/10 flex justify-end gap-2">
                                <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent transition-colors">Cancel</button>
                                <button onClick={handleAdd} disabled={!newDesc.trim() || !newClient.trim() || !newAmount || parseFloat(newAmount) < 0} className="btn-primary disabled:opacity-30 px-6">Create Order</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Detail Modal */}
                {selectedOrder && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6" onClick={() => setSelectedOrder(null)}>
                        <div className="absolute inset-0 bg-black/20 animate-backdrop-in" />
                        <div className="relative w-full max-w-2xl bg-white dark:bg-[#13141b] rounded-2xl border border-border flex flex-col shadow-2xl animate-scale-in max-h-[90vh] overflow-hidden"
                            onClick={e => e.stopPropagation()}>

                            {/* Header */}
                            <div className="p-6 border-b border-border flex items-start justify-between bg-accent/20">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xs font-mono text-muted-foreground bg-background px-2 py-1 rounded border border-border">{selectedOrder.order_number}</span>
                                        <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded", selectedOrder.priority === 'urgent' ? "bg-red-500/20 text-red-600" : selectedOrder.priority === 'high' ? "bg-orange-500/20 text-orange-600" : "bg-blue-500/20 text-blue-600")}>
                                            {selectedOrder.priority || "MEDIUM"}
                                        </span>
                                    </div>
                                    <h2 className="text-xl font-bold">{selectedOrder.description}</h2>
                                    <p className="text-sm text-muted-foreground mt-1">Client: <span className="text-foreground font-medium">{selectedOrder.client}</span></p>
                                </div>
                                <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded-xl transition-colors">
                                    <XCircle className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-6 space-y-6">
                                {/* Image Section */}
                                {selectedOrder.image_url && (
                                    <div className="rounded-xl overflow-hidden border border-border shadow-sm bg-black/5">
                                        <img src={selectedOrder.image_url} alt="Order attachment" className="w-full h-64 object-cover" />
                                    </div>
                                )}

                                {/* Info Grid */}
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="p-4 rounded-xl bg-accent/30 space-y-1">
                                        <span className="text-xs font-semibold text-muted-foreground uppercase">Amount</span>
                                        <p className="text-lg font-bold text-primary">{formatRupiah(selectedOrder.amount)}</p>
                                    </div>
                                    <div className="p-4 rounded-xl bg-accent/30 space-y-1">
                                        <span className="text-xs font-semibold text-muted-foreground uppercase">Status</span>
                                        <div className="flex items-center gap-2">
                                            <span className="status-badge" style={{
                                                color: ORDER_STATUSES.find(s => s.value === selectedOrder.status)?.color,
                                                backgroundColor: `${ORDER_STATUSES.find(s => s.value === selectedOrder.status)?.color}20`
                                            }}>
                                                {ORDER_STATUSES.find(s => s.value === selectedOrder.status)?.label}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-xl bg-accent/30 space-y-1">
                                        <span className="text-xs font-semibold text-muted-foreground uppercase">Created By</span>
                                        <p className="text-sm font-medium">{selectedOrder.created_by_name}</p>
                                        <p className="text-xs text-muted-foreground">{new Date(selectedOrder.created_at).toLocaleDateString()}</p>
                                    </div>
                                    {selectedOrder.approved_by && (
                                        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                                            <span className="text-xs font-semibold text-emerald-600 uppercase">Approved By</span>
                                            <p className="text-sm font-medium text-emerald-700">{selectedOrder.approved_by}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="p-4 border-t border-border bg-accent/10 flex justify-end gap-2">
                                {selectedOrder.status === 'draft' && <button onClick={() => { submitOrder(selectedOrder.id); setSelectedOrder(null); }} className="btn-primary">Submit Order</button>}
                                <button onClick={() => setSelectedOrder(null)} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent transition-colors">Close</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AppShell>
    );
}
