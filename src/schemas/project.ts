import { z } from 'zod';

export const ProjectSchema = z.object({
    id: z.string(),
    clientId: z.string().min(1, "Client is required"),
    clientName: z.string().optional(), // Snapshot for display
    title: z.string().min(1, "Title is required"),
    type: z.enum(['managed', 'external']).default('external'),
    status: z.enum(['lead', 'active', 'done', 'paused']).default('active'),
    pipelineStage: z.enum([
        'lead',
        'closed',
        'waiting_materials',
        'building',
        'deploy',
        'retainer',
        'fixes'
    ]).default('lead'),
    priority: z.enum(['low', 'normal', 'high']).default('normal'),
    startedAt: z.any().optional(), // Timestamp
    deployedAt: z.any().optional(), // Timestamp
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
    notes: z.string().optional().or(z.literal('')),
    siteId: z.string().optional(), // Optional link to a Site
});

export type Project = z.infer<typeof ProjectSchema>;

export const ProjectInputSchema = ProjectSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    clientName: true, // Should be resolved by service
    startedAt: true, // Handled by service logic
    deployedAt: true, // Handled by service logic
});

export type ProjectInput = z.infer<typeof ProjectInputSchema>;
