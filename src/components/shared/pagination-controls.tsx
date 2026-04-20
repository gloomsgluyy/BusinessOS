"use client";

import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface PaginationControlsProps {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
    pageSizeOptions?: number[];
    className?: string;
}

export function PaginationControls({
    page,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage,
    hasPrevPage,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = [10, 20, 50, 100],
    className = "",
}: PaginationControlsProps) {
    if (totalItems === 0) return null;

    const startItem = (page - 1) * pageSize + 1;
    const endItem = Math.min(page * pageSize, totalItems);

    // Generate visible page numbers
    const getPageNumbers = (): (number | "...")[] => {
        const pages: (number | "...")[] = [];
        const maxVisible = 5;

        if (totalPages <= maxVisible + 2) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            const start = Math.max(2, page - 1);
            const end = Math.min(totalPages - 1, page + 1);

            if (start > 2) pages.push("...");
            for (let i = start; i <= end; i++) pages.push(i);
            if (end < totalPages - 1) pages.push("...");
            pages.push(totalPages);
        }

        return pages;
    };

    return (
        <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-3 ${className}`}>
            {/* Info text */}
            <div className="text-[11px] text-muted-foreground whitespace-nowrap">
                Showing <span className="font-semibold text-foreground">{startItem}-{endItem}</span> of{" "}
                <span className="font-semibold text-foreground">{totalItems.toLocaleString()}</span> items
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 flex-wrap justify-center">
                {/* Page size selector */}
                <select
                    value={pageSize}
                    onChange={(e) => onPageSizeChange(Number(e.target.value))}
                    className="px-2 py-1.5 rounded-lg bg-accent/30 border border-border text-[11px] outline-none focus:border-primary/50 cursor-pointer"
                    aria-label="Items per page"
                >
                    {pageSizeOptions.map((size) => (
                        <option key={size} value={size}>
                            {size} / page
                        </option>
                    ))}
                </select>

                {/* Navigation buttons */}
                <div className="flex items-center gap-0.5">
                    <button
                        onClick={() => onPageChange(1)}
                        disabled={!hasPrevPage}
                        className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="First page"
                        aria-label="First page"
                    >
                        <ChevronsLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => onPageChange(page - 1)}
                        disabled={!hasPrevPage}
                        className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Previous page"
                        aria-label="Previous page"
                    >
                        <ChevronLeft className="w-3.5 h-3.5" />
                    </button>

                    {/* Page numbers */}
                    <div className="flex items-center gap-0.5 mx-1">
                        {getPageNumbers().map((p, idx) =>
                            p === "..." ? (
                                <span key={`ellipsis-${idx}`} className="px-1.5 text-[11px] text-muted-foreground">
                                    ...
                                </span>
                            ) : (
                                <button
                                    key={p}
                                    onClick={() => onPageChange(p)}
                                    className={`min-w-[28px] h-7 rounded-lg text-[11px] font-semibold transition-all ${p === page
                                            ? "bg-primary text-primary-foreground shadow-sm"
                                            : "hover:bg-accent text-muted-foreground hover:text-foreground"
                                        }`}
                                    aria-label={`Page ${p}`}
                                    aria-current={p === page ? "page" : undefined}
                                >
                                    {p}
                                </button>
                            )
                        )}
                    </div>

                    <button
                        onClick={() => onPageChange(page + 1)}
                        disabled={!hasNextPage}
                        className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Next page"
                        aria-label="Next page"
                    >
                        <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => onPageChange(totalPages)}
                        disabled={!hasNextPage}
                        className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Last page"
                        aria-label="Last page"
                    >
                        <ChevronsRight className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
