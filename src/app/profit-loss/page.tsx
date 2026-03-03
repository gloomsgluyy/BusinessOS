"use client";

import React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useAuthStore } from "@/store/auth-store";
import { useSalesStore } from "@/store/sales-store";
import { usePurchaseStore } from "@/store/purchase-store";
import { formatRupiah, cn, formatDate } from "@/lib/utils";
import { Shield, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    Legend, ResponsiveContainer, LineChart, Line,
} from "recharts";

const safeNum = (v: number | null | undefined): number => (v != null && !isNaN(v) ? v : 0);
const safeFmt = (v: number | null | undefined, decimals = 2): string => safeNum(v).toFixed(decimals);

export default function ProfitLossPage() {
    const { hasPermission } = useAuthStore();
    const orders = useSalesStore((s) => s.orders);
    const syncSales = useSalesStore((s) => s.syncFromMemory);
    const purchases = usePurchaseStore((s) => s.purchases);
    const syncPurchases = usePurchaseStore((s) => s.syncFromMemory);
    const [period, setPeriod] = React.useState<"monthly" | "quarterly">("monthly");

    React.useEffect(() => {
        syncSales();
        syncPurchases();
    }, [syncSales, syncPurchases]);

    if (!hasPermission("profit_loss")) {
        return (
            <AppShell>
                <div className="flex items-center justify-center h-full">
                    <div className="text-center space-y-2">
                        <Shield className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                        <p className="text-sm font-medium text-muted-foreground">Access Restricted</p>
                    </div>
                </div>
            </AppShell>
        );
    }

    const approvedRevenue = orders.filter((o) => o.status === "approved");
    const approvedExpense = purchases.filter((p) => p.status === "approved");
    const totalRevenue = approvedRevenue.reduce((s, o) => s + o.amount, 0);
    const totalExpense = approvedExpense.reduce((s, p) => s + p.amount, 0);
    const netProfit = totalRevenue - totalExpense;
    const margin = totalRevenue > 0 ? safeFmt((netProfit / totalRevenue) * 100, 1) : "0";

    // Monthly data
    const monthlyData = React.useMemo(() => {
        const months: Record<string, { revenue: number; expense: number }> = {};
        approvedRevenue.forEach((o) => {
            const m = new Date(o.created_at).toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
            months[m] = months[m] || { revenue: 0, expense: 0 };
            months[m].revenue += o.amount;
        });
        approvedExpense.forEach((p) => {
            const m = new Date(p.created_at).toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
            months[m] = months[m] || { revenue: 0, expense: 0 };
            months[m].expense += p.amount;
        });
        return Object.entries(months)
            .map(([month, data]) => ({ month, ...data, profit: data.revenue - data.expense }))
            .sort((a, b) => a.month.localeCompare(b.month));
    }, [approvedRevenue, approvedExpense]);

    return (
        <AppShell>
            <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold">Profit & Loss</h1>
                    <p className="text-sm text-muted-foreground">Income vs expense overview and analysis.</p>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="card-elevated p-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">Total Income</span>
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                        </div>
                        <p className="text-lg font-bold mt-1 text-emerald-600">{formatRupiah(totalRevenue)}</p>
                        <p className="text-[10px] text-muted-foreground">{approvedRevenue.length} approved orders</p>
                    </div>
                    <div className="card-elevated p-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">Total Expenses</span>
                            <TrendingDown className="w-4 h-4 text-red-500" />
                        </div>
                        <p className="text-lg font-bold mt-1 text-red-600">{formatRupiah(totalExpense)}</p>
                        <p className="text-[10px] text-muted-foreground">{approvedExpense.length} approved requests</p>
                    </div>
                    <div className="card-elevated p-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">Net Profit</span>
                            <DollarSign className={cn("w-4 h-4", netProfit >= 0 ? "text-emerald-500" : "text-red-500")} />
                        </div>
                        <p className={cn("text-lg font-bold mt-1", netProfit >= 0 ? "text-emerald-600" : "text-red-600")}>{formatRupiah(netProfit)}</p>
                    </div>
                    <div className="card-elevated p-4">
                        <span className="text-xs font-medium text-muted-foreground">Profit Margin</span>
                        <p className={cn("text-lg font-bold mt-1", Number(margin) >= 0 ? "text-emerald-600" : "text-red-600")}>{margin}%</p>
                    </div>
                </div>

                {/* Chart */}
                <div className="card-elevated p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold">Monthly Income vs Expenses</h3>
                    </div>
                    <div className="h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" />
                                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                                <YAxis tickFormatter={(v) => `${safeFmt(v / 1000000, 0)}jt`} tick={{ fontSize: 11 }} />
                                <Tooltip formatter={(v: number) => [formatRupiah(v)]} />
                                <Legend />
                                <Bar dataKey="revenue" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Profit trend */}
                <div className="card-elevated p-5">
                    <h3 className="text-sm font-semibold mb-4">Profit Trend</h3>
                    <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={monthlyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" />
                                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                                <YAxis tickFormatter={(v) => `${safeFmt(v / 1000000, 0)}jt`} tick={{ fontSize: 11 }} />
                                <Tooltip formatter={(v: number) => [formatRupiah(v)]} />
                                <Line type="monotone" dataKey="profit" name="Net Profit" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Income breakdown */}
                    <div className="card-elevated p-5">
                        <h3 className="text-sm font-semibold mb-3">Income Details (Approved Sales)</h3>
                        <div className="space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                            {approvedRevenue.map((o) => (
                                <div key={o.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                                    <div>
                                        <p className="text-xs font-medium">{o.description}</p>
                                        <p className="text-[10px] text-muted-foreground">{o.order_number} — {formatDate(o.created_at)}</p>
                                    </div>
                                    <span className="text-xs font-semibold text-emerald-600">+ {formatRupiah(o.amount)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Expense breakdown */}
                    <div className="card-elevated p-5">
                        <h3 className="text-sm font-semibold mb-3">Expense Details (Approved Purchases)</h3>
                        <div className="space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                            {approvedExpense.map((p) => (
                                <div key={p.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                                    <div>
                                        <p className="text-xs font-medium">{p.description}</p>
                                        <p className="text-[10px] text-muted-foreground">{p.request_number} — {p.category} — {formatDate(p.created_at)}</p>
                                    </div>
                                    <span className="text-xs font-semibold text-red-500">- {formatRupiah(p.amount)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
