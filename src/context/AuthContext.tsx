'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '@/lib/firebaseClient';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/Spinner';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    logout: () => Promise<void>;
    mockLogin: () => void;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    logout: async () => { },
    mockLogin: () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const mockLogin = () => {
        const mockUser = {
            uid: 'mock-user-id',
            email: 'admin@demo.com',
            emailVerified: true,
            isAnonymous: false,
            metadata: {},
            providerData: [],
            refreshToken: '',
            tenantId: '',
            delete: async () => { },
            getIdToken: async () => 'mock-token',
            getIdTokenResult: async () => ({ token: 'mock', signInProvider: 'custom', claims: {}, authTime: Date.now(), issuedAtTime: Date.now(), expirationTime: Date.now() + 3600, expirationTimeSeconds: 3600 }),
            reload: async () => { },
            toJSON: () => ({}),
            displayName: 'Admin User',
            phoneNumber: '',
            photoURL: '',
            providerId: 'mock'
        } as unknown as User;
        setUser(mockUser);
        router.push('/admin');
    };

    useEffect(() => {
        if (!auth) {
            setLoading(false);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const logout = async () => {
        try {
            if (!auth) return;
            await firebaseSignOut(auth);
            router.push('/login');
        } catch (error) {
            console.error('Logout failed', error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, logout, mockLogin }}>
            {children}
        </AuthContext.Provider>
    );
};
