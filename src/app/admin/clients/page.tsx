'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Plus, Search, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Client, ClientInput } from '@/types/client';
import { listClients, createClient, updateClient, deleteClient, hardDeleteClient, restoreClient } from '@/data/clients';
import { ClientList } from '@/components/clients/ClientList';
import { Modal } from '@/components/ui/Modal';
import { ClientForm } from '@/components/clients/ClientForm';
import { Spinner } from '@/components/ui/Spinner';
import { listLeads, createLead, getOpenLeadsCount, migrateLegacyLeads } from '@/data/leads';
import { Lead, LeadStatusType } from '@/types/lead';
import { LeadForm } from '@/components/leads/LeadForm';
import { useDialog } from '@/hooks/useDialog';
import { Dialog } from '@/components/ui/Dialog';

export default function ClientsPage() {
    // CLIENTS STATE
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'active' | 'leads' | 'trash'>('active');
    const [searchTerm, setSearchTerm] = useState('');

    // CLIENT ACTIONS STATE
    const [isCreateClientModalOpen, setIsCreateClientModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [isEditClientModalOpen, setIsEditClientModalOpen] = useState(false);

    // LEADS STATE
    const [leads, setLeads] = useState<Lead[]>([]);
    const [leadStatusFilter, setLeadStatusFilter] = useState<LeadStatusType | 'all'>('new');
    const [isCreateLeadModalOpen, setIsCreateLeadModalOpen] = useState(false);
    const [openLeadsCount, setOpenLeadsCount] = useState(0);

    // COMMON STATE
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isMigrating, setIsMigrating] = useState(false); // In-flight guard for migration
    const { dialogState, alert, confirm, closeDialog } = useDialog();

    const fetchData = React.useCallback(async () => {
        setLoading(true);
        try {
            if (viewMode === 'leads') {
                // Fetch ALL leads to allow client-side filtering (avoids complex index issues)
                const data = await listLeads('all');
                setLeads(data);
            } else {
                const clientsData = await listClients(viewMode === 'trash');
                setClients(clientsData);
            }

            // Always update leads count for the badge
            const count = await getOpenLeadsCount();
            setOpenLeadsCount(count);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    }, [viewMode]);

    useEffect(() => {
        fetchData();

        // Auto-import legacy leads once (guarded by localStorage + in-flight state)
        if (viewMode === 'leads') {
            const hasAutoMigrated = localStorage.getItem('leads_auto_migrated');
            // Check BOTH localStorage AND in-flight state to prevent race conditions
            if (!hasAutoMigrated && !isMigrating) {
                setIsMigrating(true); // Set guard IMMEDIATELY
                // Run migration silently in the background
                migrateLegacyLeads()
                    .then((count) => {
                        if (count > 0) {

                            // Refresh the leads list to show migrated items
                            fetchData();
                        }
                        // Mark as completed regardless of count to avoid future checks
                        localStorage.setItem('leads_auto_migrated', 'true');
                    })
                    .catch((error) => {
                        console.error('Auto-migration failed:', error);
                        // Don't set the flag if migration failed, so it can retry next time
                    })
                    .finally(() => {
                        setIsMigrating(false); // Clear guard when done (success or failure)
                    });
            }
        }
    }, [viewMode, isMigrating, fetchData]); // Include isMigrating to re-check after it changes

    // --- CLIENT HANDLERS ---

    const handleCreateClient = async (data: unknown) => {
        setIsSubmitting(true);
        try {
            await createClient(data as ClientInput);
            await fetchData();
            setIsCreateClientModalOpen(false);
        } catch (error: any) {
            console.error("Failed to create client", error);
            alert(error.message || "Failed to create client", 'error', 'Error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditClientClick = (client: Client) => {
        setEditingClient(client);
        setIsEditClientModalOpen(true);
    };

    const handleUpdateClient = async (data: any) => {
        if (!editingClient) return;
        setIsSubmitting(true);
        try {
            await updateClient(editingClient.id, data);
            await fetchData();
            setIsEditClientModalOpen(false);
            setEditingClient(null);
        } catch (error: any) {
            console.error("Failed to update client", error);
            alert(error.message || "Failed to update client", 'error', 'Error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteClientClick = async (clientId: string) => {
        const message = viewMode === 'trash'
            ? 'Are you sure you want to permanently delete this client? This action cannot be undone.'
            : 'Are you sure you want to delete this client?';

        confirm(message, async () => {
            try {
                if (viewMode === 'trash') {
                    // Permanent delete from trash
                    await hardDeleteClient(clientId);
                } else {
                    // Soft delete (move to trash)
                    await deleteClient(clientId);
                }
                await fetchData();
            } catch (error) {
                console.error("Failed to delete client", error);
                alert('Failed to delete client', 'error', 'Error');
            }
        });
    };

    const handleRestoreClientClick = async (clientId: string) => {
        try {
            await restoreClient(clientId);
            await fetchData();
        } catch (error) {
            console.error("Failed to restore client", error);
        }
    };

    // --- LEAD HANDLERS ---

    const handleCreateLead = async (data: any) => {
        setIsSubmitting(true);
        try {
            await createLead({
                ...data,
                status: data.status || 'new'
            });
            await fetchData();
            setIsCreateLeadModalOpen(false);
        } catch (error) {
            console.error("Failed to create lead", error);
            const message = error instanceof Error ? error.message : "Failed to create lead";
            alert(message, 'error', 'Error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- FILTERING ---

    const filteredClients = clients.filter(client =>
        client.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (client.clientNumber && client.clientNumber.toString().includes(searchTerm))
    );

    // --- STALE CHECK ---
    const isLeadStale = (lead: Lead) => {
        if (lead.status !== 'new' && lead.status !== 'qualified') return false;
        if (!lead.createdAt) return false;

        try {
            const createdDate = lead.createdAt.toDate ? lead.createdAt.toDate() : new Date(lead.createdAt);
            const now = new Date();
            const diffInHours = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
            return diffInHours > 48;
        } catch {
            return false;
        }
    };

    const hasStaleLeads = leads.some(isLeadStale);

    const filteredLeads = leads.filter(lead => {
        const matchesSearch =
            lead.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (lead.phone && lead.phone.includes(searchTerm));

        const matchesStatus = leadStatusFilter === 'all' || lead.status === leadStatusFilter;

        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                        {viewMode === 'leads' ? 'Leads' : 'Clients'}
                    </h1>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                        {viewMode === 'leads' ? filteredLeads.length : filteredClients.length}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {viewMode === 'leads' ? (
                        <Button onClick={() => setIsCreateLeadModalOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            New Lead
                        </Button>
                    ) : (
                        <Button onClick={() => setIsCreateClientModalOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            New Client
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div className="relative flex-1 max-w-md w-full">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                        placeholder={viewMode === 'leads' ? "Search leads..." : "Search clients..."}
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* View Toggles */}
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => setViewMode('active')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === 'active' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Active Clients
                    </button>
                    <button
                        onClick={() => setViewMode('leads')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === 'leads' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Leads
                        {openLeadsCount > 0 && (
                            <span className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${hasStaleLeads
                                ? 'bg-red-100 text-red-700 animate-pulse'
                                : 'bg-indigo-100 text-indigo-700'
                                }`}>
                                {openLeadsCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setViewMode('trash')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === 'trash' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Trash2 className="h-3 w-3" />
                        Trash
                    </button>
                </div>
            </div>

            {/* Extra Filters for Leads */}
            {viewMode === 'leads' && (
                <div className="flex flex-wrap gap-2 items-center w-full">
                    {['all', 'new', 'contacted', 'qualified', 'converted'].map((status) => (
                        <button
                            key={status}
                            onClick={() => setLeadStatusFilter(status as LeadStatusType | 'all')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors capitalize ${leadStatusFilter === status ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                            {status}
                        </button>
                    ))}

                    <div className="flex-1" />

                    <button
                        onClick={() => setLeadStatusFilter('archived')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${leadStatusFilter === 'archived' ? 'bg-gray-100 border-gray-300 text-gray-800' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                    >
                        <Trash2 className="h-3 w-3" />
                        Archived
                    </button>
                </div>
            )}

            {/* CONTENT AREA */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <Spinner className="h-8 w-8" />
                </div>
            ) : (
                <>
                    {/* LEADS OVERLAY */}
                    {viewMode === 'leads' ? (
                        filteredLeads.length === 0 ? (
                            <Card className="flex min-h-[200px] flex-col items-center justify-center border-dashed p-8 text-center bg-gray-50/50">
                                <p className="text-sm text-gray-500">No leads found.</p>
                            </Card>
                        ) : (
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {filteredLeads.map((lead, index) => {
                                    const stale = isLeadStale(lead);
                                    return (
                                        <Link
                                            key={lead.id}
                                            href={`/admin/clients/leads/${lead.id}`}
                                            className="block"
                                        >
                                            <Card
                                                className={`flex flex-col justify-between p-5 hover:shadow-md transition-shadow animate-slide-in opacity-0 cursor-pointer ${stale ? 'border-l-4 border-l-red-500' : ''}`}
                                                style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'forwards' }}
                                            >
                                                <div>
                                                    <div className="flex items-start justify-between">
                                                        <h3 className="font-semibold text-gray-900 line-clamp-1">{lead.fullName}</h3>
                                                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${lead.status === 'new' ? 'bg-blue-50 text-blue-700 ring-blue-600/20' :
                                                            lead.status === 'converted' ? 'bg-green-50 text-green-700 ring-green-600/20' :
                                                                'bg-gray-50 text-gray-600 ring-gray-500/10'
                                                            }`}>
                                                            {lead.status}
                                                        </span>
                                                    </div>

                                                    {stale && (
                                                        <div className="mt-2 text-xs font-bold text-red-600 flex items-center gap-1">
                                                            <span>⚠️ Action Required (48h+)</span>
                                                        </div>
                                                    )}

                                                    <div className="mt-2 text-sm text-gray-500">
                                                        {lead.email}
                                                    </div>
                                                    <div className="text-xs text-gray-400 mt-4">
                                                        Created: {lead.createdAt?.toDate ? lead.createdAt.toDate().toLocaleDateString() : 'Just now'}
                                                    </div>
                                                </div>
                                            </Card>
                                        </Link>
                                    )
                                })}
                            </div>
                        )
                    ) : (
                        /* CLIENTS LIST */
                        <ClientList
                            clients={filteredClients}
                            onEdit={handleEditClientClick}
                            onDelete={handleDeleteClientClick}
                            onRestore={handleRestoreClientClick}
                            isTrash={viewMode === 'trash'}
                        />
                    )}
                </>
            )}

            {/* MODALS */}
            <Modal
                isOpen={isCreateClientModalOpen}
                onClose={() => setIsCreateClientModalOpen(false)}
                title="Create New Client"
            >
                <ClientForm
                    onSubmit={handleCreateClient}
                    onCancel={() => setIsCreateClientModalOpen(false)}
                    isLoading={isSubmitting}
                />
            </Modal>

            <Modal
                isOpen={isEditClientModalOpen}
                onClose={() => setIsEditClientModalOpen(false)}
                title="Edit Client"
            >
                <ClientForm
                    initialData={editingClient || undefined}
                    onSubmit={handleUpdateClient}
                    onCancel={() => setIsEditClientModalOpen(false)}
                    isLoading={isSubmitting}
                />
            </Modal>

            <Modal
                isOpen={isCreateLeadModalOpen}
                onClose={() => setIsCreateLeadModalOpen(false)}
                title="Add New Lead"
            >
                <LeadForm
                    initialData={{ status: 'new' }}
                    onSubmit={handleCreateLead}
                    onCancel={() => setIsCreateLeadModalOpen(false)}
                    isLoading={isSubmitting}
                />
            </Modal>

            {/* Global Dialog */}
            <Dialog
                isOpen={dialogState.isOpen}
                onClose={closeDialog}
                onConfirm={dialogState.onConfirm}
                type={dialogState.type}
                title={dialogState.title}
                message={dialogState.message}
            />
        </div>
    );
}
