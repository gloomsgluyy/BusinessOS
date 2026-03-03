import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/** Format number as Indonesian Rupiah: Rp 5.241.762 */
export function formatRupiah(amount: number): string {
    return `Rp ${new Intl.NumberFormat("id-ID").format(Math.round(amount))}`;
}

/** Short Rupiah: Rp 5,2jt / Rp 15rb */
export function formatRupiahShort(amount: number): string {
    if (amount >= 1_000_000_000) return `Rp ${(amount / 1_000_000_000).toFixed(1)}M`;
    if (amount >= 1_000_000) return `Rp ${(amount / 1_000_000).toFixed(1)}jt`;
    if (amount >= 1_000) return `Rp ${(amount / 1_000).toFixed(0)}rb`;
    return formatRupiah(amount);
}

/** Generate unique ID with prefix */
export function generateId(prefix: string = "id"): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${date}-${rand}`;
}

/** Get initials from name */
export function getInitials(name: string | null | undefined): string {
    if (!name) return "??";
    return name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

/** Relative date label */
export function relativeDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < -1) return `${Math.abs(diffDays)} days ago`;
    if (diffDays === -1) return "Yesterday";
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays <= 7) return `In ${diffDays} days`;
    return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

/** Check if date is overdue */
export function isOverdue(dateStr: string): boolean {
    return new Date(dateStr) < new Date();
}

/** Check if due within N days */
export function isDueSoon(dateStr: string, days: number = 3): boolean {
    const due = new Date(dateStr);
    const now = new Date();
    const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= days;
}

/** Format date nicely */
export function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

/** Format date short for tables */
export function formatDateShort(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}
