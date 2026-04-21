"use client";

import React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { DISABLE_SKELETON_LOADERS } from "@/lib/feature-flags";
import { useAuthStore } from "@/store/auth-store";
import { useTaskStore } from "@/store/task-store";
import { useCommercialStore } from "@/store/commercial-store";
import { formatRupiah, cn } from "@/lib/utils";
import { TASK_STATUSES, TASK_PRIORITIES, SALES_DEAL_STATUSES, SHIPMENT_STATUSES } from "@/lib/constants";
import {
    TrendingUp, TrendingDown, DollarSign, AlertCircle, Ship,
    Anchor, Package, BarChart3, Calendar, Clock, ArrowUpRight,
    Lock, Filter, ChevronDown, ChevronUp, Layers, ScrollText,
} from "lucide-react";

const safeNum = (v: number | null | undefined): number => (v != null && !isNaN(v) ? v : 0);
const safeFmt = (v: number | null | undefined, decimals = 2): string => safeNum(v).toFixed(decimals);
const CURRENT_YEAR = new Date().getFullYear();

const MONTH_INDEX: Record<string, number> = {
    JAN: 0,
    FEB: 1,
    MAR: 2,
    APR: 3,
    MAY: 4,
    MEI: 4,
    JUN: 5,
    JUL: 6,
    AUG: 7,
    AGU: 7,
    SEP: 8,
    SEPT: 8,
    OCT: 9,
    OKT: 9,
    NOV: 10,
    DEC: 11,
    DES: 11,
};

const normalizeStatus = (value?: string): string => (value || "").toLowerCase().trim().replace(/\s+/g, "_");
const normalizeKey = (value?: string): string => (value || "").trim().toUpperCase().replace(/\s+/g, " ");

const asDate = (value: unknown): Date | null => {
    if (!value) return null;
    const d = new Date(String(value));
    return Number.isNaN(d.getTime()) ? null : d;
};

function parseLaycanStart(value?: string, yearHint?: number): Date | null {
    if (!value) return null;
    const raw = String(value).toUpperCase().replace(/\./g, " ").replace(/\s+/g, " ").trim();

    const patternA = raw.match(/(\d{1,2})\s*([A-Z]{3,9})\s*(?:-|TO|\/)\s*(\d{1,2})\s*([A-Z]{3,9})/);
    if (patternA) {
        const day = Number(patternA[1]);
        const month = MONTH_INDEX[patternA[2]];
        if (month !== undefined) return new Date(yearHint || CURRENT_YEAR, month, day);
    }

    const patternB = raw.match(/(\d{1,2})\s*(?:-|TO|\/)\s*(\d{1,2})\s*([A-Z]{3,9})/);
    if (patternB) {
        const day = Number(patternB[1]);
        const month = MONTH_INDEX[patternB[3]];
        if (month !== undefined) return new Date(yearHint || CURRENT_YEAR, month, day);
    }

    const patternC = raw.match(/(\d{1,2})\s*([A-Z]{3,9})/);
    if (patternC) {
        const day = Number(patternC[1]);
        const month = MONTH_INDEX[patternC[2]];
        if (month !== undefined) return new Date(yearHint || CURRENT_YEAR, month, day);
    }

    return null;
}

function getShipmentEtaDate(sh: any): Date | null {
    const yearHint = Number(sh.year) || CURRENT_YEAR;
    return (
        asDate(sh.eta) ||
        asDate(sh.laycan_start) ||
        asDate(sh.laycan_end) ||
        asDate(sh.laycanStart) ||
        asDate(sh.laycanEnd) ||
        parseLaycanStart(sh.laycan, yearHint)
    );
}

