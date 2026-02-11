'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
    id: string;
    type: ToastType;
    message: string;
    onClose: () => void;
    duration?: number;
}

const iconMap = {
    success: { Icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50', border: 'border-green-200' },
    error: { Icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200' },
    info: { Icon: Info, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200' },
    warning: { Icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-50', border: 'border-yellow-200' },
};

export const Toast = ({ type, message, onClose, duration = 3000 }: ToastProps) => {
    const { Icon, color, bg, border } = iconMap[type];

    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, onClose]);

    return (
        <div
            className={cn(
                'flex items-start gap-3 p-4 rounded-lg shadow-lg border pointer-events-auto animate-in slide-in-from-right-5 fade-in duration-300',
                bg,
                border
            )}
        >
            <Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', color)} />
            <p className="text-sm font-medium text-gray-900 flex-1">{message}</p>
            <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    );
};

interface ToastContainerProps {
    toasts: Array<{ id: string; type: ToastType; message: string }>;
    onRemove: (id: string) => void;
}

export const ToastContainer = ({ toasts, onRemove }: ToastContainerProps) => {
    if (toasts.length === 0) return null;

    return createPortal(
        <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
            {toasts.map((toast) => (
                <Toast
                    key={toast.id}
                    id={toast.id}
                    type={toast.type}
                    message={toast.message}
                    onClose={() => onRemove(toast.id)}
                />
            ))}
        </div>,
        document.body
    );
};
