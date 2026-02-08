'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ProjectInput, ProjectInputSchema } from '@/types/project'; // Make sure ProjectInputSchema is exported
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { clientService } from '@/services/clientService';
import { Client } from '@/types/client';

interface ProjectFormProps {
    initialData?: Partial<ProjectInput>;
    onSubmit: (data: ProjectInput) => Promise<void>;
    onCancel: () => void;
    isLoading?: boolean;
    preselectedClientId?: string;
}

export const ProjectForm = ({ initialData, onSubmit, onCancel, isLoading, preselectedClientId }: ProjectFormProps) => {
    const [clients, setClients] = useState<Client[]>([]);
    const [fetchingClients, setFetchingClients] = useState(true);

    const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<ProjectInput>({
        resolver: zodResolver(ProjectInputSchema),
        defaultValues: {
            title: '',
            type: 'external',
            status: 'active',
            pipelineStage: 'lead',
            priority: 'normal',
            notes: '',
            clientId: preselectedClientId || '',
            ...initialData
        }
    });

    // Fetch clients for dropdown
    useEffect(() => {
        const loadClients = async () => {
            try {
                const data = await clientService.getClients();
                setClients(data);
                if (preselectedClientId) {
                    console.log("Setting preselected client ID:", preselectedClientId);
                    setValue('clientId', preselectedClientId);
                }
            } catch (error) {
                console.error("Failed to load clients", error);
            } finally {
                setFetchingClients(false);
            }
        };
        loadClients();
    }, [preselectedClientId, setValue]);

    // Debug form values
    // console.log("Form Errors:", errors);

    // Debug form values
    // console.log("Form Errors:", errors);

    const handleFormSubmit = async (data: ProjectInput) => {
        // Ensure clientId is set even if the input was disabled
        const finalData = {
            ...data,
            clientId: preselectedClientId || data.clientId
        };
        await onSubmit(finalData);
    };

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
            {/* Title */}
            <div>
                <label className="text-sm font-medium text-gray-700">Project Title</label>
                <Input {...register('title')} placeholder="e.g. Stella Caffe Website" />
                {errors.title && <span className="text-xs text-red-500">{errors.title.message}</span>}
            </div>

            {/* Client (Dropdown) */}
            <div>
                <label className="text-sm font-medium text-gray-700">Client</label>
                {fetchingClients ? (
                    <div className="text-sm text-gray-400">Loading clients...</div>
                ) : (
                    <select
                        {...register('clientId')}
                        className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 placeholder:text-gray-400"
                        disabled={!!preselectedClientId} // Lock if preselected
                    >
                        <option value="">Select a Client...</option>
                        {clients.map(client => (
                            <option key={client.id} value={client.id}>{client.fullName}</option>
                        ))}
                    </select>
                )}
                {errors.clientId && <span className="text-xs text-red-500">{errors.clientId.message}</span>}
            </div>

            {/* ... Rest of form ... */}

            {/* Row: Type & Priority */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-sm font-medium text-gray-700">Type</label>
                    <select
                        {...register('type')}
                        className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="external">External</option>
                        <option value="managed">Managed</option>
                    </select>
                </div>
                <div>
                    <label className="text-sm font-medium text-gray-700">Priority</label>
                    <select
                        {...register('priority')}
                        className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                    </select>
                </div>
            </div>

            {/* Row: Status & Stage */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-sm font-medium text-gray-700">Status</label>
                    <select
                        {...register('status')}
                        className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="lead">Lead</option>
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                        <option value="done">Done</option>
                    </select>
                </div>
                <div>
                    <label className="text-sm font-medium text-gray-700">Pipeline Stage</label>
                    <select
                        {...register('pipelineStage')}
                        className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="lead">Lead</option>
                        <option value="closed">Closed</option>
                        <option value="waiting_materials">Waiting Materials</option>
                        <option value="building">Building</option>
                        <option value="deploy">Deploy</option>
                        <option value="retainer">Retainer</option>
                        <option value="fixes">Fixes</option>
                    </select>
                </div>
            </div>

            {/* Notes */}
            <div>
                <label className="text-sm font-medium text-gray-700">Notes</label>
                <textarea
                    {...register('notes')}
                    className="w-full min-h-[80px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Project details..."
                />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={onCancel} disabled={isLoading}>
                    Cancel
                </Button>
                <Button type="submit" isLoading={isLoading}>
                    {initialData ? 'Update Project' : 'Create Project'}
                </Button>
            </div>
        </form>
    );
};
