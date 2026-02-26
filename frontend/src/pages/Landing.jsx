import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import Footer from '../components/Footer';
import { useDarkMode } from '../contexts/DarkModeContext';
import { useCart } from '../contexts/CartContext';
import { useProductStore } from '../contexts/ProductStoreContext';
import { ShadowboxPreview } from '../components/ShadowboxPreview';

const CATEGORY_TILES = [
    {
        id: 'video-games',
        label: 'Video Games',
        desc: 'From Hyrule to the Wasteland',
        bg: '#0D1420',
        accent: '#6890C8',
        icon: '🎮',
    },
    {
        id: 'anime',
        label: 'Anime',
        desc: 'Iconic characters from the greatest series',
        bg: '#060812',
        accent: '#8CB0E8',
        icon: '⚡',
    },
    {
        id: 'esports',
        label: 'Esports',
        desc: 'Legends of competitive gaming',
        bg: '#0C0C00',
        accent: '#F0C800',
        icon: '🏆',
    },
];

const QUALITY_POINTS = [
    { heading: 'Hand Assembled', body: 'Every shadowbox is built by hand in our studio — never mass-produced.' },
    { heading: 'Archival Materials', body: 'UV-protective glass, acid-free mat board, and premium solid frames that last a lifetime.' },
    { heading: 'Multi-Layer Depth', body: 'Up to six individually precision-cut layers create true three-dimensional depth.' },
    { heading: 'Limited Runs', body: 'Most designs are produced in quantities of 50 or fewer. Once sold out, they\'re gone.' },
];

function AddToCartBtn({ product, style = {} }) {
    const { t } = useDarkMode();
    const { addToCart, isInCart } = useCart();
    const inCart = isInCart(product.id);

    return (
        <button
            onClick={() => !inCart && addToCart(product.id)}
            style={{
                padding: '10px 18px', borderRadius: 8, border: 'none',
                background: inCart ? t.tagBg : t.primary,
                color: inCart ? t.primary : '#fff',
                fontWeight: 700, fontSize: 13, cursor: inCart ? 'default' : 'pointer',
                letterSpacing: 0.4, transition: 'all .2s',
                ...style,
            }}
        >
            {inCart ? 'In Cart ✓' : 'Add to Cart'}
        </button>
    );
}

