"use client";

import React from "react";
import {
    AlertTriangle,
    CheckCircle2,
    RefreshCw,
    ServerCog,
    Shield,
    XCircle,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";

type CheckStatus = "pass" | "warn" | "fail";

type ReadinessCheck = {
    key: string;
    label: string;
    status: CheckStatus;
    message: string;
};

type ReadinessResponse = {
    success: boolean;
    generatedAt: string;
    overall: CheckStatus;
    summary: {
        total: number;
        pass: number;
        warn: number;
        fail: number;
    };
    checks: ReadinessCheck[];
    error?: string;
};

const emptyReadiness: ReadinessResponse = {
    success: false,
    generatedAt: "",
    overall: "fail",
    summary: { total: 0, pass: 0, warn: 0, fail: 0 },
    checks: [],
};

const statusMeta: Record<CheckStatus, { label: string; className: string; icon: React.ElementType }> = {
    pass: {
        label: "Pass",
        className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        icon: CheckCircle2,
    },
    warn: {
        label: "Warning",
        className: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        icon: AlertTriangle,
    },
    fail: {
        label: "Fail",
        className: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300",
        icon: XCircle,
    },
};

function formatGeneratedAt(value: string) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function ProductionReadinessPage() {
    const { hasPermission } = useAuthStore();
    const [data, setData] = React.useState<ReadinessResponse>(emptyReadiness);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const loadReadiness = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/system/production-readiness", { cache: "no-store" });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok || !payload.success) throw new Error(payload.error || "Failed to load production readiness");
            setData(payload);
        } catch (err) {
            setData(emptyReadiness);
            setError(err instanceof Error ? err.message : "Failed to load production readiness");
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        if (hasPermission("audit_logs")) loadReadiness();
    }, [hasPermission, loadReadiness]);

    if (!hasPermission("audit_logs")) {
        return (
            <AppShell>
                <div className="flex min-h-[60vh] items-center justify-center p-6">
                    <div className="rounded-lg border border-border bg-card p-6 text-center">
                        <Shield className="mx-auto h-10 w-10 text-muted-foreground/40" />
                        <p className="mt-3 text-sm font-semibold">Access Restricted</p>
                        <p className="mt-1 text-xs text-muted-foreground">Production readiness is available for executive system reviewers.</p>
                    </div>
                </div>
            </AppShell>
        );
    }

    const overall = statusMeta[data.overall] || statusMeta.fail;
    const OverallIcon = overall.icon;
    const cards = [
        { label: "Passed", value: data.summary.pass, tone: "border-emerald-500/25" },
        { label: "Warnings", value: data.summary.warn, tone: "border-amber-500/25" },
        { label: "Failed", value: data.summary.fail, tone: "border-rose-500/25" },
        { label: "Total Checks", value: data.summary.total, tone: "border-slate-500/25" },
    ];

    return (
        <AppShell>
            <div className="mx-auto max-w-[1440px] space-y-5 p-4 md:p-6 lg:p-8">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-primary">
                            <ServerCog className="h-5 w-5" />
                            <p className="text-xs font-bold uppercase tracking-wide">Production Readiness</p>
                        </div>
                        <h1 className="mt-1 text-2xl font-bold tracking-tight">Release control checks</h1>
                        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                            Ringkasan environment, database, storage, dan kolom penting sebelum deploy production.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={loadReadiness}
                        disabled={loading}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold hover:bg-accent disabled:opacity-60"
                    >
                        <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                        Refresh
                    </button>
                </div>

                <div className={cn("flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between", overall.className)}>
                    <div className="flex items-start gap-3">
                        <OverallIcon className="mt-0.5 h-5 w-5 shrink-0" />
                        <div>
                            <p className="text-sm font-bold">Overall: {overall.label}</p>
                            <p className="mt-1 text-xs opacity-90">
                                Last check: {formatGeneratedAt(data.generatedAt)}
                            </p>
                        </div>
                    </div>
                    {error && <p className="text-xs font-semibold">{error}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {cards.map((card) => (
                        <div key={card.label} className={cn("rounded-lg border bg-card p-4", card.tone)}>
                            <p className="text-xs font-semibold text-muted-foreground">{card.label}</p>
                            <p className="mt-2 text-2xl font-bold">{card.value}</p>
                        </div>
                    ))}
                </div>

                <div className="card-elevated overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border text-left">
                                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Check</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Message</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.checks.map((item) => {
                                    const meta = statusMeta[item.status] || statusMeta.fail;
                                    const Icon = meta.icon;
                                    return (
                                        <tr key={item.key} className="border-b border-border/50 hover:bg-accent/30">
                                            <td className="px-4 py-3">
                                                <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-bold", meta.className)}>
                                                    <Icon className="h-3.5 w-3.5" />
                                                    {meta.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="text-xs font-semibold">{item.label}</p>
                                                <p className="mt-1 text-[10px] font-mono text-muted-foreground">{item.key}</p>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-muted-foreground">{item.message}</td>
                                        </tr>
                                    );
                                })}
                                {!loading && data.checks.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-4 py-12 text-center text-sm text-muted-foreground">
                                            {error || "No readiness checks available."}
                                        </td>
                                    </tr>
                                )}
                                {loading && (
                                    <tr>
                                        <td colSpan={3} className="px-4 py-12 text-center text-sm text-muted-foreground">
                                            Loading production readiness...
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
