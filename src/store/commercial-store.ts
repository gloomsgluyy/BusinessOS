import { create } from "zustand";
import {
    SalesDeal, SalesDealStatus, ShipmentDetail, ShipmentStatus,
    SourceSupplier, QualityResult, MarketPriceEntry,
    MeetingItem, FreightInfo, BlendingResult, CoalSpec,
    PLForecastItem,
} from "@/types";
import { generateId } from "@/lib/utils";

// ── Helper ────────────────────────────────────────────────────
function blendSpecs(inputs: { quantity: number; spec: CoalSpec }[]): CoalSpec {
    const totalQty = inputs.reduce((s, i) => s + i.quantity, 0);
    if (totalQty === 0) return { gar: 0, ts: 0, ash: 0, tm: 0 };
    const w = (field: keyof CoalSpec) =>
        inputs.reduce((s, i) => s + (i.spec[field] || 0) * i.quantity, 0) / totalQty;
    return {
        gar: Math.round(w("gar")),
        ts: Math.round(w("ts") * 100) / 100,
        ash: Math.round(w("ash") * 100) / 100,
        tm: Math.round(w("tm") * 100) / 100,
        im: Math.round(w("im") * 100) / 100,
        fc: Math.round(w("fc") * 100) / 100,
    };
}

// ── Demo Data ─────────────────────────────────────────────────
const DEMO_DEALS: SalesDeal[] = [
    {
        id: "sd-001", deal_number: "SD-20260201-0001", status: "confirmed", buyer: "KEPCO (Korea)", buyer_country: "South Korea",
        type: "export", shipping_terms: "FOB", quantity: 55000, price_per_mt: 68.50, total_value: 3767500,
        laycan_start: "2026-03-01", laycan_end: "2026-03-10", vessel_name: "MV Bulk Prosperity",
        spec: { gar: 4200, ts: 0.8, ash: 5.0, tm: 30 }, project_id: "prj-001",
        pic_id: "usr-003", pic_name: "Budi Santoso", created_by: "usr-003", created_by_name: "Budi Santoso",
        created_at: "2026-02-15T08:00:00Z", updated_at: "2026-02-15T10:00:00Z",
    }
];

const DEMO_SHIPMENTS: ShipmentDetail[] = [
    {
        id: "sh-001",
        shipment_number: "SH-202602-0001",
        deal_id: "sd-001",
        status: "loading",
        buyer: "KEPCO (Korea)",
        supplier: "PT Indo Mining",
        is_blending: false,
        vessel_name: "MV Bulk Prosperity",
        barge_name: "BG Sejahtera 1",
        loading_port: "Samarinda", discharge_port: "Pohang, South Korea",
        quantity_loaded: 25000,
        bl_date: "2026-02-25",
        eta: "2026-03-05",
        spec_actual: { gar: 4180, ts: 0.82, ash: 5.1, tm: 30.5 },
        sales_price: 61.45, margin_mt: 2.25,
        pic_id: "usr-005", pic_name: "Dimas Pratama",
        created_at: "2026-02-20T08:00:00Z", updated_at: "2026-02-25T08:00:00Z",
        buyer_country: "South Korea",
        type: "export",
        region: "Kalimantan Timur"
    } as any
];

const DEMO_SOURCES: SourceSupplier[] = [
    {
        id: "src-001", name: "PT Indo Mining", region: "Kalimantan Timur",
        calorie_range: "GAR 4000-4200", spec: { gar: 4200, ts: 0.8, ash: 5.0, tm: 30, hgi: 42, adb: 4800, nar: 3900 },
        jetty_port: "Jetty SRE", anchorage: "Taboneo", min_stock_alert: 10000,
        kyc_status: "verified", psi_status: "passed", stock_available: 150000,
        fob_barge_only: true, requires_transshipment: false,
        price_linked_index: "ICI 4", fob_barge_price_idr: 588786, fob_barge_price_usd: 38.5,
        transshipment_costs: {
            barge_7500: { idr: 35000000, usd: 2258 },
            barge_8000: { idr: 38000000, usd: 2452 }
        },
        psi_date: "2025-10-15", psi_result: "Passed", contract_type: "Spot",
        pic_id: "usr-004", pic_name: "Rina Wijaya", contact_person: "Pak Agus",
        phone: "+6281200001111", iup_number: "IUP-KT-2024-001",
        created_at: "2024-06-01T00:00:00Z", updated_at: "2026-02-15T00:00:00Z",
    }
];

const DEMO_QUALITY: QualityResult[] = [
    {
        id: "q-001", cargo_id: "sh-001", cargo_name: "SH-20260225-0001 / KEPCO",
        surveyor: "SGS Indonesia", sampling_date: "2026-02-22",
        spec_result: { gar: 4180, ts: 0.82, ash: 5.1, tm: 30.5 },
        status: "passed", created_at: "2026-02-22T14:00:00Z",
    }
];

const DEMO_MARKET_PRICES: MarketPriceEntry[] = [
    { id: "mp-001", date: "2026-02-21", ici_1: 119.50, ici_2: 85.20, ici_3: 68.40, ici_4: 48.30, newcastle: 132.80, hba: 117.00, source: "Argus/IHS" }
];

const DEMO_MEETINGS: MeetingItem[] = [
    {
        id: "mtg-001", title: "Weekly Sales Review", date: "2026-02-24", time: "10:00",
        attendees: ["Raka Aditya", "Budi Santoso", "Diana Putri"], location: "Board Room",
        status: "scheduled", action_items: [
            { id: "ai-001", description: "Follow up KEPCO shipment delay", assignee_id: "usr-005", assignee_name: "Dimas Pratama", due_date: "2026-02-25", status: "todo" },
            { id: "ai-002", description: "Prepare EGAT proposal pricing", assignee_id: "usr-003", assignee_name: "Budi Santoso", due_date: "2026-02-26", status: "todo" },
        ],
        created_by: "usr-001", created_by_name: "Raka Aditya",
        created_at: "2026-02-20T08:00:00Z", updated_at: "2026-02-20T08:00:00Z",
    }
];

