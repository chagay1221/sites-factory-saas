'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ProjectInput, ProjectInputSchema } from '@/types/project'; // Make sure ProjectInputSchema is exported
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

import { listClients } from '@/data/clients';
import { Client } from '@/types/client';
import { listSites } from '@/data/sites';
import { Site } from '@/schemas/site';

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
    const [searchQuery, setSearchQuery] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // Sites for the selected client
    const [sites, setSites] = useState<Site[]>([]);
    const [fetchingSites, setFetchingSites] = useState(false);

    const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<ProjectInput>({
        resolver: zodResolver(ProjectInputSchema),
        defaultValues: {
            title: '',
            type: 'external',
            status: 'active',
            pipelineStage: 'closed', // Default changed from lead to closed
            priority: 'normal',
            notes: '',
            clientId: preselectedClientId || '',
            siteId: '', // Default empty
            ...initialData
        }
    });

    const watchedClientId = initialData?.clientId || preselectedClientId; // We need to watch the form value properly
    // Actually we should watch the form control
    // const selectedClientId = watch('clientId'); // But useForm destructuring above didn't get watch. Let's get it.

    // Fetch clients for dropdown
    useEffect(() => {
        const loadClients = async () => {
            try {
                const data = await listClients();
                setClients(data);

                const initialId = preselectedClientId || initialData?.clientId;
                if (initialId) {
                    setValue('clientId', initialId);
                    const selected = data.find(c => c.id === initialId);
                    if (selected && selected.fullName) {
                        setSearchQuery(selected.fullName);
                    }
                }
            } catch (error) {
                console.error("Failed to load clients", error);
            } finally {
                setFetchingClients(false);
            }
        };
        loadClients();
    }, [preselectedClientId, initialData, setValue]);

    // Fetch sites when client changes
    const selectedClientId = watch('clientId');
    useEffect(() => {
        const loadSites = async () => {
            if (!selectedClientId) {
                setSites([]);
                return;
            }
            setFetchingSites(true);
            try {
                const data = await listSites(selectedClientId);
                setSites(data);
            } catch (error) {
                console.error("Failed to load sites", error);
            } finally {
                setFetchingSites(false);
            }
        };
        loadSites();
    }, [selectedClientId]);

    const filteredClients = clients.filter(client =>
        (client.fullName && client.fullName.toLowerCase().includes((searchQuery || '').toLowerCase())) ||
        (client.clientNumber && client.clientNumber.toString().includes(searchQuery || ''))
    );

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

            {/* Client (Searchable Dropdown) */}
            <div className="relative">
                <label className="text-sm font-medium text-gray-700">Client</label>
                {fetchingClients ? (
                    <div className="text-sm text-gray-400">Loading clients...</div>
                ) : (
                    <div className="relative">
                        <input
                            type="text"
                            className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 placeholder:text-gray-400"
                            placeholder="Select or search client..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setIsDropdownOpen(true);
                                setValue('clientId', ''); // Clear selection on type
                            }}
                            onFocus={() => setIsDropdownOpen(true)}
                            disabled={!!preselectedClientId}
                        />
                        {/* Hidden input for form validation */}
                        <input type="hidden" {...register('clientId')} />

                        {isDropdownOpen && !preselectedClientId && (
                            <div className="absolute z-10 w-full mt-1 max-h-60 overflow-auto bg-white border border-gray-300 rounded-md shadow-lg">
                                {filteredClients.length === 0 ? (
                                    <div className="px-3 py-2 text-sm text-gray-500">No clients found.</div>
                                ) : (
                                    filteredClients.map(client => (
                                        <div
                                            key={client.id}
                                            className="px-3 py-2 text-sm cursor-pointer hover:bg-indigo-50 flex justify-between items-center"
                                            onClick={() => {
                                                setValue('clientId', client.id);
                                                setSearchQuery(client.fullName);
                                                setIsDropdownOpen(false);
                                                // Clear error
                                                if (errors.clientId) {
                                                    // Ideally clear error here but react-hook-form handles it on submit/change usually
                                                }
                                            }}
                                        >
                                            <span className="font-medium">{client.fullName}</span>
                                            {client.clientNumber && <span className="text-xs text-gray-400">#{client.clientNumber}</span>}
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                )}
                {errors.clientId && <span className="text-xs text-red-500">{errors.clientId.message}</span>}
                {/* Backdrop to close dropdown */}
                {isDropdownOpen && (
                    <div className="fixed inset-0 z-0" onClick={() => setIsDropdownOpen(false)} />
                )}
            </div>

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



            {/* Linked Site - Optional */}
            <div>
                <label className="text-sm font-medium text-gray-700">Linked Site (Optional)</label>
                <select
                    {...register('siteId')}
                    className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50"
                    disabled={!selectedClientId || fetchingSites}
                >
                    <option value="">-- No Site Linked --</option>
                    {sites.map(site => (
                        <option key={site.id} value={site.id}>
                            {site.label || site.domain || (site.type === 'external' ? 'External Site' : 'Managed Site')}
                            ({site.status})
                        </option>
                    ))}
                </select>
                {!selectedClientId && (
                    <p className="text-xs text-gray-400 mt-1">Select a client first to see their sites.</p>
                )}
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
        </form >
    );
};
