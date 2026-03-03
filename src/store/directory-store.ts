import { create } from "zustand";

import { syncPartnersFromSheet, syncPartnersToSheet } from "@/app/actions/sheet-actions";

export interface DirectoryEntry {
    id: string;
    type: "buyer" | "vendor" | "fleet";
    name: string;
    category?: string;
    region: string;
    pic: string;
    email: string;
    phone: string;
    status: "active" | "under_review" | "inactive";
    fleet_size?: number;
    tax_id?: string;
    notes?: string;
    updated_at?: string;
    created_at?: string;
    is_deleted?: boolean;
}

interface DirectoryState {
    _rawEntries: DirectoryEntry[];
    entries: DirectoryEntry[];
    addEntry: (entry: Omit<DirectoryEntry, "id">) => Promise<void>;
    updateEntry: (id: string, entry: Partial<DirectoryEntry>) => Promise<void>;
    deleteEntry: (id: string) => Promise<void>;
    syncFromMemory: () => Promise<void>;
}

export const useDirectoryStore = create<DirectoryState>((set, get) => ({
    _rawEntries: [],
    entries: [],
    addEntry: async (entry) => {
        const id = "dir-" + Date.now();
        const now = new Date().toISOString();
        const body = {
            id, type: entry.type, name: entry.name, category: entry.category,
            pic: entry.pic, email: entry.email, phone: entry.phone,
            region: entry.region, status: entry.status, taxId: entry.tax_id, notes: entry.notes
        };
        await fetch("/api/memory/partners", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        set((s) => {
            const newEntry = { ...entry, id, created_at: now, updated_at: now } as DirectoryEntry;
            const newRaw = [...s._rawEntries, newEntry];
            return { _rawEntries: newRaw, entries: newRaw.filter(e => !e.is_deleted) };
        });
    },
    updateEntry: async (id, u) => {
        const body: any = { id, ...u };
        if (u.tax_id !== undefined) body.taxId = u.tax_id;

        await fetch("/api/memory/partners", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        set((s) => {
            const newRaw = s._rawEntries.map((e) => e.id === id ? { ...e, ...u, updated_at: new Date().toISOString() } : e);
            return { _rawEntries: newRaw, entries: newRaw.filter(e => !e.is_deleted) };
        });
    },
    deleteEntry: async (id) => {
        await fetch(`/api/memory/partners?id=${id}`, { method: "DELETE" });
        set((s) => {
            const newRaw = s._rawEntries.map((e) => e.id === id ? { ...e, is_deleted: true, updated_at: new Date().toISOString() } : e);
            return { _rawEntries: newRaw, entries: newRaw.filter(e => !e.is_deleted) };
        });
    },
    syncFromMemory: async () => {
        try {
            const res = await fetch("/api/memory/partners");
            if (res.ok) {
                const data = await res.json();
                if (data.partners) {
                    const mappedEntries: DirectoryEntry[] = data.partners.map((p: any) => ({
                        id: p.id, type: p.type, name: p.name, category: p.category || undefined,
                        pic: p.contactPerson || p.pic, email: p.email, phone: p.phone,
                        region: p.city ? `${p.city}, ${p.country}` : p.country || "Unknown",
                        status: p.status, tax_id: p.taxId, notes: p.notes || undefined,
                        created_at: p.createdAt, updated_at: p.updatedAt, is_deleted: p.isDeleted
                    }));
                    set({
                        _rawEntries: mappedEntries,
                        entries: mappedEntries.filter(x => !x.is_deleted)
                    });
                }
            }
        } catch (error) {
            console.error("Failed to sync Directory/Partners from Memory B", error);
        }
    }
}));

// Removed legacy Google Sheets auto-sync logic.
