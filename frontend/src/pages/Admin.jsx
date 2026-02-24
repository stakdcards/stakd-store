import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import { useDarkMode } from '../contexts/DarkModeContext';
import { useProductStore } from '../contexts/ProductStoreContext';

const BRAND_INDIGO = '#2A2A69';
const MOBILE_BP = 768;
const API_BASE_URL = 'http://localhost:8000';
const ADMIN_KEY_STORAGE = 'stakd-admin-api-key';

const TABS = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'listings', label: 'Listings & Availability' },
    { id: 'customers', label: 'Customers' },
    { id: 'orders', label: 'Orders & Fulfillment' },
];

const ORDER_STATUS_FLOW = ['pending', 'accepted', 'files_generated', 'printed_cut', 'assembled', 'packed', 'shipped'];
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

function normalizeOrderStatus(raw) {
    const s = String(raw || '').toLowerCase();
    if (ORDER_STATUS_FLOW.includes(s) || s === 'cancelled') return s;
    if (s === 'processing') return 'accepted';
    if (s === 'generating_files' || s === 'files_ready') return 'files_generated';
    if (s === 'printing') return 'printed_cut';
    if (s === 'delivered') return 'shipped'; // collapsed into shipped
    if (s === 'paid') return 'pending';
    return 'pending';
}

function getAllowedStatusTransitions(current) {
    const now = normalizeOrderStatus(current);
    if (now === 'cancelled') return [now];
    // shipped is the terminal completed state
    if (now === 'shipped') return [now, 'cancelled'];
    const idx = ORDER_STATUS_FLOW.indexOf(now);
    const next = idx >= 0 && idx < ORDER_STATUS_FLOW.length - 1 ? ORDER_STATUS_FLOW[idx + 1] : null;
    return [now, ...(next ? [next] : []), 'cancelled'];
}

function shortOrderId(id) {
    const s = String(id || '').replace(/-/g, '');
    if (s.length <= 6) return s;
    return s.slice(0, 6);
}


/* Format order created_at (ISO string) to CST for display */
function formatOrderDateCST(createdAt) {
    if (!createdAt) return '—';
    try {
        const d = new Date(createdAt);
        if (Number.isNaN(d.getTime())) return createdAt.slice(0, 10);
        return d.toLocaleString('en-US', { timeZone: 'America/Chicago', dateStyle: 'short', timeStyle: 'short', hour12: true }) + ' CST';
    } catch (_) {
        return typeof createdAt === 'string' ? createdAt.slice(0, 10) : '—';
    }
}

