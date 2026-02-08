'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form'; // Note: User constraints said no unnecessary libraries, but RHF + Zod is standard. Will implement raw if needed, but RHF is best practice. Let's try raw to stick to minimal constraints or use simple state if simpler. RHF is better for Zod integration. I will use standard controlled inputs to keep dependencies low as per strict instruction "no unnecessary libraries", although Zod was approved. I'll use simple state for now to minimize deps.
// Actually, I'll use simple state to avoid adding react-hook-form unless user asked. 
// Re-reading: "Client doc schema (TypeScript + Zod)". "Create client form with validation (Zod)".
// I will use manual Zod validation.

import { ClientInput, ClientSchema } from '@/types/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { z } from 'zod';

interface ClientFormProps {
    initialData?: Partial<ClientInput>;
    onSubmit: (data: ClientInput) => Promise<void>;
    onCancel: () => void;
    isLoading?: boolean;
}

export const ClientForm = ({ initialData, onSubmit, onCancel, isLoading }: ClientFormProps) => {
    const [formData, setFormData] = useState<Partial<ClientInput>>({
        fullName: initialData?.fullName || '',
        email: initialData?.email || '',
        phone: initialData?.phone || '',
        status: initialData?.status || 'lead',
        pipelineStage: initialData?.pipelineStage || 'New Lead',
        notes: initialData?.notes || '',
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Clear error when user types
        if (errors[name]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate with Zod
        try {
            const validatedData = ClientSchema.omit({
                id: true, createdAt: true, updatedAt: true, emailLower: true, phoneNormalized: true
            }).parse(formData);

            await onSubmit(validatedData);
        } catch (err) {
            if (err instanceof z.ZodError) {
                const newErrors: Record<string, string> = {};
                err.errors.forEach(error => {
                    if (error.path[0]) {
                        newErrors[error.path[0] as string] = error.message;
                    }
                });
                setErrors(newErrors);
            }
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="text-sm font-medium text-gray-700">Full Name</label>
                <Input
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    error={errors.fullName}
                    placeholder="e.g. Acme Corp"
                />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                    <label className="text-sm font-medium text-gray-700">Email</label>
                    <Input
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        error={errors.email}
                        placeholder="contact@acme.com"
                    />
                </div>
                <div>
                    <label className="text-sm font-medium text-gray-700">Phone</label>
                    <Input
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        error={errors.phone}
                        placeholder="+1 (555) 000-0000"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Status</label>
                    <select
                        name="status"
                        value={formData.status}
                        onChange={handleChange}
                        className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                    >
                        <option value="lead">Lead</option>
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                    </select>
                </div>
                <div>
                    <label className="text-sm font-medium text-gray-700">Pipeline Stage</label>
                    <Input
                        name="pipelineStage"
                        value={formData.pipelineStage}
                        onChange={handleChange}
                        error={errors.pipelineStage}
                    />
                </div>
            </div>

            <div>
                <label className="text-sm font-medium text-gray-700">Notes</label>
                <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    className="flex min-h-[80px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                    placeholder="Internal notes..."
                />
            </div>

            <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                    Cancel
                </Button>
                <Button type="submit" isLoading={isLoading}>
                    {initialData ? 'Update Client' : 'Create Client'}
                </Button>
            </div>
        </form>
    );
};
