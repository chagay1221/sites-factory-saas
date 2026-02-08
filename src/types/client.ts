import { z } from 'zod';
import { Timestamp } from 'firebase/firestore';

export const ClientSchema = z.object({
    id: z.string(),
    fullName: z.string().min(1, "Name is required"),
    phone: z.string().optional().or(z.literal('')),
    email: z.string().email("Invalid email").optional().or(z.literal('')),
    status: z.enum(['lead', 'active', 'paused']).default('lead'),
    pipelineStage: z.string().default('New Lead'),
    notes: z.string().optional().or(z.literal('')),
    // Firestore timestamps (read as objects, write as arbitrary for now to allow serverTimestamp)
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
    deletedAt: z.any().optional(),

    // Helpers for searching/sorting
    emailLower: z.string().optional(),
    phoneNormalized: z.string().optional(),
});

export type Client = z.infer<typeof ClientSchema>;

// Input type excludes system fields
export const ClientInputSchema = ClientSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    emailLower: true,
    phoneNormalized: true
});

export type ClientInput = z.infer<typeof ClientInputSchema>;
