import { NextResponse } from 'next/server';
import { db } from '@/lib/firestore';
import { collection, doc, deleteDoc } from 'firebase/firestore';
import { createSite, archiveSite, updateSite } from '@/data/sites';
import { unarchiveSiteSafe } from '@/data/sites-unarchive';

export async function GET() {
    try {
        const timestamp = Date.now();
        const domain = `conflict-v2-${timestamp}.com`;

        // 2. Create Site A (Active)
        const siteAId = await createSite({
            label: 'Site A V2',
            domain: domain,
            type: 'managed',
            status: 'draft',
            templateKey: 'marketing',
            clientId: 'test-client'
        });

        // 3. Create Site B (Archived)
        const siteBId = await createSite({
            label: 'Site B V2',
            domain: '',
            type: 'managed',
            status: 'draft',
            templateKey: 'marketing',
            clientId: 'test-client'
        });

        await archiveSite(siteBId, { recreate: false });
        await updateSite(siteBId, { domain: domain });

        // 4. Try unarchive safe
        let result: any = null;
        let caughtError: any = null;

        try {
            result = await unarchiveSiteSafe(siteBId);
        } catch (e: any) {
            caughtError = {
                message: e.message,
                code: e.code,
                name: e.name
            };
        }

        await deleteDoc(doc(db, 'sites', siteAId));
        await deleteDoc(doc(db, 'sites', siteBId));

        return NextResponse.json({
            success: true,
            domain,
            result, // Expecting { success: false, conflict: ... }
            caughtError // Expecting null
        });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
