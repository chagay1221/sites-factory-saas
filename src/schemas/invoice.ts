import { z } from 'zod';

export const InvoiceSchema = z.object({
    id: z.string(),
    clientId: z.string(),
    clientName: z.string(), // Denormalize for list UI
    projectId: z.string().optional(),

    // Core
    amount: z.number().min(0),
    currency: z.string().default('ILS'),
    description: z.string().optional(),
    periodKey: z.string().optional(), // Required for scheduled invoice
    source: z.enum(['manual', 'scheduled']).default('manual'),

    // Provider (Mock)
    provider: z.string().default('mock'),
    providerInvoiceId: z.string().optional(),
    invoiceNumber: z.string().optional(),
    pdfUrl: z.string().optional(),
    externalUrl: z.string().optional(),

    // Payment Status
    status: z.enum(['draft', 'pending', 'sent', 'paid', 'overdue', 'void']).default('draft'),
    paidAt: z.any().optional(),

    // Sending
    sendPolicy: z.enum(['manual', 'auto']).default('manual'),
    deliveryStatus: z.enum(['pending', 'sent', 'failed']).default('pending'),
    sendAttempts: z.number().default(0),
    lastSendError: z.string().optional(),
    sentAt: z.any().optional(), // Timestamp

    // Meta
    issuedAt: z.any(), // Timestamp when created/issued
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
    dueDate: z.any().optional(),
});

export type Invoice = z.infer<typeof InvoiceSchema>;

export const InvoiceInputSchema = InvoiceSchema.omit({
    id: true,
    invoiceNumber: true,
    providerInvoiceId: true,
    pdfUrl: true,
    externalUrl: true,
    createdAt: true,
    updatedAt: true,
    issuedAt: true,
    sentAt: true,
    sendAttempts: true,
    lastSendError: true,
    deliveryStatus: true
});

export type InvoiceInput = z.infer<typeof InvoiceInputSchema>;
