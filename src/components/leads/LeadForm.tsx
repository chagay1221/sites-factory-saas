'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LeadInput } from '@/types/lead';

interface LeadFormProps {
    initialData?: Partial<LeadInput>;
    onSubmit: (data: LeadInput) => Promise<void>;
    onCancel: () => void;
    isLoading?: boolean;
    submitLabel?: string;
}

export const LeadForm = ({ initialData, onSubmit, onCancel, isLoading, submitLabel }: LeadFormProps) => {
    const [formData, setFormData] = useState<Partial<LeadInput>>({
        fullName: initialData?.fullName || '',
        email: initialData?.email || '',
        phone: initialData?.phone || '',
        source: initialData?.source || 'manual',
        status: initialData?.status || 'new',
        notes: initialData?.notes || '',
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Simple validation clear
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

        // Manual validation for MVP
        if (!formData.fullName?.trim()) {
            setErrors({ fullName: "Full Name is required" });
            return;
        }

        await onSubmit(formData as LeadInput);
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
                    placeholder="e.g. John Doe"
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
                        placeholder="john@example.com"
                    />
                </div>
                <div>
                    <label className="text-sm font-medium text-gray-700">Phone</label>
                    <Input
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
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
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="qualified">Qualified</option>
                        <option value="converted">Converted</option>
                        <option value="archived">Archived</option>
                    </select>
                </div>
                <div>
                    <label className="text-sm font-medium text-gray-700">Source</label>
                    <Input
                        name="source"
                        value={formData.source}
                        onChange={handleChange}
                        placeholder="e.g. Website, Manual"
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
                    placeholder="Lead notes..."
                />
            </div>

            <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                    Cancel
                </Button>
                <Button type="submit" isLoading={isLoading}>
                    {submitLabel || (initialData?.fullName ? 'Update Lead' : 'Create Lead')}
                </Button>
            </div>
        </form>
    );
};
