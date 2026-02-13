'use client';

import React from 'react';
import { Site } from '@/schemas/site';
import { ensureProtocol } from '@/utils/domain';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ExternalLink, Edit, Trash2, Globe, LayoutTemplate, Archive, Ban, Activity } from 'lucide-react';

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
                    className={`flex flex-col justify-between p-4 bg-white border rounded-lg shadow-sm transition-colors ${site.serviceStatus === 'suspended'
                            ? 'border-red-200 bg-red-50/30'
                            : 'border-gray-200 hover:border-indigo-300'
                        }`}
                >
                    <div className="mb-3">
                        {/* Header: Title & Main Status */}
                        <div className="flex items-center justify-between mb-2 gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                                {site.type === 'external' ? (
                                    <Globe className={`h-4 w-4 ${site.serviceStatus === 'suspended' ? 'text-red-400' : 'text-gray-400'}`} />
                                ) : (
                                    <LayoutTemplate className={`h-4 w-4 ${site.serviceStatus === 'suspended' ? 'text-red-400' : 'text-indigo-500'}`} />
                                )}
                                <span className="font-semibold text-gray-900 text-sm truncate" title={site.label || (site.type === 'external' ? 'External Site' : 'Managed Site')}>
                                    {site.label || (site.type === 'external' ? 'External Site' : 'Managed Site')}
                                </span>
                            </div>
                            <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${site.status === 'live' ? 'bg-green-50 text-green-700 border-green-200' :
                                site.status === 'paused' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                    'bg-gray-50 text-gray-600 border-gray-200'
                                }`}>
                                {site.status}
                            </span>
                        </div>

                        {/* Secondary Status Alerts */}
                        {(site.serviceStatus === 'suspended' || site.serviceStatus === 'grace') && (
                            <div className="flex flex-wrap gap-2 mb-3">
                                {site.serviceStatus === 'suspended' && (
                                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-100 text-red-800 border border-red-200 text-xs font-semibold w-full justify-center">
                                        <Ban className="h-3 w-3" /> SUSPENDED
                                    </div>
                                )}
                                {site.serviceStatus === 'grace' && (
                                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-orange-100 text-orange-800 border border-orange-200 text-xs font-semibold w-full justify-center">
                                        <Activity className="h-3 w-3" /> OVERDUE
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="text-xs text-gray-500 space-y-2">
                            {site.domain && (
                                <div className="flex items-start gap-2">
                                    <span className="font-medium text-gray-700 shrink-0">Domain:</span>
                                    <span className="break-all">{site.domain}</span>
                                </div>
                            )}

                            {site.type === 'external' && site.externalUrl && (
                                <div className="flex items-start gap-2">
                                    <span className="font-medium text-gray-700 shrink-0">Url:</span>
                                    <a href={ensureProtocol(site.externalUrl)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">
                                        {site.externalUrl}
                                    </a>
                                </div>
                            )}

                            {site.type === 'managed' && (
                                <>
                                    {site.templateKey && (
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-gray-700 shrink-0">Template:</span>
                                            <span className="capitalize">{site.templateKey}</span>
                                        </div>
                                    )}
                                    {(site.previewUrl || site.liveUrl) && (
                                        <div className="flex items-start gap-2">
                                            <span className="font-medium text-gray-700 shrink-0">{site.liveUrl ? 'Live:' : 'Preview:'}</span>
                                            <a
                                                href={ensureProtocol(site.liveUrl || site.previewUrl)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 hover:underline break-all"
                                            >
                                                {site.liveUrl || site.previewUrl}
                                            </a>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
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
