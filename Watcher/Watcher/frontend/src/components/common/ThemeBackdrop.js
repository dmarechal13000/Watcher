import React, { useEffect, useRef, useState } from 'react';
import { useTheme, THEMES } from '../../contexts/ThemeContext';
import WatcherMark from './WatcherMark';

// Ambient backdrop for themes flagged `ambient` in THEMES (Clay, Clay Light). Everything is drawn
// in a fixed layer *behind* the app (z-index 0); modules are translucent glass, so the effects show
// through them without ever being painted on top of the content.
// The user's "effects" setting: full (motion + pointer + ripples), calm (static glows), off.
const MAX_RIPPLES = 5;
const RIPPLE_MS = 1400;
const RAYS = Array.from({ length: 12 }, (_, i) => i * 30);

const Rays = () => (
    <svg className="wt-ambient-rays" viewBox="0 0 200 200" aria-hidden="true">
        {RAYS.map(angle => (
            <line
                key={angle}
                x1="100" y1="58" x2="100" y2={angle % 60 === 0 ? 22 : 36}
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
                transform={`rotate(${angle} 100 100)`}
            />
        ))}
    </svg>
);

const ThemeBackdrop = () => {
    const { currentTheme, effects } = useTheme();
    const enabled = !!THEMES[currentTheme]?.ambient && effects !== 'off';
    const interactive = enabled && effects === 'full';
    const layerRef = useRef(null);
    const nextId = useRef(0);
    const [ripples, setRipples] = useState([]);

    useEffect(() => {
        if (!interactive) {
            setRipples([]);
            return undefined;
        }
        const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduceMotion) return undefined;

        let frame = 0;
        let pointer = null;
        const timers = new Set();

        // Pointer events are in real viewport px, but the backdrop lives inside <body>, which the
        // "Interface size" setting zooms: convert to the zoomed CSS px used by left/top.
        const bodyZoom = () => parseFloat(getComputedStyle(document.body).zoom) || 1;

        // Pointer position drives the spotlight and the watermark's gaze (CSS variables, one rAF per frame).
        const flush = () => {
            frame = 0;
            const layer = layerRef.current;
            if (!layer || !pointer) return;
            const { innerWidth: w, innerHeight: h } = window;
            const z = bodyZoom();
            layer.style.setProperty('--wt-px', `${pointer.x / z}px`);
            layer.style.setProperty('--wt-py', `${pointer.y / z}px`);
            layer.style.setProperty('--wt-gx', ((pointer.x / w) * 2 - 1).toFixed(3));
            layer.style.setProperty('--wt-gy', ((pointer.y / h) * 2 - 1).toFixed(3));
        };

        const onPointerMove = e => {
            pointer = { x: e.clientX, y: e.clientY };
            if (!frame) frame = requestAnimationFrame(flush);
        };

        const onPointerDown = e => {
            if (e.button !== 0) return;
            const id = nextId.current++;
            const z = bodyZoom();
            setRipples(rs => [...rs.slice(-(MAX_RIPPLES - 1)), { id, x: e.clientX / z, y: e.clientY / z }]);
            const t = setTimeout(() => {
                timers.delete(t);
                setRipples(rs => rs.filter(r => r.id !== id));
            }, RIPPLE_MS);
            timers.add(t);
        };

        document.addEventListener('pointermove', onPointerMove, { passive: true });
        document.addEventListener('pointerdown', onPointerDown, { passive: true });
        return () => {
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerdown', onPointerDown);
            if (frame) cancelAnimationFrame(frame);
            timers.forEach(clearTimeout);
        };
    }, [interactive]);

    if (!enabled) return null;

    return (
        <div ref={layerRef} className={`wt-ambient ${interactive ? '' : 'wt-ambient-calm'}`} aria-hidden="true">
            <span className="wt-ambient-blob wt-ambient-blob-1" />
            <span className="wt-ambient-blob wt-ambient-blob-2" />
            <span className="wt-ambient-blob wt-ambient-blob-3" />
            <span className="wt-ambient-spot" />
            <span className="wt-ambient-watermark">
                <WatcherMark />
            </span>
            {ripples.map(r => (
                <span key={r.id} className="wt-ambient-ripple" style={{ left: r.x, top: r.y }}>
                    <span className="wt-ambient-ring" />
                    <span className="wt-ambient-ring wt-ambient-ring-late" />
                    <Rays />
                    <WatcherMark className="wt-ambient-mark" />
                </span>
            ))}
            <span className="wt-ambient-grain" />
        </div>
    );
};

export default ThemeBackdrop;
