import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

// Shared KPI tile (Surveillance KPI rows, Statistics tabs, Overview).
// Colour lives in the icon chip only (the variant); the value and labels stay in text colours.

const VARIANTS = ['primary', 'secondary', 'success', 'info', 'warning', 'danger', 'dark'];

const formatValue = value => {
    if (typeof value !== 'number' || !isFinite(value)) return value;
    if (Math.abs(value) >= 10000) {
        return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
    }
    return value.toLocaleString();
};

// Tiny trend line: de-emphasised stroke, the latest point accented.
const Sparkline = ({ points, label }) => {
    const data = (points || []).map(Number).filter(n => isFinite(n));
    if (data.length < 2) return null;

    const width = 96;
    const height = 32;
    const pad = 3;
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const span = max - min || 1;
    const x = i => pad + (i * (width - pad * 2)) / (data.length - 1);
    const y = v => height - pad - ((v - min) * (height - pad * 2)) / span;
    const line = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const area = `${x(0).toFixed(1)},${height - pad} ${line} ${x(data.length - 1).toFixed(1)},${height - pad}`;
    const last = data.length - 1;

    return (
        <svg
            className="wt-stat-spark"
            viewBox={`0 0 ${width} ${height}`}
            width={width}
            height={height}
            role="img"
            aria-label={label}
        >
            <title>{label}</title>
            <polygon className="wt-stat-spark-area" points={area} />
            <polyline className="wt-stat-spark-line" points={line} />
            <circle className="wt-stat-spark-dot" cx={x(last)} cy={y(data[last])} r="3" />
        </svg>
    );
};

const motionAllowed = () => {
    const root = document.documentElement;
    if (root.getAttribute('data-wt-effects') === 'off') return false;
    return !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
};

// Counts from the previously shown value to the new one (from 0 on first display).
const useCountUp = (value, duration = 700) => {
    const [shown, setShown] = useState(typeof value === 'number' && motionAllowed() ? 0 : value);
    const fromRef = useRef(typeof shown === 'number' ? shown : 0);

    useEffect(() => {
        if (typeof value !== 'number' || !isFinite(value) || !motionAllowed()) {
            setShown(value);
            return undefined;
        }
        const from = fromRef.current;
        if (from === value) {
            setShown(value);
            return undefined;
        }
        const start = performance.now();
        let frame;
        const tick = now => {
            const t = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            const current = Math.round(from + (value - from) * eased);
            fromRef.current = current;
            setShown(current);
            if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [value, duration]);

    return shown;
};

const StatCard = ({ title, value, sub, icon, variant = 'primary', trend, trendLabel }) => {
    const tone = VARIANTS.includes(variant) ? variant : 'primary';
    const shown = useCountUp(value);
    const sparkLabel = trend && trend.length > 1
        ? `${trendLabel || 'Trend'}: ${trend.join(', ')}`
        : undefined;

    return (
        <div className={`card wt-stat wt-stat-${tone} h-100`}>
            <div className="card-body">
                <div className="wt-stat-head">
                    <span className="wt-stat-icon">
                        <i className="material-icons">{icon}</i>
                    </span>
                    <span className="wt-stat-label text-uppercase" title={title}>{title}</span>
                </div>
                <div className="wt-stat-body">
                    <div className="wt-stat-main">
                        <div className="wt-stat-value" aria-label={String(formatValue(value))}>{formatValue(shown)}</div>
                        {sub && <div className="wt-stat-sub" title={sub}>{sub}</div>}
                    </div>
                    {sparkLabel && <Sparkline points={trend} label={sparkLabel} />}
                </div>
            </div>
        </div>
    );
};

StatCard.propTypes = {
    title:      PropTypes.string.isRequired,
    value:      PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    sub:        PropTypes.string,
    icon:       PropTypes.string.isRequired,
    variant:    PropTypes.string,
    trend:      PropTypes.arrayOf(PropTypes.number),
    trendLabel: PropTypes.string,
};

export default StatCard;
