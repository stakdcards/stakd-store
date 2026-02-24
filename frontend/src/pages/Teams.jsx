import React from 'react';
import SiteHeader from '../components/SiteHeader';
import { useDarkMode } from '../contexts/DarkModeContext';

const Teams = () => {
    const { t } = useDarkMode();

    return (
        <div style={{ minHeight: '100vh', background: t.bg, color: t.text }}>
            <SiteHeader />
            <main style={{ padding: '20px 10px 80px', maxWidth: 1000, margin: '0 auto' }}>
                <h1 style={{ margin: '0 0 8px', fontSize: 'clamp(22px, 4vw, 28px)', color: t.text }}>Teams & Partners</h1>
                <p style={{ margin: '0 0 20px', color: t.textMuted, fontSize: 14 }}>
                    A dedicated area for team collections, partner drops, and league collaborations.
                </p>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 16,
                }}>
                    {['Team Program', 'League Partner', 'Brand Collab', 'Community'].map(label => (
                        <div key={label} style={{
                            background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12,
                            padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        }}>
                            <div style={{ fontWeight: 700, marginBottom: 6, color: t.text, fontSize: 15 }}>{label}</div>
                            <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5 }}>
                                Placeholder content for team or partner info.
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
};

export default Teams;
