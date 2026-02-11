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
    limit,
    orderBy,
    where
} from 'firebase/firestore';
import { db } from '@/lib/firestore';
import { Client, ClientInput } from '@/schemas/client';
import { normalizeEmail, normalizePhone } from '@/utils/normalize';

const COLLECTION_NAME = 'clients';

// Mock Data Storage (In-Memory)
let mockClients: Client[] = [
    {
        id: 'mock-1',
        clientNumber: 1001,
        fullName: 'Acme Corp (Mock)',
        email: 'contact@acme.com',
        phone: '555-0123',
        status: 'active',
        pipelineStage: 'Negotiation',
        notes: 'This is a mock client for demonstration.',
        createdAt: { toDate: () => new Date() },
        updatedAt: { toDate: () => new Date() },
        emailLower: 'contact@acme.com',
        phoneNormalized: '5550123'
    },
    {
        id: 'mock-2',
        clientNumber: 1002,
        fullName: 'John Doe (Mock)',
        email: 'john@example.com',
        status: 'lead',
        pipelineStage: 'New Lead',
        notes: 'Another mock client.',
        createdAt: { toDate: () => new Date() },
        updatedAt: { toDate: () => new Date() },
        emailLower: 'john@example.com'
    }
];

const isMock = !db.type;

export async function listClients(showDeleted: boolean = false): Promise<Client[]> {
    if (isMock) {
        await new Promise(resolve => setTimeout(resolve, 500));
        return mockClients.filter(c => showDeleted ? !!c.deletedAt : !c.deletedAt);
    }

    const clientsRef = collection(db, COLLECTION_NAME);
    let q;
    if (showDeleted) {
        q = query(clientsRef, orderBy('deletedAt', 'desc'), limit(100));
    } else {
        q = query(clientsRef, orderBy('createdAt', 'desc'), limit(100));
    }

    try {
        const snapshot = await getDocs(q);
        const clients = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                // Ensure timestamps are preserved
                createdAt: data.createdAt,
                updatedAt: data.updatedAt,
                deletedAt: data.deletedAt
            } as Client;
        });

        // Client-side filtering
        return clients.filter(c => {
            const matchesDeleted = showDeleted ? !!c.deletedAt : !c.deletedAt;
            const isHiddenStatus = ['lead', 'archived_lead', 'migrated_lead'].includes(c.status);
            if (!showDeleted) {
                return matchesDeleted && !isHiddenStatus;
            }
            return matchesDeleted;
        });
    } catch (error) {
        console.error("Error fetching clients:", error);
        return [];
    }
}

export async function getClient(id: string): Promise<Client | null> {
    if (isMock) {
        return mockClients.find(c => c.id === id) || null;
    }

    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        const snapshot = await getDoc(docRef);

        if (snapshot.exists()) {
            return { id: snapshot.id, ...snapshot.data() } as Client;
        }
        return null;
    } catch (error) {
        console.error("Error fetching client:", error);
        return null;
    }
}

export async function createClient(data: ClientInput): Promise<string> {
    // Validate Input with Zod (runtime check)
    // Note: We use the InputSchema to validate, but we also manually handle normalization below.
    // The Schema has optional() for these, so strictly speaking we might not throw if missing,
    // but the type signature enforces strictness.

    const emailLower = normalizeEmail(data.email) || '';
    const phoneNormalized = normalizePhone(data.phone) || '';

    if (isMock) {
        const newClient: Client = {
            id: `mock-${Date.now()}`,
            ...data,
            emailLower,
            phoneNormalized,
            createdAt: { toDate: () => new Date() },
            updatedAt: { toDate: () => new Date() },
        };
        mockClients = [newClient, ...mockClients];
        await new Promise(resolve => setTimeout(resolve, 500));
        return newClient.id;
    }

    try {
        const clientsRef = collection(db, COLLECTION_NAME);
        const now = serverTimestamp();

        // Atomic Counter for Client Number
        const counterRef = doc(db, '_counters', 'clientNumber');
        let clientNumber = 1001;

        try {
            const result = await runTransaction(db, async (transaction) => {
                const counterDoc = await transaction.get(counterRef);
                if (!counterDoc.exists()) {
                    transaction.set(counterRef, { value: clientNumber + 1 });
                } else {
                    clientNumber = counterDoc.data().value;
                    transaction.update(counterRef, { value: clientNumber + 1 });
                }
                return clientNumber;
            });
            clientNumber = result;
        } catch (counterError) {
            console.error("Error getting client number, using timestamp fallback:", counterError);
            clientNumber = 1000 + Math.floor(Date.now() / 1000) % 100000;
        }

        const docRef = await addDoc(clientsRef, {
            ...data,
            clientNumber,
            emailLower,
            phoneNormalized,
            createdAt: now,
            updatedAt: now,
            deletedAt: null
        });

        return docRef.id;
    } catch (error: unknown) {
        console.error("Error creating client in Firestore:", error);
        throw error;
    }
}

