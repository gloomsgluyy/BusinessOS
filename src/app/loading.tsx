"use client";

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AppShell } from "@/components/layout/app-shell";

export default function GlobalLoading() {
  return (
    <AppShell>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6 w-full animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="p-5 rounded-2xl border border-border/50 bg-card space-y-3"
            >
              <div className="flex justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-8 rounded-xl" />
              </div>
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-3 w-40" />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 flex-1">
          <div className="p-5 rounded-2xl border border-border/50 bg-card space-y-4">
            <div className="flex justify-between mb-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-[220px] w-full rounded-xl" />
          </div>
          <div className="p-5 rounded-2xl border border-border/50 bg-card space-y-4">
            <div className="flex justify-between mb-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-[220px] w-full rounded-xl" />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
