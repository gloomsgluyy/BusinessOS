import { create } from "zustand";
import { OutstandingPayment } from "@/types";

interface OutstandingPaymentState {
    _rawPayments: OutstandingPayment[];
    outstandingPayments: OutstandingPayment[];
    addPayment: (p: Omit<OutstandingPayment, "id" | "created_at" | "updated_at">) => Promise<void>;
    updatePayment: (id: string, u: Partial<OutstandingPayment>) => Promise<void>;
    deletePayment: (id: string) => Promise<void>;
    syncPayments: () => Promise<void>;
}

export const useOutstandingPaymentStore = create<OutstandingPaymentState>((set, get) => ({
    _rawPayments: [],
    outstandingPayments: [],

    addPayment: async (p) => {
        const res = await fetch("/api/memory/outstanding-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(p),
        });
        if (res.ok) {
            get().syncPayments();
        }
    },

    updatePayment: async (id, u) => {
        const previousState = get()._rawPayments.find(p => p.id === id);
        set((s) => {
            const raw = s._rawPayments.map(p => p.id === id ? { ...p, ...u, updated_at: new Date().toISOString() } : p);
            return { _rawPayments: raw, outstandingPayments: raw.filter(x => !(x as any).is_deleted) };
        });

        const res = await fetch("/api/memory/outstanding-payment", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, ...u }),
        });
        if (!res.ok && previousState) {
            set((s) => {
                const raw = s._rawPayments.map(p => p.id === id ? previousState : p);
                return { _rawPayments: raw, outstandingPayments: raw.filter(x => !(x as any).is_deleted) };
            });
        } else if (res.ok) {
            get().syncPayments();
        }
    },

    deletePayment: async (id) => {
        const previousState = get()._rawPayments.find(p => p.id === id);
        set((s) => {
            const raw = s._rawPayments.map(p => p.id === id ? { ...p, is_deleted: true } : p);
            return { _rawPayments: raw, outstandingPayments: raw.filter(x => !(x as any).is_deleted) };
        });

        const res = await fetch(`/api/memory/outstanding-payment?id=${id}`, { method: "DELETE" });
        if (!res.ok && previousState) {
            set((s) => {
                const raw = s._rawPayments.map(p => p.id === id ? previousState : p);
                return { _rawPayments: raw, outstandingPayments: raw.filter(x => !(x as any).is_deleted) };
            });
        }
    },

    syncPayments: async () => {
        const ts = Date.now();
        const res = await fetch(`/api/memory/outstanding-payment?t=${ts}`, { cache: "no-store" });
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.outstandingPayments) {
                const mapped: OutstandingPayment[] = data.outstandingPayments.map((p: any) => ({
                    id: p.id,
                    perusahaan: p.perusahaan,
                    kode_batu: p.kodeBatu,
                    price_incl_pph: p.priceInclPph,
                    qty: p.qty,
                    total_dp: p.totalDp,
                    calculation_date: p.calculationDate,
                    dp_to_shipment: p.dpToShipment,
                    timeframe_days: p.timeframeDays,
                    status: p.status,
                    year: p.year,
                    created_at: p.createdAt,
                    updated_at: p.updatedAt,
                    is_deleted: p.isDeleted
                }));
                set({ _rawPayments: mapped, outstandingPayments: mapped.filter((x: any) => !x.is_deleted) });
            }
        }
    }
}));
