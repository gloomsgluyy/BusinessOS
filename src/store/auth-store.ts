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
        if (!user) return false;
        const role = user.role.toLowerCase() as Role;
        return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
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
            users: state.users.filter((u) => u.id !== id && u.id !== state.currentUser.id),
        })),
}));
