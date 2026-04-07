import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            role: string;
            name?: string | null;
            email?: string | null;
            image?: string | null;
        };
    }

    interface User {
        id: string;
        role: string;
    }
}

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email", placeholder: "ceo@company.com" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    console.log("[Auth] Missing credentials");
                    return null;
                }

                try {
                    console.log(`[Auth] Attempting login for: ${credentials.email}`);
                    const user = await prisma.user.findUnique({
                        where: { email: credentials.email },
                    });

                    if (!user) {
                        console.log("[Auth] User not found in database");
                        return null;
                    }

                    if (!user.password) {
                        console.log("[Auth] User exists but has no password set");
                        return null;
                    }

                    const isPasswordValid = await bcrypt.compare(
                        credentials.password,
                        user.password
                    );

                    if (!isPasswordValid) {
                        console.log("[Auth] Invalid password match");
                        return null;
                    }

                    console.log("[Auth] Login successful!");
                    return {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                    };
                } catch (error) {
                    console.error("[Auth] Exception during authorization:", error);
                    return null;
                }
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.role = user.role;
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.role = token.role as string;
                session.user.id = (token.id || token.sub) as string;
            }
            return session;
        },
    },
    pages: {
        signIn: "/login",
    },
    session: {
        strategy: "jwt",
    },
    secret: (() => {
        const secret = process.env.NEXTAUTH_SECRET;
        if (!secret) throw new Error("NEXTAUTH_SECRET is not set!");
        return secret;
    })(),
};
