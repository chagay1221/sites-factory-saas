import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    query,
    where,
    orderBy,
    writeBatch,
    runTransaction,
    Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firestore';
import { Site, SiteInput } from '@/schemas/site';
import { normalizeDomain } from '@/utils/domain';

const COLLECTION_NAME = 'sites';

function getEffectiveDomain(data: SiteInput | Site): string | undefined {
    if (data.type === 'managed') {
        return normalizeDomain(data.domain);
    } else if (data.type === 'external') {
        return normalizeDomain(data.externalUrl);
    }
    return undefined;
}

export async function listSites(clientId?: string, projectId?: string): Promise<Site[]> {
    try {
        const sitesRef = collection(db, COLLECTION_NAME);
        let q = query(sitesRef);

        if (clientId) {
            q = query(q, where('clientId', '==', clientId));
        }

        if (projectId) {
            q = query(q, where('projectId', '==', projectId));
        }

        const snapshot = await getDocs(q);
        const sites = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Site));

        // Sort in memory to avoid needing a composite index for every combination
        return sites.sort((a, b) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA;
        });
    } catch (error) {
        console.error("Error fetching sites:", error);
        return [];
    }
}

export async function getSite(id: string): Promise<Site | null> {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        const snapshot = await getDoc(docRef);

        if (snapshot.exists()) {
            return { id: snapshot.id, ...snapshot.data() } as Site;
        }
        return null;
    } catch (error) {
        console.error("Error fetching site:", error);
        return null;
    }
}

const DOMAIN_CLAIMS_COLLECTION = 'domainClaims';

