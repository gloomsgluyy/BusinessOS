# RBAC Implementation Guide (For AI Agents & Developers)

Dokumen ini berisi instruksi teknis langkah-demi-langkah bagi AI Agent atau Developer untuk mengimplementasikan Role-Based Access Control (RBAC) pada sistem `11gawe`. Implementasi ini mencakup pembuatan enum di _database_, API khusus, dan UI pengaturan role bagi `CEO`.

---

## 1. Update Database (Prisma Schema)

Saat ini `role` pada model `User` adalah tipe data `String`. Ubah ini menjadi tipe data `Enum` untuk membatasi nilai _role_ secara ketat pada level _database_.

### Langkah-langkah:
1. Buka file `prisma/schema.prisma`.
2. Tambahkan `enum UserRole` di bagian bawah file (atau sebelum deklarasi model).
3. Ubah field `role` di model `User` dari `String` menjadi `UserRole`.

**Kode Prisma Baru:**
```prisma
enum UserRole {
  CEO
  DIRUT
  ASS_DIRUT
  COO
  QQ_MANAGER
  ADMIN_OPERATION
  CMO
  TRADERS_1
  TRADERS_2_CPPO
  TRADERS_3_COO
  TRADERS_4_CMO
  JUNIOR_TRADER
  TRAFFIC_HEAD
  TRAFFIC_TEAM_1
  TRAFFIC_TEAM_2
  TRAFFIC_TEAM_3
  TRAFFIC_TEAM_4
  ADMIN_MARKETING
  QC_MANAGER
  QC_ADMIN_1
  QC_ADMIN_2
  CPPO
  SPV_SOURCING
  SOURCING_OFFICER_1
  SOURCING_OFFICER_2
  SOURCING_OFFICER_3
  SOURCING_OFFICER_4
  STAFF // Role default bagi user baru
}

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  password      String?
  // Ubah baris role dari String menjadi Enum:
  role          UserRole  @default(STAFF)

  // ... (relasi lain tetap sama)
}
```

### 1.1 Eksekusi Migrasi
AI Agent harus menjalankan perintah berikut di terminal:
```bash
npx prisma format
npx prisma generate
npx prisma db push
```

---

## 2. API Backend untuk Update Role (User Management)

Buat route API yang hanya mengizinkan user dengan `role === "CEO"` untuk mengubah role _user_ lain. 
*Constraint Keamanan:* CEO **tidak dapat** mengubah/menurunkan rolenya sendiri.

### File: `src/app/api/users/update-role/route.ts`
```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // Sesuaikan dengan instance objek prisma Anda
import { getServerSession } from "next-auth";
// import { authOptions } from "@/app/api/auth/[...nextauth]/route"; (Gunakan konfigurasi auth Anda)

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(/* authOptions */);
    
    // 1. Otorisasi - Cek apakah peminta adalah CEO
    if (!session || session.user.role !== "CEO") {
      return NextResponse.json({ error: "Unauthorized. Only CEO can perform this action." }, { status: 403 });
    }

    const body = await request.json();
    const { targetUserId, newRole } = body;

    if (!targetUserId || !newRole) {
      return NextResponse.json({ error: "Missing Target User ID or New Role." }, { status: 400 });
    }

    // 2. Proteksi Keamanan: CEO tidak boleh mengubah rolenya sendiri
    if (session.user.id === targetUserId) {
      return NextResponse.json({ error: "Action denied. CEO cannot change their own role." }, { status: 403 });
    }

    // 3. Update Database
    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: { role: newRole }
    });

    return NextResponse.json({ message: "Role updated successfully", user: updatedUser }, { status: 200 });

  } catch (error) {
    console.error("Error updating user role:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

---

## 3. Implementasi Halaman / Komponen UI (User Settings by CEO)

Pada bagian frontend (misal `src/app/users/page.tsx`), muat data pengguna dan tampilkan dalam bentuk tabel. Berikan kolom "_Action_" berisikan `<select>` dropdown untuk mengubah _role_.

### Kriteria UI bagi AI Agent:
1. **Validasi Tampilan:** Halaman pengguna (`/users`) hanya boleh dirender / tombol edit hanya muncul jika tipe _role_ _Current Session_ adalah `CEO`.
2. **Kondisional Dropdown:** Dropdown `Select` _disabled_ (dimatikan) apabila baris _user_ yang dirender adalah CEO/`user.id === session.user.id`. 
3. **Pilihan Dropdown:** Menggunakan basis Array statik dari Enum `UserRole` yang telah kita sebutkan.

### Contoh Gambaran Komponen UI (React/TSX):
```tsx
"use client";
import { useState } from "react";
// Sesuaikan dengan data yang akan di fetch / props
// Asumsikan currentUser adalah object dari useSession() / getServerSession()

