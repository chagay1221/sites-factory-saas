'use client';

import React, { useState, useEffect } from 'react';
import { Client } from '@/types/client';
import { ChangeRequest, ChangeRequestInput } from '@/schemas/changeRequest';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { createChangeRequest, getChangeRequestsForClient, deleteChangeRequest, updateChangeRequest } from '@/data/changeRequests';
import { Plus, Clock, CheckCircle, AlertCircle, Edit2, Trash2 } from 'lucide-react';

interface ClientChangeRequestsProps {
    client: Client;
    onRefresh?: () => void;
}

export const ClientChangeRequests = ({ client, onRefresh }: ClientChangeRequestsProps) => {
    const [requests, setRequests] = useState<ChangeRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    // Form State
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [billingType, setBillingType] = useState<'credit' | 'billable'>('credit');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadRequests();
    }, [client.id]);

    const loadRequests = async () => {
        setLoading(true);
        try {
            const data = await getChangeRequestsForClient(client.id);
            setRequests(data);
        } catch (err) {
            console.error("Failed to load requests", err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const input: ChangeRequestInput = {
                clientId: client.id,
                title: newTitle,
                description: newDesc,
                status: 'new',
                manualBillingType: billingType,
                // other fields optional
            };

            await createChangeRequest(input);
            setNewTitle('');
            setNewDesc('');
            setIsCreating(false);
            loadRequests(); // Refresh list
            if (onRefresh) onRefresh(); // Refresh parent (credits)
        } catch (err) {
            console.error("Failed to create request", err);
            alert("Error creating request");
        } finally {
            setSubmitting(false);
        }
    };

    const billing = client.billing?.schedule || {};
    const monthlyCredit = billing.monthlyChangeCredit || 1;
    const usedCredit = billing.currentMonthCreditUsed || 0;
    const remaining = Math.max(0, monthlyCredit - usedCredit);

    const handleDelete = async (req: ChangeRequest) => {
        if (!window.confirm("Are you sure you want to delete this request? If it used a credit, it will be refunded.")) return;

        try {
            await deleteChangeRequest(req.id);
            loadRequests();
            if (onRefresh) onRefresh();
        } catch (err) {
            console.error("Failed to delete", err);
            alert("Failed to delete request");
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingRequest) return;

        setSubmitting(true);
        try {
            const updateInput: Partial<ChangeRequestInput> = {
                title: editingRequest.title,
                description: editingRequest.description
            };

            await updateChangeRequest(editingRequest.id, updateInput);
            setEditingRequest(null);
            loadRequests();
        } catch (err) {
            console.error("Failed to update", err);
            alert("Failed to update request");
        } finally {
            setSubmitting(false);
        }
    };

    // Edit State
    const [editingRequest, setEditingRequest] = useState<ChangeRequest | null>(null);

    return (
        <div className="space-y-6">
            {/* Credit Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg border shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-500">Monthly Credits</p>
                        <p className="text-2xl font-bold">{monthlyCredit}</p>
                    </div>
                    <Clock className="h-8 w-8 text-blue-500 opacity-20" />
                </div>
                <div className="bg-white p-4 rounded-lg border shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-500">Used This Month</p>
                        <p className="text-2xl font-bold text-orange-600">{usedCredit}</p>
                    </div>
                    <AlertCircle className="h-8 w-8 text-orange-500 opacity-20" />
                </div>
                <div className="bg-white p-4 rounded-lg border shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-500">Remaining</p>
                        <p className={`text-2xl font-bold ${remaining > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                            {remaining}
                        </p>
                    </div>
                    <CheckCircle className={`h-8 w-8 opacity-20 ${remaining > 0 ? 'text-green-500' : 'text-gray-400'}`} />
                </div>
            </div>

            {/* Header & Action */}
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-900">Change Requests</h3>
                <Button onClick={() => setIsCreating(!isCreating)} size="sm">
                    {isCreating ? 'Cancel' : 'New Request'}
                </Button>
            </div>

            {/* Create Form */}
            {isCreating && (
                <form onSubmit={handleCreate} className="bg-gray-50 p-4 rounded-lg border space-y-4">
                    <h4 className="font-medium text-sm">New Change Request</h4>

                    {/* Billing Selection */}
                    <div className="flex flex-col gap-2 p-3 bg-white rounded border">
                        <span className="text-sm font-medium text-gray-700">Billing Type</span>
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                    type="radio"
                                    name="billingType"
                                    value="credit"
                                    checked={billingType === 'credit'}
                                    onChange={() => setBillingType('credit')}
                                    className="text-blue-600"
                                />
                                <span>Use Monthly Credit</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                    type="radio"
                                    name="billingType"
                                    value="billable"
                                    checked={billingType === 'billable'}
                                    onChange={() => setBillingType('billable')}
                                    className="text-orange-600"
                                />
                                <span>Bill Separately</span>
                            </label>
                        </div>

                        {billingType === 'credit' && remaining === 0 && (
                            <div className="flex items-center gap-2 text-xs text-orange-600 font-medium mt-1 animate-pulse">
                                <AlertCircle className="h-3 w-3" />
                                <span>Warning: Client has used all free changes for this month!</span>
                            </div>
                        )}

                        {remaining === 0 && billingType === 'credit' && (
                            <p className="text-xs text-gray-500">Creating this will exceed the monthly limit.</p>
                        )}
                    </div>

                    <div>
                        <Input
                            value={newTitle}
                            onChange={e => setNewTitle(e.target.value)}
                            placeholder="Request Title (e.g. Update Hero Image)"
                            required
                        />
                    </div>
                    <div>
                        <textarea
                            value={newDesc}
                            onChange={e => setNewDesc(e.target.value)}
                            placeholder="Detailed description..."
                            className="w-full rounded-md border border-gray-300 p-2 text-sm h-24"
                        />
                    </div>
                    <div className="flex justify-end">
                        <Button type="submit" isLoading={submitting}>
                            Create Request
                        </Button>
                    </div>
                </form>
            )}

            {/* Edit Modal / Form (Inline for simplicity or Modal?) Let's use inline overlay or just a conditional render if simple. 
               The user asked to SEE details too. Editing allows seeing details. 
            */}
            {editingRequest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <form onSubmit={handleUpdate} className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl space-y-4">
                        <h3 className="text-lg font-bold">Edit Request</h3>
                        <div>
                            <label className="text-sm font-medium">Title</label>
                            <Input
                                value={editingRequest.title}
                                onChange={e => setEditingRequest({ ...editingRequest, title: e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Description</label>
                            <textarea
                                value={editingRequest.description || ''}
                                onChange={e => setEditingRequest({ ...editingRequest, description: e.target.value })}
                                className="w-full rounded-md border border-gray-300 p-2 text-sm h-32"
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setEditingRequest(null)}>Cancel</Button>
                            <Button type="submit" isLoading={submitting}>Save Changes</Button>
                        </div>
                    </form>
                </div>
            )}

            {/* List */}
            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-gray-500">Loading requests...</div>
                ) : requests.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No change requests found.</div>
                ) : (
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-700 border-b">
                            <tr>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Title</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Billing</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {requests.map(req => (
                                <tr key={req.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        {req.createdAt?.toDate ? req.createdAt.toDate().toLocaleDateString() : 'N/A'}
                                    </td>
                                    <td className="px-4 py-3 font-medium text-gray-900">
                                        {req.title}
                                        {req.description && <p className="text-xs text-gray-500 truncate max-w-[200px]">{req.description}</p>}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium 
                                            ${req.status === 'done' ? 'bg-green-100 text-green-800' :
                                                req.status === 'new' ? 'bg-blue-100 text-blue-800' :
                                                    'bg-gray-100 text-gray-800'}`}>
                                            {req.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {req.usesMonthlyCredit ? (
                                            <span className="text-green-600 font-medium">Credit Used</span>
                                        ) : req.billedSeparately ? (
                                            <span className="text-orange-600 font-medium">Billable</span>
                                        ) : (
                                            <span className="text-gray-400">-</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right space-x-2">
                                        <button onClick={() => setEditingRequest(req)} className="text-gray-500 hover:text-blue-600 transition-colors">
                                            <Edit2 className="h-4 w-4" />
                                        </button>
                                        <button onClick={() => handleDelete(req)} className="text-gray-500 hover:text-red-600 transition-colors">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};
