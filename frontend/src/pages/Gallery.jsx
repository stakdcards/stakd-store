import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import Footer from '../components/Footer';
import { ShadowboxPreview } from '../components/ShadowboxPreview';
import { useDarkMode } from '../contexts/DarkModeContext';
import { useCart } from '../contexts/CartContext';
import { useProductStore } from '../contexts/ProductStoreContext';

function getGalleryItems(products) {
    return [...products.filter(p => p.featured), ...products.filter(p => !p.featured)];
}

const SHOWCASE_QUOTES = [
    {
        text: "\"The s1mple piece is absolutely insane. The depth on this thing has to be seen in person. Easily the best purchase I've made this year.\"",
        author: 'Tyler M.',
        location: 'Las Vegas, NV',
    },
    {
        text: "\"Got the Gojo for my desk at work. Everyone who walks by stops to look at it. The craftsmanship is unlike anything I've seen.\"",
        author: 'Priya K.',
        location: 'Austin, TX',
    },
    {
        text: "\"Ordered the NAVI Collab Pack as a gift for my brother. He literally cried. The certificate of authenticity was a perfect touch.\"",
        author: 'Carlos R.',
        location: 'Chicago, IL',
    },
];

function GalleryCard({ product, large = false }) {
    const { t } = useDarkMode();
    const { addToCart, isInCart } = useCart();
    const inCart = isInCart(product.id);

    return (
        <div style={{
            position: 'relative',
            gridColumn: large ? 'span 2' : undefined,
            gridRow: large ? 'span 2' : undefined,
            borderRadius: 12,
            overflow: 'hidden',
            background: t.surface,
            border: `1px solid ${t.border}`,
            transition: 'transform .25s, box-shadow .25s',
            cursor: 'pointer',
        }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.01)'; e.currentTarget.style.boxShadow = '0 20px 60px rgba(0,0,0,0.3)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
        >
            <ShadowboxPreview product={product} />

            {/* Hover overlay */}
            <div className="gallery-overlay" style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 60%)',
                display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                padding: large ? 24 : 14,
                opacity: 0, transition: 'opacity .2s',
            }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0'}
            >
                <div style={{ fontSize: large ? 22 : 14, fontWeight: 900, color: '#F3F1E4', fontFamily: "'Big Shoulders Display', 'Bebas Neue', sans-serif", textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {product.name}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(243,241,228,0.7)', marginBottom: 12 }}>{product.franchise}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: product.accentColor }}>${product.price.toFixed(2)}</span>
                    {product.inStock ? (
                        <button
                            onClick={(e) => { e.stopPropagation(); addToCart(product.id); }}
                            style={{
                                padding: '7px 14px', borderRadius: 7, border: 'none',
                                background: inCart ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.9)',
                                color: inCart ? '#fff' : '#1A1C2E',
                                fontWeight: 700, fontSize: 12, cursor: 'pointer',
                                letterSpacing: 0.3,
                            }}
                        >
                            {inCart ? 'In Cart ✓' : 'Add to Cart'}
                        </button>
                    ) : (
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>Sold Out</span>
                    )}
                    <Link to={`/products?id=${product.id}`} style={{
                        padding: '7px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                        border: '1px solid rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.8)',
                        textDecoration: 'none',
                    }}>
                        Details
                    </Link>
                </div>
            </div>

        </div>
    );
}

