import { Role, Permission, TaskStatus, TaskPriority, OrderStatus, PurchaseStatus, SalesDealStatus, ShipmentStatus, KYCStatus, PSIStatus } from "@/types";

// ── Role Definitions ──────────────────────────────────────────
export const ROLES: { value: Role; label: string; color: string; department?: string }[] = [
    { value: "ceo", label: "CEO", color: "#8b5cf6", department: "Executive" },
    { value: "director", label: "Assistant CEO", color: "#6366f1", department: "Executive" },
    { value: "marketing", label: "Marketing / Sales", color: "#3b82f6", department: "Sales/Marketing" },
    { value: "purchasing", label: "Purchasing", color: "#10b981", department: "Purchasing" },
    { value: "operation", label: "Operation", color: "#f59e0b", department: "Operation" },
];

// ── Permissions per Role ──────────────────────────────────────
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
    ceo: [
        "dashboard", "approval_inbox", "my_tasks", "all_tasks",
        "sales_orders", "purchase_requests", "profit_loss",
        "manage_roles", "audit_logs", "approve_tasks",
        "approve_sales", "approve_purchases", "move_any_task",
        "move_to_done", "chatbot", "view_restricted_finance",
        "sales_monitor", "shipment_monitor", "source_management",
        "quality", "blending_simulation", "market_price", "market_price_edit",
        "meetings", "transshipment", "outstanding_payment",
    ],
    director: [
        "dashboard", "approval_inbox", "my_tasks", "all_tasks",
        "sales_orders", "purchase_requests", "profit_loss",
        "manage_roles", "audit_logs", "approve_tasks",
        "approve_sales", "approve_purchases", "move_any_task",
        "move_to_done", "chatbot", "view_restricted_finance",
        "sales_monitor", "shipment_monitor", "source_management",
        "quality", "blending_simulation", "market_price", "market_price_edit",
        "meetings", "transshipment", "outstanding_payment",
    ],
    marketing: [
        "my_tasks", "all_tasks",
        "sales_orders", "purchase_requests", "chatbot",
        "sales_monitor", "shipment_monitor", "source_management",
        "quality", "blending_simulation", "market_price",
        "meetings", "transshipment", "move_any_task",
    ],
    purchasing: [
        "my_tasks", "all_tasks",
        "purchase_requests", "profit_loss", "chatbot",
        "source_management", "quality", "market_price",
        "meetings", "approve_purchases",
    ],
    operation: [
        "my_tasks", "all_tasks",
        "sales_orders", "chatbot",
        "shipment_monitor", "source_management",
        "quality", "meetings", "transshipment",
        "move_any_task",
    ],
};


// ── Demo Users ────────────────────────────────────────────────
export const DEMO_USERS = [
    { id: "usr-001", name: "Raka Aditya", email: "raka@coaltrading.com", role: "ceo" as Role, phone: "+6281234567890", job_title: "Chief Executive Officer", department: "Executive", created_at: "2024-01-01T00:00:00Z" },
    { id: "usr-002", name: "Diana Putri", email: "diana@coaltrading.com", role: "director" as Role, phone: "+6281234567891", job_title: "Assistant CEO", department: "Executive", created_at: "2024-01-15T00:00:00Z" },
    { id: "usr-003", name: "Budi Santoso", email: "budi@coaltrading.com", role: "marketing" as Role, phone: "+6281234567892", job_title: "Chief Marketing Officer", department: "Sales/Marketing", created_at: "2024-02-01T00:00:00Z" },
    { id: "usr-004", name: "Rina Wijaya", email: "rina@coaltrading.com", role: "purchasing" as Role, phone: "+6281234567893", job_title: "Chief Purchasing Officer", department: "Purchasing", created_at: "2024-02-15T00:00:00Z" },
    { id: "usr-005", name: "Dimas Pratama", email: "dimas@coaltrading.com", role: "operation" as Role, phone: "+6281234567894", job_title: "Chief Operation Officer", department: "Operation", created_at: "2024-03-01T00:00:00Z" },
];

// ── Task Statuses ─────────────────────────────────────────────
export const TASK_STATUSES: { value: TaskStatus; label: string; color: string; bgClass: string }[] = [
    { value: "todo", label: "To Do", color: "#6b7280", bgClass: "bg-gray-50 dark:bg-gray-500/10 border-gray-200 dark:border-gray-700" },
    { value: "in_progress", label: "In Progress", color: "#3b82f6", bgClass: "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-800" },
    { value: "review", label: "Needs Approval", color: "#f59e0b", bgClass: "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-800" },
    { value: "done", label: "Done", color: "#10b981", bgClass: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-800" },
];

export const TASK_PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
    { value: "low", label: "LOW", color: "#10b981" },
    { value: "medium", label: "MEDIUM", color: "#f59e0b" },
    { value: "high", label: "HIGH", color: "#ef4444" },
    { value: "urgent", label: "URGENT", color: "#dc2626" },
];

// ── Order / Purchase Statuses ─────────────────────────────────
export const ORDER_STATUSES: { value: OrderStatus; label: string; color: string }[] = [
    { value: "draft", label: "Draft", color: "#6b7280" },
    { value: "pending", label: "Pending", color: "#f59e0b" },
    { value: "approved", label: "Approved", color: "#10b981" },
    { value: "rejected", label: "Rejected", color: "#ef4444" },
];

export const PURCHASE_STATUSES: { value: PurchaseStatus; label: string; color: string }[] = [
    { value: "draft", label: "Draft", color: "#6b7280" },
    { value: "pending", label: "Pending", color: "#f59e0b" },
    { value: "approved", label: "Approved", color: "#10b981" },
    { value: "rejected", label: "Rejected", color: "#ef4444" },
];

