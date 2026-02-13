'use client';

import React, { useEffect, useState } from 'react';
import { Invoice, InvoiceInput } from '@/schemas/invoice';
import { listInvoices, createInvoiceManual, sendInvoiceNow, updateInvoice, markInvoiceAsPaid } from '@/data/invoices';
import { Client } from '@/types/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/hooks/useToast';
import { Plus, Send, FileText, AlertCircle, CheckCircle, Clock, Edit } from 'lucide-react';
import { getClient } from '@/data/clients';

interface ClientInvoicesProps {
    clientId: string;
}

export const ClientInvoices = ({ clientId }: ClientInvoicesProps) => {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [sendingId, setSendingId] = useState<string | null>(null);
    const [client, setClient] = useState<Client | null>(null);
    const toast = useToast();

    // Create Invoice Form State
    const [amount, setAmount] = useState<number>(0);
    const [currency, setCurrency] = useState('USD');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Edit Invoice State
    const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
    const [editDueDate, setEditDueDate] = useState<string>('');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const fetchInvoices = async () => {
        setLoading(true);
        try {
            const data = await listInvoices(clientId);
            setInvoices(data);
        } catch (error) {
            console.error("Failed to fetch invoices", error);
            toast.error("Failed to load invoices");
        } finally {
            setLoading(false);
        }
    };

    const fetchClient = async () => {
        const c = await getClient(clientId);
        setClient(c);
        if (c?.billing?.currency) setCurrency(c.billing.currency);
        if (c?.billing?.amount) setAmount(c.billing.amount);
    };

    useEffect(() => {
        fetchInvoices();
        fetchClient();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clientId]);

    const handleCreateInvoice = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!client) return;
        setIsSubmitting(true);
        try {
            const input: InvoiceInput = {
                clientId,
                clientName: client.fullName,
                amount,
                currency,
                description: description || 'Manual Service Charge',
                source: 'manual',
                sendPolicy: client.billing?.sending?.autoSendInvoices ? 'auto' : 'manual', // Default to client setting
                provider: 'mock',
                status: 'pending'
            };

            await createInvoiceManual(input, client);
            toast.success("Invoice created");
            setIsCreateModalOpen(false);
            fetchInvoices();
            // Reset form
            setDescription('');
        } catch (error: any) {
            console.error("Failed to create invoice", error);
            toast.error(error.message || "Failed to create invoice");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSendInvoice = async (invoice: Invoice) => {
        if (sendingId) return;
        setSendingId(invoice.id);
        try {
            await sendInvoiceNow(invoice.id);
            toast.success("Invoice sent successfully");
            fetchInvoices();
        } catch (error: any) {
            console.error("Failed to send invoice", error);
            toast.error(`Failed to send: ${error.message}`);
        } finally {
            setSendingId(null);
        }
    };

    const handleEditInvoice = (invoice: Invoice) => {
        setEditingInvoice(invoice);
        // Format date for input: 'YYYY-MM-DD'
        let dateStr = '';
        if (invoice.dueDate) {
            const d = invoice.dueDate.toDate ? invoice.dueDate.toDate() : new Date(invoice.dueDate);
            dateStr = d.toISOString().split('T')[0];
        } else {
            // Default to today + 14
            const d = new Date();
            d.setDate(d.getDate() + 14);
            dateStr = d.toISOString().split('T')[0];
        }
        setEditDueDate(dateStr);
        setIsEditModalOpen(true);
    };

    const handleSaveInvoiceEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingInvoice) return;
        setIsSubmitting(true);
        try {
            await updateInvoice(editingInvoice.id, {
                dueDate: new Date(editDueDate)
            });
            toast.success("Invoice updated");
            setIsEditModalOpen(false);
            setEditingInvoice(null);
            fetchInvoices();
        } catch (error: any) {
            console.error("Failed to update invoice", error);
            toast.error("Failed to update invoice");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleMarkAsPaid = async (invoice: Invoice) => {
        if (invoice.status === 'paid') return;
        try {
            await markInvoiceAsPaid(invoice.id);
            toast.success("Invoice marked as paid");
            fetchInvoices();
        } catch (error) {
            console.error("Failed to mark as paid", error);
            toast.error("Failed to update invoice");
        }
    };

    const StatusBadge = ({ status, deliveryStatus }: { status?: string, deliveryStatus: string }) => {
        if (deliveryStatus === 'sent') {
            return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" /> Sent</span>;
        }
        if (deliveryStatus === 'failed') {
            return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800"><AlertCircle className="w-3 h-3 mr-1" /> Failed</span>;
        }
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"><Clock className="w-3 h-3 mr-1" /> Pending</span>;
    };

    return (
        <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Invoices</h3>
                <Button variant="outline" size="sm" onClick={() => setIsCreateModalOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Create Invoice
                </Button>
            </div>

            {loading ? (
                <div className="text-center py-4 text-gray-500 text-sm">Loading invoices...</div>
            ) : invoices.length === 0 ? (
                <div className="text-center py-8 border border-dashed rounded-lg bg-gray-50 text-gray-500 text-sm">
                    No invoices found.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Number</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {invoices.map((inv) => (
                                <tr key={inv.id}>
                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600">
                                        {inv.createdAt?.toDate ? inv.createdAt.toDate().toLocaleDateString() : 'Just now'}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {inv.invoiceNumber || 'Draft'}
                                        {inv.source === 'scheduled' && <span className="ml-2 text-xs text-gray-400">(Auto)</span>}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600">
                                        {inv.amount} {inv.currency}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap">
                                        <div
                                            className={`flex items-center cursor-pointer hover:opacity-80 transition-opacity ${inv.status === 'paid' ? 'cursor-default' : ''}`}
                                            onClick={() => inv.status !== 'paid' && handleMarkAsPaid(inv)}
                                            title={inv.status !== 'paid' ? "Click to mark as Paid" : ""}
                                        >
                                            {/* Overdue Dot */}
                                            {inv.status === 'overdue' && (
                                                <div className="w-2 h-2 rounded-full bg-orange-500 mr-2" title="Overdue"></div>
                                            )}

                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium 
                                                ${inv.status === 'paid' ? 'bg-green-100 text-green-800' :
                                                    inv.status === 'overdue' ? 'bg-orange-100 text-orange-800' :
                                                        'bg-yellow-100 text-yellow-800'}`}>
                                                {inv.status === 'paid' ? <CheckCircle className="w-3 h-3 mr-1" /> :
                                                    inv.status === 'overdue' ? <AlertCircle className="w-3 h-3 mr-1" /> :
                                                        <Clock className="w-3 h-3 mr-1" />}
                                                {inv.status ? inv.status.charAt(0).toUpperCase() + inv.status.slice(1) : 'Pending'}
                                            </span>
                                        </div>

                                        {/* Delivery Status (Small) */}
                                        <div className="mt-1 text-[10px] text-gray-400 flex items-center">
                                            {inv.deliveryStatus === 'sent' && <span className="text-green-600 flex items-center"><Send className="w-2 h-2 mr-1" /> Emailed</span>}
                                            {inv.deliveryStatus === 'failed' && <span className="text-red-500 flex items-center" title={inv.lastSendError}><AlertCircle className="w-2 h-2 mr-1" /> Failed</span>}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex justify-end gap-2">
                                            {/* Edit Button */}
                                            <button
                                                onClick={() => handleEditInvoice(inv)}
                                                className="text-gray-500 hover:text-gray-900"
                                                title="Edit Due Date"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </button>

                                            {inv.pdfUrl && (
                                                <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600" title="View PDF">
                                                    <FileText className="h-4 w-4" />
                                                </a>
                                            )}
                                            {inv.deliveryStatus !== 'sent' && (
                                                <button
                                                    onClick={() => handleSendInvoice(inv)}
                                                    disabled={sendingId === inv.id}
                                                    className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                                                    title="Send Email"
                                                >
                                                    <Send className={`h-4 w-4 ${sendingId === inv.id ? 'animate-pulse' : ''}`} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title="Create Manual Invoice"
            >
                <form onSubmit={handleCreateInvoice} className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-gray-700">Amount</label>
                        <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value))} required />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700">Currency</label>
                        <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
                            <option value="USD">USD</option>
                            <option value="ILS">ILS</option>
                            <option value="EUR">EUR</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700">Description</label>
                        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Consulting Services" />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
                        <Button type="submit" isLoading={isSubmitting}>Create Invoice</Button>
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                title="Edit Invoice"
            >
                <form onSubmit={handleSaveInvoiceEdit} className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-gray-700">Due Date</label>
                        <Input
                            type="date"
                            value={editDueDate}
                            onChange={(e) => setEditDueDate(e.target.value)}
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Set a past date to test "Overdue" status logic.
                        </p>
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
                        <Button type="submit" isLoading={isSubmitting}>Save Changes</Button>
                    </div>
                </form>
            </Modal>
        </Card>
    );
};
