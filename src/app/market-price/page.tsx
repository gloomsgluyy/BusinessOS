"use client";

import React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useCommercialStore } from "@/store/commercial-store";
import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";
import { Plus, TrendingUp, TrendingDown, Settings2, X, Calculator, Loader2 } from "lucide-react";
import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { Toast } from "@/components/shared/toast";

interface Formula {
    name: string;
    baseIndex: "ici_1" | "ici_2" | "ici_3" | "ici_4" | "newcastle" | "hba";
    operator: "+" | "-" | "*";
    adjustment: number;
    description: string;
}

const DEFAULT_FORMULAS: Formula[] = [
    { name: "Selling Price 4200", baseIndex: "ici_4", operator: "-", adjustment: 2.5, description: "ICI 4 - $2.50 discount" },
    { name: "Buying Price 4200", baseIndex: "ici_4", operator: "-", adjustment: 5.0, description: "ICI 4 - $5.00 (supplier margin)" },
    { name: "Selling Price 5000", baseIndex: "ici_3", operator: "-", adjustment: 1.5, description: "ICI 3 - $1.50" },
];

// Safe number helper to prevent toFixed crash on null values from Memory B
const safeNum = (v: number | null | undefined): number => (v != null && !isNaN(v) ? v : 0);
const safeFmt = (v: number | null | undefined, decimals = 2): string => safeNum(v).toFixed(decimals);

