import {
    doc,
    runTransaction,
    serverTimestamp,
    collection
} from 'firebase/firestore';
import { db } from '@/lib/firestore';
import { Site, SiteInput } from '@/schemas/site';
import { normalizeDomain } from '@/utils/domain';

const COLLECTION_NAME = 'sites';
const DOMAIN_CLAIMS_COLLECTION = 'domainClaims';

export interface UnarchiveResult {
    success: boolean;
    conflict?: {
        siteId: string;
        ownerLabel: string;
        clientName?: string;
    }
}

export type TakeoverMode = 'pause' | 'archive';

function getEffectiveDomain(data: SiteInput | Site): string | undefined {
    if (data.type === 'managed') {
        return normalizeDomain(data.domain);
    } else if (data.type === 'external') {
        return normalizeDomain(data.externalUrl);
    }
    return undefined;
}

// Helper to fetch client name safely
async function getClientName(transaction: any, clientId: string): Promise<string> {
    if (!clientId) return 'Unknown Client';
    const clientRef = doc(db, 'clients', clientId);
    const clientSnap = await transaction.get(clientRef);
    if (clientSnap.exists()) {
        return clientSnap.data().fullName || 'Unknown Client';
    }
    return 'Unknown Client';
}

export async function unarchiveSiteSafe(siteId: string, options?: { takeoverMode?: TakeoverMode }): Promise<UnarchiveResult> {
    try {
        return await runTransaction(db, async (transaction) => {
            const siteRef = doc(db, COLLECTION_NAME, siteId);
            const siteSnap = await transaction.get(siteRef);

            if (!siteSnap.exists()) {
                throw new Error("Site not found");
            }

            const siteData = siteSnap.data() as Site;
            const effectiveDomain = getEffectiveDomain(siteData);

            // If no domain, simply restore
            if (!effectiveDomain) {
                transaction.update(siteRef, {
                    status: 'draft',
                    updatedAt: serverTimestamp()
                });
                return { success: true };
            }

            // Check claim
            const claimRef = doc(db, DOMAIN_CLAIMS_COLLECTION, effectiveDomain);
            const claimSnap = await transaction.get(claimRef);

            if (claimSnap.exists()) {
                const claimData = claimSnap.data();
                if (claimData.siteId !== siteId) {
                    const ownerRef = doc(db, COLLECTION_NAME, claimData.siteId);
                    const ownerSnap = await transaction.get(ownerRef);

                    if (ownerSnap.exists()) {
                        const ownerData = ownerSnap.data() as Site;
                        if (ownerData.status !== 'archived') {
                            // CONFLICT DETECTED
                            if (!options?.takeoverMode) {
                                // Fetch Client Name
                                const clientName = await getClientName(transaction, ownerData.clientId);

                                return {
                                    success: false,
                                    conflict: {
                                        siteId: claimData.siteId,
                                        ownerLabel: ownerData.label || 'Unknown',
                                        clientName: clientName
                                    }
                                };
                            }

                            // HANDLE TAKEOVER only if mode provided
                            if (options.takeoverMode === 'archive') {
                                transaction.update(ownerRef, {
                                    status: 'archived',
                                    updatedAt: serverTimestamp()
                                });
                            } else if (options.takeoverMode === 'pause') {
                                const ownerEffectiveDomain = getEffectiveDomain(ownerData);
                                if (ownerEffectiveDomain === effectiveDomain) {
                                    if (ownerData.type === 'managed') {
                                        transaction.update(ownerRef, {
                                            status: 'paused',
                                            domain: '',
                                            updatedAt: serverTimestamp()
                                        });
                                    } else {
                                        transaction.update(ownerRef, {
                                            status: 'paused',
                                            externalUrl: '',
                                            updatedAt: serverTimestamp()
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Restore us and claim domain
            transaction.update(siteRef, {
                status: 'draft',
                updatedAt: serverTimestamp()
            });

            transaction.set(claimRef, {
                domain: effectiveDomain,
                siteId: siteId,
                clientId: siteData.clientId,
                updatedAt: serverTimestamp()
            });

            return { success: true };
        });
    } catch (error) {
        console.error("Error unarchiving site:", error);
        throw error;
    }
}
