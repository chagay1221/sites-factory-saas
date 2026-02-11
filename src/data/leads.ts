/**
 * Future: swap implementation to call /api/* endpoints for DB-private architecture.
 */

import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    runTransaction,
    query,
    where,
    orderBy
} from 'firebase/firestore';
import { db } from '@/lib/firestore';
import { Lead, LeadInput, LeadStatusType } from '@/schemas/lead';
import { normalizeEmail, normalizePhone } from '@/utils/normalize';

const COLLECTION_NAME = 'leads';
const CLIENTS_COLLECTION = 'clients';
const PROJECTS_COLLECTION = 'projects';

export async function listLeads(statusFilter?: LeadStatusType | 'all'): Promise<Lead[]> {
    try {
        const leadsRef = collection(db, COLLECTION_NAME);
        let q;

        if (statusFilter && statusFilter !== 'all') {
            q = query(leadsRef, where('status', '==', statusFilter), orderBy('createdAt', 'desc'));
        } else {
            q = query(leadsRef, orderBy('createdAt', 'desc'));
        }

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Lead));
    } catch (error) {
        console.error("Error fetching leads:", error);
        return [];
    }
}

export async function getLead(id: string): Promise<Lead | null> {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
            return { id: snapshot.id, ...snapshot.data() } as Lead;
        }
        return null;
    } catch (error) {
        console.error("Error fetching lead:", error);
        return null;
    }
}

export async function createLead(data: LeadInput): Promise<string> {
    try {
        const leadsRef = collection(db, COLLECTION_NAME);
        const now = serverTimestamp();

        const leadData = {
            ...data,
            status: data.status || 'new',
            createdAt: now,
            updatedAt: now,
            emailLower: normalizeEmail(data.email) || '',
            phoneNormalized: normalizePhone(data.phone) || ''
        };

        const docRef = await addDoc(leadsRef, leadData);
        return docRef.id;
    } catch (error) {
        console.error("Error creating lead:", error);
        throw error;
    }
}

export async function updateLead(id: string, data: Partial<LeadInput>): Promise<void> {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        const updates: Omit<Partial<LeadInput>, 'updatedAt'> & { updatedAt: unknown, emailLower?: string, phoneNormalized?: string } = { ...data, updatedAt: serverTimestamp() };

        if (data.email !== undefined) updates.emailLower = normalizeEmail(data.email) || '';
        if (data.phone !== undefined) updates.phoneNormalized = normalizePhone(data.phone) || '';

        await updateDoc(docRef, updates);
    } catch (error) {
        console.error("Error updating lead:", error);
        throw error;
    }
}

export async function deleteLead(id: string): Promise<void> {
    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        await deleteDoc(docRef);
    } catch (error) {
        console.error("Error deleting lead:", error);
        throw error;
    }
}

