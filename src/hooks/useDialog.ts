'use client';

import { useState, useCallback } from 'react';
import { DialogType } from '../components/ui/Dialog';

interface DialogState {
    isOpen: boolean;
    type: DialogType;
    title?: string;
    message: string;
    onConfirm?: () => void | Promise<void>;
}

export const useDialog = () => {
    const [dialogState, setDialogState] = useState<DialogState>({
        isOpen: false,
        type: 'info',
        message: '',
    });

    const showDialog = useCallback((
        message: string,
        type: DialogType = 'info',
        title?: string,
        onConfirm?: () => void
    ) => {
        setDialogState({
            isOpen: true,
            type,
            title,
            message,
            onConfirm,
        });
    }, []);

    const alert = useCallback((message: string, type: DialogType = 'info', title?: string) => {
        showDialog(message, type, title);
    }, [showDialog]);

    const confirm = useCallback((message: string, onConfirm: () => void, title?: string) => {
        showDialog(message, 'confirm', title, onConfirm);
    }, [showDialog]);

    const closeDialog = useCallback(() => {
        setDialogState(prev => ({ ...prev, isOpen: false }));
    }, []);

    return {
        dialogState,
        alert,
        confirm,
        closeDialog,
    };
};