export async function createSite(data: SiteInput): Promise<string> {
    const effectiveDomain = getEffectiveDomain(data);

    // If no domain effectively, just add normally
    if (!effectiveDomain) {
        try {
            const sitesRef = collection(db, COLLECTION_NAME);
            const now = serverTimestamp();
            const docRef = await addDoc(sitesRef, {
                ...data,
                domain: data.domain || '', // Ensure empty string if undefined
                createdAt: now,
                updatedAt: now
            });
            return docRef.id;
        } catch (error) {
            console.error("Error creating site:", error);
            throw error;
        }
    }

    // If domain exists, run transaction
    try {
        return await runTransaction(db, async (transaction) => {
            const claimRef = doc(db, DOMAIN_CLAIMS_COLLECTION, effectiveDomain);
            const claimSnap = await transaction.get(claimRef);

            if (claimSnap.exists()) {
                const claimData = claimSnap.data();
                // Check if the site holding it is active
                const holderSiteRef = doc(db, COLLECTION_NAME, claimData.siteId);
                const holderSnap = await transaction.get(holderSiteRef);

                if (holderSnap.exists()) {
                    const holderData = holderSnap.data();
                    if (holderData.status !== 'archived') {
                        throw new Error(`Domain "${effectiveDomain}" is already used by another active site.`);
                    }
                }
                // If holder is archived or doesn't exist (stale claim), we can overwrite
            }

            // Create the site
            const newSiteRef = doc(collection(db, COLLECTION_NAME));

            // Clean payload - ensure domain is set if managed, or left as is
            // Actually we just save data as is, but we ensure the claim is set for effectiveDomain

            transaction.set(newSiteRef, {
                ...data,
                domain: data.domain || '',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            // Set the claim
            transaction.set(claimRef, {
                domain: effectiveDomain,
                siteId: newSiteRef.id,
                clientId: data.clientId,
                updatedAt: serverTimestamp()
            });

            return newSiteRef.id;
        });
    } catch (error) {
        console.error("Error creating site with domain:", error);
        throw error;
    }
}

export async function updateSite(id: string, data: Partial<SiteInput>): Promise<void> {
    try {
        await runTransaction(db, async (transaction) => {
            const siteRef = doc(db, COLLECTION_NAME, id);
            const siteSnap = await transaction.get(siteRef);

            if (!siteSnap.exists()) {
                throw new Error("Site not found");
            }

            const currentData = siteSnap.data() as Site;
            const currentEffectiveDomain = getEffectiveDomain(currentData);
            const currentStatus = currentData.status;

            // Calculate new state
            // Merge data to see what the new object would look like
            const nextDataState: Site = {
                ...currentData,
                ...data
            };
            const nextEffectiveDomain = getEffectiveDomain(nextDataState);

            const finalStatus = data.status !== undefined ? data.status : currentStatus;

            const wasActive = currentStatus !== 'archived';
            const isActive = finalStatus !== 'archived';

            // Check if domain changed
            const domainChanged = nextEffectiveDomain !== currentEffectiveDomain;

            // PREPARE READS
            let oldClaimSnap: any = null;
            let newClaimSnap: any = null;
            let ownerSnap: any = null;

            // 1. Check if we need to release old claim
            if (currentEffectiveDomain && (domainChanged || !isActive)) {
                const oldClaimRef = doc(db, DOMAIN_CLAIMS_COLLECTION, currentEffectiveDomain);
                oldClaimSnap = await transaction.get(oldClaimRef);
            }

            // 2. Check if we need to acquire new claim
            if (nextEffectiveDomain && (domainChanged || (isActive && !wasActive)) && isActive) {
                const newClaimRef = doc(db, DOMAIN_CLAIMS_COLLECTION, nextEffectiveDomain);
                newClaimSnap = await transaction.get(newClaimRef);

                if (newClaimSnap.exists()) {
                    const claimData = newClaimSnap.data();
                    if (claimData.siteId !== id) {
                        const ownerRef = doc(db, COLLECTION_NAME, claimData.siteId);
                        ownerSnap = await transaction.get(ownerRef);
                    }
                }
            }

            // ALL READS DONE - START WRITES

            // Release old claim logic
            if (oldClaimSnap && oldClaimSnap.exists() && oldClaimSnap.data().siteId === id) {
                const oldClaimRef = doc(db, DOMAIN_CLAIMS_COLLECTION, currentEffectiveDomain!);
                transaction.delete(oldClaimRef);
            }

            // Acquire new claim logic
            if (nextEffectiveDomain && (domainChanged || (isActive && !wasActive)) && isActive) {
                const newClaimRef = doc(db, DOMAIN_CLAIMS_COLLECTION, nextEffectiveDomain);

                if (newClaimSnap && newClaimSnap.exists()) {
                    const claimData = newClaimSnap.data();
                    if (claimData.siteId !== id) {
                        // Check owner status from pre-read
                        if (ownerSnap && ownerSnap.exists()) {
                            const ownerData = ownerSnap.data() as Site;
                            if (ownerData.status !== 'archived') {
                                throw new Error(`Domain "${nextEffectiveDomain}" is already used by another active site.`);
                            }
                        }
                    }
                }

                transaction.set(newClaimRef, {
                    domain: nextEffectiveDomain,
                    siteId: id,
                    clientId: currentData.clientId,
                    updatedAt: serverTimestamp()
                });
            }

            // Prepare update payload
            const updatePayload: any = {
                ...data,
                updatedAt: serverTimestamp()
            };

            // Remove undefined fields
            Object.keys(updatePayload).forEach(key => {
                if (updatePayload[key] === undefined) {
                    delete updatePayload[key];
                }
            });

            // Ensure domain is updated if provided
            if (data.domain !== undefined) {
                updatePayload.domain = normalizeDomain(data.domain) || '';
            }

            transaction.update(siteRef, updatePayload);
        });
    } catch (error) {
        console.error("Error updating site:", error);
        throw error;
    }
}

export async function deleteSite(id: string): Promise<void> {
    try {
        await runTransaction(db, async (transaction) => {
            const siteRef = doc(db, COLLECTION_NAME, id);
            const siteSnap = await transaction.get(siteRef);

            if (!siteSnap.exists()) {
                // If site doesn't exist, just return (idempotent) or throw
                return;
            }

            const siteData = siteSnap.data() as Site;
            const effectiveDomain = getEffectiveDomain(siteData);

            if (effectiveDomain) {
                const claimRef = doc(db, DOMAIN_CLAIMS_COLLECTION, effectiveDomain);
                const claimSnap = await transaction.get(claimRef);

                if (claimSnap.exists() && claimSnap.data().siteId === id) {
                    transaction.delete(claimRef);
                }
            }

            transaction.delete(siteRef);
        });
    } catch (error) {
        console.error("Error deleting site:", error);
        throw error;
    }
}


export interface ArchiveOptions {
    recreate: boolean;
    newType?: 'external' | 'managed';
    newPayload?: Partial<SiteInput>;
}



export async function archiveSite(siteId: string, options: ArchiveOptions): Promise<string | void> {
    try {
        return await runTransaction(db, async (transaction) => {
            const siteRef = doc(db, COLLECTION_NAME, siteId);
            const siteSnap = await transaction.get(siteRef);

            if (!siteSnap.exists()) {
                throw new Error("Site not found");
            }

            const siteData = siteSnap.data() as Site;
            const effectiveDomain = getEffectiveDomain(siteData);

            // 1. Release claim if we have one
            if (effectiveDomain) {
                const claimRef = doc(db, DOMAIN_CLAIMS_COLLECTION, effectiveDomain);
                const claimSnap = await transaction.get(claimRef);
                if (claimSnap.exists() && claimSnap.data().siteId === siteId) {
                    transaction.delete(claimRef);
                }
            }

            // 2. Archive current site
            transaction.update(siteRef, {
                status: 'archived',
                updatedAt: serverTimestamp()
            });

            let newSiteId: string | undefined;

            // 3. Recreate if requested
            if (options.recreate && options.newPayload) {
                const newSiteRef = doc(collection(db, COLLECTION_NAME));
                newSiteId = newSiteRef.id;

                const newDomain = normalizeDomain(options.newPayload.domain);

                // If new site has domain, we must claim it (we just released it from the old site, so it should be free unless race condition? Transaction handles race.)
                if (newDomain) {
                    const claimRef = doc(db, DOMAIN_CLAIMS_COLLECTION, newDomain);
                    // We already checked claimRef for 'domain' above (if newDomain == domain).
                    // But strictly, we should check availability again if newDomain != domain or just set it since we are in transaction.
                    // Since we just released 'domain', if newDomain === domain, it's free.
                    // If newDomain is different, we need to check it.

                    if (newDomain !== effectiveDomain) {
                        const claimSnap = await transaction.get(claimRef);
                        if (claimSnap.exists()) {
                            const claimer = claimSnap.data();
                            if (claimer.siteId !== siteId) { // Should not happen as we are creating new, but check existence
                                const ownerRef = doc(db, COLLECTION_NAME, claimer.siteId);
                                const ownerSnap = await transaction.get(ownerRef);
                                if (ownerSnap.exists() && ownerSnap.data().status !== 'archived') {
                                    throw new Error(`Domain "${newDomain}" is used by another site.`);
                                }
                            }
                        }
                    }

                    transaction.set(claimRef, {
                        domain: newDomain,
                        siteId: newSiteId,
                        clientId: options.newPayload.clientId || siteData.clientId,
                        updatedAt: serverTimestamp()
                    });
                }

                transaction.set(newSiteRef, {
                    ...options.newPayload,
                    status: 'draft',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
            }

            return newSiteId;
        });
    } catch (error) {
        console.error("Error archiving site:", error);
        throw error;
    }
}

export type TakeoverMode = 'pause' | 'archive';

export interface UnarchiveResult {
    success: boolean;
    conflict?: {
        siteId: string;
        ownerLabel: string;
    }
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
                                // Return conflict info instead of throwing
                                return {
                                    success: false,
                                    conflict: {
                                        siteId: claimData.siteId,
                                        ownerLabel: ownerData.label || 'Unknown'
                                    }
                                };
                            }

                            // HANDLE TAKEOVER
                            if (options.takeoverMode === 'archive') {
                                transaction.update(ownerRef, {
                                    status: 'archived',
                                    updatedAt: serverTimestamp()
                                });
                                // Domain remains on archived site, but claim is lost (overwritten below)
                            } else if (options.takeoverMode === 'pause') {
                                // For External sites, we can't really "clear the domain" as nicely as managed sites (where we clear the 'domain' field).
                                // But if we clear 'externalUrl', the site works but loses its link?
                                // Actually yes, to resolve conflict, the other site must lose the claim source.
                                // For managed: domain = ''
                                // For external: externalUrl = '' ??
                                const ownerEffectiveDomain = getEffectiveDomain(ownerData);
                                if (ownerEffectiveDomain === effectiveDomain) {
                                    // Determine which field to clear based on type
                                    if (ownerData.type === 'managed') {
                                        transaction.update(ownerRef, {
                                            status: 'paused',
                                            domain: '',
                                            updatedAt: serverTimestamp()
                                        });
                                    } else {
                                        transaction.update(ownerRef, {
                                            status: 'paused',
                                            externalUrl: '', // Clear the URL to allow takeover
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
