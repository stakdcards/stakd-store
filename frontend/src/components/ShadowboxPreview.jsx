import React from 'react';

/**
 * CSS-rendered shadowbox card preview.
 * Simulates the physical layered shadowbox product with depth, mat board, and frame.
 */
export const ShadowboxPreview = ({ product, minimal = false }) => {
    const { bgColor, accentColor, palette, name, subtitle, franchise, limited, inStock } = product || {};
    const bg = bgColor || '#0d0d0d';
    const accent = accentColor || '#4a4a4a';
    const mid = (Array.isArray(palette) && palette[1]) ? palette[1] : bg;

    return (
        <div style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '3/4',
            background: '#111',
            borderRadius: minimal ? 6 : 8,
            // Frame border — simulate solid wood/metal frame
            boxShadow: `inset 0 0 0 4px rgba(255,255,255,0.06), 0 4px 20px rgba(0,0,0,0.6)`,
            overflow: 'hidden',
        }}>
            {/* Frame outer edge highlight */}
            <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, transparent 50%, rgba(0,0,0,0.3) 100%)',
                pointerEvents: 'none', zIndex: 10, borderRadius: 'inherit',
            }} />

            {/* Mat board inset */}
            <div style={{
                position: 'absolute',
                inset: minimal ? 5 : 8,
                borderRadius: minimal ? 3 : 5,
                background: `linear-gradient(165deg, ${bg} 0%, ${mid} 55%, ${bg} 100%)`,
                overflow: 'hidden',
                boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5)',
            }}>
                {/* Background atmospheric glow */}
                <div style={{
                    position: 'absolute', inset: 0,
                    background: `radial-gradient(ellipse 120% 80% at 70% 30%, ${accent}28 0%, transparent 65%)`,
                    pointerEvents: 'none',
                }} />

                {/* Diagonal accent stripe */}
                <div style={{
                    position: 'absolute',
                    top: '-30%', right: '-20%',
                    width: '80%', height: '140%',
                    background: `linear-gradient(${accent}10, transparent)`,
                    transform: 'rotate(15deg)',
                    pointerEvents: 'none',
                }} />

                {/* Top accent line */}
                <div style={{
                    position: 'absolute', top: 0, left: '10%', right: '10%',
                    height: 2,
                    background: `linear-gradient(90deg, transparent, ${accent}88, transparent)`,
                }} />

                {/* STAKD icon watermark */}
                <div style={{
                    position: 'absolute',
                    top: minimal ? 8 : 12,
                    right: minimal ? 8 : 12,
                    opacity: 0.18,
                }}>
                    <img
                        src="/stakd-icon-offwhite.png"
                        alt=""
                        style={{ width: minimal ? 16 : 22, height: 'auto' }}
                    />
                </div>

                {/* Character silhouette placeholder — visual depth layer */}
                <div style={{
                    position: 'absolute',
                    bottom: '22%', left: '12%', right: '12%',
                    height: '55%',
                    background: `linear-gradient(to top, ${accent}22 0%, transparent 100%)`,
                    borderRadius: '50% 50% 0 0',
                    filter: 'blur(4px)',
                }} />

                {/* Name block */}
                <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    padding: minimal ? '16px 8px 8px' : '28px 12px 12px',
                    background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)',
                }}>
                    {!minimal && (
                        <div style={{
                            fontSize: 9, fontWeight: 700, letterSpacing: 2,
                            textTransform: 'uppercase', color: accent,
                            marginBottom: 3, opacity: 0.9,
                        }}>
                            {subtitle || franchise}
                        </div>
                    )}
                    <div style={{
                        fontFamily: "'Big Shoulders Display', 'Bebas Neue', sans-serif",
                        fontSize: minimal ? 12 : 18,
                        fontWeight: 900,
                        color: '#F3F1E4',
                        textTransform: 'uppercase',
                        letterSpacing: minimal ? 0.5 : 1,
                        lineHeight: 1,
                        textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                    }}>
                        {name}
                    </div>
                </div>

                {/* Limited edition badge — corner seal style, top-left, no angle */}
                {limited && !minimal && (
                    <div style={{
                        position: 'absolute', top: 10, left: 10,
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '4px 10px', borderRadius: 6,
                        background: 'rgba(0,0,0,0.45)',
                        border: '1px solid rgba(255,255,255,0.22)',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                    }}>
                        <span style={{
                            width: 4, height: 4, borderRadius: '50%',
                            background: accent,
                            boxShadow: `0 0 6px ${accent}`,
                            flexShrink: 0,
                        }} />
                        <span style={{
                            fontSize: 9, fontWeight: 700, letterSpacing: 1.2,
                            textTransform: 'uppercase', color: '#F3F1E4',
                            textShadow: '0 0 1px rgba(0,0,0,0.8)',
                        }}>
                            Limited Edition
                        </span>
                    </div>
                )}

                {/* Out of stock overlay */}
                {!inStock && (
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'rgba(0,0,0,0.55)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <div style={{
                            fontSize: 11, fontWeight: 900, letterSpacing: 2,
                            textTransform: 'uppercase', color: '#F3F1E4',
                            padding: '6px 14px', borderRadius: 4,
                            background: 'rgba(0,0,0,0.7)',
                            border: '1px solid rgba(243,241,228,0.2)',
                        }}>
                            Sold Out
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ShadowboxPreview;
