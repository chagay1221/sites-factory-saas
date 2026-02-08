'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
import { Factory } from 'lucide-react';

export default function FactoryPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Factory</h1>
            <Card className="flex min-h-[400px] flex-col items-center justify-center border-dashed p-8 text-center">
                <div className="rounded-full bg-gray-100 p-4">
                    <Factory className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">Factory is silent</h3>
                <p className="mt-2 text-sm text-gray-500 max-w-sm">
                    Build configurations and pipelines will appear here. This is the engine room.
                </p>
            </Card>
        </div>
    );
}
