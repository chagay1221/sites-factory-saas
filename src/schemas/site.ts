import { z } from 'zod';

export const SiteSchema = z.object({
    id: z.string(),
    clientId: z.string().min(1, "Client is required"),
    projectId: z.string().optional(),
    type: z.enum(['external', 'managed']),
    label: z.string().optional(),
    status: z.enum(['draft', 'live', 'paused', 'archived']).default('draft'),
    domain: z.string().optional(),
    previewUrl: z.string().optional(),
    liveUrl: z.string().optional(),
    externalUrl: z.string().optional(), // Required if type is external, validated in refinement or UI
    templateKey: z.string().optional(), // Required if type is managed
    templateVersion: z.string().optional(),
    config: z.object({
        primaryColor: z.string().optional(),
        font: z.string().optional(),
        socials: z.object({
            instagram: z.string().optional(),
            facebook: z.string().optional(),
            tiktok: z.string().optional(),
            whatsapp: z.string().optional(),
        }).optional(),
        businessHours: z.string().optional(),
        location: z.string().optional(),
    }).optional(),
    notes: z.string().optional(),

    // Retainer / Suspension
    serviceStatus: z.enum(['active', 'grace', 'suspended']).default('active'),
    lastPaymentDate: z.any().optional(),
    suspensionDate: z.any().optional(),

    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
});

export type Site = z.infer<typeof SiteSchema>;

export const SiteInputSchema = SiteSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});

export type SiteInput = z.infer<typeof SiteInputSchema>;
