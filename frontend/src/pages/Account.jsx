import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import Footer from '../components/Footer';
import { useDarkMode } from '../contexts/DarkModeContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const ORDER_STATUS_LABELS = {
    pending: 'Pending',
    accepted: 'Accepted',
    files_generated: 'Files Generated',
    printed_cut: 'Printed & Cut',
    assembled: 'Assembled',
    packed: 'Packed',
    shipped: 'Shipped',
    cancelled: 'Cancelled',
};

const STATUS_COLORS = {
    pending: '#f59e0b',
    accepted: '#3b82f6',
    files_generated: '#06b6d4',
    printed_cut: '#6366f1',
    assembled: '#8b5cf6',
    packed: '#a855f7',
    shipped: '#22c55e',
    cancelled: '#ef4444',
};

function StatusBadge({ status }) {
    const color = STATUS_COLORS[status] || '#6b7280';
    return (
        <span style={{
            display: 'inline-block', padding: '3px 10px', borderRadius: 99,
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
            background: `${color}20`, color,
        }}>
            {ORDER_STATUS_LABELS[status] || status}
        </span>
    );
}

export default function Account() {
    const { t } = useDarkMode();
    const { user, profile, updateProfile, signOut, loading } = useAuth();
    const navigate = useNavigate();

    const [orders, setOrders] = useState([]);
    const [ordersLoading, setOrdersLoading] = useState(true);
    const [expandedOrder, setExpandedOrder] = useState(null);

    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState('');
    const [activeTab, setActiveTab] = useState('orders');

    useEffect(() => {
        if (!loading && !user) navigate('/login', { replace: true });
    }, [user, loading, navigate]);

    useEffect(() => {
        if (profile) {
            setName(profile.name || '');
            setPhone(profile.phone || '');
        }
    }, [profile]);

    const fetchOrders = useCallback(async () => {
        if (!user?.email) return;
        setOrdersLoading(true);
        try {
            const { data, error } = await supabase
                .from('orders')
                .select(`*, order_items(*, products(id, name))`)
                .eq('email', user.email)
                .order('created_at', { ascending: false });
            if (!error) setOrders(data || []);
        } finally {
            setOrdersLoading(false);
        }
    }, [user?.email]);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setSaving(true);
        setSaveMsg('');
        const { error } = await updateProfile({ name: name.trim(), phone: phone.trim() });
        setSaving(false);
        setSaveMsg(error ? `Error: ${error.message}` : 'Saved!');
        setTimeout(() => setSaveMsg(''), 3000);
    };

    if (loading || !user) return null;

    const displayName = profile?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'there';

    return (
        <div style={{ minHeight: '100vh', background: t.bg, color: t.text, display: 'flex', flexDirection: 'column' }}>
            <SiteHeader />
            <main style={{ flex: 1, maxWidth: 860, margin: '0 auto', padding: 'clamp(32px, 5vw, 60px) 24px', width: '100%', boxSizing: 'border-box' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase', color: t.primary, margin: '0 0 6px' }}>My Account</p>
                        <h1 style={{
                            fontFamily: "'Big Shoulders Display', 'Bebas Neue', sans-serif",
                            fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 900,
                            textTransform: 'uppercase', margin: 0, color: t.text, letterSpacing: 0.5,
                        }}>
                            Welcome back, {displayName}
                        </h1>
                        <p style={{ color: t.textMuted, fontSize: 13, margin: '6px 0 0' }}>{user.email}</p>
                    </div>
                    <button
                        onClick={async () => { await signOut(); navigate('/'); }}
                        style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.surfaceAlt, color: t.textMuted, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textMuted; }}
                    >
                        Sign out
                    </button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 0, borderBottom: `2px solid ${t.border}`, marginBottom: 28 }}>
                    {[{ id: 'orders', label: 'Order History' }, { id: 'profile', label: 'Profile' }].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                padding: '10px 22px', background: 'none', border: 'none',
                                borderBottom: `3px solid ${activeTab === tab.id ? t.primary : 'transparent'}`,
                                fontSize: 14, fontWeight: activeTab === tab.id ? 700 : 600,
                                color: activeTab === tab.id ? t.primary : t.textMuted,
                                cursor: 'pointer', transition: 'all .15s',
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Orders Tab */}
                {activeTab === 'orders' && (
                    <div>
                        {ordersLoading ? (
                            <div style={{ padding: '48px 0', textAlign: 'center', color: t.textMuted }}>Loading orders…</div>
                        ) : orders.length === 0 ? (
                            <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, padding: '48px 24px', textAlign: 'center' }}>
                                <p style={{ color: t.textMuted, fontSize: 15, marginBottom: 20 }}>You haven't placed any orders yet.</p>
                                <Link to="/products" style={{ display: 'inline-block', padding: '12px 28px', borderRadius: 10, background: t.primary, color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
                                    Shop All Products
                                </Link>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {orders.map(order => {
                                    const isExpanded = expandedOrder === order.id;
                                    const shortId = order.id.replace(/-/g, '').slice(0, 6).toUpperCase();
                                    const date = new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                    return (
                                        <div key={order.id} style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, overflow: 'hidden', transition: 'border-color .15s' }}>
                                            {/* Order row */}
                                            <button
                                                type="button"
                                                onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                                                style={{
                                                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer',
                                                    gap: 12, flexWrap: 'wrap', textAlign: 'left',
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                                                    <div>
                                                        <div style={{ fontSize: 13, fontWeight: 700, color: t.text, fontFamily: 'monospace' }}>#{shortId}</div>
                                                        <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{date}</div>
                                                    </div>
                                                    <StatusBadge status={order.status} />
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                                    <div style={{ fontSize: 15, fontWeight: 800, color: t.text }}>${Number(order.total).toFixed(2)}</div>
                                                    <span style={{ fontSize: 18, color: t.textMuted, transition: 'transform .2s', display: 'inline-block', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>⌄</span>
                                                </div>
                                            </button>

                                            {/* Expanded detail */}
                                            {isExpanded && (
                                                <div style={{ borderTop: `1px solid ${t.border}`, padding: '16px 20px' }}>
                                                    {/* Items */}
                                                    {(order.order_items || []).length > 0 && (
                                                        <div style={{ marginBottom: 16 }}>
                                                            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: t.textMuted, marginBottom: 8 }}>Items</p>
                                                            {order.order_items.map((item, i) => (
                                                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${t.border}`, fontSize: 13 }}>
                                                                    <span style={{ color: t.text }}>{item.products?.name ?? item.product_id}</span>
                                                                    <span style={{ color: t.textMuted }}>{item.quantity} × ${Number(item.price_at_time).toFixed(2)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {/* Totals */}
                                                    <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', marginBottom: 12 }}>
                                                        {[
                                                            { label: 'Subtotal', val: `$${Number(order.subtotal).toFixed(2)}` },
                                                            { label: 'Shipping', val: Number(order.shipping_cost) > 0 ? `$${Number(order.shipping_cost).toFixed(2)}` : 'Free' },
                                                            { label: 'Tax', val: `$${Number(order.tax).toFixed(2)}` },
                                                        ].map(({ label, val }) => (
                                                            <div key={label}>
                                                                <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
                                                                <div style={{ fontSize: 14, color: t.text, fontWeight: 600 }}>{val}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {/* Shipping address */}
                                                    <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.7 }}>
                                                        <strong style={{ color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10 }}>Ships to</strong><br />
                                                        {order.address}, {order.city}, {order.state} {order.zip}
                                                    </div>
                                                    {/* Tracking */}
                                                    {order.tracking_number && (
                                                        <div style={{ marginTop: 12, padding: '10px 14px', background: '#22c55e18', borderRadius: 8, border: '1px solid #22c55e30' }}>
                                                            <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 600 }}>Tracking: </span>
                                                            <span style={{ fontSize: 12, color: t.text, fontFamily: 'monospace' }}>{order.tracking_number}</span>
                                                            {order.label_url && (
                                                                <a href={order.label_url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 12, fontSize: 12, color: '#22c55e', textDecoration: 'underline' }}>View Label ↗</a>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Profile Tab */}
                {activeTab === 'profile' && (
                    <div style={{ maxWidth: 480 }}>
                        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, padding: 28 }}>
                            <h2 style={{ fontSize: 15, fontWeight: 700, color: t.text, margin: '0 0 20px' }}>Profile Information</h2>
                            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: t.textMuted, marginBottom: 6 }}>Email</label>
                                    <div style={{ padding: '11px 14px', borderRadius: 10, border: `1px solid ${t.border}`, background: t.surfaceAlt, color: t.textMuted, fontSize: 14 }}>
                                        {user.email}
                                    </div>
                                    <p style={{ fontSize: 11, color: t.textFaint, marginTop: 4 }}>Email address cannot be changed here.</p>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: t.textMuted, marginBottom: 6 }}>Display Name</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder="Your name"
                                        style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: `1px solid ${t.inputBorder}`, background: t.inputBg, color: t.inputText, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                                        onFocus={e => { e.target.style.borderColor = t.primary; }}
                                        onBlur={e => { e.target.style.borderColor = t.inputBorder; }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: t.textMuted, marginBottom: 6 }}>Phone (optional)</label>
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={e => setPhone(e.target.value)}
                                        placeholder="+1 (555) 000-0000"
                                        style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: `1px solid ${t.inputBorder}`, background: t.inputBg, color: t.inputText, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                                        onFocus={e => { e.target.style.borderColor = t.primary; }}
                                        onBlur={e => { e.target.style.borderColor = t.inputBorder; }}
                                    />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="stakd-btn-primary"
                                        style={{ padding: '11px 24px', borderRadius: 10, border: 'none', background: t.primary, color: '#fff', fontWeight: 700, fontSize: 14, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}
                                    >
                                        {saving ? 'Saving…' : 'Save Changes'}
                                    </button>
                                    {saveMsg && (
                                        <span style={{ fontSize: 13, color: saveMsg.startsWith('Error') ? '#ef4444' : '#22c55e', fontWeight: 600 }}>
                                            {saveMsg}
                                        </span>
                                    )}
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </main>
            <Footer />
        </div>
    );
}
