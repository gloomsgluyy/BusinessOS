import type { UserRole } from "@prisma/client";

// Role mapping logic exactly corresponding to RBAC_Documentation.md
export const MODULE_PERMISSIONS = {
    // === MODULE: P&L FORECAST & SALES MONITOR ===
    PL_SALES: {
        read: [
            "CEO", "DIRUT", "ASS_DIRUT", "COO", "CPPO", "CMO",
            "TRADERS_1", "TRADERS_2_CPPO", "TRADERS_3_COO", "TRADERS_4_CMO", "JUNIOR_TRADER",
            "ADMIN_MARKETING", "TRAFFIC_HEAD"
        ] as UserRole[],
        write: [
            "TRADERS_1", "TRADERS_2_CPPO", "TRADERS_3_COO", "TRADERS_4_CMO", "JUNIOR_TRADER", "ADMIN_MARKETING"
        ] as UserRole[],
        approve: ["CMO", "CPPO", "CEO"] as UserRole[]
    },

    // === MODULE: SHIPMENT MONITOR & TRANSSHIPMENT ===
    OPERATIONS_TRAFFIC: {
        read: [
            "CEO", "DIRUT", "ASS_DIRUT", "COO",
            "TRAFFIC_HEAD", "TRAFFIC_TEAM_1", "TRAFFIC_TEAM_2", "TRAFFIC_TEAM_3", "TRAFFIC_TEAM_4",
            "ADMIN_OPERATION", "QQ_MANAGER", "QC_MANAGER", "QC_ADMIN_1", "QC_ADMIN_2",
            "TRADERS_1", "TRADERS_2_CPPO", "TRADERS_3_COO", "TRADERS_4_CMO", "JUNIOR_TRADER"
        ] as UserRole[],
        write: [
            "TRAFFIC_HEAD", "TRAFFIC_TEAM_1", "TRAFFIC_TEAM_2", "TRAFFIC_TEAM_3", "TRAFFIC_TEAM_4",
            "ADMIN_OPERATION", "COO"
        ] as UserRole[],
        approve: ["TRAFFIC_HEAD", "COO"] as UserRole[]
    },

    // === MODULE: QUALITY & BLENDING ===
    QUALITY_BLENDING: {
        read: [
            "CEO", "DIRUT", "ASS_DIRUT", "COO", "CPPO", "SPV_SOURCING", "SOURCING_OFFICER_1", "SOURCING_OFFICER_2", "SOURCING_OFFICER_3", "SOURCING_OFFICER_4",
            "QQ_MANAGER", "QC_MANAGER", "QC_ADMIN_1", "QC_ADMIN_2"
        ] as UserRole[],
        write: [
            "QQ_MANAGER", "QC_MANAGER", "QC_ADMIN_1", "QC_ADMIN_2"
        ] as UserRole[],
        approve: ["QC_MANAGER", "QQ_MANAGER", "COO", "CPPO"] as UserRole[]
    },

    // === MODULE: SOURCING & PURCHASE REQUESTS ===
    SOURCING: {
        read: [
            "CEO", "DIRUT", "ASS_DIRUT", "CMO", "COO", "CPPO",
            "SPV_SOURCING", "SOURCING_OFFICER_1", "SOURCING_OFFICER_2", "SOURCING_OFFICER_3", "SOURCING_OFFICER_4",
            "TRADERS_1", "TRADERS_2_CPPO", "TRADERS_3_COO", "TRADERS_4_CMO", "JUNIOR_TRADER", "QC_MANAGER", "ADMIN_MARKETING", "TRAFFIC_HEAD"
        ] as UserRole[],
        write: [
            "SPV_SOURCING", "SOURCING_OFFICER_1", "SOURCING_OFFICER_2", "SOURCING_OFFICER_3", "SOURCING_OFFICER_4",
            "TRADERS_1", "TRADERS_2_CPPO", "TRADERS_3_COO", "TRADERS_4_CMO", "JUNIOR_TRADER"
        ] as UserRole[],
        approve: ["SPV_SOURCING", "CEO", "DIRUT", "CPPO"] as UserRole[]
    },

    // === MODULE: MARKET PRICE ===
    MARKET_PRICE: {
        read: [
            "CEO", "DIRUT", "ASS_DIRUT", "CMO",
            "TRADERS_1", "TRADERS_2_CPPO", "TRADERS_3_COO", "TRADERS_4_CMO", "JUNIOR_TRADER", "ADMIN_MARKETING",
            "SPV_SOURCING", "SOURCING_OFFICER_1", "SOURCING_OFFICER_2", "SOURCING_OFFICER_3", "SOURCING_OFFICER_4"
        ] as UserRole[],
        write: [
            "ADMIN_MARKETING", "TRADERS_1", "TRADERS_2_CPPO", "TRADERS_3_COO", "TRADERS_4_CMO"
        ] as UserRole[]
    },

    // === MODULE: DIRECTORY (Vendors, Clients) ===
    DIRECTORY: {
        read: [
            "CEO", "DIRUT", "ASS_DIRUT", "COO", "CMO", "CPPO",
            "ADMIN_OPERATION", "ADMIN_MARKETING", "SPV_SOURCING", "SOURCING_OFFICER_1", "SOURCING_OFFICER_2", "SOURCING_OFFICER_3", "SOURCING_OFFICER_4",
            "TRADERS_1", "TRADERS_2_CPPO", "TRADERS_3_COO", "TRADERS_4_CMO", "JUNIOR_TRADER"
        ] as UserRole[],
        write: [
            "ADMIN_OPERATION", "ADMIN_MARKETING", "SPV_SOURCING", "SOURCING_OFFICER_1", "SOURCING_OFFICER_2", "SOURCING_OFFICER_3", "SOURCING_OFFICER_4"
        ] as UserRole[]
    },

    // === MODULE: OUTSTANDING PAYMENT ===
    OUTSTANDING_PAYMENT: {
        read: [
            "CEO", "DIRUT", "ASS_DIRUT", "CMO", "COO",
            "TRAFFIC_HEAD", "ADMIN_OPERATION"
        ] as UserRole[],
        write: [
            "ADMIN_OPERATION", "TRAFFIC_HEAD"
        ] as UserRole[]
    }
};

