"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useOutstandingPaymentStore } from "@/store/outstanding-payment-store";
import { useCommercialStore } from "@/store/commercial-store";
import { FileText, Search, CreditCard, Calculator, CheckCircle2, AlertCircle, Plus, X, Edit, Trash2, Loader2, Upload, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Toast } from "@/components/shared/toast";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationControls } from "@/components/shared/pagination-controls";

const safeNum = (v: number | null | undefined): number => (v != null && !isNaN(v) ? v : 0);
const safeFmt = (v: number | null | undefined, decimals = 2): string => safeNum(v).toFixed(decimals);

export default function OutstandingPaymentPage() {
    const { outstandingPayments, syncPayments, updatePayment } = useOutstandingPaymentStore();
    const { shipments, syncFromMemory } = useCommercialStore();
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState<"all" | "pending" | "partial" | "paid">("all");
    const [showForm, setShowForm] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
    const [editData, setEditData] = useState<any>(null);
    const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
    const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);

    const initialForm = { shipment_id: "", shipment_name: "", invoice_number: "", invoice_document_id: "", payment_proof_document_id: "", perusahaan: "", kode_batu: "", price_incl_pph: 0, qty: 0, total_dp: 0, calculation_date: "", dp_to_shipment: "", due_date: "", dispute_status: "", notes: "", timeframe_days: "", status: "pending", year: 2026 };
    const [form, setForm] = useState(initialForm);

    const handleOpenForm = (data?: any) => {
        if (data) {
            setEditData(data);
            setForm({
                shipment_id: data.shipment_id || "",
                shipment_name: data.shipment_name || "",
                invoice_number: data.invoice_number || "",
                invoice_document_id: data.invoice_document_id || "",
                payment_proof_document_id: data.payment_proof_document_id || "",
                perusahaan: data.perusahaan,
                kode_batu: data.kode_batu || "",
                price_incl_pph: data.price_incl_pph || 0,
                qty: data.qty || 0,
                total_dp: data.total_dp || 0,
                calculation_date: data.calculation_date ? new Date(data.calculation_date).toISOString().split('T')[0] : "",
                dp_to_shipment: data.dp_to_shipment ? new Date(data.dp_to_shipment).toISOString().split('T')[0] : "",
                due_date: data.due_date ? new Date(data.due_date).toISOString().split('T')[0] : "",
                dispute_status: data.dispute_status || "",
                notes: data.notes || "",
                timeframe_days: data.timeframe_days || "",
                status: data.status || "pending",
                year: data.year || 2026
            });
        } else {
            setEditData(null);
            setForm(initialForm);
        }
        setInvoiceFile(null);
        setPaymentProofFile(null);
        setShowForm(true);
    };

    const uploadPaymentDocument = async (file: File, kind: "invoice" | "payment_proof", shipmentId: string) => {
        const formData = new FormData();
        const invoiceSuffix = form.invoice_number ? ` - ${form.invoice_number}` : "";
        formData.append("file", file);
        formData.append("documentGroup", "additional");
        formData.append("requirementCode", kind === "invoice" ? "PAYMENT_INVOICE" : "PAYMENT_PROOF");
        formData.append("requirementLabel", kind === "invoice" ? "Payment Invoice" : "Payment Proof");
        formData.append("title", `${kind === "invoice" ? "Payment Invoice" : "Payment Proof"}${invoiceSuffix}`);
        formData.append("status", kind === "invoice" ? "received" : "submitted");
        formData.append("notes", `Linked from Outstanding Payment${invoiceSuffix}`);

        const res = await fetch(`/api/shipments/${shipmentId}/documents`, { method: "POST", body: formData });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to upload payment document");
        return data.document?.id as string | undefined;
    };

    const handleSave = async () => {
        if (!form.perusahaan) {
            setToast({ message: "Company name is required", type: "error" });
            return;
        }
        setIsSaving(true);
        try {
            if ((invoiceFile || paymentProofFile) && !form.shipment_id) {
                setToast({ message: "Linked shipment is required before uploading payment documents", type: "error" });
                setIsSaving(false);
                return;
            }
            let invoiceDocumentId = form.invoice_document_id;
            let paymentProofDocumentId = form.payment_proof_document_id;
            if (invoiceFile && form.shipment_id) {
                invoiceDocumentId = await uploadPaymentDocument(invoiceFile, "invoice", form.shipment_id) || invoiceDocumentId;
            }
            if (paymentProofFile && form.shipment_id) {
                paymentProofDocumentId = await uploadPaymentDocument(paymentProofFile, "payment_proof", form.shipment_id) || paymentProofDocumentId;
            }
            const payload = {
                ...form,
                invoice_document_id: invoiceDocumentId,
                payment_proof_document_id: paymentProofDocumentId,
                shipment_name: form.shipment_id ? (shipments.find((s) => s.id === form.shipment_id)?.mv_project_name || shipments.find((s) => s.id === form.shipment_id)?.vessel_name || form.shipment_name) : form.shipment_name,
                calculation_date: form.calculation_date ? new Date(form.calculation_date).toISOString() : null as unknown as string,
                dp_to_shipment: form.dp_to_shipment ? new Date(form.dp_to_shipment).toISOString() : null as unknown as string,
                due_date: form.due_date ? new Date(form.due_date).toISOString() : null as unknown as string,
            };

            if (editData) {
                await updatePayment(editData.id, payload as any);
                setToast({ message: "Payment updated successfully", type: "success" });
            } else {
                await useOutstandingPaymentStore.getState().addPayment(payload as any);
                setToast({ message: "Payment added successfully", type: "success" });
            }
            setInvoiceFile(null);
            setPaymentProofFile(null);
            setShowForm(false);
        } catch (error: any) {
            setToast({ message: error?.message || "Failed to save payment record", type: "error" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this record?")) return;
        try {
            await useOutstandingPaymentStore.getState().deletePayment(id);
            setToast({ message: "Record deleted", type: "success" });
        } catch (e) {
            setToast({ message: "Failed to delete record", type: "error" });
        }
    };

    useEffect(() => {
        syncPayments();
        syncFromMemory();
    }, [syncPayments, syncFromMemory]);

    const filtered = outstandingPayments.filter(p => {
        const matchesSearch = p.perusahaan.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.kode_batu && p.kode_batu.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesTab = activeTab === "all" || p.status.toLowerCase() === activeTab;
        return matchesSearch && matchesTab;
    });

    const totalQty = outstandingPayments.reduce((s, p) => s + safeNum(p.qty), 0);
    const totalDp = outstandingPayments.reduce((s, p) => s + safeNum(p.total_dp), 0);

    const { page, pageSize, setPage, setPageSize } = usePagination({ defaultPageSize: 10 });
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const paginatedData = filtered.slice((page - 1) * pageSize, page * pageSize);

    return (
        <AppShell>
            <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6 animate-fade-in">
                {/* Header */}
                <div className="card-elevated p-6 border-l-4 border-l-emerald-500 relative overflow-hidden">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <div className="relative z-10 flex items-center gap-3">
                            <CreditCard className="w-8 h-8 text-emerald-500" />
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight">Outstanding Payment</h1>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Manage and track outstanding advance payments & DP</p>
                            </div>
                        </div>
                        <div className="flex gap-2 relative z-10">
                            <button onClick={() => handleOpenForm()} className="btn-primary text-xs h-9"><Plus className="w-4 h-4 mr-1.5" /> New Payment Record</button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 relative z-10 mt-6 md:w-2/3">
                        <div className="bg-card shadow-sm p-4 rounded-xl border border-border/30 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-emerald-500/20">
                                <CreditCard className="w-5 h-5 text-emerald-500" />
                            </div>
                            <div>
                                <p className="text-xl font-bold text-foreground leading-none mb-1">{outstandingPayments.length}</p>
                                <p className="text-[10px] text-muted-foreground">Total Records</p>
                            </div>
                        </div>
                        <div className="bg-card shadow-sm p-4 rounded-xl border border-border/30 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-blue-500/20">
                                <FileText className="w-5 h-5 text-blue-500" />
                            </div>
                            <div>
                                <p className="text-xl font-bold text-foreground leading-none mb-1">{safeFmt(totalQty / 1000, 1)}K</p>
                                <p className="text-[10px] text-muted-foreground">Total Qty (MT)</p>
                            </div>
                        </div>
                        <div className="bg-card shadow-sm p-4 rounded-xl border border-border/30 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-amber-500/20">
                                <Calculator className="w-5 h-5 text-amber-500" />
                            </div>
                            <div>
                                <p className="text-xl font-bold text-foreground leading-none mb-1">Rp {safeFmt(totalDp / 1000000000, 2)}B</p>
                                <p className="text-[10px] text-muted-foreground">Total DP IDR</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex bg-accent/30 p-1 rounded-xl w-full md:w-auto overflow-x-auto hide-scrollbar">
                        {(["all", "pending", "partial", "paid"] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={cn(
                                    "flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold uppercase transition-all whitespace-nowrap",
                                    activeTab === tab ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    <div className="relative w-full md:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search company..."
                            className="w-full pl-9 pr-4 py-2 rounded-xl bg-accent/30 border border-border text-xs outline-none focus:border-emerald-500/50 transition-colors"
                        />
                    </div>
                </div>

                {/* Data Table */}
                <div className="card-elevated overflow-hidden bg-card">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-[10px] text-muted-foreground uppercase bg-muted/50 border-b border-border">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Tahun</th>
                                    <th className="px-6 py-4 font-semibold">Shipment</th>
                                    <th className="px-6 py-4 font-semibold">Perusahaan</th>
                                    <th className="px-6 py-4 font-semibold">Invoice</th>
                                    <th className="px-6 py-4 font-semibold">Kode Batu</th>
                                    <th className="px-6 py-4 font-semibold text-right">Price Incl PPh</th>
                                    <th className="px-6 py-4 font-semibold text-right">Qty (MT)</th>
                                    <th className="px-6 py-4 font-semibold text-right">Total DP (IDR)</th>
                                    <th className="px-6 py-4 font-semibold">Start Date (Calc)</th>
                                    <th className="px-6 py-4 font-semibold">DP To Shipment</th>
                                    <th className="px-6 py-4 font-semibold">Timeframe (Days)</th>
                                    <th className="px-6 py-4 font-semibold">Evidence</th>
                                    <th className="px-6 py-4 font-semibold text-center">Status</th>
                                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={14} className="px-6 py-12 text-center text-xs text-muted-foreground bg-accent/20">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <CreditCard className="w-8 h-8 text-muted-foreground/30" />
                                                <p>No outstanding payment records found matching the criteria.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : paginatedData.map(item => (
                                    <tr key={item.id} className="hover:bg-accent/40 transition-colors group cursor-pointer">
                                        <td className="px-6 py-4"><span className="text-xs font-semibold py-1 px-2 bg-accent/60 rounded text-foreground">{item.year}</span></td>
                                        <td className="px-6 py-4 text-xs font-semibold text-muted-foreground">{item.shipment_name || item.shipment_id || "-"}</td>
                                        <td className="px-6 py-4 font-bold text-foreground">{item.perusahaan}</td>
                                        <td className="px-6 py-4 font-mono text-xs">{item.invoice_number || "-"}</td>
                                        <td className="px-6 py-4 font-mono text-xs">{item.kode_batu || "-"}</td>
                                        <td className="px-6 py-4 text-right font-mono text-xs">Rp {item.price_incl_pph?.toLocaleString() || "0"}</td>
                                        <td className="px-6 py-4 text-right font-bold text-blue-500">{item.qty?.toLocaleString() || "0"}</td>
                                        <td className="px-6 py-4 text-right font-bold text-emerald-500">Rp {item.total_dp?.toLocaleString() || "0"}</td>
                                        <td className="px-6 py-4 text-xs font-semibold">{item.calculation_date ? new Date(item.calculation_date).toLocaleDateString() : "-"}</td>
                                        <td className="px-6 py-4 text-xs">{item.dp_to_shipment || "-"}</td>
                                        <td className="px-6 py-4 text-xs font-semibold">{item.timeframe_days || "-"}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1 text-[11px]">
                                                {item.shipment_id && item.invoice_document_id ? (
                                                    <a href={`/api/shipments/${item.shipment_id}/documents/${item.invoice_document_id}`} target="_blank" className="inline-flex items-center gap-1 text-emerald-600 hover:underline">
                                                        Invoice <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                ) : <span className="text-muted-foreground">Invoice -</span>}
                                                {item.shipment_id && item.payment_proof_document_id ? (
                                                    <a href={`/api/shipments/${item.shipment_id}/documents/${item.payment_proof_document_id}`} target="_blank" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                                                        Proof <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                ) : <span className="text-muted-foreground">Proof -</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {item.status.toLowerCase() === "paid" ? (
                                                <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-500 bg-emerald-500/10 py-1 px-2 rounded-lg">
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> PAID
                                                </div>
                                            ) : item.status.toLowerCase() === "partial" ? (
                                                <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-amber-500 bg-amber-500/10 py-1 px-2 rounded-lg">
                                                    <Calculator className="w-3.5 h-3.5" /> PARTIAL
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-rose-500 bg-rose-500/10 py-1 px-2 rounded-lg">
                                                    <AlertCircle className="w-3.5 h-3.5" /> PENDING
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={(e) => { e.stopPropagation(); handleOpenForm(item); }} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><Edit className="w-4 h-4" /></button>
                                                <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }} className="p-1.5 rounded-lg hover:bg-rose-500/20 text-rose-500"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {filtered.length > 0 && (
                    <div className="mt-4 flex justify-end">
                        <PaginationControls
                            page={page}
                            pageSize={pageSize}
                            totalItems={totalItems}
                            totalPages={totalPages}
                            hasNextPage={page < totalPages}
                            hasPrevPage={page > 1}
                            onPageChange={setPage}
                            onPageSizeChange={setPageSize}
                        />
                    </div>
                )}

                {/* Form Modal */}
                {showForm && (
                    <div className="modal-overlay z-50 fixed inset-0 flex items-center justify-center p-4">
                        <div className="modal-backdrop absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowForm(false)} />
                        <div className="modal-content relative bg-card border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl animate-scale-in p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-bold">{editData ? "Edit" : "New"} Payment Record</h2>
                                <button onClick={() => setShowForm(false)} className="p-2 hover:bg-accent rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-bold text-muted-foreground uppercase">Linked Shipment</label>
                                    <select value={form.shipment_id} onChange={e => {
                                        const selected = shipments.find((s) => s.id === e.target.value);
                                        setForm({ ...form, shipment_id: e.target.value, shipment_name: selected ? (selected.mv_project_name || selected.vessel_name || selected.nomination || selected.id) : "" });
                                    }} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-emerald-500/50">
                                        <option value="">No linked shipment</option>
                                        {shipments.slice(0, 300).map((shipment) => (
                                            <option key={shipment.id} value={shipment.id}>
                                                {shipment.mv_project_name || shipment.vessel_name || shipment.nomination || shipment.id} - {shipment.buyer || shipment.source || "-"}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Invoice Number</label>
                                    <input value={form.invoice_number} onChange={e => setForm({ ...form, invoice_number: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-emerald-500/50" /></div>
                                <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Perusahaan</label>
                                    <input value={form.perusahaan} onChange={e => setForm({ ...form, perusahaan: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-emerald-500/50" /></div>
                                <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Kode Batu (Optional)</label>
                                    <input value={form.kode_batu} onChange={e => setForm({ ...form, kode_batu: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-emerald-500/50" /></div>
                                <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Price Incl PPh (Rp)</label>
                                    <input type="number" value={form.price_incl_pph} onChange={e => setForm({ ...form, price_incl_pph: +e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-emerald-500/50" /></div>
                                <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Quantity (MT)</label>
                                    <input type="number" value={form.qty} onChange={e => setForm({ ...form, qty: +e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-emerald-500/50" /></div>
                                <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Total DP (Rp)</label>
                                    <input type="number" value={form.total_dp} onChange={e => setForm({ ...form, total_dp: +e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-emerald-500/50" /></div>
                                <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Tahun</label>
                                    <input type="number" value={form.year} onChange={e => setForm({ ...form, year: +e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-emerald-500/50" /></div>
                                <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Calculation Date</label>
                                    <input type="date" value={form.calculation_date} onChange={e => setForm({ ...form, calculation_date: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-emerald-500/50" /></div>
                                <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">DP to Shipment Date</label>
                                    <input type="date" value={form.dp_to_shipment} onChange={e => setForm({ ...form, dp_to_shipment: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-emerald-500/50" /></div>
                                <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Due Date</label>
                                    <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-emerald-500/50" /></div>
                                <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Dispute Status</label>
                                    <input value={form.dispute_status} onChange={e => setForm({ ...form, dispute_status: e.target.value })} placeholder="none / disputed / under review" className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-emerald-500/50" /></div>
                                <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Timeframe (Days/Notes)</label>
                                    <input value={form.timeframe_days} onChange={e => setForm({ ...form, timeframe_days: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-emerald-500/50" /></div>
                                <div className="space-y-1"><label className="text-[10px] font-bold text-muted-foreground uppercase">Status</label>
                                    <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-emerald-500/50">
                                        <option value="pending">Pending</option>
                                        <option value="partial">Partial</option>
                                        <option value="paid">Paid</option>
                                    </select>
                                </div>
                                <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-bold text-muted-foreground uppercase">Notes</label>
                                    <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-accent/30 border border-border text-sm outline-none focus:border-emerald-500/50" /></div>
                                <div className="space-y-2 rounded-lg border border-border bg-accent/20 p-3">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1"><Upload className="w-3.5 h-3.5" /> Invoice Document</label>
                                    {form.shipment_id && form.invoice_document_id && (
                                        <a href={`/api/shipments/${form.shipment_id}/documents/${form.invoice_document_id}`} target="_blank" className="text-xs text-emerald-600 hover:underline inline-flex items-center gap-1">
                                            Current invoice file <ExternalLink className="w-3 h-3" />
                                        </a>
                                    )}
                                    <input type="file" accept="image/*,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)} className="w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-500 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white" />
                                    <p className="text-[10px] text-muted-foreground">Stored under the linked shipment as PAYMENT_INVOICE.</p>
                                </div>
                                <div className="space-y-2 rounded-lg border border-border bg-accent/20 p-3">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1"><Upload className="w-3.5 h-3.5" /> Payment Proof</label>
                                    {form.shipment_id && form.payment_proof_document_id && (
                                        <a href={`/api/shipments/${form.shipment_id}/documents/${form.payment_proof_document_id}`} target="_blank" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1">
                                            Current payment proof <ExternalLink className="w-3 h-3" />
                                        </a>
                                    )}
                                    <input type="file" accept="image/*,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => setPaymentProofFile(e.target.files?.[0] || null)} className="w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-blue-500 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white" />
                                    <p className="text-[10px] text-muted-foreground">Stored under the linked shipment as PAYMENT_PROOF.</p>
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end gap-2">
                                <button onClick={() => setShowForm(false)} className="px-4 py-2 hover:bg-accent rounded-lg text-sm transition-colors text-muted-foreground" disabled={isSaving}>Cancel</button>
                                <button onClick={handleSave} className="btn-primary" disabled={isSaving}>
                                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Save Record"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            </div>
        </AppShell>
    );
}
