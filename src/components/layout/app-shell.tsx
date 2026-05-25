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
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { DISABLE_SKELETON_LOADERS } from "@/lib/feature-flags";
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";

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
        if (status !== "authenticated") {
            onBootSyncChange?.(false);
            return;
        }

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
    const { data: session } = useSession();
    const [isBootSyncing, setIsBootSyncing] = React.useState(true);
    const taskCount = useTaskStore((s) => s.tasks.length);
    const salesCount = useSalesStore((s) => s.orders.length);
    const purchaseCount = usePurchaseStore((s) => s.purchases.length);
    const shipmentCount = useCommercialStore((s) => s.shipments.length);
    const dealCount = useCommercialStore((s) => s.deals.length);
    const sourceCount = useCommercialStore((s) => s.sources.length);
    const projectCount = useCommercialStore((s) => s.projects.length);
    const qualityCount = useCommercialStore((s) => s.qualityResults.length);
    const marketPriceCount = useCommercialStore((s) => s.marketPrices.length);
    const meetingCount = useCommercialStore((s) => s.meetings.length);
    const blendingCount = useCommercialStore((s) => s.blendingHistory.length);
    const plForecastCount = useCommercialStore((s) => s.plForecasts.length);
    const syncMeta = useCommercialStore((s) => s.syncMeta);
    const { currentUser, hasPermission } = useAuthStore();
    const pathname = usePathname();
    const sessionRole = String((session?.user as any)?.role || "").toUpperCase();

    const hasDocumentDriveAccess = hasPermission("document_drive") || sessionRole === "STAFF";
    const documentOnlyUser = Boolean(
        (currentUser || sessionRole === "STAFF") &&
        hasDocumentDriveAccess &&
        ![
            "dashboard",
            "approval_inbox",
            "my_tasks",
            "all_tasks",
            "sales_orders",
            "purchase_requests",
            "profit_loss",
            "manage_roles",
            "audit_logs",
            "sales_monitor",
            "shipment_monitor",
            "source_management",
            "quality",
            "blending_simulation",
            "market_price",
            "meetings",
            "transshipment",
            "outstanding_payment",
        ].some((permission) => hasPermission(permission as any)),
    );
    const hasAnyData = (taskCount + salesCount + purchaseCount + shipmentCount + dealCount + sourceCount + projectCount) > 0;
    const commercialRoute = React.useMemo(() => {
        if (pathname === "/forecast-sales" || pathname === "/projects") return { endpoint: "projects" as const, count: projectCount };
        if (pathname.startsWith("/shipment-monitor")) return { endpoint: "shipments" as const, count: shipmentCount };
        if (pathname.startsWith("/sources")) return { endpoint: "sources" as const, count: sourceCount };
        if (pathname.startsWith("/quality")) return { endpoint: "quality" as const, count: qualityCount };
        if (pathname.startsWith("/market-price")) return { endpoint: "market-prices" as const, count: marketPriceCount };
        if (pathname.startsWith("/meetings")) return { endpoint: "meetings" as const, count: meetingCount };
        if (pathname.startsWith("/blending")) return { endpoint: "blending" as const, count: blendingCount };
        if (pathname.startsWith("/pl-forecast")) return { endpoint: "pl-forecasts" as const, count: plForecastCount };
        return null;
    }, [blendingCount, marketPriceCount, meetingCount, pathname, plForecastCount, projectCount, qualityCount, shipmentCount, sourceCount]);
    const routeDataPending = Boolean(
        commercialRoute &&
        commercialRoute.count === 0 &&
        syncMeta.isSyncing &&
        !syncMeta.loadedEndpoints.includes(commercialRoute.endpoint) &&
        syncMeta.pendingEndpoints.includes(commercialRoute.endpoint),
    );
    const showBootSkeleton = !documentOnlyUser && !DISABLE_SKELETON_LOADERS && ((isBootSyncing && !hasAnyData) || routeDataPending);
    const blockedDocumentOnlyRoute = documentOnlyUser && pathname !== "/document-drive";
    const loadedCount = syncMeta.loadedEndpoints.length;
    const totalSyncCount = loadedCount + syncMeta.pendingEndpoints.length;
    const syncErrorCount = Object.keys(syncMeta.errors || {}).length;
    const syncLabel = syncMeta.isSyncing
        ? `Syncing data ${loadedCount}/${Math.max(totalSyncCount, loadedCount || 1)}`
        : syncErrorCount
            ? `${syncErrorCount} sync issue${syncErrorCount > 1 ? "s" : ""}`
            : syncMeta.completedAt
                ? `Data loaded ${new Date(syncMeta.completedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : null;

    return (
        <div className="flex h-screen overflow-hidden bg-background text-foreground">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                <Header />
                <main className="flex-1 overflow-y-auto custom-scrollbar pb-16 md:pb-0">
                    {syncLabel && !blockedDocumentOnlyRoute && !showBootSkeleton && (
                        <div className="sticky top-2 z-30 flex justify-end px-4 pt-2 md:px-6 lg:px-8">
                            <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/95 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground shadow-sm backdrop-blur">
                                {syncMeta.isSyncing ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                                ) : syncErrorCount ? (
                                    <TriangleAlert className="h-3.5 w-3.5 text-amber-500" />
                                ) : (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                )}
                                {syncLabel}
                            </div>
                        </div>
                    )}
                    {blockedDocumentOnlyRoute ? (
                        <div className="flex min-h-[60vh] items-center justify-center p-6">
                            <div className="max-w-sm rounded-lg border border-border bg-card p-6 text-center shadow-sm">
                                <p className="text-sm font-bold">Document Drive Access</p>
                                <p className="mt-2 text-xs text-muted-foreground">Akun ini hanya dapat membuka module dokumen.</p>
                                <Link href="/document-drive" className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
                                    Open Document Drive
                                </Link>
                            </div>
                        </div>
                    ) : showBootSkeleton ? (
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
            {!documentOnlyUser && <AIChatbot />}
            {!documentOnlyUser && <AutoSyncListener onBootSyncChange={setIsBootSyncing} />}
            <SessionWatcher />
        </div>
    );
}
