"use client";

import React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useAuthStore } from "@/store/auth-store";
import { useTaskStore } from "@/store/task-store";
import { useSalesStore } from "@/store/sales-store";
import { usePurchaseStore } from "@/store/purchase-store";
import { useCommercialStore } from "@/store/commercial-store";
import { formatRupiah, cn } from "@/lib/utils";
import { TASK_STATUSES, TASK_PRIORITIES, SALES_DEAL_STATUSES, SHIPMENT_STATUSES } from "@/lib/constants";
import {
    TrendingUp, TrendingDown, DollarSign, AlertCircle, Ship,
    Anchor, Package, BarChart3, Calendar, Clock, ArrowUpRight,
    Lock, Filter, ChevronDown, Layers,
} from "lucide-react";

const safeNum = (v: number | null | undefined): number => (v != null && !isNaN(v) ? v : 0);
const safeFmt = (v: number | null | undefined, decimals = 2): string => safeNum(v).toFixed(decimals);
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "next-auth/react";
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
    ComposedChart, Line, LineChart,
} from "recharts";

/* ─── Filters ─────────────────────────────────────────────── */
type FilterRange = "30d" | "90d" | "ytd" | "all" | "custom";
const FILTER_OPTIONS: { value: FilterRange; label: string }[] = [
    { value: "30d", label: "Last 30 Days" },
    { value: "90d", label: "Last 90 Days" },
    { value: "ytd", label: "Year to Date" },
    { value: "all", label: "All Time" },
    { value: "custom", label: "Custom Range" },
];

function DashboardFilters({ range, setRange, customFrom, customTo, setCustomFrom, setCustomTo, region, setRegion, marketType, setMarketType, status, setStatus, country, setCountry, search, setSearch }: {
    range: FilterRange; setRange: (r: FilterRange) => void;
    customFrom: string; customTo: string; setCustomFrom: (d: string) => void; setCustomTo: (d: string) => void;
    region: string; setRegion: (r: string) => void;
    marketType: string; setMarketType: (m: string) => void;
    status: string; setStatus: (s: string) => void;
    country: string; setCountry: (c: string) => void;
    search: string; setSearch: (q: string) => void;
}) {
    return (
        <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
                <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
                    className="pl-7 pr-3 py-1.5 rounded-lg bg-accent/50 border border-border text-xs outline-none focus:border-primary/50 text-muted-foreground w-36" />
                <svg className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            </div>
            <select value={status} onChange={e => setStatus(e.target.value)} className="px-3 py-1.5 rounded-lg bg-accent/50 border border-border text-xs outline-none focus:border-primary/50 text-muted-foreground">
                <option value="all">All Status</option>
                <option value="pre_sale">Pre-sale</option>
                <option value="confirmed">Confirmed</option>
                <option value="in_transit">On Going / In Transit</option>
                <option value="completed">Completed</option>
            </select>
            <select value={marketType} onChange={e => setMarketType(e.target.value)} className="px-3 py-1.5 rounded-lg bg-accent/50 border border-border text-xs outline-none focus:border-primary/50 text-muted-foreground">
                <option value="all">All Types</option>
                <option value="local">Local</option>
                <option value="export">Export</option>
            </select>
            <select value={country} onChange={e => setCountry(e.target.value)} className="px-3 py-1.5 rounded-lg bg-accent/50 border border-border text-xs outline-none focus:border-primary/50 text-muted-foreground">
                <option value="all">All Countries</option>
                <option value="Indonesia">Indonesia</option>
                <option value="South Korea">South Korea</option>
                <option value="India">India</option>
                <option value="Cambodia">Cambodia</option>
                <option value="Philippines">Philippines</option>
                <option value="China">China</option>
                <option value="Japan">Japan</option>
                <option value="Thailand">Thailand</option>
                <option value="Vietnam">Vietnam</option>
            </select>
            <select value={region} onChange={e => setRegion(e.target.value)} className="px-3 py-1.5 rounded-lg bg-accent/50 border border-border text-xs outline-none focus:border-primary/50 text-muted-foreground">
                <option value="all">All Regions</option>
                <option value="Kalimantan Timur">Kalimantan Timur</option>
                <option value="Kalimantan Selatan">Kalimantan Selatan</option>
                <option value="Sumatera Selatan">Sumatera Selatan</option>
            </select>

            {FILTER_OPTIONS.map((f) => (
                <button key={f.value} onClick={() => setRange(f.value)}
                    className={cn("filter-chip", range === f.value ? "filter-chip-active" : "filter-chip-inactive")}>
                    {f.label}
                </button>
            ))}
            {range === "custom" && (
                <div className="flex items-center gap-1.5">
                    <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                        className="px-2 py-1 rounded-lg bg-accent/50 border border-border text-[11px] outline-none focus:border-primary/50" />
                    <span className="text-[10px] text-muted-foreground">to</span>
                    <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                        className="px-2 py-1 rounded-lg bg-accent/50 border border-border text-[11px] outline-none focus:border-primary/50" />
                </div>
            )}
        </div>
    );
}

