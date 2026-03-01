import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
    function middleware(req) {
        const token = req.nextauth.token
        const path = req.nextUrl.pathname

        // Protect Dashboard (CEO and ASSISTANT_CEO only)
        if (path.startsWith("/dashboard")) {
            if (token?.role !== "CEO" && token?.role !== "ASSISTANT_CEO") {
                return NextResponse.redirect(new URL("/projects", req.url))
            }
        }

        // Default allow if authenticated
        return NextResponse.next()
    },
    {
        callbacks: {
            authorized: ({ token }) => !!token,
        },
        pages: {
            signIn: "/login",
        }
    }
)

export const config = {
    matcher: [
        "/dashboard/:path*",
        "/projects/:path*",
        "/meeting/:path*",
        "/tasks/:path*",
        "/shipment-mgmt/:path*",
        "/shipment-monitor/:path*",
        "/sales-monitor/:path*",
        "/sales-plan/:path*",
        "/market-price/:path*"
    ]
}
