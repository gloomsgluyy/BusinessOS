import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { PurchaseRequest, PurchaseStatus } from "@/types";
import { generateId } from "@/lib/utils";
import { DEFAULT_PURCHASE_CATEGORIES } from "@/lib/constants";

const today = new Date();
const d = (offset: number) => {
    const dt = new Date(today);
    dt.setDate(dt.getDate() + offset);
    return dt.toISOString();
};

const DEMO_PURCHASES: PurchaseRequest[] = [
    { id: "pr-1", request_number: "PR-20260124-EXMR", category: "IT Equipment", supplier: "Indomaret Group", description: "Keyboard & Mouse Set", amount: 5241762, status: "pending", priority: "urgent", image_url: "https://picsum.photos/seed/pr-1/200/200", created_by: "usr-004", created_by_name: "Rina Wijaya", is_anomaly: true, anomaly_reason: "Price variation 45% above historical average for 'Keyboard & Mouse'", ocr_data: { confidence: 92, extracted_amount: 5240000 }, created_at: d(-3), updated_at: d(-3) }
];

interface PurchaseState {
    _rawPurchases: PurchaseRequest[];
    purchases: PurchaseRequest[];
    categories: string[];
    addPurchase: (purchase: Omit<PurchaseRequest, "id" | "request_number" | "created_at" | "updated_at">) => void;
    updatePurchase: (id: string, updates: Partial<PurchaseRequest>) => void;
    deletePurchase: (id: string) => void;
    submitPurchase: (id: string) => void;
    approvePurchase: (id: string, approvedBy: string) => void;
    rejectPurchase: (id: string) => void;
    addCategory: (category: string) => void;
    getPendingPurchases: () => PurchaseRequest[];
    getTotalApprovedExpense: () => number;
    getExpenseByCategory: () => { category: string; amount: number }[];
    syncFromMemory: () => Promise<void>;
    resetToDemo: () => void;
    lastSyncTime: string;
}

