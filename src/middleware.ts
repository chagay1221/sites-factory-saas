import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};

export async function middleware(req: NextRequest) {
    const url = req.nextUrl;
    const hostname = req.headers.get('host') || '';

    // skip internal domains or verify if it's a tenant request
    // e.g. if hostname is app.sites-factory.com -> allow (admin)
    // if hostname is custom -> check

    // For local dev: localhost:3000 -> admin?
    // User might test with localhost:3000.

    // Let's assume TENANT domains are anything NOT IN [admin domains]
    // Or simpler: Only check if NOT /suspended and NOT /admin (path based).
    // Wait, path based admin check is insufficient if domains map to sites root.
    // Tenant sites map to root /.

    const isAdminDomain = hostname.includes('localhost') || hostname === 'app.sites-factory.com';
    // ^ Assuming localhost is admin for dev. Tenant testing via hosts file?

    // IF it IS a tenant domain request:
    // (For MVP, let's assume all requests except /admin/* and /api/* are potentially tenant site requests)

    // Wait, if I'm running locally, I access admin dashboard on localhost:3000/admin.
    // I access tenant sites on tenant.localhost:3000 ? 
    // This requires complex middleware.

    // Given the prompt "middleware-based suspension", let's be safe:
    // Only check suspension if we identify a Site ID or Domain mapping?

    // STRATEGY: 
    // 1. Identify domain.
    // 2. Call API to check status.
    // 3. If suspended -> rewrite to /suspended.

    // Optimization: Skip checking for /suspended path itself to avoid loop.
    if (url.pathname.startsWith('/suspended')) return NextResponse.next();
    if (url.pathname.startsWith('/admin')) return NextResponse.next();
    if (url.pathname.startsWith('/login')) return NextResponse.next();

    // Only run check if we suspect it's a site visit.
    // Problem: localhost:3000 matches this for home page '/'.
    // If we only have 1 domain, we can't do tenant hosting?
    // Assuming subdomain or multi-domain setup.
    // Let's assume we check ALL hosts except known admin ones.

    // For simple verification provided in plan:
    // We will attempt to verify.

    if (process.env.NODE_ENV === 'development' && !hostname.includes('.')) {
        // localhost (no subdomain) -> treat as admin/landing
        return NextResponse.next();
    }

    // Fetch status
    // Note: Fetching absolute URL requires host
    // We use req.nextUrl.origin to get the base URL of the app
    const apiUrl = new URL('/api/site-status', req.nextUrl.origin);
    apiUrl.searchParams.set('domain', hostname);

    try {
        const res = await fetch(apiUrl.toString(), {
            next: { revalidate: 60 } // Cache for 60s
        });

        if (res.ok) {
            const data = await res.json();
            if (data.serviceStatus === 'suspended') {
                return NextResponse.rewrite(new URL('/suspended', req.url));
            }
        }
    } catch (err) {
        console.error("Middleware check failed", err);
        // Fail open to avoid outage on API error
    }

    return NextResponse.next();
}
