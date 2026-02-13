'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button'; // Assuming we have Button
import { Tabs } from '@/components/ui/Tabs';
import { Spinner } from '@/components/ui/Spinner';
import { getOverdueInvoices } from '@/data/invoices';
import { listSuspendedSites } from '@/data/sites';
import { Invoice } from '@/schemas/invoice';
import { Site } from '@/schemas/site';
import { AlertCircle, CheckCircle, Clock, ExternalLink, ShieldAlert } from 'lucide-react';

export default function BillingDashboard() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [overdueInvoices, setOverdueInvoices] = useState<Invoice[]>([]);
    const [suspendedSites, setSuspendedSites] = useState<Site[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [invoices, sites] = await Promise.all([
                getOverdueInvoices(),
                listSuspendedSites()
            ]);
            setOverdueInvoices(invoices);
            setSuspendedSites(sites);
        } catch (error) {
            console.error("Failed to load billing data", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Spinner className="h-8 w-8 text-blue-500" />
            </div>
        );
    }

    const OverdueTab = () => (
        <Card className="p-0 overflow-hidden">
            {overdueInvoices.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3 opacity-20" />
                    <h3 className="text-lg font-medium text-gray-900">All caught up!</h3>
                    <p>No overdue invoices found.</p>
                </div>
            ) : (
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {overdueInvoices.map((inv) => (
                            <tr key={inv.id} className="hover:bg-red-50/10">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{inv.clientName}</div>
                                    <div className="text-xs text-gray-500">ID: {inv.clientId}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {inv.invoiceNumber || 'Draft'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                    {inv.amount} {inv.currency}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                                    {inv.dueDate?.toDate ? inv.dueDate.toDate().toLocaleDateString() : 'N/A'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => router.push(`/admin/clients/${inv.clientId}?tab=invoices`)}
                                    >
                                        Manage
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </Card>
    );

    const SuspendedTab = () => (
        <Card className="p-0 overflow-hidden">
            {suspendedSites.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3 opacity-20" />
                    <h3 className="text-lg font-medium text-gray-900">System Healthy</h3>
                    <p>No suspended sites.</p>
                </div>
            ) : (
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Domain</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Suspended On</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {suspendedSites.map((site) => (
                            <tr key={site.id} className="hover:bg-red-50/10">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <ShieldAlert className="h-4 w-4 text-red-500 mr-2" />
                                        <span className="text-sm font-medium text-gray-900">{site.domain || site.externalUrl || 'No Domain'}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <span className="font-mono text-xs">{site.clientId}</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {site.suspensionDate?.toDate ? site.suspensionDate.toDate().toLocaleDateString() : 'Unknown'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => router.push(`/admin/clients/${site.clientId}`)}
                                    >
                                        Go to Client
                                    </Button>
                                    {site.domain && (
                                        <a
                                            href={`https://${site.domain}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="ml-2 inline-flex items-center text-blue-600 hover:text-blue-800"
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                        </a>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </Card>
    );

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Billing & Status Dashboard</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-red-50 border border-red-100 p-4 rounded-lg flex items-center justify-between">
                    <div>
                        <p className="text-red-700 font-medium">Overdue Invoices</p>
                        <p className="text-3xl font-bold text-red-800">{overdueInvoices.length}</p>
                    </div>
                    <AlertCircle className="h-10 w-10 text-red-300" />
                </div>
                <div className="bg-orange-50 border border-orange-100 p-4 rounded-lg flex items-center justify-between">
                    <div>
                        <p className="text-orange-700 font-medium">Suspended Sites</p>
                        <p className="text-3xl font-bold text-orange-800">{suspendedSites.length}</p>
                    </div>
                    <ShieldAlert className="h-10 w-10 text-orange-300" />
                </div>
            </div>

            <Tabs
                defaultTab="overdue"
                tabs={[
                    { id: 'overdue', label: `Overdue Invoices (${overdueInvoices.length})`, content: <OverdueTab /> },
                    { id: 'suspended', label: `Suspended Sites (${suspendedSites.length})`, content: <SuspendedTab /> },
                ]}
            />
        </div>
    );
}
