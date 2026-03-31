"use client";

import React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { cn } from "@/lib/utils";
import { FolderKanban, Calendar, TrendingUp, Plus, X, Ship, MapPin, Search, Loader2 } from "lucide-react";
import { Toast } from "@/components/shared/toast";
import { useCommercialStore } from "@/store/commercial-store";
import { useAuthStore } from "@/store/auth-store";

export default function ProjectsPage() {
    const { deals, syncFromMemory, addDeal, updateDeal } = useCommercialStore();

    React.useEffect(() => {
        syncFromMemory();
    }, [syncFromMemory]);
    const { currentUser } = useAuthStore();

    const [showForm, setShowForm] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [toast, setToast] = React.useState<{ message: string; type: "success" | "error" } | null>(null);
    const [selectedProject, setSelectedProject] = React.useState<any | null>(null);
    const [search, setSearch] = React.useState("");

    const [assigningVesselId, setAssigningVesselId] = React.useState<string | null>(null);
    const [vesselNameInput, setVesselNameInput] = React.useState("");
    const [isAssigning, setIsAssigning] = React.useState(false);

    const [form, setForm] = React.useState({
        buyer: "",
        quantity: 50000,
        laycan_start: "",
        laycan_end: "",
        shipping_terms: "FOB",
        buyer_country: "Indonesia",
        gar: 4200
    });

    const projects = deals.filter(d => d.status === "confirmed");
    const filteredProjects = projects.filter(p => search ? p.buyer.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase()) : true);

    const handleCreateProject = async () => {
        setIsSaving(true);
        try {
            await addDeal({
                buyer: form.buyer,
                buyer_country: form.buyer_country,
                type: form.buyer_country === "Indonesia" ? "local" : "export",
                shipping_terms: form.shipping_terms,
                quantity: form.quantity,
                price_per_mt: 50, // mock default
                laycan_start: form.laycan_start,
                laycan_end: form.laycan_end,
                spec: { gar: form.gar, ts: 0.8, ash: 5.0, tm: 30 },
                status: "confirmed", // auto confirm as active project
                created_by: currentUser.id,
                created_by_name: currentUser.name,
                pic_id: currentUser.id,
                pic_name: currentUser.name,
                deal_number: `PRJ-${new Date().getFullYear()}${new Date().getMonth() + 1}-${Math.floor(100 + Math.random() * 900)}`,
                total_value: form.quantity * 50
            } as any);
            setToast({ message: "Project created successfully!", type: "success" });
            setShowForm(false);
            setForm({ buyer: "", quantity: 50000, laycan_start: "", laycan_end: "", shipping_terms: "FOB", buyer_country: "Indonesia", gar: 4200 });
        } catch (error) {
            setToast({ message: "Failed to create project", type: "error" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleAssignVessel = async () => {
        if (!assigningVesselId || !vesselNameInput.trim()) return;
        setIsAssigning(true);
        try {
            await updateDeal(assigningVesselId, { vessel_name: vesselNameInput.trim() } as any);
            setToast({ message: "Vessel assigned successfully!", type: "success" });
            // Update local selectedProject state
            setSelectedProject({ ...selectedProject, vessel_name: vesselNameInput.trim() });
            setAssigningVesselId(null);
        } catch (error) {
            setToast({ message: "Failed to assign vessel", type: "error" });
        } finally {
            setIsAssigning(false);
        }
    };

    return (
        <AppShell>
            <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fade-in relative z-10">
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold border-l-4 border-emerald-500 pl-3">Sales Projects</h1>
                        <p className="text-sm text-muted-foreground mt-1 ml-4">Manage execution of confirmed sales contracts</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search project..." className="pl-9 pr-4 py-2 w-48 focus:w-64 transition-all rounded-lg bg-accent/30 border border-border text-xs outline-none focus:border-emerald-500" />
                        </div>
                        <button onClick={() => setShowForm(!showForm)} className="btn-primary w-fit shadow-lg shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700">
                            <Plus className="w-4 h-4 mr-1.5" /> New Project
                        </button>
                    </div>
                </div>

                {/* Create Project Form */}
                {showForm && (
                    <div className="card-elevated p-5 space-y-4 animate-scale-in border border-emerald-500/30 bg-emerald-500/5 shadow-emerald-500/10">
                        <h3 className="text-sm font-semibold text-emerald-600 border-b border-emerald-500/20 pb-2">Add Independent Project</h3>
                        <p className="text-xs text-muted-foreground mb-4">Create a new active sales project directly without undergoing P&L workflow.</p>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                            <div><label className="text-[10px] font-semibold text-muted-foreground uppercase">Buyer Name</label>
                                <input value={form.buyer} onChange={(e) => setForm({ ...form, buyer: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" placeholder="e.g. PT KEPCO" /></div>
                            <div><label className="text-[10px] font-semibold text-muted-foreground uppercase">Country</label>
                                <select value={form.buyer_country} onChange={(e) => setForm({ ...form, buyer_country: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500">
                                    <option value="Indonesia">Indonesia</option>
                                    <option value="South Korea">South Korea</option>
                                    <option value="Japan">Japan</option>
                                    <option value="China">China</option>
                                </select></div>
                            <div><label className="text-[10px] font-semibold text-muted-foreground uppercase">Target QTY (MT)</label>
                                <input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: +e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" /></div>
                            <div><label className="text-[10px] font-semibold text-muted-foreground uppercase">Terms</label>
                                <select value={form.shipping_terms} onChange={(e) => setForm({ ...form, shipping_terms: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500">
                                    <option value="FOB">FOB</option>
                                    <option value="CIF">CIF</option>
                                    <option value="CFR">CFR</option>
                                </select></div>
                            <div><label className="text-[10px] font-semibold text-muted-foreground uppercase">Target GAR</label>
                                <input type="number" value={form.gar} onChange={(e) => setForm({ ...form, gar: +e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" /></div>
                            <div><label className="text-[10px] font-semibold text-muted-foreground uppercase">Laycan Start</label>
                                <input type="date" value={form.laycan_start} onChange={(e) => setForm({ ...form, laycan_start: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" /></div>
                            <div><label className="text-[10px] font-semibold text-muted-foreground uppercase">Laycan End</label>
                                <input type="date" value={form.laycan_end} onChange={(e) => setForm({ ...form, laycan_end: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" /></div>
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button onClick={handleCreateProject} className="btn-primary bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50" disabled={!form.buyer || !form.laycan_start || isSaving}>
                                {isSaving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    "Save Project"
                                )}
                            </button>
                            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm text-emerald-700/70 hover:bg-emerald-500/10 transition-colors font-medium" disabled={isSaving}>Cancel</button>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredProjects.map((p, i) => {
                        return (
                            <div key={p.id} onClick={() => setSelectedProject(p)} className={cn("card-interactive cursor-pointer p-0 overflow-hidden animate-slide-up hover:border-emerald-500/30 group", `delay-${Math.min((i % 5) + 1, 5)}`)}>
                                <div className="p-5 space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-bold text-base line-clamp-1 group-hover:text-emerald-500 transition-colors">{p.buyer}</h3>
                                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{p.deal_number || p.id}</p>
                                        </div>
                                        <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-600 px-2.5 py-1 rounded-md uppercase tracking-wider">
                                            ACTIVE
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 pt-2">
                                        <div>
                                            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Tonnage</p>
                                            <p className="text-sm font-bold font-mono text-emerald-600">{p.quantity.toLocaleString()} MT</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Shipping</p>
                                            <p className="text-sm font-bold">{p.shipping_terms}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-px pt-px bg-border/50">
                                    <div className="flex-1 flex flex-col items-center justify-center p-3 bg-card/80 backdrop-blur group-hover:bg-accent/30 transition-colors">
                                        <Calendar className="w-3.5 h-3.5 mb-1.5 text-muted-foreground" />
                                        <span className="text-[10px] font-semibold text-muted-foreground uppercase">Laycan</span>
                                        <span className="text-xs font-bold text-center mt-0.5">{p.laycan_start || 'TBA'}</span>
                                    </div>
                                    <div className="flex-1 flex flex-col items-center justify-center p-3 bg-card/80 backdrop-blur group-hover:bg-accent/30 transition-colors">
                                        <TrendingUp className="w-3.5 h-3.5 mb-1.5 text-muted-foreground" />
                                        <span className="text-[10px] font-semibold text-muted-foreground uppercase">Specs</span>
                                        <span className="text-xs font-bold text-center mt-0.5 whitespace-nowrap">GAR {p.spec?.gar || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {filteredProjects.length === 0 && (
                    <div className="text-center py-16 px-8 card-elevated border-dashed border-2">
                        <FolderKanban className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
                        <h3 className="text-lg font-bold mb-1">No Active Projects</h3>
                        <p className="text-sm text-muted-foreground max-w-sm mx-auto">Confirmed deals from the Sales Monitor will automatically appear here as active projects.</p>
                    </div>
                )}

                {/* Detail Modal */}
                {selectedProject && (
                    <div className="modal-overlay z-50 fixed inset-0 flex items-center justify-center p-4">
                        <div className="modal-backdrop absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setSelectedProject(null)} />
                        <div className="modal-content relative bg-card border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl animate-scale-in">

                            {/* Header */}
                            <div className="flex items-center justify-between p-6 border-b border-border bg-accent/10">
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <h2 className="text-2xl font-bold">{selectedProject.buyer}</h2>
                                        <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-600 px-2.5 py-1 rounded-md uppercase tracking-wider">ACTIVE PROJECT</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground font-mono">{selectedProject.deal_number || selectedProject.id} · {selectedProject.buyer_country}</p>
                                </div>
                                <button onClick={() => setSelectedProject(null)} className="p-2 hover:bg-accent/80 rounded-xl transition-colors shrink-0"><X className="w-5 h-5 text-muted-foreground" /></button>
                            </div>

                            <div className="p-6 space-y-8">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 rounded-xl bg-accent/20 border border-border/50">
                                    <div><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Tonnage</p><p className="text-lg font-bold font-mono text-emerald-600">{selectedProject.quantity.toLocaleString()} MT</p></div>
                                    <div><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Shipping</p><p className="text-lg font-bold">{selectedProject.shipping_terms}</p></div>
                                    <div><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Type</p><p className="text-lg font-bold capitalize">{selectedProject.type}</p></div>
                                    <div><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Spec</p><p className="text-lg font-bold">GAR {selectedProject.spec?.gar}</p></div>
                                </div>

                                <div>
                                    <h4 className="text-sm font-bold tracking-tight mb-4 flex items-center gap-2 border-b border-border pb-2"><Calendar className="w-4 h-4 text-emerald-500" /> Laycan Schedule</h4>
                                    <div className="flex flex-col sm:flex-row gap-0 sm:gap-6 p-5 rounded-xl border border-border bg-card">
                                        <div className="flex-1">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Start Date</p>
                                            <p className="font-semibold text-base">{selectedProject.laycan_start || 'Pending Date'}</p>
                                        </div>
                                        <div className="w-px bg-border my-2 hidden sm:block" />
                                        <div className="h-px w-full bg-border my-4 sm:hidden" />
                                        <div className="flex-1">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">End Date</p>
                                            <p className="font-semibold text-base">{selectedProject.laycan_end || 'Pending Date'}</p>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-sm font-bold tracking-tight mb-4 flex items-center gap-2 border-b border-border pb-2"><Ship className="w-4 h-4 text-sky-500" /> Vessel & Operations</h4>
                                    {selectedProject.vessel_name ? (
                                        <div className="p-5 rounded-xl border border-sky-500/20 bg-sky-500/5">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Vessel Assigned</p>
                                                    <p className="font-bold text-sky-600 text-lg">{selectedProject.vessel_name}</p>
                                                </div>
                                                <div className="w-10 h-10 rounded-full bg-sky-500/10 flex items-center justify-center shrink-0">
                                                    <Ship className="w-5 h-5 text-sky-500" />
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button className="px-4 py-2 bg-background border border-border shadow-sm rounded-lg text-xs font-bold hover:bg-accent transition-colors flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Track Vessel</button>
                                                <button className="px-4 py-2 bg-background border border-border shadow-sm rounded-lg text-xs font-bold hover:bg-accent transition-colors">Nominate Surveyor</button>
                                            </div>
                                        </div>
                                    ) : assigningVesselId === selectedProject.id ? (
                                        <div className="p-5 rounded-xl border border-sky-500/20 bg-sky-500/5 space-y-3">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Assign Vessel</p>
                                            <input
                                                autoFocus
                                                value={vesselNameInput}
                                                onChange={(e) => setVesselNameInput(e.target.value)}
                                                placeholder="e.g. MV Bulk Prosperity"
                                                className="w-full px-3 py-2 text-sm rounded-lg border border-border outline-none focus:border-sky-500"
                                            />
                                            <div className="flex gap-2 pt-1">
                                                <button onClick={handleAssignVessel} disabled={isAssigning || !vesselNameInput.trim()} className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-sm transition-colors disabled:opacity-50">
                                                    {isAssigning ? "Saving..." : "Save"}
                                                </button>
                                                <button onClick={() => setAssigningVesselId(null)} disabled={isAssigning} className="px-4 py-1.5 rounded-lg bg-background border border-border hover:bg-accent text-xs font-bold transition-colors">
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-8 rounded-xl border border-dashed border-border/80 bg-accent/10 text-center flex flex-col items-center">
                                            <Ship className="w-10 h-10 text-muted-foreground/30 mb-3" />
                                            <p className="text-base font-bold mb-1">No Vessel Assigned</p>
                                            <p className="text-xs text-muted-foreground mb-4 max-w-xs mx-auto leading-relaxed">Vessel nomination is pending from buyer/logistics. Please coordinate with operations.</p>
                                            <button onClick={() => { setAssigningVesselId(selectedProject.id); setVesselNameInput(""); }} className="px-5 py-2 rounded-lg bg-background border border-border text-xs font-bold hover:bg-accent transition-colors shadow-sm">Assign Vessel Now</button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-6 border-t border-border bg-accent/5 flex justify-end gap-3 rounded-b-2xl">
                                <button className="px-6 py-2 rounded-lg bg-background border border-border text-sm font-bold shadow-sm hover:bg-accent transition-colors" onClick={() => setSelectedProject(null)}>Close</button>
                            </div>
                        </div>
                    </div>
                )}
                {toast && (
                    <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
                )}
            </div>
        </AppShell>
    );
}
