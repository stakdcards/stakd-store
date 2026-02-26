import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import Footer from '../components/Footer';
import { ShadowboxPreview } from '../components/ShadowboxPreview';
import { useDarkMode } from '../contexts/DarkModeContext';
import { useCart } from '../contexts/CartContext';
import { useProductStore } from '../contexts/ProductStoreContext';

const SORT_OPTIONS = [
    { value: 'featured', label: 'Featured' },
    { value: 'price-asc', label: 'Price: Low to High' },
    { value: 'price-desc', label: 'Price: High to Low' },
    { value: 'name', label: 'Name A–Z' },
];

function sortProducts(products, sort) {
    const p = [...products];
    if (sort === 'price-asc') return p.sort((a, b) => a.price - b.price);
    if (sort === 'price-desc') return p.sort((a, b) => b.price - a.price);
    if (sort === 'name') return p.sort((a, b) => a.name.localeCompare(b.name));
    return p.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
}

function ProductCard({ product }) {
    const { t } = useDarkMode();
    const { addToCart, isInCart } = useCart();
    const inCart = isInCart(product.id);
    const isMobile = window.innerWidth < 640;

    return (
        <article className="stakd-card" style={{
            background: t.surface, border: `1px solid ${t.border}`,
            borderRadius: 12, overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
        }}>
            <Link to={`?id=${product.id}`} style={{ display: 'block', textDecoration: 'none' }}>
                <ShadowboxPreview product={product} />
            </Link>
            <div style={{ padding: isMobile ? 10 : 14, flex: 1, display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: t.text, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {product.name}
                        </div>
                        {!isMobile && <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{product.franchise}</div>}
                    </div>
                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                        <div style={{ fontSize: isMobile ? 14 : 15, fontWeight: 800, color: t.primary }}>${product.price.toFixed(2)}</div>
                        {product.limited && <div style={{ fontSize: 8, fontWeight: 800, color: t.primary, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 2 }}>Limited</div>}
                    </div>
                </div>
                {!isMobile && (product.description != null && product.description !== '') && (
                    <p style={{ fontSize: 12, color: t.textMuted, margin: 0, lineHeight: 1.5, flex: 1 }}>
                        {(product.description || '').slice(0, 80)}…
                    </p>
                )}
                <div style={{ display: 'flex', gap: isMobile ? 6 : 8 }}>
                    <button
                        disabled={!product.inStock}
                        onClick={() => product.inStock && !inCart && addToCart(product.id)}
                        className={product.inStock && !inCart ? 'stakd-btn-primary' : ''}
                        style={{
                            flex: 1, padding: isMobile ? '8px 8px' : '9px 12px', borderRadius: 8, border: 'none',
                            background: !product.inStock ? t.surfaceAlt : inCart ? t.tagBg : t.primary,
                            color: !product.inStock ? t.textFaint : inCart ? t.primary : '#fff',
                            fontWeight: 700, fontSize: isMobile ? 11 : 12,
                            cursor: !product.inStock ? 'not-allowed' : inCart ? 'default' : 'pointer',
                            letterSpacing: 0.3,
                        }}
                    >
                        {!product.inStock ? 'Sold Out' : inCart ? 'In Cart ✓' : 'Add to Cart'}
                    </button>
                    <Link to={`?id=${product.id}`} style={{
                        padding: isMobile ? '8px 8px' : '9px 12px', borderRadius: 8, fontSize: isMobile ? 11 : 12, fontWeight: 600,
                        border: `1px solid ${t.border}`, color: t.textMuted, textDecoration: 'none',
                        display: 'flex', alignItems: 'center',
                    }}>
                        Details
                    </Link>
                </div>
            </div>
        </article>
    );
}

function ProductDetail({ product, onClose }) {
    const { t } = useDarkMode();
    const { addToCart, isInCart, removeFromCart } = useCart();
    const inCart = isInCart(product.id);
    const isMobile = window.innerWidth < 640;

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20, background: t.dimOverlay }}
            onClick={onClose}>
            <div style={{
                background: t.surface,
                borderRadius: isMobile ? '18px 18px 0 0' : 18,
                maxWidth: isMobile ? '100%' : 780,
                width: '100%',
                maxHeight: isMobile ? '92vh' : '92vh',
                overflow: 'auto',
                border: `1px solid ${t.border}`,
                boxShadow: '0 32px 80px rgba(0,0,0,0.4)',
            }} onClick={e => e.stopPropagation()}>
                {isMobile ? (
                    /* ── Mobile: stacked layout ── */
                    <div style={{ position: 'relative' }}>
                        {/* Pull bar */}
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
                            <div style={{ width: 40, height: 4, borderRadius: 99, background: t.border }} />
                        </div>
                        <button onClick={onClose} style={{
                            position: 'absolute', top: 12, right: 16,
                            width: 32, height: 32, borderRadius: 8, border: `1px solid ${t.border}`,
                            background: t.surfaceAlt, color: t.textMuted, cursor: 'pointer',
                            fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>×</button>
                        <div style={{ padding: '4px 20px 0', maxWidth: 220, margin: '0 auto' }}>
                            <ShadowboxPreview product={product} />
                        </div>
                        <div style={{ padding: '16px 20px 32px' }}>
                            <div style={{ fontSize: 10, fontWeight: 800, color: t.primary, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>{product.franchise}</div>
                            <h2 style={{ fontFamily: "'Big Shoulders Display', 'Bebas Neue', sans-serif", fontSize: 'clamp(26px, 7vw, 36px)', fontWeight: 900, textTransform: 'uppercase', margin: '0 0 4px', color: t.text, lineHeight: 1 }}>{product.name}</h2>
                            {product.subtitle && <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 12 }}>{product.subtitle}</div>}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                                <span style={{ fontSize: 24, fontWeight: 900, color: t.primary }}>${product.price.toFixed(2)}</span>
                                {product.limited && <span style={{ fontSize: 10, fontWeight: 800, color: t.primary, letterSpacing: 1, textTransform: 'uppercase', padding: '3px 8px', borderRadius: 5, background: t.tagBg }}>Limited</span>}
                                {!product.inStock && <span style={{ fontSize: 10, fontWeight: 800, color: '#ef4444', padding: '3px 8px', borderRadius: 5, background: '#ef444418' }}>Sold Out</span>}
                            </div>
                            <p style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.6, margin: '0 0 16px' }}>{product.description}</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                                {[{ label: 'Dimensions', value: product.dimensions }, { label: 'Materials', value: product.materials }].map(({ label, value }) => (
                                    <div key={label} style={{ display: 'flex', gap: 10, fontSize: 12 }}>
                                        <span style={{ color: t.textFaint, fontWeight: 600, minWidth: 80 }}>{label}</span>
                                        <span style={{ color: t.textSecondary }}>{value}</span>
                                    </div>
                                ))}
                            </div>
                            {product.inStock ? (
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <button onClick={() => inCart ? removeFromCart(product.id) : addToCart(product.id)}
                                        style={{ flex: 1, padding: '13px 16px', borderRadius: 10, border: 'none', background: inCart ? t.tagBg : t.primary, color: inCart ? t.primary : '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
                                        {inCart ? 'Remove from Cart' : 'Add to Cart'}
                                    </button>
                                    {inCart && (
                                        <Link to="/cart" onClick={onClose} style={{ padding: '13px 16px', borderRadius: 10, border: `1.5px solid ${t.primary}`, color: t.primary, fontWeight: 700, fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                                            View Cart
                                        </Link>
                                    )}
                                </div>
                            ) : (
                                <div style={{ padding: '13px 20px', borderRadius: 10, background: t.surfaceAlt, textAlign: 'center', fontSize: 14, color: t.textMuted, fontWeight: 600 }}>Currently Unavailable</div>
                            )}
                        </div>
                    </div>
                ) : (
                /* ── Desktop: side-by-side layout ── */
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', position: 'relative' }}>
                    <div style={{ padding: 'clamp(20px, 3vw, 36px)' }}>
                        <ShadowboxPreview product={product} />
                    </div>
                    <div style={{ padding: 'clamp(20px, 3vw, 36px)', borderLeft: `1px solid ${t.border}` }}>
                        <button onClick={onClose} style={{
                            position: 'absolute', top: 20, right: 20,
                            width: 32, height: 32, borderRadius: 8, border: `1px solid ${t.border}`,
                            background: t.surfaceAlt, color: t.textMuted, cursor: 'pointer',
                            fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>×</button>

                        <div style={{ fontSize: 11, fontWeight: 800, color: t.primary, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>
                            {product.franchise}
                        </div>
                        <h2 style={{
                            fontFamily: "'Big Shoulders Display', 'Bebas Neue', sans-serif",
                            fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 900,
                            textTransform: 'uppercase', margin: '0 0 4px', color: t.text, lineHeight: 1,
                        }}>
                            {product.name}
                        </h2>
                        {product.subtitle && (
                            <div style={{ fontSize: 14, color: t.textMuted, marginBottom: 20 }}>{product.subtitle}</div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                            <span style={{ fontSize: 28, fontWeight: 900, color: t.primary }}>${product.price.toFixed(2)}</span>
                            {product.limited && (
                                <span style={{ fontSize: 11, fontWeight: 800, color: t.primary, letterSpacing: 1, textTransform: 'uppercase', padding: '4px 10px', borderRadius: 6, background: t.tagBg }}>
                                    Limited Edition
                                </span>
                            )}
                            {!product.inStock && (
                                <span style={{ fontSize: 11, fontWeight: 800, color: '#ef4444', letterSpacing: 1, textTransform: 'uppercase', padding: '4px 10px', borderRadius: 6, background: '#ef444418' }}>
                                    Sold Out
                                </span>
                            )}
                        </div>

                        <p style={{ fontSize: 14, color: t.textMuted, lineHeight: 1.7, margin: '0 0 24px' }}>
                            {product.description}
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
                            {[
                                { label: 'Dimensions', value: product.dimensions },
                                { label: 'Materials', value: product.materials },
                                { label: 'Category', value: CATEGORIES.find(c => c.id === product.category)?.label },
                            ].map(({ label, value }) => (
                                <div key={label} style={{ display: 'flex', gap: 12, fontSize: 13 }}>
                                    <span style={{ color: t.textFaint, fontWeight: 600, minWidth: 80 }}>{label}</span>
                                    <span style={{ color: t.textSecondary }}>{value}</span>
                                </div>
                            ))}
                        </div>

                        {product.inStock ? (
                            <div style={{ display: 'flex', gap: 10 }}>
                                <button
                                    onClick={() => inCart ? removeFromCart(product.id) : addToCart(product.id)}
                                    style={{
                                        flex: 1, padding: '13px 20px', borderRadius: 10, border: 'none',
                                        background: inCart ? t.tagBg : t.primary,
                                        color: inCart ? t.primary : '#fff',
                                        fontWeight: 800, fontSize: 14, cursor: 'pointer',
                                        letterSpacing: 0.5,
                                    }}
                                >
                                    {inCart ? 'Remove from Cart' : 'Add to Cart'}
                                </button>
                                {inCart && (
                                    <Link to="/cart" style={{
                                        padding: '13px 18px', borderRadius: 10,
                                        border: `1.5px solid ${t.primary}`,
                                        color: t.primary, fontWeight: 700, fontSize: 14,
                                        textDecoration: 'none', display: 'flex', alignItems: 'center',
                                    }}>
                                        View Cart
                                    </Link>
                                )}
                            </div>
                        ) : (
                            <div style={{ padding: '13px 20px', borderRadius: 10, background: t.surfaceAlt, textAlign: 'center', fontSize: 14, color: t.textMuted, fontWeight: 600 }}>
                                Currently Unavailable
                            </div>
                        )}
                    </div>
                </div>
                )}
            </div>
        </div>
    );
}

const Products = () => {
    const { t } = useDarkMode();
    const { products: PRODUCTS, getProductsByCategory, categories: CATEGORIES } = useProductStore();
    const [searchParams, setSearchParams] = useSearchParams();
    const [sort, setSort] = useState('featured');
    const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

    // Scroll to top on mount so category links from Landing always start at top
    useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, []);

    const activeCat = searchParams.get('cat') || 'all';
    const openProductId = searchParams.get('id');

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 640);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const baseProducts = getProductsByCategory(activeCat);
    const displayProducts = sortProducts(baseProducts, sort);
    const openProduct = openProductId ? PRODUCTS.find(p => p.id === openProductId) : null;

    const setCategory = (cat) => {
        const next = new URLSearchParams(searchParams);
        if (cat === 'all') next.delete('cat'); else next.set('cat', cat);
        next.delete('id');
        setSearchParams(next);
    };

    const closeDetail = () => {
        const next = new URLSearchParams(searchParams);
        next.delete('id');
        setSearchParams(next);
    };

    return (
        <div style={{ minHeight: '100vh', background: t.bg, color: t.text, display: 'flex', flexDirection: 'column' }}>
            <SiteHeader />

            {openProduct && <ProductDetail product={openProduct} onClose={closeDetail} />}

            <main style={{ flex: 1 }}>
            {/* Page header */}
            <div style={{
                borderBottom: `1px solid ${t.border}`,
                padding: isMobile ? '24px 16px 0' : 'clamp(28px, 4vw, 48px) 24px 0',
                maxWidth: 1180, margin: '0 auto',
            }}>
                <h1 style={{
                    fontFamily: "'Big Shoulders Display', 'Bebas Neue', sans-serif",
                    fontSize: isMobile ? 'clamp(30px, 9vw, 44px)' : 'clamp(36px, 6vw, 60px)',
                    fontWeight: 900, textTransform: 'uppercase',
                    margin: '0 0 4px', color: t.text, letterSpacing: 0.5,
                }}>
                    Shop All Products
                </h1>
                {!isMobile && (
                    <p style={{ color: t.textMuted, margin: '0 0 24px', fontSize: 14 }}>
                        Hand-crafted shadowbox cards for collectors and fans.
                    </p>
                )}

                {/* Category filter tabs */}
                <div style={{
                    display: 'flex', gap: isMobile ? 4 : 6,
                    overflowX: 'auto', paddingBottom: 0, marginBottom: -1,
                    marginTop: isMobile ? 16 : 0,
                    scrollbarWidth: 'none',
                }}>
                    {CATEGORIES.map(cat => (
                        <button key={cat.id} onClick={() => setCategory(cat.id)} style={{
                            padding: isMobile ? '9px 14px' : '9px 20px',
                            borderRadius: '8px 8px 0 0',
                            border: `1px solid ${activeCat === cat.id ? t.border : 'transparent'}`,
                            borderBottom: `1px solid ${activeCat === cat.id ? t.bg : 'transparent'}`,
                            background: activeCat === cat.id ? t.bg : 'transparent',
                            color: activeCat === cat.id ? t.primary : t.textMuted,
                            fontWeight: 700, fontSize: isMobile ? 12 : 13, cursor: 'pointer',
                            letterSpacing: 0.3, whiteSpace: 'nowrap',
                            transition: 'all .15s',
                        }}>
                            {cat.label}
                            {!isMobile && (
                                <span style={{ marginLeft: 5, fontSize: 10, opacity: 0.6 }}>
                                    ({getProductsByCategory(cat.id).length})
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ maxWidth: 1180, margin: '0 auto', padding: isMobile ? '16px 16px 60px' : '24px 24px 80px' }}>
                {/* Sort bar */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: isMobile ? 16 : 24, gap: 10,
                }}>
                    <div style={{ fontSize: 12, color: t.textMuted }}>
                        <strong style={{ color: t.text }}>{displayProducts.length}</strong> items
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {!isMobile && <span style={{ fontSize: 13, color: t.textMuted }}>Sort by</span>}
                        <select
                            value={sort}
                            onChange={e => setSort(e.target.value)}
                            style={{
                                padding: isMobile ? '6px 10px' : '7px 12px',
                                borderRadius: 8, fontSize: isMobile ? 12 : 13, fontWeight: 600,
                                border: `1px solid ${t.border}`, background: t.surface, color: t.text,
                                cursor: 'pointer', outline: 'none',
                            }}
                        >
                            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                </div>

                {/* Product grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile
                        ? 'repeat(2, 1fr)'
                        : 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: isMobile ? 10 : 18,
                }}>
                    {displayProducts.map(product => (
                        <ProductCard key={product.id} product={product} />
                    ))}
                </div>
            </div>
            </main>
            <Footer />
        </div>
    );
};

export default Products;
