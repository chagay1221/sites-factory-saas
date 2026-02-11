'use client';

import React, { useState, useEffect } from 'react';
import { Site, SiteInput } from '@/schemas/site';
import { ensureProtocol } from '@/utils/domain';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// We create a loose schema for the form because we want to handle type switching dynamically
// The actual SiteInput validation happens on submission but we want nice form errors too.
const Schema = z.object({
    type: z.enum(['external', 'managed']),
    label: z.string().optional(),
    status: z.enum(['draft', 'live', 'paused', 'archived']),
    domain: z.string().optional(),
    notes: z.string().optional(),

    // External specifics
    externalUrl: z.string().optional(),

    // Managed specifics
    templateKey: z.string().optional(),
    previewUrl: z.string().optional(),
});

type FormData = z.infer<typeof Schema>;

interface SiteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: SiteInput) => Promise<void>;
    initialData?: Site | null;
    clientId: string;
    projectId?: string;
    isLoading?: boolean;
}

export const SiteModal = ({ isOpen, onClose, onSubmit, initialData, clientId, projectId, isLoading }: SiteModalProps) => {
    const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(Schema),
        defaultValues: {
            type: 'external',
            status: 'draft',
            notes: '',
        }
    });

    const type = watch('type');

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                reset({
                    type: initialData.type,
                    label: initialData.label || '',
                    status: initialData.status,
                    domain: initialData.domain || '',
                    notes: initialData.notes || '',
                    externalUrl: initialData.externalUrl || '',
                    templateKey: initialData.templateKey || '',
                    previewUrl: initialData.previewUrl || ''
                });
            } else {
                reset({
                    type: 'external',
                    status: 'draft',
                    label: '',
                    domain: '',
                    notes: '',
                    externalUrl: '',
                    templateKey: '',
                    previewUrl: ''
                });
            }
        }
    }, [isOpen, initialData, reset]);

    const handleFormSubmit = async (data: FormData) => {
        // Construct the final object fitting SiteInput
        const payload: SiteInput = {
            clientId,
            type: data.type,
            label: data.label,
            status: data.status,
            domain: data.domain,
            notes: data.notes,
            // Conditional fields
            ...(data.type === 'external' ? { externalUrl: ensureProtocol(data.externalUrl) } : {}),
            ...(data.type === 'managed' && data.templateKey ? { templateKey: data.templateKey } : {}),
            ...(data.type === 'managed' ? { previewUrl: ensureProtocol(data.previewUrl) } : {}),
            // Optional fields
            ...(projectId ? { projectId } : {}),
            ...(initialData?.config ? { config: initialData.config } : {})
        };

        await onSubmit(payload);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={initialData ? 'Edit Site' : 'Add New Site'}
        >
            <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">

                {/* Type Selection - Only on create usually, but editable here for flexibility */}
                <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Site Type</label>
                    <select
                        {...register('type')}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        disabled={!!initialData} // Lock type on edit to avoid data loss confusion
                    >
                        <option value="external">External (Existing URL)</option>
                        <option value="managed">Managed (Template)</option>
                    </select>
                </div>

                {/* Common Fields */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">Label (Optional)</label>
                        <Input
                            {...register('label')}
                            placeholder="e.g. Main Website"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">Status</label>
                        <select
                            {...register('status')}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        >
                            <option value="draft">Draft</option>
                            <option value="live">Live</option>
                            <option value="paused">Paused</option>
                            <option value="archived">Archived</option>
                        </select>
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Custom Domain (Optional)</label>
                    <Input
                        {...register('domain')}
                        placeholder="e.g. my-business.com"
                    />
                    <p className="text-xs text-gray-500">
                        Domain is reserved per active site. Archived sites do not hold domains.
                    </p>
                </div>

                <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Notes (Optional)</label>
                    <textarea
                        {...register('notes')}
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Internal notes about this site..."
                    />
                </div>




                <div className="border-t pt-4 mt-2">
                    {/* Conditional Fields */}
                    {type === 'external' ? (
                        <div className="space-y-1 animate-in fade-in">
                            <label className="text-sm font-medium text-gray-700">External URL <span className="text-red-500">*</span></label>
                            <Input
                                {...register('externalUrl', { required: type === 'external' })}
                                placeholder="https://existing-site.com"
                            />
                            {errors.externalUrl && (
                                <p className="text-xs text-red-500">{errors.externalUrl.message || "External URL is required."}</p>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in fade-in">
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700">Template <span className="text-red-500">*</span></label>
                                <select
                                    {...register('templateKey', { required: type === 'managed' })}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                >
                                    <option value="">Select a template...</option>
                                    <option value="coffee">Coffee Shop</option>
                                    <option value="lawyer">Law Firm</option>
                                    <option value="salon">Beauty Salon</option>
                                    <option value="clinic">Medical Clinic</option>
                                    <option value="basic">Basic Business</option>
                                </select>
                                {errors.templateKey && (
                                    <p className="text-xs text-red-500">Please select a template.</p>
                                )}
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700">Preview URL (Optional)</label>
                                <Input
                                    {...register('previewUrl')}
                                    placeholder="https://preview.sitesfactory.com/..."
                                />

                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button type="submit" isLoading={isLoading}>
                        {initialData ? 'Save Changes' : 'Create Site'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
