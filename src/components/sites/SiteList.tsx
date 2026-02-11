'use client';

import React from 'react';
import { Site } from '@/schemas/site';
import { ensureProtocol } from '@/utils/domain';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ExternalLink, Edit, Trash2, Globe, LayoutTemplate, Archive } from 'lucide-react';

interface SiteListProps {
    sites: Site[];
    onEdit: (site: Site) => void;
    onDelete: (id: string) => void;
    onArchive: (site: Site) => void;
}

export const SiteList = ({ sites, onEdit, onDelete, onArchive }: SiteListProps) => {
    if (sites.length === 0) {
        return (
            <div className="text-center py-6 border border-dashed rounded-lg bg-gray-50 text-gray-500 text-sm">
                No sites added yet.
            </div>
        );
    }

    return (
        <div className="grid gap-3 sm:grid-cols-2">
            {sites.map(site => (
                <div
                    key={site.id}
                    className="flex flex-col justify-between p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-indigo-300 transition-colors"
                >
                    <div className="mb-3">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                                {site.type === 'external' ? (
                                    <Globe className="h-4 w-4 text-gray-400" />
                                ) : (
                                    <LayoutTemplate className="h-4 w-4 text-indigo-500" />
                                )}
                                <span className="font-semibold text-gray-900 text-sm truncate">
                                    {site.label || (site.type === 'external' ? 'External Site' : 'Managed Site')}
                                </span>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${site.status === 'live' ? 'bg-green-50 text-green-700 border-green-200' :
                                site.status === 'paused' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                    'bg-gray-50 text-gray-600 border-gray-200'
                                }`}>
                                {site.status}
                            </span>
                        </div>

                        <div className="mt-2 text-xs text-gray-500 space-y-1">
                            {site.domain && (
                                <div className="truncate">
                                    <span className="font-medium text-gray-700">Domain: </span>
                                    {site.domain}
                                </div>
                            )}
                            {site.type === 'external' && site.externalUrl && (
                                <div className="truncate">
                                    <span className="font-medium text-gray-700">Refers to: </span>
                                    <a href={ensureProtocol(site.externalUrl)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                        {site.externalUrl}
                                    </a>
                                </div>
                            )}
                            {site.type === 'managed' && site.templateKey && (
                                <div className="truncate">
                                    <span className="font-medium text-gray-700">Template: </span>
                                    <span className="capitalize">{site.templateKey}</span>
                                </div>
                            )}
                            {site.type === 'managed' && (site.previewUrl || site.liveUrl) && (
                                <div className="truncate pt-1">
                                    <span className="font-medium text-gray-700">{site.liveUrl ? 'Live URL: ' : 'Preview URL: '}</span>
                                    <a
                                        href={ensureProtocol(site.liveUrl || site.previewUrl)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline"
                                    >
                                        {site.liveUrl || site.previewUrl}
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-50">
                        {(site.externalUrl || site.liveUrl || site.previewUrl) && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => window.open(ensureProtocol(site.externalUrl || site.liveUrl || site.previewUrl), '_blank')}
                                title="Open Site"
                            >
                                <ExternalLink className="h-3 w-3 mr-1" /> Open
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => onEdit(site)}
                            title="Edit"
                        >
                            <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className={`h-7 w-7 p-0 ${site.status === 'archived' ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                            onClick={() => onArchive(site)}
                            title={site.status === 'archived' ? "Restore Site" : "Archive"}
                        >
                            <Archive className="h-3 w-3" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200"
                            onClick={() => onDelete(site.id)}
                            title="Delete"
                        >
                            <Trash2 className="h-3 w-3" />
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    );
};
