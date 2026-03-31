"use client";

import React from "react";
import { Search, ChevronDown, X, Check, Menu, Bell, AlertTriangle, Info, BellRing } from "lucide-react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn, getInitials } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { useTaskStore } from "@/store/task-store";
import { useSalesStore } from "@/store/sales-store";
import { usePurchaseStore } from "@/store/purchase-store";
import { useUIStore } from "@/store/ui-store";
import { useCommercialStore } from "@/store/commercial-store";
import { ROLES } from "@/lib/constants";

export function Header() {
    const { currentUser, switchRole } = useAuthStore();
    const { toggleSidebar } = useUIStore();
    const [roleOpen, setRoleOpen] = React.useState(false);
    const [searchOpen, setSearchOpen] = React.useState(false);
    const [notificationOpen, setNotificationOpen] = React.useState(false);
    const [notifTab, setNotifTab] = React.useState("All");
    const [searchQuery, setSearchQuery] = React.useState("");
    const [mounted, setMounted] = React.useState(false);
    const pathname = usePathname();

    React.useEffect(() => setMounted(true), []);

    // Search across all data
    const tasks = useTaskStore((s) => s.tasks);
    const orders = useSalesStore((s) => s.orders);
    const purchases = usePurchaseStore((s) => s.purchases);

    const searchResults = React.useMemo(() => {
        if (!searchQuery.trim()) return [];
        const q = searchQuery.toLowerCase();
        const results: { type: string; title: string; sub: string; href: string }[] = [];

        tasks.filter((t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
            .slice(0, 3).forEach((t) => results.push({ type: "Task", title: t.title, sub: t.assignee_name, href: "/my-tasks" }));

        orders.filter((o) => o.description.toLowerCase().includes(q) || o.order_number.toLowerCase().includes(q) || o.client.toLowerCase().includes(q))
            .slice(0, 3).forEach((o) => results.push({ type: "Sales", title: o.order_number, sub: o.description, href: "/sales-orders" }));

        purchases.filter((p) => p.description.toLowerCase().includes(q) || p.request_number.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
            .slice(0, 3).forEach((p) => results.push({ type: "Purchase", title: p.request_number, sub: p.description, href: "/purchase-requests" }));

        return results;
    }, [searchQuery, tasks, orders, purchases]);

    // Page title
    const pageTitle = React.useMemo(() => {
        const map: Record<string, string> = {
            "/": "Dashboard",
            "/users": "User Management",
            "/approval-inbox": "Approval Inbox",
            "/my-tasks": "My Tasks",
            "/all-tasks": "All Tasks",
            "/sales-orders": "Sales Orders",
            "/purchase-requests": "Purchase Requests",
            "/profit-loss": "Profit & Loss",
            "/audit-logs": "Audit Logs",
            "/sales-monitor": "Sales Monitor",
            "/shipment-monitor": "Shipment Monitor",
            "/sources": "Sources",
            "/quality": "Quality",
            "/blending": "Blending Simulation",
            "/market-price": "Market Price",
            "/meetings": "Meetings",
            "/transshipment": "Transshipment / Freight",
            "/operations": "Operations Overview",
            "/directory": "Partners & Directory",
            "/projects": "Sales Projects",
            "/compliance": "Compliance & Legal",
            "/ai-optimization": "AI Optimization",
            "/pl-forecast": "P&L Forecast",
        };
        return map[pathname] || "Dashboard";
    }, [pathname]);

    const roleConfig = ROLES.find((r) => r.value === currentUser?.role);

    const isHighLevel = currentUser ? ["ceo", "director", "operation"].includes(currentUser.role) : false;
    const shipments = useCommercialStore((s) => s.shipments);
    const meetings = useCommercialStore((s) => s.meetings);
    const marketPrices = useCommercialStore((s) => s.marketPrices);
    const deals = useCommercialStore((s) => s.deals);

    // Generate real data-driven notifications
    const ALL_NOTIFICATIONS = React.useMemo(() => {
        const notifs: { id: number; category: string; type: string; message: string; time: string; targetRoles: string[] }[] = [];
        let nid = 1;
        const now = new Date();
        const today = now.toISOString().split("T")[0];
        const tomorrow = new Date(now.getTime() + 86400000).toISOString().split("T")[0];

        // 1. Task deadlines: overdue or due today
        tasks.forEach(t => {
            if (t.status === "done" || !t.due_date) return;
            const due = t.due_date.split("T")[0];
            if (due < today) {
                notifs.push({ id: nid++, category: "System", type: "warning", message: `[Overdue] Task "${t.title}" was due ${due}. Assigned to ${t.assignee_name || "unassigned"}.`, time: `Due ${due}`, targetRoles: ["ceo", "director", "operation", "marketing", "purchasing"] });
            } else if (due === today) {
                notifs.push({ id: nid++, category: "System", type: "action", message: `[Due Today] Task "${t.title}" is due today. Assigned to ${t.assignee_name || "unassigned"}.`, time: "Due today", targetRoles: ["ceo", "director", "operation", "marketing", "purchasing"] });
            } else if (due === tomorrow) {
                notifs.push({ id: nid++, category: "System", type: "info", message: `[Reminder] Task "${t.title}" is due tomorrow. Assigned to ${t.assignee_name || "unassigned"}.`, time: "Due tomorrow", targetRoles: ["ceo", "director", "operation", "marketing", "purchasing"] });
            }
        });

        // 2. Upcoming meetings within 48 hours
        meetings.filter(m => m.status === "scheduled").forEach(m => {
            const mDate = m.date?.split("T")[0];
            if (mDate === today) {
                notifs.push({ id: nid++, category: "System", type: "action", message: `[Meeting Today] "${m.title}" at ${m.time || "TBD"} — ${m.location || "TBD"}.`, time: `Today ${m.time}`, targetRoles: ["ceo", "director", "operation", "marketing", "purchasing"] });
            } else if (mDate === tomorrow) {
                notifs.push({ id: nid++, category: "System", type: "info", message: `[Meeting Tomorrow] "${m.title}" at ${m.time || "TBD"} — ${m.location || "TBD"}.`, time: `Tomorrow ${m.time}`, targetRoles: ["ceo", "director", "operation", "marketing", "purchasing"] });
            }
        });

        // 3. Active shipments status
        const activeShipments = shipments.filter(s => s.status !== "completed" && s.status !== "cancelled");
        activeShipments.forEach(s => {
            if (s.status === "loading") {
                notifs.push({ id: nid++, category: "Shipment", type: "info", message: `[Loading] ${s.shipment_number} — ${s.buyer} via ${s.vessel_name || "TBA"}. Qty: ${(s.quantity_loaded || 0).toLocaleString()} MT.`, time: s.loading_port || "", targetRoles: ["ceo", "director", "operation"] });
            } else if (s.status === "in_transit") {
                notifs.push({ id: nid++, category: "Shipment", type: "info", message: `[In Transit] ${s.shipment_number} — ${s.buyer} heading to ${s.discharge_port || "TBA"}. ETA: ${s.eta || "TBD"}.`, time: `ETA ${s.eta || "TBD"}`, targetRoles: ["ceo", "director", "operation"] });
            } else if (s.status === "waiting_loading") {
                notifs.push({ id: nid++, category: "Shipment", type: "action", message: `[Waiting] ${s.shipment_number} — ${s.buyer} waiting for loading at ${s.loading_port || "TBA"}.`, time: s.vessel_name || "", targetRoles: ["ceo", "director", "operation"] });
            }
        });

        // 4. Market price update
        if (marketPrices.length > 0) {
            const latest = marketPrices[0];
            notifs.push({ id: nid++, category: "Finance", type: "info", message: `[Market] Latest prices (${latest.date}): ICI 4: $${latest.ici_4} | Newcastle: $${latest.newcastle} | HBA: $${latest.hba}`, time: latest.date, targetRoles: ["ceo", "director", "marketing", "operation"] });
            if (marketPrices.length >= 2) {
                const prev = marketPrices[1];
                const iciChange = ((latest.ici_4 - prev.ici_4) / prev.ici_4 * 100).toFixed(1);
                const direction = Number(iciChange) >= 0 ? "up" : "down";
                notifs.push({ id: nid++, category: "Finance", type: Number(iciChange) >= 0 ? "info" : "warning", message: `[Market Trend] ICI 4 ${direction} ${iciChange}% from last week ($${prev.ici_4} → $${latest.ici_4}).`, time: `Weekly change`, targetRoles: ["ceo", "director", "marketing"] });
            }
        }

        // 5. Pending deals
        const pendingDeals = deals.filter(d => d.status === "forecast" as any || (d.status as string) === "pre_sale" || (d.status as string) === "pending");
        if (pendingDeals.length > 0) {
            notifs.push({ id: nid++, category: "Finance", type: "action", message: `[Deals] ${pendingDeals.length} deal(s) awaiting confirmation: ${pendingDeals.slice(0, 2).map(d => d.buyer).join(", ")}${pendingDeals.length > 2 ? " +more" : ""}.`, time: "Action needed", targetRoles: ["ceo", "director", "marketing"] });
        }

        // 6. Pending purchase approvals
        const pendingPurchases = purchases.filter(p => p.status === "pending");
        if (pendingPurchases.length > 0) {
            notifs.push({ id: nid++, category: "Finance", type: "action", message: `[Approval] ${pendingPurchases.length} purchase request(s) pending approval. Total: Rp${(pendingPurchases.reduce((s, p) => s + p.amount, 0) / 1000000).toFixed(0)}M.`, time: "Action needed", targetRoles: ["ceo", "director", "purchasing"] });
        }

        return notifs;
    }, [tasks, meetings, shipments, marketPrices, deals, purchases]);

    const visibleNotifications = ALL_NOTIFICATIONS.filter(n => currentUser && n.targetRoles.includes(currentUser.role) && (notifTab === "All" || n.category === notifTab));

    return (
        <header className="sticky top-0 z-40 h-14 bg-background border-b border-border flex items-center justify-between px-4 md:px-6">
            {/* Breadcrumb / Title */}
            <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold">{pageTitle}</span>
            </div>

            {/* Right section */}
            <div className="flex items-center gap-1.5">
                {/* Mobile Menu Toggle */}
                <button
                    onClick={toggleSidebar}
                    className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl hover:bg-accent transition-all duration-200 text-muted-foreground hover:text-foreground active:scale-95"
                >
                    <Menu className="w-5 h-5" />
                </button>

                {/* Search button */}
                <button
                    onClick={() => setSearchOpen(!searchOpen)}
                    className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-accent transition-all duration-200 text-muted-foreground hover:text-foreground active:scale-95"
                >
                    <Search className="w-4 h-4" />
                </button>

                {/* Notifications (High-Level Roles Only) */}
                {isHighLevel && (
                    <div className="relative">
                        <button
                            onClick={() => setNotificationOpen(!notificationOpen)}
                            className="relative flex items-center justify-center w-9 h-9 rounded-xl hover:bg-accent transition-all duration-200 text-muted-foreground hover:text-foreground active:scale-95"
                        >
                            <Bell className="w-4 h-4" />
                            <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                        </button>

                        {notificationOpen && (
                            <>
                                <div className="fixed inset-0 z-50" onClick={() => { setNotificationOpen(false); }} />
                                <div className="bg-card border border-border shadow-xl rounded-2xl z-50 animate-scale-in flex flex-col absolute right-0 top-full mt-2 w-80 max-w-[90vw] p-2">
                                    <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 mb-2 shrink-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-sm font-bold flex items-center gap-2"><BellRing className="w-4 h-4 text-primary" /> AI Insights & Alerts</h3>
                                            <span className="text-[10px] bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full font-bold">{visibleNotifications.length} New</span>
                                        </div>
                                    </div>
                                    <div className="flex px-2 gap-1 mb-2 shrink-0">
                                        {["All", "Finance", "Shipment", "System"].map(tab => (
                                            <button
                                                key={tab}
                                                onClick={() => setNotifTab(tab)}
                                                className={cn("px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors", notifTab === tab ? "bg-primary text-primary-foreground" : "bg-accent/50 text-muted-foreground hover:bg-accent")}
                                            >
                                                {tab}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="space-y-1.5 custom-scrollbar overflow-y-auto pr-1 max-h-80">
                                        {visibleNotifications.length === 0 && <div className="p-4 text-center text-xs text-muted-foreground">No notifications for this category.</div>}
                                        {visibleNotifications.map((n) => (
                                            <div key={n.id} className="p-3 rounded-xl bg-accent/30 hover:bg-accent border border-transparent hover:border-border/50 transition-all cursor-pointer group">
                                                <div className="flex items-start gap-3">
                                                    {n.type === "warning" && <div className="w-7 h-7 shrink-0 rounded-full bg-red-500/10 flex items-center justify-center mt-0.5"><AlertTriangle className="w-3.5 h-3.5 text-red-500" /></div>}
                                                    {n.type === "action" && <div className="w-7 h-7 shrink-0 rounded-full bg-orange-500/10 flex items-center justify-center mt-0.5"><AlertTriangle className="w-3.5 h-3.5 text-orange-500" /></div>}
                                                    {n.type === "info" && <div className="w-7 h-7 shrink-0 rounded-full bg-blue-500/10 flex items-center justify-center mt-0.5"><Info className="w-3.5 h-3.5 text-blue-500" /></div>}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-medium leading-snug text-foreground/90 group-hover:text-foreground">
                                                            <span className={cn("font-bold", n.message.startsWith("[Urgent]") ? "text-red-500" : n.message.startsWith("[Warning]") ? "text-orange-500" : "text-blue-500")}>
                                                                {n.message.match(/\\[.*?\\]/) ? n.message.match(/\\[.*?\\]/)?.[0] : ""}
                                                            </span>
                                                            {n.message.replace(/\\[.*?\\]/, "")}
                                                        </p>
                                                        <p className="text-[10px] text-muted-foreground mt-1.5 font-medium">{n.time} • {n.category}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}



                {/* Profile Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setRoleOpen(!roleOpen)}
                        className="flex items-center gap-2 py-1.5 px-2.5 rounded-xl hover:bg-accent transition-all duration-200 active:scale-[0.97]"
                    >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold text-primary-foreground shadow-sm bg-primary transition-transform duration-200">
                            {getInitials(currentUser?.name || "User")}
                        </div>
                        <div className="hidden sm:block text-left">
                            <p className="text-xs font-semibold leading-tight">{currentUser?.name || "Guest"}</p>
                            <p className="text-[10px] text-muted-foreground leading-tight">{roleConfig?.label || "Unknown Role"}</p>
                        </div>
                        <ChevronDown className={cn("w-3 h-3 text-muted-foreground hidden sm:block transition-transform duration-200", roleOpen && "rotate-180")} />
                    </button>

                    {roleOpen && (
                        <>
                            <div className="fixed inset-0 z-50" onClick={() => setRoleOpen(false)} />
                            <div className="absolute right-0 top-full mt-2 w-48 bg-card border border-border shadow-lg rounded-xl z-50 py-1.5 animate-scale-in">
                                <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Account</p>

                                <button
                                    onClick={() => { setRoleOpen(false); /* Add profile route later if needed */ }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-accent/80 transition-all duration-200 text-foreground"
                                >
                                    <span className="font-semibold text-xs ml-1">My Profile</span>
                                </button>

                                <div className="h-px bg-border my-1" />

                                <button
                                    onClick={() => { signOut(); setRoleOpen(false); }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-red-500/10 hover:text-red-500 transition-all duration-200 text-muted-foreground"
                                >
                                    <span className="font-semibold text-xs ml-1">Sign Out</span>
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Search overlay */}
            {searchOpen && (
                <>
                    <div className="fixed inset-0 bg-black/20 z-[60] animate-backdrop-in" onClick={() => { setSearchOpen(false); setSearchQuery(""); }} />
                    <div className="fixed top-3 left-1/2 -translate-x-1/2 w-[90%] max-w-lg bg-card border border-border rounded-xl shadow-lg z-[60] animate-fade-in-down">
                        <div className="flex items-center gap-3 px-4 h-12 border-b border-border/50">
                            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                            <input
                                autoFocus
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search tasks, orders, requests..."
                                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                            />
                            <kbd className="hidden sm:inline-flex px-1.5 py-0.5 rounded bg-accent text-[10px] text-muted-foreground font-mono">ESC</kbd>
                            <button onClick={() => { setSearchOpen(false); setSearchQuery(""); }}>
                                <X className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
                            </button>
                        </div>

                        {searchResults.length > 0 && (
                            <div className="max-h-64 overflow-y-auto py-2">
                                {searchResults.map((r, i) => (
                                    <a
                                        key={i}
                                        href={r.href}
                                        onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                                        className={cn("flex items-center gap-3 px-4 py-2.5 hover:bg-accent/80 transition-all duration-200 animate-fade-in", `delay-${i + 1}`)}
                                    >
                                        <span className="text-[10px] font-semibold text-muted-foreground uppercase w-14 shrink-0">{r.type}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{r.title}</p>
                                            <p className="text-xs text-muted-foreground truncate">{r.sub}</p>
                                        </div>
                                    </a>
                                ))}
                            </div>
                        )}
                        {searchQuery && searchResults.length === 0 && (
                            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No results found</p>
                        )}
                    </div>
                </>
            )}
        </header>
    );
}