export default function MarketPricePage() {
    const { marketPrices, syncFromMemory, addMarketPrice } = useCommercialStore();

    React.useEffect(() => {
        syncFromMemory();
    }, [syncFromMemory]);
    const { hasPermission } = useAuthStore();
    const canEdit = hasPermission("market_price_edit");
    const [mounted, setMounted] = React.useState(false);
    const [showForm, setShowForm] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [toast, setToast] = React.useState<{ message: string; type: "success" | "error" } | null>(null);
    const [showScrapeSettings, setShowScrapeSettings] = React.useState(false);
    const [calc, setCalc] = React.useState({ index: "ici_4", baseAdjust: 0, freight: 0 });
    const [hpbCalc, setHpbCalc] = React.useState({ gar: 4200, tm: 35, ts: 0.2, ash: 8 });
    const [form, setForm] = React.useState({ date: "", ici_1: 0, ici_2: 0, ici_3: 0, ici_4: 0, ici_5: 0, newcastle: 0, hba: 0, hba_1: 0, hba_2: 0, hba_3: 0 });
    const [isScraping, setIsScraping] = React.useState(false);
    const [scrapeLogs, setScrapeLogs] = React.useState<string[]>([]);

    const addLog = (msg: string) => setScrapeLogs(prev => [...prev.slice(-20), `[${new Date().toLocaleTimeString()}] ${msg}`]);

    const fetchMarketPrices = React.useCallback(async () => {
        if (isScraping) return;
        setIsScraping(true);
        addLog("Initializing AI Market Intelligence...");
        try {
            addLog("Connecting to Groq AI — extracting latest coal indices...");
            const res = await fetch("/api/market-scrape", { method: "POST" });
            const data = await res.json();
            if (data.success && data.prices) {
                const p = data.prices;
                addLog(`ICI 1 (6500): $${p.ici_1}`);
                addLog(`ICI 2 (5800): $${p.ici_2}`);
                addLog(`ICI 3 (5000): $${p.ici_3}`);
                addLog(`ICI 4 (4200): $${p.ici_4}`);
                addLog(`ICI 5 (3400): $${p.ici_5}`);
                addLog(`Newcastle: $${p.newcastle}`);
                addLog(`HBA: $${p.hba}`);

                // addMarketPrice now handles upserts locally and on the server
                await addMarketPrice({
                    date: p.date,
                    ici_1: p.ici_1,
                    ici_2: p.ici_2,
                    ici_3: p.ici_3,
                    ici_4: p.ici_4,
                    ici_5: p.ici_5,
                    newcastle: p.newcastle,
                    hba: p.hba,
                    hba_1: p.hba_1,
                    hba_2: p.hba_2,
                    hba_3: p.hba_3,
                    source: p.source
                });

                addLog("Market data updated/saved and synced.");
                addLog("Scraping complete.");
            } else {
                addLog(`Error: ${data.error || "Unknown error"}`);
            }
        } catch (err: any) {
            addLog(`Fetch failed: ${err.message}`);
        } finally {
            setIsScraping(false);
        }
    }, [isScraping, marketPrices, addMarketPrice]);

    React.useEffect(() => setMounted(true), []);


    const data = [...marketPrices].reverse().map((p) => {
        const d = new Date(p.date);
        return {
            date: d.toLocaleDateString("en", { month: "short", day: "numeric" }),
            fullDate: d.toLocaleDateString("en", { day: "2-digit", month: "short", year: "numeric" }),
            "ICI 1 (6500)": p.ici_1,
            "ICI 2 (5800)": p.ici_2,
            "ICI 3 (5000)": p.ici_3,
            "ICI 4 (4200)": p.ici_4,
            "ICI 5 (3400)": p.ici_5 || 0,
            Newcastle: p.newcastle,
            HBA: p.hba,
            "HBA I": p.hba_1 || 0,
            "HBA II": p.hba_2 || 0,
            "HBA III": p.hba_3 || 0,
        };
    });

    const latest = marketPrices.length > 0 ? marketPrices[marketPrices.length - 1] : null;
    const prev = marketPrices.length > 1 ? marketPrices[marketPrices.length - 2] : null;

    const calculateHpbEstimate = () => {
        if (!latest) return 0;
        const { gar, tm, ts, ash } = hpbCalc;
        
        const tiers = [
            { hba: latest.hba, gar: 6322, tm: 8, ts: 0.8, ash: 15 },
            { hba: latest.hba_1, gar: 5300, tm: 21.32, ts: 0.75, ash: 6 },
            { hba: latest.hba_2, gar: 4100, tm: 35.73, ts: 0.23, ash: 9 },
            { hba: latest.hba_3, gar: 3400, tm: 44.3, ts: 0.20, ash: 27.5 },
        ];
        
        let closestTier = tiers[0];
        let minDiff = Math.abs(gar - tiers[0].gar);
        for (let i = 1; i < tiers.length; i++) {
            const diff = Math.abs(gar - tiers[i].gar);
            if (diff < minDiff) {
                minDiff = diff;
                closestTier = tiers[i];
            }
        }
        
        let basePrice = (gar / closestTier.gar) * (closestTier.hba || 0);
        
        const tmDiff = tm - closestTier.tm;
        const ashDiff = ash - closestTier.ash;
        const tsDiff = ts - closestTier.ts;
        
        const tmAdj = (tmDiff * -0.01) * basePrice;
        const ashAdj = (ashDiff * -0.005) * basePrice;
        const tsAdj = (tsDiff * 10 * -0.01) * basePrice;
        
        return Math.max(0, basePrice + tmAdj + ashAdj + tsAdj);
    };

    const changes = latest && prev ? [
        { label: "ICI 1 (6500)", val: safeNum(latest.ici_1), diff: safeNum(latest.ici_1) - safeNum(prev.ici_1), color: "#ef4444" },
        { label: "ICI 2 (5800)", val: safeNum(latest.ici_2), diff: safeNum(latest.ici_2) - safeNum(prev.ici_2), color: "#f59e0b" },
        { label: "ICI 3 (5000)", val: safeNum(latest.ici_3), diff: safeNum(latest.ici_3) - safeNum(prev.ici_3), color: "#3b82f6" },
        { label: "ICI 4 (4200)", val: safeNum(latest.ici_4), diff: safeNum(latest.ici_4) - safeNum(prev.ici_4), color: "#8b5cf6" },
        { label: "ICI 5 (3400)", val: safeNum(latest.ici_5), diff: safeNum(latest.ici_5) - safeNum(prev.ici_5), color: "#6366f1" },
        { label: "Newcastle", val: safeNum(latest.newcastle), diff: safeNum(latest.newcastle) - safeNum(prev.newcastle), color: "#ec4899" },
        { label: "HBA", val: safeNum(latest.hba), diff: safeNum(latest.hba) - safeNum(prev.hba), color: "#10b981" },
        { label: "HBA I (5300)", val: safeNum(latest.hba_1), diff: safeNum(latest.hba_1) - safeNum(prev.hba_1), color: "#14b8a6" },
        { label: "HBA II (4100)", val: safeNum(latest.hba_2), diff: safeNum(latest.hba_2) - safeNum(prev.hba_2), color: "#06b6d4" },
        { label: "HBA III (3400)", val: safeNum(latest.hba_3), diff: safeNum(latest.hba_3) - safeNum(prev.hba_3), color: "#0ea5e9" },
    ] : [];

    const handleSubmit = async () => {
        if (!form.date) {
            setToast({ message: "Please select a date first", type: "error" });
            return;
        }
        setIsSaving(true);
        try {
            await addMarketPrice({
                date: form.date,
                ici_1: form.ici_1 || 0,
                ici_2: form.ici_2 || 0,
                ici_3: form.ici_3 || 0,
                ici_4: form.ici_4 || 0,
                ici_5: form.ici_5 || 0,
                newcastle: form.newcastle || 0,
                hba: form.hba || 0,
                hba_1: form.hba_1 || 0,
                hba_2: form.hba_2 || 0,
                hba_3: form.hba_3 || 0,
                source: "Manual"
            });
            setToast({ message: "Market prices saved successfully!", type: "success" });
            setShowForm(false);
            setForm({ date: "", ici_1: 0, ici_2: 0, ici_3: 0, ici_4: 0, ici_5: 0, newcastle: 0, hba: 0, hba_1: 0, hba_2: 0, hba_3: 0 });
        } catch (error) {
            setToast({ message: "Failed to save market prices", type: "error" });
        } finally {
            setIsSaving(false);
        }
    };

    if (!mounted) {
        return (
            <AppShell>
                <div className="flex items-center justify-center p-12 text-muted-foreground animate-pulse">Loading market data...</div>
            </AppShell>
        );
    }

    return (
        <AppShell>
            <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fade-in">
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-3">
                            Market Price Index
                            <span className="inline-flex items-center gap-1.5 text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded border border-emerald-500/20 font-bold uppercase tracking-wider">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Global Scraping Active
                            </span>
                        </h1>
                        <p className="text-sm text-muted-foreground">ICI, Newcastle &amp; HBA coal price tracking</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {canEdit && <button onClick={() => setShowScrapeSettings(true)} className="btn-outline w-fit"><Settings2 className="w-4 h-4 mr-1.5" /> Scraping Settings</button>}
                        {canEdit && <button onClick={() => setShowForm(!showForm)} className="btn-primary w-fit"><Plus className="w-4 h-4 mr-1.5" /> Input Price</button>}
                    </div>
                </div>

                {/* Scraping Settings Modal */}
                {showScrapeSettings && (
                    <div className="modal-overlay z-50 fixed inset-0 flex items-center justify-center p-4">
                        <div className="modal-backdrop absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowScrapeSettings(false)} />
                        <div className="modal-content relative bg-card border border-border w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl animate-scale-in p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-lg font-bold">Market Scraping</h2>
                                    <p className="text-xs text-muted-foreground mt-1">Global background scraping is active (every 6 hours).</p>
                                </div>
                                <button onClick={() => setShowScrapeSettings(false)} className="p-2 hover:bg-accent rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                            </div>

                            <div className="space-y-5">
                                <div className="flex items-center justify-between p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
                                    <div>
                                        <p className="text-sm font-semibold text-emerald-600">Global Auto-Scraping</p>
                                        <p className="text-[10px] text-muted-foreground">Runs automatically in the background every 6 hours, regardless of which page you are on.</p>
                                    </div>
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                                </div>

                                <div className="space-y-2 pt-2 border-t border-border/50">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase flex justify-between">
                                        <span>Target Sources</span>
                                        <span className="text-emerald-500 font-bold tracking-wider animate-pulse">Running...</span>
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {["GlobalCoal API", "Argus Media", "McCloskey", "ICE Futures"].map(source => (
                                            <label key={source} className="flex items-center gap-2 cursor-pointer opacity-80 hover:opacity-100">
                                                <input type="checkbox" defaultChecked readOnly className="rounded text-emerald-500 focus:ring-emerald-500 bg-accent/30 border-border" />
                                                <span className="text-xs font-medium">{source}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-1.5 pt-2 border-t border-border/50">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Manual Fetch Logs</label>
                                    <div className="bg-black/50 p-3 rounded-lg border border-border/50 space-y-1 font-mono text-[10px] h-32 overflow-y-auto">
                                        {scrapeLogs.length === 0 && <p className="text-muted-foreground">No manual fetch performed yet.</p>}
                                        {scrapeLogs.map((log, i) => (
                                            <p key={i} className={log.includes("Error") || log.includes("failed") ? "text-red-400" : log.includes("$") ? "text-emerald-400" : "text-muted-foreground"}>
                                                {log}
                                            </p>
                                        ))}
                                        {isScraping && <p className="text-blue-400 animate-pulse">[{new Date().toLocaleTimeString()}] Processing...</p>}
                                    </div>
                                </div>

                                <button onClick={fetchMarketPrices} disabled={isScraping} className="btn-outline w-full mt-2 disabled:opacity-50">
                                    {isScraping ? "Scraping..." : "Fetch Now (Manual)"}
                                </button>
                                <button onClick={() => setShowScrapeSettings(false)} className="btn-primary w-full mt-2">
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Price Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    {changes.map((c) => (
                        <div key={c.label} className="card-elevated p-4 animate-slide-up">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase">{c.label}</p>
                            <p className="text-lg font-bold mt-1" style={{ color: c.color }}>${safeFmt(c.val)}</p>
                            <div className={cn("flex items-center gap-1 text-[10px] mt-0.5", c.diff >= 0 ? "text-emerald-500" : "text-red-500")}>
                                {c.diff >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {c.diff >= 0 ? "+" : ""}{safeFmt(c.diff)}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Formula Calculator Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
                    {/* Standard Formula Calculator */}
                    <div className="card-elevated p-5 md:p-6 border border-border/50">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="text-base font-bold flex items-center gap-2 text-violet-500"><Calculator className="w-5 h-5" /> Standard Index Calculator</h3>
                                <p className="text-xs text-muted-foreground mt-1">Determine buying/selling price based on real-time market indices.</p>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Base Index</label>
                                    <select value={calc.index} onChange={(e) => setCalc({ ...calc, index: e.target.value })} className="w-full mt-1.5 px-3 py-2.5 rounded-xl bg-background border border-border text-sm font-medium outline-none focus:border-violet-500/50 pr-8">
                                        <option value="ici_1">ICI 1 (6500) - ${safeFmt(latest?.ici_1)}</option>
                                        <option value="ici_2">ICI 2 (5800) - ${safeFmt(latest?.ici_2)}</option>
                                        <option value="ici_3">ICI 3 (5000) - ${safeFmt(latest?.ici_3)}</option>
                                        <option value="ici_4">ICI 4 (4200) - ${safeFmt(latest?.ici_4)}</option>
                                        <option value="ici_5">ICI 5 (3400) - ${safeFmt(latest?.ici_5)}</option>
                                        <option value="newcastle">Newcastle - ${safeFmt(latest?.newcastle)}</option>
                                        <option value="hba">HBA (6322) - ${safeFmt(latest?.hba)}</option>
                                        <option value="hba_1">HBA I (5300) - ${safeFmt(latest?.hba_1)}</option>
                                        <option value="hba_2">HBA II (4100) - ${safeFmt(latest?.hba_2)}</option>
                                        <option value="hba_3">HBA III (3400) - ${safeFmt(latest?.hba_3)}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Premium / Discount (USD)</label>
                                    <div className="relative mt-1.5">
                                        <input type="number" step="0.5" value={calc.baseAdjust || ""} onChange={(e) => setCalc({ ...calc, baseAdjust: +e.target.value })} placeholder="e.g. -2.5" className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm outline-none focus:border-violet-500/50 pl-8" />
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-mono">$</span>
                                    </div>
                                </div>
                            </div>
                            <div className="pt-4 border-t border-border/50">
                                <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20 flex flex-col items-center justify-center">
                                    <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider">Final Estimated Price</p>
                                    <p className="text-3xl font-bold mt-1 text-foreground">${safeFmt((latest?.[calc.index as keyof typeof latest] as number || 0) + (calc.baseAdjust || 0))}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* HPB Estimation Calculator */}
                    <div className="card-elevated p-5 md:p-6 border border-border/50">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="text-base font-bold flex items-center gap-2 text-rose-500"><Calculator className="w-5 h-5" /> HPB Estimation</h3>
                                <p className="text-xs text-muted-foreground mt-1">Estimate HPB price based on actual coal spec quality.</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                                <label className="text-[10px] font-semibold text-muted-foreground uppercase">GAR</label>
                                <input type="number" value={hpbCalc.gar} onChange={(e) => setHpbCalc({ ...hpbCalc, gar: +e.target.value })} className="w-full mt-1.5 px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-rose-500/50" />
                            </div>
                            <div>
                                <label className="text-[10px] font-semibold text-muted-foreground uppercase">TM (%)</label>
                                <input type="number" step="0.1" value={hpbCalc.tm} onChange={(e) => setHpbCalc({ ...hpbCalc, tm: +e.target.value })} className="w-full mt-1.5 px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-rose-500/50" />
                            </div>
                            <div>
                                <label className="text-[10px] font-semibold text-muted-foreground uppercase">TS (%)</label>
                                <input type="number" step="0.01" value={hpbCalc.ts} onChange={(e) => setHpbCalc({ ...hpbCalc, ts: +e.target.value })} className="w-full mt-1.5 px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-rose-500/50" />
                            </div>
                            <div>
                                <label className="text-[10px] font-semibold text-muted-foreground uppercase">ASH (%)</label>
                                <input type="number" step="0.1" value={hpbCalc.ash} onChange={(e) => setHpbCalc({ ...hpbCalc, ash: +e.target.value })} className="w-full mt-1.5 px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-rose-500/50" />
                            </div>
                        </div>
                        <div className="pt-4 mt-4 border-t border-border/50">
                            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex flex-col items-center justify-center">
                                <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Estimated HPB Value</p>
                                <p className="text-3xl font-bold mt-1 text-foreground">${safeFmt(calculateHpbEstimate())}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Chart */}
                <div className="card-elevated p-5 animate-slide-up delay-2">
                    <h3 className="text-sm font-semibold mb-4">Price Trend</h3>
                    <div className="h-[350px]">
                        {mounted && (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.1)" />
                                    <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '11px' }} />
                                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                                    <Line type="monotone" dataKey="ICI 1 (6500)" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                                    <Line type="monotone" dataKey="ICI 2 (5800)" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                                    <Line type="monotone" dataKey="ICI 3 (5000)" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                                    <Line type="monotone" dataKey="ICI 4 (4200)" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                                    <Line type="monotone" dataKey="ICI 5 (3400)" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                                    <Line type="monotone" dataKey="Newcastle" stroke="#ec4899" strokeWidth={2} dot={{ r: 3 }} />
                                    <Bar dataKey="HBA" fill="#10b98130" stroke="#10b981" strokeWidth={1} barSize={20} radius={[4, 4, 0, 0]} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Input form */}
                {showForm && (
                    <div className="card-elevated p-5 space-y-4 animate-scale-in">
                        <h3 className="text-sm font-semibold">Input New Price Data</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div><label className="text-[10px] font-semibold text-muted-foreground uppercase">Date</label>
                                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-accent/50 border border-border text-sm outline-none focus:border-primary/50" /></div>
                            {[["ICI 1", "ici_1"], ["ICI 2", "ici_2"], ["ICI 3", "ici_3"], ["ICI 4", "ici_4"], ["ICI 5", "ici_5"], ["Newcastle", "newcastle"], ["HBA", "hba"], ["HBA I", "hba_1"], ["HBA II", "hba_2"], ["HBA III", "hba_3"]].map(([label, key]) => (
                                <div key={key}><label className="text-[10px] font-semibold text-muted-foreground uppercase">{label} (USD)</label>
                                    <input type="number" step="0.01" value={(form as any)[key] || ""} onChange={(e) => setForm({ ...form, [key]: +e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-accent/50 border border-border text-sm outline-none focus:border-primary/50" /></div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleSubmit} className="btn-primary" disabled={isSaving}>
                                {isSaving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-4 h-4 mr-1" /> Save
                                    </     >
                                )}
                            </button>
                            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors" disabled={isSaving}>Cancel</button>
                        </div>
                    </div>
                )}

                {/* Price Table */}
                <div className="card-elevated overflow-hidden animate-slide-up delay-3">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b border-border bg-accent/30">
                            {["Date", "ICI 1", "ICI 2", "ICI 3", "ICI 4", "ICI 5", "Newcastle", "HBA", "HBA I", "HBA II", "HBA III"].map((h) => (
                                <th key={h} className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase first:text-left">{h}</th>
                            ))}
                        </tr></thead>
                        <tbody>
                            {marketPrices.map((p) => (
                                <tr key={p.id} className="border-b border-border/50 hover:bg-accent/20">
                                    <td className="px-4 py-2.5 text-xs">{new Date(p.date).toLocaleDateString("en", { day: "2-digit", month: "short", year: "2-digit" })}</td>
                                    <td className="px-4 py-2.5 text-xs text-right font-mono">${safeFmt(p.ici_1)}</td>
                                    <td className="px-4 py-2.5 text-xs text-right font-mono">${safeFmt(p.ici_2)}</td>
                                    <td className="px-4 py-2.5 text-xs text-right font-mono">${safeFmt(p.ici_3)}</td>
                                    <td className="px-4 py-2.5 text-xs text-right font-mono">${safeFmt(p.ici_4)}</td>
                                    <td className="px-4 py-2.5 text-xs text-right font-mono">${safeFmt(p.ici_5)}</td>
                                    <td className="px-4 py-2.5 text-xs text-right font-mono">${safeFmt(p.newcastle)}</td>
                                    <td className="px-4 py-2.5 text-xs text-right font-mono font-bold text-emerald-500">${safeFmt(p.hba)}</td>
                                    <td className="px-4 py-2.5 text-xs text-right font-mono text-teal-500">${safeFmt(p.hba_1)}</td>
                                    <td className="px-4 py-2.5 text-xs text-right font-mono text-cyan-500">${safeFmt(p.hba_2)}</td>
                                    <td className="px-4 py-2.5 text-xs text-right font-mono text-sky-500">${safeFmt(p.hba_3)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {toast && (
                    <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
                )}
            </div>
        </AppShell>
    );
}
