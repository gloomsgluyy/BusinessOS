"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Activity, Route, LineChart, TrendingDown, ArrowRightLeft, CheckCircle2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AIOptimizationPage() {
    const router = useRouter();
    const [rerouteApplied, setRerouteApplied] = React.useState(false);
    const [blendSent, setBlendSent] = React.useState(false);
    const [showRouteForm, setShowRouteForm] = React.useState(false);
    const [routeForm, setRouteForm] = React.useState({ origin: "", destination: "", vessel: "", targetMargin: "" });

    const handleApplyRouteReq = () => {
        alert("Route Optimization Request Submitted!");
        setShowRouteForm(false);
    };

    const handleApplyReroute = () => {
        setRerouteApplied(true);
        setTimeout(() => {
            router.push("/shipment-monitor");
        }, 1500);
    };

    const handleSendToSimulator = () => {
        setBlendSent(true);
        setTimeout(() => {
            router.push("/blending");
        }, 1500);
    };

    return (
        <AppShell>
            <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fade-in relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-1 text-primary">
                            <Activity className="w-5 h-5" />
                            <span className="font-bold text-sm tracking-widest uppercase">Copilot</span>
                        </div>
                        <h1 className="text-xl md:text-2xl font-bold">Optimization & Analytics</h1>
                        <p className="text-sm text-muted-foreground">Predictive logistics and blended cost routing</p>
                    </div>
                    <div className="flex mt-4 md:mt-0 z-10 relative">
                        <button onClick={() => setShowRouteForm(!showRouteForm)} className="btn-primary h-9"><Plus className="w-4 h-4 mr-1.5" /> Add Route Request</button>
                    </div>
                </div>

                {showRouteForm && (
                    <div className="card-elevated p-5 space-y-4 animate-scale-in border border-primary/20 bg-primary/5">
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-bold text-primary">Request Custom Route Optimization</h3>
                            <button onClick={() => setShowRouteForm(false)} className="p-1 hover:bg-black/10 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div><label className="text-[10px] font-semibold text-muted-foreground uppercase">Origin Port</label>
                                <input value={routeForm.origin} onChange={(e) => setRouteForm({ ...routeForm, origin: e.target.value })} placeholder="e.g. Samarinda" className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary/50" /></div>
                            <div><label className="text-[10px] font-semibold text-muted-foreground uppercase">Destination</label>
                                <input value={routeForm.destination} onChange={(e) => setRouteForm({ ...routeForm, destination: e.target.value })} placeholder="e.g. Qingdao" className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary/50" /></div>
                            <div><label className="text-[10px] font-semibold text-muted-foreground uppercase">Target Margin (USD)</label>
                                <input type="number" value={routeForm.targetMargin} onChange={(e) => setRouteForm({ ...routeForm, targetMargin: e.target.value })} placeholder="Target GP/MT" className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary/50" /></div>
                            <div><label className="text-[10px] font-semibold text-muted-foreground uppercase">Vessel Size</label>
                                <select value={routeForm.vessel} onChange={(e) => setRouteForm({ ...routeForm, vessel: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary/50">
                                    <option value="">Select Size</option>
                                    <option value="Supramax">Supramax (50k MT)</option>
                                    <option value="Panamax">Panamax (70k MT)</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleApplyRouteReq} className="px-4 py-2 rounded-lg text-sm font-bold bg-primary text-primary-foreground shadow-md hover:-translate-y-0.5 transition-all"><Activity className="w-4 h-4 inline mr-1.5" /> Optimize Route</button>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-slide-up">

                    {/* Route Optimization */}
                    <div className="card-elevated p-6 bg-indigo-500/5 border border-indigo-500/20 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Route className="w-32 h-32" />
                        </div>
                        <h3 className="font-bold text-lg mb-2 text-indigo-400">Logistics Route Optimization</h3>
                        <p className="text-sm text-muted-foreground mb-6 max-w-sm">Analysis of current vessel positions, weather data, and port congestion to recommend the most cost-effective routing.</p>

                        <div className="space-y-4">
                            <div className="p-4 rounded-xl bg-card border border-border/50">
                                <div className="flex justify-between mb-3 text-xs uppercase text-muted-foreground font-semibold">
                                    <span>Current Plan</span>
                                    <span>System Recommendation</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <p className="font-bold">MV Global Star</p>
                                        <p className="text-sm text-red-400">Port Samarinda (High Congestion)</p>
                                        <p className="text-xs text-muted-foreground">Est. Demurrage: $12k/day</p>
                                    </div>
                                    <ArrowRightLeft className="w-5 h-5 text-indigo-500 shrink-0 mx-4 animate-pulse" />
                                    <div className="space-y-1 text-right">
                                        <p className="font-bold text-emerald-400">Reroute Validated</p>
                                        <p className="text-sm">Port Balikpapan (Clear)</p>
                                        <p className="text-xs text-muted-foreground">Est. Saving: <span className="text-emerald-400 font-bold">$34,500</span></p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleApplyReroute}
                                    disabled={rerouteApplied}
                                    className={cn(
                                        "w-full mt-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2",
                                        rerouteApplied
                                            ? "bg-emerald-500 text-white cursor-default"
                                            : "bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-white"
                                    )}
                                >
                                    {rerouteApplied ? (
                                        <><CheckCircle2 className="w-4 h-4" /> Reroute Applied! Redirecting...</>
                                    ) : (
                                        "Apply Reroute"
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Cost Blending Optimization */}
                    <div className="card-elevated p-6 bg-emerald-500/5 border border-emerald-500/20 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <TrendingDown className="w-32 h-32" />
                        </div>
                        <h3 className="font-bold text-lg mb-2 text-emerald-400">Predictive Blending Margin</h3>
                        <p className="text-sm text-muted-foreground mb-6 max-w-sm">Scanning available stock across all suppliers to find the highest margin blend meeting Buyer&apos;s specifications.</p>

                        <div className="space-y-4">
                            <div className="p-4 rounded-xl bg-card border border-border/50">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Opportunity Detected</span>
                                </div>
                                <p className="text-sm mb-4">Target: <strong>GAR 4200 (Deal: SO-2024-812)</strong></p>
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div className="p-3 bg-accent/30 rounded-lg">
                                        <p className="text-[10px] uppercase text-muted-foreground mb-1">Standard Blend Cost</p>
                                        <p className="font-mono text-lg font-bold">Rp 640k / MT</p>
                                    </div>
                                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                                        <p className="text-[10px] uppercase text-emerald-500 mb-1">Optimized Cost</p>
                                        <p className="font-mono text-lg font-bold text-emerald-400">Rp 595k / MT</p>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground mb-4">Recommended mix: 65% Supplier A (GAR 4400) + 35% Supplier F (GAR 3800 - Distressed Cargo).</p>
                                <button
                                    onClick={handleSendToSimulator}
                                    disabled={blendSent}
                                    className={cn(
                                        "w-full py-2 rounded-lg text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2",
                                        blendSent
                                            ? "bg-emerald-500 text-white cursor-default"
                                            : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white"
                                    )}
                                >
                                    {blendSent ? (
                                        <><CheckCircle2 className="w-4 h-4" /> Sent! Opening Simulator...</>
                                    ) : (
                                        "Send to Simulator"
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* System Insights */}
                <div className="card-elevated p-6">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <LineChart className="w-4 h-4 text-primary" /> Market Sentiment Insights
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 border border-border/50 rounded-xl space-y-2">
                            <h4 className="font-bold text-sm">ICI Index Prediction</h4>
                            <p className="text-xs text-muted-foreground">Based on historical data and current thermal coal demand in China/India, 4200 GAR is projected to rise $1.5 in the next 14 days.</p>
                            <span className="text-[10px] font-bold text-amber-500 uppercase">Hold Inventory</span>
                        </div>
                        <div className="p-4 border border-border/50 rounded-xl space-y-2">
                            <h4 className="font-bold text-sm">Freight Rates</h4>
                            <p className="text-xs text-muted-foreground">Barge rates in South Kalimantan are trending down 5%. Good opportunity to lock in long-term contracts for Q3.</p>
                            <span className="text-[10px] font-bold text-emerald-500 uppercase">Action Recommended</span>
                        </div>
                        <div className="p-4 border border-border/50 rounded-xl space-y-2 opacity-50">
                            <h4 className="font-bold text-sm">Supplier Risk</h4>
                            <p className="text-xs text-muted-foreground">Gathering data on recent PSI failure rates...</p>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Processing</span>
                        </div>
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
