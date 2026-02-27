import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import Footer from '../components/Footer';
import { ShadowboxPreview } from '../components/ShadowboxPreview';
import { useDarkMode } from '../contexts/DarkModeContext';
import { useCart } from '../contexts/CartContext';
import { useProductStore } from '../contexts/ProductStoreContext';
import { track } from '../lib/posthog';

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
    const firstImageUrl = (product.images && product.images.length > 0 && (product.images[0].url || product.images[0].dataUrl))
        ? (product.images[0].url || product.images[0].dataUrl)
        : null;

    return (
        <article className="stakd-card" style={{
            background: t.surface, border: `1px solid ${t.border}`,
            borderRadius: 12, overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
        }}>
            <Link to={`?id=${product.id}`} style={{ display: 'block', textDecoration: 'none' }}>
                {firstImageUrl ? (
                    <div style={{ aspectRatio: '3/4', overflow: 'hidden', background: t.surfaceAlt }}>
                        <img src={firstImageUrl} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                ) : (
                    <ShadowboxPreview product={product} />
                )}
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
                <div style={{ display: 'flex', gap: isMobile ? 6 : 8, flexWrap: 'wrap', minWidth: 0 }}>
                    <button
                        disabled={!product.inStock}
                        onClick={() => { if (product.inStock && !inCart) { addToCart(product.id); track('product_added_to_cart', { product_id: product.id, name: product.name, price: product.price }); } }}
                        className={product.inStock && !inCart ? 'stakd-btn-primary' : ''}
                        style={{
                            flex: '1 1 auto', minWidth: isMobile ? 0 : 80, padding: isMobile ? '8px 10px' : '9px 12px', borderRadius: 8, border: 'none',
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
                        flex: '0 0 auto', padding: isMobile ? '8px 10px' : '9px 12px', borderRadius: 8, fontSize: isMobile ? 11 : 12, fontWeight: 600,
                        border: `1px solid ${t.border}`, color: t.textMuted, textDecoration: 'none',
                        display: 'flex', alignItems: 'center', whiteSpace: 'nowrap',
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
    const { categories } = useProductStore();
    const inCart = isInCart(product.id);
    const isMobile = window.innerWidth < 640;
    const images = (product.images && Array.isArray(product.images)) ? product.images.filter(img => img.url || img.dataUrl) : [];
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    const [fullscreenOpen, setFullscreenOpen] = useState(false);
    useEffect(() => { setSelectedImageIndex(0); }, [product.id]);

    useEffect(() => {
        if (!fullscreenOpen) return;
        const onKey = (e) => {
            if (e.key === 'Escape') setFullscreenOpen(false);
            if (images.length <= 1) return;
            if (e.key === 'ArrowLeft') setSelectedImageIndex(i => (i - 1 + images.length) % images.length);
            if (e.key === 'ArrowRight') setSelectedImageIndex(i => (i + 1) % images.length);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [fullscreenOpen, images.length]);

    const hasGallery = images.length > 0;
    const mainImageUrl = hasGallery && images[selectedImageIndex] ? (images[selectedImageIndex].url || images[selectedImageIndex].dataUrl) : null;

    const goPrev = () => setSelectedImageIndex(i => (i - 1 + images.length) % images.length);
    const goNext = () => setSelectedImageIndex(i => (i + 1) % images.length);

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20, background: t.dimOverlay }}
            onClick={onClose}>
            {/* Fullscreen image viewer */}
            {fullscreenOpen && hasGallery && (
                <div
                    style={{
                        position: 'fixed', inset: 0, zIndex: 400,
                        background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 48,
                    }}
                    onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) setFullscreenOpen(false); }}
                >
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setFullscreenOpen(false); }}
                        style={{
                            position: 'absolute', top: 16, right: 16, width: 44, height: 44,
                            borderRadius: '50%', border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)',
                            color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: 0, lineHeight: 0,
                        }}
                        aria-label="Close"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ display: 'block' }}>
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                    {images.length > 1 && (
                        <>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); goPrev(); }}
                                style={{
                                    position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
                                    width: 48, height: 48, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)',
                                    color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    padding: 0, lineHeight: 0,
                                }}
                                aria-label="Previous image"
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                                    <path d="M15 18l-6-6 6-6" />
                                </svg>
                            </button>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); goNext(); }}
                                style={{
                                    position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
                                    width: 48, height: 48, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)',
                                    color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    padding: 0, lineHeight: 0,
                                }}
                                aria-label="Next image"
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                                    <path d="M9 6l6 6-6 6" />
                                </svg>
                            </button>
                        </>
                    )}
                    <img
                        src={mainImageUrl}
                        alt={product.name}
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                        onClick={(e) => e.stopPropagation()}
                    />
                    {images.length > 1 && (
                        <div style={{
                            position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
                            fontSize: 13, color: 'rgba(255,255,255,0.7)',
                        }}>
                            {selectedImageIndex + 1} / {images.length}
                        </div>
                    )}
                </div>
            )}
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
                            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 0,
                        }} aria-label="Close">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                                <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                        </button>
                        <div style={{ padding: '4px 20px 0', maxWidth: 220, margin: '0 auto' }}>
                            {hasGallery ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <button type="button" onClick={() => setFullscreenOpen(true)} title="View fullscreen" style={{ position: 'relative', aspectRatio: '3/4', borderRadius: 8, overflow: 'hidden', background: t.surfaceAlt, padding: 0, border: 'none', cursor: 'pointer', display: 'block', width: '100%' }}>
                                        <img src={mainImageUrl} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        <span style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 6, background: 'rgba(0,0,0,0.5)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 0 }} aria-hidden>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                                                <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
                                            </svg>
                                        </span>
                                    </button>
                                    {images.length > 1 && (
                                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                                            {images.map((img, i) => (
                                                <button key={img.id} type="button" onClick={() => setSelectedImageIndex(i)} style={{
                                                    width: 44, height: 44, padding: 0, border: `2px solid ${i === selectedImageIndex ? t.primary : t.border}`,
                                                    borderRadius: 6, overflow: 'hidden', background: t.surfaceAlt, cursor: 'pointer',
                                                }}>
                                                    <img src={img.url || img.dataUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <ShadowboxPreview product={product} />
                            )}
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
                                {[
                                    { label: 'Dimensions', value: product.dimensions },
                                    { label: 'Materials', value: product.materials },
                                    { label: 'Category', value: categories.find(c => c.id === product.category)?.label },
                                ].map(({ label, value }) => (
                                    <div key={label} style={{ display: 'flex', gap: 10, fontSize: 12 }}>
                                        <span style={{ color: t.textFaint, fontWeight: 600, minWidth: 80 }}>{label}</span>
                                        <span style={{ color: t.textMuted }}>{value || '—'}</span>
                                    </div>
                                ))}
                            </div>
                            {product.inStock ? (
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <button onClick={() => { if (inCart) { removeFromCart(product.id); } else { addToCart(product.id); track('product_added_to_cart', { product_id: product.id, name: product.name, price: product.price }); } }}
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
                    <div style={{ padding: 'clamp(20px, 3vw, 36px)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {hasGallery ? (
                            <>
                                <button type="button" onClick={() => setFullscreenOpen(true)} title="View fullscreen" style={{ position: 'relative', aspectRatio: '3/4', borderRadius: 10, overflow: 'hidden', background: t.surfaceAlt, padding: 0, border: 'none', cursor: 'pointer', display: 'block', width: '100%' }}>
                                    <img src={mainImageUrl} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    <span style={{ position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 8, background: 'rgba(0,0,0,0.5)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 0 }} aria-hidden>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                                            <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
                                        </svg>
                                    </span>
                                </button>
                                {images.length > 1 && (
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        {images.map((img, i) => (
                                            <button key={img.id} type="button" onClick={() => setSelectedImageIndex(i)} style={{
                                                width: 52, height: 52, padding: 0, border: `2px solid ${i === selectedImageIndex ? t.primary : t.border}`,
                                                borderRadius: 8, overflow: 'hidden', background: t.surfaceAlt, cursor: 'pointer',
                                            }}>
                                                <img src={img.url || img.dataUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            <ShadowboxPreview product={product} />
                        )}
                    </div>
                    <div style={{ padding: 'clamp(20px, 3vw, 36px)', borderLeft: `1px solid ${t.border}` }}>
                        <button onClick={onClose} style={{
                            position: 'absolute', top: 20, right: 20,
                            width: 32, height: 32, borderRadius: 8, border: `1px solid ${t.border}`,
                            background: t.surfaceAlt, color: t.textMuted, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 0,
                        }} aria-label="Close">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                                <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                        </button>

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
                                { label: 'Category', value: categories.find(c => c.id === product.category)?.label },
                            ].map(({ label, value }) => (
                                <div key={label} style={{ display: 'flex', gap: 12, fontSize: 13 }}>
                                    <span style={{ color: t.textFaint, fontWeight: 600, minWidth: 80 }}>{label}</span>
                                    <span style={{ color: t.textMuted }}>{value || '—'}</span>
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

export { ProductDetail };
export default Products;
