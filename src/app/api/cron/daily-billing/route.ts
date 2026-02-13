import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firestore';
import { collection, getDocs, query, where, doc, updateDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { Client } from '@/types/client';
import { Invoice } from '@/schemas/invoice';
import { createScheduledInvoiceForClient, sendInvoiceNow } from '@/data/invoices';
import { computeNextRunAt } from '@/billing/schedule';

// Helper to standard period keys (reused/adapted)
function getPeriodKey(frequency: string, date: Date, timezone: string): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric', month: '2-digit', day: '2-digit'
    });
    const parts = formatter.formatToParts(date);
    const map = new Map(parts.map(p => [p.type, p.value]));
    const y = map.get('year');
    const m = map.get('month');
    const d = map.get('day');

    if (frequency === 'monthly') return `${y}-${m}`; // YYYY-MM
    if (frequency === 'daily') return `${y}-${m}-${d}`; // YYYY-MM-DD
    if (frequency === 'weekly') {
        // Simple "Weekly-YYYY-MM-DD" based on run date
        return `Weekly-${y}-${m}-${d}`;
    }
    return `${y}-${m}-${d}`;
}

export async function GET(req: NextRequest) {
    // 1. Auth Check
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const results = {
        generated: 0,
        generationErrors: 0,
        sent: 0,
        sendErrors: 0
    };

    const now = new Date();

    try {
        // --- PHASE 1: GENERATE INVOICES ---
        const clientsRef = collection(db, 'clients');
        // Filter clients enabled for auto-invoice
        // Note: In real app, we need index on 'billing.schedule.autoInvoiceEnabled'
        // For MVP, if we can't index, we might fetch all/active and filter in memory if small set.
        // Assuming we can query by the new field path? 'billing.schedule.autoInvoiceEnabled'
        const qGen = query(clientsRef, where('billing.schedule.autoInvoiceEnabled', '==', true));
        const clientsSnap = await getDocs(qGen);

        for (const startDoc of clientsSnap.docs) {
            try {
                const clientData = startDoc.data() as Client;
                const schedule = clientData.billing?.schedule;

                if (!schedule || !schedule.nextRunAt) continue;

                // Check due date
                const nextRunAtTimestamp = schedule.nextRunAt as any;
                const nextRunAtDate = nextRunAtTimestamp.toDate ? nextRunAtTimestamp.toDate() : new Date(nextRunAtTimestamp);

                if (nextRunAtDate > now) continue; // Not due

                // Generate
                const periodKey = getPeriodKey(schedule.frequency, nextRunAtDate, schedule.timezone);
                const clientWithId = { ...clientData, id: startDoc.id };

                const invoiceId = await createScheduledInvoiceForClient(clientWithId, periodKey);

                if (invoiceId) {
                    // Update Schedule
                    const nextRun = computeNextRunAt(clientData.billing!, nextRunAtDate);

                    await updateDoc(doc(db, 'clients', startDoc.id), {
                        'billing.schedule.lastRunAt': serverTimestamp(),
                        'billing.schedule.nextRunAt': nextRun
                    });

                    if (invoiceId !== 'existing') results.generated++;
                }
            } catch (err) {
                console.error(`Error generating invoice for client ${startDoc.id}:`, err);
                results.generationErrors++;
            }
        }

        // --- PHASE 2: SEND PENDING INVOICES ---
        // Query: from 'invoices' where sendPolicy=='auto' AND deliveryStatus in ['pending', 'failed'] AND sendAttempts < 5
        // Firestore composite indexes required for complex queries.
        // Simplified approach: Fetch 'auto' + 'pending'/'failed' logic.
        // We do two queries or one broad?
        // Let's do: where('sendPolicy', '==', 'auto') AND where('deliveryStatus', '!=', 'sent')? != not supported well.
        // Let's do: where('sendPolicy', '==', 'auto') and filter in code? OR where('deliveryStatus', '==', 'pending').
        // We want to retry failed ones too.
        // Let's query 'invoices' where sendPolicy == 'auto'. And sort by createdAt desc limit 50?
        // Better: where('sendPolicy', '==', 'auto') AND where('deliveryStatus', 'in', ['pending', 'failed'])

        // --- PHASE 2: SEND PENDING INVOICES ---
        const qSend = query(
            collection(db, 'invoices'),
            where('sendPolicy', '==', 'auto'),
            where('deliveryStatus', 'in', ['pending', 'failed'])
        );
        const invoicesSnap = await getDocs(qSend);

        for (const docSnap of invoicesSnap.docs) {
            const invoice = docSnap.data() as Invoice;
            const attempts = invoice.sendAttempts || 0;

            if (attempts >= 5) continue; // Max retries exceeded

            try {
                await sendInvoiceNow(docSnap.id);
                results.sent++;
            } catch (err) {
                console.error(`Error sending invoice ${docSnap.id}:`, err);
                results.sendErrors++;
            }
        }

        // --- PHASE 3: MONTHLY CREDIT RESET & OVERDUE HANDLING ---
        const allClientsSnap = await getDocs(collection(db, 'clients'));

        // Batch operations - limited to 500 per batch in Firestore
        // For MVP we'll just use one batch and commit if it gets full, or multiple batches.
        // A simple implementation for now: create a new batch function.
        let batch = (await import('firebase/firestore')).writeBatch(db);
        let batchCount = 0;
        const BATCH_LIMIT = 450; // Safety margin

        const commitBatch = async () => {
            if (batchCount > 0) {
                await batch.commit();
                batch = (await import('firebase/firestore')).writeBatch(db);
                batchCount = 0;
            }
        };

        for (const clientDoc of allClientsSnap.docs) {
            const client = clientDoc.data() as Client;
            const billing = client.billing;
            let clientChanged = false;

            // 3.1 Credit Reset
            if (billing?.schedule?.creditResetDate) {
                const resetDate = billing.schedule.creditResetDate.toDate ? billing.schedule.creditResetDate.toDate() : new Date(billing.schedule.creditResetDate);
                if (now >= resetDate) {
                    // Calculate next reset (1st of next month)
                    const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                    batch.update(clientDoc.ref, {
                        'billing.schedule.currentMonthCreditUsed': 0,
                        'billing.schedule.creditResetDate': nextReset
                    });
                    batchCount++;
                    clientChanged = true;
                }
            } else {
                // Initialize if missing
                const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                batch.update(clientDoc.ref, {
                    'billing.schedule.creditResetDate': nextReset
                });
                batchCount++;
                clientChanged = true;
            }

            if (batchCount >= BATCH_LIMIT) await commitBatch();

            // 3.2 Overdue & Suspension
            // Check for unpaid invoices for this client
            const invQ = query(
                collection(db, 'invoices'),
                where('clientId', '==', clientDoc.id),
                where('status', 'in', ['pending', 'sent', 'overdue'])
            );
            const invSnap = await getDocs(invQ);

            let maxOverdueDays = 0;

            if (!invSnap.empty) {
                invSnap.docs.forEach(d => {
                    const inv = d.data() as Invoice;
                    if (inv.dueDate) {
                        const due = inv.dueDate.toDate ? inv.dueDate.toDate() : new Date(inv.dueDate);

                        if (now > due) { // Only if actually past due
                            const diffTime = Math.abs(now.getTime() - due.getTime());
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            if (diffDays > maxOverdueDays) maxOverdueDays = diffDays;

                            // Mark invoice as overdue if not already
                            if (inv.status !== 'overdue') {
                                batch.update(d.ref, { status: 'overdue' });
                                batchCount++;
                            }
                        }
                    }
                });
            }

            if (batchCount >= BATCH_LIMIT) await commitBatch();

            // Determine Service Status
            // Logic: 
            // - If maxOverdueDays >= 90: Suspended
            // - If maxOverdueDays >= 30: Grace (Overdue)
            // - Otherwise: Active (even if there are pending invoices that aren't old enough)
            let newServiceStatus = 'active';
            if (maxOverdueDays >= 90) newServiceStatus = 'suspended';
            else if (maxOverdueDays >= 30) newServiceStatus = 'grace';

            // Fetch Sites to update
            const sitesQ = query(collection(db, 'sites'), where('clientId', '==', clientDoc.id));
            const sitesSnap = await getDocs(sitesQ);

            sitesSnap.docs.forEach(s => {
                const site = s.data();
                // Only update if status is different
                // IMPORTANT: If currently suspended, and we are moving to active (because invoices paid),
                // we should clear suspensionDate.
                if (site.serviceStatus !== newServiceStatus) {
                    const updates: any = { serviceStatus: newServiceStatus };

                    if (newServiceStatus === 'suspended') {
                        if (site.serviceStatus !== 'suspended') {
                            updates.suspensionDate = serverTimestamp();
                        }
                    } else {
                        // Restoration or Grace
                        updates.suspensionDate = null;

                        // If we are restoring from suspended, we might want to log it or notify?
                        // For now just seamless restoration.
                    }

                    batch.update(s.ref, updates);
                    batchCount++;
                }
            });

            if (batchCount >= BATCH_LIMIT) await commitBatch();
        }

        if (batchCount > 0) await batch.commit();

        return NextResponse.json({ success: true, results });

    } catch (error) {
        console.error("Cron Job Fatal Error:", error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
