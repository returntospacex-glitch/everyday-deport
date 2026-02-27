"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
    onAuthStateChanged,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    User
} from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    googleAccessToken: string | null;
    login: () => Promise<void>;
    logout: () => Promise<void>;
    clearGoogleToken: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);

    useEffect(() => {
        const auth = getFirebaseAuth();
        // Try to recover token from local storage if it exists
        const savedToken = typeof window !== 'undefined' ? localStorage.getItem('google_access_token') : null;
        if (savedToken) setGoogleAccessToken(savedToken);

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const login = async () => {
        const auth = getFirebaseAuth();
        const provider = new GoogleAuthProvider();
        // Add Google Calendar scope
        provider.addScope('https://www.googleapis.com/auth/calendar.readonly');
        // Force account selection and consent
        provider.setCustomParameters({
            prompt: 'select_account'
        });

        try {
            const result = await signInWithPopup(auth, provider);
            const credential = GoogleAuthProvider.credentialFromResult(result);
            const token = credential?.accessToken;

            if (token) {
                setGoogleAccessToken(token);
                if (typeof window !== 'undefined') {
                    localStorage.setItem('google_access_token', token);
                }
            }
        } catch (error) {
            console.error("Login failed:", error);
        }
    };

    const logout = async () => {
        const auth = getFirebaseAuth();
        await signOut(auth);
        setGoogleAccessToken(null);
        if (typeof window !== 'undefined') {
            localStorage.removeItem('google_access_token');
        }
    };

    const clearGoogleToken = () => {
        setGoogleAccessToken(null);
        if (typeof window !== 'undefined') {
            localStorage.removeItem('google_access_token');
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, googleAccessToken, login, logout, clearGoogleToken }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
