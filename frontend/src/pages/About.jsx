import React from 'react';
import { Link } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import Footer from '../components/Footer';
import { useDarkMode } from '../contexts/DarkModeContext';

const About = () => {
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
                    About STAKD
                </h1>

                <p style={{ fontSize: 17, lineHeight: 1.75, color: t.textSecondary, marginBottom: 28 }}>
                    STAKD is a small studio dedicated to turning your favorite characters into premium,
                    hand-crafted shadowbox display pieces. Every piece is built in-house — from design
                    and precision cutting to assembly and framing — so you get something that looks
                    and feels like a collectible, not a poster.
                </p>

                <p style={{ fontSize: 16, lineHeight: 1.75, color: t.textMuted, marginBottom: 28 }}>
                    We focus on video games, anime, and esports because that's where our team lives.
                    When you order from STAKD, you're getting a multi-layer shadowbox made with
                    Silhouette-cut cardstock, glossy adhesive vinyl, double-sided adhesive, and UV
                    Krylon finish. Many designs are limited runs; once they're gone, they're gone.
                </p>

                <p style={{ fontSize: 16, lineHeight: 1.75, color: t.textMuted, marginBottom: 40 }}>
                    Thanks for supporting independent craft. If you have questions or custom requests,
                    reach out — we read everything.
                </p>

                <div style={{
                    padding: 24, background: t.surface, borderRadius: 12,
                    border: `1px solid ${t.border}`,
                }}>
                    <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: t.textMuted, marginBottom: 8 }}>
                        Contact
                    </div>
                    <div style={{ fontSize: 15, color: t.text }}>
                        <a href="mailto:hello@stakdcards.com" target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); window.open('mailto:hello@stakdcards.com'); }} style={{ color: t.primary, fontWeight: 600 }}>hello@stakdcards.com</a>
                    </div>
                </div>

                <div style={{ marginTop: 48, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <Link to="/products" style={{
                        padding: '12px 24px', borderRadius: 10, background: t.primary, color: '#fff',
                        fontWeight: 700, fontSize: 14, textDecoration: 'none', letterSpacing: 0.4,
                    }}>
                        Shop Products
                    </Link>
                    <Link to="/gallery" style={{
                        padding: '12px 24px', borderRadius: 10, border: `1px solid ${t.border}`,
                        color: t.text, fontWeight: 600, fontSize: 14, textDecoration: 'none',
                    }}>
                        View Gallery
                    </Link>
                </div>
            </main>

            <Footer />
        </div>
    );
};

export default About;
