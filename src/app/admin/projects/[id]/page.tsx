'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { projectService } from '@/services/projectService';
import { Project } from '@/types/project';
import { ProjectForm } from '@/components/projects/ProjectForm';
import { Spinner } from '@/components/ui/Spinner';
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
    const router = useRouter();

    useEffect(() => {
        const load = async () => {
            const data = await projectService.getProject(projectId);
            if (!data) {
                // Handle 404
                router.push('/admin/projects');
                return;
            }
            setProject(data);
            setLoading(false);
        };
        load();
    }, [projectId, router]);

    const handleUpdate = async (data: any) => {
        setIsSaving(true);
        try {
            await projectService.updateProject(projectId, data);
            router.push('/admin/projects'); // Go back to board after save
        } catch (error) {
            console.error("Failed to update project", error);
            alert("Failed to update project");
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this project? This cannot be undone.")) return;

        try {
            await projectService.deleteProject(projectId);
            router.push('/admin/projects');
        } catch (error) {
            console.error("Failed to delete project", error);
            alert("Failed to delete project");
        }
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
        </div>
    );
}
