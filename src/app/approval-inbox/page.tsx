"use client";

import React from "react";
import GlobalLoading from "@/app/loading";
import { CheckCircle2, XCircle, Shield, ClipboardList, ShoppingCart, Receipt } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { useAuthStore } from "@/store/auth-store";
import { useTaskStore } from "@/store/task-store";
import { useSalesStore } from "@/store/sales-store";
import { usePurchaseStore } from "@/store/purchase-store";
import { cn, formatRupiah, relativeDate } from "@/lib/utils";

export default function ApprovalInboxPage() {
    const [isInitializing, setIsInitializing] = React.useState(true);

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

    React.useEffect(() => {
        Promise.all([
            syncTasks(),
            syncSales(),
            syncPurchases()
        ]).finally(() => setIsInitializing(false));
    }, [syncTasks, syncSales, syncPurchases]);

    const [activeTab, setActiveTab] = React.useState<"tasks" | "sales" | "purchases">("tasks");

    if (!hasPermission("approval_inbox")) {
        if (isInitializing) return <GlobalLoading />;
        return (
            <AppShell><div className="flex items-center justify-center h-full animate-fade-in"><div className="text-center space-y-2"><Shield className="w-10 h-10 text-muted-foreground/30 mx-auto" /><p className="text-sm text-muted-foreground">Access Restricted</p></div></div></AppShell>
        );
    }

    const tasksInReview = tasks.filter((t) => t.status === "review");
    const pendingSales = orders.filter((o) => o.status === "pending");
    const pendingPurchases = purchases.filter((p) => p.status === "pending");

    const totalPending = tasksInReview.length + pendingSales.length + pendingPurchases.length;

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
