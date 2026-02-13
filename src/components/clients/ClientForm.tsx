'use client';

import React, { useState } from 'react';
import { ClientInput, ClientSchema, ClientBillingConfig, BillingScheduleSchema } from '@/types/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { z } from 'zod';
import { computeNextRunAt } from '@/billing/schedule'; // Updated import
import { Plus, Trash2, X, Check } from 'lucide-react';

interface ClientFormProps {
    initialData?: Partial<ClientInput>;
    onSubmit: (data: ClientInput) => Promise<void>;
    onCancel: () => void;
    isLoading?: boolean;
    submitLabel?: string;
}

interface StatusChangeModalProps {
    isOpen: boolean;
    oldStatus: string;
    newStatus: string;
    onConfirm: (options: { freeze: boolean; notify: boolean; retrieve: boolean }) => void;
    onCancel: () => void;
}

const StatusChangeModal = ({ isOpen, oldStatus, newStatus, onConfirm, onCancel }: StatusChangeModalProps) => {
    if (!isOpen) return null;

    const isPausing = newStatus === 'paused';
    const isActivating = newStatus === 'active';

    // State for checkboxes
    const [freeze, setFreeze] = useState(true);
    const [notify, setNotify] = useState(true);
    const [retrieve, setRetrieve] = useState(true);

    const handleConfirm = () => {
        onConfirm({ freeze: isPausing && freeze, notify, retrieve: isActivating && retrieve });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl space-y-4">
                <h3 className="text-lg font-bold text-gray-900">Confirm Status Change</h3>
                <p className="text-sm text-gray-600">
                    You are changing status from <span className="font-semibold">{oldStatus}</span> to <span className="font-semibold">{newStatus}</span>.
                </p>

                <div className="space-y-3 border-t border-b py-4">
                    {isPausing && (
                        <div className="flex items-center gap-3">
                            <input type="checkbox" checked={freeze} onChange={e => setFreeze(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                            <label className="text-sm font-medium text-gray-700">Freeze Client Domains</label>
                        </div>
                    )}

                    {isActivating && (
                        <div className="flex items-center gap-3">
                            <input type="checkbox" checked={retrieve} onChange={e => setRetrieve(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                            <label className="text-sm font-medium text-gray-700">Retrieve Domain Logic</label>
                        </div>
                    )}

                    <div className="flex items-center gap-3">
                        <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                        <label className="text-sm font-medium text-gray-700">Send Status Notification Email</label>
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={onCancel} type="button">Cancel</Button>
                    <Button onClick={handleConfirm} type="button" className={isPausing ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}>
                        Confirm Change
                    </Button>
                </div>
            </div>
        </div>
    );
};

export const ClientForm = ({ initialData, onSubmit, onCancel, isLoading, submitLabel }: ClientFormProps) => {
    // Initialize form data with nested structure
    const [formData, setFormData] = useState<Partial<ClientInput>>({
        fullName: initialData?.fullName || '',
        email: initialData?.email || '',
        phone: initialData?.phone || '',
        status: initialData?.status || 'lead',
        pipelineStage: initialData?.pipelineStage || 'New Lead',
        notes: initialData?.notes || '',
        billing: initialData?.billing || {
            profile: {},
            schedule: {
                autoInvoiceEnabled: false,
                timezone: 'Asia/Jerusalem',
                frequency: 'monthly',
                timeOfDay: '23:59',
                dayOfMonth: 1,
                monthlyChangeCredit: 1,
                currentMonthCreditUsed: 0, // Added default
            },
            sending: {
                autoSendInvoices: false,
                invoiceEmailsEnabled: false,
                invoiceEmails: []
            },
            amount: 0,
            currency: 'USD'
        }
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [emailInput, setEmailInput] = useState(''); // Temporary input for adding emails

    // Modal State
    const [statusModalOpen, setStatusModalOpen] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<string | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };

    // Helper for nested billing updates
    const updateBilling = (section: keyof ClientBillingConfig, field: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            billing: {
                ...prev.billing!,
                [section]: {
                    ...prev.billing![section],
                    [field]: value
                }
            } as ClientBillingConfig
        }));
    };

    const updateBillingRoot = (field: keyof ClientBillingConfig, value: any) => {
        setFormData(prev => ({
            ...prev,
            billing: {
                ...prev.billing!,
                [field]: value
            } as ClientBillingConfig
        }));
    };

    // Email List Management
    const addEmail = () => {
        if (!emailInput) return;
        // Simple regex check
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
            setErrors(prev => ({ ...prev, invoiceEmails: "Invalid email format" }));
            return;
        }

        const currentEmails = formData.billing?.sending?.invoiceEmails || [];
        if (currentEmails.includes(emailInput)) return;

        updateBilling('sending', 'invoiceEmails', [...currentEmails, emailInput]);
        setEmailInput('');
        setErrors(prev => { const n = { ...prev }; delete n.invoiceEmails; return n; });
    };

    const removeEmail = (email: string) => {
        const currentEmails = formData.billing?.sending?.invoiceEmails || [];
        updateBilling('sending', 'invoiceEmails', currentEmails.filter(e => e !== email));
    };

    // Status Change Interception
    const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        const current = formData.status || 'lead';

        if ((current === 'active' && value === 'paused') || (current === 'paused' && value === 'active')) {
            setPendingStatus(value);
            setStatusModalOpen(true);
        } else {
            setFormData(prev => ({ ...prev, status: value as any }));
        }
    };

    const confirmStatusChange = (options: { freeze: boolean; notify: boolean; retrieve: boolean }) => {
        if (pendingStatus) {
            setFormData(prev => {
                let updatedNotes = prev.notes || '';
                if (options.freeze || options.notify || options.retrieve) {
                    updatedNotes += `\n[System ${new Date().toISOString().split('T')[0]}] Status Changed to ${pendingStatus}. Actions: Freeze=${options.freeze}, Retrieve=${options.retrieve}, Notify=${options.notify}`;
                }
                return { ...prev, status: pendingStatus as any, notes: updatedNotes };
            });
        }
        setStatusModalOpen(false);
        setPendingStatus(null);
    };

    const cancelStatusChange = () => {
        setStatusModalOpen(false);
        setPendingStatus(null);
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});

        // Calculate nextRunAt immediately before validation
        const rawData = { ...formData };
        if (rawData.billing?.schedule?.autoInvoiceEnabled) {
            const nextRun = computeNextRunAt(rawData.billing as ClientBillingConfig);
            if (nextRun) {
                rawData.billing.schedule.nextRunAt = nextRun;
            }
        }

        try {
            // Validate using the schema
            const validatedData = ClientSchema.omit({
                id: true, createdAt: true, updatedAt: true, emailLower: true, phoneNormalized: true
            }).parse(rawData);

            await onSubmit(validatedData);
        } catch (err) {
            console.error("Validation Error:", err);
            if (err instanceof z.ZodError) {
                const newErrors: Record<string, string> = {};
                err.errors.forEach(error => {
                    const path = error.path.join('.');
                    newErrors[path] = error.message;
                    if (error.path[0]) newErrors[error.path[0] as string] = error.message;
                });
                setErrors(newErrors);
            }
        }
    };

    const billing = formData.billing!;
    const schedule = billing.schedule!;
    const sending = billing.sending!;
    const profile = billing.profile!;

    return (
        <>
            <StatusChangeModal
                isOpen={statusModalOpen}
                oldStatus={formData.status || 'lead'}
                newStatus={pendingStatus || ''}
                onConfirm={confirmStatusChange}
                onCancel={cancelStatusChange}
            />

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Client Details</h3>
                    <div>
                        <label className="text-sm font-medium text-gray-700">Full Name</label>
                        <Input name="fullName" value={formData.fullName} onChange={handleChange} error={errors.fullName} placeholder="e.g. Acme Corp" />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className="text-sm font-medium text-gray-700">Email (Contact)</label>
                            <Input name="email" type="email" value={formData.email} onChange={handleChange} error={errors.email} placeholder="contact@acme.com" />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700">Phone</label>
                            <Input name="phone" value={formData.phone} onChange={handleChange} error={errors.phone} placeholder="+1 (555) 000-0000" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Status</label>
                            <select name="status" value={formData.status} onChange={handleStatusChange} className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400">
                                <option value="lead">Lead</option>
                                <option value="active">Active</option>
                                <option value="paused">Paused</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700">Pipeline Stage</label>
                            <Input name="pipelineStage" value={formData.pipelineStage} onChange={handleChange} error={errors.pipelineStage} />
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium text-gray-700">Notes</label>
                        <textarea name="notes" value={formData.notes} onChange={handleChange} className="flex min-h-[80px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" placeholder="Internal notes..." />
                    </div>
                </div>

                {/* Billing Profile */}
                <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Billing Details</h3>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className="text-sm font-medium text-gray-700">Billing Name</label>
                            <Input
                                value={profile.billingName || ''}
                                onChange={e => updateBilling('profile', 'billingName', e.target.value)}
                                placeholder="Data if different from Full Name"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700">Billing ID / VAT</label>
                            <Input
                                value={profile.billingId || ''}
                                onChange={e => updateBilling('profile', 'billingId', e.target.value)}
                                placeholder="e.g. 512345678"
                            />
                        </div>
                        <div className="col-span-1 sm:col-span-2">
                            <label className="text-sm font-medium text-gray-700">Billing Address</label>
                            <Input
                                value={profile.billingAddress || ''}
                                onChange={e => updateBilling('profile', 'billingAddress', e.target.value)}
                                placeholder="Street, City, Country"
                            />
                        </div>
                    </div>
                </div>

                {/* Invoicing Rules */}
                <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Invoicing Rules</h3>

                    <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={sending.autoSendInvoices}
                                onChange={e => updateBilling('sending', 'autoSendInvoices', e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label className="text-sm font-bold text-gray-700">Auto-Send Invoices by Email</label>
                        </div>

                        {sending.autoSendInvoices && (
                            <div className="pl-6 space-y-2 border-l-2 border-blue-200">
                                <div className="flex items-center gap-2 mb-2">
                                    <input
                                        type="checkbox"
                                        checked={sending.invoiceEmailsEnabled}
                                        onChange={e => updateBilling('sending', 'invoiceEmailsEnabled', e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-blue-600"
                                    />
                                    <label className="text-sm text-gray-600">Send to multiple recipients</label>
                                </div>

                                {!sending.invoiceEmailsEnabled ? (
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Single email mode (uses list[0])</p>
                                        <Input
                                            value={sending.invoiceEmails?.[0] || ''}
                                            onChange={e => updateBilling('sending', 'invoiceEmails', [e.target.value])}
                                            placeholder="bill@example.com"
                                            error={errors['billing.sending.invoiceEmails'] || errors['invoiceEmails']}
                                        />
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="flex gap-2">
                                            <Input
                                                value={emailInput}
                                                onChange={e => setEmailInput(e.target.value)}
                                                placeholder="Add recipient..."
                                                className="flex-1"
                                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEmail(); } }}
                                            />
                                            <Button type="button" onClick={addEmail} variant="secondary">Add</Button>
                                        </div>
                                        {errors['billing.sending.invoiceEmails'] && <p className="text-xs text-red-500">{errors['billing.sending.invoiceEmails']}</p>}

                                        <div className="flex flex-wrap gap-2">
                                            {sending.invoiceEmails?.map(email => (
                                                <div key={email} className="bg-white border rounded-full px-3 py-1 text-sm flex items-center gap-2">
                                                    <span>{email}</span>
                                                    <button type="button" onClick={() => removeEmail(email)} className="text-gray-400 hover:text-red-500">
                                                        <Trash2 className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={schedule.autoInvoiceEnabled}
                                onChange={e => updateBilling('schedule', 'autoInvoiceEnabled', e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label className="text-sm font-bold text-gray-700">Enable Automatic Schedule & Retainer</label>
                        </div>

                        {schedule.autoInvoiceEnabled && (
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Amount</label>
                                    <Input type="number" min="0" step="0.01" value={billing.amount} onChange={e => updateBillingRoot('amount', parseFloat(e.target.value))} />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Currency</label>
                                    <select value={billing.currency} onChange={e => updateBillingRoot('currency', e.target.value)} className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
                                        <option value="USD">USD</option>
                                        <option value="ILS">ILS</option>
                                        <option value="EUR">EUR</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-gray-700">Frequency</label>
                                    <select value={schedule.frequency} onChange={e => updateBilling('schedule', 'frequency', e.target.value)} className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
                                        <option value="monthly">Monthly</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="daily">Daily</option>
                                    </select>
                                </div>

                                {/* Monthly Credit Field */}
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Monthly Change Credits</label>
                                    <Input
                                        type="number"
                                        min="0"
                                        value={schedule.monthlyChangeCredit ?? 1}
                                        onChange={e => updateBilling('schedule', 'monthlyChangeCredit', parseInt(e.target.value))}
                                    />
                                    <p className="text-xs text-gray-400 mt-1">Free changes per month</p>
                                </div>

                                {schedule.frequency === 'monthly' && (
                                    <div>
                                        <label className="text-sm font-medium text-gray-700">Day of Month</label>
                                        <Input type="number" min="1" max="28" value={schedule.dayOfMonth || 1} onChange={e => updateBilling('schedule', 'dayOfMonth', parseInt(e.target.value))} />
                                    </div>
                                )}

                                {schedule.frequency === 'weekly' && (
                                    <div>
                                        <label className="text-sm font-medium text-gray-700">Day of Week</label>
                                        <select value={schedule.dayOfWeek ?? 0} onChange={e => updateBilling('schedule', 'dayOfWeek', parseInt(e.target.value))} className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
                                            <option value="0">Sunday</option>
                                            <option value="1">Monday</option>
                                            <option value="2">Tuesday</option>
                                            <option value="3">Wednesday</option>
                                            <option value="4">Thursday</option>
                                            <option value="5">Friday</option>
                                            <option value="6">Saturday</option>
                                        </select>
                                    </div>
                                )}

                                {errors['billing.schedule.frequency'] && <p className="text-xs text-red-500 col-span-2">{errors['billing.schedule.frequency']}</p>}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>Cancel</Button>
                    <Button type="submit" isLoading={isLoading}>{submitLabel || (initialData ? 'Update Client' : 'Create Client')}</Button>
                </div>
            </form>
        </>
    );
};
