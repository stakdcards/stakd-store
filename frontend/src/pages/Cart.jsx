import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import Footer from '../components/Footer';
import { ShadowboxPreview } from '../components/ShadowboxPreview';
import { useDarkMode } from '../contexts/DarkModeContext';
import { useCart } from '../contexts/CartContext';
import { createOrder } from '../services/orders';

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

    const selectedShipping = SHIPPING_OPTIONS.find(s => s.id === shipping);
    const shippingCost = selectedShipping?.price ?? 0;
    const tax = (cartSubtotal + shippingCost) * 0.08;
    const total = cartSubtotal + shippingCost + tax;

    const handleInput = (field, val) => setForm(f => ({ ...f, [field]: val }));

    const validate = () => {
        const e = {};
        if (!form.firstName.trim()) e.firstName = 'Required';
        if (!form.lastName.trim()) e.lastName = 'Required';
        if (!form.email.includes('@')) e.email = 'Valid email required';
        if (!form.address.trim()) e.address = 'Required';
        if (!form.city.trim()) e.city = 'Required';
        if (!form.state) e.state = 'Required';
        if (form.zip.length < 5) e.zip = 'Valid zip required';
        if (form.cardNumber.replace(/\s/g, '').length < 16) e.cardNumber = 'Valid card number required';
        if (!form.cardExpiry.includes('/')) e.cardExpiry = 'MM/YY format';
        if (form.cardCvc.length < 3) e.cardCvc = 'Required';
        if (!form.cardName.trim()) e.cardName = 'Name on card required';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;
        setSubmitting(true);
        try {
            const orderPayload = {
                first_name: form.firstName.trim(),
                last_name: form.lastName.trim(),
                email: form.email.trim(),
                phone: form.phone.trim() || null,
                address: form.address.trim(),
                city: form.city.trim(),
                state: form.state.trim(),
                zip: form.zip.trim(),
                country: form.country.trim() || 'US',
                shipping_method: selectedShipping?.id ?? 'standard',
                shipping_cost: shippingCost,
                subtotal: cartSubtotal,
                tax,
                total,
            };
            const items = cartItems.map(({ product, quantity }) => ({
                product_id: product.id,
                quantity,
                price_at_time: product.price,
            }));
            await createOrder(orderPayload, items);
            clearCart();
            setStep('confirmed');
        } catch (err) {
            console.error(err);
            alert(err?.message || 'Order submission failed. Please try again.');
        } finally {
            setSubmitting(false);
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
                            <form onSubmit={handleSubmit}>
                                <div style={{ background: t.surface, borderRadius: 14, border: `1px solid ${t.border}`, padding: isMobile ? '16px' : '24px', marginBottom: isMobile ? 12 : 20 }}>
                                    <h3 style={{ margin: isMobile ? '0 0 14px' : '0 0 20px', fontSize: isMobile ? 14 : 16, fontWeight: 800, color: t.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                        Shipping Information
                                    </h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 10 : 14 }}>
                                        <div>
                                            <label style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>First Name</label>
                                            <input value={form.firstName} onChange={e => handleInput('firstName', e.target.value)} style={inp('firstName')} />
                                            {errors.firstName && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{errors.firstName}</div>}
                                        </div>
                                        <div>
                                            <label style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Last Name</label>
                                            <input value={form.lastName} onChange={e => handleInput('lastName', e.target.value)} style={inp('lastName')} />
                                            {errors.lastName && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{errors.lastName}</div>}
                                        </div>
                                        <div>
                                            <label style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Email</label>
                                            <input type="email" value={form.email} onChange={e => handleInput('email', e.target.value)} style={inp('email')} />
                                            {errors.email && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{errors.email}</div>}
                                        </div>
                                        <div>
                                            <label style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Phone</label>
                                            <input value={form.phone} onChange={e => handleInput('phone', e.target.value)} style={inp('phone')} placeholder="Optional" />
                                        </div>
                                        <div style={{ gridColumn: isMobile ? '1' : 'span 2' }}>
                                            <label style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Street Address</label>
                                            <input value={form.address} onChange={e => handleInput('address', e.target.value)} style={inp('address')} />
                                            {errors.address && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{errors.address}</div>}
                                        </div>
                                        <div>
                                            <label style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>City</label>
                                            <input value={form.city} onChange={e => handleInput('city', e.target.value)} style={inp('city')} />
                                            {errors.city && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{errors.city}</div>}
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                            <div>
                                                <label style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>State</label>
                                                <select value={form.state} onChange={e => handleInput('state', e.target.value)} style={{ ...inp('state'), cursor: 'pointer' }}>
                                                    <option value="">—</option>
                                                    {STATES.map(s => <option key={s}>{s}</option>)}
                                                </select>
                                                {errors.state && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{errors.state}</div>}
                                            </div>
                                            <div>
                                                <label style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Zip Code</label>
                                                <input value={form.zip} onChange={e => handleInput('zip', e.target.value)} maxLength={5} style={inp('zip')} />
                                                {errors.zip && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{errors.zip}</div>}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Shipping options */}
                                <div style={{ background: t.surface, borderRadius: 14, border: `1px solid ${t.border}`, padding: isMobile ? '16px' : 24, marginBottom: isMobile ? 12 : 20 }}>
                                    <h3 style={{ margin: isMobile ? '0 0 12px' : '0 0 16px', fontSize: isMobile ? 14 : 16, fontWeight: 800, color: t.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                        Shipping Method
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {SHIPPING_OPTIONS.map(opt => (
                                            <label key={opt.id} style={{
                                                display: 'flex', alignItems: 'center', gap: 12,
                                                padding: 14, borderRadius: 10,
                                                border: `1.5px solid ${shipping === opt.id ? t.primary : t.border}`,
                                                background: shipping === opt.id ? t.tagBg : 'transparent',
                                                cursor: 'pointer', transition: 'all .15s',
                                            }}>
                                                <input type="radio" name="shipping" value={opt.id} checked={shipping === opt.id} onChange={() => setShipping(opt.id)} style={{ accentColor: t.primary }} />
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{opt.label}</div>
                                                </div>
                                                <div style={{ fontSize: 14, fontWeight: 800, color: t.primary }}>${opt.price.toFixed(2)}</div>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Payment */}
                                <div style={{ background: t.surface, borderRadius: 14, border: `1px solid ${t.border}`, padding: isMobile ? '16px' : 24 }}>
                                    <h3 style={{ margin: isMobile ? '0 0 14px' : '0 0 20px', fontSize: isMobile ? 14 : 16, fontWeight: 800, color: t.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                        Payment
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                        <div>
                                            <label style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Card Number</label>
                                            <input
                                                value={form.cardNumber}
                                                onChange={e => handleInput('cardNumber', e.target.value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim())}
                                                maxLength={19} placeholder="1234 5678 9012 3456"
                                                style={inp('cardNumber')}
                                            />
                                            {errors.cardNumber && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{errors.cardNumber}</div>}
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                                            <div>
                                                <label style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Expiry</label>
                                                <input
                                                    value={form.cardExpiry}
                                                    onChange={e => {
                                                        let v = e.target.value.replace(/\D/g, '');
                                                        if (v.length >= 2) v = v.slice(0, 2) + '/' + v.slice(2, 4);
                                                        handleInput('cardExpiry', v);
                                                    }}
                                                    maxLength={5} placeholder="MM/YY"
                                                    style={inp('cardExpiry')}
                                                />
                                                {errors.cardExpiry && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{errors.cardExpiry}</div>}
                                            </div>
                                            <div>
                                                <label style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>CVC</label>
                                                <input
                                                    value={form.cardCvc}
                                                    onChange={e => handleInput('cardCvc', e.target.value.replace(/\D/g, '').slice(0, 4))}
                                                    placeholder="123"
                                                    style={inp('cardCvc')}
                                                />
                                                {errors.cardCvc && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{errors.cardCvc}</div>}
                                            </div>
                                            <div>
                                                <label style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Name on Card</label>
                                                <input
                                                    value={form.cardName}
                                                    onChange={e => handleInput('cardName', e.target.value)}
                                                    placeholder="J. Smith"
                                                    style={inp('cardName')}
                                                />
                                                {errors.cardName && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{errors.cardName}</div>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </form>
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
                                    type="submit"
                                    disabled={submitting}
                                    onClick={handleSubmit}
                                    style={{
                                        width: '100%', marginTop: 20, padding: '14px 0', borderRadius: 10,
                                        border: 'none',
                                        background: submitting ? t.surfaceAlt : t.primary,
                                        color: submitting ? t.textMuted : '#fff',
                                        fontWeight: 800, fontSize: 15,
                                        cursor: submitting ? 'wait' : 'pointer',
                                        letterSpacing: 0.5,
                                    }}
                                >
                                    {submitting ? 'Processing…' : 'Place Order'}
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
