'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Site } from '@/schemas/site';
import { TakeoverMode } from '@/data/sites';

interface UnarchiveSiteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (mode: TakeoverMode) => Promise<void>;
    site: Site | null;
    conflictingSiteId?: string;
    conflictingClientName?: string;
    isLoading?: boolean;
}

export const UnarchiveSiteModal = ({ isOpen, onClose, onConfirm, site, conflictingClientName, isLoading }: UnarchiveSiteModalProps) => {
    const [mode, setMode] = useState<TakeoverMode>('pause');

    if (!site) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Domain Conflict"
        >
            <div className="space-y-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 text-sm text-yellow-800">
                    <p className="font-semibold mb-1">Domain is already in use!</p>
                    <p>
                        The domain <strong>{site.domain}</strong> is already used by another active site
                        {conflictingClientName ? <span> belonging to <strong>{conflictingClientName}</strong></span> : '.'}
                        To restore <strong>{site.label || 'this site'}</strong>, you must decide what to do with the other site.
                    </p>
                </div>

                <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-900">Takeover Action</label>
                    <div className="grid gap-3">
                        <div
                            className={`border rounded-lg p-3 cursor-pointer transition-colors relative flex items-start gap-3 ${mode === 'pause' ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-gray-200 hover:border-gray-300'}`}
                            onClick={() => setMode('pause')}
                        >
                            <input
                                type="radio"
                                name="takeover"
                                checked={mode === 'pause'}
                                onChange={() => setMode('pause')}
                                className="mt-1 h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                            />
                            <div>
                                <div className="font-medium text-sm text-gray-900">Pause other site & restore this one</div>
                                <div className="text-xs text-gray-500 mt-1">
                                    The other site will be paused and stripped of its domain. This site will become Draft and claim the domain.
                                </div>
                            </div>
                        </div>

                        <div
                            className={`border rounded-lg p-3 cursor-pointer transition-colors relative flex items-start gap-3 ${mode === 'archive' ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-gray-200 hover:border-gray-300'}`}
                            onClick={() => setMode('archive')}
                        >
                            <input
                                type="radio"
                                name="takeover"
                                checked={mode === 'archive'}
                                onChange={() => setMode('archive')}
                                className="mt-1 h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                            />
                            <div>
                                <div className="font-medium text-sm text-gray-900">Archive other site & restore this one</div>
                                <div className="text-xs text-gray-500 mt-1">
                                    The other site will be archived. This site will become Draft and claim the domain.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button variant="ghost" onClick={onClose} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button
                        onClick={() => onConfirm(mode)}
                        isLoading={isLoading}
                        variant="primary"
                    >
                        Confirm & Restore
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
