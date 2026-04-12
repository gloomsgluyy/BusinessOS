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
import { usePathname } from "next/navigation";

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
    const { status } = useSession();
    const pathname = usePathname();

    React.useEffect(() => {
        if (status !== "authenticated") return;

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
            if (latestSync && now - latestSync < 5000) return;

            isPulling = true;
            try {
                const syncJobs: Promise<void>[] = [
                    useTaskStore.getState().syncFromMemory(),
                    useSalesStore.getState().syncFromMemory(),
                    usePurchaseStore.getState().syncFromMemory(),
                ];

                // Dashboard has its own fast-first sync sequence on initial load.
                // Avoid racing it with an immediate full commercial pull.
                if (pathname !== "/") {
                    syncJobs.push(useCommercialStore.getState().syncFromMemory());
                }

                await Promise.all(syncJobs);
            } catch (e) {
                console.error("[AppShell] Pull Error:", e);
            }
            isPulling = false;
        };

        // Poll less aggressively to reduce API pressure and UI flicker.
        const pollInterval = setInterval(doPull, 60000);

        const onVisible = () => {
            if (document.visibilityState === "visible") doPull();
        };
        const onFocus = () => doPull();
        window.addEventListener("focus", onFocus);
        document.addEventListener("visibilitychange", onVisible);

        return () => {
            clearInterval(pollInterval);
            window.removeEventListener("focus", onFocus);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, [status, pathname]);

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
