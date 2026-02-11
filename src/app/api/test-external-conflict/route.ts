import { NextResponse } from 'next/server';
import { createSite, updateSite } from '@/data/sites';
import { db } from '@/lib/firestore';
import { collection, deleteDoc, doc } from 'firebase/firestore';

export async function GET() {
    try {
        const timestamp = Date.now();
        const url = `https://test-external-${timestamp}.com`;

        // 1. Create Site A (Live) - External
        const siteAId = await createSite({
            label: 'Ext Site A',
            externalUrl: url,
            type: 'external',
            status: 'live',
            clientId: 'test-client'
        });

        // 2. Create Site B (Draft) - External - Same URL
        // This SHOULD fail
        let errorB: any = null;
        let siteBId: string | undefined;
        try {
            siteBId = await createSite({
                label: 'Ext Site B',
                externalUrl: url,
                type: 'external',
                status: 'draft',
                clientId: 'test-client'
            });
        } catch (e: any) {
            errorB = e.message;
        }

        // Cleanup
        if (siteAId) await deleteDoc(doc(db, 'sites', siteAId));
        if (siteBId) await deleteDoc(doc(db, 'sites', siteBId));

        return NextResponse.json({
            success: true,
            url,
            siteAId,
            siteBId,
            errorB, // Expecting "Domain ... is already used..."
            message: errorB ? "Conflict correctly detected" : "FAILED: Duplicate detected!"
        });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
