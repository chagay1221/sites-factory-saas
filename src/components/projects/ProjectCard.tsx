'use client';

import React from 'react';
import { Project } from '@/types/project';
import { Clock, MoreVertical, Edit as EditIcon, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface ProjectCardProps {
    project: Project;
    onStageChange: (id: string, newStage: string) => void;
    onDelete?: (id: string) => void;
}

const STAGE_LABELS: Record<string, string> = {
    lead: 'Lead',
    closed: 'Closed',
    waiting_materials: 'Waiting Materials',
    building: 'Building',
    deploy: 'Deploy',
    retainer: 'Retainer',
    fixes: 'Fixes'
};

const PRIORITY_COLORS: Record<string, string> = {
    low: 'bg-gray-100 text-gray-800',
    normal: 'bg-blue-100 text-blue-800',
    high: 'bg-red-100 text-red-800'
};

export const ProjectCard = ({ project, onStageChange, onDelete }: ProjectCardProps) => {
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const menuRef = React.useRef<HTMLDivElement>(null);

    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: project.id,
        data: { project }
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
        touchAction: 'none', // Prevent scrolling while dragging on touch devices
    };

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Calculate Age
    const getAge = () => {
        const start = project.startedAt?.toDate?.() || project.createdAt?.toDate?.() || new Date();
        const now = new Date();
        const diff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        return diff;
    };

    const age = getAge();

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsMenuOpen(false);
        if (onDelete) onDelete(project.id);
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className="bg-white p-3 rounded-md shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing group relative mb-3"
        >
            <div className="flex justify-between items-start mb-2">
                <div className="flex gap-2">
                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${PRIORITY_COLORS[project.priority] || PRIORITY_COLORS.normal}`}>
                        {project.priority}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${project.type === 'managed' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                        {project.type}
                    </span>
                </div>

                {/* Kebab Menu */}
                <div className="relative" ref={menuRef}>
                    <button
                        className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsMenuOpen(!isMenuOpen);
                        }}
                    >
                        <MoreVertical className="h-4 w-4" />
                    </button>

                    {isMenuOpen && (
                        <div className="absolute right-0 top-6 w-32 bg-white rounded-md shadow-lg border border-gray-100 z-10 py-1">
                            <Link
                                href={`/admin/projects/${project.id}`}
                                className="block px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <EditIcon className="h-3 w-3 mr-2" />
                                Edit
                            </Link>
                            <button
                                className="w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center"
                                onClick={handleDelete}
                            >
                                <Trash2 className="h-3 w-3 mr-2" />
                                Delete
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <Link href={`/admin/projects/${project.id}`} className="block group">
                <h4 className="font-semibold text-gray-900 group-hover:text-indigo-600 line-clamp-2 text-sm pr-4">
                    {project.title}
                </h4>
            </Link>

            <p className="text-xs text-gray-500 mt-1 mb-3">
                {project.clientName || 'Unknown Client'}
            </p>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center text-xs text-gray-400" title="Days active">
                    <Clock className="h-3 w-3 mr-1" />
                    {age}d
                </div>

                {/* Simple Stage Dropdown */}
                <select
                    className="text-xs border-none bg-gray-50 rounded px-1 py-0.5 max-w-[100px] truncate focus:ring-0 cursor-pointer hover:bg-gray-100"
                    value={project.pipelineStage}
                    onChange={(e) => onStageChange(project.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                >
                    {Object.entries(STAGE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                    ))}
                </select>
            </div>
        </div>
    );
};
