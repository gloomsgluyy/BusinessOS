"use client";

import React from "react";
import { CheckCircle2, XCircle, Shield, ClipboardList, ShoppingCart, Receipt, GitPullRequestArrow, RefreshCw, ExternalLink } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { useAuthStore } from "@/store/auth-store";
import { useTaskStore } from "@/store/task-store";
import { useSalesStore } from "@/store/sales-store";
import { usePurchaseStore } from "@/store/purchase-store";
import { cn, formatRupiah, relativeDate } from "@/lib/utils";
import { ModulePageSkeleton } from "@/components/shared/module-page-skeleton";

type SrsApprovalKind = "forecast_sales" | "early_si" | "source_change" | "barge_change";

type SrsApprovalItem = {
    id: string;
    kind: SrsApprovalKind;
    recordId: string;
    approvalRequestId?: string | null;
    shipmentId?: string | null;
    title: string;
    subtitle: string;
    requestedBy?: string | null;
    createdAt?: string | null;
    slaDueAt?: string | null;
    ageHours?: number | null;
    priority: "critical" | "high" | "medium";
    href: string;
    meta: Record<string, string | number | null>;
};

type SrsApprovalSummary = {
    total: number;
    forecastSales: number;
    earlySi: number;
    sourceChange: number;
    bargeChange: number;
    critical: number;
    overdue: number;
};

const srsKindLabels: Record<SrsApprovalKind, string> = {
    forecast_sales: "Forecast Sales",
    early_si: "Early SI",
    source_change: "Source Change",
    barge_change: "Barge Change",
};

