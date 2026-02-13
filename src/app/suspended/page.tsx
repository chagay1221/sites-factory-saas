import React from 'react';
import { ShieldAlert, Mail } from 'lucide-react';

export default function SuspendedPage() {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white max-w-md w-full p-8 rounded-lg shadow-lg text-center space-y-6">
                <div className="flex justify-center">
                    <div className="h-20 w-20 bg-red-100 rounded-full flex items-center justify-center">
                        <ShieldAlert className="h-10 w-10 text-red-600" />
                    </div>
                </div>

                <div className="space-y-2">
                    <h1 className="text-2xl font-bold text-gray-900">Service Suspended</h1>
                    <p className="text-gray-500">
                        This website is currently unavailable due to an account issue.
                    </p>
                </div>

                <div className="border-t border-b border-gray-100 py-4">
                    <p className="text-sm text-gray-600">
                        If you are the site owner, please contact support or check your billing status to restore service.
                    </p>
                </div>

                <div className="flex flex-col gap-3">
                    <a
                        href="mailto:support@sites-factory.com"
                        className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors font-medium"
                    >
                        <Mail className="h-4 w-4" />
                        Contact Support
                    </a>
                </div>

                <div className="text-xs text-gray-400 mt-8">
                    &copy; {new Date().getFullYear()} Sites Factory Platform
                </div>
            </div>
        </div>
    );
}
