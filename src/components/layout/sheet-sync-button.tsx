"use client";

import React from "react";
import { RefreshCw, Database, Check, ArrowUpCircle } from "lucide-react";
import { useSalesStore } from "@/store/sales-store";
import { usePurchaseStore } from "@/store/purchase-store";
import { useTaskStore } from "@/store/task-store";
import { useCommercialStore } from "@/store/commercial-store";

export function SheetSyncButton() {
    const [loading, setLoading] = React.useState(false);
    const [status, setStatus] = React.useState<"idle" | "success" | "error">("idle");

    const handleSync = async () => {
        setLoading(true);
        setStatus("idle");
        try {
            await Promise.all([
                useTaskStore.getState().syncFromMemory(),
                useSalesStore.getState().syncFromMemory(),
                usePurchaseStore.getState().syncFromMemory(),
                useCommercialStore.getState().syncFromMemory()
            ]);

            setStatus("success");
            // alert("Data synced from Memory B server!"); // Using toast/UI feedback usually, leaving as alert for consistency with existing code
        } catch (e) {
            console.error(e);
            setStatus("error");
        } finally {
            setLoading(false);
            setTimeout(() => setStatus("idle"), 3000);
        }
    };

    const handleForcePush = async () => {
        if (!confirm("Are you sure you want to completely RESET your Local Database to Demo Data?")) return;
        setLoading(true);
        setStatus("idle");
        try {
            // Memory B does not need "Push to Demo Sheet" logic. 
            // Leaving reset to demo locally as a debugging tool before we add full server resets.
            useSalesStore.getState().resetToDemo();
            usePurchaseStore.getState().resetToDemo();
        } catch (e) {
            console.error(e);
            setStatus("error");
        } finally {
            setLoading(false);
            setTimeout(() => setStatus("idle"), 3000);
        }
    };

    const handleSetupValidation = async () => {
        alert("This functionality was depreciated with Google Sheets Sync removal.");
    };

    return (
        <div className="flex items-center gap-1">
            <button
                onClick={handleSetupValidation}
                disabled={loading}
                className="hidden md:flex items-center justify-center w-9 h-9 rounded-xl hover:bg-violet-500/10 hover:text-violet-500 transition-all duration-200 text-muted-foreground active:scale-95 disabled:opacity-50"
                title="Add Dropdowns to Sheet"
            >
                <Database className="w-4 h-4" />
            </button>
            <button
                onClick={handleForcePush}
                disabled={loading}
                className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-blue-500/10 hover:text-blue-500 transition-all duration-200 text-muted-foreground active:scale-95 disabled:opacity-50"
                title="Push Local Data to Sheets (Overwrite)"
            >
                <ArrowUpCircle className="w-4 h-4" />
            </button>
            <button
                onClick={handleSync}
                disabled={loading}
                className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-emerald-500/10 hover:text-emerald-500 transition-all duration-200 text-muted-foreground active:scale-95 disabled:opacity-50"
                title="Sync from Google Sheets (Merge)"
            >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> :
                    status === "success" ? <Check className="w-4 h-4 text-emerald-500" /> :
                        <RefreshCw className="w-4 h-4" />}
            </button>
        </div>
    );
}
