import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDarkMode } from '../contexts/DarkModeContext';

/**
 * Protects /account: requires a logged-in user (any role).
 * Redirects to /login if not authenticated.
 */
export default function AccountRoute({ children }) {
    const { user, loading } = useAuth();
    const { t } = useDarkMode();
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading && !user) navigate('/login', { replace: true });
    }, [user, loading, navigate]);

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: t.bg, color: t.textMuted, fontSize: 14,
            }}>
                Loading…
            </div>
        );
    }

    if (!user) return null;
    return children;
}
