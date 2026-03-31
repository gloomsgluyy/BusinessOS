"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useAuthStore } from "@/store/auth-store";
import { useRouter } from "next/navigation";

/**
 * SessionSync component
 * Syncs NextAuth session with Zustand auth store
 * Redirects to login if no session exists
 */
export function SessionSync() {
    const { data: session, status } = useSession();
    const { setCurrentUser, users } = useAuthStore();
    const router = useRouter();

    useEffect(() => {
        if (status === "loading") return;

        if (status === "unauthenticated") {
            // No session - redirect to login
            setCurrentUser(null);
            router.push("/login");
            return;
        }

        if (session?.user) {
            // Find user from store by email or ID
            const user = users.find(
                (u) => u.email === session.user.email || u.id === session.user.id
            );

            if (user) {
                setCurrentUser(user);
            } else if (session.user.id) {
                // Create user object from session if not found in store
                setCurrentUser({
                    id: session.user.id,
                    name: session.user.name || "User",
                    email: session.user.email || "",
                    role: session.user.role as any,
                    phone: "",
                    job_title: "",
                    department: "",
                    created_at: new Date().toISOString(),
                });
            }
        }
    }, [session, status, setCurrentUser, users, router]);

    return null;
}
