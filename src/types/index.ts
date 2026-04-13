// ── Roles & Permissions ───────────────────────────────────────
export type Role = "ceo" | "director" | "marketing" | "purchasing" | "operation";

export type Permission =
    | "dashboard"
    | "approval_inbox"
    | "my_tasks"
    | "all_tasks"
    | "sales_orders"
    | "purchase_requests"
    | "profit_loss"
    | "manage_roles"
    | "audit_logs"
    | "approve_tasks"
    | "approve_sales"
    | "approve_purchases"
    | "move_any_task"
    | "move_to_done"
    | "chatbot"
    | "view_restricted_finance"
    | "sales_monitor"
    | "shipment_monitor"
    | "source_management"
    | "quality"
    | "blending_simulation"
    | "market_price"
    | "market_price_edit"
    | "meetings"
    | "transshipment"
    | "outstanding_payment";

// ── Job Titles & Departments ────────────────────────────────────
export type JobTitle =
    | "CMO" | "Head of Traffic" | "Junior Trader" | "Junior Trader (PA CMO)" | "Traffic Admin"
    | "Commercial Admin" | "Stockpile Management" | "CPO"
    | "Purchase Supervisor" | "Supplier Admin" | "COO" | "Region Head"
    | "Chief Executive Officer" | "Assistant CEO" | "Chief Marketing Officer"
    | "Chief Purchasing Officer" | "Chief Operation Officer" | "Traffic";

export type Department =
    | "Executive" | "Sales/Marketing" | "Purchasing"
    | "Operation" | "Traffic" | "Commercial" | "Stockpile";

// ── Users ─────────────────────────────────────────────────────
export interface User {
    id: string;
    name: string;
    email: string;
    role: Role;
    phone: string;
    avatar?: string;
    job_title?: JobTitle;
    department?: Department;
    created_at: string;
}

// ── Tasks ─────────────────────────────────────────────────────
export type TaskStatus = "todo" | "in_progress" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface TaskComment {
    id: string;
    task_id: string;
    user_id: string;
    user_name: string;
    user_role: Role;
    content: string;
    created_at: string;
}

export interface TaskActivity {
    id: string;
    task_id: string;
    user_name: string;
    action: string;
    created_at: string;
}

export interface Task {
    id: string;
    is_deleted?: boolean;
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    assignee_id: string;
    assignee_name: string;
    due_date: string;
    created_by: string;
    created_at: string;
    updated_at: string;
    comments: TaskComment[];
    activities: TaskActivity[];
}

// ── Sales Orders (legacy, kept for compatibility) ─────────────
export type OrderStatus = "draft" | "pending" | "approved" | "rejected";

export interface SalesOrder {
    id: string;
    is_deleted?: boolean;
    order_number: string;
    client: string;
    description: string;
    amount: number;
    status: OrderStatus;
    priority?: TaskPriority;
    image_url?: string;
    created_by: string;
    created_by_name: string;
    approved_by?: string;
    notes?: string;
    created_at: string;
    updated_at: string;
}

// ── Purchase Requests (AI Expense Tracking) ───────────────────
export type PurchaseStatus = "draft" | "pending" | "approved" | "rejected";

export interface OCRData {
    confidence: number;
    extracted_amount?: number;
    extracted_date?: string;
    extracted_vendor?: string;
}

export interface PurchaseRequest {
    id: string;
    is_deleted?: boolean;
    request_number: string;
    category: string;
    supplier?: string;
    description: string;
    amount: number;
    status: PurchaseStatus;
    priority?: TaskPriority;
    image_url?: string;
    created_by: string;
    created_by_name: string;
    approved_by?: string;
    notes?: string;
    is_anomaly?: boolean;
    anomaly_reason?: string;
    ocr_data?: OCRData;
    created_at: string;
    updated_at: string;
}

// ── Sales Monitor (Commercial) ────────────────────────────────
export type SalesDealStatus = "pre_sale" | "confirmed" | "forecast";
export type ShippingTerms = "FOB" | "CIF" | "CFR" | "FAS" | "DAP";
export type SalesDealType = "local" | "export";

export interface CoalSpec {
    gar: number;       // Gross As Received (kcal/kg)
    ts: number;        // Total Sulphur (%)
    ash: number;       // Ash content (%)
    tm?: number;       // Total Moisture (%)
    im?: number;       // Inherent Moisture (%)
    fc?: number;       // Fixed Carbon (%)
    hgi?: number;      // Hardgrove Grindability Index
    adb?: number;      // Air Dried Basis (kcal/kg)
    nar?: number;      // Net As Received (kcal/kg)
}

export interface SalesDeal {
    id: string;
    is_deleted?: boolean;
    deal_number: string;       // SD-YYYYMMDD-XXXX
    status: SalesDealStatus;
    buyer: string;
    buyer_country?: string;
    type: SalesDealType;
    shipping_terms: ShippingTerms;
    quantity: number;          // MT
    price_per_mt?: number;     // USD/MT
    total_value?: number;      // USD
    laycan_start?: string;     // Laycan Period of Loading start
    laycan_end?: string;
    vessel_name?: string;
    spec: CoalSpec;
    project_id?: string;      // links to project after confirmation
    pic_id?: string;           // Person In Charge
    pic_name?: string;
    notes?: string;
    created_by: string;
    created_by_name: string;
    created_at: string;
    updated_at: string;
}

