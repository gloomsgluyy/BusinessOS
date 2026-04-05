import { create } from "zustand";
import { DailyDelivery } from "@/types";

interface DailyDeliveryState {
    _rawDeliveries: DailyDelivery[];
    dailyDeliveries: DailyDelivery[];
    addDelivery: (d: Omit<DailyDelivery, "id" | "created_at" | "updated_at">) => Promise<void>;
    updateDelivery: (id: string, u: Partial<DailyDelivery>) => Promise<void>;
    deleteDelivery: (id: string) => Promise<void>;
    syncDeliveries: () => Promise<void>;
}

export const useDailyDeliveryStore = create<DailyDeliveryState>((set, get) => ({
    _rawDeliveries: [],
    dailyDeliveries: [],

    addDelivery: async (d) => {
        const res = await fetch("/api/memory/daily-delivery", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(d),
        });
        if (res.ok) {
            get().syncDeliveries();
        }
    },

    updateDelivery: async (id, u) => {
        // Optimistic UI update
        const previousState = get()._rawDeliveries.find(d => d.id === id);
        set((s) => {
            const raw = s._rawDeliveries.map(d => d.id === id ? { ...d, ...u, updated_at: new Date().toISOString() } : d);
            return { _rawDeliveries: raw, dailyDeliveries: raw.filter(x => !(x as any).is_deleted) };
        });

        const res = await fetch("/api/memory/daily-delivery", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, ...u }),
        });
        if (!res.ok) {
            if (previousState) {
                set((s) => {
                    const raw = s._rawDeliveries.map(d => d.id === id ? previousState : d);
                    return { _rawDeliveries: raw, dailyDeliveries: raw.filter(x => !(x as any).is_deleted) };
                });
            }
        } else {
            get().syncDeliveries();
        }
    },

    deleteDelivery: async (id) => {
        const previousState = get()._rawDeliveries.find(d => d.id === id);
        set((s) => {
            const raw = s._rawDeliveries.map(d => d.id === id ? { ...d, is_deleted: true } : d);
            return { _rawDeliveries: raw, dailyDeliveries: raw.filter(x => !(x as any).is_deleted) };
        });

        const res = await fetch(`/api/memory/daily-delivery?id=${id}`, { method: "DELETE" });
        if (!res.ok && previousState) {
            set((s) => {
                const raw = s._rawDeliveries.map(d => d.id === id ? previousState : d);
                return { _rawDeliveries: raw, dailyDeliveries: raw.filter(x => !(x as any).is_deleted) };
            });
        }
    },

    syncDeliveries: async () => {
        const ts = Date.now();
        const res = await fetch(`/api/memory/daily-delivery?t=${ts}`, { cache: "no-store" });
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.dailyDeliveries) {
                // map to camelCase structure as it arrives from prisma
                const mapped: DailyDelivery[] = data.dailyDeliveries.map((d: any) => ({
                    id: d.id,
                    report_type: d.reportType,
                    year: d.year,
                    shipment_status: d.shipmentStatus,
                    buyer: d.buyer,
                    pod: d.pod,
                    shipping_term: d.shippingTerm,
                    latest_eta_pod: d.latestEtaPod,
                    arrive_at_pod: d.arriveAtPod,
                    keterlambatan: d.keterlambatan,
                    pol: d.pol,
                    laycan_pol: d.laycanPol,
                    area: d.area,
                    supplier: d.supplier,
                    mv_barge_nomination: d.mvBargeNomination,
                    issue: d.issue,
                    bl_month: d.blMonth,
                    bl_quantity: d.blQuantity,
                    bl_date: d.blDate,
                    analysis_method: d.analysisMethod,
                    surveyor_pol: d.surveyorPol,
                    surveyor_pod: d.surveyorPod,
                    project: d.project,
                    flow: d.flow,
                    terpal: d.terpal,
                    insurance: d.insurance,
                    base_price: d.basePrice,
                    base_price_notes: d.basePriceNotes,
                    po_month: d.poMonth,
                    product: d.product,
                    arrive_at_pol: d.arriveAtPol,
                    commence_loading: d.commenceLoading,
                    complete_loading: d.completeLoading,
                    start_discharging: d.startDischarging,
                    complete_discharged: d.completeDischarged,
                    pod_quantity: d.podQuantity,
                    loss_gain_cargo: d.lossGainCargo,
                    po_no: d.poNo,
                    contract_no: d.contractNo,
                    contract_type: d.contractType,
                    invoice_price: d.invoicePrice,
                    invoice_amount: d.invoiceAmount,
                    payment_due_date: d.paymentDueDate,
                    payment_status: d.paymentStatus,
                    spec_contract: d.specContract,
                    actual_gcv_gar: d.actualGcvGar,
                    actual_ts: d.actualTs,
                    actual_ash: d.actualAsh,
                    actual_tm: d.actualTm,
                    created_at: d.createdAt,
                    updated_at: d.updatedAt,
                    is_deleted: d.isDeleted
                }));
                set({ _rawDeliveries: mapped, dailyDeliveries: mapped.filter((x: any) => !x.is_deleted) });
            }
        }
    }
}));
