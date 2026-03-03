"use client";

import React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { cn } from "@/lib/utils";
import { Users, Building2, Truck, Search, MapPin, Mail, Phone, ExternalLink } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { Plus, Edit2, X, Trash2, Loader2 } from "lucide-react";
import { useDirectoryStore, DirectoryEntry } from "@/store/directory-store";
import { Toast } from "@/components/shared/toast";

export default function DirectoryPageClient() {
    const searchParams = useSearchParams();
    const initialFilter = (searchParams.get("filter") || "all") as "all" | "buyer" | "vendor" | "fleet";

    const { entries, addEntry, updateEntry, deleteEntry } = useDirectoryStore();
    const [filter, setFilter] = React.useState<"all" | "buyer" | "vendor" | "fleet">(initialFilter);
    const [search, setSearch] = React.useState("");
    const [showModal, setShowModal] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [toast, setToast] = React.useState<{ message: string; type: "success" | "error" } | null>(null);
    const [editItem, setEditItem] = React.useState<DirectoryEntry | null>(null);
    const [form, setForm] = React.useState<Partial<DirectoryEntry>>({ type: "buyer", status: "active" });

    const openModal = (item?: DirectoryEntry) => {
        if (item) {
            setEditItem(item);
            setForm({ ...item });
        } else {
            setEditItem(null);
            setForm({ type: "buyer", status: "active", name: "", region: "", pic: "", email: "", phone: "", fleet_size: undefined });
        }
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.name || !form.pic) {
            setToast({ message: "Complete required fields!", type: "error" });
            return;
        }
        setIsSaving(true);
        try {
            if (editItem) {
                await updateEntry(editItem.id, form as DirectoryEntry);
                setToast({ message: "Partner updated successfully!", type: "success" });
            } else {
                await addEntry(form as any);
                setToast({ message: "New partner added successfully!", type: "success" });
            }
            setShowModal(false);
        } catch (error) {
            setToast({ message: "Failed to save partner", type: "error" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this partner?")) return;
        try {
            await deleteEntry(id);
            setToast({ message: "Partner removed successfully", type: "success" });
        } catch (error) {
            setToast({ message: "Failed to delete partner", type: "error" });
        }
    };

    const filtered = entries.filter(d => {
        if (filter !== "all" && d.type !== filter) return false;
        if (search && !d.name.toLowerCase().includes(search.toLowerCase()) && !d.pic.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    const getIcon = (type: string) => {
        if (type === "buyer") return <Users className="w-5 h-5 text-blue-500" />;
        if (type === "vendor") return <Building2 className="w-5 h-5 text-emerald-500" />;
        return <Truck className="w-5 h-5 text-amber-500" />;
    };

    return (
        <AppShell>
            <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Unified Directory</h1>
                        <p className="text-sm text-muted-foreground mt-1">Manage global buyers, mining vendors, and fleet owners.</p>
                    </div>
                    <button onClick={() => openModal()} className="btn-primary h-9"><Plus className="w-4 h-4 mr-1.5" /> Add Partner</button>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-card p-4 rounded-xl border border-border/50 shadow-sm">
                    <div className="flex gap-2 p-1 bg-accent/30 rounded-lg">
                        {(["all", "buyer", "vendor", "fleet"] as const).map(f => (
                            <button key={f} onClick={() => setFilter(f)}
                                className={cn("px-4 py-1.5 rounded-md text-xs font-medium capitalize transition-all", filter === f ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
                                {f}
                            </button>
                        ))}
                    </div>
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input type="text" placeholder="Search entity or PIC..." value={search} onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:ring-1 focus:ring-primary outline-none" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map(d => (
                        <div key={d.id} className="p-5 bg-card border border-border/50 rounded-2xl shadow-sm hover:shadow-md transition-all hover:border-border group">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-accent/50 flex items-center justify-center">
                                        {getIcon(d.type)}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-sm text-foreground">{d.name}</h3>
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent text-muted-foreground capitalize mt-1 inline-block">{d.type}</span>
                                    </div>
                                </div>
                                <span className={cn("w-2 h-2 rounded-full", d.status === "active" ? "bg-emerald-500" : "bg-amber-500")} />
                            </div>

                            <div className="mt-5 space-y-2.5">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <MapPin className="w-3.5 h-3.5" /> <span>{d.region}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Users className="w-3.5 h-3.5" /> <span>PIC: {d.pic}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Mail className="w-3.5 h-3.5" /> <span>{d.email}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Phone className="w-3.5 h-3.5" /> <span>{d.phone}</span>
                                </div>
                                {d.type === "fleet" && (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Truck className="w-3.5 h-3.5" /> <span>Fleet Size: {d.fleet_size} units</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2 w-full mt-5">
                                <button onClick={() => openModal(d)} className="flex-1 py-2 rounded-xl border border-border/50 hover:bg-accent text-xs font-semibold text-foreground transition-colors flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0">
                                    <Edit2 className="w-3.5 h-3.5" /> Edit
                                </button>
                                <button onClick={() => handleDelete(d.id)} className="p-2 rounded-xl border border-red-500/20 text-red-500 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                    {filtered.length === 0 && (
                        <div className="col-span-full text-center py-12 text-muted-foreground">
                            <Users className="w-8 h-8 mx-auto opacity-20 mb-3" />
                            No partners found
                        </div>
                    )}
                </div>

                {/* Modal Add/Edit */}
                {showModal && (
                    <div className="modal-overlay">
                        <div className="modal-backdrop" onClick={() => setShowModal(false)} />
                        <div className="modal-content max-w-lg w-full bg-card border border-border rounded-xl shadow-lg p-6">
                            <div className="flex items-center justify-between mb-4 border-b border-border/30 pb-3">
                                <div>
                                    <h2 className="text-xl font-bold text-foreground">{editItem ? "Edit Partner" : "Add New Partner"}</h2>
                                    <p className="text-xs text-muted-foreground mt-0.5">Fill in the entity details below</p>
                                </div>
                                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-accent bg-accent/50 text-muted-foreground"><X className="w-4 h-4" /></button>
                            </div>

                            <div className="space-y-4 text-sm mt-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-semibold text-muted-foreground uppercase">Partner Type</label>
                                        <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as any })} className="w-full mt-1 px-3 py-2 bg-accent/50 border border-border rounded-lg text-xs outline-none focus:border-primary/50">
                                            <option value="buyer">Buyer</option>
                                            <option value="vendor">Vendor / Supplier</option>
                                            <option value="fleet">Fleet Owner</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-semibold text-muted-foreground uppercase">Status</label>
                                        <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as any })} className="w-full mt-1 px-3 py-2 bg-accent/50 border border-border rounded-lg text-xs outline-none focus:border-primary/50">
                                            <option value="active">Active</option>
                                            <option value="under_review">Under Review</option>
                                            <option value="inactive">Inactive</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">Company Name</label>
                                    <input type="text" value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full mt-1 px-3 py-2 bg-accent/50 border border-border rounded-lg text-xs outline-none focus:border-primary/50" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-semibold text-muted-foreground uppercase">Region / Office</label>
                                        <input type="text" value={form.region || ""} onChange={e => setForm({ ...form, region: e.target.value })} className="w-full mt-1 px-3 py-2 bg-accent/50 border border-border rounded-lg text-xs outline-none focus:border-primary/50" placeholder="e.g. Jakarta, ID" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-semibold text-muted-foreground uppercase">PIC / Contact Person</label>
                                        <input type="text" value={form.pic || ""} onChange={e => setForm({ ...form, pic: e.target.value })} className="w-full mt-1 px-3 py-2 bg-accent/50 border border-border rounded-lg text-xs outline-none focus:border-primary/50" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-semibold text-muted-foreground uppercase">Email</label>
                                        <input type="email" value={form.email || ""} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full mt-1 px-3 py-2 bg-accent/50 border border-border rounded-lg text-xs outline-none focus:border-primary/50" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-semibold text-muted-foreground uppercase">Phone</label>
                                        <input type="text" value={form.phone || ""} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full mt-1 px-3 py-2 bg-accent/50 border border-border rounded-lg text-xs outline-none focus:border-primary/50" />
                                    </div>
                                </div>

                                {form.type === "fleet" && (
                                    <div>
                                        <label className="text-[10px] font-semibold text-muted-foreground uppercase">Fleet Size (Units)</label>
                                        <input type="number" value={form.fleet_size || ""} onChange={e => setForm({ ...form, fleet_size: +e.target.value })} className="w-full mt-1 px-3 py-2 bg-accent/50 border border-border rounded-lg text-xs outline-none focus:border-primary/50" />
                                    </div>
                                )}
                            </div>

                            <div className="mt-6 flex justify-end gap-2 border-t border-border/30 pt-4">
                                <button onClick={() => setShowModal(false)} className="px-4 py-2 hover:bg-accent text-sm rounded-lg transition-colors" disabled={isSaving}>Cancel</button>
                                <button onClick={handleSave} className="btn-primary" disabled={isSaving}>
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        "Save Partner"
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {toast && (
                    <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
                )}
            </div>
        </AppShell >
    );
}