const Admin = () => {
    const { darkMode, t } = useDarkMode();
    const { products, setProductOverride, categories } = useProductStore();
    const [activeTab, setActiveTab] = useState(() => {
        const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
        return params.get('tab') || 'dashboard';
    });
    const [orders, setOrders] = useState([]);
    const [ordersLoading, setOrdersLoading] = useState(false);
    const [orderFilter, setOrderFilter] = useState('all');
    const [selectedOrderId, setSelectedOrderId] = useState(null);
    const [adminApiKey, setAdminApiKey] = useState(() => (typeof window !== 'undefined' ? sessionStorage.getItem(ADMIN_KEY_STORAGE) || '' : ''));
    const [adminApiKeyInput, setAdminApiKeyInput] = useState('');
    const [editingProduct, setEditingProduct] = useState(null); // product being edited
    const [editDraft, setEditDraft] = useState({});             // draft values in edit modal
    const imageInputRef = useRef(null);

    const getTestOrderFull = useCallback((orderId) => {
        try {
            const saved = JSON.parse(localStorage.getItem('snapshot-test-orders') || '[]');
            return saved.find((o) => o.order_id === orderId) || null;
        } catch (_) {
            return null;
        }
    }, []);

    const fetchOrders = useCallback(async () => {
        setOrdersLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/orders`);
            const data = res.ok ? await res.json() : {};
            const apiOrders = (data.orders || []).map((o) => ({
                ...o,
                isTest: true,
                status: normalizeOrderStatus(o.status),
            }));
            const fromApiIds = new Set(apiOrders.map((o) => o.id));
            const saved = JSON.parse(localStorage.getItem('snapshot-test-orders') || '[]');
            const localTestOrders = saved
                .filter((t) => !fromApiIds.has(t.order_id))
                .map((t) => {
                    const boxes = (t.items || []).reduce((s, i) => s + (i.quantity || 1), 0);
                    const cards = (t.items || []).reduce((s, box) => s + (box.card_count ?? (box.cards || []).reduce((s2, c) => s2 + (c.quantity || 1), 0)), 0);
                    return {
                        id: t.order_id,
                        customer: 'Test order',
                        email: '—',
                        boxes,
                        cards,
                        total: (t.total_cents || 0) / 100,
                        status: normalizeOrderStatus(t.status || 'pending'),
                        date: t.created_at ? t.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
                        isTest: true,
                    };
                });
            setOrders([...apiOrders, ...localTestOrders]);
        } catch (_) {
        } finally {
            setOrdersLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    const [deletingTestOrders, setDeletingTestOrders] = useState(false);
    const removeAllTestOrders = useCallback(async () => {
        if (!window.confirm('Remove all test orders from the database and local history? This cannot be undone.')) return;
        setDeletingTestOrders(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/test-orders`, { method: 'DELETE' });
            if (res.ok) {
                localStorage.removeItem('snapshot-test-orders');
                await fetchOrders();
                setSelectedOrderId(null);
            } else {
                const data = await res.json().catch(() => ({}));
                alert(data?.detail || data?.message || 'Failed to delete test orders');
            }
        } catch (e) {
            alert('Failed to delete test orders: ' + (e?.message || e));
        } finally {
            setDeletingTestOrders(false);
        }
    }, [fetchOrders]);
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < MOBILE_BP);

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < MOBILE_BP);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    /* ────── Orders helpers ────── */
    const updateOrderStatus = useCallback(async (id, nextStatus) => {
        const normalized = normalizeOrderStatus(nextStatus);
        const before = orders.find((o) => o.id === id)?.status;
        setOrders(prev => prev.map((o) => {
            if (o.id !== id) return o;
            const allowed = getAllowedStatusTransitions(o.status);
            if (!allowed.includes(normalized)) return o;
            return { ...o, status: normalized };
        }));
        try {
            const res = await fetch(`${API_BASE_URL}/api/orders/${encodeURIComponent(id)}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: normalized }),
            });
            if (!res.ok) throw new Error('Status update failed');
        } catch (_) {
            if (before) {
                setOrders(prev => prev.map((o) => (o.id === id ? { ...o, status: before } : o)));
            }
        }
    }, [orders]);
    const getStatusColor = (s) => ({
        pending: '#f59e0b',
        accepted: '#3b82f6',
        files_generated: '#06b6d4',
        printed_cut: '#6366f1',
        assembled: '#8b5cf6',
        packed: '#a855f7',
        shipped: '#22c55e',
        cancelled: '#ef4444',
    }[normalizeOrderStatus(s)] || '#6b7280');
    const filteredOrders = orderFilter === 'all' ? orders : orders.filter(o => o.status === orderFilter);
    const orderStats = {
        total: orders.length,
        pending: orders.filter(o => o.status === 'pending').length,
        processing: orders.filter(o => ['accepted', 'files_generated', 'printed_cut', 'assembled', 'packed'].includes(o.status)).length,
        shipped: orders.filter(o => o.status === 'shipped').length,
        revenue: orders.reduce((s, o) => s + (o.total ?? 0), 0),
    };

    const saveAdminApiKey = useCallback((e) => {
        e.preventDefault();
        const value = adminApiKeyInput.trim();
        if (!value) return;
        setAdminApiKey(value);
        setAdminApiKeyInput('');
        try {
            sessionStorage.setItem(ADMIN_KEY_STORAGE, value);
        } catch (_) {}
    }, [adminApiKeyInput]);

    const clearAdminApiKey = useCallback(() => {
        setAdminApiKey('');
        try {
            sessionStorage.removeItem(ADMIN_KEY_STORAGE);
        } catch (_) {}
    }, []);

    const selectedOrder = selectedOrderId ? orders.find(o => o.id === selectedOrderId) : null;
    const selectedOrderFull = selectedOrderId ? getTestOrderFull(selectedOrderId) : null;

    /* ────── Shared style helpers ────── */
    const pad = isMobile ? 10 : 24;
    const sec = { ...st.section, padding: pad, background: t.surface, borderColor: t.border };
    const inp = (extra = {}) => ({ ...st.input, background: darkMode ? '#27272a' : '#f5f5f5', borderColor: t.border, color: t.text, minWidth: 0, ...extra });

    if (!adminApiKey) {
        return (
            <div style={{ ...st.container, background: t.bg, color: t.text }}>
                <SiteHeader />
                <div style={{ padding: isMobile ? '20px 10px' : '32px 40px', maxWidth: 760, margin: '0 auto' }}>
                    <div style={{ ...st.section, background: t.surface, borderColor: t.border }}>
                        <h1 style={{ fontSize: isMobile ? 24 : 32, margin: 0 }}>Admin Access</h1>
                        <p style={{ marginTop: 10, color: t.textMuted, fontSize: 14 }}>
                            Enter your local admin API key to unlock production tools and cut-file generation.
                        </p>
                        <form onSubmit={saveAdminApiKey} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 10, marginTop: 14 }}>
                            <input
                                type="password"
                                value={adminApiKeyInput}
                                onChange={(e) => setAdminApiKeyInput(e.target.value)}
                                placeholder="STAKD admin key"
                                style={{ ...inp({ flex: 1 }) }}
                            />
                            <button type="submit" style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: t.primary, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                                Unlock
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    /* ═══════════════════════════════════════════ RENDER ═══════════════════════════════════════════ */
    return (
        <div style={{ ...st.container, background: t.bg, color: t.text }}>
            <SiteHeader />

            <div style={{ padding: isMobile ? '16px 10px' : '32px 40px', maxWidth: 1600, margin: '0 auto' }}>
                <div style={st.content}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: isMobile ? 16 : 28 }}>
                        <div>
                            <h1 style={{
                                fontFamily: "'Big Shoulders Display', 'Bebas Neue', sans-serif",
                                fontSize: isMobile ? 26 : 38, fontWeight: 900, margin: '0 0 4px',
                                color: t.text, textTransform: 'uppercase', letterSpacing: 0.5,
                            }}>Admin Panel</h1>
                            <p style={{ fontSize: 13, color: t.textMuted, margin: 0 }}>Listings · Customers · Orders & Fulfillment</p>
                        </div>
                        <button
                            type="button"
                            onClick={clearAdminApiKey}
                            style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.surfaceAlt, color: t.text, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                        >
                            Lock Admin
                        </button>
                    </div>

                    {/* Tabs */}
                    <div style={{ ...st.tabs, borderBottomColor: t.border, gap: isMobile ? 0 : 4, marginBottom: isMobile ? 16 : 32 }}>
                        {TABS.map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                                ...st.tab,
                                padding: isMobile ? '10px 12px' : '12px 22px',
                                fontSize: isMobile ? 12 : 14,
                                borderBottomColor: activeTab === tab.id ? t.primary : 'transparent',
                                color: activeTab === tab.id ? t.primary : t.textMuted,
                                fontWeight: activeTab === tab.id ? 700 : 600,
                            }}>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* ═══════ DASHBOARD ═══════ */}
                    {activeTab === 'dashboard' && (
                        <div>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: isMobile ? 8 : 20, marginBottom: 24 }}>
                                {[
                                    { val: orders.length, label: 'Total Orders', color: t.primary },
                                    { val: orders.filter(o => o.status === 'pending').length, label: 'Pending', color: '#f59e0b' },
                                    { val: `$${orderStats.revenue.toFixed(2)}`, label: 'Revenue', color: '#22c55e' },
                                    { val: orders.filter(o => o.status === 'shipped').length, label: 'Shipped', color: '#22c55e' },
                                ].map(({ val, label, color }) => (
                                    <div key={label} style={{ ...st.statCard, padding: isMobile ? 12 : 24, background: t.surface, borderColor: t.border }}>
                                        <div style={{ fontSize: isMobile ? 24 : 32, fontWeight: 800, color }}>{val}</div>
                                        <div style={{ fontSize: isMobile ? 11 : 13, color: t.textMuted, marginTop: 4 }}>{label}</div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ ...st.section, background: t.surface, borderColor: t.border, padding: 40, textAlign: 'center' }}>
                                <h3 style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 8 }}>Overview</h3>
                                <p style={{ fontSize: 13, color: t.textMuted }}>Orders & fulfillment in the Orders tab. Listings & availability in Listings. Customers derived from orders.</p>
                            </div>
                        </div>
                    )}

                    {/* ═══════ LISTINGS & AVAILABILITY ═══════ */}
                    {activeTab === 'listings' && (
                        <div style={sec}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                                <div>
                                    <h3 style={st.sectionTitle}>Products & Availability</h3>
                                    <p style={{ fontSize: 13, color: t.textMuted, margin: 0 }}>Click Edit to update a listing. Changes persist to this browser.</p>
                                </div>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ ...st.th, borderColor: t.border }}>Product</th>
                                            <th style={{ ...st.th, borderColor: t.border }}>Category</th>
                                            <th style={{ ...st.th, borderColor: t.border }}>Price</th>
                                            <th style={{ ...st.th, borderColor: t.border }}>Status</th>
                                            <th style={{ ...st.th, borderColor: t.border }}>Flags</th>
                                            <th style={{ ...st.th, borderColor: t.border, textAlign: 'right' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {products.map(p => (
                                            <tr key={p.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                                                <td style={{ ...st.td, color: t.text, fontWeight: 600 }}>
                                                    <div>{p.name}</div>
                                                    <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 400, marginTop: 2 }}>{p.franchise || ''}</div>
                                                </td>
                                                <td style={{ ...st.td, color: t.textMuted }}>{categories.find(c => c.id === p.category)?.label ?? p.category}</td>
                                                <td style={{ ...st.td, color: t.text, fontWeight: 700 }}>${p.price.toFixed(2)}</td>
                                                <td style={st.td}>
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: 5,
                                                        padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                                                        background: p.inStock ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                                                        color: p.inStock ? '#16a34a' : '#dc2626',
                                                    }}>
                                                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
                                                        {p.inStock ? 'In Stock' : 'Out of Stock'}
                                                    </span>
                                                </td>
                                                <td style={st.td}>
                                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                        {p.featured && (
                                                            <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: `${t.primary}20`, color: t.primary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Featured</span>
                                                        )}
                                                        {p.limited && (
                                                            <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: 'rgba(249,115,22,0.12)', color: '#ea580c', textTransform: 'uppercase', letterSpacing: 0.5 }}>Limited</span>
                                                        )}
                                                        {(p.images || []).length > 0 && (
                                                            <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: 'rgba(107,114,128,0.12)', color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{(p.images || []).length} photo{(p.images || []).length !== 1 ? 's' : ''}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ ...st.td, textAlign: 'right' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingProduct(p);
                                                            setEditDraft({
                                                                price: p.price,
                                                                inStock: p.inStock,
                                                                featured: p.featured,
                                                                limited: p.limited,
                                                                images: p.images || [],
                                                            });
                                                        }}
                                                        style={{
                                                            padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                                                            border: `1.5px solid ${t.primary}`,
                                                            background: 'transparent', color: t.primary, cursor: 'pointer',
                                                            transition: 'background .15s',
                                                        }}
                                                        onMouseEnter={e => { e.currentTarget.style.background = `${t.primary}15`; }}
                                                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                                    >
                                                        Edit
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ═══════ CUSTOMERS ═══════ */}
                    {activeTab === 'customers' && (
                        <div style={sec}>
                            <h3 style={st.sectionTitle}>Customers</h3>
                            <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 16 }}>Derived from orders. Connect a backend to persist customers.</p>
                            {(() => {
                                const byEmail = {};
                                orders.forEach(o => {
                                    const email = o.email || o.customer_email || '—';
                                    const name = o.customer || o.customer_name || 'Unknown';
                                    if (!byEmail[email]) byEmail[email] = { email, name, orders: 0, total: 0 };
                                    byEmail[email].orders += 1;
                                    byEmail[email].total += o.total ?? 0;
                                    if (name !== 'Unknown') byEmail[email].name = name;
                                });
                                const list = Object.values(byEmail).sort((a, b) => b.orders - a.orders);
                                if (list.length === 0) return <p style={{ color: t.textMuted }}>No customers yet.</p>;
                                return (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ ...st.th, borderColor: t.border }}>Name</th>
                                                    <th style={{ ...st.th, borderColor: t.border }}>Email</th>
                                                    <th style={{ ...st.th, borderColor: t.border }}>Orders</th>
                                                    <th style={{ ...st.th, borderColor: t.border }}>Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {list.map((c, i) => (
                                                    <tr key={i} style={{ borderBottom: `1px solid ${t.border}` }}>
                                                        <td style={{ ...st.td, color: t.text, fontWeight: 600 }}>{c.name}</td>
                                                        <td style={{ ...st.td, color: t.textMuted }}>{c.email}</td>
                                                        <td style={st.td}>{c.orders}</td>
                                                        <td style={st.td}>${c.total.toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* ═══════ ORDERS ═══════ */}
                    {activeTab === 'orders' && (
                        <div>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: isMobile ? 8 : 20, marginBottom: isMobile ? 12 : 24 }}>
                                {[
                                    { val: ordersLoading ? '—' : orderStats.total, label: 'Total Orders', color: t.primary },
                                    { val: ordersLoading ? '—' : orderStats.pending, label: 'Pending', color: '#f59e0b' },
                                    { val: ordersLoading ? '—' : orderStats.processing, label: 'Processing', color: '#3b82f6' },
                                    { val: ordersLoading ? '—' : `$${orderStats.revenue.toFixed(2)}`, label: 'Revenue', color: '#22c55e' },
                                ].map(({ val, label, color }) => (
                                    <div key={label} style={{ ...st.statCard, padding: isMobile ? 12 : 24, background: t.surface, borderColor: t.border }}>
                                        <div style={{ fontSize: isMobile ? 24 : 32, fontWeight: 800, color }}>{val}</div>
                                        <div style={{ fontSize: isMobile ? 11 : 13, color: t.textMuted, marginTop: 4 }}>{label}</div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ ...st.filterBar, background: t.surface, borderColor: t.border }}>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                    <select
                                        value={orderFilter}
                                        onChange={(e) => setOrderFilter(e.target.value)}
                                        style={{ ...st.filterBtn, minWidth: 190, background: t.surfaceAlt, color: t.text, borderColor: t.border }}
                                    >
                                        {['all', 'pending', 'accepted', 'files_generated', 'printed_cut', 'assembled', 'packed', 'shipped'].map((statusId) => (
                                            <option key={statusId} value={statusId}>
                                                {statusId === 'all' ? 'All statuses' : (ORDER_STATUS_LABELS[statusId] || statusId)}
                                            </option>
                                        ))}
                                    </select>
                                    <button type="button" onClick={fetchOrders} disabled={ordersLoading} style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${t.border}`, fontSize: 12, fontWeight: 600, cursor: ordersLoading ? 'wait' : 'pointer', background: t.surfaceAlt, color: t.text, opacity: ordersLoading ? 0.7 : 1 }}>
                                        {ordersLoading ? 'Loading orders...' : 'Refresh orders'}
                                    </button>
                                    <button type="button" onClick={removeAllTestOrders} disabled={deletingTestOrders || orders.length === 0} style={{ marginLeft: 'auto', padding: '8px 14px', borderRadius: 8, border: `1px solid ${t.border}`, fontSize: 12, fontWeight: 600, cursor: deletingTestOrders || orders.length === 0 ? 'not-allowed' : 'pointer', background: t.surfaceAlt, color: t.text, opacity: orders.length === 0 ? 0.6 : 1 }}>
                                        {deletingTestOrders ? 'Removing…' : 'Remove all test orders'}
                                    </button>
                                </div>
                            </div>
                            <div style={{ ...st.section, background: t.surface, borderColor: t.border, padding: 0, overflow: 'hidden' }}>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr>{['Order ID', 'Customer', 'Boxes', 'Cards', 'Total', 'Date', 'Status', 'Details', 'Actions'].map(h => <th key={h} style={{ ...st.th, color: t.textFaint, borderBottomColor: t.border }}>{h}</th>)}</tr>
                                        </thead>
                                        <tbody>
                                            {ordersLoading && (
                                                <tr>
                                                    <td colSpan={9} style={{ ...st.td, color: t.textMuted, textAlign: 'center' }}>Loading orders from Supabase...</td>
                                                </tr>
                                            )}
                                            {filteredOrders.map(o => (
                                                <tr key={o.id} style={{ borderBottomColor: t.border }}>
                                                    <td style={{ ...st.td, color: t.text, fontWeight: 600 }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => { setSelectedOrderId(o.id); fetchProductionStatus(o.id); }}
                                                            style={{ background: 'none', border: 'none', padding: 0, margin: 0, color: t.primary, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                                                            title={o.id}
                                                        >
                                                            {shortOrderId(o.id)}
                                                        </button>
                                                    </td>
                                                    <td style={{ ...st.td, color: t.text }}>{o.customer}</td>
                                                    <td style={{ ...st.td, color: t.text, textAlign: 'center' }}>{o.boxes}</td>
                                                    <td style={{ ...st.td, color: t.text, textAlign: 'center' }}>{o.cards}</td>
                                                    <td style={{ ...st.td, color: t.text, fontWeight: 600 }}>${(o.total ?? 0).toFixed(2)}</td>
                                                    <td style={{ ...st.td, color: t.textMuted, fontSize: 12 }}>{formatOrderDateCST(o.created_at || o.date)}</td>
                                                    <td style={st.td}><span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', background: `${getStatusColor(o.status)}20`, color: getStatusColor(o.status), border: `1px solid ${getStatusColor(o.status)}` }}>{ORDER_STATUS_LABELS[normalizeOrderStatus(o.status)] || o.status}</span></td>
                                                    <td style={st.td}>
                                                        <button type="button" onClick={() => { setSelectedOrderId(o.id); fetchProductionStatus(o.id); }} style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${t.border}`, fontSize: 12, cursor: 'pointer', background: t.surfaceAlt, color: t.text, fontWeight: 600 }}>View</button>
                                                    </td>
                                                    <td style={st.td}>
                                                        <select value={normalizeOrderStatus(o.status)} onChange={e => updateOrderStatus(o.id, e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${t.border}`, fontSize: 12, cursor: 'pointer', background: t.surfaceAlt, color: t.text }}>
                                                            {getAllowedStatusTransitions(o.status).map((statusId) => (
                                                                <option key={statusId} value={statusId}>{ORDER_STATUS_LABELS[statusId] || statusId}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Order detail modal */}
                            {selectedOrderId && (
                                <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(0,0,0,0.5)' }} onClick={() => setSelectedOrderId(null)}>
                                    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, maxWidth: 640, width: '100%', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
                                        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                                            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: t.text }}>Order {shortOrderId(selectedOrderId)}</h3>
                                            <button type="button" onClick={() => setSelectedOrderId(null)} style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${t.border}`, background: t.surfaceAlt, color: t.text, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
                                        </div>
                                        <div style={{ padding: 24 }}>
                                            {selectedOrder && (
                                                <div style={{ marginBottom: 20 }}>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
                                                        <div><span style={{ fontSize: 11, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Placed</span><div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{formatOrderDateCST(selectedOrder.created_at || selectedOrder.date)}</div></div>
                                                        <div><span style={{ fontSize: 11, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Status</span><div><span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', background: `${getStatusColor(selectedOrder.status)}20`, color: getStatusColor(selectedOrder.status) }}>{ORDER_STATUS_LABELS[normalizeOrderStatus(selectedOrder.status)] || selectedOrder.status}</span></div></div>
                                                        <div><span style={{ fontSize: 11, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total</span><div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>${(selectedOrder.total ?? 0).toFixed(2)}</div></div>
                                                        <div><span style={{ fontSize: 11, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Boxes / Cards</span><div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{selectedOrder.boxes} / {selectedOrder.cards}</div></div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                                        <select value={normalizeOrderStatus(selectedOrder.status)} onChange={e => updateOrderStatus(selectedOrder.id, e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${t.border}`, fontSize: 13, cursor: 'pointer', background: t.surfaceAlt, color: t.text }}>
                                                            {getAllowedStatusTransitions(selectedOrder.status).map((statusId) => (
                                                                <option key={statusId} value={statusId}>{ORDER_STATUS_LABELS[statusId] || statusId}</option>
                                                            ))}
                                                        </select>
                                                        {(() => {
                                                            const idx = ORDER_STATUS_FLOW.indexOf(normalizeOrderStatus(selectedOrder.status));
                                                            const next = idx >= 0 && idx < ORDER_STATUS_FLOW.length - 1 ? ORDER_STATUS_FLOW[idx + 1] : null;
                                                            if (!next) return null;
                                                            return (
                                                                <button type="button" onClick={() => updateOrderStatus(selectedOrder.id, next)} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${t.border}`, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: t.surface, color: t.primary }}>
                                                                    Mark next: {ORDER_STATUS_LABELS[next]}
                                                                </button>
                                                            );
                                                        })()}
                                                        {normalizeOrderStatus(selectedOrder.status) === 'assembled' && (
                                                            <button type="button" onClick={() => alert('Shipping label generation coming soon — hook up your carrier API here.')} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #8b5cf6', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#8b5cf620', color: '#8b5cf6' }}>
                                                                Generate Shipping Label
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Order items and production notes removed - files generated externally */}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </div>

            {/* ═══════ EDIT PRODUCT MODAL ═══════ */}
            {editingProduct && (
                <div
                    style={{
                        position: 'fixed', inset: 0, zIndex: 1000,
                        background: 'rgba(0,0,0,0.55)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '16px',
                    }}
                    onClick={e => { if (e.target === e.currentTarget) setEditingProduct(null); }}
                >
                    <div style={{
                        background: t.surface, borderRadius: 16,
                        border: `1px solid ${t.border}`,
                        boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
                        width: '100%', maxWidth: 540,
                        maxHeight: '90vh', overflowY: 'auto',
                        padding: isMobile ? 20 : 32,
                    }}>
                        {/* Modal header */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 12 }}>
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: t.primary, marginBottom: 4 }}>
                                    {categories.find(c => c.id === editingProduct.category)?.label ?? editingProduct.category}
                                </div>
                                <h2 style={{ margin: 0, fontSize: isMobile ? 20 : 24, fontWeight: 800, color: t.text }}>{editingProduct.name}</h2>
                                {editingProduct.franchise && (
                                    <div style={{ fontSize: 13, color: t.textMuted, marginTop: 3 }}>{editingProduct.franchise}</div>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => setEditingProduct(null)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, fontSize: 22, lineHeight: 1, padding: 4, flexShrink: 0 }}
                            >×</button>
                        </div>

                        {/* Pricing */}
                        <div style={{ marginBottom: 24 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: t.textMuted, marginBottom: 10 }}>Pricing</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontSize: 20, color: t.textMuted }}>$</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={editDraft.price}
                                    onChange={e => setEditDraft(d => ({ ...d, price: e.target.value }))}
                                    style={{ ...inp({ width: 120, fontSize: 20, fontWeight: 700, padding: '10px 14px' }) }}
                                />
                            </div>
                        </div>

                        {/* Toggles */}
                        <div style={{ marginBottom: 24 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: t.textMuted, marginBottom: 12 }}>Availability & Flags</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {[
                                    { key: 'inStock', label: 'In Stock', desc: 'Customers can add this item to their cart' },
                                    { key: 'featured', label: 'Featured', desc: 'Shown in the Featured Drops section on the landing page' },
                                    { key: 'limited', label: 'Limited Edition', desc: 'Displays a "Limited Edition" badge on the product card' },
                                ].map(({ key, label, desc }) => (
                                    <label key={key} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '12px 14px', borderRadius: 10,
                                        border: `1px solid ${editDraft[key] ? t.primary + '55' : t.border}`,
                                        background: editDraft[key] ? `${t.primary}0A` : t.surfaceAlt,
                                        cursor: 'pointer', transition: 'all .15s',
                                    }}>
                                        <div>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{label}</div>
                                            <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{desc}</div>
                                        </div>
                                        <div style={{
                                            width: 44, height: 24, borderRadius: 99, position: 'relative', flexShrink: 0, marginLeft: 12,
                                            background: editDraft[key] ? t.primary : t.border,
                                            transition: 'background .2s',
                                        }}>
                                            <div style={{
                                                position: 'absolute', top: 3, left: editDraft[key] ? 23 : 3,
                                                width: 18, height: 18, borderRadius: '50%', background: '#fff',
                                                transition: 'left .2s',
                                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                            }} />
                                            <input
                                                type="checkbox"
                                                checked={editDraft[key]}
                                                onChange={e => setEditDraft(d => ({ ...d, [key]: e.target.checked }))}
                                                style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer', margin: 0 }}
                                            />
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Images */}
                        <div style={{ marginBottom: 28 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: t.textMuted, marginBottom: 12 }}>Product Photos</div>
                            <p style={{ fontSize: 12, color: t.textMuted, margin: '0 0 12px' }}>
                                Upload photos for this listing. Use the arrows to reorder — the first photo is shown as the primary image.
                            </p>

                            {/* Upload button */}
                            <input
                                ref={imageInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                style={{ display: 'none' }}
                                onChange={e => {
                                    const files = Array.from(e.target.files || []);
                                    if (!files.length) return;
                                    files.forEach(file => {
                                        const reader = new FileReader();
                                        reader.onload = ev => {
                                            const dataUrl = ev.target.result;
                                            setEditDraft(d => ({
                                                ...d,
                                                images: [...(d.images || []), { id: `img-${Date.now()}-${Math.random().toString(36).slice(2)}`, dataUrl, name: file.name }],
                                            }));
                                        };
                                        reader.readAsDataURL(file);
                                    });
                                    e.target.value = '';
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => imageInputRef.current?.click()}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '9px 18px', borderRadius: 8,
                                    border: `1.5px dashed ${t.border}`,
                                    background: t.surfaceAlt, color: t.primary,
                                    fontWeight: 700, fontSize: 13, cursor: 'pointer',
                                    width: '100%', justifyContent: 'center', marginBottom: 14,
                                    transition: 'border-color .15s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.borderColor = t.primary}
                                onMouseLeave={e => e.currentTarget.style.borderColor = t.border}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                Upload Photos
                            </button>

                            {/* Image list */}
                            {(editDraft.images || []).length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {(editDraft.images || []).map((img, idx) => (
                                        <div key={img.id} style={{
                                            display: 'flex', alignItems: 'center', gap: 10,
                                            padding: '8px 10px', borderRadius: 10,
                                            border: `1px solid ${t.border}`, background: t.bg,
                                        }}>
                                            <img
                                                src={img.dataUrl}
                                                alt={img.name}
                                                style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 6, flexShrink: 0, border: `1px solid ${t.border}` }}
                                            />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 12, fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{img.name}</div>
                                                {idx === 0 && <div style={{ fontSize: 10, color: t.primary, fontWeight: 700, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>Primary</div>}
                                            </div>
                                            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                                <button type="button" title="Move up" disabled={idx === 0}
                                                    onClick={() => setEditDraft(d => {
                                                        const imgs = [...(d.images || [])];
                                                        [imgs[idx - 1], imgs[idx]] = [imgs[idx], imgs[idx - 1]];
                                                        return { ...d, images: imgs };
                                                    })}
                                                    style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${t.border}`, background: idx === 0 ? t.border : t.surfaceAlt, color: idx === 0 ? t.textFaint : t.text, cursor: idx === 0 ? 'not-allowed' : 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    ↑
                                                </button>
                                                <button type="button" title="Move down" disabled={idx === (editDraft.images || []).length - 1}
                                                    onClick={() => setEditDraft(d => {
                                                        const imgs = [...(d.images || [])];
                                                        [imgs[idx], imgs[idx + 1]] = [imgs[idx + 1], imgs[idx]];
                                                        return { ...d, images: imgs };
                                                    })}
                                                    style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${t.border}`, background: idx === (editDraft.images || []).length - 1 ? t.border : t.surfaceAlt, color: idx === (editDraft.images || []).length - 1 ? t.textFaint : t.text, cursor: idx === (editDraft.images || []).length - 1 ? 'not-allowed' : 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    ↓
                                                </button>
                                                <button type="button" title="Remove"
                                                    onClick={() => setEditDraft(d => ({ ...d, images: (d.images || []).filter((_, i) => i !== idx) }))}
                                                    style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #fca5a5', background: '#FEF2F2', color: '#ef4444', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                                                    ×
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '20px', color: t.textFaint, fontSize: 13, border: `1px dashed ${t.border}`, borderRadius: 10 }}>
                                    No photos yet. Upload some to show on the listing.
                                </div>
                            )}
                        </div>

                        {/* Modal actions */}
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: `1px solid ${t.border}` }}>
                            <button type="button" onClick={() => setEditingProduct(null)}
                                style={{ padding: '10px 20px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.surfaceAlt, color: t.text, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setProductOverride(editingProduct.id, {
                                        price: parseFloat(editDraft.price) || 0,
                                        inStock: editDraft.inStock,
                                        featured: editDraft.featured,
                                        limited: editDraft.limited,
                                        images: editDraft.images || [],
                                    });
                                    setEditingProduct(null);
                                }}
                                style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: t.primary, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

/* ═══════════════════════════ STYLES ═══════════════════════════ */
const st = {
    container: { minHeight: '100vh' },
    content: { width: '100%' },
    tabs: { display: 'flex', gap: 8, borderBottom: '2px solid', marginBottom: 32, overflowX: 'auto' },
    tab: { padding: '12px 20px', background: 'none', border: 'none', borderBottom: '3px solid', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all .2s', whiteSpace: 'nowrap' },
    section: { padding: 24, borderRadius: 12, border: '1px solid', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
    sectionTitle: { fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12, color: '#999' },
    templateBtn: { padding: 16, borderRadius: 10, border: '2px solid', cursor: 'pointer', textAlign: 'left', transition: 'all .2s' },
    fieldCard: { padding: 16, borderRadius: 10, border: '1px solid', overflow: 'hidden', wordBreak: 'break-word' },
    inputGroup: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
    label: { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 },
    input: { padding: '8px 12px', borderRadius: 6, border: '1px solid', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' },
    addBtn: { padding: '8px 16px', background: BRAND_INDIGO, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' },
    exportBtnLarge: { width: '100%', padding: '14px 20px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(34,197,94,0.3)' },
    deleteBtn: { width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FEF2F2', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 20, fontWeight: 'bold', cursor: 'pointer' },
    statCard: { padding: 24, borderRadius: 12, border: '1px solid', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
    filterBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 12, border: '1px solid', marginBottom: 16, flexWrap: 'wrap', gap: 12 },
    filterBtn: { padding: '8px 16px', borderRadius: 8, border: '1px solid', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
    th: { padding: '14px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '2px solid' },
    td: { padding: '14px 16px', fontSize: 14, borderBottom: '1px solid' },
};

export default Admin;