/* ─── Metric Card ─────────────────────────────────────────── */
function MetricCard({ label, value, sub, icon: Icon, color, delay, restricted, hasAccess }: {
    label: string; value: string | number; sub?: string;
    icon: React.ElementType; color?: string; delay: number;
    restricted?: boolean; hasAccess?: boolean;
}) {
    if (restricted && !hasAccess) return null;
    return (
        <div className={cn("card-elevated p-5 space-y-3 animate-slide-up", `delay-${delay}`)}>
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", color || "bg-primary/10")}>
                    <Icon className={cn("w-4 h-4",
                        color?.includes("emerald") ? "text-emerald-500" :
                            color?.includes("red") ? "text-red-500" :
                                color?.includes("amber") ? "text-amber-500" :
                                    color?.includes("blue") ? "text-blue-500" :
                                        color?.includes("violet") ? "text-violet-500" : "text-primary"
                    )} />
                </div>
            </div>
            <div>
                <p className="text-2xl font-bold tracking-tight">{value}</p>
                {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

/* ─── Small Stat Card ─────────────────────────────────────── */
function SmallStat({ label, value, color }: { label: string; value: string | number; color: string }) {
    return (
        <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-accent/40">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className={cn("text-sm font-bold", color)}>{value}</span>
        </div>
    );
}

/* ─── Market Price Mini Chart ─────────────────────────────── */
function MarketPriceMini() {
    const prices = useCommercialStore((s) => s.marketPrices);
    const [mounted, setMounted] = React.useState(false);
    const [weeks, setWeeks] = React.useState(4);

    React.useEffect(() => setMounted(true), []);

    // Filter to last N weeks (7 days/week)
    // Assume prices is descending (newest first)
    const filteredPrices = [...prices].slice(0, weeks * 7).reverse();

    const data = filteredPrices.map((p) => ({
        week: new Date(p.date).toLocaleDateString("en", { month: "short", day: "numeric" }),
        ICI4: p.ici_4, Newc: p.newcastle, HBA: p.hba,
    }));

    return (
        <div className="card-elevated p-5 animate-slide-up delay-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold whitespace-nowrap">Market Price</h3>
                    <select
                        value={weeks}
                        onChange={(e) => setWeeks(Number(e.target.value))}
                        className="px-2 py-0.5 rounded-md bg-accent/50 border border-border text-[10px] outline-none focus:border-primary/50 text-muted-foreground w-auto cursor-pointer"
                    >
                        <option value={1}>1 Week</option>
                        <option value={2}>2 Weeks</option>
                        <option value={3}>3 Weeks</option>
                        <option value={4}>4 Weeks</option>
                        <option value={8}>8 Weeks</option>
                    </select>
                </div>
                <a href="/market-price" className="text-xs text-primary hover:underline flex items-center gap-1 group whitespace-nowrap">
                    Detail <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </a>
            </div>
            <div className="h-[220px]">
                {mounted && (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.1)" />
                            <XAxis dataKey="week" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }} />
                            <Legend wrapperStyle={{ fontSize: '11px' }} />
                            <Line type="monotone" dataKey="ICI4" name="ICI 4 (4200)" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                            <Line type="monotone" dataKey="Newc" name="Newcastle" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                            <Line type="monotone" dataKey="HBA" name="HBA" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
}

/* ─── Upcoming Meetings ───────────────────────────────────── */
function UpcomingMeetings() {
    const meetings = useCommercialStore((s) => s.meetings);
    const todayStr = new Date().toISOString().split("T")[0];
    const upcoming = meetings
        .filter((m: any) => {
            const datePart = m.date.includes("T") ? m.date.split("T")[0] : m.date;
            return m.status === "scheduled" && datePart >= todayStr;
        })
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 3);

    return (
        <div className="card-elevated p-5 animate-slide-up delay-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">Upcoming Meetings</h3>
                <a href="/meetings" className="text-xs text-primary hover:underline flex items-center gap-1 group">
                    View All <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </a>
            </div>
            <div className="space-y-2">
                {upcoming.map((m) => {
                    const handleGoogleCalendar = (e: React.MouseEvent) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const datePart = m.date.includes("T") ? m.date.split("T")[0] : m.date;
                        const start = new Date(`${datePart}T${m.time}`);
                        if (isNaN(start.getTime())) return;
                        const end = new Date(start.getTime() + 60 * 60 * 1000);
                        const fmt = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
                        const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(m.title)}&dates=${fmt(start)}/${fmt(end)}&details=${encodeURIComponent("Attendees: " + m.attendees.join(", "))}&location=${encodeURIComponent(m.location || "")}`;
                        window.open(url, '_blank');
                    };

                    return (
                        <div key={m.id} className="flex flex-col gap-2 p-3 rounded-xl bg-accent/30 hover:bg-accent/50 transition-colors group cursor-default">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                                    <Calendar className="w-4 h-4 text-blue-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold truncate">{m.title}</p>
                                    <p className="text-[10px] text-muted-foreground">{new Date(m.date).toLocaleDateString("id-ID", { weekday: "short", day: "2-digit", month: "short" })} · {m.time} · {m.attendees.length} peserta</p>
                                </div>
                            </div>
                            <button onClick={handleGoogleCalendar} className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-blue-600/10 text-blue-600 text-[10px] font-bold uppercase transition-all hover:bg-blue-600 hover:text-white mt-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:h-0 md:py-0 md:mt-0 md:group-hover:h-auto md:group-hover:py-1.5 md:group-hover:mt-1 overflow-hidden">
                                <Calendar className="w-3 h-3" /> Add to Calendar
                            </button>
                        </div>
                    );
                })}
                {upcoming.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Tidak ada meeting mendatang</p>}
            </div>
        </div>
    );
}

/* ─── Shipment Timeline ───────────────────────────────────── */
function ShipmentTimeline({ shipmentItems, label }: { shipmentItems: any[]; label: string }) {
    return (
        <div className="card-elevated p-5 animate-slide-up">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">{label}</h3>
                <span className="text-[10px] text-muted-foreground bg-accent/50 px-2 py-0.5 rounded-full">{shipmentItems.length} shipments</span>
            </div>
            <div className="space-y-2">
                {shipmentItems.slice(0, 4).map((sh) => {
                    const statusCfg = SHIPMENT_STATUSES.find((s) => s.value === sh.status);
                    return (
                        <div key={sh.id} className="flex items-center gap-3 p-3 rounded-xl bg-accent/30 hover:bg-accent/50 transition-colors">
                            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${statusCfg?.color}15` }}>
                                <Ship className="w-4 h-4" style={{ color: statusCfg?.color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold truncate">{sh.buyer}</p>
                                <p className="text-[10px] text-muted-foreground">{sh.vessel_name || sh.barge_name} · {sh.loading_port}</p>
                            </div>
                            <div className="text-right shrink-0">
                                <span className="status-badge text-[10px]" style={{ color: statusCfg?.color, backgroundColor: `${statusCfg?.color}15` }}>
                                    {statusCfg?.label}
                                </span>
                                {sh.pending_items && sh.pending_items.length > 0 && (
                                    <div className="mt-0.5">
                                        {sh.pending_items.slice(0, 2).map((item: string, j: number) => (
                                            <p key={j} className="text-[9px] text-amber-500">Alert: {item}</p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
                {shipmentItems.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Tidak ada shipment</p>}
            </div>
        </div>
    );
}

/* ─── Quantity per Month Chart ────────────────────────────── */
function QuantityPerMonth({ shipments }: { shipments: any[] }) {
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const data = months.map((m, i) => {
        const monthItems = shipments.filter((sh) => {
            const dateStr = sh.bl_date || sh.created_at || sh.updated_at;
            if (!dateStr) return false;
            try {
                const d = new Date(dateStr);
                return d.getMonth() === i;
            } catch (e) {
                return false;
            }
        });

        const domestic = monthItems
            .filter((sh) => (sh.type as string) === "local")
            .reduce((s, sh) => s + (Number(sh.quantity_loaded) || Number(sh.qty_plan) || 0), 0);
        const exportVol = monthItems
            .filter((sh) => (sh.type as string) === "export")
            .reduce((s, sh) => s + (Number(sh.quantity_loaded) || Number(sh.qty_plan) || 0), 0);

        return {
            month: m,
            local: Math.round(domestic),
            export: Math.round(exportVol),
        };
    });

    const totalQty = shipments.reduce((s, sh) => s + (Number(sh.quantity_loaded) || Number(sh.qty_plan) || 0), 0);

    return (
        <div className="card-elevated p-5 animate-slide-up delay-2">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-sm font-semibold">Quantity per Month (MT)</h3>
                    <p className="text-[10px] text-muted-foreground">Total: {Math.round(totalQty / 1000)}K MT</p>
                </div>
                <a href="/sales-monitor" className="text-xs text-primary hover:underline flex items-center gap-1 group">
                    Detail <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </a>
            </div>
            <div className="h-[220px]">
                {mounted && (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.1)" />
                            <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${safeFmt(v / 1000, 0)}K`} />
                            <Tooltip 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }} 
                                formatter={(v: any) => [`${safeFmt(Number(v) / 1000, 0)}K MT`]}
                            />
                            <Legend wrapperStyle={{ fontSize: '11px' }} />
                            <Bar dataKey="local" name="Local (Domestic)" fill="#3b82f6" stackId="qty" radius={[0, 0, 0, 0]} />
                            <Bar dataKey="export" name="Export" fill="#10b981" stackId="qty" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
}


/* ─── Priority Tasks ──────────────────────────────────────── */
function PriorityTasks() {
    const tasks = useTaskStore((s) => s.tasks);
    const activeTasks = tasks.filter((t) => t.status !== "done").sort((a, b) => {
        const order = { urgent: 0, high: 1, medium: 2, low: 3 };
        return (order[a.priority] || 3) - (order[b.priority] || 3);
    }).slice(0, 6);

    return (
        <div className="card-elevated p-5 animate-slide-up delay-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">Priority Tasks</h3>
                <a href="/all-tasks" className="text-xs text-primary hover:underline flex items-center gap-1 group">
                    View All <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </a>
            </div>
            <div className="space-y-1">
                {activeTasks.map((t) => {
                    const priCfg = TASK_PRIORITIES.find((p) => p.value === t.priority);
                    const stCfg = TASK_STATUSES.find((s) => s.value === t.status);
                    return (
                        <div key={t.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-accent/30 transition-colors">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: priCfg?.color }} />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{t.title}</p>
                                <p className="text-[10px] text-muted-foreground">{t.assignee_name}</p>
                            </div>
                            <span className="status-badge text-[9px]" style={{ color: stCfg?.color, backgroundColor: `${stCfg?.color}15` }}>
                                {stCfg?.label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* ─── Stock Inventory Widget ──────────────────────────────── */
function StockInventory({ sources }: { sources: any[] }) {
    const totalStock = sources.reduce((s, src) => s + src.stock_available, 0);

    return (
        <div className="card-elevated p-5 animate-slide-up delay-2">
            <h3 className="text-sm font-semibold mb-3">Stock Inventory</h3>
            <p className="text-2xl font-bold tracking-tight mb-3">{safeFmt(totalStock / 1000, 0)}K MT</p>
            <div className="space-y-1.5">
                {sources.slice(0, 4).map((src) => (
                    <div key={src.id} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground truncate max-w-[60%]">{src.name}</span>
                        <span className="font-semibold">{safeFmt(src.stock_available / 1000, 0)}K MT</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════ */
/* SKELETON LOADERS                                           */
/* ═══════════════════════════════════════════════════════════ */
function MetricCardSkeleton() {
    return (
        <div className="card-elevated p-5 space-y-3">
            <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="w-9 h-9 rounded-xl" />
            </div>
            <div>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
            </div>
        </div>
    );
}

function ChartSkeleton({ short }: { short?: boolean }) {
    return (
        <div className="card-elevated p-5 space-y-4">
            <div className="flex justify-between">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-12 hidden md:block" />
            </div>
            <Skeleton className={cn("w-full", short ? "h-[100px]" : "h-[220px]")} />
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════ */
/* MAIN DASHBOARD                                             */
/* ═══════════════════════════════════════════════════════════ */
export default function DashboardPage() {
    const { data: session } = useSession();
    const currentUser = session?.user as any;
    const syncTasks = useTaskStore((s) => s.syncFromMemory);
    const syncSales = useSalesStore((s) => s.syncFromMemory);
    const syncPurchases = usePurchaseStore((s) => s.syncFromMemory);
    const syncCommercial = useCommercialStore((s) => s.syncFromMemory);
    const deals = useCommercialStore((s) => s.deals);
    const shipments = useCommercialStore((s) => s.shipments);
    const tasks = useTaskStore((s) => s.tasks);
    const salesOrders = useSalesStore((s) => s.orders);
    const purchaseRequests = usePurchaseStore((s) => s.purchases);
    const [timeRange, setTimeRange] = React.useState<FilterRange>("all");
    const [customFrom, setCustomFrom] = React.useState("");
    const [customTo, setCustomTo] = React.useState("");
    const [region, setRegion] = React.useState("all");
    const [marketType, setMarketType] = React.useState("all");
    const [status, setStatus] = React.useState("all");
    const [country, setCountry] = React.useState("all");
    const [search, setSearch] = React.useState("");
    const role = currentUser?.role?.toLowerCase();
    const isCeo = role === "ceo";
    const sources = useCommercialStore((s) => s.sources);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        let cancelled = false;
        const timeoutWrap = (p: Promise<unknown>, ms = 15000) =>
            Promise.race([
                p,
                new Promise((_, reject) => setTimeout(() => reject(new Error("sync-timeout")), ms)),
            ]);

        const runInitialSync = async () => {
            const startedAt = Date.now();
            await Promise.allSettled([
                timeoutWrap(syncTasks()),
                timeoutWrap(syncSales()),
                timeoutWrap(syncPurchases()),
                timeoutWrap(syncCommercial()),
            ]);

            // Keep a tiny minimum skeleton to avoid jarring flash.
            const minSkeletonMs = 450;
            const elapsed = Date.now() - startedAt;
            if (elapsed < minSkeletonMs) {
                await new Promise((resolve) => setTimeout(resolve, minSkeletonMs - elapsed));
            }

            if (!cancelled) setIsLoading(false);
        };

        runInitialSync().catch(() => {
            if (!cancelled) setIsLoading(false);
        });

        return () => {
            cancelled = true;
        };
    }, [syncTasks, syncSales, syncPurchases, syncCommercial]);

    // Master Filter logic
    const filterData = <T extends { created_at?: string; type?: string; region?: string; status?: string; buyer_country?: string; buyer?: string; vessel_name?: string; shipment_number?: string }>(data: T[]): T[] => {
        const now = new Date();
        const q = search.toLowerCase();
        return data.filter(item => {
            // Market Type
            if (marketType !== "all" && item.type && item.type !== marketType) return false;
            // Region
            if (region !== "all" && item.region && item.region !== region) return false;
            // Status
            if (status !== "all" && item.status && item.status !== status) return false;
            // Country
            if (country !== "all" && item.buyer_country && item.buyer_country !== country) return false;
            // Search
            if (q && ![
                (item as any).buyer, (item as any).vessel_name, (item as any).shipment_number,
                (item as any).supplier, (item as any).name, (item as any).title
            ].filter(Boolean).some((v: string) => v.toLowerCase().includes(q))) return false;

            // Date Range
            const currentRange = timeRange as string;
            if (currentRange === "all") return true; 
            
            if (item.created_at) {
                const itemDate = new Date(item.created_at);
                if (currentRange === "30d") {
                    const diffTime = now.getTime() - itemDate.getTime();
                    if (diffTime / (1000 * 3600 * 24) > 30) return false;
                } else if (currentRange === "90d") {
                    const diffTime = now.getTime() - itemDate.getTime();
                    if (diffTime / (1000 * 3600 * 24) > 90) return false;
                } else if (currentRange === "ytd") {
                    if (itemDate.getFullYear() !== now.getFullYear()) return false;
                } else if (currentRange === "custom") {
                    if (customFrom && new Date(customFrom) > itemDate) return false;
                    if (customTo && new Date(customTo) < itemDate) return false;
                }
            } else {
                // If range is specific but no date, hide it
                return false;
            }
            return true;
        });
    };

    const filteredDeals = filterData(deals);
    const filteredShipments = filterData(shipments);
    const filteredSources = filterData(sources);

    // Financial calculations: Combined from Confirmed/Contracted/Executed Deals + Active Shipments
    // We include all "successful" deal statuses for revenue visibility
    const confirmedDeals = filteredDeals.filter(d =>
        (d.status as string) === "confirmed" ||
        (d.status as string) === "contracted" ||
        (d.status as string).toLowerCase() === "executed"
    );
    const activeShipments = filteredShipments.filter(s => s.status !== "cancelled" && s.status !== "draft");

    // Shipments are used for operational tracking and volume reporting
    const totalQty = filteredShipments.reduce((s, sh) => s + safeNum(sh.quantity_loaded), 0);
    const localQty = filteredShipments.filter(s => s.type === "local").reduce((s, sh) => s + safeNum(sh.quantity_loaded), 0);
    const exportQty = totalQty - localQty;

    const totalRevenue = confirmedDeals.reduce((s, d) => s + (safeNum(d.quantity) * safeNum(d.price_per_mt)), 0);
    const localRevenue = confirmedDeals.filter(d => d.type === "local").reduce((s, d) => s + (safeNum(d.quantity) * safeNum(d.price_per_mt)), 0);
    const exportRevenue = totalRevenue - localRevenue;

    const totalGrossProfit = confirmedDeals.reduce((s, d) => {
        const qty = safeNum(d.quantity);
        const sp = safeNum(d.price_per_mt);
        const estimatedMargin = 2.42; 
        return s + (qty * (sp > 0 ? (sp * 0.05) : estimatedMargin));
    }, 0);

    const localGP = localQty > 0
        ? confirmedDeals.filter((d) => d.type === "local").reduce((s, d) => s + (safeNum(d.price_per_mt) - 45), 0) / (confirmedDeals.filter((d) => d.type === "local").length || 1)
        : 0;
    const exportGP = exportQty > 0
        ? confirmedDeals.filter((d) => d.type !== "local").reduce((s, d) => s + (safeNum(d.price_per_mt) - 45), 0) / (confirmedDeals.filter((d) => d.type !== "local").length || 1)
        : 0;

    const avgGrossProfit = totalQty > 0 ? totalGrossProfit / totalQty : 0;

    // Deal counts — handles deals from store or falls back to shipment-based count
    // Deal counts
    const confirmedCount = confirmedDeals.length;
    const preSaleCount = filteredDeals.filter((d) => (d.status as string) === "pre_sale" || d.status === "forecast").length;
    const forecastCount = filteredDeals.filter((d) => d.status === "forecast").length;

    // Active / Ongoing shipments from filtered
    const activeShipmentsList = filteredShipments.filter((sh) => sh.status !== "completed" && sh.status !== "cancelled");
    const onGoingShipments = activeShipmentsList.filter((sh) => sh.status === "loading" || sh.status === "in_transit" || sh.status === "anchorage" || sh.status === "discharging");
    const now30 = new Date(); now30.setDate(now30.getDate() + 30);
    const now60 = new Date(); now60.setDate(now60.getDate() + 60);
    const upcoming30 = activeShipmentsList.filter((sh) => {
        if (sh.status !== "waiting_loading" && sh.status !== "draft") return false;
        if (!sh.eta) return sh.status === "waiting_loading";
        const eta = new Date(sh.eta);
        return eta <= now30;
    });
    const upcoming60 = activeShipmentsList.filter((sh) => {
        if (sh.status !== "waiting_loading" && sh.status !== "draft") return false;
        if (!sh.eta) return true;
        const eta = new Date(sh.eta);
        return eta > now30 && eta <= now60;
    });
    const pendingTasks = tasks.filter((t) => t.status === "review").length;

    const formatUSD = (v: number) => {
        if (Math.abs(v) >= 1000000) return `$${(v / 1000000).toFixed(2)}M`;
        if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(2)}K`;
        return `$${v.toFixed(2)}`;
    };

    if (!isCeo && role !== "director") {
        return (
            <AppShell>
                <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)] p-6 text-center space-y-4 animate-fade-in">
                    <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                        <Lock className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold">Access Denied</h2>
                    <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                        This dashboard contains sensitive financial data. Only CEO and Assistant CEO roles can access this overview.
                    </p>
                    <div className="pt-4 flex gap-3">
                        <a href="/my-tasks" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                            Go to My Tasks
                        </a>
                        <a href="/sales-monitor" className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors">
                            Sales Monitor
                        </a>
                    </div>
                </div>
            </AppShell>
        );
    }

    return (
        <AppShell>
            <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6">
                {isLoading ? (
                    <>
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <Skeleton className="h-8 w-48 mb-2" />
                                <Skeleton className="h-4 w-64" />
                            </div>
                            <div className="flex gap-2 w-full md:w-auto flex-wrap">
                                <Skeleton className="h-8 w-36" />
                                <Skeleton className="h-8 w-24" />
                                <Skeleton className="h-8 w-24" />
                                <Skeleton className="h-8 w-24" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                            {isCeo && <MetricCardSkeleton />}
                            {isCeo && <MetricCardSkeleton />}
                            <MetricCardSkeleton />
                            <MetricCardSkeleton />
                            <MetricCardSkeleton />
                        </div>

                        {isCeo && (
                            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                                {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                            </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <ChartSkeleton />
                            <ChartSkeleton />
                        </div>
                    </>
                ) : (
                    <>
                        {/* Header & Filters */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fade-in">
                            <div>
                                <h1 className="text-xl md:text-2xl font-bold">Dashboard</h1>
                                <p className="text-sm text-muted-foreground">Commercial Team Overview · {currentUser?.job_title || currentUser?.role || "Guest"}</p>
                            </div>
                            <DashboardFilters
                                range={timeRange} setRange={setTimeRange}
                                customFrom={customFrom} customTo={customTo}
                                setCustomFrom={setCustomFrom} setCustomTo={setCustomTo}
                                region={region} setRegion={setRegion}
                                marketType={marketType} setMarketType={setMarketType}
                                status={status} setStatus={setStatus}
                                country={country} setCountry={setCountry}
                                search={search} setSearch={setSearch}
                            />
                        </div>

                        {/* Top Metrics - Row 1 */}
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                            {isCeo && <MetricCard label="Total Revenue (USD)" value={formatUSD(totalRevenue)} sub="YTD Confirmed" icon={DollarSign} color="bg-emerald-500/10" delay={1} restricted hasAccess={isCeo} />}
                            {isCeo && <MetricCard label="Gross Profit (USD)" value={formatUSD(totalGrossProfit)} sub={`$${safeFmt(avgGrossProfit)}/MT avg`} icon={TrendingUp} color="bg-violet-500/10" delay={2} restricted hasAccess={isCeo} />}
                            <MetricCard label="Total Volume" value={`${safeFmt(totalQty / 1000, 0)}K MT`} sub={`${safeFmt(localQty / 1000, 0)}K Local · ${safeFmt(exportQty / 1000, 0)}K Export`} icon={Layers} color="bg-cyan-500/10" delay={3} />
                            <MetricCard label="Active Deals" value={preSaleCount + confirmedCount + forecastCount} sub={`${confirmedCount} confirmed`} icon={BarChart3} color="bg-blue-500/10" delay={isCeo ? 4 : 1} />
                            <MetricCard label="Active Shipments" value={activeShipmentsList.length} sub={`${pendingTasks} tasks pending`} icon={Ship} color="bg-amber-500/10" delay={isCeo ? 5 : 2} />
                        </div>

                        {/* CEO-Only Revenue Split */}
                        {isCeo && (
                            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                                <SmallStat label="Revenue Local" value={formatUSD(localRevenue)} color="text-blue-500" />
                                <SmallStat label="Revenue Export" value={formatUSD(exportRevenue)} color="text-violet-500" />
                                <SmallStat label="GP Total" value={formatUSD(totalGrossProfit)} color="text-emerald-500" />
                                <SmallStat label="GP Local/MT" value={`$${safeFmt(localGP)}`} color="text-emerald-500" />
                                <SmallStat label="GP Export/MT" value={`$${safeFmt(exportGP)}`} color="text-emerald-500" />
                                <SmallStat label="GP Total/MT" value={`$${safeFmt(avgGrossProfit)}`} color="text-emerald-600" />
                            </div>
                        )}

                        {/* Row 2: Market Price + Meetings */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <MarketPriceMini />
                            <UpcomingMeetings />
                        </div>

                        {/* Row 3: Quantity per Month */}
                        <div className="grid grid-cols-1 gap-4">
                            <QuantityPerMonth shipments={filteredShipments} />
                        </div>

                        {/* Row 4: Stock Inventory */}
                        <StockInventory sources={filteredSources} />

                        {/* Row 5: Shipment Timelines (3 sections) */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <ShipmentTimeline shipmentItems={onGoingShipments} label="On-going Shipments" />
                            <ShipmentTimeline shipmentItems={upcoming30} label="Upcoming (30 Days)" />
                            <ShipmentTimeline shipmentItems={upcoming60} label="Upcoming (60 Days)" />
                        </div>

                        {/* Row 6: Priority Tasks */}
                        <PriorityTasks />
                    </>)}
            </div>
        </AppShell>
    );
}