export async function convertLead(
    leadId: string,
    options: {
        createProject: boolean;
        clientData: {
            fullName: string;
            email?: string;
            phone?: string;
            status?: string;
            notes?: string;
        };
        projectData?: {
            type: string;
            pipelineStage: string;
        };
    }
): Promise<{ clientId: string, projectId?: string }> {
    return await runTransaction(db, async (transaction) => {
        // 1. Load Lead
        const leadRef = doc(db, COLLECTION_NAME, leadId);
        const leadDoc = await transaction.get(leadRef);
        if (!leadDoc.exists()) throw new Error("Lead not found");
        const leadData = leadDoc.data();

        if (leadData.status === 'converted') throw new Error("Lead already converted");

        // Use provided clientData for normalization as it's the source of truth
        const emailLower = normalizeEmail(options.clientData.email) || '';
        const phoneNormalized = normalizePhone(options.clientData.phone) || '';

        // 3. Find existing Client (Outside-Transaction query workaround)
        let existingClientId: string | null = null;

        // Check for existing client by email or phone
        const clientsRef = collection(db, CLIENTS_COLLECTION);
        let foundClientDoc = null;

        if (emailLower) {
            const q = query(clientsRef, where('emailLower', '==', emailLower));
            const snap = await getDocs(q);
            if (!snap.empty) foundClientDoc = snap.docs[0];
        }
        if (!foundClientDoc && phoneNormalized) {
            const q = query(clientsRef, where('phoneNormalized', '==', phoneNormalized));
            const snap = await getDocs(q);
            if (!snap.empty) foundClientDoc = snap.docs[0];
        }

        let targetClientRef;
        let isNewClient = false;

        if (foundClientDoc) {
            targetClientRef = doc(db, CLIENTS_COLLECTION, foundClientDoc.id);
            existingClientId = foundClientDoc.id;
        } else {
            targetClientRef = doc(collection(db, CLIENTS_COLLECTION));
            isNewClient = true;
            existingClientId = targetClientRef.id;
        }

        // 4. PREPARE WRITES

        // Update or Create Client with the LATEST data from the modal
        const clientUpdates: Record<string, unknown> = {
            fullName: options.clientData.fullName,
            email: options.clientData.email || '',
            phone: options.clientData.phone || '',
            emailLower: emailLower,
            phoneNormalized: phoneNormalized,
            // If new, set status. If existing, keys to current status unless we want to force active? 
            // Let's force active/lead based on input or default to active if new.
            // Requirement: "status for client: lead|active|paused (default 'lead' or 'active')"
            status: options.clientData.status || (isNewClient ? 'active' : undefined),
            notes: options.clientData.notes || '',
            updatedAt: serverTimestamp()
        };

        // Clean up undefined status if it was existing
        if (clientUpdates.status === undefined) delete clientUpdates.status;

        if (isNewClient) {
            clientUpdates.createdAt = serverTimestamp();
            clientUpdates.pipelineStage = 'New Client';
            clientUpdates.deletedAt = null;
            transaction.set(targetClientRef, clientUpdates);
        } else {
            transaction.update(targetClientRef, clientUpdates);
        }

        // 5. OPTIONAL PROJECT CREATION
        let newProjectId: string | undefined;

        if (options.createProject) {
            const newProjectRef = doc(collection(db, PROJECTS_COLLECTION));
            newProjectId = newProjectRef.id;

            transaction.set(newProjectRef, {
                title: `${options.clientData.fullName} - Project`,
                clientId: existingClientId,
                type: options.projectData?.type || 'external',
                status: 'active',
                pipelineStage: options.projectData?.pipelineStage || 'waiting_materials',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        }

        // 6. UPDATE LEAD
        const leadUpdates: Record<string, unknown> = {
            status: 'converted',
            clientId: existingClientId,
            convertedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        if (newProjectId) {
            leadUpdates.projectId = newProjectId;
        }

        transaction.update(leadRef, leadUpdates);

        return { clientId: existingClientId!, projectId: newProjectId };
    });
}

export async function getOpenLeadsCount(): Promise<number> {
    try {
        const leadsRef = collection(db, COLLECTION_NAME);
        const q = query(leadsRef, where('status', 'in', ['new', 'contacted', 'qualified']));
        const snapshot = await getDocs(q);
        return snapshot.size;
    } catch (error) {
        console.error("Error fetching open leads count:", error);
        return 0;
    }
}

export async function migrateLegacyLeads(): Promise<number> {
    try {
        const clientsRef = collection(db, CLIENTS_COLLECTION);
        const q = query(clientsRef, where('status', 'in', ['lead', 'archived_lead']));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return 0;

        const leadsRef = collection(db, COLLECTION_NAME);
        let count = 0;

        for (const docSnapshot of snapshot.docs) {
            const clientData = docSnapshot.data();
            const newStatus: LeadStatusType = clientData.status === 'archived_lead' ? 'archived' : 'new';

            await addDoc(leadsRef, {
                fullName: clientData.fullName,
                email: clientData.email,
                phone: clientData.phone,
                status: newStatus,
                source: 'Legacy Migration',
                notes: clientData.notes || 'Migrated from legacy client',
                createdAt: clientData.createdAt || serverTimestamp(),
                updatedAt: serverTimestamp(),
                emailLower: normalizeEmail(clientData.email) || '',
                phoneNormalized: normalizePhone(clientData.phone) || '',
                legacyClientId: docSnapshot.id
            });
            count++;

            const clientRef = doc(db, CLIENTS_COLLECTION, docSnapshot.id);
            await updateDoc(clientRef, { status: 'migrated_lead' });
        }

        return count;
    } catch (error) {
        console.error("Error migrating legacy leads:", error);
        throw error;
    }
}