export const usePurchaseStore = create<PurchaseState>()(persist((set, get) => ({
    _rawPurchases: [],
    purchases: [],
    categories: [...DEFAULT_PURCHASE_CATEGORIES],
    lastSyncTime: new Date(0).toISOString(),

    addPurchase: async (purchase) => {
        const now = new Date().toISOString();
        const num = generateId("PR");
        const newId = generateId("pr");
        const isAnomaly = purchase.amount > 10000000;
        const ocrData = purchase.image_url ? { confidence: (newId.length % 20) + 80, extracted_amount: purchase.amount } : undefined;

        const body = {
            requestNumber: num,
            category: purchase.category,
            supplier: purchase.supplier,
            description: purchase.description,
            amount: purchase.amount,
            status: purchase.status,
            priority: purchase.priority || "medium",
            imageUrl: purchase.image_url,
            isAnomaly,
            anomalyReason: isAnomaly ? "Amount significantly exceeds standard policy threshold" : undefined,
            ocrData: ocrData ? JSON.stringify(ocrData) : undefined,
            createdBy: purchase.created_by,
            createdByName: purchase.created_by_name
        };
        const res = await fetch("/api/memory/purchases", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        if (res.ok) {
            const data = await res.json();
            const p = data.purchase;
            const newPurchase: PurchaseRequest = {
                id: p.id, request_number: p.requestNumber, category: p.category, supplier: p.supplier,
                description: p.description || "", amount: p.amount, status: p.status as PurchaseStatus,
                priority: p.priority, image_url: p.imageUrl || "", is_anomaly: p.isAnomaly,
                anomaly_reason: p.anomalyReason || undefined, ocr_data: p.ocrData ? JSON.parse(p.ocrData) : undefined,
                created_by: p.createdBy, created_by_name: p.createdByName, is_deleted: p.isDeleted,
                created_at: p.createdAt, updated_at: p.updatedAt, approved_by: p.approvedBy
            };
            set((state) => {
                const raw = [newPurchase, ...state._rawPurchases];
                return { _rawPurchases: raw, purchases: raw.filter(p => !p.is_deleted) };
            });
        }
    },

    updatePurchase: async (id, updates) => {
        const body: any = { id };
        if (updates.category) body.category = updates.category;
        if (updates.supplier) body.supplier = updates.supplier;
        if (updates.description) body.description = updates.description;
        if (updates.amount !== undefined) body.amount = updates.amount;
        if (updates.status) body.status = updates.status;
        if (updates.priority) body.priority = updates.priority;
        if (updates.image_url) body.imageUrl = updates.image_url;

        await fetch("/api/memory/purchases", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        set((state) => {
            const raw = state._rawPurchases.map((p) =>
                p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p
            );
            return { _rawPurchases: raw, purchases: raw.filter(p => !p.is_deleted) };
        });
    },

    deletePurchase: async (id) => {
        await fetch(`/api/memory/purchases?id=${id}`, { method: "DELETE" });
        set((state) => {
            const raw = state._rawPurchases.map((p) =>
                p.id === id ? { ...p, is_deleted: true, updated_at: new Date().toISOString() } : p
            );
            return { _rawPurchases: raw, purchases: raw.filter(p => !p.is_deleted) };
        });
    },

    submitPurchase: async (id) => {
        await usePurchaseStore.getState().updatePurchase(id, { status: "pending" });
    },

    approvePurchase: async (id, approvedBy) => {
        await fetch("/api/memory/purchases", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, status: "approved", approvedBy })
        });
        set((state) => {
            const raw = state._rawPurchases.map((p) =>
                p.id === id ? { ...p, status: "approved" as PurchaseStatus, approved_by: approvedBy, updated_at: new Date().toISOString() } : p
            );
            return { _rawPurchases: raw, purchases: raw.filter(p => !p.is_deleted) };
        });
    },

    rejectPurchase: async (id) => {
        await usePurchaseStore.getState().updatePurchase(id, { status: "rejected" });
    },

    addCategory: (category) =>
        set((state) => ({
            categories: state.categories.includes(category) ? state.categories : [...state.categories, category],
        })),

    getPendingPurchases: () => get().purchases.filter((p) => p.status === "pending"),

    getTotalApprovedExpense: () =>
        get().purchases.filter((p) => p.status === "approved").reduce((sum, p) => sum + p.amount, 0),

    getExpenseByCategory: () => {
        const approved = get().purchases.filter((p) => p.status === "approved");
        const map: Record<string, number> = {};
        approved.forEach((p) => {
            map[p.category] = (map[p.category] || 0) + p.amount;
        });
        return Object.entries(map).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
    },

    syncFromMemory: async () => {
        try {
            const res = await fetch("/api/memory/purchases");
            if (res.ok) {
                const data = await res.json();
                if (data.purchases) {
                    const mappedPurchases: PurchaseRequest[] = data.purchases.map((p: any) => ({
                        id: p.id, request_number: p.requestNumber, category: p.category, supplier: p.supplier,
                        description: p.description || "", amount: p.amount, status: p.status as PurchaseStatus,
                        priority: p.priority, image_url: p.imageUrl || "", is_anomaly: p.isAnomaly,
                        anomaly_reason: p.anomalyReason || undefined, ocr_data: p.ocrData ? JSON.parse(p.ocrData) : undefined,
                        created_by: p.createdBy, created_by_name: p.createdByName, is_deleted: p.isDeleted,
                        created_at: p.createdAt, updated_at: p.updatedAt, approved_by: p.approvedBy
                    }));
                    set({
                        _rawPurchases: mappedPurchases,
                        purchases: mappedPurchases.filter(x => !x.is_deleted),
                        lastSyncTime: new Date().toISOString()
                    });
                }
            }
        } catch (error) {
            console.error("Failed to sync Purchase Orders from Memory B", error);
        }
    },

    resetToDemo: () => {
        console.warn("[PurchaseStore] FORCING RESET TO DEMO DATA");
        set({ purchases: [...DEMO_PURCHASES] });
    }
}), {
    name: "purchase-store-v1",
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({
        _rawPurchases: state._rawPurchases,
        purchases: state.purchases,
        categories: state.categories,
        lastSyncTime: state.lastSyncTime,
    }),
}));

// Removed legacy Auto-sync mechanisms and intervals.
