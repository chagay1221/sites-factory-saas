import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Spinner = ({ className }: { className?: string }) => {
    return <Loader2 className={cn('animate-spin text-gray-500', className)} />;
};
