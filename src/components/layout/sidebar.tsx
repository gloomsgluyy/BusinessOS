"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard, Users, Inbox, ClipboardList, ListChecks,
    ShoppingCart, Receipt, TrendingUp, ScrollText, ChevronLeft, X,
    Ship, Factory, FlaskConical, Beaker, LineChart, Truck, Calendar, DollarSign,
    Anchor, Briefcase, ShieldCheck, Target, Activity, PieChart, Kanban, Map
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { useTaskStore } from "@/store/task-store";
import { usePurchaseStore } from "@/store/purchase-store";
import { useUIStore } from "@/store/ui-store";
import { NAV_SECTIONS } from "@/lib/constants";

const ICON_MAP: Record<string, React.ElementType> = {
    LayoutDashboard, Users, Inbox, ClipboardList, ListChecks,
    ShoppingCart, Receipt, TrendingUp, ScrollText,
    Ship, Factory, FlaskConical, Beaker, LineChart, Truck, Calendar, DollarSign,
    Activity, Anchor, Briefcase, ShieldCheck, Target, PieChart, Kanban, Map
};

function SidebarContent({ collapsed, onClose }: { collapsed: boolean; onClose?: () => void }) {
    const pathname = usePathname();
    const { hasPermission } = useAuthStore();

    // Badge counts
    const tasks = useTaskStore((s) => s.tasks);
    const purchaseRequests = usePurchaseStore((s) => s.purchases);

    // Derived state
    const tasksInReview = React.useMemo(() => tasks.filter((t) => t.status === "review").length, [tasks]);
    const pendingPurchases = React.useMemo(() => purchaseRequests.filter((p) => p.status === "pending").length, [purchaseRequests]);
    const approvalCount = tasksInReview + pendingPurchases;

    const badgeMap: Record<string, number> = { approvalCount };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-[#0b0c14] border-r border-border">
            {/* Logo */}
            <div className="flex items-center justify-between h-14 px-4 border-b border-border shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-sm">
                        <span className="text-xs font-bold text-primary-foreground">C</span>
                    </div>
                    {!collapsed && (
                        <span className="text-sm font-bold tracking-tight">
                            CoalTrade <span className="text-primary">OS</span>
                        </span>
                    )}
                </div>
                {/* Mobile Close Button */}
                {onClose && (
                    <button onClick={onClose} className="md:hidden p-1 rounded-lg hover:bg-accent text-muted-foreground">
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Nav sections */}
            <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 custom-scrollbar">
                {NAV_SECTIONS.map((section, si) => {
                    const visibleItems = section.items.filter(
                        (item) => !item.permission || hasPermission(item.permission)
                    );
                    if (visibleItems.length === 0) return null;

                    return (
                        <div key={si}>
                            {section.title && !collapsed && (
                                <p className="px-4 pt-5 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                                    {section.title}
                                </p>
                            )}
                            {section.title && collapsed && <div className="my-2 mx-3 border-t border-border/50" />}
                            {visibleItems.map((item) => {
                                const Icon = ICON_MAP[item.icon] || LayoutDashboard;
                                const isActive = pathname === item.href;
                                const badge = item.badge ? badgeMap[item.badge] : 0;

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={onClose}
                                        className={cn(
                                            "relative flex items-center gap-3 mx-2 px-3 py-2.5 rounded-xl text-sm transition-all duration-200",
                                            isActive
                                                ? "bg-primary/10 text-primary font-semibold nav-active-indicator"
                                                : "text-muted-foreground hover:bg-accent/80 hover:text-foreground hover:translate-x-0.5"
                                        )}
                                        title={collapsed ? item.label : undefined}
                                    >
                                        <Icon className={cn(
                                            "w-[18px] h-[18px] shrink-0 transition-transform duration-200",
                                            isActive && "drop-shadow-sm"
                                        )} />
                                        {!collapsed && (
                                            <>
                                                <span className="flex-1 truncate">{item.label}</span>
                                                {badge > 0 && (
                                                    <span className="flex items-center justify-center px-2 py-0.5 min-w-[20px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                                                        {badge}
                                                    </span>
                                                )}
                                            </>
                                        )}
                                        {collapsed && badge > 0 && (
                                            <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold">
                                                {badge}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    );
                })}
            </nav>
        </div>
    );
}

export function Sidebar() {
    const [collapsed, setCollapsed] = React.useState(false);
    const { sidebarOpen, setSidebarOpen } = useUIStore();
    const pathname = usePathname();

    // Close mobile sidebar on route change
    React.useEffect(() => {
        setSidebarOpen(false);
    }, [pathname, setSidebarOpen]);

    return (
        <>
            {/* Desktop Sidebar */}
            <aside className={cn(
                "hidden md:flex flex-col h-screen sticky top-0 transition-all duration-300 ease-out z-20",
                collapsed ? "w-[68px]" : "w-[250px]"
            )}>
                <SidebarContent collapsed={collapsed} />

                {/* Collapse toggle */}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="flex items-center justify-center h-11 border-t border-border border-r bg-white dark:bg-[#0b0c14] text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-200"
                >
                    <div className={cn("transition-transform duration-300", collapsed && "rotate-180")}>
                        <ChevronLeft className="w-4 h-4" />
                    </div>
                </button>
            </aside>

            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div className="fixed inset-0 z-50 md:hidden">
                    <div
                        className="absolute inset-0 bg-black/20 animate-fade-in"
                        onClick={() => setSidebarOpen(false)}
                    />
                    <div className="absolute inset-y-0 left-0 w-[280px] animate-slide-in-right shadow-lg">
                        <SidebarContent collapsed={false} onClose={() => setSidebarOpen(false)} />
                    </div>
                </div>
            )}
        </>
    );
}
