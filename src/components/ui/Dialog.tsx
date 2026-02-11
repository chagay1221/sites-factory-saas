'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/utils';

export type DialogType = 'info' | 'success' | 'warning' | 'error' | 'confirm';

interface DialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm?: () => void | Promise<void>;
    title?: string;
    message: string;
    type?: DialogType;
    confirmText?: string;
    cancelText?: string;
}

const iconMap = {
    info: { Icon: Info, color: 'text-blue-500' },
    success: { Icon: CheckCircle, color: 'text-green-500' },
    warning: { Icon: AlertTriangle, color: 'text-yellow-500' },
    error: { Icon: AlertCircle, color: 'text-red-500' },
    confirm: { Icon: AlertTriangle, color: 'text-indigo-500' },
};

export const Dialog = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    type = 'info',
    confirmText = 'OK',
    cancelText = 'Cancel',
}: DialogProps) => {
    const { Icon, color } = iconMap[type];
    const isConfirmDialog = type === 'confirm';

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.body.style.overflow = 'hidden';
            window.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.body.style.overflow = 'unset';
            window.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose]);

    const [isLoading, setIsLoading] = useState(false);

    const handleConfirm = async () => {
        if (onConfirm) {
            setIsLoading(true);
            try {
                await onConfirm();
            } catch (error) {
                console.error('Dialog confirm handler error:', error);
            } finally {
                // Always close the dialog and reset loading state
                setIsLoading(false);
                onClose();
            }
        } else {
            onClose();
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-md rounded-lg bg-white shadow-xl animate-in zoom-in-95 slide-in-from-bottom-5 duration-300">
                <div className="p-6 space-y-4">
                    {/* Icon + Title */}
                    <div className="flex items-start gap-3">
                        <div className={cn('flex-shrink-0', color)}>
                            <Icon className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                            {title && <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>}
                            <p className="text-sm text-gray-600 whitespace-pre-wrap">{message}</p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-2">
                        {isConfirmDialog && (
                            <Button variant="outline" onClick={onClose}>
                                {cancelText}
                            </Button>
                        )}
                        <Button
                            variant={type === 'error' || type === 'warning' ? 'primary' : 'primary'}
                            onClick={handleConfirm}
                            disabled={isLoading}
                            className={cn(
                                type === 'error' && 'bg-red-600 hover:bg-red-700',
                                type === 'warning' && 'bg-yellow-600 hover:bg-yellow-700'
                            )}
                        >
                            {isLoading ? 'Please wait...' : confirmText}
                        </Button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