// ── Sales Deal Statuses ───────────────────────────────────────
export const SALES_DEAL_STATUSES: { value: SalesDealStatus; label: string; color: string }[] = [
    { value: "pre_sale", label: "Pre-Sale", color: "#8b5cf6" },
    { value: "confirmed", label: "Confirmed", color: "#10b981" },
    { value: "forecast", label: "Forecast", color: "#3b82f6" },
];

// ── Shipment Statuses (MV Barge) ──────────────────────────────
export const SHIPMENT_STATUSES: { value: ShipmentStatus; label: string; color: string }[] = [
    { value: "upcoming", label: "Upcoming", color: "#f59e0b" },
    { value: "done_shipment", label: "Done Shipment", color: "#10b981" },
    { value: "loading", label: "Loading", color: "#3b82f6" },
    { value: "in_transit", label: "In Transit", color: "#6366f1" },
    { value: "completed", label: "Completed", color: "#10b981" },
    { value: "cancelled", label: "Cancelled", color: "#ef4444" },
];

// ── KYC & PSI Statuses ────────────────────────────────────────
export const KYC_STATUSES: { value: KYCStatus; label: string; color: string }[] = [
    { value: "not_started", label: "Not Started", color: "#6b7280" },
    { value: "in_progress", label: "In Progress", color: "#f59e0b" },
    { value: "verified", label: "Verified", color: "#10b981" },
    { value: "expired", label: "Expired", color: "#ef4444" },
];

export const PSI_STATUSES: { value: PSIStatus; label: string; color: string }[] = [
    { value: "not_started", label: "Not Started", color: "#6b7280" },
    { value: "scheduled", label: "Scheduled", color: "#3b82f6" },
    { value: "passed", label: "Passed", color: "#10b981" },
    { value: "failed", label: "Failed", color: "#ef4444" },
];

// ── Purchase Categories ───────────────────────────────────────
export const DEFAULT_PURCHASE_CATEGORIES = [
    "Coal Supply",
    "Freight / Shipping",
    "Barge Charter",
    "Port Charges",
    "Survey / Inspection",
    "Office Supplies",
    "Travel",
    "Marketing",
    "IT Equipment",
    "Other",
];

// ── Coal Spec Fields ──────────────────────────────────────────
export const COAL_SPEC_FIELDS = [
    { key: "gar", label: "GAR", unit: "kcal/kg", color: "#ef4444" },
    { key: "ts", label: "TS", unit: "%", color: "#f59e0b" },
    { key: "ash", label: "ASH", unit: "%", color: "#6b7280" },
    { key: "tm", label: "TM", unit: "%", color: "#3b82f6" },
    { key: "im", label: "IM", unit: "%", color: "#8b5cf6" },
    { key: "fc", label: "FC", unit: "%", color: "#10b981" },
    { key: "hgi", label: "HGI", unit: "", color: "#ec4899" },
];

// ── Countries (for export deals) ──────────────────────────────
export const COUNTRIES = [
    "Indonesia", "Cambodia", "Philippines", "Vietnam", "India",
    "China", "South Korea", "Japan", "Thailand", "Bangladesh",
    "Taiwan", "Malaysia", "Pakistan", "Sri Lanka",
];

// ── Sidebar Navigation ───────────────────────────────────────
export interface NavItem {
    href: string;
    label: string;
    icon: string;
    permission?: Permission;
    badge?: string;
}

export interface NavSection {
    title?: string;
    items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
    {
        items: [
            { href: "/", label: "Dashboard", icon: "PieChart", permission: "dashboard" },
            { href: "/directory", label: "Partners & Directory", icon: "Users", permission: "source_management" },
            { href: "/projects", label: "Projects", icon: "Kanban", permission: "sales_monitor" },
        ],
    },
    {
        title: "LOGISTICS & SHIPMENTS",
        items: [
            { href: "/shipment-monitor", label: "Shipment Monitor", icon: "Ship", permission: "shipment_monitor" },
            { href: "/transshipment", label: "Transshipment / Freight info", icon: "Truck", permission: "transshipment" },
            { href: "/sources", label: "Source", icon: "Factory", permission: "source_management" },
            { href: "/quality", label: "Quality", icon: "FlaskConical", permission: "quality" },
            { href: "/blending", label: "Blending Simulasi", icon: "Beaker", permission: "blending_simulation" },
        ],
    },
    {
        title: "MANAGEMENT & ADMIN",
        items: [
            { href: "/sales-monitor", label: "Sales Monitor", icon: "TrendingUp", permission: "sales_monitor" },
            { href: "/market-price", label: "Market Price", icon: "LineChart", permission: "market_price" },
            { href: "/meetings", label: "Meeting", icon: "Calendar", permission: "meetings" },
            { href: "/my-tasks", label: "Tasks", icon: "ClipboardList", permission: "my_tasks" },
            { href: "/pl-forecast", label: "P&L", icon: "DollarSign", permission: "profit_loss" },
            { href: "/outstanding-payment", label: "Outstanding Payment", icon: "Wallet", permission: "outstanding_payment" },
            { href: "/purchase-requests", label: "Expenses", icon: "Receipt", permission: "purchase_requests" },
        ],
    },
    {
        title: "SYSTEM",
        items: [
            { href: "/users", label: "User Management", icon: "Users", permission: "manage_roles" },
            { href: "/audit-logs", label: "Audit Logs", icon: "ScrollText", permission: "audit_logs" },
        ],
    },
];
