"use client";

import React from "react";
import { Plus, Search, Trash2, Send, CheckCircle2, XCircle, Shield, BrainCircuit, AlertTriangle, ScanLine, FileText } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { useAuthStore } from "@/store/auth-store";
import { usePurchaseStore } from "@/store/purchase-store";
import { cn, formatRupiah } from "@/lib/utils";
import { PURCHASE_STATUSES } from "@/lib/constants";
import { ImageUpload } from "@/components/ui/image-upload";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { usePagination } from "@/hooks/use-pagination";

export default function PurchaseRequestsPage() {
    const [, setIsInitializing] = React.useState(false);

    const { currentUser, hasPermission } = useAuthStore();
    const purchases = usePurchaseStore((s) => s.purchases);
    const syncFromMemory = usePurchaseStore((s) => s.syncFromMemory);
    const categories = usePurchaseStore((s) => s.categories);
    const addPurchase = usePurchaseStore((s) => s.addPurchase);
    const deletePurchase = usePurchaseStore((s) => s.deletePurchase);
    const submitPurchase = usePurchaseStore((s) => s.submitPurchase);
    const approvePurchase = usePurchaseStore((s) => s.approvePurchase);
    const rejectPurchase = usePurchaseStore((s) => s.rejectPurchase);

    React.useEffect(() => {
        syncFromMemory().finally(() => setIsInitializing(false));
    }, [syncFromMemory]);

    const [filterStatus, setFilterStatus] = React.useState("all");
    const [filterCategory, setFilterCategory] = React.useState("all");
    const [search, setSearch] = React.useState("");
    const [showAdd, setShowAdd] = React.useState(false);

    // Form State
    const [newDesc, setNewDesc] = React.useState("");
    const [newCategory, setNewCategory] = React.useState(categories[0] || "");
    const [newAmount, setNewAmount] = React.useState("");
    const [newPriority, setNewPriority] = React.useState("medium");
    const [useDummyImage, setUseDummyImage] = React.useState(true);
    const [newImageUrl, setNewImageUrl] = React.useState("");
    const [newSupplier, setNewSupplier] = React.useState("");

    // Detail Modal State
    const [selectedPurchase, setSelectedPurchase] = React.useState<any>(null);

    if (!hasPermission("purchase_requests")) {
        return (
            <AppShell><div className="flex items-center justify-center h-full animate-fade-in"><div className="text-center space-y-2"><Shield className="w-10 h-10 text-muted-foreground/30 mx-auto" /><p className="text-sm text-muted-foreground">Access Restricted</p></div></div></AppShell>
        );
    }

    const filtered = purchases.filter((p) => {
        if (filterStatus !== "all" && p.status !== filterStatus) return false;
        if (filterCategory !== "all" && p.category !== filterCategory) return false;
        if (search) {
            const q = search.toLowerCase();
            return p.description.toLowerCase().includes(q) || p.request_number.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
        }
        return true;
    });

    // Pagination Logic
    const { page, pageSize, setPage, setPageSize } = usePagination({ defaultPageSize: 10 });
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

    const handleAdd = () => {
        const amt = parseFloat(newAmount);
        if (!newDesc.trim() || !newAmount || amt < 0) return;

        addPurchase({
            description: newDesc,
            category: newCategory,
            supplier: newSupplier,
            amount: amt,
            status: "draft",
            priority: newPriority as any,
            image_url: newImageUrl,
            created_by: currentUser?.id || "system",
            created_by_name: currentUser?.name || "System",
        });

        // Reset
        setNewDesc(""); setNewCategory(categories[0] || ""); setNewAmount("");
        setNewPriority("medium"); setNewSupplier(""); setNewImageUrl(""); setUseDummyImage(true); setShowAdd(false);
    };

    const stats = {
        total: purchases.filter(p => p.status === "approved").reduce((acc, curr) => acc + curr.amount, 0),
        thisMonth: purchases.filter(p => p.status === "approved" && new Date(p.created_at).getMonth() === new Date().getMonth()).reduce((acc, curr) => acc + curr.amount, 0),
        pending: purchases.filter(p => p.status === "pending").length,
        flagged: purchases.filter(p => p.is_anomaly).length,
    };

    return (
        <AppShell>
            <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6">

                {/* Module Summary */}
                <div className="card-elevated p-6 animate-fade-in border-l-4 border-l-red-500 relative overflow-hidden">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <div className="relative z-10">
                            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><BrainCircuit className="w-6 h-6 text-red-500" /> Expense Tracking</h1>
                            <p className="text-sm text-muted-foreground mt-1 max-w-xl">Intelligent tracking of expenses with automatic anomaly detection and OCR extraction.</p>
                        </div>
                        <button onClick={() => setShowAdd(true)} className="btn-primary relative z-10 h-9">
                            <Plus className="w-4 h-4 mr-1.5" /> Submit Expense
                        </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
                        <div className="bg-background/60 p-4 rounded-xl border border-border/50">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1.5"><FileText className="w-3 h-3" /> Total Approved</p>
                            <p className="text-xl font-bold mt-1 text-primary">{formatRupiah(stats.total)}</p>
                        </div>
                        <div className="bg-background/60 p-4 rounded-xl border border-border/50">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase">This Month</p>
                            <p className="text-xl font-bold mt-1 text-emerald-500">{formatRupiah(stats.thisMonth)}</p>
                        </div>
                        <div className="bg-background/60 p-4 rounded-xl border border-border/50">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase">Pending Review</p>
                            <p className="text-xl font-bold mt-1 text-blue-500">{stats.pending} Requests</p>
                        </div>
                        <div className="bg-red-500/10 p-4 rounded-xl border border-red-500/20">
                            <p className="text-[10px] font-semibold text-red-500 uppercase flex items-center gap-1.5"><AlertTriangle className="w-3 h-3" /> Flagged Items</p>
                            <p className="text-xl font-bold mt-1 text-red-600">{stats.flagged} Anomalies</p>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2 mb-4 animate-fade-in delay-1">
                    <div className="flex items-center gap-1 flex-wrap">
                        {["all", ...PURCHASE_STATUSES.map((s) => s.value)].map((s) => (
                            <button key={s} onClick={() => setFilterStatus(s)}
                                className={cn("filter-chip", filterStatus === s ? "filter-chip-active" : "filter-chip-inactive")}>
                                {s === "all" ? "All" : PURCHASE_STATUSES.find((st) => st.value === s)?.label}
                            </button>
                        ))}
                    </div>
                    <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
                        className="px-3 py-1.5 rounded-xl border border-border bg-transparent text-xs outline-none focus:ring-2 focus:ring-primary/20">
                        <option value="all">All Categories</option>
                        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <div className="flex-1" />
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input value={search} onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search requests..."
                            className="pl-9 pr-3 py-2 rounded-xl border border-border bg-transparent text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-shadow w-48" />
                    </div>
                </div>

                {/* Table */}
                <div className="card-elevated overflow-hidden animate-slide-up delay-2">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-accent/30">
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">Request #</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">Description</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">Category</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">Amount</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">Priority</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">Status</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginated.map((p) => {
                                    const statusCfg = PURCHASE_STATUSES.find((s) => s.value === p.status);
                                    const priorityColor = p.priority === "urgent" ? "text-red-500 bg-red-500/10" : p.priority === "high" ? "text-orange-500 bg-orange-500/10" : p.priority === "medium" ? "text-blue-500 bg-blue-500/10" : "text-slate-500 bg-slate-500/10";
                                    return (
                                        <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-accent/20 transition-colors cursor-pointer" onClick={() => setSelectedPurchase(p)}>
                                            <td className="px-4 py-3 font-medium text-xs text-primary">{p.request_number}</td>
                                            <td className="px-4 py-3 text-muted-foreground text-xs max-w-[200px] truncate">{p.description}</td>
                                            <td className="px-4 py-3 text-xs">
                                                <span className="px-2 py-0.5 rounded-md bg-accent text-[10px] font-medium">{p.category}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold text-xs">{formatRupiah(p.amount)}</td>
                                            <td className="px-4 py-3">
                                                <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide", priorityColor)}>
                                                    {p.priority || "medium"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col gap-1.5 items-start">
                                                    <span className="status-badge text-[10px]" style={{ color: statusCfg?.color, backgroundColor: `${statusCfg?.color}15` }}>{statusCfg?.label}</span>
                                                    {p.is_anomaly && (
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-600 text-[9px] font-bold border border-red-500/20">
                                                            <AlertTriangle className="w-2.5 h-2.5" /> FLAG
                                                        </span>
                                                    )}
                                                    {p.ocr_data && (
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 text-[9px] font-bold border border-blue-500/20" title={`OCR Match: ${p.ocr_data.confidence}%`}>
                                                            <ScanLine className="w-2.5 h-2.5" /> {p.ocr_data.confidence}%
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {p.status === "draft" && (
                                                        <>
                                                            <button onClick={() => submitPurchase(p.id)} className="p-1.5 rounded-lg hover:bg-accent transition-colors text-blue-500" title="Submit">
                                                                <Send className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button onClick={() => deletePurchase(p.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors text-red-500" title="Delete">
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </>
                                                    )}
                                                    {p.status === "pending" && hasPermission("approve_purchases") && (
                                                        <>
                                                            <button onClick={() => approvePurchase(p.id, currentUser?.name || "System")} className="p-1.5 rounded-lg hover:bg-emerald-500/10 transition-colors text-emerald-500" title="Approve">
                                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button onClick={() => rejectPurchase(p.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors text-red-500" title="Reject">
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
                    {filtered.length === 0 ? (
                        <p className="text-sm text-center text-muted-foreground py-8">No requests found</p>
                    ) : (
                        <div className="border-t border-border/50">
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
                </div>

                {/* Add dialog */}
                {showAdd && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6" onClick={() => setShowAdd(false)}>
                        <div className="absolute inset-0 bg-black/20 animate-backdrop-in" />
                        <div className="relative w-full max-w-lg bg-white dark:bg-[#13141b] rounded-2xl border border-border flex flex-col shadow-2xl animate-scale-in max-h-[90vh] overflow-hidden"
                            onClick={e => e.stopPropagation()}>
                            <div className="p-6 border-b border-border">
                                <h3 className="text-lg font-bold">New Purchase Request</h3>
                                <p className="text-sm text-muted-foreground mt-1">Create a new internal purchase request.</p>
                            </div>

                            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-muted-foreground uppercase">Description</label>
                                    <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Item description..." className="w-full px-3 py-2.5 rounded-xl border border-border bg-transparent text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-shadow" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-muted-foreground uppercase">Category</label>
                                        <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-border bg-transparent text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-shadow">
                                            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                                        </select>
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
                                    <label className="text-xs font-semibold text-muted-foreground uppercase">Supplier (Optional)</label>
                                    <input value={newSupplier} onChange={(e) => setNewSupplier(e.target.value)} placeholder="Vendor name" className="w-full px-3 py-2.5 rounded-xl border border-border bg-transparent text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-shadow" />
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
                                <button onClick={handleAdd} disabled={!newDesc.trim() || !newAmount || parseFloat(newAmount) < 0} className="btn-primary disabled:opacity-30 px-6">Create Request</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Detail Modal */}
                {selectedPurchase && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6" onClick={() => setSelectedPurchase(null)}>
                        <div className="absolute inset-0 bg-black/20 animate-backdrop-in" />
                        <div className="relative w-full max-w-2xl bg-white dark:bg-[#13141b] rounded-2xl border border-border flex flex-col shadow-2xl animate-scale-in max-h-[90vh] overflow-hidden"
                            onClick={e => e.stopPropagation()}>

                            {/* Header */}
                            <div className="p-6 border-b border-border flex items-start justify-between bg-accent/20">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xs font-mono text-muted-foreground bg-background px-2 py-1 rounded border border-border">{selectedPurchase.request_number}</span>
                                        <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded", selectedPurchase.priority === 'urgent' ? "bg-red-500/20 text-red-600" : selectedPurchase.priority === 'high' ? "bg-orange-500/20 text-orange-600" : "bg-blue-500/20 text-blue-600")}>
                                            {selectedPurchase.priority || "MEDIUM"}
                                        </span>
                                    </div>
                                    <h2 className="text-xl font-bold">{selectedPurchase.description}</h2>
                                    <p className="text-sm text-muted-foreground mt-1">Category: <span className="text-foreground font-medium">{selectedPurchase.category}</span></p>
                                </div>
                                <button onClick={() => setSelectedPurchase(null)} className="p-2 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded-xl transition-colors">
                                    <XCircle className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-6 space-y-6">
                                {/* Image Section */}
                                {selectedPurchase.image_url && (
                                    <div className="rounded-xl overflow-hidden border border-border shadow-sm bg-black/5">
                                        <img src={selectedPurchase.image_url} alt="Purchase attachment" className="w-full h-64 object-cover" />
                                    </div>
                                )}

                                {/* Info Grid */}
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="p-4 rounded-xl bg-accent/30 space-y-1">
                                        <span className="text-xs font-semibold text-muted-foreground uppercase">Amount</span>
                                        <p className="text-lg font-bold text-primary">{formatRupiah(selectedPurchase.amount)}</p>
                                    </div>
                                    <div className="p-4 rounded-xl bg-accent/30 space-y-1">
                                        <span className="text-xs font-semibold text-muted-foreground uppercase">Supplier</span>
                                        <p className="text-sm font-medium">{selectedPurchase.supplier || "-"}</p>
                                    </div>
                                    <div className="p-4 rounded-xl bg-accent/30 space-y-1">
                                        <span className="text-xs font-semibold text-muted-foreground uppercase">AI Diagnostics</span>
                                        <div className="space-y-2 mt-2">
                                            {selectedPurchase.is_anomaly ? (
                                                <div className="flex items-start gap-2 text-xs bg-red-500/10 text-red-600 p-2 rounded-lg border border-red-500/20">
                                                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                                    <p><strong>Anomaly Detected:</strong> {selectedPurchase.anomaly_reason || "Unusual expense behavior"}</p>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-500/10 p-2 rounded-lg">
                                                    <CheckCircle2 className="w-4 h-4" /> AI Check Passed
                                                </div>
                                            )}
                                            {selectedPurchase.ocr_data && (
                                                <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-500/10 p-2 rounded-lg">
                                                    <ScanLine className="w-4 h-4" /> Receipt OCR Confidence: {selectedPurchase.ocr_data.confidence}%
                                                </div>
                                            )}
                                            {!selectedPurchase.ocr_data && !selectedPurchase.is_anomaly && (
                                                <p className="text-xs text-muted-foreground italic">No AI data analyzed</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-xl bg-accent/30 space-y-1">
                                        <span className="text-xs font-semibold text-muted-foreground uppercase">Status</span>
                                        <div className="flex items-center gap-2">
                                            <span className="status-badge" style={{
                                                color: PURCHASE_STATUSES.find(s => s.value === selectedPurchase.status)?.color,
                                                backgroundColor: `${PURCHASE_STATUSES.find(s => s.value === selectedPurchase.status)?.color}20`
                                            }}>
                                                {PURCHASE_STATUSES.find(s => s.value === selectedPurchase.status)?.label}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-xl bg-accent/30 space-y-1">
                                        <span className="text-xs font-semibold text-muted-foreground uppercase">Created By</span>
                                        <p className="text-sm font-medium">{selectedPurchase.created_by_name}</p>
                                        <p className="text-xs text-muted-foreground">{new Date(selectedPurchase.created_at).toLocaleDateString()}</p>
                                    </div>
                                    {selectedPurchase.approved_by && (
                                        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                                            <span className="text-xs font-semibold text-emerald-600 uppercase">Approved By</span>
                                            <p className="text-sm font-medium text-emerald-700">{selectedPurchase.approved_by}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="p-4 border-t border-border bg-accent/10 flex justify-end gap-2">
                                {selectedPurchase.status === 'draft' && <button onClick={() => { submitPurchase(selectedPurchase.id); setSelectedPurchase(null); }} className="btn-primary">Submit Request</button>}
                                <button onClick={() => setSelectedPurchase(null)} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent transition-colors">Close</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AppShell>
    );
}