const Gallery = () => {
    const { t } = useDarkMode();
    const { products, categories: CATEGORIES } = useProductStore();
    const [activeFilter, setActiveFilter] = useState('all');
    const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
        const onResize = () => setIsMobile(window.innerWidth < 640);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const galleryItems = getGalleryItems(products);
    const filtered = activeFilter === 'all'
        ? galleryItems
        : galleryItems.filter(p => p.category === activeFilter);

    return (
        <div style={{ minHeight: '100vh', background: t.bg, color: t.text, display: 'flex', flexDirection: 'column' }}>
            <SiteHeader />

            <main style={{ flex: 1 }}>
            {/* Hero */}
            <section style={{
                background: 'linear-gradient(160deg, #0D0E11 0%, #131525 60%, #0D0E11 100%)',
                padding: isMobile ? '44px 20px 36px' : 'clamp(48px, 7vw, 80px) 24px clamp(36px, 5vw, 60px)',
                textAlign: 'center',
                position: 'relative', overflow: 'hidden',
            }}>
                <div style={{
                    position: 'absolute', inset: 0, pointerEvents: 'none',
                    background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(109,129,187,0.2) 0%, transparent 70%)',
                }} />
                <div style={{ position: 'relative' }}>
                    {!isMobile && (
                        <div style={{
                            fontSize: 10, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase',
                            color: '#A5BFE3', marginBottom: 16,
                        }}>
                            The STAKD Collection
                        </div>
                    )}
                    <h1 style={{
                        fontFamily: "'Big Shoulders Display', 'Bebas Neue', sans-serif",
                        fontSize: isMobile ? 'clamp(38px, 12vw, 56px)' : 'clamp(44px, 8vw, 80px)',
                        fontWeight: 900, textTransform: 'uppercase',
                        margin: isMobile ? '0 0 12px' : '0 0 16px', color: '#F3F1E4',
                        lineHeight: 0.92, letterSpacing: '-0.01em',
                    }}>
                        The Gallery
                    </h1>
                    <p style={{ fontSize: isMobile ? 13 : 'clamp(14px, 2vw, 16px)', color: 'rgba(243,241,228,0.65)', maxWidth: 420, margin: '0 auto' }}>
                        Every STAKD piece in full detail. {isMobile ? 'Tap to add to cart.' : 'Hover to add to cart.'}
                    </p>
                </div>
            </section>

            <div style={{ maxWidth: 1180, margin: '0 auto', padding: isMobile ? '20px 14px 60px' : '36px 20px 80px' }}>

                {/* Category filter */}
                <div style={{
                    display: 'flex', gap: isMobile ? 6 : 8,
                    marginBottom: isMobile ? 20 : 36,
                    flexWrap: 'wrap', justifyContent: 'center',
                }}>
                    {CATEGORIES.map(cat => (
                        <button key={cat.id} onClick={() => setActiveFilter(cat.id)} style={{
                            padding: isMobile ? '7px 14px' : '8px 20px',
                            borderRadius: 99, fontSize: isMobile ? 12 : 13, fontWeight: 700,
                            border: `1.5px solid ${activeFilter === cat.id ? t.primary : t.border}`,
                            background: activeFilter === cat.id ? t.tagBg : 'transparent',
                            color: activeFilter === cat.id ? t.primary : t.textMuted,
                            cursor: 'pointer', letterSpacing: 0.3, transition: 'all .15s',
                        }}>
                            {cat.label}
                        </button>
                    ))}
                </div>

                {/* Grid — 2 cols on mobile, masonry-style on desktop */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile
                        ? 'repeat(2, 1fr)'
                        : 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: isMobile ? 10 : 14,
                }}>
                    {filtered.map((product, i) => (
                        <GalleryCard key={product.id} product={product} large={!isMobile && (i === 0 || i === 7)} />
                    ))}
                </div>

                {/* Testimonials */}
                <section style={{ marginTop: isMobile ? 44 : 72 }}>
                    <h2 style={{
                        fontFamily: "'Big Shoulders Display', 'Bebas Neue', sans-serif",
                        fontSize: isMobile ? 'clamp(24px, 7vw, 32px)' : 'clamp(26px, 3.5vw, 38px)',
                        fontWeight: 900, textTransform: 'uppercase',
                        margin: isMobile ? '0 0 20px' : '0 0 28px', color: t.text,
                        textAlign: 'center', letterSpacing: 0.5,
                    }}>
                        Collector Reviews
                    </h2>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(240px, 1fr))', gap: isMobile ? 10 : 16 }}>
                        {SHOWCASE_QUOTES.map((q) => (
                            <div key={q.author} style={{
                                padding: isMobile ? '16px' : 'clamp(18px, 2.5vw, 28px)',
                                background: t.surface, borderRadius: 12,
                                border: `1px solid ${t.border}`,
                            }}>
                                <p style={{ fontSize: isMobile ? 13 : 14, color: t.textSecondary, lineHeight: 1.65, margin: isMobile ? '0 0 14px' : '0 0 18px', fontStyle: 'italic' }}>
                                    {q.text}
                                </p>
                                <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{q.author}</div>
                                <div style={{ fontSize: 11, color: t.textMuted }}>{q.location}</div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* CTA */}
                <section style={{
                    marginTop: isMobile ? 36 : 56, textAlign: 'center',
                    padding: isMobile ? '28px 20px' : 'clamp(36px, 4vw, 56px) 24px',
                    background: t.surface, borderRadius: 14, border: `1px solid ${t.border}`,
                }}>
                    <h2 style={{
                        fontFamily: "'Big Shoulders Display', 'Bebas Neue', sans-serif",
                        fontSize: isMobile ? 'clamp(22px, 7vw, 32px)' : 'clamp(24px, 3.5vw, 38px)',
                        fontWeight: 900, textTransform: 'uppercase',
                        margin: '0 0 10px', color: t.text, letterSpacing: 0.5,
                    }}>
                        Ready to Own One?
                    </h2>
                    <p style={{ color: t.textMuted, margin: '0 0 22px', fontSize: isMobile ? 13 : 14 }}>
                        All pieces are available to order now. Limited editions will sell out.
                    </p>
                    <Link to="/products" style={{
                        display: 'inline-block',
                        padding: isMobile ? '13px 28px' : '13px 32px', borderRadius: 10,
                        background: t.primary, color: '#fff',
                        fontWeight: 800, fontSize: isMobile ? 14 : 15, textDecoration: 'none',
                        letterSpacing: 0.4, width: isMobile ? '100%' : 'auto', boxSizing: 'border-box',
                    }}>
                        Shop All Products
                    </Link>
                </section>
            </div>

            </main>

            <Footer />

            <style>{`
                .gallery-overlay:hover { opacity: 1 !important; }
            `}</style>
        </div>
    );
};

export default Gallery;