export default function ApprovalInboxPage() {
    const [isInitializing, setIsInitializing] = React.useState(true);
    const [srsItems, setSrsItems] = React.useState<SrsApprovalItem[]>([]);
    const [srsSummary, setSrsSummary] = React.useState<SrsApprovalSummary>({
        total: 0,
        forecastSales: 0,
        earlySi: 0,
        sourceChange: 0,
        bargeChange: 0,
        critical: 0,
        overdue: 0,
    });
    const [srsLoading, setSrsLoading] = React.useState(false);
    const [actingItemId, setActingItemId] = React.useState<string | null>(null);

    const { currentUser, hasPermission } = useAuthStore();

    const tasks = useTaskStore((s) => s.tasks);
    const syncTasks = useTaskStore((s) => s.syncFromMemory);
    const moveTask = useTaskStore((s) => s.moveTask);
    const orders = useSalesStore((s) => s.orders);
    const syncSales = useSalesStore((s) => s.syncFromMemory);
    const approveOrder = useSalesStore((s) => s.approveOrder);
    const rejectOrder = useSalesStore((s) => s.rejectOrder);
    const purchases = usePurchaseStore((s) => s.purchases);
    const syncPurchases = usePurchaseStore((s) => s.syncFromMemory);
    const approvePurchase = usePurchaseStore((s) => s.approvePurchase);
    const rejectPurchase = usePurchaseStore((s) => s.rejectPurchase);

    const loadSrsQueue = React.useCallback(async () => {
        setSrsLoading(true);
        try {
            const res = await fetch("/api/approval-center/pending", { cache: "no-store" });
            if (!res.ok) {
                setSrsItems([]);
                setSrsSummary({ total: 0, forecastSales: 0, earlySi: 0, sourceChange: 0, bargeChange: 0, critical: 0, overdue: 0 });
                return;
            }
            const json = await res.json();
            setSrsItems(Array.isArray(json.items) ? json.items : []);
            setSrsSummary({
                total: Number(json.summary?.total || 0),
                forecastSales: Number(json.summary?.forecastSales || 0),
                earlySi: Number(json.summary?.earlySi || 0),
                sourceChange: Number(json.summary?.sourceChange || 0),
                bargeChange: Number(json.summary?.bargeChange || 0),
                critical: Number(json.summary?.critical || 0),
                overdue: Number(json.summary?.overdue || 0),
            });
        } catch (error) {
            console.error("[approval-inbox] failed to load SRS queue:", error);
        } finally {
            setSrsLoading(false);
        }
    }, []);

    React.useEffect(() => {
        setIsInitializing(true);
        Promise.all([
            syncTasks(),
            syncSales(),
            syncPurchases(),
            loadSrsQueue(),
        ]).finally(() => setIsInitializing(false));
    }, [syncTasks, syncSales, syncPurchases, loadSrsQueue]);

    const [activeTab, setActiveTab] = React.useState<"srs" | "tasks" | "sales" | "purchases">("srs");
    const [srsKindFilter, setSrsKindFilter] = React.useState<"all" | SrsApprovalKind>("all");
    const [srsPriorityFilter, setSrsPriorityFilter] = React.useState<"all" | "critical" | "high" | "medium" | "overdue">("all");

    if (!hasPermission("approval_inbox")) {
        return (
            <AppShell><div className="flex items-center justify-center h-full animate-fade-in"><div className="text-center space-y-2"><Shield className="w-10 h-10 text-muted-foreground/30 mx-auto" /><p className="text-sm text-muted-foreground">Access Restricted</p></div></div></AppShell>
        );
    }

    if (isInitializing) {
        return (
            <AppShell>
                <ModulePageSkeleton titleWidth="w-44" subtitleWidth="w-[30rem]" metricCount={4} cardCount={5} />
            </AppShell>
        );
    }

    const tasksInReview = tasks.filter((t) => t.status === "review");
    const pendingSales = orders.filter((o) => o.status === "pending");
    const pendingPurchases = purchases.filter((p) => p.status === "pending");
    const filteredSrsItems = srsItems.filter((item) => {
        if (srsKindFilter !== "all" && item.kind !== srsKindFilter) return false;
        if (srsPriorityFilter === "overdue") return Boolean(item.slaDueAt && new Date(item.slaDueAt).getTime() < Date.now());
        if (srsPriorityFilter !== "all" && item.priority !== srsPriorityFilter) return false;
        return true;
    });

    const totalPending = srsItems.length + tasksInReview.length + pendingSales.length + pendingPurchases.length;

    const decideSrsItem = async (item: SrsApprovalItem, decision: "approve" | "reject") => {
        const actionLabel = decision === "approve" ? "Approve" : "Reject";
        const comment = window.prompt(`${actionLabel} ${item.title}\n\nComment wajib diisi:`);
        if (!comment?.trim()) return;

        setActingItemId(item.id);
        try {
            let res: Response;
            if (item.kind === "forecast_sales") {
                res = await fetch("/api/memory/projects", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        id: item.recordId,
                        status: decision === "approve" ? "approved" : "rejected",
                        approvalComment: comment.trim(),
                    }),
                });
            } else if (item.kind === "early_si") {
                res = await fetch(`/api/shipments/${item.shipmentId}/shipping-instructions`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        id: item.recordId,
                        action: decision,
                        comment: comment.trim(),
                    }),
                });
            } else if (item.kind === "source_change") {
                res = await fetch(`/api/shipments/${item.shipmentId}/source-changes`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        id: item.recordId,
                        action: decision,
                        comment: comment.trim(),
                    }),
                });
            } else {
                res = await fetch(`/api/shipments/${item.shipmentId}/barge-changes`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        id: item.recordId,
                        action: decision,
                        comment: comment.trim(),
                    }),
                });
            }

            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.error || "Approval action failed");
            await fetch("/api/approval-center/pending", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    approvalRequestId: item.approvalRequestId,
                    kind: item.kind,
                    recordId: item.recordId,
                    status: decision === "approve" ? "approved" : "rejected",
                    comment: comment.trim(),
                }),
            }).catch(() => undefined);
            await loadSrsQueue();
        } catch (error) {
            window.alert(error instanceof Error ? error.message : "Approval action failed");
        } finally {
            setActingItemId(null);
        }
    };

    return (
        <AppShell>
            <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto">
                <div className="mb-6 animate-fade-in">
                    <h1 className="text-xl md:text-2xl font-bold">Approval Inbox</h1>
                    <p className="text-sm text-muted-foreground">
                        {totalPending > 0 ? `You have ${totalPending} item${totalPending > 1 ? "s" : ""} waiting for approval.` : "All caught up! No items need approval."}
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex flex-wrap gap-2 mb-6 px-1 animate-fade-in">
                    <button
                        onClick={() => setActiveTab("srs")}
                        className={cn(
                            "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border",
                            activeTab === "srs"
                                ? "bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-900/20 dark:bg-white dark:text-slate-950 dark:border-white"
                                : "bg-card text-muted-foreground border-border hover:border-slate-500/50 hover:bg-accent"
                        )}
                    >
                        <div className="flex items-center gap-2">
                            <GitPullRequestArrow className="w-3.5 h-3.5" />
                            <span>SRS Queue</span>
                            {srsItems.length > 0 && <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">{srsItems.length}</span>}
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab("tasks")}
                        className={cn(
                            "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border",
                            activeTab === "tasks"
                                ? "bg-blue-500 text-white border-blue-500 shadow-md shadow-blue-500/20"
                                : "bg-card text-muted-foreground border-border hover:border-blue-500/50 hover:bg-accent"
                        )}
                    >
                        <div className="flex items-center gap-2">
                            <ClipboardList className="w-3.5 h-3.5" />
                            <span>Tasks Review</span>
                            {tasksInReview.length > 0 && <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">{tasksInReview.length}</span>}
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab("sales")}
                        className={cn(
                            "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border",
                            activeTab === "sales"
                                ? "bg-violet-500 text-white border-violet-500 shadow-md shadow-violet-500/20"
                                : "bg-card text-muted-foreground border-border hover:border-violet-500/50 hover:bg-accent"
                        )}
                    >
                        <div className="flex items-center gap-2">
                            <ShoppingCart className="w-3.5 h-3.5" />
                            <span>Sales Orders</span>
                            {pendingSales.length > 0 && <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">{pendingSales.length}</span>}
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab("purchases")}
                        className={cn(
                            "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border",
                            activeTab === "purchases"
                                ? "bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20"
                                : "bg-card text-muted-foreground border-border hover:border-emerald-500/50 hover:bg-accent"
                        )}
                    >
                        <div className="flex items-center gap-2">
                            <Receipt className="w-3.5 h-3.5" />
                            <span>Purchase Requests</span>
                            {pendingPurchases.length > 0 && <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">{pendingPurchases.length}</span>}
                        </div>
                    </button>
                </div>

                <div className="space-y-6 min-h-[400px]">
                    {/* SRS Approval Queue */}
                    {activeTab === "srs" && (
                        <div className="animate-slide-up space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
                                {[
                                    ["Total", srsSummary.total],
                                    ["Critical", srsSummary.critical],
                                    ["Overdue", srsSummary.overdue],
                                    ["Forecast", srsSummary.forecastSales],
                                    ["Early SI", srsSummary.earlySi],
                                    ["Source", srsSummary.sourceChange],
                                    ["Barge", srsSummary.bargeChange],
                                ].map(([label, value]) => (
                                    <div key={String(label)} className="rounded-lg border border-border bg-card p-3">
                                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                                        <p className="text-xl font-bold tabular-nums">{value}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="flex items-center justify-between gap-3">
                                <p className="text-xs text-muted-foreground">
                                    Antrean approval lintas Forecast Sales, SI awal, source change, dan barge change.
                                </p>
                                <div className="flex flex-wrap items-center justify-end gap-2">
                                    <select
                                        value={srsKindFilter}
                                        onChange={(event) => setSrsKindFilter(event.target.value as any)}
                                        className="h-8 rounded-lg border border-border bg-card px-2 text-xs outline-none focus:border-primary/50"
                                    >
                                        <option value="all">All kinds</option>
                                        <option value="forecast_sales">Forecast Sales</option>
                                        <option value="early_si">Early SI</option>
                                        <option value="source_change">Source Change</option>
                                        <option value="barge_change">Barge Change</option>
                                    </select>
                                    <select
                                        value={srsPriorityFilter}
                                        onChange={(event) => setSrsPriorityFilter(event.target.value as any)}
                                        className="h-8 rounded-lg border border-border bg-card px-2 text-xs outline-none focus:border-primary/50"
                                    >
                                        <option value="all">All priority</option>
                                        <option value="overdue">Overdue SLA</option>
                                        <option value="critical">Critical</option>
                                        <option value="high">High</option>
                                        <option value="medium">Medium</option>
                                    </select>
                                    <button
                                        onClick={loadSrsQueue}
                                        disabled={srsLoading}
                                        className="h-8 px-3 rounded-lg border border-border bg-card hover:bg-accent text-xs font-medium flex items-center gap-2 disabled:opacity-60"
                                    >
                                        <RefreshCw className={cn("w-3.5 h-3.5", srsLoading && "animate-spin")} />
                                        Refresh
                                    </button>
                                </div>
                            </div>

                            {srsLoading && srsItems.length === 0 ? (
                                <div className="text-center py-12 border-2 border-dashed border-border/50 rounded-xl">
                                    <RefreshCw className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3 animate-spin" />
                                    <p className="text-sm text-muted-foreground">Loading approval queue...</p>
                                </div>
                            ) : filteredSrsItems.length === 0 ? (
                                <div className="text-center py-12 border-2 border-dashed border-border/50 rounded-xl">
                                    <GitPullRequestArrow className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                                    <p className="text-sm text-muted-foreground">No SRS workflow approvals waiting.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {filteredSrsItems.map((item, i) => (
                                        <div key={item.id} className={cn("card-elevated p-4 animate-fade-in", `delay-${Math.min(i + 1, 6)}`)}>
                                            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                                                <div className="w-10 h-10 rounded-lg bg-slate-900/10 text-slate-800 dark:bg-white/10 dark:text-white flex items-center justify-center shrink-0">
                                                    <GitPullRequestArrow className="w-5 h-5" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                                        <span className={cn(
                                                            "text-[10px] px-2 py-0.5 rounded-full font-semibold",
                                                            item.priority === "critical" ? "bg-red-500/10 text-red-600" : "bg-amber-500/10 text-amber-600"
                                                        )}>
                                                            {item.priority}
                                                        </span>
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent text-muted-foreground font-medium">
                                                            {srsKindLabels[item.kind]}
                                                        </span>
                                                        {item.requestedBy && <span className="text-[10px] text-muted-foreground">by {item.requestedBy}</span>}
                                                        {item.ageHours !== null && item.ageHours !== undefined && (
                                                            <span className="text-[10px] text-muted-foreground">{item.ageHours}h open</span>
                                                        )}
                                                    </div>
                                                    <h3 className="text-sm font-semibold truncate">{item.title}</h3>
                                                    <p className="text-xs text-muted-foreground mt-0.5">{item.subtitle}</p>
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        {item.slaDueAt && (
                                                            <span className={cn(
                                                                "text-[10px] px-2 py-1 rounded-md font-semibold",
                                                                new Date(item.slaDueAt).getTime() < Date.now()
                                                                    ? "bg-red-500/10 text-red-600"
                                                                    : "bg-emerald-500/10 text-emerald-600",
                                                            )}>
                                                                SLA: {new Date(item.slaDueAt).toLocaleString()}
                                                            </span>
                                                        )}
                                                        {Object.entries(item.meta || {}).filter(([, value]) => value !== null && value !== "").slice(0, 4).map(([key, value]) => (
                                                            <span key={key} className="text-[10px] px-2 py-1 rounded-md bg-muted text-muted-foreground">
                                                                {key}: <span className="text-foreground">{String(value)}</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap lg:flex-nowrap gap-2 shrink-0">
                                                    <a href={item.href} className="px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-all text-xs font-medium flex items-center gap-1.5">
                                                        <ExternalLink className="w-3.5 h-3.5" /> Open
                                                    </a>
                                                    <button
                                                        onClick={() => decideSrsItem(item, "approve")}
                                                        disabled={actingItemId === item.id}
                                                        className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all text-xs font-medium flex items-center gap-1.5 disabled:opacity-60"
                                                    >
                                                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                                                    </button>
                                                    <button
                                                        onClick={() => decideSrsItem(item, "reject")}
                                                        disabled={actingItemId === item.id}
                                                        className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white transition-all text-xs font-medium flex items-center gap-1.5 disabled:opacity-60"
                                                    >
                                                        <XCircle className="w-3.5 h-3.5" /> Reject
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tasks in Review */}
                    {activeTab === "tasks" && (
                        <div className="animate-slide-up">
                            {tasksInReview.length === 0 ? (
                                <div className="text-center py-12 border-2 border-dashed border-border/50 rounded-2xl">
                                    <ClipboardList className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                                    <p className="text-sm text-muted-foreground">No tasks needing review.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {tasksInReview.map((t, i) => (
                                        <div key={t.id} className={cn("card-elevated p-4 flex items-center gap-4 animate-fade-in", `delay-${Math.min(i + 1, 6)}`)}>
                                            <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                                                <ClipboardList className="w-5 h-5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <h3 className="text-sm font-semibold truncate">{t.title}</h3>
                                                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full capitalize", t.priority === "high" ? "bg-red-500/10 text-red-500" : "bg-blue-500/10 text-blue-500")}>{t.priority}</span>
                                                </div>
                                                <p className="text-xs text-muted-foreground">Submitted by <span className="font-medium text-foreground">{t.assignee_name}</span> · Due {relativeDate(t.due_date)}</p>
                                            </div>
                                            <div className="flex gap-2 shrink-0">
                                                <button onClick={() => moveTask(t.id, "done", currentUser?.name || "System")} className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all text-xs font-medium flex items-center gap-1.5">
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                                                </button>
                                                <button onClick={() => moveTask(t.id, "in_progress", currentUser?.name || "System")} className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all text-xs font-medium flex items-center gap-1.5">
                                                    <XCircle className="w-3.5 h-3.5" /> Reject
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Sales Orders */}
                    {activeTab === "sales" && (
                        <div className="animate-slide-up">
                            {pendingSales.length === 0 ? (
                                <div className="text-center py-12 border-2 border-dashed border-border/50 rounded-2xl">
                                    <ShoppingCart className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                                    <p className="text-sm text-muted-foreground">No pending sales orders.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {pendingSales.map((o, i) => (
                                        <div key={o.id} className={cn("card-elevated p-4 flex items-center gap-4 animate-fade-in", `delay-${Math.min(i + 1, 6)}`)}>
                                            <div className="w-10 h-10 rounded-full bg-violet-500/10 text-violet-500 flex items-center justify-center shrink-0">
                                                <ShoppingCart className="w-5 h-5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <h3 className="text-sm font-semibold">{o.order_number}</h3>
                                                    <span className="text-xs text-muted-foreground">• {o.client}</span>
                                                </div>
                                                <p className="text-xs text-muted-foreground">{o.description}</p>
                                            </div>
                                            <div className="text-right shrink-0 mr-4">
                                                <p className="text-sm font-bold text-violet-500">{formatRupiah(o.amount)}</p>
                                                <p className="text-[10px] text-muted-foreground">{relativeDate(o.created_at)}</p>
                                            </div>
                                            <div className="flex gap-2 shrink-0">
                                                <button onClick={() => approveOrder(o.id, currentUser?.name || "System")} className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all text-xs font-medium flex items-center gap-1.5">
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                                                </button>
                                                <button onClick={() => rejectOrder(o.id)} className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all text-xs font-medium flex items-center gap-1.5">
                                                    <XCircle className="w-3.5 h-3.5" /> Reject
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Purchase Requests */}
                    {activeTab === "purchases" && (
                        <div className="animate-slide-up">
                            {pendingPurchases.length === 0 ? (
                                <div className="text-center py-12 border-2 border-dashed border-border/50 rounded-2xl">
                                    <Receipt className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                                    <p className="text-sm text-muted-foreground">No pending purchase requests.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {pendingPurchases.map((p, i) => (
                                        <div key={p.id} className={cn("card-elevated p-4 flex items-center gap-4 animate-fade-in", `delay-${Math.min(i + 1, 6)}`)}>
                                            <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                                                <Receipt className="w-5 h-5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <h3 className="text-sm font-semibold">{p.request_number}</h3>
                                                    <span className="text-[10px] bg-accent px-1.5 py-0.5 rounded text-muted-foreground">{p.category}</span>
                                                </div>
                                                <p className="text-xs text-muted-foreground">{p.description}</p>
                                            </div>
                                            <div className="text-right shrink-0 mr-4">
                                                <p className="text-sm font-bold text-emerald-500">{formatRupiah(p.amount)}</p>
                                                <p className="text-[10px] text-muted-foreground">{relativeDate(p.created_at)}</p>
                                            </div>
                                            <div className="flex gap-2 shrink-0">
                                                <button onClick={() => approvePurchase(p.id, currentUser?.name || "System")} className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all text-xs font-medium flex items-center gap-1.5">
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                                                </button>
                                                <button onClick={() => rejectPurchase(p.id)} className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all text-xs font-medium flex items-center gap-1.5">
                                                    <XCircle className="w-3.5 h-3.5" /> Reject
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </AppShell>
    );
}