/**
 * Utility functions to check permissions globally
 */
export function canReadModule(role: UserRole, moduleName: keyof typeof MODULE_PERMISSIONS): boolean {
    const mod = MODULE_PERMISSIONS[moduleName];
    if (!mod || !mod.read) return false;
    return (mod.read as string[]).includes(role);
}

export function canWriteModule(role: UserRole, moduleName: keyof typeof MODULE_PERMISSIONS): boolean {
    const mod = MODULE_PERMISSIONS[moduleName];
    if (!mod || !("write" in mod)) return false;
    return (mod.write as string[]).includes(role);
}

export function canApproveModule(role: UserRole, moduleName: keyof typeof MODULE_PERMISSIONS): boolean {
    const mod = MODULE_PERMISSIONS[moduleName];
    if (!mod || !("approve" in mod) || !mod.approve) return false;
    return (mod.approve as string[]).includes(role);
}

export const ROLES_LIST = [
    "CEO", "DIRUT", "ASS_DIRUT", "COO", "QQ_MANAGER", "ADMIN_OPERATION", "CMO",
    "TRADERS_1", "TRADERS_2_CPPO", "TRADERS_3_COO", "TRADERS_4_CMO", "JUNIOR_TRADER",
    "TRAFFIC_HEAD", "TRAFFIC_TEAM_1", "TRAFFIC_TEAM_2", "TRAFFIC_TEAM_3", "TRAFFIC_TEAM_4",
    "ADMIN_MARKETING", "QC_MANAGER", "QC_ADMIN_1", "QC_ADMIN_2", "CPPO", "SPV_SOURCING",
    "SOURCING_OFFICER_1", "SOURCING_OFFICER_2", "SOURCING_OFFICER_3", "SOURCING_OFFICER_4", "STAFF"
] as const;
