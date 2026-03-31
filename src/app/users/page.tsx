"use client";

import React from "react";
import { Shield, Mail, Phone, Plus, Pencil, Trash2, X, UserPlus, Search } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { useAuthStore } from "@/store/auth-store";
import { ROLES } from "@/lib/constants";
import { cn, getInitials } from "@/lib/utils";
import { Role } from "@/types";

interface UserForm {
    name: string;
    email: string;
    phone: string;
    role: Role;
}

const emptyForm: UserForm = { name: "", email: "", phone: "", role: "operation" };

export default function UsersPage() {
    const { currentUser, hasPermission, users, addUser, updateUser, deleteUser } = useAuthStore();

    const [search, setSearch] = React.useState("");
    const [modalOpen, setModalOpen] = React.useState(false);
    const [editingId, setEditingId] = React.useState<string | null>(null);
    const [form, setForm] = React.useState<UserForm>(emptyForm);
    const [deleteConfirm, setDeleteConfirm] = React.useState<string | null>(null);
    const [roleFilter, setRoleFilter] = React.useState<string>("all");

    if (!hasPermission("manage_roles")) {
        return (
            <AppShell>
                <div className="flex items-center justify-center h-full">
                    <div className="text-center space-y-2">
                        <Shield className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                        <p className="text-sm font-medium text-muted-foreground">Access Restricted</p>
                        <p className="text-xs text-muted-foreground">Only Admin can manage users.</p>
                    </div>
                </div>
            </AppShell>
        );
    }

    const filteredUsers = users.filter(u => {
        const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
        const matchRole = roleFilter === "all" || u.role === roleFilter;
        return matchSearch && matchRole;
    });

    const openAddModal = () => {
        setEditingId(null);
        setForm(emptyForm);
        setModalOpen(true);
    };

    const openEditModal = (user: typeof users[0]) => {
        setEditingId(user.id);
        setForm({ name: user.name, email: user.email, phone: user.phone, role: user.role });
        setModalOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim() || !form.email.trim()) return;
        if (editingId) {
            updateUser(editingId, { name: form.name, email: form.email, phone: form.phone, role: form.role });
        } else {
            addUser({ name: form.name, email: form.email, phone: form.phone, role: form.role });
        }
        setModalOpen(false);
        setForm(emptyForm);
        setEditingId(null);
    };

    const handleDelete = (id: string) => {
        deleteUser(id);
        setDeleteConfirm(null);
    };

    const roleCounts = ROLES.map(r => ({
        ...r,
        count: users.filter(u => u.role === r.value).length,
    }));

    return (
        <AppShell>
            <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto min-w-0 overflow-x-hidden">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold">User Management</h1>
                        <p className="text-sm text-muted-foreground">Kelola anggota tim dan role mereka. {users.length} user terdaftar.</p>
                    </div>
                    <button onClick={openAddModal}
                        className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-all active:scale-95">
                        <UserPlus className="w-4 h-4" />
                        Tambah User
                    </button>
                </div>

                {/* Role Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-6">
                    {roleCounts.map(r => (
                        <button key={r.value} onClick={() => setRoleFilter(roleFilter === r.value ? "all" : r.value)}
                            className={cn("card-elevated p-3 text-left transition-all hover:scale-[1.02]",
                                roleFilter === r.value && "ring-2 ring-offset-2 ring-offset-background")}
                            style={roleFilter === r.value ? { borderColor: r.color } : {}}>
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                                    style={{ backgroundColor: r.color }}>
                                    {r.count}
                                </div>
                                <div>
                                    <p className="text-xs font-semibold">{r.label}</p>
                                    <p className="text-[10px] text-muted-foreground">{r.count} user</p>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Cari user berdasarkan nama atau email..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-accent/20 text-sm focus:ring-2 focus:ring-primary/30 outline-none transition-all" />
                </div>

                {/* User Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {filteredUsers.map((user) => {
                        const roleCfg = ROLES.find((r) => r.value === user.role);
                        const isSelf = user.id === (currentUser?.id);
                        return (
                            <div key={user.id} className="card-elevated p-5 space-y-4 group relative hover:shadow-lg transition-all">
                                {/* Actions */}
                                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => openEditModal(user)}
                                        className="p-1.5 rounded-lg bg-accent hover:bg-blue-500/10 hover:text-blue-600 transition-colors" title="Edit">
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    {!isSelf && (
                                        <button onClick={() => setDeleteConfirm(user.id)}
                                            className="p-1.5 rounded-lg bg-accent hover:bg-red-500/10 hover:text-red-600 transition-colors" title="Hapus">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-md"
                                        style={{ backgroundColor: roleCfg?.color }}>
                                        {getInitials(user.name)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="font-semibold text-sm truncate">{user.name}</p>
                                            {isSelf && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-600 font-medium">You</span>}
                                        </div>
                                        <span className="text-[10px] px-2 py-0.5 rounded-full inline-block mt-0.5" style={{ color: roleCfg?.color, backgroundColor: `${roleCfg?.color}15` }}>
                                            {roleCfg?.label}
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Mail className="w-3.5 h-3.5 shrink-0" />
                                        <span className="truncate">{user.email}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Phone className="w-3.5 h-3.5 shrink-0" />
                                        <span>{user.phone}</span>
                                    </div>
                                </div>
                                <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/30">
                                    Bergabung {new Date(user.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {filteredUsers.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-sm text-muted-foreground">Tidak ada user ditemukan.</p>
                    </div>
                )}
            </div>

            {/* ═══ ADD/EDIT MODAL ═══ */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setModalOpen(false)}>
                    <div className="absolute inset-0 bg-black/20" />
                    <div className="relative w-full max-w-md bg-background rounded-xl shadow-lg border border-border animate-scale-in overflow-hidden"
                        onClick={e => e.stopPropagation()}>

                        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
                            <div className="flex items-center gap-2">
                                <UserPlus className="w-4 h-4 text-primary" />
                                <h2 className="text-sm font-bold">{editingId ? "Edit User" : "Tambah User Baru"}</h2>
                            </div>
                            <button onClick={() => setModalOpen(false)} className="p-1 rounded-lg hover:bg-accent">
                                <X className="w-4 h-4 text-muted-foreground" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-5 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-muted-foreground">Nama Lengkap</label>
                                <input type="text" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="John Doe"
                                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-accent/20 text-sm focus:ring-2 focus:ring-primary/30 outline-none" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-muted-foreground">Email</label>
                                <input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                    placeholder="john@company.com"
                                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-accent/20 text-sm focus:ring-2 focus:ring-primary/30 outline-none" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-muted-foreground">No. Telepon</label>
                                <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                                    placeholder="+6281234567890"
                                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-accent/20 text-sm focus:ring-2 focus:ring-primary/30 outline-none" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-muted-foreground">Role</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {ROLES.map(r => (
                                        <button key={r.value} type="button" onClick={() => setForm(f => ({ ...f, role: r.value }))}
                                            className={cn("px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all text-left",
                                                form.role === r.value ? "border-2 shadow-sm" : "border-border hover:bg-accent/50")}
                                            style={form.role === r.value ? { borderColor: r.color, color: r.color, backgroundColor: `${r.color}10` } : {}}>
                                            {r.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setModalOpen(false)}
                                    className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-accent transition-colors">
                                    Batal
                                </button>
                                <button type="submit"
                                    className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all active:scale-[0.98]">
                                    {editingId ? "Simpan Perubahan" : "Tambah User"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═══ DELETE CONFIRM ═══ */}
            {deleteConfirm && (() => {
                const u = users.find(x => x.id === deleteConfirm);
                if (!u) return null;
                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setDeleteConfirm(null)}>
                        <div className="absolute inset-0 bg-black/20" />
                        <div className="relative w-full max-w-sm bg-background rounded-xl shadow-lg border border-border p-6 animate-scale-in text-center"
                            onClick={e => e.stopPropagation()}>
                            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-3">
                                <Trash2 className="w-5 h-5 text-red-500" />
                            </div>
                            <h3 className="text-sm font-bold mb-1">Hapus User?</h3>
                            <p className="text-xs text-muted-foreground mb-4">
                                Kamu yakin ingin menghapus <strong>{u.name}</strong>? Tindakan ini tidak bisa dibatalkan.
                            </p>
                            <div className="flex gap-2">
                                <button onClick={() => setDeleteConfirm(null)}
                                    className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-accent transition-colors">
                                    Batal
                                </button>
                                <button onClick={() => handleDelete(deleteConfirm)}
                                    className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-all active:scale-[0.98]">
                                    Hapus
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </AppShell>
    );
}
