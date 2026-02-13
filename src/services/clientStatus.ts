import { db } from '@/lib/firestore';
import { doc, updateDoc, serverTimestamp, collection, getDocs, query, where } from 'firebase/firestore';
import { Client } from '@/types/client';

// Mock Notification Service
async function sendStatusNotification(client: Client, newStatus: string) {
    console.log(`[MOCK] Sending email to ${client.email}: Your account status changed to ${newStatus}.`);
    // In real app: import { emailProvider } from ...
}

// Mock Domain Manager
async function freezeClientDomains(clientId: string) {
    console.log(`[MOCK] Freezing domains for client ${clientId}`);
    // In real app: Update Vercel/Cloudflare config or Sites collection
    const q = query(collection(db, 'sites'), where('clientId', '==', clientId));
    const snap = await getDocs(q);
    const updates = snap.docs.map(d => updateDoc(d.ref, { serviceStatus: 'suspended', suspensionDate: serverTimestamp() }));
    await Promise.all(updates);
}

async function retrieveClientDomains(clientId: string) {
    console.log(`[MOCK] Retrieving domains for client ${clientId}`);
    const q = query(collection(db, 'sites'), where('clientId', '==', clientId));
    const snap = await getDocs(q);
    const updates = snap.docs.map(d => updateDoc(d.ref, { serviceStatus: 'active', suspensionDate: null }));
    await Promise.all(updates);
}

interface StatusChangeOptions {
    freezeDomains?: boolean;
    retrieveDomains?: boolean;
    sendNotification?: boolean;
}

export async function changeClientStatus(clientId: string, newStatus: Client['status'], options: StatusChangeOptions) {
    const clientRef = doc(db, 'clients', clientId);

    // 1. Update Status
    await updateDoc(clientRef, {
        status: newStatus,
        updatedAt: serverTimestamp()
    });

    // 2. Handle Side Effects
    if (newStatus === 'paused' && options.freezeDomains) {
        await freezeClientDomains(clientId);
    }

    if (newStatus === 'active' && options.retrieveDomains) {
        await retrieveClientDomains(clientId);
    }

    if (options.sendNotification) {
        // We need client email. Fetch check?
        // For MVP, just log or fetch if needed.
        // Assuming we pass client data or fetch it?
        // Let's fetch for completeness.
        // const snap = await getDoc(clientRef); ...
        console.log(`[Status Notification] Client ${clientId} is now ${newStatus}. Notification requested: ${options.sendNotification}`);
    }
}
