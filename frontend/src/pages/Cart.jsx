import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import Footer from '../components/Footer';
import { ShadowboxPreview } from '../components/ShadowboxPreview';
import { useDarkMode } from '../contexts/DarkModeContext';
import { useCart } from '../contexts/CartContext';

const SHIPPING_OPTIONS = [
    { id: 'standard', label: 'Standard Shipping (5–8 business days)', price: 0 },
    { id: 'expedited', label: 'Expedited Shipping (2–3 business days)', price: 19.99 },
    { id: 'overnight', label: 'Overnight (next business day)', price: 39.99 },
];

const STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

function CartItem({ item }) {
    const { t } = useDarkMode();
    const { updateQuantity, removeFromCart } = useCart();
    const { product, quantity } = item;

    const isNarrow = window.innerWidth < 480;
    return (
        <div style={{
            display: 'grid', gridTemplateColumns: isNarrow ? '80px 1fr' : '100px 1fr',
            gap: isNarrow ? 12 : 16, padding: isNarrow ? '16px 0' : '20px 0',
            borderBottom: `1px solid ${t.border}`,
        }}>
            <div style={{ borderRadius: 8, overflow: 'hidden' }}>
                <ShadowboxPreview product={product} minimal />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                        <div style={{
                            fontFamily: "'Big Shoulders Display', 'Bebas Neue', sans-serif",
                            fontSize: 18, fontWeight: 900, color: t.text,
                            textTransform: 'uppercase', lineHeight: 1, letterSpacing: 0.5,
                        }}>
                            {product.name}
                        </div>
                        <div style={{ fontSize: 12, color: t.textMuted, marginTop: 3 }}>
                            {product.franchise} · {product.dimensions}
                        </div>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: t.primary, flexShrink: 0 }}>
                        ${(product.price * quantity).toFixed(2)}
                    </div>
                </div>

                {product.limited && (
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: t.primary, padding: '2px 8px', borderRadius: 4, background: t.tagBg, alignSelf: 'flex-start' }}>
                        Limited Edition
                    </span>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                    {/* Qty */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 1, border: `1px solid ${t.border}`, borderRadius: 8, overflow: 'hidden' }}>
                        <button
                            onClick={() => quantity > 1 ? updateQuantity(product.id, quantity - 1) : removeFromCart(product.id)}
                            style={{ width: 32, height: 32, background: 'transparent', border: 'none', color: t.text, cursor: 'pointer', fontSize: 16, fontWeight: 600 }}
                        >−</button>
                        <span style={{ width: 36, textAlign: 'center', fontSize: 14, fontWeight: 700, color: t.text }}>{quantity}</span>
                        <button
                            onClick={() => updateQuantity(product.id, quantity + 1)}
                            style={{ width: 32, height: 32, background: 'transparent', border: 'none', color: t.text, cursor: 'pointer', fontSize: 16, fontWeight: 600 }}
                        >+</button>
                    </div>
                    <button
                        onClick={() => removeFromCart(product.id)}
                        style={{ background: 'none', border: 'none', color: t.textFaint, cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0 }}
                    >
                        Remove
                    </button>
                </div>
            </div>
        </div>
    );
}

