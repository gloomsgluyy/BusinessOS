import { Prisma } from "@prisma/client";

// ── Types ────────────────────────────────────────────────────────
export interface PaginationParams {
    page: number;
    pageSize: number;
    skip: number;
    take: number;
    search?: string;
    sortBy?: string;
    sortOrder: "asc" | "desc";
}

export interface PaginationMeta {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
}

// ── Server-side helpers ──────────────────────────────────────────

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MIN_PAGE_SIZE = 1;

/**
 * Parse pagination query params with safe bounds.
 * When page/pageSize are absent, returns null (caller should fall back to old behavior).
 */
export function parsePaginationParams(searchParams: URLSearchParams): PaginationParams | null {
    const rawPage = searchParams.get("page");
    const rawPageSize = searchParams.get("pageSize");

    // If neither page nor pageSize is provided, return null for backward compatibility
    if (!rawPage && !rawPageSize) return null;

    const page = Math.max(DEFAULT_PAGE, parseInt(rawPage || String(DEFAULT_PAGE), 10) || DEFAULT_PAGE);
    const pageSize = Math.min(
        MAX_PAGE_SIZE,
        Math.max(MIN_PAGE_SIZE, parseInt(rawPageSize || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE)
    );

    const search = searchParams.get("search") || undefined;
    const sortBy = searchParams.get("sortBy") || undefined;
    const sortOrder = (searchParams.get("sortOrder") || "desc") === "asc" ? "asc" as const : "desc" as const;

    return {
        page,
        pageSize,
        skip: (page - 1) * pageSize,
        take: pageSize,
        search,
        sortBy,
        sortOrder,
    };
}

/**
 * Build pagination metadata from totalItems count.
 */
export function buildPaginationMeta(totalItems: number, page: number, pageSize: number): PaginationMeta {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(page, totalPages);

    return {
        page: safePage,
        pageSize,
        totalItems,
        totalPages,
        hasNextPage: safePage < totalPages,
        hasPrevPage: safePage > 1,
    };
}
