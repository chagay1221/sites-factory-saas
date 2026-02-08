'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebaseClient';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { user, mockLogin } = useAuth();
    // ...
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await signInWithEmailAndPassword(auth!, email, password);
            router.push('/admin');
        } catch (err: any) {
            console.error("Login Error:", err);
            console.error("Error Code:", err.code);
            console.error("Error Message:", err.message);
            setError(`Failed to log in: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
            <Card className="w-full max-w-md p-8 space-y-6">
                <div className="text-center space-y-2">
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                        Sign in to your account
                    </h1>
                    <p className="text-sm text-gray-500">
                        Enter your email and password to access the admin panel.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label
                            htmlFor="email"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            Email
                        </label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="name@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={loading}
                        />
                    </div>
                    <div className="space-y-2">
                        <label
                            htmlFor="password"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            Password
                        </label>
                        <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={loading}
                        />
                    </div>

                    {error && (
                        <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                            {error}
                        </div>
                    )}

                    <Button type="submit" className="w-full" isLoading={loading}>
                        Sign in
                    </Button>
                </form>
            </Card>
        </div>
    );
}
