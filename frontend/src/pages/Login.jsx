import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import Footer from '../components/Footer';
import { useDarkMode } from '../contexts/DarkModeContext';
import { useAuth } from '../contexts/AuthContext';
import { track } from '../lib/posthog';

const GoogleIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
);

export default function Login() {
    const { t } = useDarkMode();
    const { user, signInWithMagicLink, signInWithGoogle, loading } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [googleLoading, setGoogleLoading] = useState(false);

    useEffect(() => {
        if (!loading && user) navigate('/account', { replace: true });
    }, [user, loading, navigate]);

    const handleMagicLink = async (e) => {
        e.preventDefault();
        if (!email.trim()) return;
        setSubmitting(true);
        setError('');
        const { error: err } = await signInWithMagicLink(email.trim());
        setSubmitting(false);
        if (err) { setError(err.message || 'Failed to send link'); return; }
        track('magic_link_requested', { email: email.trim() });
        setSubmitted(true);
    };

    const handleGoogle = async () => {
        setGoogleLoading(true);
        track('google_signin_clicked');
        const { error: err } = await signInWithGoogle();
        if (err) { setError(err.message || 'Google sign-in failed'); setGoogleLoading(false); }
        // On success, Supabase redirects — no further action needed
    };

    if (loading) return null;

    return (
        <div style={{ minHeight: '100vh', background: t.bg, color: t.text, display: 'flex', flexDirection: 'column' }}>
            <SiteHeader />
            <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
                <div style={{ width: '100%', maxWidth: 400 }}>
                    {/* Header */}
                    <div style={{ textAlign: 'center', marginBottom: 36 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase', color: t.primary, marginBottom: 12 }}>
                            My Account
                        </div>
                        <h1 style={{
                            fontFamily: "'Big Shoulders Display', 'Bebas Neue', sans-serif",
                            fontSize: 'clamp(28px, 6vw, 40px)', fontWeight: 900,
                            textTransform: 'uppercase', margin: 0, color: t.text, letterSpacing: 0.5,
                        }}>
                            Sign In
                        </h1>
                        <p style={{ color: t.textMuted, fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>
                            Track orders, manage your profile, and get early access to new drops.
                        </p>
                    </div>

                    <div style={{ background: t.surface, borderRadius: 16, border: `1px solid ${t.border}`, padding: 32, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
                        {submitted ? (
                            <div style={{ textAlign: 'center', padding: '8px 0' }}>
                                <div style={{ fontSize: 40, marginBottom: 16 }}>✉️</div>
                                <h2 style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 8 }}>Check your email</h2>
                                <p style={{ color: t.textMuted, fontSize: 14, lineHeight: 1.7 }}>
                                    We sent a sign-in link to <strong style={{ color: t.text }}>{email}</strong>.
                                    Click the link in the email to log in — it expires in 1 hour.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => { setSubmitted(false); setEmail(''); }}
                                    style={{ marginTop: 20, fontSize: 13, color: t.primary, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                                >
                                    Use a different email
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Google */}
                                <button
                                    type="button"
                                    onClick={handleGoogle}
                                    disabled={googleLoading}
                                    style={{
                                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        gap: 10, padding: '12px 16px', borderRadius: 10,
                                        border: `1px solid ${t.border}`, background: t.surfaceAlt,
                                        color: t.text, fontSize: 14, fontWeight: 600, cursor: googleLoading ? 'wait' : 'pointer',
                                        transition: 'all .15s', opacity: googleLoading ? 0.7 : 1,
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = t.primary; e.currentTarget.style.background = t.surfaceHover; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.background = t.surfaceAlt; }}
                                >
                                    <GoogleIcon />
                                    {googleLoading ? 'Redirecting…' : 'Continue with Google'}
                                </button>

                                {/* Divider */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
                                    <div style={{ flex: 1, height: 1, background: t.border }} />
                                    <span style={{ fontSize: 12, color: t.textFaint, fontWeight: 600 }}>or</span>
                                    <div style={{ flex: 1, height: 1, background: t.border }} />
                                </div>

                                {/* Magic link */}
                                <form onSubmit={handleMagicLink} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: t.textMuted }}>
                                        Email address
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={e => { setEmail(e.target.value); setError(''); }}
                                        placeholder="you@example.com"
                                        required
                                        style={{
                                            padding: '12px 14px', borderRadius: 10, fontSize: 14,
                                            border: `1px solid ${error ? '#ef4444' : t.inputBorder}`,
                                            background: t.inputBg, color: t.inputText, outline: 'none',
                                            transition: 'border-color .15s',
                                        }}
                                        onFocus={e => { e.target.style.borderColor = t.primary; }}
                                        onBlur={e => { e.target.style.borderColor = error ? '#ef4444' : t.inputBorder; }}
                                    />
                                    {error && <p style={{ fontSize: 13, color: '#ef4444', margin: 0 }}>{error}</p>}
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="stakd-btn-primary"
                                        style={{
                                            width: '100%', padding: '12px 16px', borderRadius: 10, border: 'none',
                                            background: t.primary, color: '#fff', fontSize: 14, fontWeight: 700,
                                            cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.7 : 1,
                                        }}
                                    >
                                        {submitting ? 'Sending link…' : 'Send Magic Link'}
                                    </button>
                                </form>

                                <p style={{ textAlign: 'center', fontSize: 12, color: t.textFaint, marginTop: 16, lineHeight: 1.6 }}>
                                    We'll email you a secure sign-in link. No password needed.
                                </p>
                            </>
                        )}
                    </div>

                    <p style={{ textAlign: 'center', fontSize: 13, color: t.textMuted, marginTop: 20 }}>
                        <Link to="/products" style={{ color: t.primary, textDecoration: 'none', fontWeight: 600 }}>
                            Continue browsing without an account →
                        </Link>
                    </p>
                </div>
            </main>
            <Footer />
        </div>
    );
}