export default function UserRoleManager({ users, currentUserSession }) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleRoleChange = async (targetUserId: string, newRole: string) => {
    setLoadingId(targetUserId);
    try {
      const res = await fetch("/api/users/update-role", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, newRole }),
      });
      if (!res.ok) throw new Error("Failed to update role");
      alert("Role berhasil diupdate!");
      // TODO: refresh() atau mutate() data dari SWR/React Query
    } catch (error) {
      alert(error.message);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <table className="min-w-full divide-y">
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Role</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <tr key={user.id}>
            <td>{user.name}</td>
            <td>{user.email}</td>
            <td>{user.role}</td>
            <td>
              {/* ATURAN: JIKALAU USER BARIS INI ADALAH CEO SENDIRI, DISABLE PENGUBAHAN ROLE */}
              <select 
                defaultValue={user.role}
                disabled={user.id === currentUserSession.id || currentUserSession.role !== "CEO"}
                onChange={(e) => handleRoleChange(user.id, e.target.value)}
              >
                {/* List dari semua Enum UserRole */}
                <option value="CEO">CEO</option>
                <option value="DIRUT">DIRUT</option>
                <option value="ADMIN_OPERATION">ADMIN_OPERATION</option>
                <option value="STAFF">STAFF</option>
                {/* ... (render seluruh role lainnya) ... */}
              </select>
              {loadingId === user.id && <span> Saving...</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

---

## 4. Helper Function (Middleware / Guard) Tambahan 

Untuk menjaga setiap module operasional, buat utilitas pada folder `src/lib/rbac.ts` (atau _Actions_ file) guna melindungi modul spesifik agar AI Agent berikutnya mudah mengamankan data.

### Contoh File: `src/lib/rbac.ts`
```typescript
import { UserRole } from "@prisma/client";

// Mapping logika role lengkap sesuai RBAC_Documentation.md
export const MODULE_PERMISSIONS = {
  // === MODULE: P&L FORECAST & SALES MONITOR ===
  PL_SALES: {
    read: [ "CEO", "DIRUT", "ASS_DIRUT", "COO", "CPPO", "CMO", "TRADERS_1", "TRADERS_2_CPPO", "TRADERS_3_COO", "TRADERS_4_CMO", "JUNIOR_TRADER", "ADMIN_MARKETING", "TRAFFIC_HEAD" ] as UserRole[],
    write: [ "TRADERS_1", "TRADERS_2_CPPO", "TRADERS_3_COO", "TRADERS_4_CMO", "JUNIOR_TRADER", "ADMIN_MARKETING" ] as UserRole[],
    approve: ["CMO", "CPPO", "CEO"] as UserRole[]
  },

  // === MODULE: SHIPMENT MONITOR & TRANSSHIPMENT ===
  OPERATIONS_TRAFFIC: {
    read: [ "CEO", "DIRUT", "ASS_DIRUT", "COO", "TRAFFIC_HEAD", "TRAFFIC_TEAM_1", "TRAFFIC_TEAM_2", "TRAFFIC_TEAM_3", "TRAFFIC_TEAM_4", "ADMIN_OPERATION", "QQ_MANAGER", "QC_MANAGER", "QC_ADMIN_1", "QC_ADMIN_2", "TRADERS_1", "TRADERS_2_CPPO", "TRADERS_3_COO", "TRADERS_4_CMO", "JUNIOR_TRADER" ] as UserRole[],
    write: [ "TRAFFIC_HEAD", "TRAFFIC_TEAM_1", "TRAFFIC_TEAM_2", "TRAFFIC_TEAM_3", "TRAFFIC_TEAM_4", "ADMIN_OPERATION", "COO" ] as UserRole[],
    approve: ["TRAFFIC_HEAD", "COO"] as UserRole[]
  },

  // === MODULE: QUALITY & BLENDING ===
  QUALITY_BLENDING: {
    read: [ "CEO", "DIRUT", "ASS_DIRUT", "COO", "CPPO", "SPV_SOURCING", "SOURCING_OFFICER_1", "SOURCING_OFFICER_2", "SOURCING_OFFICER_3", "SOURCING_OFFICER_4", "QQ_MANAGER", "QC_MANAGER", "QC_ADMIN_1", "QC_ADMIN_2" ] as UserRole[],
    write: [ "QQ_MANAGER", "QC_MANAGER", "QC_ADMIN_1", "QC_ADMIN_2" ] as UserRole[],
    approve: ["QC_MANAGER", "QQ_MANAGER", "COO", "CPPO"] as UserRole[]
  },

  // === MODULE: SOURCING & PURCHASE REQUESTS ===
  SOURCING: {
    read: [ "CEO", "DIRUT", "ASS_DIRUT", "CMO", "COO", "CPPO", "SPV_SOURCING", "SOURCING_OFFICER_1", "SOURCING_OFFICER_2", "SOURCING_OFFICER_3", "SOURCING_OFFICER_4", "TRADERS_1", "TRADERS_2_CPPO", "TRADERS_3_COO", "TRADERS_4_CMO", "JUNIOR_TRADER", "QC_MANAGER", "ADMIN_MARKETING", "TRAFFIC_HEAD" ] as UserRole[],
    write: [ "SPV_SOURCING", "SOURCING_OFFICER_1", "SOURCING_OFFICER_2", "SOURCING_OFFICER_3", "SOURCING_OFFICER_4", "TRADERS_1", "TRADERS_2_CPPO", "TRADERS_3_COO", "TRADERS_4_CMO", "JUNIOR_TRADER" ] as UserRole[],
    approve: ["SPV_SOURCING", "CEO", "DIRUT", "CPPO"] as UserRole[]
  },

  // === MODULE: MARKET PRICE ===
  MARKET_PRICE: {
    read: [ "CEO", "DIRUT", "ASS_DIRUT", "CMO", "TRADERS_1", "TRADERS_2_CPPO", "TRADERS_3_COO", "TRADERS_4_CMO", "JUNIOR_TRADER", "ADMIN_MARKETING", "SPV_SOURCING", "SOURCING_OFFICER_1", "SOURCING_OFFICER_2", "SOURCING_OFFICER_3", "SOURCING_OFFICER_4" ] as UserRole[],
    write: [ "ADMIN_MARKETING", "TRADERS_1", "TRADERS_2_CPPO", "TRADERS_3_COO", "TRADERS_4_CMO" ] as UserRole[]
  },

  // === MODULE: DIRECTORY (Vendors, Clients) ===
  DIRECTORY: {
    read: [ "CEO", "DIRUT", "ASS_DIRUT", "COO", "CMO", "CPPO", "ADMIN_OPERATION", "ADMIN_MARKETING", "SPV_SOURCING", "SOURCING_OFFICER_1", "SOURCING_OFFICER_2", "SOURCING_OFFICER_3", "SOURCING_OFFICER_4", "TRADERS_1", "TRADERS_2_CPPO", "TRADERS_3_COO", "TRADERS_4_CMO", "JUNIOR_TRADER" ] as UserRole[],
    write: [ "ADMIN_OPERATION", "ADMIN_MARKETING", "SPV_SOURCING", "SOURCING_OFFICER_1", "SOURCING_OFFICER_2", "SOURCING_OFFICER_3", "SOURCING_OFFICER_4" ] as UserRole[]
  },

  // === MODULE: OUTSTANDING PAYMENT ===
  OUTSTANDING_PAYMENT: {
    read: [ "CEO", "DIRUT", "ASS_DIRUT", "CMO", "COO", "TRAFFIC_HEAD", "ADMIN_OPERATION" ] as UserRole[],
    write: [ "ADMIN_OPERATION", "TRAFFIC_HEAD" ] as UserRole[]
  }
};

export function canReadModule(role: UserRole, moduleName: keyof typeof MODULE_PERMISSIONS): boolean {
  const mod = MODULE_PERMISSIONS[moduleName];
  return !!mod?.read && (mod.read as string[]).includes(role);
}

export function canWriteModule(role: UserRole, moduleName: keyof typeof MODULE_PERMISSIONS): boolean {
  const mod = MODULE_PERMISSIONS[moduleName];
  return !!(mod && "write" in mod && (mod.write as string[]).includes(role));
}

export function canApproveModule(role: UserRole, moduleName: keyof typeof MODULE_PERMISSIONS): boolean {
  const mod = MODULE_PERMISSIONS[moduleName];
  return !!(mod && "approve" in mod && mod.approve && (mod.approve as string[]).includes(role));
}
```

**Instruksi bagi AI:** Ketika AI membuat halaman baru misalnya `/sales-dashboard/page.tsx`, gunakan _server-side protection_:
```typescript
const session = await getServerSession(authOptions);
// Cek Guard
if (!session || !canReadModule(session.user.role, "PL_SALES")) {
    redirect("/unauthorized"); // Arahkan ke laman error bagi role yang tidak dizinkan
}
```

## ✅ Checklist untuk AI Agent:
- [ ] Ubah & Push Prisma Schema di `schema.prisma`.
- [ ] Buat Route API `api/users/update-role/route.ts` yang mem-verifikasi token CEO.
- [ ] Buat Proteksi *CEO tidak bisa edit role sendiri*.
- [ ] Pasang UI pengaturan peran di Dashboard pengguna `/users`.
- [ ] Buat / Perbarui konstanta Helper / Guards untuk tiap-tiap halaman dengan memetakan enum dari _database_.
