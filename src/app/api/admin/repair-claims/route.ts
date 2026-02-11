import { NextResponse } from 'next/server';
import { db } from '@/lib/firestore'; // Check your import path for db
import { collection, getDocs, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { normalizeDomain } from '@/utils/domain';

// Helper to calculate effective domain (duplicated from sites.ts to keep script standalone or import if possible)
// Importing from sites.ts might be safer to ensure logic match.
// But getEffectiveDomain is not exported. Let's just replicate the logic which is simple.
function getEffectiveDomain(data: any): string | undefined {
    if (data.type === 'managed') {
        return normalizeDomain(data.domain);
    } else if (data.type === 'external') {
        return normalizeDomain(data.externalUrl);
    }
    return undefined;
}

export async function GET() {
    const logs: string[] = [];
    const log = (msg: string) => logs.push(msg);

    try {
        log("Starting Domain Claim Repair...");

        const sitesRef = collection(db, 'sites');
        const snapshot = await getDocs(sitesRef);
        const sites = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        log(`Found ${sites.length} sites.`);

        let created = 0;
        let existed = 0;
        let conflicts = 0;

        for (const site of sites) {
            const effectiveDomain = getEffectiveDomain(site);

            if (!effectiveDomain) {
                log(`Skipping site ${site.id} (No effective domain)`);
                continue;
            }

            // Only care about active sites
            if ((site as any).status === 'archived') {
                log(`Skipping archived site ${site.id}`);
                continue;
            }

            const claimRef = doc(db, 'domainClaims', effectiveDomain);
            const claimSnap = await getDoc(claimRef);

            if (claimSnap.exists()) {
                const claimData = claimSnap.data();
                if (claimData.siteId === site.id) {
                    // All good
                    existed++;
                } else {
                    // Conflict!
                    log(`CONFLICT: Domain "${effectiveDomain}" claimed by ${claimData.siteId}, but site ${site.id} also uses it.`);
                    conflicts++;
                }
            } else {
                // Missing claim - Create it
                await setDoc(claimRef, {
                    domain: effectiveDomain,
                    siteId: site.id,
                    clientId: (site as any).clientId || 'unknown',
                    updatedAt: serverTimestamp(),
                    _repaired: true
                });
                log(`Repaired: Created claim for "${effectiveDomain}" -> ${site.id}`);
                created++;
            }
        }

        return NextResponse.json({
            success: true,
            summary: {
                totalSites: sites.length,
                claimsCreated: created,
                claimsExisted: existed,
                conflictsFound: conflicts
            },
            logs
        });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message, logs }, { status: 500 });
    }
}