export interface ProjectItem {
    id: string;
    is_deleted?: boolean;
    name: string;
    segment?: string;
    buyer?: string;
    status?: string;
    notes?: string;
    created_by?: string;
    created_by_name?: string;
    created_at: string;
    updated_at: string;
}

// ── Shipment Monitor ──────────────────────────────────────────
export type ShipmentStatus = "upcoming" | "done_shipment" | "loading" | "in_transit" | "completed" | "cancelled";

export interface ShipmentDetail {
    id: string;
    is_deleted?: boolean;
    no?: number;
    export_dmo?: string;
    status: string;
    origin?: string;
    mv_project_name?: string;
    source?: string;
    iup_op?: string;
    shipment_flow?: string;
    jetty_loading_port?: string;
    laycan?: string;
    nomination?: string;
    qty_plan?: number;
    qty_cob?: number;
    remarks?: string;
    harga_actual_fob?: number;
    harga_actual_fob_mv?: number;
    hpb?: number;
    status_hpb?: string;
    shipment_status?: string;
    issue_notes?: string;
    status_reason?: string;
    bl_date?: string;
    pic?: string;
    kuota_export?: string;
    surveyor_lhv?: string;
    completely_loaded?: string;
    lhv_terbit?: string;
    loss_gain_cargo?: number;
    sp?: number;
    deadfreight?: number;
    jarak?: number;
    shipping_term?: string;
    shipping_rate?: number;
    price_freight?: number;
    allowance?: string;
    demm?: string;
    no_spal?: string;
    no_si?: string;
    sent_to_supplier?: string;
    sent_to_barge_owner?: string;
    no_invoice_mkls?: string;
    coa_date?: string;
    result_gar?: number;
    // Legacy compat
    shipment_number?: string;
    deal_id?: string;
    buyer?: string;
    supplier?: string;
    vessel_name?: string;
    barge_name?: string;
    loading_port?: string;
    discharge_port?: string;
    quantity_loaded?: number;
    quantity_discharged?: number;
    eta?: string;
    sales_price?: number;
    margin_mt?: number;
    pic_name?: string;
    product?: string;
    analysis_method?: string;
    type?: string;
    year?: number;
    region?: string;
    buyer_country?: string;
    is_blending?: boolean;
    blend_sources?: string[];
    spec_actual?: CoalSpec;
    pending_items?: string[];
    milestones?: { title: string; subtitle: string; status: string }[];
    created_at?: string;
    updated_at?: string;
}

// ── Daily Delivery ────────────────────────────────────────────────
export interface DailyDelivery {
    id: string;
    report_type: string; // "domestic" | "export"
    year: number;
    shipment_status?: string;
    buyer?: string;
    pod?: string;
    shipping_term?: string;
    latest_eta_pod?: string;
    arrive_at_pod?: string;
    keterlambatan?: string;
    pol?: string;
    laycan_pol?: string;
    area?: string;
    supplier?: string;
    mv_barge_nomination?: string;
    issue?: string;
    bl_month?: string;
    bl_quantity?: number;
    bl_date?: string;
    analysis_method?: string;
    surveyor_pol?: string;
    surveyor_pod?: string;
    project?: string;
    flow?: string;
    terpal?: string;
    insurance?: string;
    base_price?: number;
    base_price_notes?: string;
    po_month?: string;
    product?: string;
    arrive_at_pol?: string;
    commence_loading?: string;
    complete_loading?: string;
    start_discharging?: string;
    complete_discharged?: string;
    pod_quantity?: number;
    loss_gain_cargo?: number;
    po_no?: string;
    contract_no?: string;
    contract_type?: string;
    invoice_price?: number;
    invoice_amount?: number;
    payment_due_date?: string;
    payment_status?: string;
    spec_contract?: string;
    actual_gcv_gar?: number;
    actual_ts?: number;
    actual_ash?: number;
    actual_tm?: number;
    created_at?: string;
    updated_at?: string;
}

// ── Outstanding Payment ──────────────────────────────────────────
export interface OutstandingPayment {
    id: string;
    perusahaan: string;
    kode_batu?: string;
    price_incl_pph?: number;
    qty?: number;
    total_dp?: number;
    calculation_date?: string;
    dp_to_shipment?: string;
    timeframe_days?: string;
    status: string; // pending, partial, paid
    year: number;
    created_at?: string;
    updated_at?: string;
}

// ── Source / Supplier Management ──────────────────────────────
export type KYCStatus = "not_started" | "in_progress" | "verified" | "expired";
export type PSIStatus = "not_started" | "scheduled" | "passed" | "failed";

export interface TransshipmentCost {
    idr?: number;
    usd?: number;
}

