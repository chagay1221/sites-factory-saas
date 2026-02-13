import { z } from 'zod';

export const ChangeRequestSchema = z.object({
    id: z.string(),
    clientId: z.string().min(1, "Client is required"),
    siteId: z.string().optional(),

    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),

    status: z.enum(['new', 'in_progress', 'review', 'done', 'cancelled']).default('new'),

    // Credit System
    usesMonthlyCredit: z.boolean().default(false),
    billedSeparately: z.boolean().default(false),

    // Integration
    workItemId: z.string().optional(), // Link to Project/Task
    invoiceId: z.string().optional(), // If billed separately and invoiced

    // Manual Override
    manualBillingType: z.enum(['credit', 'billable']).optional(),

    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
    completedAt: z.any().optional(),
});

export type ChangeRequest = z.infer<typeof ChangeRequestSchema>;

export const ChangeRequestInputSchema = ChangeRequestSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    completedAt: true,
    usesMonthlyCredit: true, // System assigned
    billedSeparately: true, // System assigned
});

export type ChangeRequestInput = z.infer<typeof ChangeRequestInputSchema>;
