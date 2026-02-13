import { db } from '@/lib/firestore';
import { Invoice, InvoiceInput } from '@/schemas/invoice';
import { collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, updateDoc, where, orderBy, writeBatch } from 'firebase/firestore';
import { Client } from '@/types/client';
import { issueInvoiceMock } from '@/billing/invoiceProvider';
import { sendInvoiceEmailMock } from '@/billing/emailProvider';
import { getInvoiceRecipients } from '@/billing/recipients';

const COLLECTION_NAME = 'invoices';

/**
 * Manually create an invoice.
 */
export async function createInvoiceManual(data: InvoiceInput, client: Client): Promise<string> {
    const invoiceRef = doc(collection(db, COLLECTION_NAME));
    const now = serverTimestamp();

    const providerResult = await issueInvoiceMock({
        amount: data.amount,
        currency: data.currency,
        description: data.description,
        clientId: data.clientId
    });

    let sendPolicy: 'manual' | 'auto' = 'manual';
    if (client.billing?.sending?.autoSendInvoices) {
        sendPolicy = 'auto';
    }

    if (sendPolicy === 'auto') {
        const recipients = getInvoiceRecipients(client.billing || { schedule: {}, sending: {}, profile: {}, amount: 0, currency: 'USD' } as any);
        if (recipients.length === 0) {
            throw new Error("Client has auto-send enabled but no valid invoice emails.");
        }
    }

    const invoice: any = {
        ...data,
        id: invoiceRef.id,
        source: 'manual',
        provider: 'mock',
        providerInvoiceId: providerResult.providerInvoiceId,
        invoiceNumber: providerResult.invoiceNumber,
        pdfUrl: providerResult.pdfUrl,
        externalUrl: providerResult.externalUrl,
        sendPolicy,
        deliveryStatus: 'pending',
        sendAttempts: 0,
        createdAt: now,
        updatedAt: now,
        issuedAt: now,
        clientName: client.fullName,
    };

    await setDoc(invoiceRef, invoice);
    return invoiceRef.id;
}

/**
 * Creates a scheduled invoice idempotently.
 */
export async function createScheduledInvoiceForClient(client: Client, periodKey: string): Promise<string | null> {
    const q = query(
        collection(db, COLLECTION_NAME),
        where('clientId', '==', client.id),
        where('periodKey', '==', periodKey)
    );
    const existing = await getDocs(q);
    if (!existing.empty) {
        console.log(`Invoice for client ${client.id} period ${periodKey} already exists.`);
        return existing.docs[0].id;
    }

    const schedule = client.billing?.schedule;
    if (!schedule || !schedule.autoInvoiceEnabled) return null;

    const amount = client.billing?.amount || 0;
    const currency = client.billing?.currency || 'USD';
    const description = `Service for ${periodKey}`;

    const providerResult = await issueInvoiceMock({
        amount,
        currency,
        description,
        clientId: client.id
    });

    const sendPolicy = client.billing?.sending?.autoSendInvoices ? 'auto' : 'manual';
    let deliveryStatus = 'pending';
    let lastSendError = undefined;

    if (sendPolicy === 'auto') {
        const recipients = getInvoiceRecipients(client.billing!);
        if (recipients.length === 0) {
            deliveryStatus = 'failed';
            lastSendError = "Missing invoice email (Auto-send enabled)";
        }
    }

    const invoiceRef = doc(collection(db, COLLECTION_NAME));
    const now = new Date();

    const invoiceData: any = {
        id: invoiceRef.id,
        clientId: client.id,
        clientName: client.fullName,
        amount,
        currency,
        description,
        periodKey,
        source: 'scheduled',
        provider: 'mock',
        providerInvoiceId: providerResult.providerInvoiceId,
        invoiceNumber: providerResult.invoiceNumber,
        pdfUrl: providerResult.pdfUrl,
        externalUrl: providerResult.externalUrl,
        sendPolicy,
        deliveryStatus,
        lastSendError,
        sendAttempts: 0,
        createdAt: serverTimestamp(),
        issuedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        dueDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // 14 days
    };

    await setDoc(invoiceRef, invoiceData);
    return invoiceRef.id;
}

