'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LogOut, Activity, Users, FileText, Timer } from 'lucide-react';
import { getDashboardStats } from '@/data/projects';
import { getOpenLeadsCount } from '@/data/leads';
import { scanAndFixClientNumbers } from '@/data/clients';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/ui/Toast';

export default function DashboardPage() {
    const { user, logout } = useAuth();
    const [stats, setStats] = useState({
        building: 0,
        deploy: 0,
        fixes: 0,
        avgActiveDays: 0,
        openLeads: 0
    });
    const [loading, setLoading] = useState(true);
    const [isFixing, setIsFixing] = useState(false);
    const toast = useToast();

    const handleLogout = async () => {
        await logout();
    };

    useEffect(() => {
        const loadStats = async () => {
            try {
                const [projectStats, leadsCount] = await Promise.all([
                    getDashboardStats(),
                    getOpenLeadsCount()
                ]);
                setStats({ ...projectStats, openLeads: leadsCount });
            } catch (error) {
                console.error("Failed to load dashboard stats", error);
            } finally {
                setLoading(false);
            }
        };
        loadStats();
    }, []);

    const handleFixClientNumbers = async () => {
        setIsFixing(true);
        try {
            const result = await scanAndFixClientNumbers();
            toast.success(`Scanned ${result.scanned} clients. Fixed ${result.fixed} missing IDs.`);
        } catch (error) {
            console.error(error);
            toast.error("Failed to fix client numbers.");
        } finally {
            setIsFixing(false);
        }
    };

    const statCards = [
        { label: 'Open Leads', value: stats.openLeads, icon: Users, description: 'New & In Progress' },
        { label: 'Building Phase', value: stats.building, icon: Activity, description: 'Projects in development' },
        { label: 'Ready to Deploy', value: stats.deploy, icon: Timer, description: 'Awating launch' },
        { label: 'In Fixes', value: stats.fixes, icon: FileText, description: 'Post-launch adjustments' },
    ];

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">Dashboard</h1>
                    <p className="text-sm text-gray-500">Welcome back, {user?.email}</p>
                </div>
                <Button variant="outline" onClick={handleLogout} className="w-full sm:w-auto">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {statCards.map((stat) => (
                    <Card key={stat.label} className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                                <div className="mt-2 text-3xl font-bold text-gray-900">
                                    {loading ? '...' : stat.value}
                                </div>
                            </div>
                            <div className="rounded-full bg-indigo-50 p-3">
                                <stat.icon className="h-5 w-5 text-indigo-600" />
                            </div>
                        </div>
                        <div className="mt-4 text-xs text-gray-500">
                            {stat.description}
                        </div>
                    </Card>
                ))}
            </div>

            <Card className="p-8 text-center text-gray-500 border-dashed">
                <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
                <p className="mt-1">Activity feed coming soon.</p>
            </Card>

            <div className="flex justify-end">
                <Button
                    variant="outline"
                    onClick={handleFixClientNumbers}
                    isLoading={isFixing}
                    className="text-xs text-gray-500"
                >
                    Run Migration: Fix Missing Client IDs
                </Button>
            </div>

            <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
        </div>
    );
}
