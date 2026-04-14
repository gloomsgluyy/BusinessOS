"use client";

import React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useCommercialStore } from "@/store/commercial-store";
import { useAuthStore } from "@/store/auth-store";
import { SALES_DEAL_STATUSES, COUNTRIES, COAL_SPEC_FIELDS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { SalesDeal, SalesDealStatus } from "@/types";
import {
    TrendingUp, Plus, Search, X,
    Ship, Package, Eye, Download, Loader2,
    DollarSign, Pencil, Trash2
} from "lucide-react";
import { ReportModal } from "@/components/shared/report-modal";
import { Toast } from "@/components/shared/toast";

const parseLooseNumber = (value: unknown): number => {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (value === null || value === undefined) return 0;
    let raw = String(value).trim();
    if (!raw) return 0;
    raw = raw.replace(/rp|\$|usd|idr|mt|\s/gi, "");
    raw = raw.replace(/[^\d,.\-]/g, "");
    if (!raw || raw === "-" || raw === "." || raw === ",") return 0;

    const hasDot = raw.includes(".");
    const hasComma = raw.includes(",");
    if (hasDot && hasComma) {
        if (raw.lastIndexOf(".") > raw.lastIndexOf(",")) raw = raw.replace(/,/g, "");
        else raw = raw.replace(/\./g, "").replace(",", ".");
    } else if (hasComma && !hasDot) {
        raw = /,\d{1,2}$/.test(raw) ? raw.replace(",", ".") : raw.replace(/,/g, "");
    } else if (hasDot && !hasComma) {
        raw = /\.\d{1,2}$/.test(raw) ? raw : raw.replace(/\./g, "");
    }
    const num = Number.parseFloat(raw);
    return Number.isFinite(num) ? num : 0;
};

const safeNum = (v: unknown): number => parseLooseNumber(v);
const safeFmt = (v: number | null | undefined, decimals = 2): string => safeNum(v).toFixed(decimals);
const cleanText = (v?: string | null): string => (v || "").replace(/\s+/g, " ").trim();
const normalizeKey = (v?: string | null): string => cleanText(v).toUpperCase();

const extractProjectName = (raw?: string | null): string | null => {
    const text = cleanText(raw);
    if (!text) return null;
    const explicit = text.match(/project\s*:\s*([^\n\r]+)/i);
    if (explicit?.[1]) return cleanText(explicit[1]);
    const code = text.match(/\b([A-Z]{2,}[A-Z0-9_.\-\/]*_\d{2})\b/i);
    if (code?.[1]) return cleanText(code[1]);
    return null;
};

type ProjectSalesStatus =
    | "waiting_approval"
    | "waiting_buyer"
    | "offer_submitted"
    | "confirmed"
    | "in_transit"
    | "completed"
    | "cancelled"
    | "rejected";

const PROJECT_SALES_STATUS_META: Record<ProjectSalesStatus, { label: string; color: string }> = {
    waiting_approval: { label: "Waiting Approval", color: "#f59e0b" },
    waiting_buyer: { label: "Waiting Buyer", color: "#6b7280" },
    offer_submitted: { label: "Offer Submitted", color: "#3b82f6" },
    confirmed: { label: "Confirmed", color: "#10b981" },
    in_transit: { label: "In Transit / Loading", color: "#6366f1" },
    completed: { label: "Completed", color: "#059669" },
    cancelled: { label: "Cancelled", color: "#ef4444" },
    rejected: { label: "Rejected", color: "#f43f5e" },
};

export default function SalesMonitorPage() {
    const [, setIsInitializing] = React.useState(false);
    const formRef = React.useRef<HTMLDivElement | null>(null);

    const { deals, syncFromMemory, addDeal, updateDeal, deleteDeal, shipments, projects } = useCommercialStore();

    React.useEffect(() => {
        syncFromMemory().finally(() => setIsInitializing(false));
    }, [syncFromMemory]);
    const { currentUser } = useAuthStore();
    const [projectTab, setProjectTab] = React.useState<ProjectSalesStatus | "all">("all");
    const [search, setSearch] = React.useState("");
    const [showForm, setShowForm] = React.useState(false);
    const [editingDealId, setEditingDealId] = React.useState<string | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);
    const [toast, setToast] = React.useState<{ message: string; type: "success" | "error" } | null>(null);
    const [detailDeal, setDetailDeal] = React.useState<SalesDeal | null>(null);
    const [showReportModal, setShowReportModal] = React.useState(false);

    // Form state
    const [form, setForm] = React.useState({
        project_name: "",
        status: "pre_sale" as SalesDealStatus,
        buyer: "", buyer_country: "Indonesia", type: "local" as "local" | "export",
        shipping_terms: "FOB" as any, quantity: 0, price_per_mt: 0,
        laycan_start: "", laycan_end: "", vessel_name: "",
        gar: 4200, ts: 0.8, ash: 5.0, tm: 30, notes: "",
    });

    const filteredDeals = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        return deals.filter((d) => {
            if (!q) return true;
            return [
                d.buyer,
                d.deal_number,
                d.vessel_name,
                d.project_id,
                d.buyer_country,
            ].some((x) => (x || "").toLowerCase().includes(q));
        });
    }, [deals, search]);

    const projectMonitoring = React.useMemo(() => {
        type Roll = {
            projectKey: string;
            projectName: string;
            buyer: string;
            segment: string;
            masterStatus: string;
            salesStatus: ProjectSalesStatus;
            shipmentCount: number;
            dealCount: number;
            qty: number;
            revenue: number;
            mvName: string;
            priceSamples: number[];
        };

        const statusKey = (s?: string | null) => normalizeKey(s);
        const resolveShipmentProject = (s: any): string => (
            extractProjectName(s.mv_project_name) ||
            extractProjectName(s.vessel_name) ||
            cleanText(s.mv_project_name) ||
            cleanText(s.vessel_name) ||
            cleanText(s.shipment_number) ||
            "Unmapped Project"
        );
        const resolveDealProject = (d: SalesDeal): string => (
            cleanText(d.project_id) ||
            extractProjectName(d.vessel_name) ||
            cleanText(d.vessel_name) ||
            cleanText(d.deal_number) ||
            "Unmapped Project"
        );
        const shipStatusPriority = (rows: any[]): ProjectSalesStatus | null => {
            const joined = rows.map((r) => statusKey(r.status || r.shipment_status)).join(" ");
            if (joined.includes("CANCEL")) return "cancelled";
            if (joined.includes("LOADING") || joined.includes("TRANSIT")) return "in_transit";
            if (joined.includes("COMPLETE") || joined.includes("DONE_SHIPMENT") || joined.includes("DISCHARGE")) return "completed";
            return null;
        };

        const map = new Map<string, Roll>();
        const ensure = (key: string, fallbackName: string): Roll => {
            const existing = map.get(key);
            if (existing) return existing;
            const seed: Roll = {
                projectKey: key,
                projectName: fallbackName,
                buyer: "-",
                segment: "-",
                masterStatus: "",
                salesStatus: "waiting_buyer",
                shipmentCount: 0,
                dealCount: 0,
                qty: 0,
                revenue: 0,
                mvName: "-",
                priceSamples: [],
            };
            map.set(key, seed);
            return seed;
        };

        projects.forEach((p) => {
            const key = normalizeKey(p.name);
            if (!key) return;
            const row = ensure(key, cleanText(p.name) || "Unmapped Project");
            row.projectName = cleanText(p.name) || row.projectName;
            row.buyer = cleanText(p.buyer) || row.buyer;
            row.segment = cleanText(p.segment) || row.segment;
            row.masterStatus = cleanText(p.status) || row.masterStatus;
        });

        shipments.forEach((s: any) => {
            const derivedName = resolveShipmentProject(s);
            const key = normalizeKey(derivedName);
            if (!key) return;
            const row = ensure(key, derivedName);
            const qty = safeNum(s.qty_plan || s.quantity_loaded || s.qty_cob);
            const price = safeNum(s.sales_price || s.harga_actual_fob_mv || s.harga_actual_fob || s.sp || s.hpb);
            row.shipmentCount += 1;
            row.qty += qty;
            row.revenue += qty * price;
            if (price > 0) row.priceSamples.push(price);
            if (row.buyer === "-" && cleanText(s.buyer)) row.buyer = cleanText(s.buyer);
            if (row.mvName === "-" && cleanText(s.vessel_name || s.mv_project_name)) row.mvName = cleanText(s.vessel_name || s.mv_project_name);
        });

        const unmatchedDeals: SalesDeal[] = [];
        deals.forEach((d) => {
            const derivedName = resolveDealProject(d);
            const key = normalizeKey(derivedName);
            if (!key) return;
            const row = map.get(key);
            if (!row) {
                unmatchedDeals.push(d);
                return;
            }
            row.dealCount += 1;
            row.qty += safeNum(d.quantity);
            row.revenue += safeNum(d.quantity) * safeNum(d.price_per_mt);
            if (row.buyer === "-" && cleanText(d.buyer)) row.buyer = cleanText(d.buyer);
            if (row.mvName === "-" && cleanText(d.vessel_name)) row.mvName = cleanText(d.vessel_name);
        });

        // Fallback match unmatched deals by buyer + vessel similarity.
        unmatchedDeals.forEach((d) => {
            const buyerKey = normalizeKey(d.buyer);
            const vesselKey = normalizeKey(d.vessel_name);
            const candidates = Array.from(map.values()).filter((r) => normalizeKey(r.buyer) === buyerKey);
            if (!candidates.length) return;
            let target = candidates[0];
            if (vesselKey) {
                const byVessel = candidates.find((r) => normalizeKey(r.mvName).includes(vesselKey) || vesselKey.includes(normalizeKey(r.mvName)));
                if (byVessel) target = byVessel;
            }
            target.dealCount += 1;
            target.qty += safeNum(d.quantity);
            target.revenue += safeNum(d.quantity) * safeNum(d.price_per_mt);
            if (target.mvName === "-" && cleanText(d.vessel_name)) target.mvName = cleanText(d.vessel_name);
        });

        const globalPriceSamples = Array.from(map.values()).flatMap((r) => r.priceSamples);
        const globalFallbackPrice = globalPriceSamples.length
            ? globalPriceSamples.reduce((a, b) => a + b, 0) / globalPriceSamples.length
            : 45;

        const rolls = Array.from(map.values()).map((r) => {
            if (r.revenue > 0 || r.qty <= 0) return r;
            const localFallback = r.priceSamples.length
                ? r.priceSamples.reduce((a, b) => a + b, 0) / r.priceSamples.length
                : globalFallbackPrice;
            return { ...r, revenue: r.qty * localFallback };
        });
        return rolls.map((row) => {
            const master = statusKey(row.masterStatus);
            const dealRows = deals.filter((d) => {
                const dKey = normalizeKey(resolveDealProject(d));
                return dKey && dKey === row.projectKey;
            });
            const shipRows = shipments.filter((s: any) => {
                const sKey = normalizeKey(resolveShipmentProject(s));
                return sKey && sKey === row.projectKey;
            });

            let salesStatus: ProjectSalesStatus = "waiting_buyer";
            if (master.includes("WAITING") || master.includes("PENDING_APPROVAL")) salesStatus = "waiting_approval";
            else if (master.includes("REJECT")) salesStatus = "rejected";
            else {
                const shipmentStatus = shipStatusPriority(shipRows);
                if (shipmentStatus) salesStatus = shipmentStatus;
                else if (dealRows.some((d) => d.status === "confirmed")) salesStatus = "confirmed";
                else if (dealRows.some((d) => d.status === "pre_sale" || d.status === "forecast")) salesStatus = "offer_submitted";
                else if (row.buyer === "-" || !cleanText(row.buyer)) salesStatus = "waiting_buyer";
            }

            return { ...row, salesStatus };
        }).sort((a, b) => b.qty - a.qty);
    }, [projects, shipments, deals]);

    const filteredProjectMonitoring = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        return projectMonitoring.filter((p) => {
            if (projectTab !== "all" && p.salesStatus !== projectTab) return false;
            if (!q) return true;
            return [p.projectName, p.buyer, p.segment, p.mvName].some((x) => (x || "").toLowerCase().includes(q));
        });
    }, [projectMonitoring, projectTab, search]);

    const projectOptions = React.useMemo(() => {
        const bag = new Set<string>();
        projects.forEach((p) => {
            const name = cleanText(p.name);
            if (name) bag.add(name);
        });
        shipments.forEach((s: any) => {
            const name =
                extractProjectName(s.mv_project_name) ||
                extractProjectName(s.vessel_name) ||
                cleanText(s.mv_project_name) ||
                cleanText(s.vessel_name);
            if (name) bag.add(name);
        });
        return Array.from(bag).sort((a, b) => a.localeCompare(b));
    }, [projects, shipments]);

    const summary = React.useMemo(() => {
        const revenue = projectMonitoring.reduce((sum, p) => sum + safeNum(p.revenue), 0);
        const volume = projectMonitoring.reduce((sum, p) => sum + safeNum(p.qty), 0);
        const activeShipments = shipments.filter((s: any) => {
            const st = normalizeKey(s.status || s.shipment_status);
            return !st.includes("COMPLETE") && !st.includes("DONE") && !st.includes("CANCEL");
        }).length;
        const unitPrices = shipments
            .map((s: any) => safeNum(s.sales_price || s.harga_actual_fob_mv || s.harga_actual_fob || s.sp || s.hpb))
            .filter((n) => n > 0);
        const avgMargin = unitPrices.length ? unitPrices.reduce((a, b) => a + b, 0) / unitPrices.length - 45 : 0;
        return { revenue, volume, activeShipments, avgMargin };
    }, [projectMonitoring, shipments]);

    const handleSubmit = async () => {
        if (!form.project_name || !form.buyer || form.quantity <= 0) {
            setToast({ message: "Please fill project, buyer, and quantity", type: "error" });
            return;
        }
        setIsSaving(true);
        try {
            const payload = {
                status: form.status,
                project_id: form.project_name,
                buyer: form.buyer,
                buyer_country: form.buyer_country,
                type: form.type,
                shipping_terms: form.shipping_terms,
                quantity: form.quantity,
                price_per_mt: form.price_per_mt,
                laycan_start: form.laycan_start,
                laycan_end: form.laycan_end,
                vessel_name: form.vessel_name,
                spec: { gar: form.gar, ts: form.ts, ash: form.ash, tm: form.tm },
                notes: form.notes,
                created_by: currentUser?.id || "system",
                created_by_name: currentUser?.name || "System",
            } as any;

            if (editingDealId) {
                await updateDeal(editingDealId, payload);
                setToast({ message: "Sales deal updated successfully!", type: "success" });
            } else {
                await addDeal(payload);
                setToast({ message: "Sales deal created successfully!", type: "success" });
            }
            setShowForm(false);
            setEditingDealId(null);
            setForm({
                project_name: "",
                status: "pre_sale",
                buyer: "", buyer_country: "Indonesia", type: "local",
                shipping_terms: "FOB" as any, quantity: 0, price_per_mt: 0,
                laycan_start: "", laycan_end: "", vessel_name: "",
                gar: 4200, ts: 0.8, ash: 5.0, tm: 30, notes: "",
            });
        } catch (error) {
            setToast({ message: "Failed to create sales deal", type: "error" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleEditDeal = (deal: SalesDeal) => {
        setEditingDealId(deal.id);
        setShowForm(true);
        setForm({
            project_name: cleanText(deal.project_id) || "",
            status: (deal.status || "pre_sale") as SalesDealStatus,
            buyer: deal.buyer || "",
            buyer_country: deal.buyer_country || "Indonesia",
            type: (deal.type || "local") as "local" | "export",
            shipping_terms: (deal.shipping_terms || "FOB") as any,
            quantity: safeNum(deal.quantity),
            price_per_mt: safeNum(deal.price_per_mt),
            laycan_start: deal.laycan_start || "",
            laycan_end: deal.laycan_end || "",
            vessel_name: deal.vessel_name || "",
            gar: safeNum((deal.spec as any)?.gar) || 4200,
            ts: safeNum((deal.spec as any)?.ts) || 0.8,
            ash: safeNum((deal.spec as any)?.ash) || 5,
            tm: safeNum((deal.spec as any)?.tm) || 30,
            notes: deal.notes || "",
        });
    };

    const handleDeleteDeal = async (dealId: string) => {
        if (!window.confirm("Delete this sales deal?")) return;
        setIsSaving(true);
        try {
            await deleteDeal(dealId);
            setToast({ message: "Sales deal deleted", type: "success" });
        } catch {
            setToast({ message: "Failed to delete sales deal", type: "error" });
        } finally {
            setIsSaving(false);
        }
    };

    React.useEffect(() => {
        if (!showForm) return;
        requestAnimationFrame(() => {
            formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    }, [showForm]);


    return (
        <AppShell>
            <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6">
                {/* Module Summary */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fade-in relative z-20">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Sales Monitor</h1>
                        <p className="text-sm text-muted-foreground mt-1">Project-centric sales monitoring with deal-level tracking.</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => { setEditingDealId(null); setShowForm(true); }} className="btn-primary h-9"><Plus className="w-4 h-4 mr-1.5" /> New Sales Entry</button>
                        <button onClick={() => setShowReportModal(true)} className="btn-outline text-xs h-9 hidden sm:flex"><Download className="w-3.5 h-3.5 mr-1.5" /> Download Report</button>
                    </div>
                </div>

                {/* Metrics Summary Header (Moved from Sales Plan) */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up relative z-10">
                    <div className="card-elevated p-5 relative overflow-hidden group border-l-4 border-emerald-500">
                        <div className="flex items-center gap-2 text-muted-foreground mb-3">
                            <DollarSign className="w-4 h-4 text-emerald-500" />
                            <span className="text-[10px] font-bold uppercase">Estimated Revenue</span>
                        </div>
                        <p className="text-2xl font-bold font-mono text-emerald-500">${Math.round(summary.revenue).toLocaleString()}</p>
                    </div>
                    <div className="card-elevated p-5 relative overflow-hidden group border-l-4 border-blue-500">
                        <div className="flex items-center gap-2 text-muted-foreground mb-3">
                            <Package className="w-4 h-4 text-blue-500" />
                            <span className="text-[10px] font-bold uppercase">Total Volume (MT)</span>
                        </div>
                        <p className="text-2xl font-bold font-mono">{Math.round(summary.volume).toLocaleString()}</p>
                    </div>
                    <div className="card-elevated p-5 relative overflow-hidden group border-l-4 border-amber-500">
                        <div className="flex items-center gap-2 text-muted-foreground mb-3">
                            <Ship className="w-4 h-4 text-amber-500" />
                            <span className="text-[10px] font-bold uppercase">Active Shipments</span>
                        </div>
                        <p className="text-2xl font-bold font-mono text-amber-500">{summary.activeShipments}</p>
                    </div>
                    <div className="card-elevated p-5 relative overflow-hidden group border-l-4 border-violet-500">
                        <div className="flex items-center gap-2 text-muted-foreground mb-3">
                            <TrendingUp className="w-4 h-4 text-violet-500" />
                            <span className="text-[10px] font-bold uppercase">Avg Margin/MT</span>
                        </div>
                        <p className="text-2xl font-bold font-mono text-violet-400">${safeFmt(Math.max(0, summary.avgMargin))}</p>
                    </div>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search project, buyer, vessel..."
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-accent/50 border border-border text-sm outline-none focus:border-primary/50 transition-colors" />
                </div>

                {/* Project-Centric Sales Monitoring */}
                <div className="card-elevated p-4 md:p-5 space-y-4 animate-slide-up">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-semibold">Project Sales Monitoring</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">Status sales per project (base on Project + Shipment + Deal)</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={() => setProjectTab("all")}
                                className={cn("filter-chip", projectTab === "all" ? "filter-chip-active" : "filter-chip-inactive")}
                            >
                                All ({projectMonitoring.length})
                            </button>
                            {(Object.keys(PROJECT_SALES_STATUS_META) as ProjectSalesStatus[]).map((st) => (
                                <button
                                    key={st}
                                    onClick={() => setProjectTab(st)}
                                    className={cn("filter-chip", projectTab === st ? "filter-chip-active" : "filter-chip-inactive")}
                                >
                                    {PROJECT_SALES_STATUS_META[st].label} ({projectMonitoring.filter((p) => p.salesStatus === st).length})
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-accent/20">
                                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Project</th>
                                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Buyer / Segment</th>
                                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Sales Status</th>
                                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Deals</th>
                                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Shipments</th>
                                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Volume (MT)</th>
                                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Revenue</th>
                                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredProjectMonitoring.map((p) => {
                                    const st = PROJECT_SALES_STATUS_META[p.salesStatus];
                                    return (
                                        <tr key={p.projectKey} className="border-b border-border/40 hover:bg-accent/20 transition-colors">
                                            <td className="px-3 py-2">
                                                <p className="text-xs font-semibold text-primary">{p.projectName}</p>
                                                <p className="text-[10px] text-muted-foreground">{p.mvName || "-"}</p>
                                            </td>
                                            <td className="px-3 py-2">
                                                <p className="text-xs">{p.buyer || "-"}</p>
                                                <p className="text-[10px] text-muted-foreground">{p.segment || "-"}</p>
                                            </td>
                                            <td className="px-3 py-2">
                                                <span className="status-badge text-[10px]" style={{ color: st.color, backgroundColor: `${st.color}15` }}>
                                                    {st.label}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-right text-xs font-semibold">{p.dealCount}</td>
                                            <td className="px-3 py-2 text-right text-xs font-semibold">{p.shipmentCount}</td>
                                            <td className="px-3 py-2 text-right text-xs font-semibold">{Math.round(p.qty).toLocaleString()}</td>
                                            <td className="px-3 py-2 text-right text-xs font-semibold">${Math.round(p.revenue).toLocaleString()}</td>
                                            <td className="px-3 py-2 text-right">
                                                <a href={`/projects?q=${encodeURIComponent(p.projectName)}`} className="text-[11px] text-primary hover:underline font-semibold">
                                                    View
                                                </a>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {filteredProjectMonitoring.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">No project monitoring rows matched your filters.</p>
                    )}
                </div>

                {/* New Deal Form (Rich Fields) */}
                {showForm && (
                    <div ref={formRef} className="card-elevated p-5 space-y-4 animate-scale-in border border-primary/20 bg-primary/5">
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-semibold text-primary">{editingDealId ? "Edit Sales Deal" : "Add New Sales Deal"}</h3>
                            <button onClick={() => { setShowForm(false); setEditingDealId(null); }} className="p-1 rounded-lg hover:bg-accent"><X className="w-4 h-4" /></button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="space-y-1 md:col-span-2">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase">Project Name</label>
                                <input
                                    list="sales-project-options"
                                    value={form.project_name}
                                    onChange={e => setForm({ ...form, project_name: e.target.value })}
                                    placeholder="Type/select project name"
                                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs outline-none focus:border-primary/50"
                                />
                                <datalist id="sales-project-options">
                                    {projectOptions.map((name) => (
                                        <option key={name} value={name} />
                                    ))}
                                </datalist>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase">Sales Status</label>
                                <select
                                    value={form.status}
                                    onChange={e => setForm({ ...form, status: e.target.value as SalesDealStatus })}
                                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs outline-none"
                                >
                                    <option value="pre_sale">Pre-Sale</option>
                                    <option value="confirmed">Confirmed</option>
                                    <option value="forecast">Forecast</option>
                                </select>
                            </div>
                            <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Buyer Name</label>
                                <input value={form.buyer} onChange={e => setForm({ ...form, buyer: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs outline-none focus:border-primary/50" /></div>

                            <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Country</label>
                                <select value={form.buyer_country} onChange={e => setForm({ ...form, buyer_country: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs outline-none">
                                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select></div>

                            <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Type</label>
                                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as any })} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs outline-none">
                                    <option value="export">Export</option><option value="local">Local</option>
                                </select></div>

                            <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Shipping Terms</label>
                                <select value={form.shipping_terms} onChange={e => setForm({ ...form, shipping_terms: e.target.value as any })} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs outline-none">
                                    <option value="FOB">FOB</option><option value="CIF">CIF</option><option value="CFR">CFR</option>
                                </select></div>

                            <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Quantity (MT)</label>
                                <input type="number" value={form.quantity || ""} onChange={e => setForm({ ...form, quantity: +e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs outline-none" /></div>

                            <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Price / MT (USD)</label>
                                <input type="number" step="0.5" value={form.price_per_mt || ""} onChange={e => setForm({ ...form, price_per_mt: +e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs outline-none" /></div>

                            <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Laycan Start</label>
                                <input type="date" value={form.laycan_start} onChange={e => setForm({ ...form, laycan_start: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs outline-none" /></div>

                            <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Vessel Name</label>
                                <input value={form.vessel_name} onChange={e => setForm({ ...form, vessel_name: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs outline-none" placeholder="TBN" /></div>
                        </div>

                        <div className="pt-2 border-t border-border/50">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase mb-2 block">Specifications (Target Quality)</label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="space-y-1"><label className="text-[10px] font-semibold text-muted-foreground">GAR</label>
                                    <input type="number" value={form.gar} onChange={e => setForm({ ...form, gar: +e.target.value })} className="w-full px-2 py-1.5 rounded-lg bg-background border border-border text-xs" /></div>
                                <div className="space-y-1"><label className="text-[10px] font-semibold text-muted-foreground">TS (%)</label>
                                    <input type="number" step="0.01" value={form.ts} onChange={e => setForm({ ...form, ts: +e.target.value })} className="w-full px-2 py-1.5 rounded-lg bg-background border border-border text-xs" /></div>
                                <div className="space-y-1"><label className="text-[10px] font-semibold text-muted-foreground">ASH (%)</label>
                                    <input type="number" step="0.1" value={form.ash} onChange={e => setForm({ ...form, ash: +e.target.value })} className="w-full px-2 py-1.5 rounded-lg bg-background border border-border text-xs" /></div>
                                <div className="space-y-1"><label className="text-[10px] font-semibold text-muted-foreground">TM (%)</label>
                                    <input type="number" step="0.1" value={form.tm} onChange={e => setForm({ ...form, tm: +e.target.value })} className="w-full px-2 py-1.5 rounded-lg bg-background border border-border text-xs" /></div>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button onClick={handleSubmit} className="btn-primary" disabled={isSaving}>
                                {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : <>{editingDealId ? <><Pencil className="w-4 h-4 mr-1" /> Update Deal</> : <><Plus className="w-4 h-4 mr-1" /> Save Deal</>}</>}
                            </button>
                            <button
                                onClick={() => {
                                    setShowForm(false);
                                    setEditingDealId(null);
                                }}
                                className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors"
                                disabled={isSaving}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Deals Table */}
                <div className="card-elevated overflow-hidden animate-slide-up">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-accent/30">
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Project</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Buyer</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Qty (MT)</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Price / MT</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Revenue</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Laycan</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Status</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredDeals.map((d) => {
                                    const stCfg = SALES_DEAL_STATUSES.find((s) => s.value === d.status);
                                    const qty = safeNum(d.quantity);
                                    const price = safeNum(d.price_per_mt);
                                    const revenue = qty * price;
                                    return (
                                        <tr key={d.id} className="border-b border-border/50 hover:bg-accent/20 transition-colors">
                                            <td className="px-4 py-3">
                                                <p className="font-semibold text-xs text-primary">{cleanText(d.project_id) || "-"}</p>
                                                <p className="text-[10px] text-muted-foreground">{cleanText(d.vessel_name) || "-"}</p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="font-semibold text-xs text-primary">{d.buyer}</p>
                                                <p className="text-[10px] text-muted-foreground">{d.deal_number} • {d.buyer_country}</p>
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-xs font-semibold">{qty.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right font-mono text-xs font-semibold">${price.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right font-mono text-xs font-semibold">${Math.round(revenue).toLocaleString()}</td>
                                            <td className="px-4 py-3 text-xs text-muted-foreground">{d.laycan_start || "-"}</td>
                                            <td className="px-4 py-3">
                                                <span className="status-badge text-[10px]" style={{ color: stCfg?.color, backgroundColor: `${stCfg?.color}15` }}>
                                                    {stCfg?.label.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <select
                                                        value={d.status}
                                                        onChange={(e) => useCommercialStore.getState().updateDealStatus(d.id, e.target.value as any)}
                                                        className="text-[10px] font-bold bg-accent/50 border border-border rounded-md px-2 py-1 outline-none focus:border-primary/50 cursor-pointer appearance-none hover:bg-accent transition-colors"
                                                    >
                                                        <option value="pre_sale">PRE-SALE</option>
                                                        <option value="confirmed">CONFIRMED</option>
                                                        <option value="forecast">FORECAST</option>
                                                    </select>
                                                    <button onClick={() => handleEditDeal(d)} className="p-1.5 rounded-lg hover:bg-accent transition-colors" title="Edit Deal">
                                                        <Pencil className="w-4 h-4 text-muted-foreground" />
                                                    </button>
                                                    <button onClick={() => setDetailDeal(d)} className="p-1.5 rounded-lg hover:bg-accent transition-colors" title="View Detail">
                                                        <Eye className="w-4 h-4 text-muted-foreground" />
                                                    </button>
                                                    <button onClick={() => handleDeleteDeal(d.id)} className="p-1.5 rounded-lg hover:bg-accent transition-colors" title="Delete Deal">
                                                        <Trash2 className="w-4 h-4 text-red-400" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {filteredDeals.length === 0 && <p className="text-center text-sm text-muted-foreground py-12">No sales deals matched your filters.</p>}
                </div>

                {/* Detail Modal */}
                {detailDeal && (
                    <div className="modal-overlay">
                        <div className="modal-backdrop" onClick={() => setDetailDeal(null)} />
                        <div className="modal-content bg-card border border-border rounded-xl shadow-lg p-6 max-w-lg w-full">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-lg font-bold">{detailDeal.buyer}</h2>
                                    <p className="text-xs text-muted-foreground font-mono">{detailDeal.deal_number}</p>
                                </div>
                                <button onClick={() => setDetailDeal(null)} className="p-1 rounded-lg hover:bg-accent"><X className="w-4 h-4" /></button>
                            </div>

                            <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                                {[
                                    ["Status", detailDeal.status.toUpperCase()],
                                    ["Type", detailDeal.type.toUpperCase()],
                                    ["Shipping Terms", detailDeal.shipping_terms],
                                    ["Buyer Country", detailDeal.buyer_country || "-"],
                                    ["Quantity", `${detailDeal.quantity?.toLocaleString()} MT`],
                                    ["Price / MT", `$${detailDeal.price_per_mt?.toLocaleString()}`],
                                    ["Vessel", detailDeal.vessel_name || "TBN"],
                                    ["Laycan POL", detailDeal.laycan_start || "-"],
                                ].map(([k, v]) => (
                                    <div key={k} className="border-b border-border/30 pb-1.5">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase mb-0.5">{k}</p>
                                        <p className="font-semibold">{v}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-6 pt-4 border-t border-border/50">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-3">Technical Specifications</p>
                                <div className="grid grid-cols-4 gap-2">
                                    {COAL_SPEC_FIELDS.map(f => {
                                        const val = (detailDeal.spec as any)?.[f.key];
                                        if (val === undefined || val === null) return null;
                                        return (
                                            <div key={f.key} className="p-2 rounded-lg bg-accent/30 text-center">
                                                <p className="text-[10px] font-bold text-muted-foreground">{f.label}</p>
                                                <p className="text-xs font-bold">{val}{f.unit}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <ReportModal
                    isOpen={showReportModal}
                    onClose={() => setShowReportModal(false)}
                    moduleName="Sales Monitor"
                    onExport={(format, options) => {
                        console.log(`Exporting sales data as ${format}`, options);
                        setToast({ message: `Exporting as ${format.toUpperCase()}...`, type: "success" });
                    }}
                />
                {toast && (
                    <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
                )}
            </div>
        </AppShell>
    );
}
