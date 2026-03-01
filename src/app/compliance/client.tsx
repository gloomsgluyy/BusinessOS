"use client";

import React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { FileCheck, AlertOctagon, CheckCircle2, Clock, ShieldCheck, FileWarning } from "lucide-react";

const DOCUMENTS = [
    { id: "DOC-01", type: "IUP OP", name: "Izin Usaha Pertambangan Operasi Produksi", entity: "PT. Tambang Maju", expiry: "2027-12-31", status: "valid" },
    { id: "DOC-02", type: "RKAB", name: "Rencana Kerja & Anggaran Biaya 2024", entity: "PT. Tambang Maju", expiry: "2024-12-31", status: "valid" },
    { id: "DOC-03", type: "ET", name: "Eksportir Terdaftar (ET) Batubara", entity: "CoalTrade Resources", expiry: "2024-03-15", status: "expiring", warning: "Renew within 30 days" },
    { id: "DOC-04", type: "Env", name: "Izin Lingkungan AMDAL", entity: "CV. Mining Services", expiry: "2023-11-01", status: "expired" },
];

export default function ComplianceClient() {
    return (
        <AppShell>
            <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Legal & Compliance Hub</h1>
                        <p className="text-sm text-muted-foreground mt-1">Monitor expiration dates of critical mining licenses (IUP, RKAB) and export permits.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-5 bg-card border border-border/50 rounded-2xl shadow-sm text-center">
                        <div className="w-10 h-10 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
                            <ShieldCheck className="w-5 h-5 text-emerald-500" />
                        </div>
                        <p className="text-2xl font-bold text-foreground">14</p>
                        <p className="text-xs text-muted-foreground mt-1">Valid Licenses</p>
                    </div>
                    <div className="p-5 bg-card border border-border/50 rounded-2xl shadow-sm text-center">
                        <div className="w-10 h-10 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center mb-3">
                            <Clock className="w-5 h-5 text-amber-500" />
                        </div>
                        <p className="text-2xl font-bold text-foreground">3</p>
                        <p className="text-xs text-muted-foreground mt-1">Expiring Soon</p>
                    </div>
                    <div className="p-5 bg-card border border-border/50 rounded-2xl shadow-sm text-center">
                        <div className="w-10 h-10 mx-auto rounded-full bg-rose-500/10 flex items-center justify-center mb-3">
                            <AlertOctagon className="w-5 h-5 text-rose-500" />
                        </div>
                        <p className="text-2xl font-bold text-foreground">1</p>
                        <p className="text-xs text-muted-foreground mt-1">Expired Licenses</p>
                    </div>
                </div>

                <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-border/50 flex bg-accent/10">
                        <h3 className="font-bold flex items-center gap-2 text-sm"><FileCheck className="w-4 h-4 text-primary" /> Active Document Register</h3>
                    </div>
                    <div className="divide-y divide-border/30">
                        {DOCUMENTS.map(doc => (
                            <div key={doc.id} className="p-4 flex flex-col sm:flex-row gap-4 justify-between hover:bg-accent/5 transition-colors">
                                <div className="flex gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-background border border-border/50 flex items-center justify-center shrink-0">
                                        {doc.status === "valid" ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : 
                                         doc.status === "expiring" ? <Clock className="w-5 h-5 text-amber-500" /> :
                                         <FileWarning className="w-5 h-5 text-rose-500" />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-sm">{doc.name}</h4>
                                            <span className="text-[10px] px-1.5 py-0.5 bg-accent rounded text-muted-foreground font-medium">{doc.type}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">Entity: {doc.entity}</p>
                                    </div>
                                </div>
                                <div className="text-left sm:text-right">
                                    <p className="text-xs font-medium">Expires: {doc.expiry}</p>
                                    {doc.warning && <p className="text-[10px] text-amber-500 font-bold mt-1">{doc.warning}</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </AppShell>
    );
}

