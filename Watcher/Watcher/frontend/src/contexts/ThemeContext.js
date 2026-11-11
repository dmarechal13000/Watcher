import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import preferencesService from '../services/preferencesService';

const ThemeContext = createContext();
export { ThemeContext };

export const THEMES = {
    flatly: { name: 'Flatly', description: 'Flat and modern', dark: false },
    cosmo: { name: 'Cosmo', description: 'An ode to Metro', dark: false },
    lux: { name: 'Lux', description: 'A touch of class', dark: false },
    minty: { name: 'Minty', description: 'Fresh & clean', dark: false },
    morph: { name: 'Morph', description: 'Skeuomorphism in the digital age', dark: false },
    sandstone: { name: 'Sandstone', description: 'A touch of warmth', dark: false },
    united: { name: 'United', description: 'Ubuntu-inspired, orange passion', dark: false },
    yeti: { name: 'Yeti', description: 'A cool, friendly theme', dark: false },
    cyborg: { name: 'Cyborg', description: 'Jet black and electric blue', dark: true },
    darkly: { name: 'Darkly', description: 'Flatly in night mode', dark: true },
    slate: { name: 'Slate', description: 'Shades of gunmetal grey', dark: true },
    solar: { name: 'Solar', description: 'A spin on Solarized', dark: true },
    superhero: { name: 'Superhero', description: 'The brave and the blue', dark: true },
    brite: { name: 'Brite', description: 'Bright and colorful', dark: false },
    clay: { name: 'Clay', description: 'Warm charcoal & terracotta, glass panels over a living backdrop', dark: true, bsTheme: 'dark', ambient: true },
    'clay-light': { name: 'Clay Light', description: 'Ivory & terracotta, white glass over a living backdrop', dark: false, ambient: true }
};

// Background effects setting for themes with an ambient backdrop (stored in the user's preferences)
export const EFFECT_LEVELS = {
    full: { label: 'Full',  description: 'Drifting glows, pointer spotlight and click ripples' },
    calm: { label: 'Calm',  description: 'Static glows only, no motion or pointer effects' },
    off:  { label: 'Off',   description: 'Plain background, lightest on older machines' },
};
const EFFECTS_PREF_KEY = 'ambientEffects';

function applyTheme(themeName) {
    if (window.AVAILABLE_THEMES && window.AVAILABLE_THEMES[themeName]) {
        const themeLink = document.getElementById('theme-stylesheet');
        if (themeLink && themeLink.getAttribute('href') !== window.AVAILABLE_THEMES[themeName]) {
            themeLink.href = window.AVAILABLE_THEMES[themeName];
        }
        // Hooks for watcher-modern.css (per-theme surfaces, light/dark tuning)
        const root = document.documentElement;
        root.setAttribute('data-wt-theme', themeName);
        root.setAttribute('data-wt-mode', THEMES[themeName]?.dark ? 'dark' : 'light');
        // Themes built on vanilla Bootstrap opt into its native colour mode; Bootswatch files are already tinted
        if (THEMES[themeName]?.bsTheme) root.setAttribute('data-bs-theme', THEMES[themeName].bsTheme);
        else root.removeAttribute('data-bs-theme');
        // Remembered so index.html can apply it before the first paint on the next visit
        try {
            localStorage.setItem('wt-theme', JSON.stringify({
                name: themeName,
                mode: THEMES[themeName]?.dark ? 'dark' : 'light',
                bs: THEMES[themeName]?.bsTheme || null,
            }));
        } catch (e) { /* storage unavailable */ }
        return themeLink;
    }
    return null;
}

export const ThemeProvider = ({ children }) => {
    // Start from the theme index.html already applied from the last visit
    const [currentTheme, setCurrentTheme] = useState(() => {
        const applied = document.documentElement.getAttribute('data-wt-theme');
        return THEMES[applied] ? applied : 'darkly';
    });
    // Bumped once the new theme stylesheet has loaded, so canvas-based views (charts) can redraw
    // with the theme's colours, which are only readable from CSS variables after that point.
    const [themeVersion, setThemeVersion] = useState(0);
    const [effects, setEffectsState] = useState('full');

    // Lets the stylesheet tone motion down along with the background effects
    useEffect(() => {
        document.documentElement.setAttribute('data-wt-effects', effects);
    }, [effects]);

    const applyAndTrack = (themeName) => {
        const link = applyTheme(themeName);
        if (link) link.addEventListener('load', () => setThemeVersion(v => v + 1), { once: true });
    };

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            axios
                .get('/api/auth/profile', { headers: { Authorization: `Token ${token}` } })
                .then(res => {
                    // init preferences cache from server
                    preferencesService.init(res.data.preferences || {});
                    const savedEffects = preferencesService.get(EFFECTS_PREF_KEY, 'full');
                    if (EFFECT_LEVELS[savedEffects]) setEffectsState(savedEffects);
                    // clean up ALL watcher_* localStorage keys (everything is now in DB)
                    Object.keys(localStorage)
                        .filter(k => k.startsWith('watcher_'))
                        .forEach(k => localStorage.removeItem(k));
                    const serverTheme = res.data.theme;
                    if (serverTheme && THEMES[serverTheme]) {
                        applyAndTrack(serverTheme);
                        setCurrentTheme(serverTheme);
                    }
                })
                .catch(() => {
                    preferencesService.init({});
                });
        }
    }, []);

    const changeTheme = (themeName) => {
        if (!THEMES[themeName]) return;
        if (!window.AVAILABLE_THEMES || !window.AVAILABLE_THEMES[themeName]) return;
        applyAndTrack(themeName);
        setCurrentTheme(themeName);
        const token = localStorage.getItem('token');
        if (token) {
            axios
                .patch('/api/auth/profile', { theme: themeName }, { headers: { Authorization: `Token ${token}` } })
                .catch(() => {});
        }
    };

    const setEffects = (level) => {
        if (!EFFECT_LEVELS[level]) return;
        setEffectsState(level);
        preferencesService.set(EFFECTS_PREF_KEY, level);
    };

    const value = {
        currentTheme,
        currentThemeConfig: THEMES[currentTheme] || THEMES.flatly,
        themeVersion,
        availableThemes: THEMES,
        changeTheme,
        effects,
        setEffects,
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme must be used within a ThemeProvider');
    return context;
};
