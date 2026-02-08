'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Plus, Search, Trash2 } from 'lucide-react';
import { Client } from '@/types/client';
import { clientService } from '@/services/clientService';
import { ClientList } from '@/components/clients/ClientList';
import { Modal } from '@/components/ui/Modal';
import { ClientForm } from '@/components/clients/ClientForm';
import { Spinner } from '@/components/ui/Spinner';

export default function ClientsPage() {
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'active' | 'trash'>('active');
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const fetchClients = async () => {
        setLoading(true);
        // If viewMode is trash, showDeleted = true
        const data = await clientService.getClients(viewMode === 'trash');
        setClients(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchClients();
    }, [viewMode]); // Refetch when viewMode changes

    const handleCreateClient = async (data: any) => {
        setIsSubmitting(true);
        try {
            await clientService.createClient(data);
            if (viewMode === 'active') await fetchClients(); // Refresh list only if in active view
            setIsCreateModalOpen(false);
        } catch (error: any) {
            console.error("Failed to create client", error);
            alert(error.message || "Failed to create client");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditClick = (client: Client) => {
        setEditingClient(client);
        setIsEditModalOpen(true);
    };

    const handleUpdateClient = async (data: any) => {
        if (!editingClient) return;
        setIsSubmitting(true);
        try {
            await clientService.updateClient(editingClient.id, data);
            await fetchClients();
            setIsEditModalOpen(false);
            setEditingClient(null);
        } catch (error: any) {
            console.error("Failed to update client", error);
            alert(error.message || "Failed to update client");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteClick = async (id: string) => {
        if (viewMode === 'active') {
            if (!confirm("Are you sure you want to move this client to the Trash?")) return;
            try {
                await clientService.deleteClient(id); // Soft delete
                await fetchClients();
            } catch (error: any) {
                console.error("Failed to delete client", error);
                alert(error.message || "Failed to delete client");
            }
        } else {
            // Hard Delete
            if (!confirm("⚠️ PERMANENT DELETE: This cannot be undone. Are you sure?")) return;
            try {
                await clientService.hardDeleteClient(id);
                await fetchClients();
            } catch (error: any) {
                console.error("Failed to permanently delete client", error);
                alert(error.message || "Failed to permanently delete client");
            }
        }
    };

    const handleRestoreClick = async (id: string) => {
        try {
            await clientService.restoreClient(id);
            await fetchClients();
        } catch (error: any) {
            console.error("Failed to restore client", error);
            alert(error.message || "Failed to restore client");
        }
    };

    const filteredClients = clients.filter(client => {
        const matchesSearch = (
            client.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (client.phone && client.phone.includes(searchTerm))
        );
        const matchesStatus = statusFilter === 'all' || client.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                        {viewMode === 'active' ? 'Clients' : 'Garbage Zone'}
                    </h1>
                    {viewMode === 'trash' && (
                        <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full animate-pulse">
                            Items here will be permanently deleted
                        </span>
                    )}
                </div>

                <div>
                    {viewMode === 'active' && (
                        <Button onClick={() => setIsCreateModalOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            New Client
                        </Button>
                    )}
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div className="relative flex-1 max-w-md w-full">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                        placeholder="Search by name, email, or phone..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select
                    className="h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent w-full sm:w-[150px]"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="all">All Statuses</option>
                    <option value="lead">Lead</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                </select>

                <div className="hidden sm:block w-px h-6 bg-gray-300 mx-2 sm:ml-auto"></div>

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewMode(viewMode === 'active' ? 'trash' : 'active')}
                    className={viewMode === 'trash' ? "text-gray-600 shrink-0" : "text-gray-400 hover:text-gray-600 shrink-0"}
                    title={viewMode === 'active' ? "View Trash" : "Back to Active"}
                >
                    {viewMode === 'active' ? (
                        <>
                            <Trash2 className="h-4 w-4 mr-2" />
                            <span className="text-xs">Trash</span>
                        </>
                    ) : (
                        <>
                            <span className="mr-2">⬅️</span>
                            <span className="text-xs">Back</span>
                        </>
                    )}
                </Button>
            </div>

            {/* List */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <Spinner className="h-8 w-8" />
                </div>
            ) : (
                <ClientList
                    clients={filteredClients}
                    onEdit={handleEditClick}
                    onDelete={handleDeleteClick}
                    onRestore={handleRestoreClick}
                    isTrash={viewMode === 'trash'}
                />
            )}

            {/* View Mode specific actions can be passed via ClientList if we modify it, 
                or we just rely on generic onDelete being contextual. 
                Ideally, ClientList should show "Restore" button if we are in trash.
                We need to pass `isTrash={viewMode === 'trash'}` and `onRestore` to ClientList.
            */}

            {/* Create Modal */}
            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title="Add New Client"
            >
                <ClientForm
                    onSubmit={handleCreateClient}
                    onCancel={() => setIsCreateModalOpen(false)}
                    isLoading={isSubmitting}
                />
            </Modal>

            {/* Edit Modal */}
            <Modal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                title="Edit Client"
            >
                <ClientForm
                    initialData={editingClient || undefined}
                    onSubmit={handleUpdateClient}
                    onCancel={() => setIsEditModalOpen(false)}
                    isLoading={isSubmitting}
                />
            </Modal>
        </div>
    );
}
