import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
    function middleware(req) {
        const token = req.nextauth.token
        const path = req.nextUrl.pathname

        // Protect Dashboard (CEO and director/ASSISTANT_CEO only)
        if (path === "/") {
            const role = (token?.role as string)?.toLowerCase();
            if (role !== "ceo" && role !== "director") {
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
