"use client";

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type ModulePageSkeletonProps = {
  titleWidth?: string;
  subtitleWidth?: string;
  metricCount?: number;
  cardCount?: number;
};

export function ModulePageSkeleton({
  titleWidth = "w-56",
  subtitleWidth = "w-80",
  metricCount = 6,
  cardCount = 6,
}: ModulePageSkeletonProps) {
  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6 animate-fade-in">
      <div className="card-elevated p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className={cn("h-8", titleWidth)} />
            <Skeleton className={cn("h-4 max-w-[85vw]", subtitleWidth)} />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28 rounded-lg" />
            <Skeleton className="h-9 w-32 rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {Array.from({ length: metricCount }).map((_, index) => (
            <div key={index} className="rounded-xl border border-border/50 bg-background/60 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-3 overflow-hidden">
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: cardCount }).map((_, index) => (
          <div key={index} className="rounded-xl border border-border/60 bg-card p-5 space-y-4">
            <div className="flex justify-between gap-3">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-6 w-20 rounded-md" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
            </div>
            <Skeleton className="h-16 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
