"use client";

import React from "react";
import { Shield, ScrollText } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { useAuthStore } from "@/store/auth-store";
import { cn, formatDate, getInitials } from "@/lib/utils";
import { ROLES } from "@/lib/constants";
import { AuditLog } from "@/types";

// Demo audit logs
const DEMO_LOGS: AuditLog[] = [
    { id: "log-1", user_name: "Alex Morgan", user_role: "ceo", action: "Approved", target: "Sales Order SO-20251229-R538", created_at: new Date(Date.now() - 86400000).toISOString() },
    { id: "log-2", user_name: "Sarah Chen", user_role: "director", action: "Moved task to Done", target: "System Maintenance", created_at: new Date(Date.now() - 172800000).toISOString() },
    { id: "log-3", user_name: "Rina Wijaya", user_role: "marketing", action: "Created", target: "Purchase Request PR-20260124-EXMR", created_at: new Date(Date.now() - 259200000).toISOString() },
    { id: "log-4", user_name: "Budi Santoso", user_role: "purchasing", action: "Submitted for approval", target: "Purchase Request PR-20251205-LR2S", created_at: new Date(Date.now() - 345600000).toISOString() },
    { id: "log-5", user_name: "Alex Morgan", user_role: "ceo", action: "Updated role", target: "User Dimas Pratama → Operation", created_at: new Date(Date.now() - 432000000).toISOString() },
    { id: "log-6", user_name: "Sarah Chen", user_role: "director", action: "Rejected", target: "Sales Order SO-20260103-TYB6", created_at: new Date(Date.now() - 518400000).toISOString() },
    { id: "log-7", user_name: "Dimas Pratama", user_role: "operation", action: "Added comment", target: "Task: Database optimization", created_at: new Date(Date.now() - 604800000).toISOString() },
    { id: "log-8", user_name: "Alex Morgan", user_role: "ceo", action: "Approved", target: "Purchase Request PR-20251220-K8PV", created_at: new Date(Date.now() - 691200000).toISOString() },
];

export default function AuditLogsPage() {
    const { hasPermission } = useAuthStore();

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

    return (
        <AppShell>
            <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-slate-500/10 flex items-center justify-center">
                        <ScrollText className="w-5 h-5 text-slate-500" />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold">Audit Logs</h1>
                        <p className="text-sm text-muted-foreground">System activity and change history.</p>
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
                                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Target</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {DEMO_LOGS.map((log) => {
                                    const roleCfg = ROLES.find((r) => r.value === log.user_role);
                                    return (
                                        <tr key={log.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: roleCfg?.color }}>
                                                        {getInitials(log.user_name)}
                                                    </div>
                                                    <span className="font-medium text-xs">{log.user_name}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: roleCfg?.color, backgroundColor: `${roleCfg?.color}15` }}>{roleCfg?.label}</span>
                                            </td>
                                            <td className="px-4 py-3 text-xs">{log.action}</td>
                                            <td className="px-4 py-3 text-xs text-muted-foreground">{log.target}</td>
                                            <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(log.created_at)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
