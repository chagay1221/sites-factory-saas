import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firestore';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

export const dynamic = 'force-dynamic'; // Or revalidate?

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const domain = searchParams.get('domain');

    if (!domain) {
        return NextResponse.json({ error: 'Domain required' }, { status: 400 });
    }

    try {
        // Query sites by domain or subdomain
        // Note: For custom domains, 'domain' field. For subdomains, 'subdomain' or logic.
        // Assuming 'domain' field in site schema covers both or handles matching.
        // Or if using subdomain logic:
        // const subdomain = domain.replace('.sites-factory.com', '');

        // Simple query on 'domain'
        const sitesRef = collection(db, 'sites');
        const q = query(sitesRef, where('domain', '==', domain), limit(1));
        const snap = await getDocs(q);

        if (snap.empty) {
            // Check subdomain if applicable?
            // Fallback for subdomains...
            // For MVP, just checked 'domain' field.
            return NextResponse.json({ status: 'not_found' }, { status: 404 });
        }

        const site = snap.docs[0].data();
        const serviceStatus = site.serviceStatus || 'active';

        return NextResponse.json({
            status: 'found',
            serviceStatus
        });

    } catch (error) {
        console.error("Error verifying site status:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
