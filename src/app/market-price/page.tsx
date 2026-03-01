"use client";

import React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useCommercialStore } from "@/store/commercial-store";
import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";
import { Plus, TrendingUp, TrendingDown, Settings2, X, Calculator } from "lucide-react";
import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

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
    const { marketPrices, addMarketPrice } = useCommercialStore();
    const { hasPermission } = useAuthStore();
    const canEdit = hasPermission("market_price_edit");
    const [mounted, setMounted] = React.useState(false);
    const [showForm, setShowForm] = React.useState(false);
    const [showScrapeSettings, setShowScrapeSettings] = React.useState(false);
    const [autoScrape, setAutoScrape] = React.useState(true);
    const [scrapeInterval, setScrapeInterval] = React.useState("6_hours");
    const [calc, setCalc] = React.useState({ index: "ici_4", baseAdjust: 0, freight: 0 });
    const [form, setForm] = React.useState({ date: "", ici_1: 0, ici_2: 0, ici_3: 0, ici_4: 0, newcastle: 0, hba: 0 });
    const [isScraping, setIsScraping] = React.useState(false);
    const [scrapeLogs, setScrapeLogs] = React.useState<string[]>([]);
    const [lastScrapeTime, setLastScrapeTime] = React.useState<string | null>(null);

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
                addLog(`Newcastle: $${p.newcastle}`);
                addLog(`HBA: $${p.hba}`);
                // Check if this date already exists
                const exists = marketPrices.some(mp => mp.date === p.date);
                if (!exists) {
                    addMarketPrice({ date: p.date, ici_1: p.ici_1, ici_2: p.ici_2, ici_3: p.ici_3, ici_4: p.ici_4, newcastle: p.newcastle, hba: p.hba, source: p.source });
                    addLog("New price entry saved to store & synced.");
                } else {
                    addLog("Price for this date already exists. Skipped.");
                }
                setLastScrapeTime(new Date().toLocaleTimeString());
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

    // Auto-scrape interval
    React.useEffect(() => {
        if (!autoScrape) return;
        const intervals: Record<string, number> = { "1_min": 60000, "5_min": 300000, "1_hour": 3600000, "6_hours": 21600000, "12_hours": 43200000, "daily": 86400000 };
        const ms = intervals[scrapeInterval] || 21600000;
        // Fetch once on mount
        const timeout = setTimeout(() => fetchMarketPrices(), 3000);
        const interval = setInterval(fetchMarketPrices, ms);
        return () => { clearTimeout(timeout); clearInterval(interval); };
    }, [autoScrape, scrapeInterval]);

    const data = [...marketPrices].reverse().map((p) => ({
        date: new Date(p.date).toLocaleDateString("en", { month: "short", day: "numeric" }),
        "ICI 1 (6500)": p.ici_1, "ICI 2 (5800)": p.ici_2,
        "ICI 3 (5000)": p.ici_3, "ICI 4 (4200)": p.ici_4,
        Newcastle: p.newcastle, HBA: p.hba,
    }));

    const latest = marketPrices[0];
    const prev = marketPrices[1];
    const changes = latest && prev ? [
        { label: "ICI 1 (6500)", val: safeNum(latest.ici_1), diff: safeNum(latest.ici_1) - safeNum(prev.ici_1), color: "#ef4444" },
        { label: "ICI 2 (5800)", val: safeNum(latest.ici_2), diff: safeNum(latest.ici_2) - safeNum(prev.ici_2), color: "#f59e0b" },
        { label: "ICI 3 (5000)", val: safeNum(latest.ici_3), diff: safeNum(latest.ici_3) - safeNum(prev.ici_3), color: "#3b82f6" },
        { label: "ICI 4 (4200)", val: safeNum(latest.ici_4), diff: safeNum(latest.ici_4) - safeNum(prev.ici_4), color: "#8b5cf6" },
        { label: "Newcastle", val: safeNum(latest.newcastle), diff: safeNum(latest.newcastle) - safeNum(prev.newcastle), color: "#ec4899" },
        { label: "HBA", val: safeNum(latest.hba), diff: safeNum(latest.hba) - safeNum(prev.hba), color: "#10b981" },
    ] : [];

    const handleSubmit = () => {
        if (!form.date) {
            alert("Harap pilih tanggal terlebih dahulu");
            return;
        }
        addMarketPrice({ date: form.date, ici_1: form.ici_1 || 0, ici_2: form.ici_2 || 0, ici_3: form.ici_3 || 0, ici_4: form.ici_4 || 0, ici_5: 0, newcastle: form.newcastle || 0, hba: form.hba || 0, source: "Manual" });
        setShowForm(false);
        setForm({ date: "", ici_1: 0, ici_2: 0, ici_3: 0, ici_4: 0, newcastle: 0, hba: 0 });
    };

    if (!mounted) {
        return (
            <AppShell>
                <div className="flex items-center justify-center p-12 text-muted-foreground animate-pulse">Loading market data...</div>
            </AppShell>
        );
    }

    const calcBasePrice = latest ? (latest as any)[calc.index] || 0 : 0;
    const calcRecommended = calcBasePrice + calc.baseAdjust + calc.freight;

    return (
        <AppShell>
            <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fade-in">
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-3">
                            Market Price Index
                            {autoScrape && (
                                <span className="inline-flex items-center gap-1.5 text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded border border-emerald-500/20 font-bold uppercase tracking-wider">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> AI Scraping Active
                                </span>
                            )}
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
                                    <h2 className="text-lg font-bold">Automated Scraping</h2>
                                    <p className="text-xs text-muted-foreground mt-1">Configure automated intelligence gathering.</p>
                                </div>
                                <button onClick={() => setShowScrapeSettings(false)} className="p-2 hover:bg-accent rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                            </div>

                            <div className="space-y-5">
                                <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-accent/20">
                                    <div>
                                        <p className="text-sm font-semibold">Enable Auto-Fetch</p>
                                        <p className="text-[10px] text-muted-foreground">Automatically scrape index providers</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={autoScrape} onChange={(e) => setAutoScrape(e.target.checked)} className="sr-only peer" />
                                        <div className="w-9 h-5 bg-accent peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                                    </label>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Scraping Interval</label>
                                    <select value={scrapeInterval} onChange={(e) => setScrapeInterval(e.target.value)} disabled={!autoScrape} className="w-full px-3 py-2 bg-accent/30 rounded-lg border border-border text-sm outline-none focus:border-primary/50 disabled:opacity-50">
                                        <option value="1_min">Every 1 Minute (Testing)</option>
                                        <option value="5_min">Every 5 Minutes (Testing)</option>
                                        <option value="1_hour">Every 1 Hour</option>
                                        <option value="6_hours">Every 6 Hours</option>
                                        <option value="12_hours">Every 12 Hours</option>
                                        <option value="daily">Daily</option>
                                    </select>
                                </div>

                                <div className="space-y-2 pt-2 border-t border-border/50">
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase flex justify-between">
                                        <span>Target Sources</span>
                                        <span className="text-emerald-500 font-bold tracking-wider animate-pulse">Running...</span>
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {["GlobalCoal API", "Argus Media", "McCloskey", "ICE Futures"].map(source => (
                                            <label key={source} className="flex items-center gap-2 cursor-pointer opacity-80 hover:opacity-100">
                                                <input type="checkbox" defaultChecked disabled={!autoScrape} className="rounded text-emerald-500 focus:ring-emerald-500 bg-accent/30 border-border" />
                                                <span className="text-xs font-medium">{source}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-1.5 pt-2 border-t border-border/50">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-semibold text-muted-foreground uppercase">Live Scraping Logs</label>
                                        {lastScrapeTime && <span className="text-[9px] text-muted-foreground">Last: {lastScrapeTime}</span>}
                                    </div>
                                    <div className="bg-black/50 p-3 rounded-lg border border-border/50 space-y-1 font-mono text-[10px] h-32 overflow-y-auto">
                                        {scrapeLogs.length === 0 && <p className="text-muted-foreground">Waiting for scrape...</p>}
                                        {scrapeLogs.map((log, i) => (
                                            <p key={i} className={log.includes("Error") || log.includes("failed") ? "text-red-400" : log.includes("$") ? "text-emerald-400" : "text-muted-foreground"}>
                                                {log}
                                            </p>
                                        ))}
                                        {isScraping && <p className="text-blue-400 animate-pulse">[{new Date().toLocaleTimeString()}] Processing...</p>}
                                    </div>
                                </div>

                                <button onClick={fetchMarketPrices} disabled={isScraping} className="btn-outline w-full mt-2 disabled:opacity-50">
                                    {isScraping ? "Scraping..." : "Fetch Now"}
                                </button>
                                <button onClick={() => setShowScrapeSettings(false)} className="btn-primary w-full mt-2">
                                    Save Configuration
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Price Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {changes.map((c) => (
                        <div key={c.label} className="card-elevated p-4 animate-slide-up">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase">{c.label}</p>
                            <p className="text-lg font-bold mt-1" style={{ color: c.color }}>${c.val.toFixed(2)}</p>
                            <div className={cn("flex items-center gap-1 text-[10px] mt-0.5", c.diff >= 0 ? "text-emerald-500" : "text-red-500")}>
                                {c.diff >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {c.diff >= 0 ? "+" : ""}{c.diff.toFixed(2)}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Formula Calculator Section */}
                <div className="card-elevated p-5 md:p-6 animate-slide-up delay-1 border border-border/50">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <h3 className="text-base font-bold flex items-center gap-2 text-violet-500"><Calculator className="w-5 h-5" /> Live Formula Calculator</h3>
                            <p className="text-xs text-muted-foreground mt-1">Determine the recommended buying/selling price based on real-time market indices and adjustments.</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Base Index</label>
                                <select value={calc.index} onChange={(e) => setCalc({ ...calc, index: e.target.value })} className="w-full mt-1.5 px-3 py-2.5 rounded-xl bg-background border border-border text-sm font-medium outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 pr-8">
                                    <option value="ici_1">ICI 1 (6500) - ${safeFmt(latest?.ici_1)}</option>
                                    <option value="ici_2">ICI 2 (5800) - ${safeFmt(latest?.ici_2)}</option>
                                    <option value="ici_3">ICI 3 (5000) - ${safeFmt(latest?.ici_3)}</option>
                                    <option value="ici_4">ICI 4 (4200) - ${safeFmt(latest?.ici_4)}</option>
                                    <option value="newcastle">Newcastle - ${safeFmt(latest?.newcastle)}</option>
                                    <option value="hba">HBA - ${safeFmt(latest?.hba)}</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Premium / Discount (USD)</label>
                                <div className="relative mt-1.5">
                                    <input type="number" step="0.5" value={calc.baseAdjust || ""} onChange={(e) => setCalc({ ...calc, baseAdjust: +e.target.value })} placeholder="e.g. -2.5" className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm outline-none focus:border-violet-500/50 pl-8" />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-mono">$</span>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Freight Adjustment (USD)</label>
                                <div className="relative mt-1.5">
                                    <input type="number" step="0.5" value={calc.freight || ""} onChange={(e) => setCalc({ ...calc, freight: +e.target.value })} placeholder="e.g. 5.0" className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm outline-none focus:border-violet-500/50 pl-8" />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-mono">$</span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4 flex flex-col justify-center text-center">
                            <p className="text-[10px] font-bold text-violet-600 uppercase tracking-wider mb-2">Recommended Price</p>
                            <p className="text-3xl font-bold text-violet-700 font-mono">${calcRecommended.toFixed(2)}</p>
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
                            {[["ICI 1", "ici_1"], ["ICI 2", "ici_2"], ["ICI 3", "ici_3"], ["ICI 4", "ici_4"], ["Newcastle", "newcastle"], ["HBA", "hba"]].map(([label, key]) => (
                                <div key={key}><label className="text-[10px] font-semibold text-muted-foreground uppercase">{label} (USD)</label>
                                    <input type="number" step="0.01" value={(form as any)[key] || ""} onChange={(e) => setForm({ ...form, [key]: +e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-accent/50 border border-border text-sm outline-none focus:border-primary/50" /></div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleSubmit} className="btn-primary"><Plus className="w-4 h-4" /> Save</button>
                            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
                        </div>
                    </div>
                )}

                {/* Price Table */}
                <div className="card-elevated overflow-hidden animate-slide-up delay-3">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b border-border bg-accent/30">
                            {["Date", "ICI 1", "ICI 2", "ICI 3", "ICI 4", "Newcastle", "HBA"].map((h) => (
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
                                    <td className="px-4 py-2.5 text-xs text-right font-mono">${safeFmt(p.newcastle)}</td>
                                    <td className="px-4 py-2.5 text-xs text-right font-mono font-bold">${safeFmt(p.hba)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </AppShell>
    );
}
