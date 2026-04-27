import { create } from "zustand";
import { User, Role, Permission } from "@/types";
import { DEMO_USERS, ROLE_PERMISSIONS } from "@/lib/constants";
import { generateId } from "@/lib/utils";

interface AuthState {
    currentUser: User | null;
    users: User[];
    setCurrentUser: (user: User | null) => void;
    switchRole: (role: Role) => void;
    hasPermission: (permission: Permission) => boolean;
    hasRole: (roles: Role[]) => boolean;
    addUser: (user: Omit<User, "id" | "created_at">) => void;
    updateUser: (id: string, updates: Partial<User>) => void;
    deleteUser: (id: string) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    currentUser: null,
    users: DEMO_USERS as User[],

    setCurrentUser: (user) => set({ currentUser: user }),

    switchRole: (role) => {
        const user = get().users.find((u) => u.role === role);
        if (user) set({ currentUser: user as User });
    },

    hasPermission: (permission) => {
        const user = get().currentUser;
        if (!user || !user.role) return false;
        
        let roleKey = user.role.toLowerCase() as string;
        
        // Map new Prisma roles to legacy role keys for UI backward compatibility
        const role = user.role.toUpperCase();
        if (["CEO", "DIRUT", "ASS_DIRUT", "COO"].includes(role)) roleKey = "ceo";
        else if (role.startsWith("TRADERS_") || role === "CMO" || role === "ADMIN_MARKETING" || role === "JUNIOR_TRADER") roleKey = "marketing";
        else if (role.startsWith("SOURCING_") || role === "SPV_SOURCING") roleKey = "purchasing";
        else if (role.startsWith("TRAFFIC_") || role.startsWith("QC_") || role === "CPPO" || role === "ADMIN_OPERATION") roleKey = "operation";

        return ROLE_PERMISSIONS[roleKey as Role]?.includes(permission) ?? false;
    },

    hasRole: (roles) => {
        const user = get().currentUser;
        if (!user) return false;
        return roles.includes(user.role);
    },

    addUser: (userData) => {
        const now = new Date().toISOString();
        const newUser: User = {
            ...userData,
            id: generateId("usr"),
            created_at: now,
        };
        set((state) => ({ users: [...state.users, newUser] }));
    },

    updateUser: (id, updates) =>
        set((state) => ({
            users: state.users.map((u) =>
                u.id === id ? { ...u, ...updates } : u
            ),
        })),

    deleteUser: (id) =>
        set((state) => ({
            users: state.users.filter((u) => u.id !== id && u.id !== state.currentUser?.id),
        })),
}));
