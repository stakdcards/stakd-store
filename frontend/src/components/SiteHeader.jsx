import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useDarkMode } from '../contexts/DarkModeContext';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';

const NAV_LINKS = [
    { label: 'Shop',  to: '/products' },
    { label: 'Gallery', to: '/gallery' },
    { label: 'About', to: '/about' },
];

const CART_BADGE_RED = '#C41E3A';

const CartIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <path d="M16 10a4 4 0 01-8 0"/>
    </svg>
);

const AccountIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
    </svg>
);


const MenuIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
);

const CloseIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
);

const SiteHeader = () => {
    const { t } = useDarkMode();
    const { cartCount } = useCart();
    const { user, profile } = useAuth();
    const firstName = profile?.name?.split(/\s+/)[0] || user?.user_metadata?.full_name?.split(/\s+/)[0] || user?.user_metadata?.name?.split(/\s+/)[0] || null;
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 12);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    useEffect(() => { setMenuOpen(false); }, [location.pathname]);

    const logoSrc = '/stakd-wordmark-offwhite.png';

    const headerStyle = {
        position: 'sticky', top: 0, zIndex: 200,
        display: isMobile ? 'flex' : 'grid',
        gridTemplateColumns: isMobile ? undefined : '1fr auto 1fr',
        alignItems: 'center',
        padding: isMobile ? '0 16px' : '0 48px',
        height: isMobile ? 54 : 68,
        background: t.headerBg,
        borderBottom: `1px solid ${scrolled ? t.border : 'transparent'}`,
        backdropFilter: 'blur(12px) saturate(140%)',
        WebkitBackdropFilter: 'blur(12px) saturate(140%)',
        transition: 'border-color 0.2s',
    };

    const iconBtn = {
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 36, height: 36, borderRadius: 8, border: 'none',
        background: 'transparent', color: t.textMuted, cursor: 'pointer',
        transition: 'color .15s, background .15s',
    };

    return (
        <>
            <header style={headerStyle}>
                {/* Logo — left */}
                <NavLink to="/" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    <img
                        src={logoSrc}
                        alt="STAKD"
                        style={{ height: isMobile ? 22 : 26, width: 'auto', objectFit: 'contain' }}
                    />
                </NavLink>

                {/* Desktop nav — centered */}
                {!isMobile && (
                    <nav style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                        {NAV_LINKS.map(l => (
                            <NavLink key={l.to} to={l.to} className="stakd-nav-link" style={({ isActive }) => ({
                                padding: '7px 16px', borderRadius: 8,
                                fontSize: 14, fontWeight: 600, letterSpacing: 0.3,
                                textDecoration: 'none',
                                color: isActive ? t.primary : t.textMuted,
                                background: 'transparent',
                                transition: 'color .2s',
                            })}>
                                {l.label}
                            </NavLink>
                        ))}
                    </nav>
                )}

                {/* Right controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 2 : 8, marginLeft: 'auto', justifyContent: 'flex-end' }}>
                    <NavLink to={user ? '/account' : '/login'} style={({ isActive }) => ({
                        ...(isMobile ? iconBtn : {}),
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        position: 'relative',
                        color: isActive ? t.primary : t.textMuted,
                        textDecoration: 'none',
                        padding: isMobile ? 0 : '6px 10px',
                        borderRadius: 8,
                        minHeight: 36,
                        boxSizing: 'border-box',
                    })} title={user ? 'My Account' : 'Sign In'}>
                        {user && firstName && !isMobile && (
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'inherit', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {firstName}
                            </span>
                        )}
                        <span style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            position: 'relative', width: 36, height: 36, flexShrink: 0,
                        }}>
                            <AccountIcon />
                            {user && (
                                <span style={{
                                    position: 'absolute', top: 4, right: 4,
                                    width: 7, height: 7, borderRadius: '50%',
                                    background: '#22c55e', border: `1.5px solid ${t.bg}`,
                                }} />
                            )}
                        </span>
                    </NavLink>
                    <NavLink to="/cart" style={({ isActive }) => ({
                        ...iconBtn,
                        position: 'relative',
                        color: isActive ? t.primary : t.textMuted,
                        textDecoration: 'none',
                    })}>
                        <CartIcon />
                        {cartCount > 0 && (
                            <span style={{
                                position: 'absolute', top: 4, right: 4,
                                minWidth: 16, height: 16, borderRadius: 99,
                                background: CART_BADGE_RED, color: '#fff',
                                fontSize: 9, fontWeight: 800,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: '0 4px',
                                lineHeight: 1,
                            }}>
                                {cartCount > 99 ? '99+' : cartCount}
                            </span>
                        )}
                    </NavLink>

                    {isMobile && (
                        <button onClick={() => setMenuOpen(o => !o)} style={iconBtn}>
                            {menuOpen ? <CloseIcon /> : <MenuIcon />}
                        </button>
                    )}
                </div>
            </header>

            {/* Mobile menu */}
            {isMobile && menuOpen && (
                <>
                    <div
                        onClick={() => setMenuOpen(false)}
                        style={{ position: 'fixed', inset: 0, zIndex: 190, background: t.dimOverlay }}
                    />
                    <nav style={{
                        position: 'fixed', top: 54, left: 0, right: 0, zIndex: 195,
                        background: t.surface, borderBottom: `1px solid ${t.border}`,
                        boxShadow: '0 16px 48px rgba(0,0,0,0.28)',
                        padding: '12px 0 20px',
                    }}>
                        {[...NAV_LINKS, { label: `Cart${cartCount > 0 ? ` (${cartCount})` : ''}`, to: '/cart' }].map(l => (
                            <NavLink key={l.to} to={l.to} style={({ isActive }) => ({
                                display: 'flex', alignItems: 'center',
                                padding: '16px 24px',
                                fontSize: 17, fontWeight: 700, letterSpacing: 0.4,
                                textDecoration: 'none',
                                color: isActive ? t.primary : t.text,
                                background: isActive ? t.tagBg : 'transparent',
                                borderLeft: `3px solid ${isActive ? t.primary : 'transparent'}`,
                                transition: 'all .1s',
                            })}>
                                {l.label}
                            </NavLink>
                        ))}
                    </nav>
                </>
            )}
        </>
    );
};

export default SiteHeader;