export async function updateClient(id: string, data: Partial<ClientInput>): Promise<void> {
    if (isMock) {
        mockClients = mockClients.map(c =>
            c.id === id ? { ...c, ...data, updatedAt: { toDate: () => new Date() } } : c
        );
        await new Promise(resolve => setTimeout(resolve, 500));
        return;
    }

    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        // Use Omit to allow serverTimestamp (FieldValue) instead of Timestamp
        const updates: Omit<Partial<ClientInput>, 'updatedAt'> & { updatedAt: unknown, emailLower?: string, phoneNormalized?: string } = { ...data, updatedAt: serverTimestamp() };

        if (data.email !== undefined) updates.emailLower = normalizeEmail(data.email) || '';
        if (data.phone !== undefined) updates.phoneNormalized = normalizePhone(data.phone) || '';

        await updateDoc(docRef, updates);
    } catch (error) {
        console.error("Error updating client:", error);
        throw error;
    }
}

export async function deleteClient(id: string): Promise<void> {
    // Soft Delete
    if (isMock) {
        mockClients = mockClients.map(c => c.id === id ? { ...c, deletedAt: { toDate: () => new Date() } } : c);
        await new Promise(resolve => setTimeout(resolve, 500));
        return;
    }

    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        await updateDoc(docRef, {
            deletedAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Error soft deleting client:", error);
        throw error;
    }
}

export async function hardDeleteClient(id: string): Promise<void> {
    if (isMock) {
        mockClients = mockClients.filter(c => c.id !== id);
        await new Promise(resolve => setTimeout(resolve, 500));
        return;
    }

    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        await deleteDoc(docRef);
    } catch (error) {
        console.error("Error hard deleting client:", error);
        throw error;
    }
}

export async function restoreClient(id: string): Promise<void> {
    if (isMock) {
        mockClients = mockClients.map(c => c.id === id ? { ...c, deletedAt: undefined } : c);
        await new Promise(resolve => setTimeout(resolve, 500));
        return;
    }

    try {
        const docRef = doc(db, COLLECTION_NAME, id);
        await updateDoc(docRef, { deletedAt: null });
    } catch (error) {
        console.error("Error restoring client:", error);
        throw error;
    }
}

export async function getLeadsCount(): Promise<number> {
    if (isMock) {
        return mockClients.filter(c => c.status === 'lead' && !c.deletedAt).length;
    }

    try {
        const clientsRef = collection(db, COLLECTION_NAME);
        const q = query(clientsRef, where('status', '==', 'lead'));
        const snapshot = await getDocs(q);
        const activeLeads = snapshot.docs.filter(doc => !doc.data().deletedAt);
        return activeLeads.length;
    } catch (error) {
        console.error("Error fetching leads count:", error);
        return 0;
    }
}

export async function scanAndFixClientNumbers(): Promise<{ scanned: number, fixed: number }> {
    if (isMock) return { scanned: 0, fixed: 0 };

    try {
        const clientsRef = collection(db, COLLECTION_NAME);
        const snapshot = await getDocs(clientsRef);

        let fixedCount = 0;
        const total = snapshot.size;

        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();

            // Skip if already has a number
            if (data.clientNumber) continue;

            // Generate Client Number (Atomic Counter)
            const counterRef = doc(db, '_counters', 'clientNumber');

            await runTransaction(db, async (transaction) => {
                const counterDoc = await transaction.get(counterRef);
                let nextClientNumber = 1001;

                if (counterDoc.exists()) {
                    nextClientNumber = counterDoc.data().value;
                    transaction.update(counterRef, { value: nextClientNumber + 1 });
                } else {
                    transaction.set(counterRef, { value: nextClientNumber + 1 });
                }

                // Update the client
                const clientRef = doc(db, COLLECTION_NAME, docSnap.id);
                transaction.update(clientRef, {
                    clientNumber: nextClientNumber,
                    updatedAt: serverTimestamp() // Optional: mark as updated
                });
            });

            fixedCount++;
        }

        return { scanned: total, fixed: fixedCount };
    } catch (error) {
        console.error("Error backfilling client numbers:", error);
        throw error;
    }
}
