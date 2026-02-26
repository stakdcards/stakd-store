import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import Footer from '../components/Footer';
import { useDarkMode } from '../contexts/DarkModeContext';
import { useCart } from '../contexts/CartContext';
import { track } from '../lib/posthog';

export default function CheckoutSuccess() {
    const { t } = useDarkMode();
    const { clearCart } = useCart();

    useEffect(() => {
        track('order_completed');
        clearCart();
    }, [clearCart]);

    return (
        <div style={{ minHeight: '100vh', background: t.bg, display: 'flex', flexDirection: 'column' }}>
            <SiteHeader />
            <div style={{ flex: 1, maxWidth: 600, margin: '80px auto', padding: '0 24px', textAlign: 'center', width: '100%', boxSizing: 'border-box' }}>
                <div style={{ fontSize: 64, marginBottom: 24 }}>🎉</div>
                <h1 style={{
                    fontFamily: "'Big Shoulders Display', 'Bebas Neue', sans-serif",
                    fontSize: 'clamp(36px, 6vw, 56px)', fontWeight: 900,
                    textTransform: 'uppercase', color: t.text, margin: '0 0 16px', letterSpacing: 0.5,
                }}>
                    Thank You!
                </h1>
                <p style={{ fontSize: 16, color: t.textMuted, lineHeight: 1.7, margin: '0 0 32px' }}>
                    Your payment was successful. We'll begin crafting your shadowbox right away — expect a confirmation email and updates within 1–2 business days.
                </p>
                <Link to="/products" style={{
                    display: 'inline-block', padding: '13px 32px', borderRadius: 10,
                    background: t.primary, color: '#fff', fontWeight: 800, fontSize: 14,
                    textDecoration: 'none', letterSpacing: 0.5,
                }}>
                    Continue Shopping
                </Link>
            </div>
            <Footer />
        </div>
    );
}
