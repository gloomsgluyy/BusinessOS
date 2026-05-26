import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
    function middleware(req) {
        const token = req.nextauth.token
        const path = req.nextUrl.pathname
        const role = (token?.role as string)?.toUpperCase();
        const isPublicDocumentDrive = path === "/document-drive" || path.startsWith("/api/document-drive");

        if (path === "/projects") {
            const nextUrl = req.nextUrl.clone();
            nextUrl.pathname = "/forecast-sales";
            return NextResponse.redirect(nextUrl);
        }

        if (isPublicDocumentDrive) {
            return NextResponse.next();
        }

        if (role === "STAFF") {
            const allowedDocumentPath = isPublicDocumentDrive;
            if (!allowedDocumentPath) {
                if (path.startsWith("/api/")) {
                    return NextResponse.json({ error: "Forbidden. Document Drive access only." }, { status: 403 });
                }
                return NextResponse.redirect(new URL("/document-drive", req.url));
            }
        }

        // Protect Dashboard (Execs only based on UserRole schema)
        if (path === "/") {
            const allowedRoles = ["CEO", "DIRUT", "ASS_DIRUT", "COO"];
            if (!allowedRoles.includes(role)) {
                return NextResponse.redirect(new URL("/forecast-sales", req.url))
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
                if (req.nextUrl.pathname === "/document-drive" || req.nextUrl.pathname.startsWith("/api/document-drive")) return true;
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
