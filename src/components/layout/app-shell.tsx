"use client";

import React from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { AIChatbot } from "@/components/chatbot/ai-chatbot";
import { useSalesStore } from "@/store/sales-store";
import { usePurchaseStore } from "@/store/purchase-store";
import { useTaskStore } from "@/store/task-store";
import { useCommercialStore } from "@/store/commercial-store";
import { useSession } from "next-auth/react";
import { useAuthStore } from "@/store/auth-store";

function SessionWatcher() {
    const { data: session } = useSession();
    const { setCurrentUser } = useAuthStore();

    React.useEffect(() => {
        if (session?.user) {
            // Sync session user to our global AuthStore
            setCurrentUser({
                id: (session.user as any).id || "unknown",
                name: session.user.name || "User",
                email: session.user.email || "",
                role: (session.user as any).role || "staff",
                phone: "",
                created_at: new Date().toISOString()
            });
        }
    }, [session, setCurrentUser]);

    return null;
}

function AutoSyncListener() {
    React.useEffect(() => {
        let isPulling = false;

        const doPull = async () => {
            if (isPulling) return;
            if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
            if (typeof navigator !== "undefined" && !navigator.onLine) return;

            const now = Date.now();
            const lastSyncTimes = [
                Date.parse(useTaskStore.getState().lastSyncTime || ""),
                Date.parse(useSalesStore.getState().lastSyncTime || ""),
                Date.parse(usePurchaseStore.getState().lastSyncTime || ""),
                Date.parse(useCommercialStore.getState().lastSyncTime || ""),
            ].filter((x) => Number.isFinite(x)) as number[];
            const latestSync = lastSyncTimes.length ? Math.max(...lastSyncTimes) : 0;

            // Avoid duplicate pull storms from AppShell + page-level sync
            if (latestSync && now - latestSync < 30000) return;

            isPulling = true;
            try {
                await Promise.all([
                    useTaskStore.getState().syncFromMemory(),
                    useSalesStore.getState().syncFromMemory(),
                    usePurchaseStore.getState().syncFromMemory(),
                    useCommercialStore.getState().syncFromMemory()
                ]);
            } catch (e) {
                console.error("[AppShell] Pull Error:", e);
            }
            isPulling = false;
        };

        // Delay first pull slightly; page-level sync handles initial load.
        const firstTimer = setTimeout(doPull, 5000);

        // Poll less aggressively to reduce API pressure and UI flicker.
        const pollInterval = setInterval(doPull, 120000);

        return () => {
            clearTimeout(firstTimer);
            clearInterval(pollInterval);
        };
    }, []);

    return null;
}

interface AppShellProps {
    children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
    return (
        <div className="flex h-screen overflow-hidden bg-background text-foreground">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                <Header />
                <main className="flex-1 overflow-y-auto custom-scrollbar pb-16 md:pb-0">
                    {children}
                </main>
            </div>
            <AIChatbot />
            <AutoSyncListener />
            <SessionWatcher />
        </div>
    );
}
