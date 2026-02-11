'use client';

import { useState, useCallback } from 'react';
import { ToastType } from '../components/ui/Toast';

interface ToastItem {
    id: string;
    type: ToastType;
    message: string;
}

export const useToast = () => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Math.random().toString(36).substring(7);
        setToasts((prev) => [...prev, { id, type, message }]);
    }, []);

    const success = useCallback((message: string) => {
        showToast(message, 'success');
    }, [showToast]);

    const error = useCallback((message: string) => {
        showToast(message, 'error');
    }, [showToast]);

    const info = useCallback((message: string) => {
        showToast(message, 'info');
    }, [showToast]);

    const warning = useCallback((message: string) => {
        showToast(message, 'warning');
    }, [showToast]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    return {
        toasts,
        success,
        error,
        info,
        warning,
        removeToast,
    };
};
