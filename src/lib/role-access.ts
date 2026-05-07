import { MODULE_PERMISSIONS } from "@/lib/rbac";

export type NormalizedUserRole =
    | "CEO"
    | "DIRUT"
    | "ASS_DIRUT"
    | "COO"
    | "QQ_MANAGER"
    | "ADMIN_OPERATION"
    | "CMO"
    | "TRADERS_1"
    | "TRADERS_2_CPPO"
    | "TRADERS_3_COO"
    | "TRADERS_4_CMO"
    | "JUNIOR_TRADER"
    | "TRAFFIC_HEAD"
    | "TRAFFIC_TEAM_1"
    | "TRAFFIC_TEAM_2"
    | "TRAFFIC_TEAM_3"
    | "TRAFFIC_TEAM_4"
    | "ADMIN_MARKETING"
    | "QC_MANAGER"
    | "QC_ADMIN_1"
    | "QC_ADMIN_2"
    | "CPPO"
    | "SPV_SOURCING"
    | "SOURCING_OFFICER_1"
    | "SOURCING_OFFICER_2"
    | "SOURCING_OFFICER_3"
    | "SOURCING_OFFICER_4"
    | "STAFF";

export type ModulePermissionKey = keyof typeof MODULE_PERMISSIONS;

const LEGACY_ROLE_ALIASES: Record<string, NormalizedUserRole> = {
    CEO: "CEO",
    DIRECTOR: "DIRUT",
    MARKETING: "CMO",
    PURCHASING: "CPPO",
    OPERATION: "COO",
    MANAGER: "COO",
    STAFF: "STAFF",
};

export const EXECUTIVE_ROLES = new Set<NormalizedUserRole>([
    "CEO",
    "DIRUT",
    "ASS_DIRUT",
    "COO",
]);

export const PROJECT_APPROVER_ROLES = new Set<NormalizedUserRole>([
    "CEO",
    "DIRUT",
    "ASS_DIRUT",
]);

const RECORD_MANAGER_ROLES = new Set<NormalizedUserRole>([
    "CEO",
    "DIRUT",
    "ASS_DIRUT",
    "COO",
    "CMO",
    "CPPO",
    "QQ_MANAGER",
    "ADMIN_OPERATION",
    "TRADERS_2_CPPO",
    "TRADERS_3_COO",
    "TRADERS_4_CMO",
    "TRAFFIC_HEAD",
    "ADMIN_MARKETING",
    "QC_MANAGER",
    "SPV_SOURCING",
]);

export function normalizeRole(role: unknown): NormalizedUserRole | null {
    if (typeof role !== "string") return null;
    const normalized = role.trim().toUpperCase();
    if (!normalized) return null;
    return LEGACY_ROLE_ALIASES[normalized] || (normalized as NormalizedUserRole);
}

export function isExecutiveRole(role: unknown): boolean {
    const normalized = normalizeRole(role);
    return Boolean(normalized && EXECUTIVE_ROLES.has(normalized));
}

export function canUseAiAssistant(role: unknown): boolean {
    const normalized = normalizeRole(role);
    return Boolean(normalized && normalized !== "STAFF");
}

export function canApproveProjectStatus(role: unknown): boolean {
    const normalized = normalizeRole(role);
    return Boolean(normalized && PROJECT_APPROVER_ROLES.has(normalized));
}

export function canManageAnyRecord(role: unknown): boolean {
    const normalized = normalizeRole(role);
    return Boolean(normalized && RECORD_MANAGER_ROLES.has(normalized));
}

export function canReadModuleForRole(role: unknown, moduleName: ModulePermissionKey): boolean {
    const normalized = normalizeRole(role);
    if (!normalized) return false;
    const mod = MODULE_PERMISSIONS[moduleName];
    return (mod.read as readonly string[]).includes(normalized);
}

export function canWriteModuleForRole(role: unknown, moduleName: ModulePermissionKey): boolean {
    const normalized = normalizeRole(role);
    if (!normalized) return false;
    const mod = MODULE_PERMISSIONS[moduleName];
    const writeRoles = "write" in mod ? (mod.write as readonly string[] | undefined) : undefined;
    return isExecutiveRole(normalized) || Boolean(writeRoles?.includes(normalized));
}

export function canModifyOwnedRecord(params: {
    role: unknown;
    userId?: string | null;
    createdBy?: string | null;
    moduleName?: ModulePermissionKey;
}): boolean {
    if (params.userId && params.createdBy && params.userId === params.createdBy) return true;
    if (params.moduleName && canWriteModuleForRole(params.role, params.moduleName)) return true;
    return canManageAnyRecord(params.role);
}
