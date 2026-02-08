'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { BottomNav } from '@/components/layout/BottomNav';
import { Spinner } from '@/components/ui/Spinner';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Spinner className="h-8 w-8 text-black" />
            </div>
        );
    }

    if (!user) {
        return null; // Will redirect
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
            {/* Top Header */}
            <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/80 backdrop-blur-md">
                <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-black"></div>
                        <span className="text-lg font-bold tracking-tight text-gray-900">Sites Factory</span>
                    </div>
                    {/* User Email (Optional in header, can be in dashboard) */}
                    <div className="hidden text-sm text-gray-500 md:block">{user.email}</div>
                </div>
            </header>

            <main className="mx-auto max-w-5xl p-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>

            <BottomNav />
        </div>
    );
}
