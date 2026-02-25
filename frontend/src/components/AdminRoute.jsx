import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDarkMode } from '../contexts/DarkModeContext';
import SiteHeader from './SiteHeader';

/**
 * Protects /admin: requires logged-in admin user.
 * If not signed in, shows login form. If signed in but not admin, shows "Access denied".
 */
export default function AdminRoute({ children }) {
    const { user, admin, loading, signIn } = useAuth();
    const { t } = useDarkMode();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [signInError, setSignInError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setSignInError('');
        setSubmitting(true);
        try {
            const { error } = await signIn(email, password);
            if (error) setSignInError(error.message || 'Sign in failed');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: t.bg, color: t.text, fontFamily: 'Inter, sans-serif',
            }}>
                Loading…
            </div>
        );
    }

    if (!user) {
        return (
            <div style={{ minHeight: '100vh', background: t.bg, color: t.text }}>
                <SiteHeader />
                <div style={{ maxWidth: 400, margin: '80px auto', padding: 24 }}>
                    <h1 style={{ fontFamily: "'Big Shoulders Display', sans-serif", fontSize: 28, fontWeight: 900, marginBottom: 8 }}>Admin sign in</h1>
                    <p style={{ color: t.textMuted, fontSize: 14, marginBottom: 24 }}>Sign in with your admin account to access the panel.</p>
                    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); setSignInError(''); }}
                            required
                            style={{
                                padding: '12px 14px', borderRadius: 8, border: `1px solid ${t.border}`,
                                background: t.inputBg, color: t.text, fontSize: 14, outline: 'none',
                            }}
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); setSignInError(''); }}
                            required
                            style={{
                                padding: '12px 14px', borderRadius: 8, border: `1px solid ${t.border}`,
                                background: t.inputBg, color: t.text, fontSize: 14, outline: 'none',
                            }}
                        />
                        {signInError && (
                            <div style={{ fontSize: 13, color: '#ef4444' }}>{signInError}</div>
                        )}
                        <button
                            type="submit"
                            disabled={submitting}
                            style={{
                                padding: '12px 20px', borderRadius: 8, border: 'none',
                                background: t.primary, color: '#fff', fontWeight: 700, fontSize: 14,
                                cursor: submitting ? 'wait' : 'pointer',
                            }}
                        >
                            {submitting ? 'Signing in…' : 'Sign in'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    if (!admin) {
        return (
            <div style={{
                minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16,
                background: t.bg, color: t.text, fontFamily: 'Inter, sans-serif', padding: 24,
            }}>
                <h1 style={{ fontSize: 24, fontWeight: 800 }}>Access denied</h1>
                <p style={{ color: t.textMuted }}>You must be an admin to view this page.</p>
            </div>
        );
    }

    return children;
}
