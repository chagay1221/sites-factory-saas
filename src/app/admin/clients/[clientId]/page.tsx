'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Client, ClientInput } from '@/types/client';
import { getClient, updateClient, deleteClient } from '@/data/clients';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useDialog } from '@/hooks/useDialog';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/ui/Toast';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { ClientForm } from '@/components/clients/ClientForm';
import { ArrowLeft, Mail, Phone, Calendar, Trash2, Edit, Plus } from 'lucide-react';
import { Project } from '@/types/project';
import { listProjects } from '@/data/projects';
import { Site, SiteInput } from '@/schemas/site';
import { listSites, createSite, updateSite, deleteSite, archiveSite, ArchiveOptions } from '@/data/sites';
import { unarchiveSiteSafe, TakeoverMode } from '@/data/sites-unarchive';
import { SiteList } from '@/components/sites/SiteList';
import { SiteModal } from '@/components/sites/SiteModal';
import { ArchiveSiteModal } from '@/components/sites/ArchiveSiteModal';
import { UnarchiveSiteModal } from '@/components/sites/UnarchiveSiteModal';

export default function ClientDetailsPage({ params }: { params: Promise<{ clientId: string }> }) {
    const router = useRouter();
    const resolvedParams = use(params);
    const clientId = resolvedParams.clientId;

    const [client, setClient] = useState<Client | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingProjects, setLoadingProjects] = useState(true);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // Sites State
    const [sites, setSites] = useState<Site[]>([]);
    const [loadingSites, setLoadingSites] = useState(true);
    const [isSiteModalOpen, setIsSiteModalOpen] = useState(false);
    const [editingSite, setEditingSite] = useState<Site | null>(null);

    // Archive / Unarchive State
    const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
    const [siteToAction, setSiteToAction] = useState<Site | null>(null); // merged state for archive/unarchive
    const [isUnarchiveModalOpen, setIsUnarchiveModalOpen] = useState(false);
    const [conflictingSiteId, setConflictingSiteId] = useState<string | undefined>(undefined);
    const [conflictingClientName, setConflictingClientName] = useState<string | undefined>(undefined);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const { dialogState, confirm, closeDialog } = useDialog();
    const toast = useToast();

    const fetchClient = async () => {
        setLoading(true);
        const data = await getClient(clientId);
        setClient(data);
        setLoading(false);
    };

    const fetchProjects = async () => {
        setLoadingProjects(true);
        const data = await listProjects(clientId);
        setProjects(data);
        setLoadingProjects(false);
    };

    const fetchSites = async () => {
        setLoadingSites(true);
        const data = await listSites(clientId);
        setSites(data);
        setLoadingSites(false);
    };

    useEffect(() => {
        fetchClient();
        fetchProjects();
        fetchSites();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clientId]);

    const handleUpdateClient = async (data: unknown) => {
        setIsSubmitting(true);
        try {
            await updateClient(clientId, data as Partial<ClientInput>);
            await fetchClient();
            setIsEditModalOpen(false);
            toast.success("Client updated successfully!");
        } catch (error) {
            console.error("Failed to update client", error);
            toast.error("Failed to update client");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteClient = async () => {
        confirm("Are you sure you want to delete this client? This action cannot be undone.", async () => {
            setIsSubmitting(true);
            try {
                await deleteClient(clientId);
                router.push('/admin/clients');
            } catch (error) {
                console.error("Failed to delete client", error);
                toast.error("Failed to delete client");
                setIsSubmitting(false);
            }
        });
    };

    // Sites Handlers
    const handleSaveSite = async (data: SiteInput) => {
        setIsSubmitting(true);
        try {
            if (editingSite) {
                await updateSite(editingSite.id, data);
                toast.success("Site updated successfully");
            } else {
                await createSite(data);
                toast.success("Site created successfully");
            }
            await fetchSites();
            setIsSiteModalOpen(false);
            setEditingSite(null);
        } catch (error) {
            console.error("Failed to save site", error);
            const message = error instanceof Error ? error.message : "Unknown error";
            toast.error(`Failed to save site: ${message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteSite = async (siteId: string) => {
        confirm("Are you sure you want to delete this site?", async () => {
            try {
                await deleteSite(siteId);
                toast.success("Site deleted");
                fetchSites();
            } catch (error) {
                console.error("Failed to delete site", error);
                toast.error("Failed to delete site");
            }
        });
    };

    const openCreateSiteModal = () => {
        setEditingSite(null);
        setIsSiteModalOpen(true);
    };

    const openEditSiteModal = (site: Site) => {
        setEditingSite(site);
        setIsSiteModalOpen(true);
    };

    const handleSiteAction = async (site: Site) => {
        if (site.status === 'archived') {
            // Unarchive Flow
            try {
                setIsSubmitting(true);
                // Try to unarchive directly
                const result = await unarchiveSiteSafe(site.id);

                if (result.success) {
                    toast.success("Site unarchived successfully");
                    await fetchSites();
                } else if (result.conflict) {
                    setSiteToAction(site);
                    setConflictingSiteId(result.conflict.siteId);
                    setConflictingClientName(result.conflict.clientName);
                    setIsUnarchiveModalOpen(true);
                }
            } catch (error: any) {
                console.error("Unarchive error:", error);
                toast.error(`Failed to unarchive: ${error.message}`);
            } finally {
                setIsSubmitting(false);
            }
        } else {
            // Archive Flow
            setSiteToAction(site);
            setIsArchiveModalOpen(true);
        }
    };

    const handleConfirmArchive = async (siteId: string, options: ArchiveOptions) => {
        setIsSubmitting(true);
        try {
            const newSiteId = await archiveSite(siteId, options);

            if (options.recreate && newSiteId) {
                toast.success("Site recreated successfully");
                // Refresh list and open new site
                const updatedSites = await listSites(clientId);
                setSites(updatedSites);

                const newSite = updatedSites.find(s => s.id === newSiteId);
                if (newSite) {
                    setEditingSite(newSite);
                    setIsSiteModalOpen(true);
                }
            } else {
                toast.success("Site archived successfully");
                await fetchSites();
            }

            setIsArchiveModalOpen(false);
            setSiteToAction(null);
        } catch (error) {
            console.error("Failed to archive site", error);
            toast.error("Failed to archive site");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleConfirmUnarchive = async (mode: TakeoverMode) => {
        if (!siteToAction) return;
        setIsSubmitting(true);
        try {
            const result = await unarchiveSiteSafe(siteToAction.id, { takeoverMode: mode });
            if (result.success) {
                toast.success("Site restored with domain takeover");
                await fetchSites();
                setIsUnarchiveModalOpen(false);
                setSiteToAction(null);
                setConflictingSiteId(undefined);
                setConflictingClientName(undefined);
            } else {
                // Should not happen if takeoverMode is set, unless another error occurred
                toast.error("Failed to restore site: Unknown error");
            }
        } catch (error: any) {
            console.error("Failed to unarchive with takeover", error);
            toast.error(`Failed to restore site: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Spinner className="h-8 w-8" />
            </div>
        );
    }

    if (!client) {
        return (
            <div className="text-center py-12">
                <h2 className="text-lg font-semibold">Client not found</h2>
                <Button variant="ghost" onClick={() => router.push('/admin/clients')} className="mt-4">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {/* HMR Force Refresh */}
                    <Button variant="ghost" size="sm" onClick={() => router.push('/admin/clients')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-gray-900">{client.fullName}</h1>
                        <p className="text-sm text-gray-500">ID: {client.id}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsEditModalOpen(true)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                    </Button>
                    <Button variant="danger" onClick={handleDeleteClient} disabled={isSubmitting}>
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </Button>
                </div>
            </div>

            {/* Content */}
            <div className="grid gap-6 md:grid-cols-2">
                <Card className="p-6 space-y-4">
                    <h3 className="text-lg font-semibold">Contact & Info</h3>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between py-2 border-b border-gray-100">
                            <span className="text-sm font-medium text-gray-500">Status</span>
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${client.status === 'active' ? 'bg-green-100 text-green-800' :
                                client.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-blue-100 text-blue-800'
                                }`}>
                                {client.status.toUpperCase()}
                            </span>
                        </div>

                        <div className="flex items-center justify-between py-2 border-b border-gray-100">
                            <span className="text-sm font-medium text-gray-500">Pipeline Stage</span>
                            <span className="text-sm text-gray-900">{client.pipelineStage}</span>
                        </div>

                        {client.email && (
                            <div className="flex items-center gap-3 text-sm">
                                <Mail className="h-4 w-4 text-gray-400" />
                                <a href={`mailto:${client.email}`} className="text-blue-600 hover:underline">{client.email}</a>
                            </div>
                        )}

                        {client.phone && (
                            <div className="flex items-center gap-3 text-sm">
                                <Phone className="h-4 w-4 text-gray-400" />
                                <span className="text-gray-900">{client.phone}</span>
                            </div>
                        )}

                        <div className="flex items-center gap-3 text-sm text-gray-500 pt-2">
                            <Calendar className="h-4 w-4" />
                            <span>Added on {client.createdAt?.toDate ? client.createdAt.toDate().toLocaleDateString() : 'Unknown'}</span>
                        </div>
                    </div>
                </Card>

                <Card className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Projects</h3>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/admin/projects?clientId=${client.id}`)}
                        >
                            <Plus className="h-4 w-4 mr-1" />
                            New Project
                        </Button>
                    </div>

                    <div className="space-y-3">
                        {loadingProjects ? (
                            <div className="text-center py-4 text-gray-400 text-sm">Loading projects...</div>
                        ) : projects.length === 0 ? (
                            <div className="text-center py-6 border border-dashed rounded-lg bg-gray-50 text-gray-500 text-sm">
                                No projects yet.
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {projects.map(project => (
                                    <div
                                        key={project.id}
                                        className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-indigo-300 transition-colors cursor-pointer"
                                        onClick={() => router.push(`/admin/projects/${project.id}`)}
                                    >
                                        <div className="min-w-0">
                                            <div className="font-medium text-sm text-gray-900 truncate">{project.title}</div>
                                            <div className="text-xs text-gray-500">{project.pipelineStage} • {project.priority}</div>
                                        </div>
                                        <div className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${project.status === 'active' ? 'bg-green-100 text-green-800' :
                                            project.status === 'done' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                            {project.status}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </Card>

                <Card className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Sites</h3>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={openCreateSiteModal}
                        >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Site
                        </Button>
                    </div>

                    {loadingSites ? (
                        <div className="text-center py-4 text-gray-400 text-sm">Loading sites...</div>
                    ) : (
                        <SiteList
                            sites={sites}
                            onEdit={openEditSiteModal}
                            onDelete={handleDeleteSite}
                            onArchive={handleSiteAction}
                        />
                    )}
                </Card>

                <Card className="p-6 space-y-4">
                    <h3 className="text-lg font-semibold">Notes</h3>
                    <div className="rounded-md bg-gray-50 p-4 min-h-[150px] text-sm text-gray-700 whitespace-pre-wrap">
                        {client.notes || "No notes added."}
                    </div>
                </Card>
            </div>

            <Modal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                title="Edit Client"
            >
                <ClientForm
                    initialData={client}
                    onSubmit={handleUpdateClient}
                    onCancel={() => setIsEditModalOpen(false)}
                    isLoading={isSubmitting}
                />
            </Modal>

            <SiteModal
                isOpen={isSiteModalOpen}
                onClose={() => setIsSiteModalOpen(false)}
                onSubmit={handleSaveSite}
                initialData={editingSite}
                clientId={clientId}
                isLoading={isSubmitting}
            />

            <ArchiveSiteModal
                isOpen={isArchiveModalOpen}
                onClose={() => setIsArchiveModalOpen(false)}
                onArchive={handleConfirmArchive}
                site={siteToAction}
                isLoading={isSubmitting}
            />

            <UnarchiveSiteModal
                isOpen={isUnarchiveModalOpen}
                onClose={() => {
                    setIsUnarchiveModalOpen(false);
                    setSiteToAction(null);
                    setConflictingSiteId(undefined);
                    setConflictingClientName(undefined);
                }}
                onConfirm={handleConfirmUnarchive}
                site={siteToAction}
                conflictingSiteId={conflictingSiteId}
                conflictingClientName={conflictingClientName}
                isLoading={isSubmitting}
            />

            {/* Global Dialog */}
            <Dialog
                isOpen={dialogState.isOpen}
                onClose={closeDialog}
                onConfirm={dialogState.onConfirm}
                type={dialogState.type}
                title={dialogState.title}
                message={dialogState.message}
            />

            {/* Toast Notifications */}
            <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
        </div>
    );
}
