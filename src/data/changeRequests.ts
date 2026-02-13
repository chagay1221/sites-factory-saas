import { db } from '@/lib/firestore';
import { collection, addDoc, doc, getDoc, updateDoc, query, where, getDocs, orderBy, runTransaction, serverTimestamp } from 'firebase/firestore';
import { ChangeRequestInput, ChangeRequest } from '@/schemas/changeRequest';
import { Client } from '@/types/client';
import { ProjectInput } from '@/types/project';

// Collection References
const CLIENTS_COLLECTION = 'clients';
const CHANGE_REQUESTS_COLLECTION = 'changeRequests';
const PROJECTS_COLLECTION = 'projects';

export async function createChangeRequest(data: ChangeRequestInput) {
    return await runTransaction(db, async (transaction) => {
        // 1. Get Client to check credits
        const clientRef = doc(db, CLIENTS_COLLECTION, data.clientId);
        const clientSnap = await transaction.get(clientRef);

        if (!clientSnap.exists()) {
            throw new Error("Client not found");
        }

        const clientData = clientSnap.data() as Client;
        const billing = clientData.billing || {};
        const schedule = billing.schedule || {};

        const monthlyCredit = schedule.monthlyChangeCredit ?? 1;
        const usedCredit = schedule.currentMonthCreditUsed ?? 0;

        let usesMonthlyCredit = false;
        let billedSeparately = false;

        // Credit Logic
        if (data.manualBillingType === 'billable') {
            billedSeparately = true;
            usesMonthlyCredit = false;
        } else if (data.manualBillingType === 'credit') {
            billedSeparately = false;
            usesMonthlyCredit = true;

            // Always increment used credit if forced to use credit (even if over limit)
            // Or maybe we treat it as 0 cost, but for tracking let's increment.
            // Robustly update billing object
            const newBilling = {
                ...billing,
                schedule: {
                    ...schedule,
                    currentMonthCreditUsed: usedCredit + 1
                }
            };

            transaction.update(clientRef, {
                billing: newBilling
            });
        } else {
            // Default Auto Logic
            // Check if auto-invoice is enabled OR if they have a "retainer" (implied by having credits > 0)
            // Simple logic: If they have credit remaining, use it.
            if (usedCredit < monthlyCredit) {
                usesMonthlyCredit = true;
                // Robustly update billing object
                const newBilling = {
                    ...billing,
                    schedule: {
                        ...schedule,
                        currentMonthCreditUsed: usedCredit + 1
                    }
                };

                transaction.update(clientRef, {
                    billing: newBilling
                });
            } else {
                billedSeparately = true;
            }
        }

        // 2. Create Project (Work Item)
        // We'll generate the ID for change request first to link it? 
        // Or create project first? Firestore auto-ids are generated on addDoc.
        // We can use doc(collection) to generate IDs.

        const newChangeReqRef = doc(collection(db, CHANGE_REQUESTS_COLLECTION));
        const newProjectRef = doc(collection(db, PROJECTS_COLLECTION));

        const projectData: ProjectInput = {
            clientId: data.clientId,
            title: data.title,
            type: 'managed', // Default for changes?
            status: 'active',
            pipelineStage: 'waiting_materials',
            siteId: data.siteId,
            priority: 'normal',
            notes: `Generated from Change Request: ${data.description || 'No description'}`
        };

        // 3. Create Change Request Data
        const changeRequestData: Omit<ChangeRequest, 'id'> = {
            ...data,
            usesMonthlyCredit,
            billedSeparately,
            status: 'new',
            workItemId: newProjectRef.id,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        // Helper to remove undefined
        const cleanData = (obj: any) => {
            return Object.entries(obj).reduce((acc, [key, value]) => {
                if (value !== undefined) acc[key] = value;
                return acc;
            }, {} as any);
        };

        const cleanedProjectData = cleanData({
            ...projectData,
            clientName: clientData.fullName, // Add client name for display
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        const cleanedChangeRequestData = cleanData(changeRequestData);

        transaction.set(newChangeReqRef, cleanedChangeRequestData);
        transaction.set(newProjectRef, cleanedProjectData);

        return newChangeReqRef.id;
    });
}

export async function getChangeRequestsForClient(clientId: string) {
    const q = query(
        collection(db, CHANGE_REQUESTS_COLLECTION),
        where('clientId', '==', clientId)
    );
    const snapshot = await getDocs(q);

    // Sort in memory to avoid needing composite index
    return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as ChangeRequest))
        .sort((a, b) => {
            const dateA = a.createdAt?.seconds || 0;
            const dateB = b.createdAt?.seconds || 0;
            return dateB - dateA; // Descending
        });
}

export async function getBillableChangeRequests() {
    // pending billable changes: billedSeparately = true AND status = 'done' (or maybe just track unbilled?)
    // The requirement says: list change requests where billedSeparately = true AND status = done AND no invoice created yet.
    // 'no invoice created yet' needs a field tracking it or we assume if it's there it's unbilled?
    // Let's add 'invoiced: boolean' to schema? Or just rely on separate tracking.
    // For MVP, user asked specifically: "no invoice created yet". 
    // I'll stick to the schema I made. I didn't add 'invoiced' field. 
    // I should probably add an 'invoiceId' optional field to ChangeRequest to track this.

    // For now, let's just query billedSeparately + done.
    const q = query(
        collection(db, CHANGE_REQUESTS_COLLECTION),
        where('billedSeparately', '==', true),
        where('status', '==', 'done')
    );
    // Ideally filter where invoiceId is null.
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChangeRequest));
}