export interface SourceSupplier {
    id: string;
    is_deleted?: boolean;
    name: string;
    region: string;
    jetty_port?: string;
    anchorage?: string;

    calorie_range: string;     // e.g. "GAR 4200-4500"
    spec: CoalSpec;

    stock_available: number;   // MT
    min_stock_alert?: number;  // MT

    fob_barge_only?: boolean;
    requires_transshipment?: boolean;

    price_linked_index?: string;
    fob_barge_price_idr?: number;
    fob_barge_price_usd?: number;

    transshipment_costs?: {
        barge_2300?: TransshipmentCost;
        barge_5300?: TransshipmentCost;
        barge_7500?: TransshipmentCost;
        barge_8000?: TransshipmentCost;
    };

    kyc_status: KYCStatus;
    psi_status: PSIStatus;
    psi_date?: string;
    psi_result?: string;
    contract_type?: string;

    pic_id?: string;
    pic_name?: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    iup_number?: string;
    notes?: string;
    created_at: string;
    updated_at: string;
}

// ── Quality / Cargo Sampling ──────────────────────────────────
export interface QualityResult {
    id: string;
    is_deleted?: boolean;
    cargo_id: string;          // shipment or deal reference
    cargo_name: string;
    surveyor: string;
    sampling_date: string;
    spec_result: CoalSpec;
    status: "pending" | "passed" | "rejected" | "on_hold";
    certificate_url?: string;
    notes?: string;
    created_at: string;
}

// ── Blending Simulation ──────────────────────────────────────
export interface BlendingInput {
    source_name: string;
    quantity: number;          // MT
    spec: CoalSpec;
}

export interface BlendingResult {
    id: string;
    is_deleted?: boolean;
    inputs: BlendingInput[];
    total_quantity: number;
    result_spec: CoalSpec;
    target_spec?: CoalSpec;
    created_by: string;
    created_at: string;
}

// ── Market Price ──────────────────────────────────────────────
export interface MarketPriceEntry {
    id: string;
    is_deleted?: boolean;
    date: string;
    ici_1: number;             // ICI 1 (GAR 6500)
    ici_2: number;             // ICI 2 (GAR 5800)
    ici_3: number;             // ICI 3 (GAR 5000)
    ici_4: number;             // ICI 4 (GAR 4200)
    ici_5?: number;            // ICI 5 (GAR 3400)
    newcastle: number;         // Newcastle Index
    hba: number;               // Harga Batubara Acuan
    hba_1?: number; // HBA I
    hba_2?: number; // HBA II
    hba_3?: number; // HBA III
    source?: string;
    notes?: string;
    created_by?: string;
}

// ── Meeting / MOM ─────────────────────────────────────────────
export interface MeetingItem {
    id: string;
    is_deleted?: boolean;
    title: string;
    date: string;
    time: string;
    attendees: string[];
    location?: string;
    google_calendar_id?: string;
    mom_content?: string;      // Minutes of Meeting (plain text transcript)
    voice_note_url?: string;
    ai_summary?: string;       // AI-generated summary (markdown)
    action_items: MeetingActionItem[];
    status: "scheduled" | "in_progress" | "completed" | "cancelled";
    created_by: string;
    created_by_name: string;
    created_at: string;
    updated_at: string;
}

export interface MeetingActionItem {
    id: string;
    is_deleted?: boolean;
    description: string;
    assignee_id: string;
    assignee_name: string;
    due_date: string;
    status: TaskStatus;
    linked_task_id?: string;
}

// ── Transshipment / Freight ───────────────────────────────────
export interface FreightInfo {
    id: string;
    is_deleted?: boolean;
    origin: string;
    destination: string;
    distance_nm: number;       // Nautical Miles
    freight_rate: number;      // USD/MT
    vendor: string;
    vessel_type?: string;
    notes?: string;
    updated_at: string;
}

// ── P&L Forecast ──────────────────────────────────────────────
export interface PLForecastItem {
    id: string;
    is_deleted?: boolean;
    deal_id: string;
    deal_number: string;
    buyer: string;
    type: SalesDealType;
    quantity: number;
    selling_price: number;     // USD/MT
    buying_price: number;      // USD/MT
    freight_cost: number;      // USD/MT
    other_cost: number;        // USD/MT
    gross_profit_mt: number;
    total_gross_profit: number;
    status: SalesDealStatus;
    project_name?: string;
    created_by: string;
    created_at: string;
    updated_at: string;
    _isOptimistic?: boolean;   // Flag for optimistic UI updates
}

// ── Audit Logs ────────────────────────────────────────────────
export interface AuditLog {
    id: string;
    user_name: string;
    user_role: Role;
    action: string;
    target: string;
    details?: string;
    created_at: string;
}

// ── Chat ──────────────────────────────────────────────────────
export interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    created_at: string;
}

// ── Dashboard Metric ──────────────────────────────────────────
export interface MetricCardData {
    title: string;
    value: string | number;
    subtitle: string;
    icon: string;
    trend?: { value: number; positive: boolean };
    restricted?: boolean;      // CEO/Director only
}
