"use client";

import React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/skeleton";

interface DirectorySkeletonProps {
    cardCount?: number;
}

export function DirectorySkeleton({ cardCount = 6 }: DirectorySkeletonProps) {
    return (
        <AppShell>
            <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-56" />
                        <Skeleton className="h-4 w-80 max-w-[85vw]" />
                    </div>
                    <Skeleton className="h-9 w-32 rounded-lg" />
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-card p-4 rounded-xl border border-border/50 shadow-sm">
                    <div className="flex gap-2 p-1 bg-accent/30 rounded-lg">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className="h-7 w-16 rounded-md" />
                        ))}
                    </div>
                    <Skeleton className="h-10 w-full sm:w-64 rounded-lg" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: cardCount }).map((_, i) => (
                        <div key={i} className="p-5 bg-card border border-border/50 rounded-2xl shadow-sm space-y-5">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <Skeleton className="w-10 h-10 rounded-xl" />
                                    <div className="space-y-2">
                                        <Skeleton className="h-4 w-36" />
                                        <Skeleton className="h-3 w-14 rounded-full" />
                                    </div>
                                </div>
                                <Skeleton className="w-2 h-2 rounded-full" />
                            </div>

                            <div className="space-y-3">
                                <Skeleton className="h-3 w-full" />
                                <Skeleton className="h-3 w-[92%]" />
                                <Skeleton className="h-3 w-[84%]" />
                                <Skeleton className="h-3 w-[76%]" />
                            </div>

                            <div className="flex gap-2 w-full">
                                <Skeleton className="h-9 flex-1 rounded-xl" />
                                <Skeleton className="h-9 w-9 rounded-xl" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </AppShell>
    );
}
