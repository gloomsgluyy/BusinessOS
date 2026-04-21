import { Shield } from "lucide-react";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ROLES_LIST } from "@/lib/rbac";
import { UserRoleManager } from "./user-role-manager";

export default async function UsersPage() {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        redirect("/login");
    }

    const currentUserRole = String(session.user.role || "").toUpperCase();

    if (currentUserRole !== "CEO") {
        return (
            <AppShell>
                <div className="flex items-center justify-center h-full">
                    <div className="text-center space-y-2">
                        <Shield className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                        <p className="text-sm font-medium text-muted-foreground">Access Restricted</p>
                        <p className="text-xs text-muted-foreground">Only CEO can manage user roles.</p>
                    </div>
                </div>
            </AppShell>
        );
    }

    const users = await prisma.user.findMany({
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
        },
        orderBy: [{ role: "asc" }, { email: "asc" }],
    });

    return (
        <AppShell>
            <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto min-w-0 overflow-x-hidden space-y-4">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold">User Management</h1>
                    <p className="text-sm text-muted-foreground">
                        Kelola role pengguna. Hanya CEO yang dapat mengubah role user lain.
                    </p>
                </div>

                <UserRoleManager
                    initialUsers={users.map((user) => ({
                        ...user,
                        role: String(user.role),
                    }))}
                    currentUserId={session.user.id}
                    currentUserRole={currentUserRole}
                    roleOptions={ROLES_LIST}
                />
            </div>
        </AppShell>
    );
}