'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Site, SiteInput } from '@/schemas/site';
import { ArchiveOptions } from '@/data/sites';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

interface ArchiveSiteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onArchive: (siteId: string, options: ArchiveOptions) => Promise<void>;
    site: Site | null;
    isLoading?: boolean;
}

const RecreateSchema = z.object({
    type: z.enum(['external', 'managed']),
    // External
    externalUrl: z.string().optional(),
    // Managed
    templateKey: z.string().optional(),
});

type RecreateFormData = z.infer<typeof RecreateSchema>;

export const ArchiveSiteModal = ({ isOpen, onClose, onArchive, site, isLoading }: ArchiveSiteModalProps) => {
    const [action, setAction] = useState<'archive' | 'recreate'>('archive');

    const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<RecreateFormData>({
        resolver: zodResolver(RecreateSchema),
        defaultValues: {
            type: 'external',
        }
    });

    const type = watch('type');

    // Reset when modal opens or site changes
    useEffect(() => {
        if (isOpen && site) {
            setAction('archive');
            reset({
                type: site.type, // Default to current type
                templateKey: site.type === 'managed' ? site.templateKey : '',
                // Don't copy externalUrl by default as requested, or maybe we should? 
                // Requirement said: "do NOT copy URLs automatically"
                externalUrl: '',
            });
        }
    }, [isOpen, site, reset]);

    const handleConfirm = async (data?: RecreateFormData) => {
        if (!site) return;

        const options: ArchiveOptions = {
            recreate: action === 'recreate',
        };

        if (action === 'recreate' && data) {
            const newPayload: Partial<SiteInput> = {
                clientId: site.clientId,
                type: data.type,
                status: 'draft',
                ...(site.label ? { label: `${site.label} (new)` } : {}),
                ...(site.domain ? { domain: site.domain } : {}),
                ...(data.type === 'external' && data.externalUrl ? { externalUrl: data.externalUrl } : {}),
                ...(data.type === 'managed' && data.templateKey ? { templateKey: data.templateKey } : {}),
                ...(site.notes ? { notes: site.notes } : {}),
                ...(site.config ? { config: site.config } : {})
            };
            options.newPayload = newPayload;
            options.newType = data.type;
        }

        await onArchive(site.id, options);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Archive Site"
        >
            <div className="space-y-6">
                <div>
                    <p className="text-sm text-gray-700">
                        Are you sure you want to archive <strong>{site?.label || 'this site'}</strong>?
                        Archived sites are hidden from the main list but can be restored later.
                    </p>
                </div>

                <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-900">Action</label>
                    <div className="grid grid-cols-2 gap-3">
                        <div
                            className={`border rounded-lg p-3 cursor-pointer transition-colors ${action === 'archive' ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-gray-200 hover:border-gray-300'}`}
                            onClick={() => setAction('archive')}
                        >
                            <div className="font-medium text-sm text-gray-900">Archive Only</div>
                            <div className="text-xs text-gray-500 mt-1">Just change status to archived.</div>
                        </div>
                        <div
                            className={`border rounded-lg p-3 cursor-pointer transition-colors ${action === 'recreate' ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-gray-200 hover:border-gray-300'}`}
                            onClick={() => setAction('recreate')}
                        >
                            <div className="font-medium text-sm text-gray-900">Archive & Recreate</div>
                            <div className="text-xs text-gray-500 mt-1">Archive this and start a fresh draft.</div>
                        </div>
                    </div>
                </div>

                {action === 'recreate' && (
                    <div className="border-t pt-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                        <h4 className="text-sm font-medium text-gray-900">New Site Details</h4>

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-700">New Type</label>
                            <select
                                {...register('type')}
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                                <option value="external">External (Existing URL)</option>
                                <option value="managed">Managed (Template)</option>
                            </select>
                        </div>

                        {type === 'external' ? (
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-700">External URL <span className="text-red-500">*</span></label>
                                <Input
                                    {...register('externalUrl', { required: true })}
                                    placeholder="https://..."
                                />
                                {errors.externalUrl && <span className="text-xs text-red-500">Required</span>}
                            </div>
                        ) : (
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-700">Template <span className="text-red-500">*</span></label>
                                <select
                                    {...register('templateKey', { required: true })}
                                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                >
                                    <option value="">Select a template...</option>
                                    <option value="coffee">Coffee Shop</option>
                                    <option value="lawyer">Law Firm</option>
                                    <option value="salon">Beauty Salon</option>
                                    <option value="clinic">Medical Clinic</option>
                                    <option value="basic">Basic Business</option>
                                </select>
                                {errors.templateKey && <span className="text-xs text-red-500">Required</span>}
                            </div>
                        )}

                        <div className="bg-blue-50 p-3 rounded text-xs text-blue-700">
                            The new site will be created as a <strong>Draft</strong>. Label and domain will be copied. URLs are not copied.
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" onClick={onClose} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button
                        onClick={action === 'recreate' ? handleSubmit(handleConfirm) : () => handleConfirm()}
                        isLoading={isLoading}
                        variant={action === 'archive' ? 'danger' : 'primary'}
                    >
                        {action === 'archive' ? 'Archive Site' : 'Archive & Create New'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
