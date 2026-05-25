"use client";

import React from "react";
import { RefreshCw, Search, Shield, ScrollText } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { useAuthStore } from "@/store/auth-store";
import { cn, formatDate, getInitials } from "@/lib/utils";
import { ROLES } from "@/lib/constants";

type RealAuditLog = {
    id: string;
    user_name: string;
    user_role?: string | null;
    action: string;
    entity: string;
    entity_id: string;
    details?: string | null;
    created_at: string;
};

function parseDetails(value?: string | null): unknown {
    if (!value) return null;
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

function detailSummary(details: unknown) {
    if (!details) return [];
    if (typeof details === "object" && !Array.isArray(details)) {
        const row = details as Record<string, any>;
        if (Array.isArray(row.changes)) {
            return row.changes.slice(0, 4).map((change: any) => ({
                label: change.label || change.field || "Field",
                value: `${change.oldValue ?? "-"} -> ${change.newValue ?? "-"}`,
            }));
        }
        return Object.entries(row)
            .filter(([, value]) => value !== null && value !== undefined && typeof value !== "object")
            .slice(0, 4)
            .map(([label, value]) => ({ label, value: String(value) }));
    }
    if (Array.isArray(details)) {
        return details.slice(0, 4).map((item, index) => ({
            label: `Item ${index + 1}`,
            value: typeof item === "object" ? JSON.stringify(item) : String(item),
        }));
    }
    return [{ label: "Details", value: String(details) }];
}

export default function AuditLogsPage() {
    const { hasPermission } = useAuthStore();
    const [logs, setLogs] = React.useState<RealAuditLog[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [query, setQuery] = React.useState("");
    const [error, setError] = React.useState<string | null>(null);

    const loadLogs = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/audit-logs?take=250", { cache: "no-store" });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || "Failed to load audit logs");
            setLogs(Array.isArray(data.logs) ? data.logs : []);
        } catch (err) {
            setLogs([]);
            setError(err instanceof Error ? err.message : "Failed to load audit logs");
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        if (hasPermission("audit_logs")) loadLogs();
    }, [hasPermission, loadLogs]);

    if (!hasPermission("audit_logs")) {
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

    const filteredLogs = logs.filter((log) => {
        const needle = query.toLowerCase().trim();
        if (!needle) return true;
        return [log.user_name, log.user_role, log.action, log.entity, log.entity_id, log.details]
            .some((value) => String(value || "").toLowerCase().includes(needle));
    });

    return (
        <AppShell>
            <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-500/10 flex items-center justify-center">
                            <ScrollText className="w-5 h-5 text-slate-500" />
                        </div>
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold">Audit Logs</h1>
                            <p className="text-sm text-muted-foreground">Real system activity, entity history, and available field-level details.</p>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search entity, action, user..."
                                className="h-9 w-full sm:w-72 pl-9 pr-3 rounded-lg border border-border bg-card text-sm outline-none focus:border-primary/50"
                            />
                        </div>
                        <button onClick={loadLogs} disabled={loading} className="h-9 px-3 rounded-lg border border-border bg-card hover:bg-accent text-xs font-semibold flex items-center gap-2 disabled:opacity-60">
                            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                            Refresh
                        </button>
                    </div>
                </div>

                <div className="card-elevated overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border text-left">
                                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">User</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Role</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Action</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Entity</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Details</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLogs.map((log) => {
                                    const details = parseDetails(log.details);
                                    const chips = detailSummary(details);
                                    const roleCfg = ROLES.find((r) => r.value === log.user_role);
                                    return (
                                        <tr key={log.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: roleCfg?.color || "#64748b" }}>
                                                        {getInitials(log.user_name)}
                                                    </div>
                                                    <span className="font-medium text-xs">{log.user_name}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: roleCfg?.color || "#64748b", backgroundColor: `${roleCfg?.color || "#64748b"}15` }}>
                                                    {roleCfg?.label || log.user_role || "System"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs font-semibold">{log.action}</td>
                                            <td className="px-4 py-3 text-xs text-muted-foreground">
                                                <p className="font-semibold text-foreground">{log.entity}</p>
                                                <p className="text-[10px] font-mono">{log.entity_id}</p>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-muted-foreground min-w-[260px]">
                                                {chips.length ? (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {chips.map((chip, index) => (
                                                            <span key={`${chip.label}-${index}`} className="max-w-[320px] truncate rounded-md bg-muted px-2 py-1 text-[10px]">
                                                                <span className="font-semibold text-foreground">{chip.label}:</span> {chip.value}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span>-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(log.created_at)}</td>
                                        </tr>
                                    );
                                })}
                                {!loading && filteredLogs.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                                            {error || "No audit logs found."}
                                        </td>
                                    </tr>
                                )}
                                {loading && (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                                            Loading audit logs...
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