const DEMO_FREIGHT: FreightInfo[] = [
    { id: "fr-001", origin: "Samarinda", destination: "Pohang, South Korea", distance_nm: 2800, freight_rate: 8.50, vendor: "PT Samudera Shipping", vessel_type: "Supramax", updated_at: "2026-02-15T00:00:00Z" }
];

// ══════════════════════════════════════════════════════════════
// STORE
// ══════════════════════════════════════════════════════════════
interface CommercialState {
    // Sales Monitor
    _rawDeals: SalesDeal[];
    deals: SalesDeal[];
    addDeal: (d: Omit<SalesDeal, "id" | "deal_number" | "created_at" | "updated_at">) => Promise<void>;
    updateDeal: (id: string, u: Partial<SalesDeal>) => Promise<void>;
    deleteDeal: (id: string) => Promise<void>;
    updateDealStatus: (id: string, status: SalesDealStatus) => Promise<void>;
    confirmDeal: (id: string) => void;

    // Shipment Monitor
    _rawShipments: ShipmentDetail[];
    shipments: ShipmentDetail[];
    addShipment: (s: Omit<ShipmentDetail, "id" | "created_at" | "updated_at">) => Promise<void>;
    updateShipment: (id: string, u: Partial<ShipmentDetail>) => Promise<void>;
    deleteShipment: (id: string) => Promise<void>;
    moveShipmentStatus: (id: string, status: ShipmentStatus) => Promise<void>;

    // Sources
    _rawSources: SourceSupplier[];
    sources: SourceSupplier[];
    addSource: (s: Omit<SourceSupplier, "id" | "created_at" | "updated_at">) => Promise<void>;
    updateSource: (id: string, u: Partial<SourceSupplier>) => Promise<void>;
    deleteSource: (id: string) => Promise<void>;

    // Quality
    _rawQualityResults: QualityResult[];
    qualityResults: QualityResult[];
    addQualityResult: (q: Omit<QualityResult, "id" | "created_at">) => Promise<void>;
    updateQualityResult: (id: string, u: Partial<QualityResult>) => Promise<void>;

    // Market Price
    _rawMarketPrices: MarketPriceEntry[];
    marketPrices: MarketPriceEntry[];
    addMarketPrice: (m: Omit<MarketPriceEntry, "id">) => Promise<void>;

    // Meetings
    _rawMeetings: MeetingItem[];
    meetings: MeetingItem[];
    addMeeting: (m: Omit<MeetingItem, "id" | "created_at" | "updated_at">) => Promise<void>;
    updateMeeting: (id: string, u: Partial<MeetingItem>) => Promise<void>;
    deleteMeeting: (id: string) => Promise<void>;

    // Freight
    _rawFreightInfo: FreightInfo[];
    freightInfo: FreightInfo[];
    updateFreight: (id: string, u: Partial<FreightInfo>) => Promise<void>;

    // Blending Simulation
    _rawBlendingHistory: BlendingResult[];
    blendingHistory: BlendingResult[];
    simulateBlend: (inputs: { source_name: string; quantity: number; spec: CoalSpec }[], userId: string) => Promise<BlendingResult>;

    // P&L Forecast
    _rawPLForecasts: PLForecastItem[];
    plForecasts: PLForecastItem[];
    addPLForecast: (p: Omit<PLForecastItem, "id" | "created_at" | "updated_at" | "gross_profit_mt" | "total_gross_profit">) => Promise<void>;
    updatePLForecast: (id: string, u: Partial<PLForecastItem>) => Promise<void>;
    deletePLForecast: (id: string) => Promise<void>;

    // Sync Integration
    lastSyncTime: string;
    syncFromMemory: () => Promise<void>;
}

