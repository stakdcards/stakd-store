import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as authService from '../services/auth';
import { identifyUser, resetUser } from '../lib/posthog';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [session, setSession] = useState(null);
    const [admin, setAdmin] = useState(false);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    const refreshAdmin = useCallback(async () => {
        const ok = await authService.isAdmin();
        setAdmin(ok);
    }, []);

    const refreshProfile = useCallback(async () => {
        const p = await authService.getProfile();
        setProfile(p);
    }, []);

    useEffect(() => {
        authService.getCurrentSession().then(async (s) => {
            setSession(s);
            if (s?.user) {
                await authService.ensureProfile();
                await Promise.all([refreshAdmin(), refreshProfile()]);
                identifyUser(s.user.id, { email: s.user.email });
            }
            setLoading(false);
        });
    }, [refreshAdmin, refreshProfile]);

    useEffect(() => {
        const unsub = authService.onAuthStateChange(async (s) => {
            setSession(s);
            if (s?.user) {
                await authService.ensureProfile();
                await Promise.all([refreshAdmin(), refreshProfile()]);
                identifyUser(s.user.id, { email: s.user.email });
            } else {
                setAdmin(false);
                setProfile(null);
                resetUser();
            }
        });
        return unsub;
    }, [refreshAdmin, refreshProfile]);

    const signIn = useCallback(async (email, password) => {
        const { error } = await authService.signIn(email, password);
        if (error) return { error };
        await refreshAdmin();
        return {};
    }, [refreshAdmin]);

    const signInWithMagicLink = useCallback(async (email) => {
        return authService.signInWithMagicLink(email);
    }, []);

    const signInWithGoogle = useCallback(async () => {
        return authService.signInWithGoogle();
    }, []);

    const signOut = useCallback(async () => {
        await authService.signOut();
        setSession(null);
        setAdmin(false);
        setProfile(null);
    }, []);

    const updateProfile = useCallback(async (updates) => {
        const result = await authService.updateProfile(updates);
        if (!result.error) await refreshProfile();
        return result;
    }, [refreshProfile]);

    const value = {
        session,
        user: session?.user ?? null,
        admin,
        profile,
        loading,
        signIn,
        signInWithMagicLink,
        signInWithGoogle,
        signOut,
        updateProfile,
        refreshAdmin,
        refreshProfile,
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
