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
    addEntry: (entry: Omit<DirectoryEntry, "id">) => void;
    updateEntry: (id: string, entry: Partial<DirectoryEntry>) => void;
    deleteEntry: (id: string) => void;
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
            region: entry.region, pic: entry.pic, email: entry.email, phone: entry.phone,
            status: entry.status, fleetSize: entry.fleet_size, taxId: entry.tax_id, notes: entry.notes
        };
        await fetch("/api/memory/sources", {
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
        if (u.fleet_size !== undefined) body.fleetSize = u.fleet_size;
        if (u.tax_id !== undefined) body.taxId = u.tax_id;

        await fetch("/api/memory/sources", {
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
        await fetch(`/api/memory/sources?id=${id}`, { method: "DELETE" });
        set((s) => {
            const newRaw = s._rawEntries.map((e) => e.id === id ? { ...e, is_deleted: true, updated_at: new Date().toISOString() } : e);
            return { _rawEntries: newRaw, entries: newRaw.filter(e => !e.is_deleted) };
        });
    },
    syncFromMemory: async () => {
        try {
            const res = await fetch("/api/memory/sources");
            if (res.ok) {
                const data = await res.json();
                if (data.sources) {
                    const mappedEntries: DirectoryEntry[] = data.sources.map((s: any) => ({
                        id: s.id, type: s.type, name: s.name, category: s.category || undefined,
                        region: s.region, pic: s.pic, email: s.email, phone: s.phone,
                        status: s.status, fleet_size: s.fleetSize, tax_id: s.taxId, notes: s.notes || undefined,
                        created_at: s.createdAt, updated_at: s.updatedAt, is_deleted: s.isDeleted
                    }));
                    set({
                        _rawEntries: mappedEntries,
                        entries: mappedEntries.filter(x => !x.is_deleted)
                    });
                }
            }
        } catch (error) {
            console.error("Failed to sync Directory/Sources from Memory B", error);
        }
    }
}));

// Removed legacy Google Sheets auto-sync logic.
