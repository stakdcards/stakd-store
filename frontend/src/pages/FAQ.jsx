import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import Footer from '../components/Footer';
import { useDarkMode } from '../contexts/DarkModeContext';

const FAQ_ITEMS = [
    {
        q: 'What is a shadowbox card?',
        a: 'A shadowbox is a layered display piece. We use precision-cut cardstock and materials to create depth, so your favorite character or design pops off the background. Each piece is assembled by hand and built to last.',
    },
    {
        q: 'How long does shipping take?',
        a: 'Standard shipping typically takes 5–8 business days within the US. We also offer expedited (2–3 business days) and overnight options at checkout. You\'ll get a tracking number once your order ships.',
    },
    {
        q: 'Can I cancel or change my order?',
        a: 'If you need to cancel or change your order, contact us as soon as possible at hello@stakdcards.com. We start production quickly, so the sooner you reach out, the better we can help.',
    },
    {
        q: 'Do you ship internationally?',
        a: 'We currently ship to the United States. International shipping may be added in the future — sign up for our newsletter to stay updated.',
    },
    {
        q: 'How do I care for my shadowbox?',
        a: 'Keep it out of direct sunlight to avoid fading. Dust gently with a soft, dry cloth. Avoid moisture and impact. Display in a dry, stable spot and it\'ll look great for years.',
    },
];

const FAQ = () => {
    const { t } = useDarkMode();
    const [openIndex, setOpenIndex] = useState(null);

    return (
        <div style={{ minHeight: '100vh', background: t.bg, color: t.text, display: 'flex', flexDirection: 'column' }}>
            <SiteHeader />
            <main style={{ flex: 1, maxWidth: 720, margin: '0 auto', padding: 'clamp(48px, 8vw, 96px) 24px 80px', width: '100%', boxSizing: 'border-box' }}>
                <h1 style={{
                    fontFamily: "'Big Shoulders Display', 'Bebas Neue', sans-serif",
                    fontSize: 'clamp(36px, 6vw, 56px)', fontWeight: 900,
                    textTransform: 'uppercase', margin: '0 0 8px', color: t.text, letterSpacing: 0.5,
                }}>
                    FAQ
                </h1>
                <p style={{ fontSize: 15, color: t.textMuted, marginBottom: 32 }}>
                    Common questions about our products, shipping, and care.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden', background: t.surface }}>
                    {FAQ_ITEMS.map((item, i) => (
                        <div key={i} style={{ borderBottom: i < FAQ_ITEMS.length - 1 ? `1px solid ${t.border}` : 'none' }}>
                            <button
                                type="button"
                                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                                style={{
                                    width: '100%', padding: '18px 20px', textAlign: 'left', border: 'none',
                                    background: 'transparent', color: t.text, fontSize: 15, fontWeight: 700,
                                    cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                                }}
                            >
                                {item.q}
                                <span style={{ flexShrink: 0, fontSize: 18, color: t.textMuted }}>{openIndex === i ? '−' : '+'}</span>
                            </button>
                            {openIndex === i && (
                                <div style={{ padding: '0 20px 18px', fontSize: 14, lineHeight: 1.7, color: t.textMuted }}>
                                    {item.a}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                <p style={{ marginTop: 24, fontSize: 14, color: t.textMuted }}>
                    Still have questions? <a href="mailto:hello@stakdcards.com" style={{ color: t.primary, fontWeight: 600 }}>Get in touch</a>.
                </p>
                <Link to="/products" style={{
                    display: 'inline-block', marginTop: 32, padding: '12px 24px', borderRadius: 10,
                    background: t.primary, color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none',
                }}>
                    Shop Products
                </Link>
            </main>
            <Footer />
        </div>
    );
};

export default FAQ;
