import { z } from 'zod';

// Billing Profile
export const BillingProfileSchema = z.object({
    billingName: z.string().optional(),
    billingId: z.string().optional(), // VAT/Tax ID
    billingAddress: z.string().optional(),
    billingPhone: z.string().optional(),
});

// Scheduling
export const BillingScheduleSchema = z.object({
    autoInvoiceEnabled: z.boolean().default(false),
    timezone: z.string().default("Asia/Jerusalem"),
    frequency: z.enum(['daily', 'weekly', 'monthly']).default('monthly'),
    dayOfMonth: z.number().min(1).max(28).optional(),
    dayOfWeek: z.number().min(0).max(6).optional(), // 0=Sunday
    timeOfDay: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).default("23:59"),
    startDate: z.string().optional(), // ISO Date YYYY-MM-DD
    endDate: z.string().optional(),

    // Retainer / Credits
    monthlyChangeCredit: z.number().default(1),
    currentMonthCreditUsed: z.number().default(0),
    creditResetDate: z.any().optional(), // Timestamp

    // Auto-computed/Internal
    nextRunAt: z.any().optional(), // Timestamp
    lastRunAt: z.any().optional(), // Timestamp
}).refine(data => {
    if (data.autoInvoiceEnabled) {
        if (data.frequency === 'monthly' && !data.dayOfMonth) return false;
        if (data.frequency === 'weekly' && data.dayOfWeek === undefined) return false;
    }
    return true;
}, {
    message: "Day of month/week is required when auto-invoice is enabled based on frequency",
    path: ["frequency"]
});

// Sending Settings
export const BillingSendingSchema = z.object({
    autoSendInvoices: z.boolean().default(false),
    invoiceEmailsEnabled: z.boolean().default(false), // Toggle multi-email
    invoiceEmails: z.array(z.string().email("Invalid email format")).default([]),
}).refine(data => {
    if (data.autoSendInvoices) {
        if (data.invoiceEmails.length === 0) return false;
    }
    return true;
}, {
    message: "At least one valid email is required for automatic sending",
    path: ["invoiceEmails"]
});

// Consolidated Billing Configuration
export const ClientBillingConfigSchema = z.object({
    profile: BillingProfileSchema.default({}),
    schedule: BillingScheduleSchema.default({}),
    sending: BillingSendingSchema.default({}),
    // Kept flat amount/currency for simplicity or move to schedule?
    // Let's keep strict to schema:
    amount: z.number().min(0).default(0),
    currency: z.string().default('USD'),
});

export type ClientBillingConfig = z.infer<typeof ClientBillingConfigSchema>;
// Compatibility type alias if needed
export type BillingSchedule = z.infer<typeof BillingScheduleSchema>;

export const ClientSchema = z.object({
    id: z.string(),
    clientNumber: z.number().optional(),
    fullName: z.string().min(1, "Name is required"),
    phone: z.string().optional().or(z.literal('')),
    email: z.string().email("Invalid email").optional().or(z.literal('')),
    status: z.enum(['lead', 'active', 'paused', 'archived_lead', 'migrated_lead']).default('lead'),
    pipelineStage: z.string().default('New Lead'),
    notes: z.string().optional().or(z.literal('')),

    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
    deletedAt: z.any().optional(),

    emailLower: z.string().optional(),
    phoneNormalized: z.string().optional(),

    // Billing
    billing: ClientBillingConfigSchema.optional().default({}),
});

export type Client = z.infer<typeof ClientSchema>;

export const ClientInputSchema = ClientSchema.omit({
    id: true,
    clientNumber: true,
    createdAt: true,
    updatedAt: true,
    emailLower: true,
    phoneNormalized: true
});

export type ClientInput = z.infer<typeof ClientInputSchema>;