function ProductCard({ product }) {
    const { t } = useDarkMode();
    return (
        <article style={{
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: 12,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            transition: 'transform .2s, box-shadow .2s',
        }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 16px 48px rgba(0,0,0,0.18)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
        >
            <Link to={`/products?id=${product.id}`} style={{ display: 'block', textDecoration: 'none' }}>
                <ShadowboxPreview product={product} />
            </Link>
            <div style={{ padding: 16, flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: t.text, lineHeight: 1.2 }}>{product.name}</div>
                        <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{product.franchise}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                        <span style={{ fontSize: 17, fontWeight: 800, color: t.primary }}>${product.price.toFixed(2)}</span>
                        {product.limited && (
                            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', padding: '2px 8px', borderRadius: 4, background: t.tagBg, color: t.primary }}>
                                Limited
                            </span>
                        )}
                    </div>
                </div>
                {(product.description != null && product.description !== '') && (
                    <p style={{ fontSize: 13, color: t.textMuted, margin: 0, lineHeight: 1.5, flex: 1 }}>
                        {(product.description || '').slice(0, 90)}…
                    </p>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <AddToCartBtn product={product} style={{ flex: 1 }} />
                    <Link to={`/products?id=${product.id}`} style={{
                        padding: '10px 14px', borderRadius: 8,
                        border: `1px solid ${t.border}`, background: 'transparent',
                        color: t.textMuted, fontSize: 12, fontWeight: 600, textDecoration: 'none',
                        display: 'flex', alignItems: 'center', whiteSpace: 'nowrap',
                    }}>
                        Details
                    </Link>
                </div>
            </div>
        </article>
    );
}

const Landing = () => {
    const { t } = useDarkMode();
    const { featured: FEATURED } = useProductStore();
    const [email, setEmail] = useState('');
    const [emailSent, setEmailSent] = useState(false);
    const [emailLoading, setEmailLoading] = useState(false);
    const [emailError, setEmailError] = useState('');
    const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
    const [isTablet, setIsTablet] = useState(window.innerWidth < 900);

    useEffect(() => {
        const onResize = () => {
            setIsMobile(window.innerWidth < 640);
            setIsTablet(window.innerWidth < 900);
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const heroBg = 'linear-gradient(160deg, #0D0E11 0%, #131525 40%, #1A1C2E 100%)';

    return (
        <div style={{ minHeight: '100vh', background: t.bg, color: t.text, display: 'flex', flexDirection: 'column' }}>
            <SiteHeader />

            {/* ── HERO WRAPPER — single gradient covers text + card strip ── */}
            <div style={{ background: heroBg, position: 'relative', overflow: 'hidden' }}>
                {/* Radial glow overlay */}
                <div style={{
                    position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
                    background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(109,129,187,0.22) 0%, transparent 65%)',
                }} />

            {/* ── HERO TEXT ── */}
            <section style={{
                padding: isMobile ? '52px 20px 36px' : 'clamp(60px, 8vw, 92px) 24px clamp(36px, 4vw, 48px)',
                textAlign: 'center',
                position: 'relative', zIndex: 1,
            }}>
                <div style={{ maxWidth: 680, margin: '0 auto' }}>
                    {!isMobile && (
                        <div style={{
                            display: 'inline-block', fontSize: 10, fontWeight: 800, letterSpacing: 3,
                            textTransform: 'uppercase', color: '#A5BFE3',
                            padding: '5px 14px', borderRadius: 99,
                            border: '1px solid rgba(165,191,227,0.25)',
                            background: 'rgba(165,191,227,0.08)',
                            marginBottom: 20,
                        }}>
                            Hand Crafted · One at a Time
                        </div>
                    )}
                    <h1 style={{
                        fontFamily: "'Big Shoulders Display', 'Bebas Neue', sans-serif",
                        fontSize: isMobile ? 'clamp(46px, 13vw, 64px)' : 'clamp(56px, 9vw, 92px)',
                        fontWeight: 900, lineHeight: 0.92,
                        letterSpacing: '-0.01em', margin: isMobile ? '0 0 16px' : '0 0 24px',
                        color: '#F3F1E4', textTransform: 'uppercase',
                    }}>
                        Premium<br />Shadowbox Cards
                    </h1>
                    <p style={{
                        fontSize: isMobile ? 14 : 'clamp(15px, 2vw, 17px)',
                        color: 'rgba(243,241,228,0.72)',
                        maxWidth: 480, margin: '0 auto',
                        lineHeight: 1.6,
                    }}>
                        Multi-layer, hand-assembled display pieces for video game characters,
                        anime icons, and esports legends.
                    </p>
                    <div style={{
                        display: 'flex', gap: 12, justifyContent: 'center',
                        flexDirection: isMobile ? 'column' : 'row',
                        marginTop: isMobile ? 24 : 32,
                        alignItems: 'center',
                    }}>
                        <Link to="/products" style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            background: '#F3F1E4', color: '#2A2A69',
                            padding: isMobile ? '13px 28px' : '14px 32px', borderRadius: 10,
                            fontWeight: 800, fontSize: isMobile ? 14 : 15, textDecoration: 'none',
                            letterSpacing: 0.4, width: isMobile ? '100%' : 'auto',
                            justifyContent: 'center',
                        }}>
                            Shop All Products
                        </Link>
                        <Link to="/gallery" style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            background: 'transparent', color: '#F3F1E4',
                            padding: isMobile ? '13px 28px' : '14px 32px', borderRadius: 10,
                            fontWeight: 700, fontSize: isMobile ? 14 : 15, textDecoration: 'none',
                            border: '1.5px solid rgba(243,241,228,0.30)',
                            letterSpacing: 0.4, width: isMobile ? '100%' : 'auto',
                            justifyContent: 'center',
                        }}>
                            View Gallery
                        </Link>
                    </div>
                </div>
            </section>

            {/* ── HERO CARD PREVIEW STRIP ── inside same gradient wrapper, never clipped ── */}
            <div style={{ position: 'relative', zIndex: 1, padding: isMobile ? '0 16px 48px' : '0 24px 60px' }}>
                <div style={{
                    display: 'flex', gap: isMobile ? 10 : 16,
                    justifyContent: 'center', flexWrap: 'nowrap',
                    overflowX: 'auto', overflowY: 'visible',
                    maxWidth: 760, margin: '0 auto',
                    WebkitOverflowScrolling: 'touch',
                    scrollbarWidth: 'none',
                    paddingBottom: 4,
                }}>
                    {FEATURED.slice(0, isMobile ? 3 : 4).map((p, i) => (
                        <Link key={p.id} to={`/products?id=${p.id}`} style={{
                            textDecoration: 'none', flexShrink: 0,
                            width: isMobile ? 'clamp(100px, 28vw, 136px)' : 'clamp(130px, 15vw, 164px)',
                            transition: 'opacity .2s',
                        }}
                            onMouseEnter={e => { e.currentTarget.style.opacity = '0.82'; }}
                            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                        >
                            <ShadowboxPreview product={p} minimal />
                        </Link>
                    ))}
                </div>
            </div>

            </div>{/* end hero wrapper */}

            <main style={{ flex: 1, maxWidth: 1180, margin: '0 auto', padding: isMobile ? '0 16px 64px' : '0 24px 100px', width: '100%', boxSizing: 'border-box' }}>

                {/* ── CATEGORIES ── */}
                <section style={{ marginTop: isMobile ? 40 : 64 }}>
                    <div style={{ textAlign: 'center', marginBottom: isMobile ? 24 : 36 }}>
                        <h2 style={{
                            fontFamily: "'Big Shoulders Display', 'Bebas Neue', sans-serif",
                            fontSize: isMobile ? 'clamp(28px, 8vw, 36px)' : 'clamp(32px, 5vw, 48px)',
                            fontWeight: 900, textTransform: 'uppercase',
                            margin: 0, color: t.text, letterSpacing: 0.5,
                        }}>
                            Browse by Category
                        </h2>
                        {!isMobile && (
                            <p style={{ color: t.textMuted, margin: '8px 0 0', fontSize: 14 }}>
                                Find the perfect piece for your collection
                            </p>
                        )}
                    </div>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(3, 1fr)' : 'repeat(3, 1fr)',
                        gap: isMobile ? 10 : 14,
                    }}>
                        {CATEGORY_TILES.map(cat => (
                            <Link key={cat.id} to={`/products?cat=${cat.id}`} style={{
                                textDecoration: 'none', background: cat.bg,
                                borderRadius: 12,
                                padding: isMobile ? '18px 20px' : 'clamp(20px, 3vw, 36px)',
                                position: 'relative', overflow: 'hidden',
                                border: `1px solid ${cat.accent}22`,
                                transition: 'transform .2s, box-shadow .2s',
                                display: 'flex', alignItems: isMobile ? 'center' : 'flex-start',
                                flexDirection: isMobile ? 'row' : 'column',
                                gap: isMobile ? 14 : 0,
                            }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 16px 40px ${cat.accent}20`; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                            >
                                <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 80% 80% at 100% 100%, ${cat.accent}18 0%, transparent 60%)`, pointerEvents: 'none' }} />
                                <div style={{ fontSize: isMobile ? 28 : 30, flexShrink: 0, position: 'relative' }}>{cat.icon}</div>
                                <div style={{ position: 'relative' }}>
                                    <div style={{
                                        fontFamily: "'Big Shoulders Display', 'Bebas Neue', sans-serif",
                                        fontSize: isMobile ? 20 : 'clamp(18px, 2.5vw, 26px)',
                                        fontWeight: 900, color: '#F3F1E4',
                                        textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 1,
                                    }}>
                                        {cat.label}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'rgba(243,241,228,0.55)', marginTop: 4 }}>{cat.desc}</div>
                                    {!isMobile && (
                                        <div style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 6,
                                            marginTop: 16, fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                                            color: cat.accent, textTransform: 'uppercase',
                                        }}>
                                            Shop Now →
                                        </div>
                                    )}
                                </div>
                                {isMobile && (
                                    <div style={{ marginLeft: 'auto', color: cat.accent, fontSize: 18, flexShrink: 0 }}>→</div>
                                )}
                            </Link>
                        ))}
                    </div>
                </section>

                {/* ── FEATURED DROPS ── */}
                <section style={{ marginTop: isMobile ? 40 : 72 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? 16 : 28, gap: 12 }}>
                        <h2 style={{
                            fontFamily: "'Big Shoulders Display', 'Bebas Neue', sans-serif",
                            fontSize: isMobile ? 'clamp(24px, 7vw, 32px)' : 'clamp(28px, 4vw, 40px)',
                            fontWeight: 900, textTransform: 'uppercase',
                            margin: 0, color: t.text, letterSpacing: 0.5,
                        }}>
                            Featured Drops
                        </h2>
                        <Link to="/products" style={{ fontSize: 13, fontWeight: 700, color: t.primary, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                            View all →
                        </Link>
                    </div>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(220px, 1fr))',
                        gap: isMobile ? 10 : 18,
                    }}>
                        {FEATURED.slice(0, isMobile ? 4 : undefined).map(product => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                </section>

                {/* ── CRAFTSMANSHIP ── */}
                <section style={{
                    marginTop: isMobile ? 40 : 80,
                    background: t.surface,
                    borderRadius: 16, overflow: 'hidden',
                    border: `1px solid ${t.border}`,
                }}>
                    <div style={{ padding: isMobile ? '28px 20px' : 'clamp(36px, 5vw, 64px)' }}>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                            gap: isMobile ? 28 : 'clamp(28px, 4vw, 64px)',
                            alignItems: 'center',
                        }}>
                            <div>
                                <div style={{
                                    fontSize: 10, fontWeight: 800, letterSpacing: 3,
                                    textTransform: 'uppercase', color: '#A5BFE3', marginBottom: 14,
                                }}>
                                    The STAKD Process
                                </div>
                                <h2 style={{
                                    fontFamily: "'Big Shoulders Display', 'Bebas Neue', sans-serif",
                                    fontSize: isMobile ? 'clamp(28px, 8vw, 40px)' : 'clamp(28px, 3.5vw, 48px)',
                                    fontWeight: 900, textTransform: 'uppercase',
                                    margin: '0 0 16px', color: '#F3F1E4',
                                    lineHeight: 0.95, letterSpacing: 0.5,
                                }}>
                                    Crafted by Hand.
                                </h2>
                                <p style={{ fontSize: isMobile ? 13 : 14, color: 'rgba(243,241,228,0.65)', lineHeight: 1.7, margin: 0 }}>
                                    Every STAKD card is precision-cut with a Silhouette 4 — multiple layers of cardstock and glossy adhesive vinyl, bonded with double-sided adhesive and finished with UV Krylon for lasting protection.
                                </p>
                                <Link to="/gallery" style={{
                                    display: 'inline-block', marginTop: 20,
                                    padding: '11px 24px', borderRadius: 10,
                                    background: 'transparent', color: '#F3F1E4',
                                    border: '1.5px solid rgba(243,241,228,0.30)',
                                    fontWeight: 700, fontSize: 13, textDecoration: 'none',
                                    letterSpacing: 0.4,
                                }}>
                                    See the Gallery
                                </Link>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: isMobile ? 10 : 14 }}>
                                {QUALITY_POINTS.map(q => (
                                    <div key={q.heading} style={{
                                        padding: isMobile ? '14px' : 'clamp(14px, 2vw, 22px)',
                                        background: 'rgba(255,255,255,0.04)',
                                        borderRadius: 10,
                                        border: '1px solid rgba(255,255,255,0.07)',
                                    }}>
                                        <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 800, color: '#F3F1E4', marginBottom: 6 }}>{q.heading}</div>
                                        <div style={{ fontSize: isMobile ? 11 : 12, color: 'rgba(243,241,228,0.55)', lineHeight: 1.55 }}>{q.body}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── NEWSLETTER ── */}
                <section style={{
                    marginTop: isMobile ? 40 : 64, textAlign: 'center',
                    padding: isMobile ? '32px 20px' : 'clamp(36px, 4vw, 56px) 24px',
                    background: t.surface, borderRadius: 14,
                    border: `1px solid ${t.border}`,
                }}>
                    <h2 style={{
                        fontFamily: "'Big Shoulders Display', 'Bebas Neue', sans-serif",
                        fontSize: isMobile ? 'clamp(22px, 7vw, 32px)' : 'clamp(24px, 3.5vw, 38px)',
                        fontWeight: 900, textTransform: 'uppercase',
                        margin: '0 0 8px', color: t.text, letterSpacing: 0.5,
                    }}>
                        Be First for New Drops
                    </h2>
                    <p style={{ color: t.textMuted, margin: '0 0 22px', fontSize: isMobile ? 13 : 14 }}>
                        Limited editions sell out fast. Get early access when new designs go live.
                    </p>
                    {emailSent ? (
                        <div style={{ fontSize: 15, color: t.primary, fontWeight: 700 }}>
                            You're on the list. We'll be in touch!
                        </div>
                    ) : (
                        <>
                        <form
                            onSubmit={async e => {
                                e.preventDefault();
                                if (!email) return;
                                setEmailLoading(true);
                                setEmailError('');
                                try {
                                    const res = await fetch('/api/subscribe', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ email }),
                                    });
                                    if (res.ok) {
                                        setEmailSent(true);
                                    } else {
                                        const data = await res.json().catch(() => ({}));
                                        setEmailError(data.error || 'Something went wrong. Please try again.');
                                    }
                                } catch {
                                    setEmailError('Network error. Please try again.');
                                } finally {
                                    setEmailLoading(false);
                                }
                            }}
                            style={{
                                display: 'flex', gap: 10,
                                maxWidth: 440, margin: '0 auto',
                                flexDirection: isMobile ? 'column' : 'row',
                            }}
                        >
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="your@email.com"
                                required
                                style={{
                                    flex: 1, padding: '12px 16px', borderRadius: 8,
                                    border: `1px solid ${t.inputBorder}`,
                                    background: t.inputBg, color: t.inputText,
                                    fontSize: 14, outline: 'none',
                                }}
                            />
                            <button type="submit" disabled={emailLoading} className="stakd-btn-primary" style={{
                                padding: '12px 24px', borderRadius: 8, border: 'none',
                                background: t.primary, color: '#fff',
                                fontWeight: 700, fontSize: 14, cursor: emailLoading ? 'wait' : 'pointer',
                                letterSpacing: 0.4, opacity: emailLoading ? 0.7 : 1,
                            }}>
                                {emailLoading ? 'Saving...' : 'Notify Me'}
                            </button>
                        </form>
                        {emailError && (
                            <p style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>{emailError}</p>
                        )}
                        </>
                    )}
                </section>
            </main>

            <Footer />
        </div>
    );
};

export default Landing;