function formatLaycanWithYear(sh: any): string {
    const laycan = cleanText(sh.laycan);
    if (laycan && /\b(19|20)\d{2}\b/.test(laycan)) return laycan;

    const date = getShipmentEtaDate(sh) || asDate(sh.bl_date);
    const year = date?.getFullYear() || Number(sh.year) || null;

    if (laycan && year) return `${laycan} ${year}`;
    if (laycan) return laycan;
    if (!date) return "-";

    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatLaycanCompact(sh: any): string {
    const full = cleanText(formatLaycanWithYear(sh));
    if (!full || full === "-") return "-";

    const segments = full
        .replace(/\s+i\s*[\.\/]?\s*o\s*\.?\s+/gi, "|")
        .split("|")
        .map((x) => x.trim())
        .filter(Boolean);

    if (segments.length <= 1) return segments[0] || full;
    return `${segments[0]} (+${segments.length - 1})`;
}

function inferShipmentType(sh: any): "local" | "export" {
    const explicit = String(sh.type || "").toLowerCase();
    if (explicit.includes("local") || explicit.includes("dmo") || explicit.includes("domestic") || explicit.includes("loco")) return "local";

    const exportDmo = String(sh.export_dmo || "").toLowerCase();
    if (exportDmo.includes("local") || exportDmo.includes("dmo") || exportDmo.includes("domestic")) return "local";

    const shippingTerm = String(sh.shipping_term || "").toLowerCase();
    if (shippingTerm.includes("loco")) return "local";

    return "export";
}

function getShipmentQty(sh: any): number {
    return safeNum(sh.quantity_loaded) || safeNum(sh.qty_plan) || safeNum(sh.qty_cob);
}

function cleanText(value: unknown): string {
    return String(value || "").replace(/\s+/g, " ").trim();
}

function isNarrativeText(value: unknown): boolean {
    const text = cleanText(value).toLowerCase();
    if (!text) return false;
    if (text.length > 60) return true;
    return (
        text.includes("issue") ||
        text.includes("terms payment") ||
        text.includes("kontrak") ||
        text.includes("dokumen") ||
        text.includes("harga")
    );
}

function hasOperationalShipmentSignal(sh: any): boolean {
    const qty = getShipmentQty(sh);
    const nomination = cleanText(sh.nomination || sh.barge_name || sh.bargeName);
    return qty > 0 || Boolean(nomination);
}

function getShipmentDisplayPort(sh: any): string {
    const candidates = [
        sh.loading_port,
        sh.loadingPort,
        sh.jetty_loading_port,
        sh.jettyLoadingPort,
    ];
    for (const c of candidates) {
        const text = cleanText(c);
        if (!text) continue;
        if (isNarrativeText(text)) continue;
        return text;
    }
    return "Port N/A";
}

function getShipmentRevenuePrice(sh: any): number {
    return safeNum(sh.sales_price) || safeNum(sh.sp) || safeNum(sh.harga_actual_fob_mv) || safeNum(sh.harga_actual_fob);
}

function getShipmentMargin(sh: any): number {
    const margin = safeNum(sh.margin_mt);
    if (margin !== 0) return margin;

    const selling = getShipmentRevenuePrice(sh);
    const cost = safeNum(sh.harga_actual_fob) || safeNum(sh.hpb);
    if (selling > 0 && cost > 0) return selling - cost;
    return 0;
}

type CanonicalShipmentStatus = "upcoming" | "loading" | "in_transit" | "completed" | "cancelled" | "unknown";

function normalizeShipmentStatus(raw?: string): CanonicalShipmentStatus {
    const src = normalizeStatus(raw);
    if (!src) return "unknown";
    if (src.includes("cancel")) return "cancelled";
    if (src.includes("done") || src.includes("complete") || src.includes("discharg")) return "completed";
    if (src.includes("loading_proses") || src.includes("loading_process") || src === "loading") return "loading";
    if (src.includes("in_transit") || src.includes("anchorage") || src.includes("discharging") || src.includes("transit")) return "in_transit";
    if (src.includes("upcoming") || src.includes("waiting") || src.includes("draft") || src.includes("planned")) return "upcoming";
    return "unknown";
}

function toShipmentMonitorTab(raw?: string): "all" | "upcoming" | "loading" | "in_transit" | "completed" | "cancelled" {
    const canonical = normalizeShipmentStatus(raw);
    if (canonical === "unknown") return "all";
    return canonical;
}

const REGION_ALIAS: Record<string, string[]> = {
    "KALIMANTAN TIMUR": ["KALIMANTAN TIMUR", "KALTIM", "EAST KALIMANTAN"],
    "KALIMANTAN SELATAN": ["KALIMANTAN SELATAN", "KALSEL", "SOUTH KALIMANTAN"],
    "KALIMANTAN TENGAH": ["KALIMANTAN TENGAH", "KALTENG", "CENTRAL KALIMANTAN"],
    "SUMATERA SELATAN": ["SUMATERA SELATAN", "SUMSEL", "SOUTH SUMATRA"],
};

function matchesRegion(regionFilter: string, ...candidates: Array<string | undefined>): boolean {
    if (regionFilter === "all") return true;
    const wanted = normalizeKey(regionFilter);
    const aliases = REGION_ALIAS[wanted] || [wanted];
    const hay = normalizeKey(candidates.filter(Boolean).join(" | "));
    if (!hay) return false;
    return aliases.some((alias) => hay.includes(alias));
}

function matchesTimeRangeWithDate(
    date: Date | null,
    range: FilterRange,
    now: Date,
    customFrom?: string,
    customTo?: string,
    fallbackYear?: number | null
): boolean {
    if (range === "all") return true;

    if (range === "ytd") {
        const y = date?.getFullYear() || fallbackYear || null;
        return y === now.getFullYear();
    }

    if (!date) return false;

    if (range === "30d") {
        const diffTime = now.getTime() - date.getTime();
        return diffTime / (1000 * 3600 * 24) <= 30;
    }
    if (range === "90d") {
        const diffTime = now.getTime() - date.getTime();
        return diffTime / (1000 * 3600 * 24) <= 90;
    }
    if (range === "custom") {
        if (customFrom && new Date(customFrom) > date) return false;
        if (customTo && new Date(customTo) < date) return false;
        return true;
    }

    return true;
}

function normalizeLocationOption(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const raw = String(value).replace(/\s+/g, " ").trim();
    if (!raw) return null;
    const key = normalizeKey(raw);
    if (["TBA", "-", "N/A", "UNKNOWN", "ALL", "ORIGIN", "STATUS", "SOURCE", "MV PROJECT NAME"].includes(key)) return null;
    return raw;
}
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

type UserActivitySummary = {
    userId: string;
    userName: string;
    totalLogs: number;
    attendanceLogs: number;
    lastActivityAt: string;
    lastAttendanceAt: string | null;
};

type UserActivityLog = {
    id: string;
    userId: string;
    userName: string;
    action: string;
    entity: string;
    entityId: string;
    details: string | null;
    createdAt: string;
    isAttendance: boolean;
};

function formatActivityTime(value?: string | null): string {
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

function DashboardFilters({ range, setRange, customFrom, customTo, setCustomFrom, setCustomTo, region, setRegion, marketType, setMarketType, status, setStatus, country, setCountry, search, setSearch, regionOptions = [] }: {
    range: FilterRange; setRange: (r: FilterRange) => void;
    customFrom: string; customTo: string; setCustomFrom: (d: string) => void; setCustomTo: (d: string) => void;
    region: string; setRegion: (r: string) => void;
    marketType: string; setMarketType: (m: string) => void;
    status: string; setStatus: (s: string) => void;
    country: string; setCountry: (c: string) => void;
    search: string; setSearch: (q: string) => void;
    regionOptions?: string[];
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
                <option value="all">All Locations</option>
                {regionOptions.map((r) => (
                    <option key={r} value={r}>{r}</option>
                ))}
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

/* ─── Market Price Cards ──────────────────────────────────── */
function MarketPriceMini() {
    const prices = useCommercialStore((s) => s.marketPrices);
    const latest = prices[0];
    const prev = prices[1];

    const metricCards = [
        { label: "ICI 1 (6500)", key: "ici_1", color: "text-red-500" },
        { label: "ICI 2 (5800)", key: "ici_2", color: "text-orange-500" },
        { label: "ICI 3 (5000)", key: "ici_3", color: "text-blue-500" },
        { label: "ICI 4 (4200)", key: "ici_4", color: "text-violet-500" },
        { label: "ICI 5 (3400)", key: "ici_5", color: "text-indigo-500" },
        { label: "NEWCASTLE", key: "newcastle", color: "text-pink-500" },
        { label: "HBA", key: "hba", color: "text-emerald-600" },
        { label: "HBA I (5300)", key: "hba_1", color: "text-cyan-500" },
        { label: "HBA II (4100)", key: "hba_2", color: "text-teal-500" },
        { label: "HBA III (3400)", key: "hba_3", color: "text-sky-500" },
    ] as const;

    const asValue = (entry: any, key: string) => safeNum(entry?.[key as keyof typeof entry] as any);
    const fmtUsd = (v: number) => `$${safeFmt(v, 2)}`;

    return (
        <div className="card-elevated p-5 animate-slide-up delay-5">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-sm font-semibold">Market Price</h3>
                    <p className="text-[10px] text-muted-foreground">
                        {latest?.date ? `Latest: ${new Date(latest.date).toLocaleDateString("en-GB")}` : "No market price data yet"}
                    </p>
                </div>
                <a href="/market-price" className="text-xs text-primary hover:underline flex items-center gap-1 group whitespace-nowrap">
                    Detail <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </a>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 xl:grid-cols-10 gap-2">
                {metricCards.map((item) => {
                    const value = asValue(latest, item.key);
                    const delta = value - asValue(prev, item.key);
                    const positive = delta >= 0;
                    return (
                        <div key={item.key} className="rounded-xl border border-border bg-accent/20 px-3 py-2">
                            <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{item.label}</p>
                            <p className={`text-2xl font-black leading-tight mt-1 ${item.color}`}>{fmtUsd(value)}</p>
                            <p className={`text-[10px] mt-1 font-semibold ${positive ? "text-emerald-500" : "text-red-500"}`}>
                                {positive ? "UP" : "DOWN"} {delta >= 0 ? "+" : ""}{safeFmt(delta, 2)}
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function TotalVolumeCard({ shipments, delay = 1 }: { shipments: any[]; delay?: number }) {
    const [selectedYear, setSelectedYear] = React.useState<number | null>(null);
    const [selectedSegment, setSelectedSegment] = React.useState<"total" | "local" | "export">("total");
    const [showDetails, setShowDetails] = React.useState(false);

    const yearRows = React.useMemo(() => {
        const map = new Map<number, {
            year: number;
            total: number;
            local: number;
            export: number;
            byStatusTotal: Record<CanonicalShipmentStatus, number>;
            byStatusLocal: Record<CanonicalShipmentStatus, number>;
            byStatusExport: Record<CanonicalShipmentStatus, number>;
        }>();

        const zeroStatus = (): Record<CanonicalShipmentStatus, number> => ({
            upcoming: 0,
            loading: 0,
            in_transit: 0,
            completed: 0,
            cancelled: 0,
            unknown: 0,
        });

        shipments.forEach((sh) => {
            const qty = getShipmentQty(sh);
            if (qty <= 0) return;

            const businessDate = getShipmentEtaDate(sh) || asDate(sh.bl_date);
            const year = businessDate?.getFullYear() || Number(sh.year) || null;
            if (!year || Number.isNaN(year)) return;

            const status = normalizeShipmentStatus(sh.status);
            const type = inferShipmentType(sh);
            const row = map.get(year) || {
                year,
                total: 0,
                local: 0,
                export: 0,
                byStatusTotal: zeroStatus(),
                byStatusLocal: zeroStatus(),
                byStatusExport: zeroStatus(),
            };

            row.total += qty;
            row.byStatusTotal[status] += qty;

            if (type === "local") {
                row.local += qty;
                row.byStatusLocal[status] += qty;
            } else {
                row.export += qty;
                row.byStatusExport[status] += qty;
            }

            map.set(year, row);
        });

        return Array.from(map.values()).sort((a, b) => b.year - a.year);
    }, [shipments]);

    React.useEffect(() => {
        if (yearRows.length === 0) {
            setSelectedYear(null);
            return;
        }
        if (!selectedYear || !yearRows.some((row) => row.year === selectedYear)) {
            setSelectedYear(yearRows[0].year);
        }
    }, [yearRows, selectedYear]);

    const selected = yearRows.find((r) => r.year === selectedYear) || yearRows[0];
    const grandTotal = yearRows.reduce((sum, row) => sum + row.total, 0);

    const statusOrder: CanonicalShipmentStatus[] = ["upcoming", "loading", "in_transit", "completed", "cancelled", "unknown"];
    const statusLabel: Record<CanonicalShipmentStatus, string> = {
        upcoming: "Upcoming",
        loading: "Loading",
        in_transit: "In Transit",
        completed: "Completed",
        cancelled: "Cancelled",
        unknown: "Unknown",
    };

    const getSegmentQty = (row: { total: number; local: number; export: number } | undefined, segment: "total" | "local" | "export"): number => {
        if (!row) return 0;
        if (segment === "local") return row.local;
        if (segment === "export") return row.export;
        return row.total;
    };

    const getStatusQty = (row: any, status: CanonicalShipmentStatus): number => {
        if (!row) return 0;
        if (selectedSegment === "local") return row.byStatusLocal?.[status] || 0;
        if (selectedSegment === "export") return row.byStatusExport?.[status] || 0;
        return row.byStatusTotal?.[status] || 0;
    };

    const selectedSegmentTotal = getSegmentQty(selected, selectedSegment);
    const selectedYearTotal = getSegmentQty(selected, "total");
    const segmentLabel = selectedSegment === "total" ? "All" : selectedSegment === "local" ? "Local" : "Export";

    return (
        <div className={cn("card-elevated p-5 md:p-6 space-y-4 animate-slide-up", `delay-${delay}`)}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Volume</p>
                    <p className="text-3xl font-black tracking-tight mt-1">{safeFmt(grandTotal / 1000, 0)}K MT</p>
                    <p className="text-[11px] text-muted-foreground mt-1">Filtered shipment volume</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-1 rounded-full bg-cyan-500/10 text-cyan-600 font-semibold">Year {selected?.year || "-"}</span>
                    <span className="text-[10px] px-2 py-1 rounded-full bg-primary/10 text-primary font-semibold">{segmentLabel}</span>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-cyan-500/10">
                        <Layers className="w-4 h-4 text-cyan-500" />
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between border-t border-border/60 pt-3">
                <p className="text-[11px] text-muted-foreground">
                    {selected?.year || "-"} - {segmentLabel} - {safeFmt(selectedSegmentTotal / 1000, 0)}K MT
                </p>
                <button
                    onClick={() => setShowDetails((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-accent/20 hover:bg-accent/40 text-[11px] font-semibold text-foreground transition-colors"
                >
                    {showDetails ? "Hide Detail" : "Show Detail"}
                    {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
            </div>

            {showDetails && (
                <>
                    <div className="space-y-2">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase">Year</p>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                            {yearRows.map((row) => (
                                <button
                                    key={row.year}
                                    onClick={() => {
                                        setSelectedYear(row.year);
                                        setSelectedSegment("total");
                                    }}
                                    className={cn(
                                        "min-w-[104px] rounded-xl border px-3 py-2 text-left transition-all",
                                        selected?.year === row.year ? "border-primary bg-primary/10 shadow-sm" : "border-border bg-accent/20 hover:bg-accent/40"
                                    )}
                                >
                                    <p className="text-xs font-bold">{row.year}</p>
                                    <p className="text-[10px] text-muted-foreground">{safeFmt(row.total / 1000, 0)}K MT</p>
                                </button>
                            ))}
                            {yearRows.length === 0 && <p className="text-[10px] text-muted-foreground">No volume data</p>}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase">Segment</p>
                        <div className="grid grid-cols-3 gap-2">
                            {(["total", "local", "export"] as const).map((segment) => (
                                <button
                                    key={segment}
                                    onClick={() => setSelectedSegment(segment)}
                                    className={cn(
                                        "rounded-xl border px-3 py-2 text-left transition-all",
                                        selectedSegment === segment ? "border-primary bg-primary/10 shadow-sm" : "border-border bg-accent/20 hover:bg-accent/40"
                                    )}
                                >
                                    <p className="text-[10px] font-semibold uppercase">{segment}</p>
                                    <p className="text-xs font-bold">{safeFmt(getSegmentQty(selected, segment) / 1000, 0)}K MT</p>
                                    <p className="text-[10px] text-muted-foreground">
                                        {selectedYearTotal > 0 ? `${safeFmt((getSegmentQty(selected, segment) / selectedYearTotal) * 100, 1)}%` : "0.0%"}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase">Status Breakdown ({segmentLabel})</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {statusOrder.map((status) => {
                                const qty = getStatusQty(selected, status);
                                const pct = selectedSegmentTotal > 0 ? (qty / selectedSegmentTotal) * 100 : 0;
                                return (
                                    <div key={status} className="rounded-xl border border-border bg-accent/20 px-3 py-2">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="text-[11px] font-medium">{statusLabel[status]}</p>
                                            <p className="text-[11px] font-bold">{safeFmt(qty / 1000, 0)}K MT</p>
                                        </div>
                                        <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
                                            <div className="h-full rounded-full bg-cyan-500 transition-all" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
                                        </div>
                                        <p className="text-[10px] text-muted-foreground mt-1">{safeFmt(pct, 1)}%</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
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

/* ─── Shipment Tables ─────────────────────────────────────── */
const STATUS_ORDER = ["loading", "in_transit", "upcoming", "done_shipment", "completed", "cancelled"];

function ShipmentTable({ shipments, label, emptyText = "Tidak ada shipment" }: { shipments: any[]; label: string; emptyText?: string }) {
    const statusSummary = SHIPMENT_STATUSES
        .map((s) => ({
            ...s,
            count: shipments.filter((sh) => sh.status === s.value).length,
        }))
        .filter((s) => s.count > 0);

    const sortedShipments = React.useMemo(() => {
        const getStatusRank = (status: string) => {
            const idx = STATUS_ORDER.indexOf(status);
            return idx === -1 ? STATUS_ORDER.length : idx;
        };

        return [...shipments].sort((a, b) => getStatusRank(a.status) - getStatusRank(b.status));
    }, [shipments]);

    const fmtDate = (value?: string | null) => {
        if (!value) return "-";
        const d = new Date(value);
        if (isNaN(d.getTime())) return "-";
        return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
    };

    return (
        <div className="card-elevated p-5 animate-slide-up space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="text-sm font-semibold">{label}</h3>
                <a
                    href="/shipment-monitor"
                    className="text-[10px] text-primary hover:underline flex items-center gap-1 group"
                >
                    Open Monitor
                    <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </a>
            </div>
            <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] text-muted-foreground bg-accent/50 px-2 py-0.5 rounded-full">{sortedShipments.length} shipments</span>
            </div>
            <div className="space-y-2">
                {sortedShipments.slice(0, 4).map((sh: any) => {
                    const statusTab = toShipmentMonitorTab(sh.status);
                    const statusCfg = SHIPMENT_STATUSES.find((s) => s.value === statusTab) || SHIPMENT_STATUSES[0];
                    const detailUrl = `/shipment-monitor?tab=${statusTab}&open=${encodeURIComponent(sh.id)}`;
                    return (
                        <div key={sh.id} className="flex items-center gap-3 p-3 rounded-xl bg-accent/30 hover:bg-accent/50 transition-colors">
                            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${statusCfg?.color}15` }}>
                                <Ship className="w-4 h-4" style={{ color: statusCfg?.color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold truncate">{cleanText(sh.buyer || sh.source || "Unknown")}</p>
                                <p className="text-[10px] text-muted-foreground">Laycan: {formatLaycanCompact(sh)}</p>
                                <p className="text-[10px] text-muted-foreground">
                                    {cleanText(sh.vessel_name || sh.vesselName || sh.mv_project_name || sh.mvProjectName || sh.barge_name || sh.bargeName || "Vessel N/A")}
                                    {" · "}
                                    {getShipmentDisplayPort(sh)}
                                </p>
                            </div>
                            <div className="text-right shrink-0">
                                <span className="status-badge text-[10px]" style={{ color: statusCfg?.color, backgroundColor: `${statusCfg?.color}15` }}>
                                    {statusCfg?.label}
                                </span>
                                <div className="mt-1">
                                    <a
                                        href={detailUrl}
                                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline"
                                    >
                                        Open Detail
                                        <ArrowUpRight className="w-3 h-3" />
                                    </a>
                                </div>
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
                {sortedShipments.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Tidak ada shipment</p>}
            </div>

            {statusSummary.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {statusSummary.map((s) => (
                        <span
                            key={s.value}
                            className="text-[10px] font-medium px-2 py-1 rounded-full border border-border/60"
                            style={{ color: s.color, backgroundColor: `${s.color}15` }}
                        >
                            {s.label}: {s.count}
                        </span>
                    ))}
                </div>
            )}

            {sortedShipments.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">{emptyText}</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[920px] text-xs">
                        <thead>
                            <tr className="border-b border-border/60 text-muted-foreground">
                                <th className="text-left font-semibold py-2 pr-2">No</th>
                                <th className="text-left font-semibold py-2 pr-2">Shipment No</th>
                                <th className="text-left font-semibold py-2 pr-2">Buyer</th>
                                <th className="text-left font-semibold py-2 pr-2">Vessel / Barge</th>
                                <th className="text-left font-semibold py-2 pr-2">Port Muat</th>
                                <th className="text-right font-semibold py-2 pr-2">Qty (MT)</th>
                                <th className="text-left font-semibold py-2 pr-2">BL Date</th>
                                <th className="text-left font-semibold py-2">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedShipments.map((sh, index) => {
                                const statusCfg = SHIPMENT_STATUSES.find((s) => s.value === sh.status);
                                const statusColor = statusCfg?.color || "#64748b";
                                const qty = Number(sh.quantity_loaded ?? sh.qty_plan ?? 0);
                                const rowKey = sh.id || sh.shipment_number || `${sh.buyer || "shipment"}-${index}`;

                                return (
                                    <tr key={rowKey} className="border-b border-border/40 hover:bg-accent/20 transition-colors">
                                        <td className="py-2 pr-2">{index + 1}</td>
                                        <td className="py-2 pr-2 font-medium">{sh.shipment_number || "-"}</td>
                                        <td className="py-2 pr-2">{sh.buyer || "-"}</td>
                                        <td className="py-2 pr-2">{sh.vessel_name || sh.barge_name || "-"}</td>
                                        <td className="py-2 pr-2">{sh.loading_port || "-"}</td>
                                        <td className="py-2 pr-2 text-right">{Number.isFinite(qty) ? qty.toLocaleString("id-ID") : "0"}</td>
                                        <td className="py-2 pr-2">{fmtDate(sh.bl_date)}</td>
                                        <td className="py-2">
                                            <span className="status-badge text-[10px]" style={{ color: statusColor, backgroundColor: `${statusColor}15` }}>
                                                {statusCfg?.label || sh.status || "-"}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function ProjectApprovalAlerts({ projects }: { projects: any[] }) {
    return (
        <div className="card-elevated p-5 animate-slide-up">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Waiting Approval for Project</h3>
                <a href="/projects" className="text-[10px] text-primary hover:underline flex items-center gap-1 group">
                    Open Projects
                    <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </a>
            </div>
            {projects.length === 0 ? (
                <p className="text-xs text-muted-foreground">No project is waiting for approval.</p>
            ) : (
                <div className="space-y-2">
                    {projects.slice(0, 6).map((p: any) => (
                        <div key={p.id} className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-xs font-semibold truncate">{cleanText(p.name) || "Unnamed Project"}</p>
                                    <p className="text-[10px] text-muted-foreground">
                                        Buyer: {cleanText(p.buyer) || "-"} · Segment: {cleanText(p.segment) || "-"}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">
                                        Created: {asDate(p.created_at || p.createdAt)?.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }) || "-"}
                                    </p>
                                </div>
                                <a
                                    href={`/projects?q=${encodeURIComponent(cleanText(p.name) || "")}`}
                                    className="shrink-0 text-[10px] font-semibold text-primary hover:underline"
                                >
                                    Detail
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ─── Quantity per Month Chart ────────────────────────────── */
function QuantityPerMonth({ shipments }: { shipments: any[] }) {
    const [mounted, setMounted] = React.useState(false);
    const [viewMode, setViewMode] = React.useState<"year" | "2years" | "all">("year");
    const [selectedYear, setSelectedYear] = React.useState<number>(CURRENT_YEAR);
    React.useEffect(() => setMounted(true), []);

    const monthlyBucket = React.useMemo(() => {
        const bucket = new Map<string, { year: number; monthIndex: number; local: number; export: number }>();

        shipments.forEach((sh) => {
            const qty = getShipmentQty(sh);
            if (qty <= 0) return;

            const businessDate = getShipmentEtaDate(sh) || asDate(sh.bl_date);
            if (!businessDate) return;

            const year = businessDate.getFullYear();
            const monthIndex = businessDate.getMonth();
            const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
            const type = inferShipmentType(sh);
            const current = bucket.get(key) || { year, monthIndex, local: 0, export: 0 };

            if (type === "local") current.local += qty;
            else current.export += qty;

            bucket.set(key, current);
        });

        return bucket;
    }, [shipments]);

    const availableYears = React.useMemo(() => {
        const years = Array.from(new Set(Array.from(monthlyBucket.values()).map((v) => v.year)));
        years.sort((a, b) => a - b);
        return years;
    }, [monthlyBucket]);

    React.useEffect(() => {
        if (availableYears.length === 0) return;
        if (!availableYears.includes(selectedYear)) {
            setSelectedYear(availableYears[availableYears.length - 1]);
        }
    }, [availableYears, selectedYear]);

    const monthlyData = React.useMemo(() => {
        const sortedKeys = Array.from(monthlyBucket.keys()).sort((a, b) => a.localeCompare(b));
        if (sortedKeys.length === 0) return [];

        const [rawStartY, rawStartM] = sortedKeys[0].split("-").map(Number);
        const [rawEndY, rawEndM] = sortedKeys[sortedKeys.length - 1].split("-").map(Number);
        const earliestMonth = new Date(rawStartY, (rawStartM || 1) - 1, 1);
        const latestMonth = new Date(rawEndY, (rawEndM || 1) - 1, 1);
        const fallbackYear = availableYears[availableYears.length - 1] || latestMonth.getFullYear();
        const chosenYear = availableYears.includes(selectedYear) ? selectedYear : fallbackYear;

        let startMonth = new Date(latestMonth);
        let endMonth = new Date(latestMonth);
        if (viewMode === "year") {
            startMonth = new Date(chosenYear, 0, 1);
            endMonth = new Date(chosenYear, 11, 1);
        } else if (viewMode === "2years") {
            startMonth = new Date(chosenYear - 1, 0, 1);
            endMonth = new Date(chosenYear, 11, 1);
        } else {
            startMonth = new Date(earliestMonth);
            endMonth = new Date(latestMonth);
        }

        const useYearOnAxis = viewMode !== "year";
        const rows: Array<{ key: string; monthLabel: string; fullMonthLabel: string; local: number; export: number; total: number }> = [];
        const cursor = new Date(startMonth.getFullYear(), startMonth.getMonth(), 1);
        const end = new Date(endMonth.getFullYear(), endMonth.getMonth(), 1);

        while (cursor <= end) {
            const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
            const value = monthlyBucket.get(key);
            const local = Math.round(value?.local || 0);
            const exportVol = Math.round(value?.export || 0);
            rows.push({
                key,
                monthLabel: cursor.toLocaleDateString("en-US", useYearOnAxis ? { month: "short", year: "2-digit" } : { month: "short" }),
                fullMonthLabel: cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
                local,
                export: exportVol,
                total: local + exportVol,
            });
            cursor.setMonth(cursor.getMonth() + 1);
        }

        return rows;
    }, [monthlyBucket, viewMode, selectedYear, availableYears]);

    const totalQty = monthlyData.reduce((s, row) => s + row.total, 0);
    const rangeLabel = React.useMemo(() => {
        if (monthlyData.length === 0) return "No business-date shipment data";
        if (viewMode === "year") return `Year ${selectedYear} (Jan - Dec)`;
        if (viewMode === "2years") return `${selectedYear - 1} - ${selectedYear}`;
        return `${monthlyData[0].fullMonthLabel} - ${monthlyData[monthlyData.length - 1].fullMonthLabel}`;
    }, [monthlyData, viewMode, selectedYear]);
    const isDense = monthlyData.length > 14;
    const showYearPicker = viewMode !== "all" && availableYears.length > 0;

    return (
        <div className="card-elevated p-5 animate-slide-up delay-2">
            <div className="flex items-start justify-between mb-4 gap-3">
                <div>
                    <h3 className="text-sm font-semibold">Quantity per Month (MT)</h3>
                    <p className="text-[10px] text-muted-foreground">Period: {rangeLabel}</p>
                    <p className="text-[10px] text-muted-foreground">Total: {Math.round(totalQty / 1000)}K MT</p>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={viewMode}
                        onChange={(e) => setViewMode(e.target.value as "year" | "2years" | "all")}
                        className="px-2 py-1 rounded-md bg-accent/50 border border-border text-[10px] outline-none focus:border-primary/50 text-muted-foreground"
                    >
                        <option value="year">By Year</option>
                        <option value="2years">Last 2 Years</option>
                        <option value="all">All Years</option>
                    </select>
                    {showYearPicker && (
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="px-2 py-1 rounded-md bg-accent/50 border border-border text-[10px] outline-none focus:border-primary/50 text-muted-foreground"
                        >
                            {availableYears.slice().reverse().map((y) => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    )}
                    <a href="/sales-monitor" className="text-xs text-primary hover:underline flex items-center gap-1 group whitespace-nowrap">
                        Detail <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </a>
                </div>
            </div>
            <div className="h-[240px]">
                {mounted && (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: -20, bottom: isDense ? 18 : 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.1)" />
                            <XAxis
                                dataKey="monthLabel"
                                tick={{ fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                angle={isDense ? -35 : 0}
                                textAnchor={isDense ? "end" : "middle"}
                                height={isDense ? 48 : 28}
                            />
                            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${safeFmt(v / 1000, 0)}K`} />
                            <Tooltip
                                contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontSize: "12px" }}
                                labelFormatter={(_label, payload) => {
                                    const full = payload?.[0]?.payload?.fullMonthLabel;
                                    return full || _label;
                                }}
                                formatter={(v: any, name: string, props: any) => {
                                    if (name === "local") return [`${safeFmt(Number(v) / 1000, 0)}K MT`, "Local (Domestic)"];
                                    if (name === "export") return [`${safeFmt(Number(v) / 1000, 0)}K MT`, "Export"];
                                    return [`${safeFmt(Number(v) / 1000, 0)}K MT`, name];
                                }}
                            />
                            <Legend wrapperStyle={{ fontSize: "11px" }} />
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

function UserActivityLogPanel({
    users,
    logs,
    isLoading,
    error,
}: {
    users: UserActivitySummary[];
    logs: UserActivityLog[];
    isLoading: boolean;
    error: string | null;
}) {
    const attendanceCount = logs.filter((log) => log.isAttendance).length;

    return (
        <div className="card-elevated p-5 animate-slide-up delay-4 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-500/10 flex items-center justify-center">
                        <ScrollText className="w-5 h-5 text-slate-500" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold">User Activity Log</h3>
                        <p className="text-[10px] text-muted-foreground">Log aktivitas user termasuk absensi (jika tercatat di AuditLog).</p>
                    </div>
                </div>
                <a href="/audit-logs" className="text-xs text-primary hover:underline flex items-center gap-1 group">
                    Open Audit Logs <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </a>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="rounded-xl border border-border bg-accent/20 px-3 py-2">
                    <p className="text-[10px] text-muted-foreground">Active Users</p>
                    <p className="text-sm font-bold">{users.length}</p>
                </div>
                <div className="rounded-xl border border-border bg-accent/20 px-3 py-2">
                    <p className="text-[10px] text-muted-foreground">Total Logs</p>
                    <p className="text-sm font-bold">{logs.length}</p>
                </div>
                <div className="rounded-xl border border-border bg-accent/20 px-3 py-2">
                    <p className="text-[10px] text-muted-foreground">Attendance Logs</p>
                    <p className="text-sm font-bold text-emerald-600">{attendanceCount}</p>
                </div>
                <div className="rounded-xl border border-border bg-accent/20 px-3 py-2">
                    <p className="text-[10px] text-muted-foreground">Non-Attendance</p>
                    <p className="text-sm font-bold">{Math.max(0, logs.length - attendanceCount)}</p>
                </div>
            </div>

            {isLoading ? (
                <div className="space-y-2">
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                </div>
            ) : error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {error}
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div className="overflow-x-auto rounded-xl border border-border bg-accent/10">
                        <table className="w-full min-w-[520px] text-xs">
                            <thead>
                                <tr className="border-b border-border/60 text-left text-muted-foreground">
                                    <th className="px-3 py-2 font-semibold">User</th>
                                    <th className="px-3 py-2 font-semibold text-right">Activity</th>
                                    <th className="px-3 py-2 font-semibold text-right">Absensi</th>
                                    <th className="px-3 py-2 font-semibold">Last Activity</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.slice(0, 10).map((user) => (
                                    <tr key={user.userId} className="border-b border-border/40 hover:bg-accent/30 transition-colors">
                                        <td className="px-3 py-2 font-medium">{user.userName}</td>
                                        <td className="px-3 py-2 text-right">{user.totalLogs}</td>
                                        <td className="px-3 py-2 text-right text-emerald-600 font-semibold">{user.attendanceLogs}</td>
                                        <td className="px-3 py-2 text-muted-foreground">{formatActivityTime(user.lastActivityAt)}</td>
                                    </tr>
                                ))}
                                {users.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                                            Belum ada aktivitas user pada periode ini.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="space-y-2">
                        {logs.slice(0, 10).map((log) => (
                            <div key={log.id} className="rounded-xl border border-border bg-accent/20 px-3 py-2">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs font-semibold truncate">{log.userName}</p>
                                    <span className={cn(
                                        "text-[10px] px-2 py-0.5 rounded-full font-semibold",
                                        log.isAttendance
                                            ? "bg-emerald-500/15 text-emerald-600"
                                            : "bg-slate-500/15 text-slate-600"
                                    )}>
                                        {log.isAttendance ? "Absensi" : "Aktivitas"}
                                    </span>
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-1">
                                    {log.action} · {log.entity} · {log.entityId}
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-1">{formatActivityTime(log.createdAt)}</p>
                            </div>
                        ))}
                        {logs.length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-4">
                                Belum ada log aktivitas terbaru.
                            </p>
                        )}
                    </div>
                </div>
            )}
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
    const { data: session, status: sessionStatus } = useSession();
    const currentUser = session?.user as any;
    const syncTasks = useTaskStore((s) => s.syncFromMemory);
    const syncCommercial = useCommercialStore((s) => s.syncFromMemory);
    const deals = useCommercialStore((s) => s.deals);
    const shipments = useCommercialStore((s) => s.shipments);
    const tasks = useTaskStore((s) => s.tasks);
    const [timeRange, setTimeRange] = React.useState<FilterRange>("all");
    const [customFrom, setCustomFrom] = React.useState("");
    const [customTo, setCustomTo] = React.useState("");
    const [region, setRegion] = React.useState("all");
    const [marketType, setMarketType] = React.useState("all");
    const [status, setStatus] = React.useState("all");
    const [country, setCountry] = React.useState("all");
    const [search, setSearch] = React.useState("");
    const rawRole = String(currentUser?.role || "").trim().toLowerCase();
    const normalizedRole = rawRole.replace(/[\s-]+/g, "_");
    const isCeo = normalizedRole === "ceo";
    const isExecutive = ["ceo", "director", "assistant_ceo", "assistantceo"].includes(normalizedRole);
    const isRoleResolving = sessionStatus === "loading" || (sessionStatus === "authenticated" && !normalizedRole);
    const sources = useCommercialStore((s) => s.sources);
    const projects = useCommercialStore((s) => s.projects);
    const [isLoading, setIsLoading] = React.useState(true);
    const [userActivitySummary, setUserActivitySummary] = React.useState<UserActivitySummary[]>([]);
    const [userActivityLogs, setUserActivityLogs] = React.useState<UserActivityLog[]>([]);
    const [userActivityLoading, setUserActivityLoading] = React.useState(false);
    const [userActivityError, setUserActivityError] = React.useState<string | null>(null);
    const regionOptions = React.useMemo(() => {
        const bag = new Set<string>();
        const push = (v: unknown) => {
            const loc = normalizeLocationOption(v);
            if (loc) bag.add(loc);
        };

        shipments.forEach((s: any) => {
            push(s.origin);
            push(s.region);
        });
        deals.forEach((d: any) => push(d.region));
        sources.forEach((s: any) => push(s.region));

        return Array.from(bag).sort((a, b) => a.localeCompare(b));
    }, [shipments, deals, sources]);

    React.useEffect(() => {
        if (sessionStatus === "loading") return;

        let cancelled = false;

        const runInitialSync = async () => {
            if (sessionStatus !== "authenticated") {
                if (!cancelled) setIsLoading(false);
                return;
            }

            // Stage 1: fetch critical dashboard data.
            await syncCommercial({ mode: "dashboard_fast", force: true });

            // Stage 2: complete dashboard-required sync before turning loader off.
            await Promise.all([
                syncCommercial({ mode: "full", force: true }),
                syncTasks(),
            ]);

            if (!cancelled) setIsLoading(false);
        };

        runInitialSync().catch(() => {
            if (!cancelled) setIsLoading(false);
        });

        return () => {
            cancelled = true;
        };
    }, [sessionStatus, syncTasks, syncCommercial]);

    React.useEffect(() => {
        if (sessionStatus !== "authenticated" || !isCeo) {
            setUserActivitySummary([]);
            setUserActivityLogs([]);
            setUserActivityError(null);
            setUserActivityLoading(false);
            return;
        }

        let cancelled = false;

        const fetchUserActivity = async () => {
            setUserActivityLoading(true);
            setUserActivityError(null);

            try {
                const response = await fetch("/api/users/activity-logs?limit=120&days=90", {
                    method: "GET",
                    cache: "no-store",
                });

                const payload = await response.json();
                if (!response.ok) {
                    throw new Error(payload?.error || "Failed to fetch user activity logs.");
                }

                if (cancelled) return;

                setUserActivitySummary(Array.isArray(payload?.usersSummary) ? payload.usersSummary : []);
                setUserActivityLogs(Array.isArray(payload?.logs) ? payload.logs : []);
            } catch (error) {
                if (cancelled) return;
                setUserActivitySummary([]);
                setUserActivityLogs([]);
                setUserActivityError(error instanceof Error ? error.message : "Failed to fetch user activity logs.");
            } finally {
                if (!cancelled) setUserActivityLoading(false);
            }
        };

        fetchUserActivity();

        return () => {
            cancelled = true;
        };
    }, [sessionStatus, isCeo]);

    // Master Filter logic (dataset-aware: deals vs shipments vs sources)
    const now = new Date();
    const q = search.toLowerCase().trim();
    const countryNorm = normalizeKey(country);

    const matchesSearch = (...fields: Array<string | number | undefined | null>): boolean => {
        if (!q) return true;
        return fields
            .filter((v) => v !== null && v !== undefined && String(v).trim() !== "")
            .some((v) => String(v).toLowerCase().includes(q));
    };

    const filteredDeals = deals.filter((d: any) => {
        const st = normalizeStatus(d.status);
        const dealType = String(d.type || "").toLowerCase();
        const dealDate = asDate(d.laycan_start) || asDate(d.laycan_end) || asDate(d.created_at);

        if (marketType !== "all" && dealType && dealType !== marketType) return false;

        // Status filter for sales pipeline
        if (status !== "all") {
            if (status === "pre_sale" && st !== "pre_sale") return false;
            if (status === "confirmed" && !["confirmed", "contracted", "executed"].includes(st)) return false;
            if (status === "in_transit" && st !== "executed") return false;
            if (status === "completed" && st !== "executed") return false;
        }

        if (country !== "all") {
            const dealCountry = normalizeKey(d.buyer_country);
            if (!dealCountry || dealCountry !== countryNorm) return false;
        }

        if (!matchesRegion(region, d.region)) return false;
        if (!matchesSearch(d.buyer, d.deal_number, d.vessel_name, d.project_id, d.buyer_country)) return false;

        return matchesTimeRangeWithDate(dealDate, timeRange, now, customFrom, customTo, null);
    });

    const filteredShipments = shipments.filter((sh: any) => {
        if (!hasOperationalShipmentSignal(sh)) return false;

        const shipmentType = inferShipmentType(sh);
        const shipmentStatus = normalizeShipmentStatus(sh.status);
        const shipmentDate = getShipmentEtaDate(sh) || asDate(sh.bl_date) || asDate(sh.created_at);
        const shipmentYear = Number(sh.year) || null;
        const shipmentRegionText = [sh.region, sh.origin, sh.loading_port, sh.jetty_loading_port].filter(Boolean).join(" ");

        if (marketType !== "all" && shipmentType !== marketType) return false;

        if (status !== "all") {
            if (status === "pre_sale") return false;
            if (status === "confirmed" && !["upcoming", "loading"].includes(shipmentStatus)) return false;
            if (status === "in_transit" && !["in_transit", "loading"].includes(shipmentStatus)) return false;
            if (status === "completed" && shipmentStatus !== "completed") return false;
        }

        if (country !== "all") {
            const shipmentCountry = normalizeKey((sh as any).buyer_country);
            if (!shipmentCountry || shipmentCountry !== countryNorm) return false;
        }

        if (!matchesRegion(region, shipmentRegionText)) return false;

        if (!matchesSearch(
            sh.buyer,
            sh.supplier,
            sh.vessel_name,
            sh.barge_name,
            sh.mv_project_name,
            sh.nomination,
            sh.shipment_number,
            sh.source
        )) return false;

        return matchesTimeRangeWithDate(shipmentDate, timeRange, now, customFrom, customTo, shipmentYear);
    });

    const filteredSources = sources.filter((src: any) => {
        const sourceDate = asDate(src.updated_at) || asDate(src.created_at);

        if (!matchesRegion(region, src.region)) return false;
        if (!matchesSearch(src.name, src.region, src.pic_name, src.contact_person)) return false;

        return matchesTimeRangeWithDate(sourceDate, timeRange, now, customFrom, customTo, null);
    });

    // Financial calculations: Combined from Confirmed/Contracted/Executed Deals + Active Shipments
    // We include all "successful" deal statuses for revenue visibility
    const confirmedDeals = filteredDeals.filter((d) => {
        const st = normalizeStatus(d.status as string);
        return st === "confirmed" || st === "contracted" || st === "executed";
    });
    // Shipments are used for operational tracking and volume reporting
    const totalQty = filteredShipments.reduce((s, sh) => s + getShipmentQty(sh), 0);
    const localQty = filteredShipments
        .filter((sh) => inferShipmentType(sh) === "local")
        .reduce((s, sh) => s + getShipmentQty(sh), 0);
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

    // DB-first fallback metrics (MV/Project-centric) so dashboard remains meaningful even when deals table is empty.
    const fallbackMonetizedShipments = filteredShipments.filter((sh) => {
        const st = normalizeStatus(sh.status);
        return st !== "cancelled" && st !== "draft" && getShipmentQty(sh) > 0 && getShipmentRevenuePrice(sh) > 0;
    });
    const fallbackRevenueTotal = fallbackMonetizedShipments.reduce((s, sh) => s + (getShipmentQty(sh) * getShipmentRevenuePrice(sh)), 0);
    const fallbackRevenueLocal = fallbackMonetizedShipments
        .filter((sh) => inferShipmentType(sh) === "local")
        .reduce((s, sh) => s + (getShipmentQty(sh) * getShipmentRevenuePrice(sh)), 0);
    const fallbackRevenueExport = fallbackRevenueTotal - fallbackRevenueLocal;

    const fallbackGrossProfitTotal = fallbackMonetizedShipments.reduce((s, sh) => s + (getShipmentQty(sh) * getShipmentMargin(sh)), 0);
    const fallbackGrossProfitLocal = fallbackMonetizedShipments
        .filter((sh) => inferShipmentType(sh) === "local")
        .reduce((s, sh) => s + (getShipmentQty(sh) * getShipmentMargin(sh)), 0);
    const fallbackGrossProfitExport = fallbackGrossProfitTotal - fallbackGrossProfitLocal;

    const hasDealFinancials = totalRevenue > 0 || confirmedDeals.length > 0;
    const metricRevenueTotal = hasDealFinancials ? totalRevenue : fallbackRevenueTotal;
    const metricRevenueLocal = hasDealFinancials ? localRevenue : fallbackRevenueLocal;
    const metricRevenueExport = hasDealFinancials ? exportRevenue : fallbackRevenueExport;
    const metricGrossProfitTotal = hasDealFinancials ? totalGrossProfit : fallbackGrossProfitTotal;

    const metricLocalGpPerMt = localQty > 0
        ? (hasDealFinancials ? localGP : (fallbackGrossProfitLocal / localQty))
        : 0;
    const metricExportGpPerMt = exportQty > 0
        ? (hasDealFinancials ? exportGP : (fallbackGrossProfitExport / exportQty))
        : 0;
    const metricTotalGpPerMt = totalQty > 0 ? metricGrossProfitTotal / totalQty : 0;

    const completedStatuses = new Set(["completed", "done_shipment", "complete_discharge", "complete_discharged", "discharged"]);
    const normalizedActiveShipments = filteredShipments.filter((sh) => {
        const st = normalizeStatus(sh.status);
        return st !== "cancelled" && !completedStatuses.has(st);
    });
    const ongoingStatuses = new Set(["loading", "in_transit", "anchorage", "discharging", "loading_proses", "loading_process"]);
    const normalizedOngoingShipments = normalizedActiveShipments.filter((sh) => ongoingStatuses.has(normalizeStatus(sh.status)));

    const upcomingStatuses = new Set(["upcoming", "waiting_loading", "draft", "planned", "waiting", "waiting_for_loading"]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizon30 = new Date(today);
    horizon30.setDate(horizon30.getDate() + 30);
    const horizon60 = new Date(today);
    horizon60.setDate(horizon60.getDate() + 60);

    const normalizedUpcomingCandidates = normalizedActiveShipments.filter((sh) => {
        const st = normalizeStatus(sh.status);
        if (upcomingStatuses.has(st)) return true;
        const eta = getShipmentEtaDate(sh);
        return Boolean(eta && eta >= today);
    });
    const normalizedUpcoming30 = normalizedUpcomingCandidates.filter((sh) => {
        const eta = getShipmentEtaDate(sh);
        return Boolean(eta && eta <= horizon30);
    });
    const normalizedUpcoming60 = normalizedUpcomingCandidates.filter((sh) => {
        const eta = getShipmentEtaDate(sh);
        if (!eta) return true;
        return eta > horizon30 && eta <= horizon60;
    });

    const fallbackActiveDeals = new Set(
        normalizedActiveShipments
            .map((sh) => normalizeKey(sh.mv_project_name || sh.vessel_name || sh.nomination))
            .filter(Boolean)
    ).size;
    const hasDealRows = filteredDeals.length > 0;
    const metricActiveDeals = hasDealRows ? (preSaleCount + confirmedCount + forecastCount) : fallbackActiveDeals;
    const metricActiveDealsSub = hasDealRows ? `${confirmedCount} confirmed` : `${fallbackActiveDeals} MV/Project active`;

    const pendingTasks = tasks.filter((t) => t.status === "review").length;
    const waitingApprovalProjects = projects
        .filter((p: any) => {
            const st = normalizeStatus(p.status);
            return st === "waiting_approval" || st === "pending_approval" || st === "waiting";
        })
        .sort((a: any, b: any) => {
            const da = asDate(a.created_at || a.createdAt)?.getTime() || 0;
            const db = asDate(b.created_at || b.createdAt)?.getTime() || 0;
            return db - da;
        });

    const formatUSD = (v: number) => {
        if (Math.abs(v) >= 1000000) return `$${(v / 1000000).toFixed(2)}M`;
        if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(2)}K`;
        return `$${v.toFixed(2)}`;
    };

    if (isRoleResolving) {
        return (
            <AppShell>
                <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6">
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
                        {[1, 2, 3, 4, 5].map((i) => <MetricCardSkeleton key={i} />)}
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <ChartSkeleton />
                        <ChartSkeleton />
                    </div>
                </div>
            </AppShell>
        );
    }

    if (sessionStatus === "authenticated" && !isExecutive) {
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

    const hasHydratedData = shipments.length > 0 || deals.length > 0 || sources.length > 0 || tasks.length > 0;
    const showDashboardSkeleton = isLoading && !DISABLE_SKELETON_LOADERS && !hasHydratedData;

    return (
        <AppShell>
            <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6">
                {showDashboardSkeleton ? (
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

                        <div className="grid grid-cols-1 gap-4">
                            <ChartSkeleton />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <MetricCardSkeleton />
                            <MetricCardSkeleton />
                        </div>

                        {isCeo && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <MetricCardSkeleton />
                                <MetricCardSkeleton />
                            </div>
                        )}

                        {isCeo && (
                            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                                {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                            </div>
                        )}

                        {isCeo && (
                            <div className="grid grid-cols-1 gap-4">
                                <ChartSkeleton short />
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
                                <p className="text-sm text-muted-foreground">Commercial Team Overview - {currentUser?.job_title || currentUser?.role || "Guest"}</p>
                            </div>
                            <DashboardFilters
                                range={timeRange} setRange={setTimeRange}
                                customFrom={customFrom} customTo={customTo}
                                setCustomFrom={setCustomFrom} setCustomTo={setCustomTo}
                                region={region} setRegion={setRegion}
                                regionOptions={regionOptions}
                                marketType={marketType} setMarketType={setMarketType}
                                status={status} setStatus={setStatus}
                                country={country} setCountry={setCountry}
                                search={search} setSearch={setSearch}
                            />
                        </div>

                        {/* Top Metrics - Row 1 (Volume Full Width) */}
                        <div className="grid grid-cols-1 gap-4">
                            <TotalVolumeCard shipments={filteredShipments} delay={1} />
                        </div>

                        {/* Top Metrics - Row 1B (Operational Summary) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <MetricCard label="Active Deals" value={metricActiveDeals} sub={metricActiveDealsSub} icon={BarChart3} color="bg-blue-500/10" delay={2} />
                            <MetricCard label="Active Shipments" value={normalizedActiveShipments.length} sub={`${pendingTasks} tasks pending`} icon={Ship} color="bg-amber-500/10" delay={3} />
                        </div>

                        {isCeo && (
                            <div className="grid grid-cols-1 gap-4">
                                <ProjectApprovalAlerts projects={waitingApprovalProjects} />
                            </div>
                        )}

                        {isCeo && (
                            <div className="grid grid-cols-1 gap-4">
                                <UserActivityLogPanel
                                    users={userActivitySummary}
                                    logs={userActivityLogs}
                                    isLoading={userActivityLoading}
                                    error={userActivityError}
                                />
                            </div>
                        )}

                        {/* Top Metrics - Row 2 (Financial) */}
                        {isCeo && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <MetricCard label="Total Revenue (USD)" value={formatUSD(metricRevenueTotal)} sub={hasDealFinancials ? "YTD Confirmed" : "From Shipment Data"} icon={DollarSign} color="bg-emerald-500/10" delay={4} restricted hasAccess={isCeo} />
                                <MetricCard label="Gross Profit (USD)" value={formatUSD(metricGrossProfitTotal)} sub={`$${safeFmt(metricTotalGpPerMt)}/MT avg`} icon={TrendingUp} color="bg-violet-500/10" delay={5} restricted hasAccess={isCeo} />
                            </div>
                        )}

                        {/* CEO-Only Revenue Split */}
                        {isCeo && (
                            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                                <SmallStat label="Revenue Local" value={formatUSD(metricRevenueLocal)} color="text-blue-500" />
                                <SmallStat label="Revenue Export" value={formatUSD(metricRevenueExport)} color="text-violet-500" />
                                <SmallStat label="GP Total" value={formatUSD(metricGrossProfitTotal)} color="text-emerald-500" />
                                <SmallStat label="GP Local/MT" value={`$${safeFmt(metricLocalGpPerMt)}`} color="text-emerald-500" />
                                <SmallStat label="GP Export/MT" value={`$${safeFmt(metricExportGpPerMt)}`} color="text-emerald-500" />
                                <SmallStat label="GP Total/MT" value={`$${safeFmt(metricTotalGpPerMt)}`} color="text-emerald-600" />
                            </div>
                        )}

                        {/* Row 2: Market Price */}
                        <div className="grid grid-cols-1 gap-4">
                            <MarketPriceMini />
                        </div>

                        {/* Row 3: Quantity per Month */}
                        <div className="grid grid-cols-1 gap-4">
                            <QuantityPerMonth shipments={filteredShipments} />
                        </div>

                        {/* Row 4: Meetings + Priority + Shipment Timelines */}
                        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
                            <div className="xl:col-span-1 space-y-4">
                                <UpcomingMeetings />
                                <PriorityTasks />
                            </div>
                            <div className="xl:col-span-3 grid grid-cols-1 lg:grid-cols-3 gap-4">
                                <ShipmentTable shipments={normalizedOngoingShipments} label="On-going Shipments" />
                                <ShipmentTable shipments={normalizedUpcoming30} label="Upcoming (30 Days)" />
                                <ShipmentTable shipments={normalizedUpcoming60} label="Upcoming (60 Days)" />
                            </div>
                        </div>

                        {/* Row 5: Stock Inventory */}
                        <StockInventory sources={filteredSources} />
                    </>)}
            </div>
        </AppShell>
    );
}
