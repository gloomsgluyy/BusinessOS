"use client";

import React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { MapPin, Navigation, Anchor, Ship, AlertTriangle, CheckCircle2, Factory } from "lucide-react";
import { cn } from "@/lib/utils";

// Demo Operation Live Tracking Data
const FLEETS = [
    { id: "BG-01", type: "barge", name: "Barge Trans 01", location: "Taboneo Anchorage", status: "loading", load_progress: 65, eta: "2024-03-10", cargo: "4200 GAR", amount: "7,500 MT" },
    { id: "MV-05", type: "vessel", name: "MV. Ocean Bulk", location: "Muara Pantai", status: "anchorage", load_progress: 0, eta: "2024-03-12", cargo: "5500 GAR", amount: "55,000 MT" },
    { id: "BG-03", type: "barge", name: "Barge Trans 03", location: "Jetty Kelanis", status: "sailing", load_progress: 100, eta: "2024-03-08", cargo: "4200 GAR", amount: "8,000 MT" },
];

const PORTS = [
    { id: "P1", name: "Port of Taboneo", vessels: 15, delay_status: "normal" },
    { id: "P2", name: "Muara Pantai Anchorage", vessels: 28, delay_status: "congested", weather: "Bad Weather" },
];

export default function OperationsClient() {
    return (
        <AppShell>
            <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Vessel Operations Command</h1>
                        <p className="text-sm text-muted-foreground mt-1">Live simulation map of fleet logistics, loading progress, and port congestion.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Active Fleet */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="bg-card border border-border/50 rounded-2xl shadow-sm p-5 relative overflow-hidden min-h-[400px]">
                            {/* Fake Map Background using CSS patterns */}
                            <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary to-transparent" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, currentcolor 1px, transparent 0)", backgroundSize: "32px 32px" }}></div>

                            <h3 className="font-bold flex items-center gap-2 relative z-10"><Navigation className="w-5 h-5 text-indigo-500" /> Live Tracking Board</h3>

                            <div className="mt-6 space-y-3 relative z-10">
                                {FLEETS.map(f => (
                                    <div key={f.id} className="p-4 bg-card border border-border rounded-xl flex flex-col sm:flex-row gap-4 items-center justify-between hover:border-primary/30 transition-colors">
                                        <div className="flex items-center gap-4 w-full sm:w-auto">
                                            <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center shrink-0">
                                                {f.type === "vessel" ? <Ship className="w-6 h-6 text-indigo-500" /> : <Anchor className="w-6 h-6 text-amber-500" />}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-sm text-foreground flex items-center gap-2">{f.name} <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/50 text-muted-foreground uppercase">{f.type}</span></h4>
                                                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> {f.location}</p>
                                            </div>
                                        </div>

                                        <div className="w-full sm:w-1/3 space-y-1.5 flex-1">
                                            <div className="flex justify-between text-xs">
                                                <span className="text-muted-foreground capitalize">{f.status}</span>
                                                <span className="font-medium">{f.load_progress}% Loaded</span>
                                            </div>
                                            <div className="h-2 bg-accent rounded-full overflow-hidden">
                                                <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${f.load_progress}%` }}></div>
                                            </div>
                                        </div>

                                        <div className="text-right w-full sm:w-auto mt-2 sm:mt-0">
                                            <p className="text-xs font-bold">{f.amount}</p>
                                            <p className="text-[10px] text-muted-foreground mt-0.5">ETA: {f.eta}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Port Status */}
                    <div className="space-y-4">
                        <div className="bg-card border border-border/50 rounded-2xl shadow-sm p-5">
                            <h3 className="font-bold flex items-center gap-2 mb-4"><Factory className="w-5 h-5 text-emerald-500" /> Loading Ports</h3>
                            <div className="space-y-3">
                                {PORTS.map(p => (
                                    <div key={p.id} className="p-3 bg-accent/30 rounded-xl border border-border/30">
                                        <div className="flex justify-between items-start">
                                            <h4 className="font-medium text-sm">{p.name}</h4>
                                            {p.delay_status === "congested" ? (
                                                <AlertTriangle className="w-4 h-4 text-rose-500" />
                                            ) : (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                            )}
                                        </div>
                                        <div className="mt-3 flex gap-2">
                                            <div className="px-2 py-1 bg-background rounded text-[10px] text-muted-foreground border border-border/50">
                                                <span className="font-bold text-foreground">{p.vessels}</span> Vessels
                                            </div>
                                            {p.weather && (
                                                <div className="px-2 py-1 bg-rose-500/10 text-rose-500 rounded text-[10px] font-medium border border-rose-500/20">
                                                    {p.weather}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-card border border-border/50 rounded-2xl shadow-sm p-5">
                            <h3 className="font-bold text-sm mb-2 text-rose-500">Operation Alerts</h3>
                            <div className="p-3 bg-rose-500/5 border border-rose-500/20 rounded-xl text-xs space-y-1">
                                <p className="font-medium text-rose-600 dark:text-rose-400">High Swell Warning</p>
                                <p className="text-muted-foreground">Muara Pantai anchorage experiencing 2.5m swells. Loading delayed for 12 hours.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppShell>
    );
}

