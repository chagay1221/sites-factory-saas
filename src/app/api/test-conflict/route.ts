import { NextResponse } from 'next/server';
import { db } from '@/lib/firestore';
import { collection, doc, getDoc, runTransaction, Timestamp, deleteDoc, getDocs, addDoc, updateDoc } from 'firebase/firestore';

// Mock the unarchiveSite logic here to isolate, OR import. Let's try to import first but need absolute paths if used in api route? No, relative works.
// We need to import `unarchiveSite` etc. from `@/data/sites`
import { createSite, archiveSite, updateSite } from '@/data/sites';
import { unarchiveSiteSafe } from '@/data/sites-unarchive';

export async function GET() {
    try {
        // 1. Setup: Clean up test sites if any
        const sitesRef = collection(db, 'sites');
        const snap = await getDocs(sitesRef);
        // This cleaning is dangerous in prod, be careful. 
        // Instead of cleaning, let's create unique IDs for this test.

        const timestamp = Date.now();
        const domain = `conflict-test-${timestamp}.com`;

        // 2. Create Site A (Active)
        const siteAId = await createSite({
            label: 'Site A',
            domain: domain,
            type: 'managed',
            status: 'draft',
            templateKey: 'marketing',
            clientId: 'test-client'
        });

        // 3. Create Site B (Archived, with same domain string)
        // We can't create it with domain immediately because A holds it.
        // So create with temp domain, then archive, then update domain string? 
        // OR create as 'draft' without domain, then update?
        // Actually, site B is the one we want to unarchive.
        // So let's create it as 'draft' with NO domain first.
        const siteBId = await createSite({
            label: 'Site B',
            domain: '',
            type: 'managed',
            status: 'draft',
            templateKey: 'marketing',
            clientId: 'test-client'
        });

        // Now archive B
        await archiveSite(siteBId, { recreate: false });

        // Now force-update B to have the conflicting domain (simulating acceptable state for archived site)
        // If B is archived (not active), updateSite does NOT acquire claim.
        // So we can set B's domain to 'domain' safely.
        await updateSite(siteBId, { domain: domain });

        // 4. Now try to unarchive B. This should CONFLICT with A.
        let caughtError: any = null;
        let result: any = null;
        try {
            result = await unarchiveSiteSafe(siteBId);
        } catch (e: any) {
            caughtError = {
                message: e.message,
                code: e.code,
                conflictingSiteId: e.conflictingSiteId,
                name: e.name
            };
        }

        // Cleanup
        await deleteDoc(doc(db, 'sites', siteAId));
        await deleteDoc(doc(db, 'sites', siteBId));

        return NextResponse.json({
            success: true,
            siteAId,
            siteBId,
            domain,
            result, // Check this
            caughtError
        });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message, stack: error.stack }, { status: 500 });
    }
}