export const useCommercialStore = create<CommercialState>((set, get) => ({
    // ── Sales Deals ──────────────────────────────────────────
    _rawDeals: [],
    deals: [],
    lastSyncTime: new Date(0).toISOString(),
    addDeal: async (d) => {
        const res = await fetch("/api/memory/sales-deals", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(d)
        });
        if (res.ok) {
            const data = await res.json();
            const deal = data.deal;
            const mapped: SalesDeal = {
                id: deal.id, deal_number: deal.dealNumber, status: deal.status as SalesDealStatus, buyer: deal.buyer, buyer_country: deal.buyerCountry,
                type: deal.type, shipping_terms: deal.shippingTerms, quantity: deal.quantity, price_per_mt: deal.pricePerMt, total_value: deal.totalValue,
                laycan_start: deal.laycanStart, laycan_end: deal.laycanEnd, vessel_name: deal.vesselName, spec: { gar: deal.gar || 0, ts: deal.ts || 0, ash: deal.ash || 0, tm: deal.tm || 0 },
                project_id: deal.projectId, pic_id: deal.picId, pic_name: deal.picName, created_by: deal.createdBy, created_by_name: deal.createdByName,
                created_at: deal.createdAt, updated_at: deal.updatedAt
            };
            set((s) => {
                const raw = [mapped, ...s._rawDeals];
                return { _rawDeals: raw, deals: raw.filter(x => !x.is_deleted) };
            });
        }
    },
    updateDeal: async (id, u) => {
        const body: any = { id };
        if (u.deal_number) body.dealNumber = u.deal_number;
        if (u.buyer) body.buyer = u.buyer;
        if (u.buyer_country) body.buyerCountry = u.buyer_country;
        if (u.type) body.type = u.type;
        if (u.status) body.status = u.status;
        if (u.shipping_terms) body.shippingTerms = u.shipping_terms;
        if (u.quantity !== undefined) body.quantity = u.quantity;
        if (u.price_per_mt !== undefined) body.pricePerMt = u.price_per_mt;
        if (u.total_value !== undefined) body.totalValue = u.total_value;
        if (u.laycan_start) body.laycanStart = u.laycan_start;
        if (u.laycan_end) body.laycanEnd = u.laycan_end;
        if (u.vessel_name) body.vesselName = u.vessel_name;
        if (u.project_id) body.projectId = u.project_id;
        if (u.pic_name) body.picName = u.pic_name;

        await fetch("/api/memory/sales-deals", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        set((s) => {
            const raw = s._rawDeals.map((deal) => deal.id === id ? { ...deal, ...u, updated_at: new Date().toISOString() } : deal);
            return { _rawDeals: raw, deals: raw.filter(x => !x.is_deleted) };
        });
    },
    deleteDeal: async (id) => {
        await fetch(`/api/memory/sales-deals?id=${id}`, { method: "DELETE" });
        set((s) => {
            const raw = s._rawDeals.map((d) => d.id === id ? { ...d, is_deleted: true, updated_at: new Date().toISOString() } : d);
            return { _rawDeals: raw, deals: raw.filter(x => !x.is_deleted) };
        });
    },
    updateDealStatus: async (id, status) => {
        await get().updateDeal(id, { status } as any);
    },
    confirmDeal: async (id) => {
        await get().updateDealStatus(id, "confirmed");
    },

    // ── Shipments ────────────────────────────────────────────
    _rawShipments: [],
    shipments: [],
    addShipment: async (s) => {
        const body = {
            shipmentNumber: s.shipment_number,
            dealId: s.deal_id,
            status: s.status,
            buyer: s.buyer,
            supplier: s.supplier,
            isBlending: s.is_blending,
            iupOp: s.iup_op,
            vesselName: s.vessel_name,
            bargeName: s.barge_name,
            loadingPort: s.loading_port,
            dischargePort: s.discharge_port,
            quantityLoaded: s.quantity_loaded,
            blDate: s.bl_date,
            eta: s.eta,
            salesPrice: s.sales_price,
            marginMt: s.margin_mt,
            picName: s.pic_name,
            milestones: s.milestones,
            // Quality Spec Mapping
            gar: s.spec_actual?.gar,
            ts: s.spec_actual?.ts,
            ash: s.spec_actual?.ash,
            tm: s.spec_actual?.tm
        };
        const res = await fetch("/api/memory/shipments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        if (res.ok) {
            const data = await res.json();
            const ship = data.shipment;
            const mapped: ShipmentDetail = {
                id: ship.id, shipment_number: ship.shipmentNumber, deal_id: ship.dealId, status: ship.status as ShipmentStatus,
                buyer: ship.buyer, supplier: ship.supplier, is_blending: ship.isBlending, iup_op: ship.iupOp, vessel_name: ship.vesselName,
                barge_name: ship.bargeName, loading_port: ship.loadingPort, discharge_port: ship.dischargePort, quantity_loaded: ship.quantityLoaded,
                bl_date: ship.blDate, eta: ship.eta, sales_price: ship.salesPrice, margin_mt: ship.marginMt, pic_name: ship.picName,
                milestones: ship.milestones ? JSON.parse(ship.milestones) : [],
                created_at: ship.createdAt, updated_at: ship.updatedAt
            };
            set((state) => {
                const raw = [mapped, ...state._rawShipments];
                return { _rawShipments: raw, shipments: raw.filter(x => !x.is_deleted) };
            });
        }
    },
    updateShipment: async (id, u) => {
        const body: any = { id };
        if (u.status) body.status = u.status;
        if (u.buyer) body.buyer = u.buyer;
        if (u.supplier) body.supplier = u.supplier;
        if (u.is_blending !== undefined) body.isBlending = u.is_blending;
        if (u.iup_op) body.iupOp = u.iup_op;
        if (u.vessel_name) body.vesselName = u.vessel_name;
        if (u.barge_name) body.bargeName = u.barge_name;
        if (u.loading_port) body.loadingPort = u.loading_port;
        if (u.discharge_port) body.dischargePort = u.discharge_port;
        if (u.quantity_loaded !== undefined) body.quantityLoaded = u.quantity_loaded;
        if (u.bl_date) body.blDate = u.bl_date;
        if (u.eta) body.eta = u.eta;
        if (u.sales_price !== undefined) body.salesPrice = u.sales_price;
        if (u.margin_mt !== undefined) body.marginMt = u.margin_mt;
        if (u.pic_name) body.picName = u.pic_name;
        if (u.milestones) body.milestones = u.milestones;

        await fetch("/api/memory/shipments", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        set((s) => {
            const raw = s._rawShipments.map((ship) => ship.id === id ? { ...ship, ...u, updated_at: new Date().toISOString() } : ship);
            return { _rawShipments: raw, shipments: raw.filter(x => !x.is_deleted) };
        });
    },
    moveShipmentStatus: async (id, status) => {
        await useCommercialStore.getState().updateShipment(id, { status });
    },
    deleteShipment: async (id) => {
        await fetch(`/api/memory/shipments?id=${id}`, { method: "DELETE" });
        set((s) => {
            const raw = s._rawShipments.map((sh) => sh.id === id ? { ...sh, is_deleted: true, updated_at: new Date().toISOString() } : sh);
            return { _rawShipments: raw, shipments: raw.filter(x => !x.is_deleted) };
        });
    },

    // ── Sources ──────────────────────────────────────────────
    _rawSources: [],
    sources: [],
    addSource: async (src) => {
        const body: any = { ...src };
        if (src.calorie_range !== undefined) body.calorieRange = src.calorie_range;
        if (src.jetty_port !== undefined) body.jettyPort = src.jetty_port;
        if (src.anchorage !== undefined) body.anchorage = src.anchorage;
        if (src.min_stock_alert !== undefined) body.minStockAlert = src.min_stock_alert;
        if (src.kyc_status !== undefined) body.kycStatus = src.kyc_status;
        if (src.psi_status !== undefined) body.psiStatus = src.psi_status;
        if (src.stock_available !== undefined) body.stockAvailable = src.stock_available;
        if (src.fob_barge_only !== undefined) body.fobBargeOnly = src.fob_barge_only;
        if (src.requires_transshipment !== undefined) body.requiresTransshipment = src.requires_transshipment;
        if (src.price_linked_index !== undefined) body.priceLinkedIndex = src.price_linked_index;
        if (src.fob_barge_price_idr !== undefined) body.fobBargePriceIdr = src.fob_barge_price_idr;
        if (src.fob_barge_price_usd !== undefined) body.fobBargePriceUsd = src.fob_barge_price_usd;
        if (src.transshipment_costs !== undefined) body.transshipmentCosts = JSON.stringify(src.transshipment_costs);
        if (src.psi_date !== undefined) body.psiDate = src.psi_date;
        if (src.psi_result !== undefined) body.psiResult = src.psi_result;
        if (src.contract_type !== undefined) body.contractType = src.contract_type;
        if (src.pic_id !== undefined) body.picId = src.pic_id;
        if (src.pic_name !== undefined) body.picName = src.pic_name;
        if (src.contact_person !== undefined) body.contactPerson = src.contact_person;
        if (src.phone !== undefined) body.phone = src.phone;
        if (src.iup_number !== undefined) body.iupNumber = src.iup_number;

        const res = await fetch("/api/memory/sources", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        if (res.ok) {
            const data = await res.json();
            const source = data.source;
            const mapped: SourceSupplier = {
                id: source.id, name: source.name, region: source.region, calorie_range: source.calorieRange,
                spec: { gar: source.gar, ts: source.ts, ash: source.ash, tm: source.tm, hgi: source.hgi, adb: source.adb, nar: source.nar },
                jetty_port: source.jettyPort, anchorage: source.anchorage, min_stock_alert: source.minStockAlert,
                kyc_status: source.kycStatus, psi_status: source.psiStatus, stock_available: source.stockAvailable,
                fob_barge_only: source.fobBargeOnly, requires_transshipment: source.requiresTransshipment,
                price_linked_index: source.priceLinkedIndex, fob_barge_price_idr: source.fobBargePriceIdr, fob_barge_price_usd: source.fobBargePriceUsd,
                transshipment_costs: source.transshipmentCosts ? JSON.parse(source.transshipmentCosts) : undefined,
                psi_date: source.psiDate, psi_result: source.psiResult, contract_type: source.contractType,
                pic_id: source.picId, pic_name: source.picName, contact_person: source.contactPerson, phone: source.phone, iup_number: source.iupNumber,
                created_at: source.createdAt, updated_at: source.updatedAt
            };
            set((s) => {
                const raw = [...s._rawSources, mapped];
                return { _rawSources: raw, sources: raw.filter(x => !x.is_deleted) };
            });
        }
    },
    updateSource: async (id, u) => {
        const body: any = { id };
        if (u.name !== undefined) body.name = u.name;
        if (u.region !== undefined) body.region = u.region;
        if (u.calorie_range !== undefined) body.calorieRange = u.calorie_range;
        if (u.spec !== undefined) body.spec = u.spec;
        if (u.jetty_port !== undefined) body.jettyPort = u.jetty_port;
        if (u.anchorage !== undefined) body.anchorage = u.anchorage;
        if (u.min_stock_alert !== undefined) body.minStockAlert = u.min_stock_alert;
        if (u.kyc_status !== undefined) body.kycStatus = u.kyc_status;
        if (u.psi_status !== undefined) body.psiStatus = u.psi_status;
        if (u.stock_available !== undefined) body.stockAvailable = u.stock_available;
        if (u.fob_barge_only !== undefined) body.fobBargeOnly = u.fob_barge_only;
        if (u.requires_transshipment !== undefined) body.requiresTransshipment = u.requires_transshipment;
        if (u.price_linked_index !== undefined) body.priceLinkedIndex = u.price_linked_index;
        if (u.fob_barge_price_idr !== undefined) body.fobBargePriceIdr = u.fob_barge_price_idr;
        if (u.fob_barge_price_usd !== undefined) body.fobBargePriceUsd = u.fob_barge_price_usd;
        if (u.transshipment_costs !== undefined) body.transshipmentCosts = JSON.stringify(u.transshipment_costs);
        if (u.psi_date !== undefined) body.psiDate = u.psi_date;
        if (u.psi_result !== undefined) body.psiResult = u.psi_result;
        if (u.contract_type !== undefined) body.contractType = u.contract_type;
        if (u.pic_name !== undefined) body.picName = u.pic_name;
        if (u.contact_person !== undefined) body.contactPerson = u.contact_person;
        if (u.phone !== undefined) body.phone = u.phone;
        if (u.iup_number !== undefined) body.iupNumber = u.iup_number;

        await fetch("/api/memory/sources", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        set((s) => {
            const raw = s._rawSources.map((src) => src.id === id ? { ...src, ...u, updated_at: new Date().toISOString() } : src);
            return { _rawSources: raw, sources: raw.filter(x => !x.is_deleted) };
        });
    },
    deleteSource: async (id) => {
        await fetch(`/api/memory/sources?id=${id}`, { method: "DELETE" });
        set((s) => {
            const raw = s._rawSources.map((src) => src.id === id ? { ...src, is_deleted: true, updated_at: new Date().toISOString() } : src);
            return { _rawSources: raw, sources: raw.filter(x => !x.is_deleted) };
        });
    },

    // ── Quality ──────────────────────────────────────────────
    _rawQualityResults: [],
    qualityResults: [],
    addQualityResult: async (q) => {
        const body = {
            cargoId: q.cargo_id,
            cargoName: q.cargo_name,
            surveyor: q.surveyor,
            samplingDate: q.sampling_date,
            specResult: q.spec_result,
            status: q.status,
        };
        const res = await fetch("/api/memory/quality", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        if (res.ok) {
            const data = await res.json();
            const qr = data.quality;
            const mapped: QualityResult = {
                id: qr.id, cargo_id: qr.cargoId, cargo_name: qr.cargoName, surveyor: qr.surveyor,
                sampling_date: qr.samplingDate, spec_result: { gar: qr.gar, ts: qr.ts, ash: qr.ash, tm: qr.tm },
                status: qr.status, created_at: qr.createdAt
            };
            set((s) => {
                const raw = [...s._rawQualityResults, mapped];
                return { _rawQualityResults: raw, qualityResults: raw.filter(x => !x.is_deleted) };
            });
        }
    },
    updateQualityResult: async (id, u) => {
        const body: any = { id };
        if (u.cargo_id !== undefined) body.cargoId = u.cargo_id;
        if (u.cargo_name !== undefined) body.cargoName = u.cargo_name;
        if (u.surveyor !== undefined) body.surveyor = u.surveyor;
        if (u.sampling_date !== undefined) body.samplingDate = u.sampling_date;
        if (u.spec_result !== undefined) body.specResult = u.spec_result;
        if (u.status !== undefined) body.status = u.status;

        const res = await fetch("/api/memory/quality", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || "Failed to update quality result");
        }
        const data = await res.json();
        const qr = data.quality;
        const mapped = {
            id: qr.id, cargo_id: qr.cargoId, cargo_name: qr.cargoName, surveyor: qr.surveyor,
            sampling_date: qr.samplingDate, spec_result: { gar: qr.gar, ts: qr.ts, ash: qr.ash, tm: qr.tm },
            status: qr.status, created_at: qr.createdAt
        };
        set((s) => {
            const raw = s._rawQualityResults.map((q) => q.id === id ? { ...q, ...mapped } : q);
            return { _rawQualityResults: raw, qualityResults: raw.filter(x => !x.is_deleted) };
        });
    },

    // ── Market Price ─────────────────────────────────────────
    _rawMarketPrices: [],
    marketPrices: [],
    addMarketPrice: async (m) => {
        const res = await fetch("/api/memory/market-prices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(m)
        });
        if (!res.ok) {
            const errorText = await res.text();
            console.error("Failed to add market price:", errorText);
            throw new Error("Failed to save market price: " + res.status);
        }
        if (res.ok) {
            const data = await res.json();
            const mp = data.price; // API returns { success: true, price: ... }
            const mapped: MarketPriceEntry = {
                id: mp.id,
                is_deleted: mp.isDeleted || false,
                date: mp.date,
                ici_1: mp.ici1 !== undefined && mp.ici1 !== null ? mp.ici1 : (mp.ici_1 || 0),
                ici_2: mp.ici2 !== undefined && mp.ici2 !== null ? mp.ici2 : (mp.ici_2 || 0),
                ici_3: mp.ici3 !== undefined && mp.ici3 !== null ? mp.ici3 : (mp.ici_3 || 0),
                ici_4: mp.ici4 !== undefined && mp.ici4 !== null ? mp.ici4 : (mp.ici_4 || 0),
                ici_5: mp.ici5 !== undefined && mp.ici5 !== null ? mp.ici5 : (mp.ici_5 || 0),
                newcastle: mp.newcastle !== undefined && mp.newcastle !== null ? mp.newcastle : 0,
                hba: mp.hba !== undefined && mp.hba !== null ? mp.hba : 0,
                source: mp.source
            };
            set((s) => {
                // Remove existing if date matches (upsert behavior)
                const dateOnly = new Date(mapped.date).toISOString().split('T')[0];
                const filtered = s._rawMarketPrices.filter(x =>
                    new Date(x.date).toISOString().split('T')[0] !== dateOnly
                );
                const raw = [mapped, ...filtered];
                raw.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                return { _rawMarketPrices: raw, marketPrices: raw.filter(x => !x.is_deleted) };
            });
        }
    },

    // ── Meetings ─────────────────────────────────────────────
    _rawMeetings: [],
    meetings: [],
    addMeeting: async (m) => {
        const res = await fetch("/api/memory/meetings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(m)
        });
        if (res.ok) {
            const data = await res.json();
            const mtg = data.meeting;
            const mapped: MeetingItem = {
                id: mtg.id, title: mtg.title, date: mtg.date, time: mtg.time,
                attendees: mtg.attendees ? JSON.parse(mtg.attendees) : [], location: mtg.location,
                status: mtg.status, action_items: mtg.actionItems ? JSON.parse(mtg.actionItems) : [],
                mom_content: mtg.momContent || undefined,
                voice_note_url: mtg.voiceNoteUrl || undefined,
                ai_summary: mtg.aiSummary || undefined,
                created_by: mtg.createdBy, created_by_name: mtg.createdByName,
                created_at: mtg.createdAt, updated_at: mtg.updatedAt
            };
            set((s) => {
                const raw = [...s._rawMeetings, mapped];
                return { _rawMeetings: raw, meetings: raw.filter(x => !x.is_deleted) };
            });
        }
    },
    updateMeeting: async (id, u) => {
        const body: any = { id };
        if (u.title) body.title = u.title;
        if (u.date) body.date = u.date;
        if (u.time) body.time = u.time;
        if (u.attendees) body.attendees = JSON.stringify(u.attendees);
        if (u.location) body.location = u.location;
        if (u.status) body.status = u.status;
        if (u.action_items) body.actionItems = JSON.stringify(u.action_items);
        if (u.created_by) body.createdBy = u.created_by;
        if (u.created_by_name) body.createdByName = u.created_by_name;
        if (u.mom_content !== undefined) body.momContent = u.mom_content;
        if (u.voice_note_url !== undefined) body.voiceNoteUrl = u.voice_note_url;
        if (u.ai_summary !== undefined) body.aiSummary = u.ai_summary;

        await fetch("/api/memory/meetings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        set((s) => {
            const raw = s._rawMeetings.map((m) => m.id === id ? { ...m, ...u, updated_at: new Date().toISOString() } : m);
            return { _rawMeetings: raw, meetings: raw.filter(x => !x.is_deleted) };
        });
    },
    deleteMeeting: async (id) => {
        await fetch(`/api/memory/meetings?id=${id}`, { method: "DELETE" });
        set((s) => {
            const raw = s._rawMeetings.map((m) => m.id === id ? { ...m, is_deleted: true, updated_at: new Date().toISOString() } : m);
            return { _rawMeetings: raw, meetings: raw.filter(x => !x.is_deleted) };
        });
    },

    // ── Freight ──────────────────────────────────────────────
    _rawFreightInfo: [],
    freightInfo: [],
    updateFreight: async (id, u) => set((s) => {
        const raw = s._rawFreightInfo.map((f) => f.id === id ? { ...f, ...u, updated_at: new Date().toISOString() } : f);
        return { _rawFreightInfo: raw, freightInfo: raw.filter(x => !x.is_deleted) };
    }),

    // ── Blending ─────────────────────────────────────────────
    _rawBlendingHistory: [],
    blendingHistory: [],
    simulateBlend: async (inputs, userId) => {
        const total_quantity = inputs.reduce((s, i) => s + i.quantity, 0);
        const result_spec = blendSpecs(inputs);

        try {
            const res = await fetch("/api/memory/blending", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    inputs,
                    totalQuantity: total_quantity,
                    resultGar: result_spec.gar,
                    resultTs: result_spec.ts,
                    resultAsh: result_spec.ash,
                    resultTm: result_spec.tm || 0,
                }),
            });
            const data = await res.json();
            if (data.success) {
                const newSim: BlendingResult = {
                    id: data.simulation.id,
                    inputs,
                    total_quantity,
                    result_spec,
                    created_by: userId,
                    created_at: data.simulation.createdAt,
                };
                set((s) => ({
                    _rawBlendingHistory: [newSim, ...s._rawBlendingHistory],
                    blendingHistory: [newSim, ...s.blendingHistory].filter(x => !x.is_deleted)
                }));
                return newSim;
            }
        } catch (e) {
            console.error("Failed to save blending simulation:", e);
        }

        // Fallback for UI if API fails
        const fallback: BlendingResult = {
            id: `tmp-${Date.now()}`,
            inputs,
            total_quantity,
            result_spec,
            created_by: userId,
            created_at: new Date().toISOString(),
        };
        return fallback;
    },

    // ── P&L Forecast ─────────────────────────────────────────
    _rawPLForecasts: [],
    plForecasts: [],
    addPLForecast: async (p) => {
        const body: any = { ...p };
        // Map to camelCase for API
        if (p.deal_id) body.dealId = p.deal_id;
        if (p.deal_number) body.dealNumber = p.deal_number;
        if (p.selling_price !== undefined) body.sellingPrice = p.selling_price;
        if (p.buying_price !== undefined) body.buyingPrice = p.buying_price;
        if (p.freight_cost !== undefined) body.freightCost = p.freight_cost;
        if (p.other_cost !== undefined) body.otherCost = p.other_cost;
        if (p.project_name) body.projectName = p.project_name;

        const res = await fetch("/api/memory/pl-forecasts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || "Failed to create forecast");
        }
        const data = await res.json();
        const pl = data.forecast;
        const mapped: PLForecastItem = {
            id: pl.id,
            deal_id: pl.dealId || "",
            deal_number: pl.dealNumber || "",
            project_name: pl.projectName || pl.dealNumber || "",
            status: pl.status || "forecast",
            created_by: pl.createdBy || "unknown",
            type: pl.type || "export",
            buyer: pl.buyer || "Unknown",
            quantity: pl.quantity || 0,
            selling_price: pl.sellingPrice || 0,
            buying_price: pl.buyingPrice || 0,
            freight_cost: pl.freightCost || 0,
            other_cost: pl.otherCost || 0,
            gross_profit_mt: pl.grossProfitMt || 0,
            total_gross_profit: pl.totalGrossProfit || 0,
            created_at: pl.createdAt || new Date().toISOString(),
            updated_at: pl.updatedAt || new Date().toISOString()
        };
        set((s) => {
            if (s._rawPLForecasts.some(f => f.id === mapped.id)) return s;
            const raw = [...s._rawPLForecasts, mapped];
            return { _rawPLForecasts: raw, plForecasts: raw.filter(x => !x.is_deleted) };
        });
    },
    updatePLForecast: async (id: string, u: Partial<PLForecastItem>) => {
        const body: any = { id, ...u };
        if (u.deal_id) body.dealId = u.deal_id;
        if (u.deal_number) body.dealNumber = u.deal_number;
        if (u.selling_price !== undefined) body.sellingPrice = u.selling_price;
        if (u.buying_price !== undefined) body.buyingPrice = u.buying_price;
        if (u.freight_cost !== undefined) body.freightCost = u.freight_cost;
        if (u.other_cost !== undefined) body.otherCost = u.other_cost;
        if (u.project_name) body.projectName = u.project_name;
        if (u.buyer) body.buyer = u.buyer;
        if (u.status) body.status = u.status;
        if (u.type) body.type = u.type;

        const res = await fetch("/api/memory/pl-forecasts", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || "Failed to update forecast");
        }

        const data = await res.json();
        const pl = data.forecast;
        const mapped: PLForecastItem = {
            id: pl.id,
            deal_id: pl.dealId || "",
            deal_number: pl.dealNumber || "",
            project_name: pl.projectName || pl.dealNumber || "",
            status: pl.status || "forecast",
            created_by: pl.createdBy || "unknown",
            type: pl.type || "export",
            buyer: pl.buyer || "Unknown",
            quantity: pl.quantity || 0,
            selling_price: pl.sellingPrice || 0,
            buying_price: pl.buyingPrice || 0,
            freight_cost: pl.freightCost || 0,
            other_cost: pl.otherCost || 0,
            gross_profit_mt: pl.grossProfitMt || 0,
            total_gross_profit: pl.totalGrossProfit || 0,
            created_at: pl.createdAt,
            updated_at: pl.updatedAt,
            is_deleted: pl.isDeleted
        };
        set((s) => {
            const raw = s._rawPLForecasts.map((f) => f.id === id ? mapped : f);
            return { _rawPLForecasts: raw, plForecasts: raw.filter(x => !x.is_deleted) };
        });
    },
    deletePLForecast: async (id: string) => {
        const res = await fetch(`/api/memory/pl-forecasts?id=${id}`, {
            method: "DELETE"
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || "Failed to delete forecast");
        }
        set((s) => ({
            _rawPLForecasts: s._rawPLForecasts.map(f => f.id === id ? { ...f, is_deleted: true } : f),
            plForecasts: s.plForecasts.filter(f => f.id !== id)
        }));
    },

    // ── Sync Integration ─────────────────────────────────────
    syncFromMemory: async () => {
        try {
            const ts = Date.now();
            const fetchOpts = { cache: 'no-store' as RequestCache, headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' } };
            const [shipRes, srcRes, qRes, mpRes, mtgRes, plRes, dealRes, blendRes] = await Promise.all([
                fetch(`/api/memory/shipments?t=${ts}`, fetchOpts).then(res => res.json()),
                fetch(`/api/memory/sources?t=${ts}`, fetchOpts).then(res => res.json()),
                fetch(`/api/memory/quality?t=${ts}`, fetchOpts).then(res => res.json()),
                fetch(`/api/memory/market-prices?t=${ts}`, fetchOpts).then(res => res.json()),
                fetch(`/api/memory/meetings?t=${ts}`, fetchOpts).then(res => res.json()),
                fetch(`/api/memory/pl-forecasts?t=${ts}`, fetchOpts).then(res => res.json()),
                fetch(`/api/memory/sales-deals?t=${ts}`, fetchOpts).then(res => res.json()),
                fetch(`/api/memory/blending?t=${ts}`, fetchOpts).then(res => res.json())
            ]);

            set((state) => {
                const updates: Partial<CommercialState> = {};

                // Shipments merge
                if (shipRes.success && shipRes.shipments) {
                    const mappedShipments: ShipmentDetail[] = shipRes.shipments.map((s: any) => ({
                        id: s.id, shipment_number: s.shipmentNumber, deal_id: s.dealId, status: s.status as ShipmentStatus,
                        buyer: s.buyer, supplier: s.supplier, is_blending: s.isBlending, iup_op: s.iupOp, vessel_name: s.vesselName,
                        barge_name: s.bargeName, loading_port: s.loadingPort, discharge_port: s.dischargePort, quantity_loaded: s.quantityLoaded,
                        bl_date: s.blDate, eta: s.eta, sales_price: s.salesPrice, margin_mt: s.marginMt, pic_name: s.picName,
                        type: s.type || "export",
                        milestones: Array.isArray(s.milestones) ? s.milestones : [],
                        created_at: s.createdAt, updated_at: s.updatedAt, is_deleted: s.isDeleted
                    }));
                    updates._rawShipments = mappedShipments;
                    updates.shipments = mappedShipments.filter(x => !x.is_deleted);
                }

                // Sources merge
                if (srcRes.success && srcRes.sources) {
                    const mappedSources: SourceSupplier[] = srcRes.sources.map((s: any) => ({
                        id: s.id, name: s.name, region: s.region, calorie_range: s.calorieRange,
                        spec: { gar: s.gar, ts: s.ts, ash: s.ash, tm: s.tm, hgi: 0, adb: 0, nar: 0 },
                        jetty_port: s.jettyPort, anchorage: s.anchorage, min_stock_alert: s.minStockAlert,
                        kyc_status: s.kycStatus, psi_status: s.psiStatus, stock_available: s.stockAvailable,
                        fob_barge_only: s.fobBargeOnly, requires_transshipment: s.requiresTransshipment,
                        price_linked_index: s.priceLinkedIndex, fob_barge_price_idr: s.fobBargePriceIdr, fob_barge_price_usd: s.fobBargePriceUsd,
                        transshipment_costs: s.transshipmentCosts ? JSON.parse(s.transshipmentCosts) : undefined,
                        psi_date: s.psiDate, psi_result: s.psiResult, contract_type: s.contractType,
                        pic_id: s.picId, pic_name: s.picName, contact_person: s.contactPerson, phone: s.phone, iup_number: s.iupNumber,
                        created_at: s.createdAt, updated_at: s.updatedAt, is_deleted: s.isDeleted
                    }));
                    updates._rawSources = mappedSources;
                    updates.sources = mappedSources.filter(x => !x.is_deleted);
                }

                // Quality merge
                if (qRes.success && qRes.quality) {
                    const mappedQuality: QualityResult[] = qRes.quality.map((q: any) => ({
                        id: q.id, cargo_id: q.cargoId, cargo_name: q.cargoName, surveyor: q.surveyor,
                        sampling_date: q.samplingDate, spec_result: { gar: q.gar, ts: q.ts, ash: q.ash, tm: q.tm },
                        status: q.status, created_at: q.createdAt, is_deleted: q.isDeleted
                    }));
                    updates._rawQualityResults = mappedQuality;
                    updates.qualityResults = mappedQuality.filter(x => !x.is_deleted);
                }

                // Market Price merge
                if (mpRes.success && mpRes.prices) {
                    const mappedPrices: MarketPriceEntry[] = mpRes.prices.map((m: any) => ({
                        id: m.id,
                        date: m.date,
                        ici_1: m.ici1 !== undefined ? m.ici1 : (m.ici_1 || 0),
                        ici_2: m.ici2 !== undefined ? m.ici2 : (m.ici_2 || 0),
                        ici_3: m.ici3 !== undefined ? m.ici3 : (m.ici_3 || 0),
                        ici_4: m.ici4 !== undefined ? m.ici4 : (m.ici_4 || 0),
                        ici_5: m.ici5 !== undefined ? m.ici5 : (m.ici_5 || 0),
                        newcastle: m.newcastle || 0,
                        hba: m.hba || 0,
                        source: m.source || "-",
                        updated_at: m.updatedAt || new Date().toISOString(),
                        is_deleted: m.isDeleted
                    }));
                    updates._rawMarketPrices = mappedPrices;
                    updates.marketPrices = mappedPrices.filter(x => !x.is_deleted);
                }

                // Blending merge
                if (blendRes && blendRes.success && blendRes.blendingHistory) {
                    const mappedBlending: BlendingResult[] = blendRes.blendingHistory.map((b: any) => ({
                        id: b.id,
                        inputs: b.inputs,
                        total_quantity: b.totalQuantity,
                        result_spec: { gar: b.resultGar, ts: b.resultTs, ash: b.resultAsh, tm: b.resultTm },
                        created_by: b.createdBy,
                        created_at: b.createdAt,
                        is_deleted: b.isDeleted
                    }));
                    updates._rawBlendingHistory = mappedBlending;
                    updates.blendingHistory = mappedBlending.filter(x => !x.is_deleted);
                }

                // Meetings merge
                if (mtgRes.success && mtgRes.meetings) {
                    const mappedMeetings: MeetingItem[] = mtgRes.meetings.map((m: any) => ({
                        id: m.id, title: m.title, date: m.date, time: m.time,
                        attendees: Array.isArray(m.attendees) ? m.attendees : [],
                        location: m.location,
                        status: m.status,
                        action_items: Array.isArray(m.actionItems) ? m.actionItems : [],
                        mom_content: m.momContent || undefined,
                        voice_note_url: m.voiceNoteUrl || undefined,
                        ai_summary: m.aiSummary || undefined,
                        created_by: m.createdBy, created_by_name: m.createdByName,
                        created_at: m.createdAt, updated_at: m.updatedAt, is_deleted: m.isDeleted
                    }));
                    updates._rawMeetings = mappedMeetings;
                    updates.meetings = mappedMeetings.filter(x => !x.is_deleted);
                }

                // PL merge
                if (plRes.success && plRes.forecasts) {
                    const mappedPL: PLForecastItem[] = plRes.forecasts.map((p: any) => ({
                        id: p.id,
                        deal_id: p.dealId || "",
                        deal_number: p.dealNumber || "",
                        project_name: p.projectName || p.dealNumber || "",
                        status: p.status || "forecast",
                        created_by: p.createdBy || "unknown",
                        type: p.type || "export",
                        buyer: p.buyer || "Unknown",
                        quantity: p.quantity || 0,
                        selling_price: p.sellingPrice || 0,
                        buying_price: p.buyingPrice || 0,
                        freight_cost: p.freightCost || 0,
                        other_cost: p.otherCost || 0,
                        gross_profit_mt: p.grossProfitMt || 0,
                        total_gross_profit: p.totalGrossProfit || 0,
                        created_at: p.createdAt,
                        updated_at: p.updatedAt,
                        is_deleted: p.isDeleted
                    }));
                    updates._rawPLForecasts = mappedPL;
                    updates.plForecasts = mappedPL.filter(x => !x.is_deleted);
                }

                // Deals merge
                if (dealRes.success && dealRes.deals) {
                    const mappedDeals: SalesDeal[] = dealRes.deals.map((deal: any) => ({
                        id: deal.id, deal_number: deal.dealNumber, status: deal.status as SalesDealStatus, buyer: deal.buyer, buyer_country: deal.buyerCountry,
                        type: deal.type, shipping_terms: deal.shippingTerms, quantity: deal.quantity, price_per_mt: deal.pricePerMt, total_value: deal.totalValue,
                        laycan_start: deal.laycanStart, laycan_end: deal.laycanEnd, vessel_name: deal.vesselName, spec: { gar: deal.gar || 0, ts: deal.ts || 0, ash: deal.ash || 0, tm: deal.tm || 0 },
                        project_id: deal.projectId, pic_id: deal.picId, pic_name: deal.picName, created_by: deal.createdBy, created_by_name: deal.createdByName,
                        created_at: deal.createdAt, updated_at: deal.updatedAt, is_deleted: deal.isDeleted
                    }));
                    updates._rawDeals = mappedDeals;
                    updates.deals = mappedDeals.filter(x => !x.is_deleted);
                }

                updates.lastSyncTime = new Date().toISOString();
                return Object.keys(updates).length > 0 ? updates : state;
            });
        } catch (error) {
            console.error("syncFromMemory error:", error);
        }
    }
}));