const Cart = () => {
    const { t } = useDarkMode();
    const { cartItems, cartSubtotal, clearCart } = useCart();
    const [shipping, setShipping] = useState('standard');
    const [step, setStep] = useState('cart'); // cart | checkout | confirmed
    const [isMobile, setIsMobile] = useState(window.innerWidth < 700);

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 700);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    const [form, setForm] = useState({
        firstName: '', lastName: '', email: '', phone: '',
        address: '', city: '', state: '', zip: '', country: 'US',
        cardNumber: '', cardExpiry: '', cardCvc: '', cardName: '',
    });
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [stripeRedirecting, setStripeRedirecting] = useState(false);

    const selectedShipping = SHIPPING_OPTIONS.find(s => s.id === shipping);
    const shippingCost = selectedShipping?.price ?? 0;
    const tax = (cartSubtotal + shippingCost) * 0.08;
    const total = cartSubtotal + shippingCost + tax;

    const handleInput = (field, val) => setForm(f => ({ ...f, [field]: val }));

    const handleStripeCheckout = async () => {
        setStripeRedirecting(true);
        try {
            const items = cartItems.map(({ product, quantity }) => ({
                product_id: product.id,
                name: product.name,
                price: product.price,
                quantity,
                image_url: (product.images && product.images[0] && product.images[0].url) ? product.images[0].url : undefined,
            }));
            const res = await fetch('/api/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items,
                    successUrlBase: window.location.origin,
                    subtotal: cartSubtotal,
                    tax,
                    shipping_cost: shippingCost,
                    shipping_method: shipping,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Checkout session failed');
            if (data.url) {
                window.location.href = data.url;
                return;
            }
            throw new Error('No checkout URL returned');
        } catch (err) {
            console.error(err);
            alert(err?.message || 'Could not start checkout. Try again.');
        } finally {
            setStripeRedirecting(false);
        }
    };

    const inp = (field, extra = {}) => ({
        padding: '11px 14px', borderRadius: 8, width: '100%', boxSizing: 'border-box',
        border: `1px solid ${errors[field] ? '#ef4444' : t.inputBorder}`,
        background: t.inputBg, color: t.inputText, fontSize: 14, outline: 'none',
        fontFamily: 'inherit',
        ...extra,
    });

    if (step === 'confirmed') {
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
                        Order Confirmed!
                    </h1>
                    <p style={{ fontSize: 16, color: t.textMuted, lineHeight: 1.7, margin: '0 0 32px' }}>
                        Thank you for your order. You'll receive a confirmation email at <strong>{form.email}</strong>.
                        We'll begin crafting your shadowbox immediately — expect updates within 1–2 business days.
                    </p>
                    <div style={{ padding: 20, background: t.surface, borderRadius: 12, border: `1px solid ${t.border}`, marginBottom: 32, textAlign: 'left' }}>
                        <div style={{ fontSize: 12, color: t.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Order Summary</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: t.text, fontWeight: 700 }}>
                            <span>Total Charged</span>
                            <span style={{ color: t.primary }}>${total.toFixed(2)}</span>
                        </div>
                        <div style={{ fontSize: 12, color: t.textMuted, marginTop: 6 }}>
                            Shipping to {form.city}, {form.state} {form.zip}
                        </div>
                    </div>
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

    if (cartItems.length === 0) {
        return (
            <div style={{ minHeight: '100vh', background: t.bg, display: 'flex', flexDirection: 'column' }}>
                <SiteHeader />
                <div style={{ flex: 1, maxWidth: 600, margin: '80px auto', padding: '0 24px', textAlign: 'center', width: '100%', boxSizing: 'border-box' }}>
                    <div style={{ fontSize: 64, marginBottom: 24 }}>🛒</div>
                    <h1 style={{
                        fontFamily: "'Big Shoulders Display', 'Bebas Neue', sans-serif",
                        fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 900,
                        textTransform: 'uppercase', color: t.text, margin: '0 0 16px', letterSpacing: 0.5,
                    }}>
                        Your Cart is Empty
                    </h1>
                    <p style={{ fontSize: 15, color: t.textMuted, margin: '0 0 32px' }}>
                        Browse our collection of hand-crafted shadowbox cards.
                    </p>
                    <Link to="/products" style={{
                        display: 'inline-block', padding: '13px 32px', borderRadius: 10,
                        background: t.primary, color: '#fff', fontWeight: 800, fontSize: 14,
                        textDecoration: 'none', letterSpacing: 0.5,
                    }}>
                        Shop Products
                    </Link>
                </div>
                <Footer />
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: t.bg, display: 'flex', flexDirection: 'column' }}>
            <SiteHeader />

            <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '20px 16px 60px' : 'clamp(24px, 4vw, 48px) 24px 80px' }}>
                <div style={{ marginBottom: isMobile ? 20 : 28 }}>
                    <h1 style={{
                        fontFamily: "'Big Shoulders Display', 'Bebas Neue', sans-serif",
                        fontSize: isMobile ? 'clamp(28px, 8vw, 38px)' : 'clamp(32px, 5vw, 52px)',
                        fontWeight: 900, textTransform: 'uppercase',
                        color: t.text, margin: '0 0 8px', letterSpacing: 0.5,
                    }}>
                        {step === 'cart' ? 'Your Cart' : 'Checkout'}
                    </h1>
                    {/* Step indicator */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {['cart', 'checkout'].map((s, i) => (
                            <React.Fragment key={s}>
                                <div style={{
                                    fontSize: isMobile ? 11 : 12, fontWeight: 700, letterSpacing: 0.5,
                                    color: step === s ? t.primary : t.textFaint,
                                    textTransform: 'uppercase',
                                }}>
                                    {i + 1}. {s === 'cart' ? 'Review Cart' : 'Payment & Shipping'}
                                </div>
                                {i < 1 && <div style={{ width: 16, height: 1, background: t.border }} />}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 340px',
                    gap: isMobile ? 16 : 28,
                    alignItems: 'start',
                }}>
                    {/* Left column */}
                    <div>
                        {step === 'cart' ? (
                            <div style={{ background: t.surface, borderRadius: 14, border: `1px solid ${t.border}`, padding: '0 24px' }}>
                                {cartItems.map(item => <CartItem key={item.product.id} item={item} />)}
                            </div>
                        ) : (
                            <div style={{ background: t.surface, borderRadius: 14, border: `1px solid ${t.border}`, padding: isMobile ? 20 : 28 }}>
                                <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800, color: t.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                    Secure payment with Stripe
                                </h3>
                                <p style={{ margin: 0, fontSize: 14, color: t.textMuted, lineHeight: 1.6 }}>
                                    You'll enter payment and shipping details on Stripe's secure checkout page. After payment, you'll be redirected back here.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Order summary sidebar — stacks below on mobile */}
                    <div style={{ position: isMobile ? 'static' : 'sticky', top: 84 }}>
                        <div style={{ background: t.surface, borderRadius: 14, border: `1px solid ${t.border}`, padding: isMobile ? 16 : 24 }}>
                            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800, color: t.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                Order Summary
                            </h3>

                            {/* Item list */}
                            <div style={{ borderBottom: `1px solid ${t.border}`, marginBottom: 16, paddingBottom: 16 }}>
                                {cartItems.map(({ product, quantity }) => (
                                    <div key={product.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 10, fontSize: 13 }}>
                                        <div style={{ color: t.text, fontWeight: 600, minWidth: 0 }}>
                                            <span style={{ fontWeight: 700 }}>{product.name}</span>
                                            {quantity > 1 && <span style={{ color: t.textMuted }}> ×{quantity}</span>}
                                        </div>
                                        <span style={{ color: t.text, fontWeight: 700, flexShrink: 0 }}>${(product.price * quantity).toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: t.textMuted }}>
                                    <span>Subtotal</span>
                                    <span>${cartSubtotal.toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: t.textMuted }}>
                                    <span>Shipping</span>
                                    <span>{step === 'cart' ? 'Free standard' : shippingCost === 0 ? 'Free' : `$${shippingCost.toFixed(2)}`}</span>
                                </div>
                                {step === 'checkout' && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', color: t.textMuted }}>
                                        <span>Tax (est. 8%)</span>
                                        <span>${tax.toFixed(2)}</span>
                                    </div>
                                )}
                            </div>

                            <div style={{ borderTop: `1px solid ${t.border}`, marginTop: 16, paddingTop: 16, display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, color: t.text }}>
                                <span>Total</span>
                                <span style={{ color: t.primary }}>
                                    {step === 'cart'
                                        ? `$${cartSubtotal.toFixed(2)}+`
                                        : `$${total.toFixed(2)}`}
                                </span>
                            </div>

                            {step === 'cart' ? (
                                <button
                                    onClick={() => setStep('checkout')}
                                    style={{
                                        width: '100%', marginTop: 20, padding: '14px 0', borderRadius: 10,
                                        border: 'none', background: t.primary, color: '#fff',
                                        fontWeight: 800, fontSize: 15, cursor: 'pointer',
                                        letterSpacing: 0.5,
                                    }}
                                >
                                    Proceed to Checkout →
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    disabled={stripeRedirecting}
                                    onClick={handleStripeCheckout}
                                    style={{
                                        width: '100%', marginTop: 20, padding: '14px 0', borderRadius: 10,
                                        border: 'none',
                                        background: stripeRedirecting ? t.surfaceAlt : t.primary,
                                        color: stripeRedirecting ? t.textMuted : '#fff',
                                        fontWeight: 800, fontSize: 15,
                                        cursor: stripeRedirecting ? 'wait' : 'pointer',
                                        letterSpacing: 0.5,
                                    }}
                                >
                                    {stripeRedirecting ? 'Redirecting to Stripe…' : 'Pay with Stripe'}
                                </button>
                            )}

                            {step === 'checkout' && (
                                <button
                                    onClick={() => setStep('cart')}
                                    style={{
                                        width: '100%', marginTop: 10, padding: '10px 0', borderRadius: 10,
                                        border: `1px solid ${t.border}`, background: 'transparent',
                                        color: t.textMuted, fontWeight: 600, fontSize: 13, cursor: 'pointer',
                                    }}
                                >
                                    ← Back to Cart
                                </button>
                            )}

                            <div style={{ marginTop: 16, display: 'flex', gap: 12, justifyContent: 'center' }}>
                                {['🔒 Secure', '✓ Insured', '📦 Tracked'].map(s => (
                                    <span key={s} style={{ fontSize: 11, color: t.textFaint, fontWeight: 600 }}>{s}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
};

export default Cart;
