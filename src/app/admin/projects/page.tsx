'use client';

import React, { useEffect, useState } from 'react';
import { Project } from '@/types/project';
import { projectService } from '@/services/projectService';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { ProjectForm } from '@/components/projects/ProjectForm';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { Plus } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { DndContext, DragOverlay, useDroppable, DragEndEvent, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { createPortal } from 'react-dom';

const COLUMNS: { id: string; label: string }[] = [
    { id: 'lead', label: 'Lead' },
    { id: 'closed', label: 'Closed' },
    { id: 'waiting_materials', label: 'Waiting Materials' },
    { id: 'building', label: 'Building' },
    { id: 'deploy', label: 'Deploy' },
    { id: 'retainer', label: 'Retainer' },
    { id: 'fixes', label: 'Fixes' }
];

// Droppable Column Component
const KanbanColumn = ({ column, projects, children }: { column: { id: string, label: string }, projects: Project[], children: React.ReactNode }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: column.id,
    });

    return (
        <div
            ref={setNodeRef}
            className={`w-[280px] flex flex-col bg-gray-50/50 rounded-lg border h-full transition-colors ${isOver ? 'border-indigo-400 bg-indigo-50/30' : 'border-gray-200'}`}
        >
            {/* Column Header */}
            <div className="p-3 border-b border-gray-200/50 flex justify-between items-center bg-gray-100/50 rounded-t-lg">
                <h3 className="font-semibold text-sm text-gray-700">{column.label}</h3>
                <span className="text-xs font-medium text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                    {projects.length}
                </span>
            </div>

            {/* Column Content */}
            <div className="p-2 flex-1 overflow-y-auto min-h-0 custom-scrollbar">
                {children}
                {projects.length === 0 && (
                    <div className="text-center text-xs text-gray-400 py-4 italic">
                        No projects
                    </div>
                )}
            </div>
        </div>
    );
};

export default function ProjectsPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeProject, setActiveProject] = useState<Project | null>(null);

    // Check for pre-selected client ID in URL
    const searchParams = useSearchParams();
    const preselectedClientId = searchParams.get('clientId') || undefined;

    const sensor = useSensor(PointerSensor, {
        activationConstraint: {
            distance: 8, // Requires 8px movement to start drag
        },
    });
    const sensors = useSensors(sensor);

    const fetchProjects = async () => {
        setLoading(true);
        const data = await projectService.getProjects();
        setProjects(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchProjects();

        // Auto-open modal if clientId is passed
        if (preselectedClientId) {
            setIsCreateModalOpen(true);
        }
    }, [preselectedClientId]);

    const handleCreateProject = async (data: any) => {
        setIsSubmitting(true);
        try {
            await projectService.createProject(data);
            await fetchProjects();
            setIsCreateModalOpen(false);
        } catch (error) {
            console.error("Failed to create project", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleStageChange = async (id: string, newStage: string) => {
        // Optimistic update
        setProjects(prev => prev.map(p => p.id === id ? { ...p, pipelineStage: newStage as any } : p));

        try {
            await projectService.updateProject(id, { pipelineStage: newStage as any });
            // Re-fetch to get any server-side computed updates like startedAt
            await fetchProjects();
        } catch (error) {
            console.error("Failed to update project stage", error);
            // Revert
            fetchProjects();
        }
    };

    const handleDeleteProject = async (id: string) => {
        if (!confirm("Are you sure you want to delete this project?")) return;
        try {
            await projectService.deleteProject(id);
            await fetchProjects();
        } catch (error) {
            console.error("Failed to delete project", error);
            alert("Failed to delete project");
        }
    };

    const getColumnProjects = (stage: string) => {
        return projects.filter(p => p.pipelineStage === stage);
    };

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        setActiveId(active.id as string);
        setActiveProject(active.data.current?.project);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        setActiveId(null);
        setActiveProject(null);

        if (!over) return;

        const projectId = active.id as string;
        const newStage = over.id as string;

        const currentProject = projects.find(p => p.id === projectId);
        if (currentProject && currentProject.pipelineStage !== newStage) {
            await handleStageChange(projectId, newStage);
        }
    };

    return (
        <div className="h-[calc(100vh-120px)] flex flex-col">
            <div className="flex justify-between items-center mb-4 px-1">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">Projects Board</h1>
                <Button onClick={() => setIsCreateModalOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Project
                </Button>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <Spinner className="h-8 w-8" />
                </div>
            ) : (
                <DndContext
                    sensors={sensors}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
                        <div className="flex h-full gap-4 min-w-max px-1">
                            {COLUMNS.map(column => (
                                <KanbanColumn
                                    key={column.id}
                                    column={column}
                                    projects={getColumnProjects(column.id)}
                                >
                                    {getColumnProjects(column.id).map(project => (
                                        <ProjectCard
                                            key={project.id}
                                            project={project}
                                            onStageChange={handleStageChange}
                                            onDelete={handleDeleteProject}
                                        />
                                    ))}
                                </KanbanColumn>
                            ))}
                        </div>
                    </div>

                    {createPortal(
                        <DragOverlay>
                            {activeProject ? (
                                <ProjectCard
                                    project={activeProject}
                                    onStageChange={() => { }}
                                    onDelete={() => { }}
                                />
                            ) : null}
                        </DragOverlay>,
                        document.body
                    )}
                </DndContext>
            )}

            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title="Create New Project"
            >
                <ProjectForm
                    onSubmit={handleCreateProject}
                    onCancel={() => setIsCreateModalOpen(false)}
                    isLoading={isSubmitting}
                    preselectedClientId={preselectedClientId}
                />
            </Modal>
        </div>
    );
}
