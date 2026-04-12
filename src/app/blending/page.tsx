"use client";

import React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useCommercialStore } from "@/store/commercial-store";
import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";
import { CoalSpec, BlendingResult } from "@/types";
import { Beaker, Plus, Trash2, History, ArrowRight, Download, Activity } from "lucide-react";
import { ReportModal } from "@/components/shared/report-modal";

interface BlendInput {
    name: string;
    quantity: number;
    gar: number; ts: number; ash: number; tm: number;
}

export default function BlendingPage() {
    const [, setIsInitializing] = React.useState(false);

    const { simulateBlend, blendingHistory, sources, syncFromMemory } = useCommercialStore();
    const { currentUser } = useAuthStore();
    const [inputs, setInputs] = React.useState<BlendInput[]>([
        { name: "Cargo A", quantity: 30000, gar: 4200, ts: 0.8, ash: 5.0, tm: 30 },
        { name: "Cargo B", quantity: 20000, gar: 5000, ts: 0.5, ash: 3.5, tm: 22 },
    ]);
    const [result, setResult] = React.useState<BlendingResult | null>(null);
    const [showReportModal, setShowReportModal] = React.useState(false);
    const [isSimulating, setIsSimulating] = React.useState(false);

    React.useEffect(() => {
        syncFromMemory().finally(() => setIsInitializing(false));
    }, [syncFromMemory]);

    const addRow = () => setInputs([...inputs, { name: `Cargo ${String.fromCharCode(65 + inputs.length)}`, quantity: 0, gar: 4200, ts: 0.8, ash: 5.0, tm: 30 }]);
    const removeRow = (i: number) => setInputs(inputs.filter((_, idx) => idx !== i));
    const updateRow = (i: number, key: string, val: string | number) => setInputs(inputs.map((inp, idx) => idx === i ? { ...inp, [key]: val } : inp));

    const handleSimulate = async () => {
        if (!currentUser) return;
        setIsSimulating(true);
        try {
            const blendInputs = inputs.map((inp) => ({
                source_name: inp.name, quantity: inp.quantity,
                spec: { gar: inp.gar, ts: inp.ts, ash: inp.ash, tm: inp.tm } as CoalSpec,
            }));
            const r = await simulateBlend(blendInputs, currentUser?.id || "system");
            setResult(r);
        } finally {
            setIsSimulating(false);
        }
    };

    const loadFromSource = (idx: number, srcId: string) => {
        const src = sources.find((s) => s.id === srcId);
        if (src) setInputs(inputs.map((inp, i) => i === idx ? { ...inp, name: src.name, gar: src.spec.gar, ts: src.spec.ts, ash: src.spec.ash, tm: src.spec.tm || 30 } : inp));
    };

    // Live preview calculation
    const totalQty = inputs.reduce((s, inp) => s + inp.quantity, 0);
    const liveSpec = totalQty > 0 ? {
        gar: Math.round(inputs.reduce((s, inp) => s + inp.gar * inp.quantity, 0) / totalQty),
        ts: Math.round(inputs.reduce((s, inp) => s + inp.ts * inp.quantity, 0) / totalQty * 100) / 100,
        ash: Math.round(inputs.reduce((s, inp) => s + inp.ash * inp.quantity, 0) / totalQty * 100) / 100,
        tm: Math.round(inputs.reduce((s, inp) => s + inp.tm * inp.quantity, 0) / totalQty * 100) / 100,
    } : { gar: 0, ts: 0, ash: 0, tm: 0 };


    return (
        <AppShell>
            <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6">
                {/* Module Summary */}
                <div className="card-elevated p-6 animate-fade-in border-l-4 border-l-pink-500 relative overflow-hidden">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Beaker className="w-6 h-6 text-pink-500" /> Blending Simulasi</h1>
                            <p className="text-sm text-muted-foreground mt-1 max-w-xl">Simulate cargo mixing scenarios to forecast expected blended specifications in real-time.</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setShowReportModal(true)} className="btn-outline text-xs h-9 hidden sm:flex"><Download className="w-3.5 h-3.5 mr-1.5" /> Download Report</button>
                        </div>
                    </div>
                </div>

                {/* Split Screen Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

                    {/* LEFT: Input Panel (3 cols) */}
                    <div className="lg:col-span-3 space-y-4">
                        <div className="card-elevated p-5 space-y-4 animate-slide-up">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-violet-500/10 flex items-center justify-center text-violet-500 text-xs font-bold">IN</span>
                                Input Cargos
                            </h3>
                            {inputs.map((inp, i) => (
                                <div key={i} className="p-4 rounded-xl bg-accent/20 border border-border/50 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-xs text-violet-500">{inp.name}</span>
                                        <div className="flex items-center gap-2">
                                            <select onChange={(e) => loadFromSource(i, e.target.value)} className="px-2 py-1 rounded bg-accent/50 border border-border text-[10px] outline-none" defaultValue="">
                                                <option value="">Load from Supplier...</option>
                                                {sources.map((s) => <option key={s.id} value={s.id}>{s.name} (GAR {s.spec.gar})</option>)}
                                            </select>
                                            {inputs.length > 2 && <button onClick={() => removeRow(i)} className="p-1 rounded hover:bg-red-500/10 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-5 gap-2">
                                        <div>
                                            <label className="text-[9px] text-muted-foreground uppercase">Name</label>
                                            <input value={inp.name} onChange={(e) => updateRow(i, "name", e.target.value)} className="w-full px-2 py-1.5 rounded bg-background border border-border text-xs outline-none focus:border-primary/50" />
                                        </div>
                                        <div>
                                            <label className="text-[9px] text-muted-foreground uppercase">Qty (MT)</label>
                                            <input type="number" value={inp.quantity || ""} onChange={(e) => updateRow(i, "quantity", +e.target.value)} className="w-full px-2 py-1.5 rounded bg-background border border-border text-xs outline-none focus:border-primary/50" />
                                        </div>
                                        <div>
                                            <label className="text-[9px] text-muted-foreground uppercase">GAR</label>
                                            <input type="number" value={inp.gar} onChange={(e) => updateRow(i, "gar", +e.target.value)} className="w-full px-2 py-1.5 rounded bg-background border border-border text-xs outline-none focus:border-primary/50" />
                                        </div>
                                        <div>
                                            <label className="text-[9px] text-muted-foreground uppercase">TS%</label>
                                            <input type="number" step="0.01" value={inp.ts} onChange={(e) => updateRow(i, "ts", +e.target.value)} className="w-full px-2 py-1.5 rounded bg-background border border-border text-xs outline-none focus:border-primary/50" />
                                        </div>
                                        <div>
                                            <label className="text-[9px] text-muted-foreground uppercase">ASH%</label>
                                            <input type="number" step="0.01" value={inp.ash} onChange={(e) => updateRow(i, "ash", +e.target.value)} className="w-full px-2 py-1.5 rounded bg-background border border-border text-xs outline-none focus:border-primary/50" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div className="flex items-center gap-2">
                                <button onClick={addRow} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/50 text-xs font-medium hover:bg-accent transition-colors"><Plus className="w-3 h-3" /> Add Cargo</button>
                                <button onClick={handleSimulate} className="btn-primary text-xs"><Activity className="w-3.5 h-3.5" /> Simulate Blend</button>
                            </div>
                        </div>

                        {/* History */}
                        {blendingHistory.length > 0 && (
                            <div className="card-elevated p-5 space-y-3 animate-slide-up delay-2">
                                <h3 className="text-sm font-semibold flex items-center gap-2"><History className="w-4 h-4 text-muted-foreground" /> Recent Simulations</h3>
                                {blendingHistory.slice(0, 5).map((bh) => (
                                    <div key={bh.id} className="flex items-center gap-3 p-3 rounded-xl bg-accent/30 text-xs">
                                        <div className="flex-1">{bh.inputs.map((inp) => inp.source_name).join(" + ")}</div>
                                        <div className="font-mono text-muted-foreground">{bh.total_quantity.toLocaleString()} MT</div>
                                        <div className="font-semibold">GAR {bh.result_spec.gar}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* RIGHT: Output Panel (2 cols) */}
                    <div className="lg:col-span-2 space-y-4">
                        {/* Live Preview */}
                        <div className="card-elevated p-5 space-y-4 animate-slide-up border-2 border-dashed border-violet-500/30 sticky top-24">
                            <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 text-xs font-bold">OUT</span>
                                <h3 className="text-sm font-bold">Simulasi Kargo C</h3>
                                <span className="text-[9px] bg-violet-500/10 text-violet-500 px-1.5 py-0.5 rounded font-medium uppercase">Live Preview</span>
                            </div>

                            {/* Composition Summary */}
                            <div className="text-xs text-muted-foreground">
                                {inputs.map((inp, i) => (
                                    <span key={i}>
                                        {i > 0 && <span className="mx-1 text-violet-400">+</span>}
                                        <span className="font-medium text-foreground">{inp.name}</span>
                                        <span className="ml-1">({totalQty > 0 ? Math.round(inp.quantity / totalQty * 100) : 0}%)</span>
                                    </span>
                                ))}
                            </div>

                            <p className="text-xs text-muted-foreground">Total: <span className="font-bold text-foreground text-sm">{totalQty.toLocaleString()} MT</span></p>

                            {/* Live Spec Cards */}
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { label: "GAR", value: liveSpec.gar, unit: "kcal/kg", color: "text-red-500", bg: "bg-red-500/5 border-red-500/20" },
                                    { label: "TS", value: liveSpec.ts, unit: "%", color: "text-amber-500", bg: "bg-amber-500/5 border-amber-500/20" },
                                    { label: "ASH", value: liveSpec.ash, unit: "%", color: "text-gray-400", bg: "bg-gray-500/5 border-gray-500/20" },
                                    { label: "TM", value: liveSpec.tm, unit: "%", color: "text-blue-500", bg: "bg-blue-500/5 border-blue-500/20" },
                                ].map((s) => (
                                    <div key={s.label} className={cn("text-center p-4 rounded-xl border", s.bg)}>
                                        <p className="text-[10px] text-muted-foreground uppercase">{s.label}</p>
                                        <p className={cn("text-2xl font-black tracking-tight transition-all duration-300", s.color)}>{s.value}</p>
                                        <p className="text-[9px] text-muted-foreground">{s.unit}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Confirmed Result */}
                            {result && (
                                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2 animate-scale-in">
                                    <div className="flex items-center gap-2">
                                        <Activity className="w-4 h-4 text-emerald-500" />
                                        <span className="text-xs font-bold text-emerald-500 uppercase">Simulation Saved</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {result.inputs.map((inp) => inp.source_name).join(" + ")} = <span className="font-bold text-foreground">GAR {result.result_spec.gar}</span>
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">Saved at {new Date(result.created_at).toLocaleTimeString("id-ID")}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <ReportModal
                    isOpen={showReportModal}
                    onClose={() => setShowReportModal(false)}
                    moduleName="Blending Simulation"
                    onExport={(format, options) => {
                        console.log(`Exporting blending data as ${format}`, options);
                    }}
                />
            </div>
        </AppShell>
    );
}
