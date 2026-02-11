'use client';

import React, { useEffect, useState } from 'react';
import { Project, ProjectInput } from '@/types/project';
import { listProjects, createProject, updateProject, deleteProject } from '@/data/projects';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { ProjectForm } from '@/components/projects/ProjectForm';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { Input } from '@/components/ui/Input';
import { Plus, Clock, ArrowUpDown, Search } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { DndContext, DragOverlay, useDroppable, DragEndEvent, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { createPortal } from 'react-dom';
import { useDialog } from '@/hooks/useDialog';
import { Dialog } from '@/components/ui/Dialog';

type SortOption = 'longest_waiting' | 'shortest_waiting' | 'urgency';

const COLUMNS: { id: string; label: string }[] = [
    { id: 'closed', label: 'Closed' },
    { id: 'waiting_materials', label: 'Waiting Materials' },
    { id: 'building', label: 'Building' },
    { id: 'deploy', label: 'Deploy' },
    { id: 'retainer', label: 'Retainer' },
    { id: 'fixes', label: 'Fixes' }
];

// Droppable Column Component
const KanbanColumn = ({
    column,
    projects,
    children,
    sortOption,
    onSortChange
}: {
    column: { id: string, label: string },
    projects: Project[],
    children: React.ReactNode,
    sortOption: SortOption,
    onSortChange: (option: SortOption) => void
}) => {
    const { setNodeRef, isOver } = useDroppable({
        id: column.id,
    });

    // Force re-render every minute for live time updates
    const [, setTick] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => setTick(t => t + 1), 60000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div
            ref={setNodeRef}
            className={`w-[280px] flex flex-col bg-gray-50/50 rounded-lg border h-full transition-colors ${isOver ? 'border-indigo-400 bg-indigo-50/30' : 'border-gray-200'}`}
        >
            {/* Column Header */}
            <div className="p-3 border-b border-gray-200/50 flex flex-col gap-2 bg-gray-100/50 rounded-t-lg">
                <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-sm text-gray-700">{column.label}</h3>
                    <span className="text-xs font-medium text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                        {projects.length}
                    </span>
                </div>

                {/* Column Sort Control */}
                <div className="flex items-center justify-between">
                    {projects.length > 0 && (
                        <div className="text-[10px] text-gray-400 flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            Longest: {(() => {
                                return (
                                    <span suppressHydrationWarning>
                                        {(() => {
                                            const oldest = projects.reduce((acc, p) => {
                                                const pTime = p.updatedAt?.toDate?.() || p.createdAt?.toDate?.() || new Date();
                                                const accTime = acc.updatedAt?.toDate?.() || acc.createdAt?.toDate?.() || new Date();
                                                return pTime < accTime ? p : acc;
                                            }, projects[0]);

                                            const lastUpdate = oldest.updatedAt?.toDate?.() || oldest.createdAt?.toDate?.() || new Date();
                                            const diffMs = new Date().getTime() - lastUpdate.getTime();
                                            const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                                            const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

                                            if (days === 0 && hours === 0) {
                                                if (minutes === 0) return 'Just now';
                                                return `${minutes}m`;
                                            }
                                            if (days === 0) return `${hours}h ${minutes}m`;
                                            return `${days}d ${hours}h`;
                                        })()}
                                    </span>
                                );
                            })()}
                        </div>
                    )}

                    <div className="flex items-center space-x-1 bg-white px-1.5 py-0.5 rounded border border-gray-200 shadow-sm ml-auto">
                        <ArrowUpDown className="h-3 w-3 text-gray-400" />
                        <select
                            value={sortOption}
                            onChange={(e) => onSortChange(e.target.value as SortOption)}
                            className="text-[10px] border-none focus:ring-0 p-0 text-gray-600 bg-transparent font-medium cursor-pointer w-[60px]"
                        >
                            <option value="longest_waiting">Waited</option>
                            <option value="shortest_waiting">Recent</option>
                            <option value="urgency">Urgency</option>
                        </select>
                    </div>
                </div>
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
    const { dialogState, alert, confirm, closeDialog } = useDialog();
    const [activeProject, setActiveProject] = useState<Project | null>(null);
    const [columnSorts, setColumnSorts] = useState<Record<string, SortOption>>({});
    const [searchTerm, setSearchTerm] = useState('');

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
        const data = await listProjects();

        // Map any legacy 'lead' projects to 'closed' for display
        const mappedData = data.map(p => ({
            ...p,
            pipelineStage: p.pipelineStage === 'lead' ? 'closed' : p.pipelineStage
        }));

        setProjects(mappedData);
        setLoading(false);
    };

    useEffect(() => {
        fetchProjects();

        // Auto-open modal if clientId is passed
        if (preselectedClientId) {
            setIsCreateModalOpen(true);
        }
    }, [preselectedClientId]);

    const handleCreateProject = async (data: unknown) => {
        setIsSubmitting(true);
        try {
            await createProject(data as ProjectInput);
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
        setProjects(prev => prev.map(p => p.id === id ? { ...p, pipelineStage: newStage as Project['pipelineStage'] } : p));

        try {
            await updateProject(id, { pipelineStage: newStage as Project['pipelineStage'] });
            // Re-fetch to get any server-side computed updates like startedAt
            await fetchProjects();
        } catch (error) {
            console.error("Failed to update project stage", error);
            // Revert
            fetchProjects();
        }
    };

    const handleDeleteProject = async (id: string) => {
        confirm("Are you sure you want to delete this project?", async () => {
            try {
                await deleteProject(id);
                await fetchProjects();
            } catch (error) {
                console.error(error);
                alert("Failed to delete project", 'error', 'Error');
            }
        });
    };

    const applySort = (projectsToSort: Project[], sortOption: SortOption) => {
        return [...projectsToSort].sort((a, b) => {
            if (sortOption === 'urgency') {
                const priorityMap = { high: 3, normal: 2, low: 1 };
                const pA = priorityMap[a.priority] || 0;
                const pB = priorityMap[b.priority] || 0;
                return pB - pA; // Descending priority
            }

            const timeA = a.updatedAt?.toDate?.() || a.createdAt?.toDate?.() || new Date();
            const timeB = b.updatedAt?.toDate?.() || b.createdAt?.toDate?.() || new Date();

            if (sortOption === 'longest_waiting') {
                return timeA.getTime() - timeB.getTime(); // Oldest first (smallest timestamp first)
            } else {
                return timeB.getTime() - timeA.getTime(); // Newest first (largest timestamp first)
            }
        });
    };

    const getColumnProjects = (columnId: string) => {
        const columnProjects = projects.filter(p => p.pipelineStage === columnId);

        // Apply search filter
        const filtered = searchTerm
            ? columnProjects.filter(project => {
                const titleMatch = project.title.toLowerCase().includes(searchTerm.toLowerCase());
                const clientMatch = project.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) || false;
                return titleMatch || clientMatch;
            })
            : columnProjects;

        return applySort(filtered, columnSorts[columnId] || 'longest_waiting');
    };

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        setActiveProject(active.data.current?.project);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

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
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">Projects Board</h1>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            type="text"
                            placeholder="Search by project or client..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 w-64"
                        />
                    </div>
                    <Button onClick={() => setIsCreateModalOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        New Project
                    </Button>
                </div>
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
                                    sortOption={columnSorts[column.id] || 'longest_waiting'}
                                    onSortChange={(option) => setColumnSorts(prev => ({ ...prev, [column.id]: option }))}
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
