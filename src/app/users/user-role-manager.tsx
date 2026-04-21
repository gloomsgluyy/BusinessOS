"use client";

import { useState } from "react";

interface UserListItem {
    id: string;
    name: string | null;
    email: string | null;
    role: string;
}

interface UserRoleManagerProps {
    initialUsers: UserListItem[];
    currentUserId: string;
    currentUserRole: string;
    roleOptions: readonly string[];
}

type NoticeState = {
    type: "success" | "error";
    message: string;
} | null;

export function UserRoleManager({
    initialUsers,
    currentUserId,
    currentUserRole,
    roleOptions,
}: UserRoleManagerProps) {
    const [users, setUsers] = useState<UserListItem[]>(initialUsers);
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [notice, setNotice] = useState<NoticeState>(null);

    const isCurrentUserCeo = currentUserRole === "CEO";

    const handleRoleChange = async (targetUserId: string, newRole: string) => {
        const targetUser = users.find((item) => item.id === targetUserId);
        if (!targetUser || targetUser.role === newRole) return;

        setLoadingId(targetUserId);
        setNotice(null);

        try {
            const response = await fetch("/api/users/update-role", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ targetUserId, newRole }),
            });

            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload?.error || "Failed to update role");
            }

            setUsers((prev) =>
                prev.map((user) =>
                    user.id === targetUserId ? { ...user, role: payload.user.role } : user
                )
            );
            setNotice({ type: "success", message: "Role berhasil diupdate." });
        } catch (error) {
            setNotice({
                type: "error",
                message: error instanceof Error ? error.message : "Gagal mengubah role.",
            });
        } finally {
            setLoadingId(null);
        }
    };

    return (
        <div className="space-y-3">
            {notice && (
                <div
                    className={
                        notice.type === "success"
                            ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
                            : "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                    }
                >
                    {notice.message}
                </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <table className="min-w-full divide-y divide-border text-sm">
                    <thead className="bg-muted/40">
                        <tr>
                            <th className="px-4 py-3 text-left font-semibold">Name</th>
                            <th className="px-4 py-3 text-left font-semibold">Email</th>
                            <th className="px-4 py-3 text-left font-semibold">Role</th>
                            <th className="px-4 py-3 text-left font-semibold">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {users.map((user) => {
                            const isSelf = user.id === currentUserId;
                            const isCeoRow = user.role === "CEO";
                            const isUpdating = loadingId === user.id;
                            const isDisabled = !isCurrentUserCeo || isSelf || isCeoRow || isUpdating;

                            return (
                                <tr key={user.id} className="hover:bg-muted/20">
                                    <td className="px-4 py-3 font-medium">{user.name || "-"}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{user.email || "-"}</td>
                                    <td className="px-4 py-3">{user.role}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={user.role}
                                                disabled={isDisabled}
                                                onChange={(event) => handleRoleChange(user.id, event.target.value)}
                                                className="rounded-md border border-border bg-background px-2 py-1 text-sm disabled:opacity-60"
                                            >
                                                {roleOptions.map((role) => (
                                                    <option key={role} value={role}>
                                                        {role}
                                                    </option>
                                                ))}
                                            </select>
                                            {isUpdating && <span className="text-xs text-muted-foreground">Saving...</span>}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}