"use client";

import React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useSession } from "next-auth/react";
import { useCommercialStore } from "@/store/commercial-store";
import { useRouter } from "next/navigation";
import { DollarSign, TrendingUp, TrendingDown, Activity, Percent, Plus, X, Loader2, Edit3, Trash2, RefreshCw } from "lucide-react";
import { Toast } from "@/components/shared/toast";
import { cn } from "@/lib/utils";
import { PLForecastItem, ShipmentDetail } from "@/types";

const safeNum = (v: number | null | undefined): number => (v != null && !isNaN(v) ? v : 0);
const safeFmt = (v: number | null | undefined, decimals = 2): string => safeNum(v).toFixed(decimals);
const parseLooseNum = (v: unknown): number => {
    if (v === null || v === undefined) return 0;
    const raw = String(v).replace(/[^0-9.\-]/g, "");
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
};

const formatCurrency = (n: number) => `$${safeNum(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

const normalizeKey = (v?: string | null): string =>
    (v || "").toUpperCase().replace(/\s+/g, " ").trim();

const cleanText = (v?: string | null): string | null => {
    if (!v) return null;
    const t = String(v).replace(/\s+/g, " ").trim();
    return t || null;
};

const firstLine = (v?: string | null): string => {
    if (!v) return "";
    return String(v).split(/\r?\n/)[0]?.trim() || "";
};

const extractProjectName = (raw?: string | null): string | null => {
    const text = cleanText(raw);
    if (!text) return null;
    const explicit = text.match(/project\s*:\s*([^\n\r]+)/i);
    if (explicit?.[1]) return cleanText(explicit[1]);
    const code = text.match(/\b([A-Z]{2,}[A-Z0-9_.\-\/]*_\d{2})\b/i);
    if (code?.[1]) return cleanText(code[1]);
    return null;
};

const extractMVName = (raw?: string | null): string | null => {
    const line = firstLine(raw);
    if (!line) return null;
    const mv = line.match(/(MV\.?\s*[A-Z0-9 .\-\/]+?)(?:\s+OR\s+SUBS.*)?$/i);
    if (mv?.[1]) return cleanText(mv[1]);
    return cleanText(line);
};

const shipmentProjectName = (sh: ShipmentDetail): string =>
    extractProjectName(sh.mv_project_name) ||
    extractProjectName(sh.vessel_name) ||
    extractMVName(sh.mv_project_name) ||
    extractMVName(sh.vessel_name) ||
    cleanText(sh.mv_project_name) ||
    cleanText(sh.vessel_name) ||
    "Unmapped Project";

const shipmentType = (sh: ShipmentDetail): "local" | "export" => {
    const t = normalizeKey(sh.type || sh.export_dmo || "");
    if (t.includes("LOCAL") || t.includes("DMO") || t.includes("DOMESTIC")) return "local";
    return "export";
};

export default function PLForecastClient() {
    const [, setIsInitializing] = React.useState(false);

    const { data: session, status } = useSession();
    const router = useRouter();
    const { plForecasts, addPLForecast, updatePLForecast, deletePLForecast, deals, shipments, syncFromMemory } = useCommercialStore();

    const userRole = session?.user?.role?.toLowerCase() || "";
    const allowedRoles = ["ceo", "director", "operation", "marketing", "purchasing"];
    const hasAccess = allowedRoles.includes(userRole);
    const isHighLevel = ["ceo", "director"].includes(userRole);

    React.useEffect(() => {
        Promise.all([
            syncFromMemory()
        ]).finally(() => setIsInitializing(false));
    }, [hasAccess, router, syncFromMemory, status]);

    const [showForm, setShowForm] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [isSyncing, setIsSyncing] = React.useState(false);
    const [toast, setToast] = React.useState<{ message: string; type: "success" | "error" } | null>(null);
    const [editingId, setEditingId] = React.useState<string | null>(null);

    const [form, setForm] = React.useState({
        deal_id: "",
        deal_number: "",
        project_name: "",
        mv_name: "",
        buyer: "",
        type: "",
        quantity: 0,
        selling_price: 0,
        buying_price: 0,
        freight_cost: 0,
        other_cost: 0,
    });

    const handleAddOrUpdate = async () => {
        console.log("handleAddOrUpdate started", { editingId, form });
        setIsSaving(true);
        try {
            if (editingId) {
                console.log("Calling updatePLForecast", editingId);
                await updatePLForecast(editingId, {
                    project_name: form.project_name,
                    buying_price: form.buying_price,
                    freight_cost: form.freight_cost,
                    other_cost: form.other_cost,
                });
                console.log("Update successful");
                setToast({ message: "Costs updated successfully!", type: "success" });
            } else {
                const projectKey = normalizeKey(form.project_name);
                const existingByProject = manualForecastByProject.get(projectKey);
                if (existingByProject) {
                    await updatePLForecast(existingByProject.id, {
                        project_name: form.project_name,
                        buying_price: form.buying_price,
                        freight_cost: form.freight_cost,
                        other_cost: form.other_cost,
                        quantity: form.quantity,
                        selling_price: form.selling_price,
                    });
                    setToast({ message: "Existing project cost updated!", type: "success" });
                } else {
                    console.log("Calling addPLForecast", form);
                    await addPLForecast({
                        deal_id: form.deal_id,
                        deal_number: form.deal_number || form.project_name,
                        project_name: form.project_name,
                        buyer: form.buyer,
                        type: form.type as "local" | "export",
                        quantity: form.quantity,
                        selling_price: form.selling_price,
                        buying_price: form.buying_price,
                        freight_cost: form.freight_cost,
                        other_cost: form.other_cost,
                        status: "forecast",
                        created_by: session?.user?.id || "system",
                    });
                    console.log("Create successful");
                    setToast({ message: "P&L Forecast created!", type: "success" });
                }
            }
            setShowForm(false);
            resetForm();
        } catch (error) {
            console.error("handleAddOrUpdate error:", error);
            setToast({ message: `Failed to ${editingId ? "update" : "create"} forecast`, type: "error" });
        } finally {
            setIsSaving(false);
            console.log("handleAddOrUpdate finished");
        }
    };

    const resetForm = () => {
        setForm({
            deal_id: "",
            deal_number: "",
            project_name: "",
            mv_name: "",
            buyer: "",
            type: "",
            quantity: 0,
            selling_price: 0,
            buying_price: 0,
            freight_cost: 0,
            other_cost: 0
        });
        setEditingId(null);
    };

    const handleManualSync = async () => {
        setIsSyncing(true);
        try {
            await syncFromMemory();
            setToast({ message: "Data synced successfully from Google Sheets!", type: "success" });
        } catch (error) {
            console.error("Manual sync error:", error);
            setToast({ message: "Failed to sync data", type: "error" });
        } finally {
            setIsSyncing(false);
        }
    };

    const handleEdit = (f: PLForecastItem) => {
        const ctxProject =
            cleanText(f.project_name) ||
            cleanText(f.deal_number) ||
            (cleanText(f.buyer) ? `Buyer - ${cleanText(f.buyer)}` : `Forecast - ${f.id.slice(-6).toUpperCase()}`);
        const shipmentCtx = shipmentByProject.get(normalizeKey(ctxProject));
        const isDerived = f.id.startsWith("derived:");
        setForm({
            deal_id: f.deal_id,
            deal_number: f.deal_number,
            project_name: ctxProject,
            mv_name: shipmentCtx?.mvName || "-",
            buyer: f.buyer,
            type: f.type,
            quantity: f.quantity,
            selling_price: f.selling_price,
            buying_price: f.buying_price,
            freight_cost: f.freight_cost,
            other_cost: f.other_cost,
        });
        setEditingId(isDerived ? null : f.id);
        setShowForm(true);
    };

    const handleLoadProject = (projectName: string) => {
        const selected = shipmentByProject.get(normalizeKey(projectName));
        if (!selected) return;
        setForm((prev) => ({
            ...prev,
            project_name: selected.projectName,
            mv_name: selected.mvName,
            buyer: selected.buyer === "-" ? prev.buyer : selected.buyer,
            type: selected.type,
            quantity: selected.qty > 0 ? selected.qty : prev.quantity,
        }));
    };

    const dealById = React.useMemo(() => {
        const map = new Map<string, (typeof deals)[number]>();
        deals.forEach((d) => map.set(d.id, d));
        return map;
    }, [deals]);

    const dealByNumber = React.useMemo(() => {
        const map = new Map<string, (typeof deals)[number]>();
        deals.forEach((d) => map.set(normalizeKey(d.deal_number), d));
        return map;
    }, [deals]);

    const shipmentByProject = React.useMemo(() => {
        const map = new Map<string, {
            projectName: string;
            mvName: string;
            buyer: string;
            type: "local" | "export";
            qty: number;
            year: number;
            qtyWeight: number;
            sellingPrice: number;
            buyingPrice: number;
            freightCost: number;
            otherCost: number;
        }>();
        shipments.forEach((sh) => {
            const projectName = shipmentProjectName(sh);
            const projectKey = normalizeKey(projectName);
            if (!projectKey) return;
            const existing = map.get(projectKey);
            const qty = safeNum(sh.qty_plan ?? sh.quantity_loaded ?? sh.qty_cob);
            const weight = qty > 0 ? qty : 1;
            const sellingPrice = safeNum(sh.sales_price ?? sh.sp ?? sh.harga_actual_fob_mv ?? sh.harga_actual_fob);
            const buyingPrice = safeNum(sh.hpb);
            const freightCost = safeNum(sh.price_freight ?? sh.shipping_rate);
            const otherCost = parseLooseNum(sh.allowance);
            if (!existing) {
                map.set(projectKey, {
                    projectName,
                    mvName: extractMVName(sh.vessel_name || sh.mv_project_name) || "-",
                    buyer: cleanText(sh.buyer) || "-",
                    type: shipmentType(sh),
                    qty,
                    year: safeNum(sh.year) || new Date().getFullYear(),
                    qtyWeight: weight,
                    sellingPrice,
                    buyingPrice,
                    freightCost,
                    otherCost,
                });
                return;
            }
            existing.qty += qty;
            const newWeight = existing.qtyWeight + weight;
            existing.sellingPrice = ((existing.sellingPrice * existing.qtyWeight) + (sellingPrice * weight)) / newWeight;
            existing.buyingPrice = ((existing.buyingPrice * existing.qtyWeight) + (buyingPrice * weight)) / newWeight;
            existing.freightCost = ((existing.freightCost * existing.qtyWeight) + (freightCost * weight)) / newWeight;
            existing.otherCost = ((existing.otherCost * existing.qtyWeight) + (otherCost * weight)) / newWeight;
            existing.qtyWeight = newWeight;
            if (existing.mvName === "-" && extractMVName(sh.vessel_name || sh.mv_project_name)) {
                existing.mvName = extractMVName(sh.vessel_name || sh.mv_project_name) || existing.mvName;
            }
            if (existing.buyer === "-" && cleanText(sh.buyer)) existing.buyer = cleanText(sh.buyer) || existing.buyer;
            existing.year = Math.max(existing.year, safeNum(sh.year) || existing.year);
            map.set(projectKey, existing);
        });
        return map;
    }, [shipments]);

    const projectOptions = React.useMemo(() => {
        return Array.from(shipmentByProject.values()).sort((a, b) => b.qty - a.qty);
    }, [shipmentByProject]);

    const projectsByBuyer = React.useMemo(() => {
        const map = new Map<string, string[]>();
        projectOptions.forEach((p) => {
            const key = normalizeKey(p.buyer);
            if (!key || key === "-") return;
            const existing = map.get(key) || [];
            if (!existing.includes(p.projectName)) existing.push(p.projectName);
            map.set(key, existing);
        });
        return map;
    }, [projectOptions]);

    const resolveContext = React.useCallback((f: PLForecastItem) => {
        const linkedDeal = dealById.get(f.deal_id) || dealByNumber.get(normalizeKey(f.deal_number));
        const dealProject =
            cleanText(linkedDeal?.project_id) ||
            extractProjectName(linkedDeal?.vessel_name) ||
            extractMVName(linkedDeal?.vessel_name);
        const forecastProject = cleanText(f.project_name);
        const buyerProjects = cleanText(f.buyer) ? projectsByBuyer.get(normalizeKey(f.buyer)) : undefined;
        const inferredProjectByBuyer = buyerProjects && buyerProjects.length === 1 ? buyerProjects[0] : null;
        const fallbackByBuyer = cleanText(f.buyer) ? `Buyer - ${cleanText(f.buyer)}` : null;
        const fallbackById = `Forecast - ${f.id.slice(-6).toUpperCase()}`;
        const projectName =
            forecastProject ||
            dealProject ||
            inferredProjectByBuyer ||
            cleanText(f.deal_number) ||
            fallbackByBuyer ||
            fallbackById;
        const shipmentCtx = shipmentByProject.get(normalizeKey(projectName));
        const mvName =
            shipmentCtx?.mvName ||
            extractMVName(linkedDeal?.vessel_name) ||
            extractMVName(projectName) ||
            "-";
        const buyer = cleanText(f.buyer) || cleanText(linkedDeal?.buyer) || shipmentCtx?.buyer || "-";
        return {
            projectName,
            projectKey: normalizeKey(projectName),
            mvName,
            buyer,
            dealNumber: linkedDeal?.deal_number || f.deal_number || "-",
        };
    }, [dealById, dealByNumber, shipmentByProject, projectsByBuyer]);

    const manualForecastByProject = React.useMemo(() => {
        const map = new Map<string, PLForecastItem>();
        const sorted = [...plForecasts].sort(
            (a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime()
        );
        sorted.forEach((f) => {
            const ctx = resolveContext(f);
            if (!ctx.projectKey) return;
            if (!map.has(ctx.projectKey)) map.set(ctx.projectKey, f);
        });
        return map;
    }, [plForecasts, resolveContext]);

    const projectForecasts = React.useMemo<PLForecastItem[]>(() => {
        const rows: PLForecastItem[] = [];
        const nowIso = new Date().toISOString();

        shipmentByProject.forEach((ctx, projectKey) => {
            const override = manualForecastByProject.get(projectKey);
            const quantity = safeNum(override?.quantity) > 0 ? safeNum(override?.quantity) : safeNum(ctx.qty);
            const sellingPrice = safeNum(override?.selling_price) > 0 ? safeNum(override?.selling_price) : safeNum(ctx.sellingPrice);
            const buyingPrice = override ? safeNum(override.buying_price) : safeNum(ctx.buyingPrice);
            const freightCost = override ? safeNum(override.freight_cost) : safeNum(ctx.freightCost);
            const otherCost = override ? safeNum(override.other_cost) : safeNum(ctx.otherCost);
            const grossProfitMt = sellingPrice - buyingPrice - freightCost - otherCost;
            const totalGrossProfit = grossProfitMt * quantity;

            rows.push({
                id: override?.id || `derived:${projectKey}`,
                deal_id: override?.deal_id || "",
                deal_number: override?.deal_number || ctx.projectName,
                project_name: ctx.projectName,
                buyer: cleanText(override?.buyer) || cleanText(ctx.buyer) || "-",
                type: (override?.type as "local" | "export") || ctx.type,
                quantity,
                selling_price: sellingPrice,
                buying_price: buyingPrice,
                freight_cost: freightCost,
                other_cost: otherCost,
                gross_profit_mt: grossProfitMt,
                total_gross_profit: totalGrossProfit,
                status: (override?.status as "pre_sale" | "confirmed" | "forecast") || "forecast",
                created_by: override?.created_by || "system",
                created_at: override?.created_at || nowIso,
                updated_at: override?.updated_at || nowIso,
                is_deleted: false,
            });
        });

        // Keep non-mapped manual project forecasts, but drop obvious seeded dummy rows.
        plForecasts.forEach((f) => {
            const ctx = resolveContext(f);
            if (shipmentByProject.has(ctx.projectKey)) return;
            const hasProjectLikeContext = Boolean(cleanText(f.project_name) || cleanText(f.deal_number));
            const isDummyBuyer = /^BUYER\s+\d+$/i.test(cleanText(f.buyer) || "");
            if (!hasProjectLikeContext || isDummyBuyer) return;

            const qty = safeNum(f.quantity);
            const selling = safeNum(f.selling_price);
            const buying = safeNum(f.buying_price);
            const freight = safeNum(f.freight_cost);
            const other = safeNum(f.other_cost);
            const gpMt = selling - buying - freight - other;
            rows.push({
                ...f,
                project_name: ctx.projectName,
                gross_profit_mt: gpMt,
                total_gross_profit: gpMt * qty,
            });
        });

        return rows.sort((a, b) => (b.quantity * b.selling_price) - (a.quantity * a.selling_price));
    }, [shipmentByProject, manualForecastByProject, plForecasts, resolveContext]);

    const visibleForecasts = projectForecasts;

    const projectRollup = React.useMemo(() => {
        const map = new Map<string, { projectName: string; mvName: string; qty: number; revenue: number; cogs: number; gp: number }>();
        visibleForecasts.forEach((f) => {
            const ctx = resolveContext(f);
            const key = ctx.projectKey || normalizeKey(f.id);
            const row = map.get(key) || {
                projectName: ctx.projectName,
                mvName: ctx.mvName,
                qty: 0,
                revenue: 0,
                cogs: 0,
                gp: 0,
            };
            const revenue = f.quantity * f.selling_price;
            const cogs = f.quantity * (f.buying_price + f.freight_cost + f.other_cost);
            row.qty += f.quantity;
            row.revenue += revenue;
            row.cogs += cogs;
            row.gp += f.total_gross_profit;
            map.set(key, row);
        });
        return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
    }, [visibleForecasts, resolveContext]);

    // Summary stats for CEO view
    const totalRevenue = visibleForecasts.reduce((sum, f) => sum + f.quantity * f.selling_price, 0);
    const totalCOGS = visibleForecasts.reduce((sum, f) => sum + f.quantity * (f.buying_price + f.freight_cost + f.other_cost), 0);
    const totalProfit = visibleForecasts.reduce((sum, f) => sum + f.total_gross_profit, 0);
    const overallMargin = totalRevenue ? (totalProfit / totalRevenue) * 100 : 0;

    const handleLoadDeal = (dealId: string) => {
        const d = deals.find(x => x.id === dealId);
        if (d) {
            const projectName =
                cleanText(d.project_id) ||
                extractProjectName(d.vessel_name) ||
                extractMVName(d.vessel_name) ||
                d.deal_number;
            const projectShipment = shipmentByProject.get(normalizeKey(projectName));
            setForm({
                ...form,
                deal_id: d.id,
                deal_number: d.deal_number,
                project_name: projectName,
                mv_name: projectShipment?.mvName || extractMVName(d.vessel_name) || "-",
                buyer: d.buyer,
                type: d.type,
                quantity: d.quantity,
                selling_price: d.price_per_mt || 0,
            });
        }
    };

    // Live preview
    const liveRevenue = form.quantity * form.selling_price;
    const liveCogs = form.quantity * (form.buying_price + form.freight_cost + form.other_cost);
    const liveProfit = liveRevenue - liveCogs;
    const liveMargin = liveRevenue ? (liveProfit / liveRevenue) * 100 : 0;

    // Show loading while checking authentication
    if (status === "loading") {
        return (
            <AppShell>
                <div className="p-8 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin" />
                </div>
            </AppShell>
        );
    }

    // Redirect if not authenticated or no access
    if (status === "unauthenticated" || !hasAccess) return null;

    return (
        <AppShell>
            <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fade-in">
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold">P&amp;L Forecast</h1>
                        <p className="text-sm text-muted-foreground">MV/Project centric margin simulation. Primary grouping by Project, secondary by MV.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handleManualSync}
                            disabled={isSyncing}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent transition-colors disabled:opacity-50"
                            title="Sync from Google Sheets"
                        >
                            <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
                            {isSyncing ? "Syncing..." : "Sync"}
                        </button>
                        {isHighLevel && (
                            <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary flex items-center gap-1.5 shadow-lg shadow-primary/20">
                                <Plus className="w-4 h-4" /> Create Forecast
                            </button>
                        )}
                    </div>
                </div>

                {/* Summary Cards */}
                {isHighLevel && (
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 animate-slide-up">
                        <div className="card-elevated p-4 border-l-4 border-emerald-500">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Est. Revenue</p>
                            <p className="text-xl font-bold text-emerald-600 mt-1">{formatCurrency(totalRevenue)}</p>
                        </div>
                        <div className="card-elevated p-4 border-l-4 border-rose-500">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5"><TrendingDown className="w-3.5 h-3.5" /> Est. COGS</p>
                            <p className="text-xl font-bold text-rose-500 mt-1">{formatCurrency(totalCOGS)}</p>
                        </div>
                        <div className="card-elevated p-4 border-l-4 border-primary">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Total GP</p>
                            <p className="text-xl font-bold mt-1 text-primary">{formatCurrency(totalProfit)}</p>
                        </div>
                        <div className="card-elevated p-4 border-l-4 border-violet-500">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5"><Percent className="w-3.5 h-3.5" /> Overall Margin</p>
                            <p className={cn("text-xl font-bold mt-1", overallMargin >= 0 ? "text-violet-600" : "text-red-500")}>{safeFmt(overallMargin)}% </p>
                        </div>
                        <div className="card-elevated p-4 border-l-4 border-sky-500">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase">Covered Projects</p>
                            <p className="text-xl font-bold mt-1 text-sky-600">{projectRollup.length}</p>
                        </div>
                    </div>
                )}

                {/* Project Rollup */}
                <div className="card-elevated p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold">Project Rollup</h3>
                        <span className="text-[10px] text-muted-foreground">Aggregated by Project/MV (forecast + mapped context)</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="border-b border-border/50 text-muted-foreground">
                                <tr>
                                    <th className="text-left py-2 pr-3">Project</th>
                                    <th className="text-right py-2 pr-3">Qty (MT)</th>
                                    <th className="text-right py-2 pr-3">Revenue</th>
                                    <th className="text-right py-2 pr-3">COGS</th>
                                    <th className="text-right py-2">GP</th>
                                </tr>
                            </thead>
                            <tbody>
                                {projectRollup.slice(0, 8).map((r) => (
                                    <tr key={`${r.projectName}-${r.mvName}`} className="border-b border-border/30">
                                        <td className="py-2 pr-3">
                                            <p className="font-semibold text-primary">{r.projectName}</p>
                                            <p className="text-[10px] text-muted-foreground">{r.mvName}</p>
                                        </td>
                                        <td className="py-2 pr-3 text-right font-mono">{safeNum(r.qty).toLocaleString()}</td>
                                        <td className="py-2 pr-3 text-right font-mono">{formatCurrency(r.revenue)}</td>
                                        <td className="py-2 pr-3 text-right font-mono text-rose-500">{formatCurrency(r.cogs)}</td>
                                        <td className="py-2 text-right font-mono font-semibold">{formatCurrency(r.gp)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {projectRollup.length === 0 && (
                        <div className="text-center text-sm text-muted-foreground py-6">No project rollup data.</div>
                    )}
                </div>

                {/* Form Section */}
                {showForm && (
                    <div className="card-elevated p-5 space-y-4 animate-scale-in border border-primary/30 bg-primary/5 shadow-xl">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold uppercase tracking-tight text-primary">
                                {editingId ? `Update Costs: ${form.project_name || form.deal_number}` : "Create New P&L Forecast"}
                            </h3>
                            <button onClick={() => { setShowForm(false); resetForm(); }} className="p-1 rounded-lg hover:bg-accent"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {!editingId && (
                                    <div className="sm:col-span-2">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Select Project / MV (Required)</label>
                                        <select onChange={(e) => handleLoadProject(e.target.value)} className="w-full mt-1 px-3 py-2.5 rounded-xl bg-background border border-border text-sm outline-none focus:border-primary" value={form.project_name || ""}>
                                            <option value="">Select Project...</option>
                                            {projectOptions.map((p) => (
                                                <option key={normalizeKey(p.projectName)} value={p.projectName}>
                                                    {p.projectName} | {p.mvName} | {p.buyer} | {p.qty.toLocaleString()} MT
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                {!editingId && (
                                    <div className="sm:col-span-2">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Link Deal (for Project/MV Context)</label>
                                        <select onChange={(e) => handleLoadDeal(e.target.value)} className="w-full mt-1 px-3 py-2.5 rounded-xl bg-background border border-border text-sm outline-none focus:border-primary">
                                            <option value="">Select Existing Deal...</option>
                                            {deals.map(d => {
                                                const projectLabel = cleanText(d.project_id) || extractProjectName(d.vessel_name) || extractMVName(d.vessel_name) || d.deal_number;
                                                const mvLabel = extractMVName(d.vessel_name) || "-";
                                                return (
                                                    <option key={d.id} value={d.id}>
                                                        {projectLabel} | {mvLabel} | {d.deal_number}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                )}
                                <div className="p-3 rounded-lg bg-accent/30 space-y-2">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Project Context</p>
                                    <p className="text-xs font-semibold">Project: <span className="text-primary">{form.project_name || "-"}</span></p>
                                    <p className="text-xs font-semibold">MV: <span className="text-primary">{form.mv_name || "-"}</span></p>
                                    <p className="text-xs font-semibold">Buyer: <span className="text-primary">{form.buyer || "-"}</span></p>
                                    <p className="text-xs font-semibold">Qty: <span className="font-mono">{form.quantity.toLocaleString()} MT</span></p>
                                    <p className="text-xs font-semibold">Selling: <span className="font-mono text-emerald-600">${form.selling_price}/MT</span></p>
                                </div>

                                <div className="space-y-4 pt-1">
                                    <div><label className="text-[10px] font-bold text-muted-foreground uppercase">Buying Price (USD/MT)</label><input type="number" step="0.01" value={form.buying_price || ""} onChange={(e) => setForm({ ...form, buying_price: +e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-xs outline-none focus:border-primary" /></div>
                                    <div><label className="text-[10px] font-bold text-muted-foreground uppercase">Freight Cost (USD/MT)</label><input type="number" step="0.01" value={form.freight_cost || ""} onChange={(e) => setForm({ ...form, freight_cost: +e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-xs outline-none focus:border-primary" /></div>
                                    <div><label className="text-[10px] font-bold text-muted-foreground uppercase">Other Costs (USD/MT)</label><input type="number" step="0.01" value={form.other_cost || ""} onChange={(e) => setForm({ ...form, other_cost: +e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-xs outline-none focus:border-primary" /></div>
                                </div>
                            </div>

                            {/* Live Preview Pane */}
                            <div className="bg-white/50 backdrop-blur border border-border rounded-2xl p-5 flex flex-col justify-between shadow-inner">
                                <div>
                                    <p className="text-[10px] font-bold uppercase text-primary flex items-center gap-1.5 mb-4"><Activity className="w-3.5 h-3.5" /> Margin Simulation</p>
                                    <div className="space-y-3 text-xs">
                                        <div className="flex justify-between font-medium"><span className="text-muted-foreground">Volume:</span> <span className="font-mono">{form.quantity.toLocaleString()} MT</span></div>
                                        <div className="flex justify-between font-medium"><span className="text-muted-foreground">Revenue:</span> <span className="font-mono">{formatCurrency(liveRevenue)}</span></div>
                                        <div className="flex justify-between font-medium"><span className="text-muted-foreground">Total COGS:</span> <span className="font-mono text-rose-500">{formatCurrency(liveCogs)}</span></div>
                                        <div className="w-full h-px bg-border my-2" />
                                        <div className="flex justify-between font-bold text-base"><span className="text-foreground">Total Profit:</span> <span className={cn("font-mono", liveProfit >= 0 ? "text-emerald-600" : "text-red-500")}>{formatCurrency(liveProfit)}</span></div>
                                    </div>
                                </div>
                                <div className={cn("mt-6 p-4 rounded-xl border text-center transition-all", liveProfit >= 0 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" : "bg-red-500/10 border-red-500/20 text-red-600")}>
                                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1">Projected Margin</p>
                                    <p className="text-3xl font-bold">{safeFmt(liveMargin)}%</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-4 pt-4 border-t border-border/50">
                            <button onClick={handleAddOrUpdate} className="btn-primary px-8" disabled={isSaving || (!editingId && !form.project_name)}>
                                {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : editingId ? "Update Costs" : "Create Forecast"}
                            </button>
                            <button onClick={() => { setShowForm(false); resetForm(); }} className="px-6 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent transition-colors" disabled={isSaving}>Cancel</button>
                        </div>
                    </div>
                )}

                {/* Forecast Table */}
                <div className="card-elevated overflow-hidden animate-slide-up">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-accent/30 border-b border-border">
                                <tr>
                                    <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase">Project / MV</th>
                                    <th className="px-4 py-3 text-right text-[10px] font-bold text-muted-foreground uppercase">Qty (MT)</th>
                                    <th className="px-4 py-3 text-right text-[10px] font-bold text-muted-foreground uppercase">Revenue</th>
                                    <th className="px-4 py-3 text-right text-[10px] font-bold text-muted-foreground uppercase">COGS</th>
                                    <th className="px-4 py-3 text-right text-[10px] font-bold text-muted-foreground uppercase">Margin %</th>
                                    <th className="px-4 py-3 text-right text-[10px] font-bold text-muted-foreground uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleForecasts.map((f) => {
                                    const revenue = f.quantity * f.selling_price;
                                    const cogs = f.quantity * (f.buying_price + f.freight_cost + f.other_cost);
                                    const profit = revenue - cogs;
                                    const margin = revenue ? (profit / revenue) * 100 : 0;
                                    const isProfitable = profit >= 0;
                                    const ctx = resolveContext(f);
                                    return (
                                        <tr key={f.id} className="border-b border-border/30 hover:bg-accent/20 transition-colors">
                                            <td className="px-4 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-primary">{ctx.projectName}</span>
                                                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">{ctx.mvName}</span>
                                                    <span className="text-[10px] text-muted-foreground">{ctx.dealNumber} • {ctx.buyer}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-right font-mono text-xs">{f.quantity.toLocaleString()}</td>
                                            <td className="px-4 py-4 text-right font-mono text-xs">{formatCurrency(revenue)}</td>
                                            <td className="px-4 py-4 text-right font-mono text-xs text-rose-500">{formatCurrency(cogs)}</td>
                                            <td className="px-4 py-4 text-right">
                                                <span className={cn("px-2 py-1 rounded-md text-[10px] font-bold", isProfitable ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600")}>
                                                    {safeFmt(margin)}%
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-right flex justify-end gap-1">
                                                <button onClick={() => handleEdit(f)} className="p-2 rounded-lg hover:bg-primary/10 text-primary transition-colors" title="Input Costs">
                                                    <Edit3 className="w-4 h-4" />
                                                </button>
                                                {isHighLevel && !f.id.startsWith("derived:") && (
                                                    <button
                                                        onClick={async () => {
                                                            if (confirm("Are you sure you want to delete this forecast?")) {
                                                                try {
                                                                    await deletePLForecast(f.id);
                                                                    setToast({ message: "Forecast deleted", type: "success" });
                                                                } catch (err: any) {
                                                                    setToast({ message: err.message || "Failed to delete", type: "error" });
                                                                }
                                                            }
                                                        }}
                                                        className="p-2 rounded-lg hover:bg-rose-500/10 text-rose-500 transition-colors"
                                                        title="Delete Forecast"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {visibleForecasts.length === 0 && <div className="text-center py-12 text-muted-foreground text-sm font-medium">No active P&L Forecasts available.</div>}
                </div>
                {toast && (
                    <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
                )}
            </div>
        </AppShell>
    );
}
