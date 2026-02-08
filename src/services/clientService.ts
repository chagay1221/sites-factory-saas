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
    orderBy,
    limit,
    Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firestore';
import { Client, ClientInput } from '@/types/client';

const COLLECTION_NAME = 'clients';

// Mock Data Storage (In-Memory)
let mockClients: Client[] = [
    {
        id: 'mock-1',
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

const isMock = !db.type; // True if db is {} (missing API keys)

export const clientService = {
    // GET ALL
    async getClients(showDeleted: boolean = false): Promise<Client[]> {
        if (isMock) {
            console.log("Serving mock clients (Firestore not configured)");
            await new Promise(resolve => setTimeout(resolve, 500));
            // Filter based on showDeleted
            return mockClients.filter(c => showDeleted ? !!c.deletedAt : !c.deletedAt);
        }

        const clientsRef = collection(db, COLLECTION_NAME);
        // We can't easily sort by createdAt AND filter by deletedAt without a composite index in Firestore.
        // For now, let's fetch and filter in memory if the dataset is small, or use a specific query.
        // Standard approach: Query where deletedAt == null (for active) or deletedAt != null (for trash).

        // Simple query for now. Note: Complex queries might require index creation.
        let q;
        if (showDeleted) {
            q = query(clientsRef, orderBy('deletedAt', 'desc'), limit(100));
        } else {
            // For active clients, we want those where deletedAt is missing or null.
            // Firestore doesn't have a simple "where missing" in the same way for all fields combined with order, 
            // but we can query for `deletedAt == null` if we explicitly save null, or just filter client-side if list is small.
            // Best practice: Store `null` or omit? 
            // Let's rely on client-side filtering for this iteration to avoid index hell for the user, 
            // OR use a simple where clause.
            q = query(clientsRef, orderBy('createdAt', 'desc'), limit(100));
        }

        try {
            const snapshot = await getDocs(q);
            const clients = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt,
                    updatedAt: data.updatedAt,
                    deletedAt: data.deletedAt
                } as Client;
            });

            // Client-side filtering to avoid complex index requirements for the user immediately
            return clients.filter(c => showDeleted ? !!c.deletedAt : !c.deletedAt);
        } catch (error) {
            console.error("Error fetching clients:", error);
            return [];
        }
    },

    // ... getClient ... (no change needed usually, or check deletedAt if strict)
    async getClient(id: string): Promise<Client | null> {
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
    },

    // ... createClient ... (no change)
    async createClient(data: ClientInput): Promise<string> {
        const emailLower = data.email ? data.email.toLowerCase() : '';
        const phoneNormalized = data.phone ? data.phone.replace(/\D/g, '') : '';
        console.log("createClient called. isMock:", isMock);

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
            console.log("Creating client in Firestore...", data);
            const clientsRef = collection(db, COLLECTION_NAME);
            const now = serverTimestamp();

            const docRef = await addDoc(clientsRef, {
                ...data,
                emailLower,
                phoneNormalized,
                createdAt: now,
                updatedAt: now,
                deletedAt: null // Explicitly null for active
            });
            console.log("Client created with ID:", docRef.id);
            return docRef.id;
        } catch (error: any) {
            console.error("Error creating client in Firestore:", error);
            console.error("Error Code:", error.code);
            console.error("Error Message:", error.message);
            throw error;
        }
    },

    // ... updateClient ... (no change)
    async updateClient(id: string, data: Partial<ClientInput>): Promise<void> {
        if (isMock) {
            mockClients = mockClients.map(c =>
                c.id === id ? { ...c, ...data, updatedAt: { toDate: () => new Date() } } : c
            );
            await new Promise(resolve => setTimeout(resolve, 500));
            return;
        }

        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            const updates: any = { ...data, updatedAt: serverTimestamp() };

            if (data.email) updates.emailLower = data.email.toLowerCase();
            if (data.phone) updates.phoneNormalized = data.phone.replace(/\D/g, '');

            await updateDoc(docRef, updates);
        } catch (error) {
            console.error("Error updating client:", error);
            throw error;
        }
    },

    // SOFT DELETE
    async deleteClient(id: string): Promise<void> {
        if (isMock) {
            // Mock soft delete
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
    },

    // HARD DELETE (Permanent)
    async hardDeleteClient(id: string): Promise<void> {
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
    },

    // RESTORE
    async restoreClient(id: string): Promise<void> {
        if (isMock) {
            mockClients = mockClients.map(c => c.id === id ? { ...c, deletedAt: undefined } : c);
            await new Promise(resolve => setTimeout(resolve, 500));
            return;
        }

        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await updateDoc(docRef, {
                deletedAt: null
            });
        } catch (error) {
            console.error("Error restoring client:", error);
            throw error;
        }
    }
};
