'use client';

import React from 'react';
import { Client } from '@/types/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Edit, Trash2, Phone, Mail, FileText, Briefcase } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ClientListProps {
    clients: Client[];
    onEdit: (client: Client) => void;
    onDelete: (id: string) => void;
    onRestore?: (id: string) => void;
    isTrash?: boolean;
}

export const ClientList = ({ clients, onEdit, onDelete, onRestore, isTrash = false }: ClientListProps) => {
    const router = useRouter();

    if (clients.length === 0) {
        return (
            <Card className="flex min-h-[200px] flex-col items-center justify-center border-dashed p-8 text-center bg-gray-50/50">
                <p className="text-sm text-gray-500">
                    {isTrash ? "Trash is empty." : "No items found."}
                </p>
            </Card>
        );
    }

    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((client, index) => (
                <Card
                    key={client.id}
                    className="flex flex-col justify-between p-5 hover:shadow-md transition-shadow animate-slide-in opacity-0"
                    style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'forwards' }}
                >
                    <div>
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="font-semibold text-gray-900 line-clamp-1">{client.fullName}</h3>
                                {client.clientNumber && (
                                    <p className="text-xs font-medium text-indigo-600">ID: {client.clientNumber}</p>
                                )}
                                <p className="text-xs text-gray-500 mt-1">{client.pipelineStage}</p>
                            </div>
                            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${client.status === 'active' ? 'bg-green-50 text-green-700 ring-green-600/20' :
                                client.status === 'paused' ? 'bg-yellow-50 text-yellow-800 ring-yellow-600/20' :
                                    'bg-blue-50 text-blue-700 ring-blue-600/20'
                                }`}>
                                {client.status === 'lead' ? 'Lead' : client.status}
                            </span>
                        </div>

                        <div className="mt-4 space-y-2">
                            {client.email && (
                                <div className="flex items-center text-sm text-gray-500">
                                    <Mail className="mr-2 h-3.5 w-3.5" />
                                    <span className="truncate">{client.email}</span>
                                </div>
                            )}
                            {client.phone && (
                                <div className="flex items-center text-sm text-gray-500">
                                    <Phone className="mr-2 h-3.5 w-3.5" />
                                    <span className="truncate">{client.phone}</span>
                                </div>
                            )}
                        </div>

                        {client.updatedAt && (
                            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                                <span>Updated:</span>
                                <span>
                                    {new Date(client.updatedAt.toDate ? client.updatedAt.toDate() : client.updatedAt).toLocaleDateString()}
                                    {' '}
                                    {new Date(client.updatedAt.toDate ? client.updatedAt.toDate() : client.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        )}
                        {client.deletedAt && isTrash && (
                            <div className="mt-2 text-xs text-red-500 font-medium">
                                Deleted: {new Date(client.deletedAt.toDate ? client.deletedAt.toDate() : client.deletedAt).toLocaleDateString()}
                            </div>
                        )}
                    </div>

                    <div className="mt-5 flex items-center justify-end gap-2 border-t pt-4">
                        {!isTrash && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0 text-gray-500 hover:text-black hover:border-gray-300"
                                onClick={() => router.push(`/admin/clients/${client.id}`)}
                                title="View Details"
                            >
                                <FileText className="h-3.5 w-3.5" />
                            </Button>
                        )}

                        {!isTrash && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200"
                                onClick={() => router.push(`/admin/projects?clientId=${client.id}`)}
                                title="Open New Project"
                            >
                                <Briefcase className="h-3.5 w-3.5" />
                            </Button>
                        )}

                        {isTrash && onRestore ? (
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-3 text-green-600 hover:bg-green-50 hover:text-green-700 hover:border-green-200"
                                onClick={() => onRestore(client.id)}
                            >
                                Restore
                            </Button>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => onEdit(client)}
                                title="Edit"
                            >
                                <Edit className="h-3.5 w-3.5" />
                            </Button>
                        )}

                        <Button
                            variant="outline"
                            size="sm"
                            className={`h-8 w-8 p-0 hover:bg-red-50 hover:border-red-200 ${isTrash ? 'text-red-700 border-red-200 bg-red-50' : 'text-red-600 hover:text-red-700'}`}
                            onClick={() => onDelete(client.id)}
                            title={isTrash ? "Permanently Delete" : "Delete"}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </Card>
            ))
            }
        </div >
    );
};
