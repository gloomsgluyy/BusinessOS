import { create } from "zustand";
import { DailyDelivery } from "@/types";

const toApiDelivery = (d: Partial<DailyDelivery>) => ({
    reportType: d.report_type,
    year: d.year,
    shipmentStatus: d.shipment_status,
    buyer: d.buyer,
    pod: d.pod,
    shippingTerm: d.shipping_term,
    latestEtaPod: d.latest_eta_pod,
    arriveAtPod: d.arrive_at_pod,
    keterlambatan: d.keterlambatan,
    pol: d.pol,
    laycanPol: d.laycan_pol,
    area: d.area,
    supplier: d.supplier,
    mvBargeNomination: d.mv_barge_nomination,
    issue: d.issue,
    blMonth: d.bl_month,
    blQuantity: d.bl_quantity,
    blDate: d.bl_date,
    analysisMethod: d.analysis_method,
    surveyorPol: d.surveyor_pol,
    surveyorPod: d.surveyor_pod,
    project: d.project,
    flow: d.flow,
    terpal: d.terpal,
    insurance: d.insurance,
    basePrice: d.base_price,
    basePriceNotes: d.base_price_notes,
    poMonth: d.po_month,
    product: d.product,
    arriveAtPol: d.arrive_at_pol,
    commenceLoading: d.commence_loading,
    completeLoading: d.complete_loading,
    startDischarging: d.start_discharging,
    completeDischarged: d.complete_discharged,
    podQuantity: d.pod_quantity,
    lossGainCargo: d.loss_gain_cargo,
    poNo: d.po_no,
    contractNo: d.contract_no,
    contractType: d.contract_type,
    invoicePrice: d.invoice_price,
    invoiceAmount: d.invoice_amount,
    paymentDueDate: d.payment_due_date,
    paymentStatus: d.payment_status,
    specContract: d.spec_contract,
    actualGcvGar: d.actual_gcv_gar,
    actualTs: d.actual_ts,
    actualAsh: d.actual_ash,
    actualTm: d.actual_tm,
    skabSupplierSentAt: d.skab_supplier_sent_at,
    skabOperationReceivedAt: d.skab_operation_received_at,
    skabOperationSentAt: d.skab_operation_sent_at,
    skabTrafficReceivedAt: d.skab_traffic_received_at,
    skabTrafficSentFinanceAt: d.skab_traffic_sent_finance_at,
    skabFinanceReceivedAt: d.skab_finance_received_at,
    skabEvidenceDocumentId: d.skab_evidence_document_id,
    skabNotes: d.skab_notes,
    dsrSupplierSentAt: d.dsr_supplier_sent_at,
    dsrOperationReceivedAt: d.dsr_operation_received_at,
    dsrOperationSentAt: d.dsr_operation_sent_at,
    dsrTrafficReceivedAt: d.dsr_traffic_received_at,
    dsrEvidenceDocumentId: d.dsr_evidence_document_id,
    blCmOperationSentAt: d.bl_cm_operation_sent_at,
    blCmTrafficReceivedAt: d.bl_cm_traffic_received_at,
    blCmTrafficSentFinanceAt: d.bl_cm_traffic_sent_finance_at,
    blCmFinanceReceivedAt: d.bl_cm_finance_received_at,
    blCmEvidenceDocumentId: d.bl_cm_evidence_document_id,
    coaPolDate: d.coa_pol_date,
    coaPolSurveyorSentAt: d.coa_pol_surveyor_sent_at,
    coaPolTrafficReceivedAt: d.coa_pol_traffic_received_at,
    coaPolFinanceReceivedAt: d.coa_pol_finance_received_at,
    coaPolEvidenceDocumentId: d.coa_pol_evidence_document_id,
    coaPodReceivedAt: d.coa_pod_received_at,
    financeSubmitFullSetAt: d.finance_submit_full_set_at,
    vendorReceivedFullSetAt: d.vendor_received_full_set_at,
    approvalDtAt: d.approval_dt_at,
    vendorPaidAt: d.vendor_paid_at,
    coaPodEvidenceDocumentId: d.coa_pod_evidence_document_id,
    fullSetDocumentStatus: d.full_set_document_status,
    hardcopyStatus: d.hardcopy_status,
    softcopyStatus: d.softcopy_status,
});

const mapDelivery = (d: any): DailyDelivery => ({
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
    skab_supplier_sent_at: d.skabSupplierSentAt,
    skab_operation_received_at: d.skabOperationReceivedAt,
    skab_operation_sent_at: d.skabOperationSentAt,
    skab_traffic_received_at: d.skabTrafficReceivedAt,
    skab_traffic_sent_finance_at: d.skabTrafficSentFinanceAt,
    skab_finance_received_at: d.skabFinanceReceivedAt,
    skab_evidence_document_id: d.skabEvidenceDocumentId,
    skab_notes: d.skabNotes,
    dsr_supplier_sent_at: d.dsrSupplierSentAt,
    dsr_operation_received_at: d.dsrOperationReceivedAt,
    dsr_operation_sent_at: d.dsrOperationSentAt,
    dsr_traffic_received_at: d.dsrTrafficReceivedAt,
    dsr_evidence_document_id: d.dsrEvidenceDocumentId,
    bl_cm_operation_sent_at: d.blCmOperationSentAt,
    bl_cm_traffic_received_at: d.blCmTrafficReceivedAt,
    bl_cm_traffic_sent_finance_at: d.blCmTrafficSentFinanceAt,
    bl_cm_finance_received_at: d.blCmFinanceReceivedAt,
    bl_cm_evidence_document_id: d.blCmEvidenceDocumentId,
    coa_pol_date: d.coaPolDate,
    coa_pol_surveyor_sent_at: d.coaPolSurveyorSentAt,
    coa_pol_traffic_received_at: d.coaPolTrafficReceivedAt,
    coa_pol_finance_received_at: d.coaPolFinanceReceivedAt,
    coa_pol_evidence_document_id: d.coaPolEvidenceDocumentId,
    coa_pod_received_at: d.coaPodReceivedAt,
    finance_submit_full_set_at: d.financeSubmitFullSetAt,
    vendor_received_full_set_at: d.vendorReceivedFullSetAt,
    approval_dt_at: d.approvalDtAt,
    vendor_paid_at: d.vendorPaidAt,
    coa_pod_evidence_document_id: d.coaPodEvidenceDocumentId,
    full_set_document_status: d.fullSetDocumentStatus,
    hardcopy_status: d.hardcopyStatus,
    softcopy_status: d.softcopyStatus,
    created_at: d.createdAt,
    updated_at: d.updatedAt,
    is_deleted: d.isDeleted
});

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
            body: JSON.stringify(toApiDelivery(d)),
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
            body: JSON.stringify({ id, ...toApiDelivery(u) }),
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
                const mapped: DailyDelivery[] = data.dailyDeliveries.map(mapDelivery);
                set({ _rawDeliveries: mapped, dailyDeliveries: mapped.filter((x: any) => !x.is_deleted) });
            }
        }
    }
}));
