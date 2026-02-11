import { z } from 'zod';


export const LeadStatus = z.enum(['new', 'contacted', 'qualified', 'converted', 'archived']);
export type LeadStatusType = z.infer<typeof LeadStatus>;

export const LeadSchema = z.object({
    id: z.string(),
    fullName: z.string().min(1, "Full Name is required"),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    source: z.string().optional(),
    status: LeadStatus.default('new'),
    notes: z.string().optional(),
    emailLower: z.string().optional(),
    phoneNormalized: z.string().optional(),
    clientId: z.string().optional(),
    projectId: z.string().optional(),
    convertedAt: z.any().optional(), // Timestamp or undefined
    createdAt: z.any(), // Timestamp
    updatedAt: z.any(), // Timestamp
});

export type Lead = z.infer<typeof LeadSchema>;

export type LeadInput = Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'emailLower' | 'phoneNormalized' | 'clientId' | 'projectId' | 'convertedAt'>;
