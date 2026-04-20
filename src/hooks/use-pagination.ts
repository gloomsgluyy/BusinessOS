"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";

export interface UsePaginationOptions {
    defaultPageSize?: number;
}

export interface UsePaginationReturn {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    setPage: (p: number) => void;
    setPageSize: (ps: number) => void;
    nextPage: () => void;
    prevPage: () => void;
    firstPage: () => void;
    lastPage: () => void;
    updateMeta: (meta: { totalItems: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean }) => void;
    paginationParams: string; // URL query string fragment for API calls
}

/**
 * Client-side pagination hook that syncs with URL search params.
 * Use `paginationParams` to append to your API fetch URL.
 */
export function usePagination(options: UsePaginationOptions = {}): UsePaginationReturn {
    const { defaultPageSize = 20 } = options;
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const page = useMemo(() => {
        const raw = searchParams.get("page");
        return raw ? Math.max(1, parseInt(raw, 10) || 1) : 1;
    }, [searchParams]);

    const pageSize = useMemo(() => {
        const raw = searchParams.get("pageSize");
        return raw ? Math.min(100, Math.max(1, parseInt(raw, 10) || defaultPageSize)) : defaultPageSize;
    }, [searchParams, defaultPageSize]);

    // Derived meta (will be updated from API response)
    const totalItems = useMemo(() => {
        const raw = searchParams.get("_totalItems");
        return raw ? parseInt(raw, 10) || 0 : 0;
    }, [searchParams]);

    const totalPages = useMemo(() => {
        const raw = searchParams.get("_totalPages");
        return raw ? parseInt(raw, 10) || 1 : 1;
    }, [searchParams]);

    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    const updateURL = useCallback((newPage: number, newPageSize: number) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("page", String(newPage));
        params.set("pageSize", String(newPageSize));
        // Remove internal meta params from URL
        params.delete("_totalItems");
        params.delete("_totalPages");
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, [searchParams, router, pathname]);

    const setPage = useCallback((p: number) => {
        updateURL(Math.max(1, p), pageSize);
    }, [updateURL, pageSize]);

    const setPageSize = useCallback((ps: number) => {
        // Reset to page 1 when changing page size
        updateURL(1, Math.min(100, Math.max(1, ps)));
    }, [updateURL]);

    const nextPage = useCallback(() => setPage(page + 1), [page, setPage]);
    const prevPage = useCallback(() => setPage(Math.max(1, page - 1)), [page, setPage]);
    const firstPage = useCallback(() => setPage(1), [setPage]);
    const lastPage = useCallback(() => setPage(totalPages), [totalPages, setPage]);

    const updateMeta = useCallback((_meta: { totalItems: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean }) => {
        // Meta is stored in component state, not URL — this is a no-op placeholder
        // The actual meta values come from the API response and are used directly in the component
    }, []);

    const paginationParams = useMemo(() => {
        return `page=${page}&pageSize=${pageSize}`;
    }, [page, pageSize]);

    return {
        page,
        pageSize,
        totalPages,
        totalItems,
        hasNextPage,
        hasPrevPage,
        setPage,
        setPageSize,
        nextPage,
        prevPage,
        firstPage,
        lastPage,
        updateMeta,
        paginationParams,
    };
}
