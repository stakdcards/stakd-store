import React from 'react';
import { Link } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import Footer from '../components/Footer';
import { useDarkMode } from '../contexts/DarkModeContext';

const Contact = () => {
    const { t } = useDarkMode();

    return (
        <div style={{ minHeight: '100vh', background: t.bg, color: t.text, display: 'flex', flexDirection: 'column' }}>
            <SiteHeader />
            <main style={{ flex: 1, maxWidth: 720, margin: '0 auto', padding: 'clamp(48px, 8vw, 96px) 24px 80px', width: '100%', boxSizing: 'border-box' }}>
                <h1 style={{
                    fontFamily: "'Big Shoulders Display', 'Bebas Neue', sans-serif",
                    fontSize: 'clamp(36px, 6vw, 56px)', fontWeight: 900,
                    textTransform: 'uppercase', margin: '0 0 24px', color: t.text, letterSpacing: 0.5,
                }}>
                    Contact
                </h1>
                <p style={{ fontSize: 16, lineHeight: 1.75, color: t.textMuted, marginBottom: 32 }}>
                    Questions, custom requests, or wholesale inquiries? We read everything and usually respond within 1–2 business days.
                </p>
                <div style={{
                    padding: 28, background: t.surface, borderRadius: 12,
                    border: `1px solid ${t.border}`,
                }}>
                    <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: t.textMuted, marginBottom: 10 }}>
                        Email
                    </div>
                    <a href="mailto:hello@stakdcards.com" style={{ fontSize: 18, color: t.primary, fontWeight: 700, textDecoration: 'none' }}>
                        hello@stakdcards.com
                    </a>
                </div>
                <div style={{ marginTop: 40, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <Link to="/faq" style={{
                        padding: '12px 24px', borderRadius: 10, border: `1px solid ${t.border}`,
                        color: t.text, fontWeight: 600, fontSize: 14, textDecoration: 'none',
                    }}>
                        FAQ
                    </Link>
                    <Link to="/products" style={{
                        padding: '12px 24px', borderRadius: 10, background: t.primary, color: '#fff',
                        fontWeight: 700, fontSize: 14, textDecoration: 'none',
                    }}>
                        Shop Products
                    </Link>
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default Contact;
