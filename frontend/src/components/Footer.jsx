import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDarkMode } from '../contexts/DarkModeContext';

const SOCIAL_LINKS = [
    {
        href: 'https://instagram.com/stakdcards',
        label: 'Instagram',
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
            </svg>
        ),
    },
    {
        href: 'https://tiktok.com/@stakdcards',
        label: 'TikTok',
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V9.13a8.18 8.18 0 0 0 4.78 1.52V7.2a4.85 4.85 0 0 1-1.01-.51z"/>
            </svg>
        ),
    },
    {
        href: 'https://x.com/stakdcards',
        label: 'X',
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.254 5.622 5.91-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
        ),
    },
];

const NAV_LINKS = [
    { label: 'Shop', to: '/products' },
    { label: 'Gallery', to: '/gallery' },
    { label: 'About', to: '/about' },
    { label: 'Cart', to: '/cart' },
];

const Footer = () => {
    const { t } = useDarkMode();
    const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 640);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    return (
        <footer style={{ borderTop: `1px solid ${t.border}`, background: t.surface }}>
            <div style={{
                maxWidth: 1180, margin: '0 auto',
                padding: isMobile ? '28px 20px' : 'clamp(28px, 4vw, 44px) 24px',
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: isMobile ? 20 : 24,
                textAlign: isMobile ? 'center' : 'left',
            }}>
                <img
                    src="/stakd-wordmark-offwhite.png"
                    alt="STAKD"
                    style={{ height: 18, width: 'auto', opacity: 0.7 }}
                />
                <div style={{ display: 'flex', gap: isMobile ? 20 : 24, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {NAV_LINKS.map(l => (
                        <Link key={l.to} to={l.to} className="stakd-footer-link" style={{ fontSize: 13, color: t.textMuted, textDecoration: 'none', fontWeight: 600 }}>
                            {l.label}
                        </Link>
                    ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMobile ? 'center' : 'flex-end', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                        {SOCIAL_LINKS.map(s => (
                            <a
                                key={s.label}
                                href={s.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={s.label}
                                className="stakd-social-icon"
                                style={{ color: t.textMuted, display: 'flex', alignItems: 'center' }}
                                onMouseEnter={e => { e.currentTarget.style.color = t.primary; }}
                                onMouseLeave={e => { e.currentTarget.style.color = t.textMuted; }}
                            >
                                {s.icon}
                            </a>
                        ))}
                    </div>
                    <div style={{ fontSize: 11, color: t.textFaint }}>
                        © {new Date().getFullYear()} STAKD · stakdcards.com
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