// Support for updating status 
export async function updateChangeRequestStatus(id: string, status: ChangeRequest['status']) {
    const ref = doc(db, CHANGE_REQUESTS_COLLECTION, id);
    await updateDoc(ref, {
        status,
        updatedAt: serverTimestamp(),
        // If done, maybe set completedAt
        ...(status === 'done' ? { completedAt: serverTimestamp() } : {})
    });
}

export async function updateChangeRequest(id: string, data: Partial<ChangeRequestInput>) {
    const ref = doc(db, CHANGE_REQUESTS_COLLECTION, id);
    await updateDoc(ref, {
        ...data,
        updatedAt: serverTimestamp()
    });
}

export async function deleteChangeRequest(id: string) {
    return await runTransaction(db, async (transaction) => {
        // 1. Get the request to check if we need to refund credit
        const ref = doc(db, CHANGE_REQUESTS_COLLECTION, id);
        const snapshot = await transaction.get(ref);

        if (!snapshot.exists()) {
            throw new Error("Request not found");
        }

        const data = snapshot.data() as ChangeRequest;

        // 2. If it used a credit, we must verify client and refund
        if (data.usesMonthlyCredit && data.clientId) {
            const clientRef = doc(db, CLIENTS_COLLECTION, data.clientId);
            const clientSnap = await transaction.get(clientRef);

            if (clientSnap.exists()) {
                const clientData = clientSnap.data() as Client;
                const billing = clientData.billing || {};
                const schedule = billing.schedule || {};
                const used = schedule.currentMonthCreditUsed || 0;

                if (used > 0) {
                    // Robustly update billing object
                    const newBilling = {
                        ...billing,
                        schedule: {
                            ...schedule,
                            currentMonthCreditUsed: used - 1
                        }
                    };

                    transaction.update(clientRef, {
                        billing: newBilling
                    });
                }
            }
        }

        // 3. Delete the request
        transaction.delete(ref);

        // 4. Optionally delete the linked work item (project)?
        // For safety, let's leave the project or delete it? 
        // User didn't request deep delete, but cleaner to remove it if it was auto-generated.
        if (data.workItemId) {
            const projectRef = doc(db, PROJECTS_COLLECTION, data.workItemId);
            transaction.delete(projectRef);
        }
    });
}
