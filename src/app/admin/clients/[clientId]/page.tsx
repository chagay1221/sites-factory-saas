'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Client } from '@/types/client';
import { clientService } from '@/services/clientService';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { ClientForm } from '@/components/clients/ClientForm';
import { ArrowLeft, Mail, Phone, Calendar, Trash2, Edit, Plus } from 'lucide-react';
import { Project } from '@/types/project';
import { projectService } from '@/services/projectService';

// Correctly typing params for Next.js 15+ (params is a Promise)
export default function ClientDetailsPage({ params }: { params: Promise<{ clientId: string }> }) {
    const router = useRouter();
    const resolvedParams = use(params);
    const clientId = resolvedParams.clientId;

    const [client, setClient] = useState<Client | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingProjects, setLoadingProjects] = useState(true);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchClient = async () => {
        setLoading(true);
        const data = await clientService.getClient(clientId);
        setClient(data);
        setLoading(false);
    };

    const fetchProjects = async () => {
        setLoadingProjects(true);
        const data = await projectService.getProjects(clientId);
        setProjects(data);
        setLoadingProjects(false);
    };

    useEffect(() => {
        fetchClient();
        fetchProjects();
    }, [clientId]);

    const handleUpdateClient = async (data: any) => {
        setIsSubmitting(true);
        try {
            await clientService.updateClient(clientId, data);
            await fetchClient();
            setIsEditModalOpen(false);
        } catch (error) {
            console.error("Failed to update client", error);
            alert("Failed to update client");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteClient = async () => {
        if (!confirm("Are you sure you want to delete this client? This action cannot be undone.")) return;

        setIsSubmitting(true);
        try {
            await clientService.deleteClient(clientId);
            router.push('/admin/clients');
        } catch (error) {
            console.error("Failed to delete client", error);
            alert("Failed to delete client");
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
                    <h3 className="text-lg font-semibold">Notes</h3>
                    <div className="rounded-md bg-gray-50 p-4 min-h-[150px] text-sm text-gray-700 whitespace-pre-wrap">
                        {client.notes || "No notes added."}
                    </div>
                </Card>
            </div>

            {/* Edit Modal */}
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
        </div>
    );
}
