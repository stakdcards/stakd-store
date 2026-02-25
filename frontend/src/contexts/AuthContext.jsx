import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as authService from '../services/auth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [session, setSession] = useState(null);
    const [admin, setAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    const refreshAdmin = useCallback(async () => {
        const ok = await authService.isAdmin();
        setAdmin(ok);
    }, []);

    useEffect(() => {
        authService.getCurrentSession().then((s) => {
            setSession(s);
            if (s?.user) refreshAdmin();
            setLoading(false);
        });
    }, [refreshAdmin]);

    useEffect(() => {
        const unsub = authService.onAuthStateChange((s) => {
            setSession(s);
            if (s?.user) refreshAdmin();
            else setAdmin(false);
        });
        return unsub;
    }, [refreshAdmin]);

    const signIn = useCallback(async (email, password) => {
        const { error } = await authService.signIn(email, password);
        if (error) return { error };
        await refreshAdmin();
        return {};
    }, [refreshAdmin]);

    const signOut = useCallback(async () => {
        await authService.signOut();
        setSession(null);
        setAdmin(false);
    }, []);

    const value = {
        session,
        user: session?.user ?? null,
        admin,
        loading,
        signIn,
        signOut,
        refreshAdmin,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
};

export default AuthContext;
