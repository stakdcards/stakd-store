import React, { createContext, useContext, useEffect } from 'react';

const DarkModeContext = createContext();

// ─── STAKD Brand Tokens ───────────────────────────────────────────────────────
const INDIGO     = '#2A2A69';
const INDIGO_MID = '#434EA1';
const INDIGO_LT  = '#6D81BB';
const INDIGO_PAL = '#A5BFE3';
const CHARCOAL   = '#181C1D';
const OFF_WHITE  = '#F3F1E4';

const THEMES = {
    light: {
        bg:           OFF_WHITE,
        bgAlt:        '#EAE8D9',
        surface:      '#FFFFFF',
        surfaceAlt:   '#F3F1E4',
        surfaceHover: '#EAE8D9',
        border:       '#D8D5C4',
        borderLight:  '#E6E4D6',
        text:         CHARCOAL,
        textSecondary:'#2A2C33',
        textMuted:    '#595B68',
        textFaint:    '#90928E',
        inputBg:      '#FFFFFF',
        inputBorder:  '#C8C6B5',
        inputText:    CHARCOAL,
        headerBg:     'rgba(243,241,228,0.95)',
        // brand
        primary:      INDIGO,
        primaryHover: '#201B50',
        primaryText:  '#FFFFFF',
        accent:       INDIGO_LT,
        accentPale:   INDIGO_PAL,
        tagBg:        '#EAEBF7',
        tagText:      INDIGO,
        dimOverlay:   'rgba(24,28,29,0.55)',
    },
    dark: {
        bg:           '#0D0E11',
        bgAlt:        '#13151A',
        surface:      '#191B20',
        surfaceAlt:   '#20232A',
        surfaceHover: '#272B34',
        border:       '#2C303A',
        borderLight:  '#232730',
        text:         OFF_WHITE,
        textSecondary:'#CCC9B3',
        textMuted:    '#898675',
        textFaint:    '#565349',
        inputBg:      '#191B20',
        inputBorder:  '#363A44',
        inputText:    OFF_WHITE,
        headerBg:     'rgba(13,14,17,0.95)',
        // brand
        primary:      INDIGO_LT,
        primaryHover: '#7E95D4',
        primaryText:  '#FFFFFF',
        accent:       INDIGO_PAL,
        accentPale:   '#C5D7EE',
        tagBg:        'rgba(42,42,105,0.30)',
        tagText:      INDIGO_PAL,
        dimOverlay:   'rgba(0,0,0,0.70)',
    },
};

export const DarkModeProvider = ({ children }) => {
    const darkMode = true;

    useEffect(() => {
        document.documentElement.style.colorScheme = 'dark';
        document.documentElement.style.backgroundColor = THEMES.dark.bg;
    }, []);

    const toggle = () => {}; // no-op: dark-only
    const t = THEMES.dark;

    return (
        <DarkModeContext.Provider value={{ darkMode, toggle, t }}>
            {children}
        </DarkModeContext.Provider>
    );
};

export const useDarkMode = () => {
    const ctx = useContext(DarkModeContext);
    if (!ctx) throw new Error('useDarkMode must be used inside DarkModeProvider');
    return ctx;
};

export default DarkModeContext;
