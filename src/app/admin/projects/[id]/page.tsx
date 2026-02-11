'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { getProject, updateProject, deleteProject } from '@/data/projects';
import { Project, ProjectInput } from '@/types/project';
import { ProjectForm } from '@/components/projects/ProjectForm';
import { Spinner } from '@/components/ui/Spinner';
import { useDialog } from '@/hooks/useDialog';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';

export default function ProjectDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const projectId = resolvedParams.id;

    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { dialogState, confirm, closeDialog } = useDialog();
    const toast = useToast();
    const router = useRouter();

    useEffect(() => {
        const load = async () => {
            const data = await getProject(projectId);
            if (!data) {
                router.push('/admin/projects');
                return;
            }
            setProject(data);
            setLoading(false);
        };
        load();
    }, [projectId, router]);

    const handleUpdate = async (data: unknown) => {
        setIsSaving(true);
        try {
            await updateProject(projectId, data as Partial<ProjectInput>);
            toast.success("Project updated successfully!");
            router.push('/admin/projects'); // Go back to board after save
        } catch (error) {
            console.error("Failed to update project", error);
            toast.error("Failed to update project");
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        confirm("Are you sure you want to delete this project? This cannot be undone.", async () => {
            try {
                await deleteProject(projectId);
                router.push('/admin/projects');
            } catch (error) {
                console.error("Failed to delete project", error);
                toast.error("Failed to delete project");
            }
        });
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Spinner className="h-8 w-8" />
            </div>
        );
    }

    if (!project) return null;

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Link href="/admin/projects">
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="h-4 w-4 mr-1" />
                            Back
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-900">Edit Project</h1>
                </div>

                <Button variant="outline" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={handleDelete}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Project
                </Button>
            </div>

            <Card className="p-6">
                <ProjectForm
                    initialData={project}
                    onSubmit={handleUpdate}
                    onCancel={() => router.back()}
                    isLoading={isSaving}
                />
            </Card>

            <div className="text-xs text-gray-400 mt-8 pt-4 border-t border-gray-100 flex justify-between">
                <div>Created: {project.createdAt?.toDate?.()?.toLocaleString() || 'N/A'}</div>
                <div>Last Updated: {project.updatedAt?.toDate?.()?.toLocaleString() || 'N/A'}</div>
            </div>

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
