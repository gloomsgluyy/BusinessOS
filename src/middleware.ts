import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
    function middleware(req) {
        const token = req.nextauth.token
        const path = req.nextUrl.pathname

        // Protect Dashboard (Execs only based on UserRole schema)
        if (path === "/") {
            const role = (token?.role as string)?.toUpperCase();
            const allowedRoles = ["CEO", "DIRUT", "ASS_DIRUT", "COO"];
            if (!allowedRoles.includes(role)) {
                return NextResponse.redirect(new URL("/projects", req.url))
            }
        }

        // Default allow if authenticated
        return NextResponse.next()
    },
    {
        callbacks: {
            authorized: ({ token, req }) => {
                // Explicitly allow maintenance sync route without a session
                if (req.nextUrl.pathname.startsWith("/api/maintenance/sync")) return true;
                return !!token;
            },
        },
        pages: {
            signIn: "/login",
        }
    }
)

export const config = {
    matcher: ["/((?!api/whatsapp|api/maintenance/sync|_next/static|_next/image|favicon.ico|login).*)"],
}
