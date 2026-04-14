import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { SalesOrder, OrderStatus } from "@/types";
import { generateId } from "@/lib/utils";

const today = new Date();
const d = (offset: number) => {
    const dt = new Date(today);
    dt.setDate(dt.getDate() + offset);
    return dt.toISOString();
};

const DEMO_SALES: SalesOrder[] = [
    { id: "so-1", order_number: "SO-20260121-W5JT", client: "PT Maju Bersama", description: "Cybersecurity Audit", amount: 8000000, status: "pending", priority: "high", image_url: "https://picsum.photos/seed/so-1/200/200", created_by: "usr-004", created_by_name: "Rina Wijaya", created_at: d(-5), updated_at: d(-5) }
];

interface SalesState {
    _rawOrders: SalesOrder[];
    orders: SalesOrder[];
    addOrder: (order: Omit<SalesOrder, "id" | "order_number" | "created_at" | "updated_at">) => Promise<void>;
    updateOrder: (id: string, updates: Partial<SalesOrder>) => Promise<void>;
    deleteOrder: (id: string) => Promise<void>;
    submitOrder: (id: string) => Promise<void>;
    approveOrder: (id: string, approvedBy: string) => Promise<void>;
    rejectOrder: (id: string) => Promise<void>;
    getPendingOrders: () => SalesOrder[];
    getTotalApprovedRevenue: () => number;
    syncFromMemory: () => Promise<void>;
    resetToDemo: () => void;
    lastSyncTime: string;
}

export const useSalesStore = create<SalesState>()(persist((set, get) => ({
    _rawOrders: [],
    orders: [],
    lastSyncTime: new Date(0).toISOString(),

    addOrder: async (order) => {
        const now = new Date().toISOString();
        const num = generateId("SO");
        const body = {
            orderNumber: num,
            client: order.client,
            description: order.description,
            amount: order.amount,
            status: order.status,
            priority: order.priority || "medium",
            imageUrl: order.image_url,
            createdBy: order.created_by,
            createdByName: order.created_by_name
        };
        const res = await fetch("/api/memory/sales-orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        if (res.ok) {
            const data = await res.json();
            const o = data.order;
            const newOrder: SalesOrder = {
                id: o.id, order_number: o.orderNumber, client: o.client, description: o.description || "",
                amount: o.amount, status: o.status as OrderStatus, priority: o.priority, image_url: o.imageUrl || "",
                created_by: o.createdBy, created_by_name: o.createdByName, is_deleted: o.isDeleted,
                created_at: o.createdAt, updated_at: o.updatedAt, approved_by: o.approvedBy
            };
            set((state) => {
                const raw = [newOrder, ...state._rawOrders];
                return { _rawOrders: raw, orders: raw.filter(o => !o.is_deleted) };
            });
        }
    },

    updateOrder: async (id, updates) => {
        const body: any = { id };
        if (updates.client) body.client = updates.client;
        if (updates.description) body.description = updates.description;
        if (updates.amount !== undefined) body.amount = updates.amount;
        if (updates.status) body.status = updates.status;
        if (updates.priority) body.priority = updates.priority;
        if (updates.image_url) body.imageUrl = updates.image_url;

        await fetch("/api/memory/sales-orders", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        set((state) => {
            const raw = state._rawOrders.map((o) =>
                o.id === id ? { ...o, ...updates, updated_at: new Date().toISOString() } : o
            );
            return { _rawOrders: raw, orders: raw.filter(o => !o.is_deleted) };
        });
    },

    deleteOrder: async (id) => {
        await fetch(`/api/memory/sales-orders?id=${id}`, { method: "DELETE" });
        set((state) => {
            const raw = state._rawOrders.map((o) =>
                o.id === id ? { ...o, is_deleted: true, updated_at: new Date().toISOString() } : o
            );
            return { _rawOrders: raw, orders: raw.filter(o => !o.is_deleted) };
        });
    },

    submitOrder: async (id) => {
        await useSalesStore.getState().updateOrder(id, { status: "pending" });
    },

    approveOrder: async (id, approvedBy) => {
        await fetch("/api/memory/sales-orders", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, status: "approved", approvedBy })
        });
        set((state) => {
            const raw = state._rawOrders.map((o) =>
                o.id === id ? { ...o, status: "approved" as OrderStatus, approved_by: approvedBy, updated_at: new Date().toISOString() } : o
            );
            return { _rawOrders: raw, orders: raw.filter(o => !o.is_deleted) };
        });
    },

    rejectOrder: async (id) => {
        await useSalesStore.getState().updateOrder(id, { status: "rejected" });
    },

    getPendingOrders: () => get().orders.filter((o) => o.status === "pending"),
    getTotalApprovedRevenue: () =>
        get().orders.filter((o) => o.status === "approved").reduce((sum, o) => sum + o.amount, 0),

    syncFromMemory: async () => {
        try {
            const res = await fetch("/api/memory/sales-orders");
            if (res.ok) {
                const data = await res.json();
                if (data.orders) {
                    const mappedOrders: SalesOrder[] = data.orders.map((o: any) => ({
                        id: o.id, order_number: o.orderNumber, client: o.client, description: o.description || "",
                        amount: o.amount, status: o.status as OrderStatus, priority: o.priority, image_url: o.imageUrl || "",
                        created_by: o.createdBy, created_by_name: o.createdByName, is_deleted: o.isDeleted,
                        created_at: o.createdAt, updated_at: o.updatedAt, approved_by: o.approvedBy
                    }));
                    set({
                        _rawOrders: mappedOrders,
                        orders: mappedOrders.filter(x => !x.is_deleted),
                        lastSyncTime: new Date().toISOString()
                    });
                }
            }
        } catch (error) {
            console.error("Failed to sync Sales Orders from Memory B", error);
        }
    },

    resetToDemo: () => {
        console.warn("[SalesStore] FORCING RESET TO DEMO DATA");
        set({ orders: [...DEMO_SALES] });
    }
}), {
    name: "sales-store-v1",
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({
        _rawOrders: state._rawOrders,
        orders: state.orders,
        lastSyncTime: state.lastSyncTime,
    }),
}));

// Removed deprecated auto-sync polling.
