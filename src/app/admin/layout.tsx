'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { BottomNav } from '@/components/layout/BottomNav';
import { Spinner } from '@/components/ui/Spinner';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const ADMIN_UID = "5LKD1gmaNmZVgKOZPd5bpl5umMT2";

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

    // Admin Gate
    if (user.uid !== ADMIN_UID) {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-gray-50">
                <div className="max-w-md text-center">
                    <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
                    <p className="mt-2 text-gray-600">You do not have permission to view this area.</p>
                    <p className="text-xs text-gray-400 mt-4">UID: {user.uid}</p>
                </div>
            </div>
        );
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