export async function sendInvoiceNow(invoiceId: string): Promise<void> {
    const invoiceRef = doc(db, COLLECTION_NAME, invoiceId);

    await runTransaction(db, async (transaction) => {
        const invSnap = await transaction.get(invoiceRef);
        if (!invSnap.exists()) throw new Error("Invoice not found");
        const inv = invSnap.data() as Invoice;

        const clientRef = doc(db, 'clients', inv.clientId);
        const clientSnap = await transaction.get(clientRef);
        if (!clientSnap.exists()) throw new Error("Client not found");
        const client = clientSnap.data() as Client;

        const recipients = getInvoiceRecipients(client.billing!);

        if (recipients.length === 0) {
            transaction.update(invoiceRef, {
                deliveryStatus: 'failed',
                lastSendError: 'Missing invoice email',
                sendAttempts: (inv.sendAttempts || 0) + 1,
                updatedAt: serverTimestamp()
            });
            throw new Error("Missing invoice email");
        }

        try {
            await sendInvoiceEmailMock({
                to: recipients,
                subject: `Invoice ${inv.invoiceNumber} from Sites Factory`,
                body: `Dear customer, please find your invoice attached. Amount: ${inv.amount} ${inv.currency}.`,
                links: inv.pdfUrl ? [{ label: 'Download PDF', url: inv.pdfUrl }] : undefined
            });

            transaction.update(invoiceRef, {
                deliveryStatus: 'sent',
                sentAt: serverTimestamp(),
                sendAttempts: (inv.sendAttempts || 0) + 1,
                lastSendError: null,
                updatedAt: serverTimestamp()
            });
        } catch (err: any) {
            transaction.update(invoiceRef, {
                deliveryStatus: 'failed',
                lastSendError: err.message || 'Unknown sending error',
                sendAttempts: (inv.sendAttempts || 0) + 1,
                updatedAt: serverTimestamp()
            });
            throw err;
        }
    });
}

export async function resendInvoice(invoiceId: string): Promise<void> {
    return sendInvoiceNow(invoiceId);
}

export async function listInvoices(clientId?: string): Promise<Invoice[]> {
    const constraints: any[] = [];
    if (clientId) {
        constraints.push(where('clientId', '==', clientId));
    }
    // Note: Removed orderBy('createdAt', 'desc') to avoid needing a composite index for now.
    // We will sort in memory.

    const q = query(collection(db, COLLECTION_NAME), ...constraints);
    const snapshot = await getDocs(q);

    const invoices = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    })) as Invoice[];

    return invoices.sort((a, b) => {
        const da = a.createdAt?.seconds || 0;
        const db = b.createdAt?.seconds || 0;
        return db - da; // Descending
    });
}

export async function markInvoiceAsPaid(invoiceId: string): Promise<void> {
    const invoiceRef = doc(db, COLLECTION_NAME, invoiceId);

    await runTransaction(db, async (transaction) => {
        const invSnap = await transaction.get(invoiceRef);
        if (!invSnap.exists()) throw new Error("Invoice not found");
        const inv = invSnap.data() as Invoice;

        if (inv.status === 'paid') return;

        transaction.update(invoiceRef, {
            status: 'paid',
            paidAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    });

    const invSnap = await getDoc(invoiceRef);
    const inv = invSnap.data() as Invoice;

    const sitesQuery = query(collection(db, 'sites'), where('clientId', '==', inv.clientId));
    const sitesSnap = await getDocs(sitesQuery);

    const batch = writeBatch(db);

    sitesSnap.docs.forEach(siteDoc => {
        batch.update(siteDoc.ref, {
            serviceStatus: 'active',
            suspensionDate: null,
            lastPaymentDate: serverTimestamp()
        });
    });

    await batch.commit();
}

export async function getOverdueInvoices() {
    const now = new Date();
    const q = query(
        collection(db, COLLECTION_NAME),
        where('status', 'in', ['pending', 'sent', 'overdue'])
    );

    const snap = await getDocs(q);
    const overdue: Invoice[] = [];

    snap.forEach(doc => {
        const data = doc.data() as Invoice;
        const inv = { ...data, id: doc.id };

        if (data.status === 'overdue') {
            overdue.push(inv);
        } else if (data.dueDate) {
            const due = data.dueDate.toDate ? data.dueDate.toDate() : new Date(data.dueDate);
            if (due < now) {
                overdue.push(inv);
            }
        }
    });

    return overdue.sort((a, b) => {
        const da = a.dueDate?.seconds || 0;
        const db = b.dueDate?.seconds || 0;
        return da - db;
    });
}

export async function updateInvoice(invoiceId: string, data: Partial<Invoice>): Promise<void> {
    const invoiceRef = doc(db, COLLECTION_NAME, invoiceId);
    await updateDoc(invoiceRef, {
        ...data,
        updatedAt: serverTimestamp()
    });
}
