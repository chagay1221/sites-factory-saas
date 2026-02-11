'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { LeadForm } from '@/components/leads/LeadForm';
import { getLead, updateLead, convertLead } from '@/data/leads';
import { Lead, LeadInput } from '@/types/lead';
import { useDialog } from '@/hooks/useDialog';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/ui/Toast';
import { Dialog } from '@/components/ui/Dialog';
import { Modal } from '@/components/ui/Modal';

export default function LeadDetailsPage() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;

    const [lead, setLead] = useState<Lead | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isConverting, setIsConverting] = useState(false);
    const [showConversionModal, setShowConversionModal] = useState(false);
    const [conversionFormData, setConversionFormData] = useState<{
        fullName: string;
        email?: string;
        phone?: string;
        status: string;
        source?: string;
        notes?: string;
        createProject?: boolean;
        projectType?: string;
        projectStage?: string;
    } | null>(null);
    const { dialogState, confirm, closeDialog } = useDialog();
    const toast = useToast();

    useEffect(() => {
        const fetchLead = async () => {
            if (!id) return;
            try {
                const data = await getLead(id);
                if (!data) {
                    toast.error("Lead not found");
                    router.push('/admin/clients');
                    return;
                }
                setLead(data);
            } catch (error) {
                console.error("Failed to load lead", error);
            } finally {
                setLoading(false);
            }
        };
        fetchLead();
    }, [id, router]);

    const handleUpdateLead = async (data: unknown) => {
        if (!lead) return;
        setIsSaving(true);
        try {
            await updateLead(id, data as Partial<LeadInput>);
            toast.success("Lead updated successfully!");
            setTimeout(() => {
                router.push('/admin/clients?tab=leads');
            }, 500);
        } catch (error: any) {
            console.error("Failed to update lead", error);
            toast.error("Failed to update lead");
            setIsSaving(false);
        }
    };

    const handleConvertClick = () => {
        setConversionFormData({
            fullName: lead?.fullName || '',
            email: lead?.email || '',
            phone: lead?.phone || '',
            status: lead?.status || 'new',
            source: lead?.source || '',
            notes: lead?.notes || ''
        });
        setShowConversionModal(true);
    };

    const handleConfirmConversion = async () => {
        if (!lead || !conversionFormData) return;
        setIsConverting(true);

        try {
            const conversionOptions = {
                createProject: conversionFormData.createProject || false,
                clientData: {
                    fullName: conversionFormData.fullName,
                    email: conversionFormData.email,
                    phone: conversionFormData.phone,
                    status: conversionFormData.status,
                    notes: conversionFormData.notes
                },
                projectData: conversionFormData.createProject ? {
                    type: conversionFormData.projectType || 'external',
                    pipelineStage: conversionFormData.projectStage || 'waiting_materials'
                } : undefined
            };

            const result = await convertLead(lead.id, conversionOptions);

            setShowConversionModal(false);
            toast.success(`${conversionFormData.fullName} converted to client successfully!`);

            setTimeout(() => {
                router.push('/admin/clients');
            }, 1000);
        } catch (error: any) {
            console.error("Failed to convert lead", error);
            toast.error(error.message || "Failed to convert lead");
            setIsConverting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center  min-h-[400px]">
                <Spinner className="h-8 w-8" />
            </div>
        );
    }

    if (!lead) return null;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" className="p-0 h-8 w-8" onClick={() => router.push('/admin/clients/leads')}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">{lead.fullName}</h1>
                    <div className="text-sm text-gray-500 flex items-center gap-2">
                        Status: <span className="capitalize font-medium text-gray-900">{lead.status}</span>
                        {lead.status === 'converted' && <CheckCircle className="h-4 w-4 text-green-500" />}
                    </div>
                </div>

                <div className="ml-auto flex gap-2">
                    {lead.status !== 'converted' ? (
                        <Button
                            variant="primary"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                            onClick={handleConvertClick}
                            isLoading={isConverting}
                        >
                            Convert to Client
                        </Button>
                    ) : (
                        <div className="flex gap-2">
                            {lead.clientId && (
                                <Button variant="outline" onClick={() => router.push(`/admin/clients/${lead.clientId}`)}>
                                    View Client <ExternalLink className="ml-2 h-3 w-3" />
                                </Button>
                            )}
                            {lead.projectId && (
                                <Button variant="outline" onClick={() => router.push(`/admin/projects/${lead.projectId}`)}>
                                    View Project <ExternalLink className="ml-2 h-3 w-3" />
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {lead.status === 'converted' && (
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <CheckCircle className="h-5 w-5 text-blue-400" />
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-blue-700">
                                This lead has been converted to a client. Use the <strong>Client</strong> record as the main source of truth for contact details.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <Card className="p-6">
                        <LeadForm
                            initialData={lead}
                            onSubmit={handleUpdateLead}
                            onCancel={() => router.push('/admin/clients/leads')}
                            isLoading={isSaving}
                            submitLabel="Save Changes"
                        />
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="p-6">
                        <h3 className="font-semibold text-gray-900 mb-4">Lead Info</h3>
                        <dl className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <dt className="text-gray-500">Created</dt>
                                <dd className="text-gray-900">{lead.createdAt?.toDate ? lead.createdAt.toDate().toLocaleDateString() : 'Unknown'}</dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-gray-500">Source</dt>
                                <dd className="text-gray-900">{lead.source || 'Manual'}</dd>
                            </div>
                            {lead.convertedAt && (
                                <div className="flex justify-between border-t pt-2 mt-2">
                                    <dt className="text-gray-500">Converted</dt>
                                    <dd className="text-gray-900">{lead.convertedAt?.toDate ? lead.convertedAt.toDate().toLocaleDateString() : 'Unknown'}</dd>
                                </div>
                            )}
                        </dl>
                    </Card>
                </div>

                {/* Global Dialog */}
                <Dialog
                    isOpen={dialogState.isOpen}
                    onClose={closeDialog}
                    onConfirm={dialogState.onConfirm}
                    type={dialogState.type}
                    title={dialogState.title}
                    message={dialogState.message}
                />

                {/* Conversion Preview Modal */}
                <Modal
                    isOpen={showConversionModal}
                    onClose={() => setShowConversionModal(false)}
                    title="Convert to Client"
                >
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600 mb-4">
                            Review and update the client details. You can optionally create a project.
                        </p>

                        {conversionFormData && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Full Name <span className="text-red-500">*</span>
                                    </label>
                                    <Input
                                        value={conversionFormData.fullName}
                                        onChange={(e) => setConversionFormData({
                                            ...conversionFormData,
                                            fullName: e.target.value
                                        })}
                                        placeholder="Enter full name"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Email
                                        </label>
                                        <Input
                                            type="email"
                                            value={conversionFormData.email}
                                            onChange={(e) => setConversionFormData({
                                                ...conversionFormData,
                                                email: e.target.value
                                            })}
                                            placeholder="email@example.com"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Phone
                                        </label>
                                        <Input
                                            type="tel"
                                            value={conversionFormData.phone}
                                            onChange={(e) => setConversionFormData({
                                                ...conversionFormData,
                                                phone: e.target.value
                                            })}
                                            placeholder="Phone number"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Client Status
                                        </label>
                                        <select
                                            value={conversionFormData.status}
                                            onChange={(e) => setConversionFormData({
                                                ...conversionFormData,
                                                status: e.target.value
                                            })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="lead">Lead</option>
                                            <option value="active">Active</option>
                                            <option value="paused">Paused</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Notes
                                    </label>
                                    <textarea
                                        value={conversionFormData.notes}
                                        onChange={(e) => setConversionFormData({
                                            ...conversionFormData,
                                            notes: e.target.value
                                        })}
                                        placeholder="Add any notes..."
                                        rows={3}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                    />
                                </div>

                                {/* Project Creation Toggle */}
                                <div className="border-t pt-4 mt-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={conversionFormData.createProject || false}
                                            onChange={(e) => setConversionFormData({
                                                ...conversionFormData,
                                                createProject: e.target.checked
                                            })}
                                            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300"
                                        />
                                        <span className="text-sm font-semibold text-gray-900">Create Project Now?</span>
                                    </label>

                                    {conversionFormData.createProject && (
                                        <div className="mt-3 grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Project Type</label>
                                                <select
                                                    value={conversionFormData.projectType || 'external'}
                                                    onChange={(e) => setConversionFormData({
                                                        ...conversionFormData,
                                                        projectType: e.target.value
                                                    })}
                                                    className="w-full text-sm px-2 py-1.5 border border-gray-300 rounded"
                                                >
                                                    <option value="external">External</option>
                                                    <option value="managed">Managed</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Pipeline Stage</label>
                                                <select
                                                    value={conversionFormData.projectStage || 'waiting_materials'}
                                                    onChange={(e) => setConversionFormData({
                                                        ...conversionFormData,
                                                        projectStage: e.target.value
                                                    })}
                                                    className="w-full text-sm px-2 py-1.5 border border-gray-300 rounded"
                                                >
                                                    <option value="waiting_materials">Waiting Materials</option>
                                                    <option value="building">Building</option>
                                                    <option value="deploy">Deploy</option>
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3 pt-4">
                            <Button
                                variant="outline"
                                onClick={() => setShowConversionModal(false)}
                                className="flex-1"
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleConfirmConversion}
                                isLoading={isConverting}
                                className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                            >
                                {conversionFormData?.createProject ? 'Convert & Create Project' : 'Convert Only'}
                            </Button>
                        </div>
                    </div>
                </Modal>

                {/* Toast Notifications */}
                <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
            </div>
        </div>
    );
}
