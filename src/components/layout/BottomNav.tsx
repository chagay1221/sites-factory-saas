'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, FolderKanban, Factory, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
    { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { label: 'Clients', href: '/admin/clients', icon: Users },
    { label: 'Projects', href: '/admin/projects', icon: FolderKanban },
    { label: 'Factory', href: '/admin/factory', icon: Factory },
    { label: 'Billing', href: '/admin/billing', icon: CreditCard },
];

export const BottomNav = () => {
    const pathname = usePathname();

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white shadow-[0_-1px_3px_rgba(0,0,0,0.05)] md:static md:border-t-0 md:bg-transparent md:shadow-none">
            <div className="mx-auto flex h-16 max-w-md items-center justify-around px-4 md:h-auto md:max-w-none md:justify-start md:space-x-8 md:px-0">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'flex flex-col items-center justify-center space-y-1 text-xs font-medium md:flex-row md:space-x-2 md:space-y-0 md:text-sm md:bg-white md:px-4 md:py-2 md:rounded-full md:border md:border-gray-200 md:hover:bg-gray-50 md:transition-colors',
                                isActive
                                    ? 'text-black md:bg-black md:text-white md:border-black md:hover:bg-gray-900'
                                    : 'text-gray-500 hover:text-gray-900'
                            )}
                        >
                            <Icon className={cn('h-5 w-5', isActive ? 'md:text-white' : '')} />
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
};
