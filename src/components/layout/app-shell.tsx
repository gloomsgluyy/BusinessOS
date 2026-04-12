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
import { Skeleton } from "@/components/ui/skeleton";
import { DISABLE_SKELETON_LOADERS } from "@/lib/feature-flags";

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

function AutoSyncListener({ onBootSyncChange }: { onBootSyncChange?: (loading: boolean) => void }) {
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
            onBootSyncChange?.(true);
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
            } finally {
                onBootSyncChange?.(false);
                isPulling = false;
            }
        };

        // Pull immediately once session is authenticated.
        doPull();

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
    }, [status, pathname, onBootSyncChange]);

    return null;
}

interface AppShellProps {
    children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
    const [isBootSyncing, setIsBootSyncing] = React.useState(false);
    const taskCount = useTaskStore((s) => s.tasks.length);
    const salesCount = useSalesStore((s) => s.orders.length);
    const purchaseCount = usePurchaseStore((s) => s.purchases.length);
    const shipmentCount = useCommercialStore((s) => s.shipments.length);
    const dealCount = useCommercialStore((s) => s.deals.length);
    const sourceCount = useCommercialStore((s) => s.sources.length);

    const hasAnyData = (taskCount + salesCount + purchaseCount + shipmentCount + dealCount + sourceCount) > 0;
    const showBootSkeleton = !DISABLE_SKELETON_LOADERS && isBootSyncing && !hasAnyData;

    return (
        <div className="flex h-screen overflow-hidden bg-background text-foreground">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                <Header />
                <main className="flex-1 overflow-y-auto custom-scrollbar pb-16 md:pb-0">
                    {showBootSkeleton ? (
                        <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6 w-full animate-fade-in">
                            <div className="space-y-2">
                                <Skeleton className="h-8 w-48" />
                                <Skeleton className="h-4 w-72" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="p-5 rounded-2xl border border-border/50 bg-card space-y-3">
                                        <div className="flex justify-between">
                                            <Skeleton className="h-4 w-24" />
                                            <Skeleton className="h-8 w-8 rounded-xl" />
                                        </div>
                                        <Skeleton className="h-7 w-28" />
                                        <Skeleton className="h-3 w-36" />
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <Skeleton className="h-[220px] w-full rounded-xl" />
                                <Skeleton className="h-[220px] w-full rounded-xl" />
                            </div>
                        </div>
                    ) : children}
                </main>
            </div>
            <AIChatbot />
            <AutoSyncListener onBootSyncChange={setIsBootSyncing} />
            <SessionWatcher />
        </div>
    );
}
