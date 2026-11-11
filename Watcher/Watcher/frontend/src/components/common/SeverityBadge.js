import React from 'react';
import PropTypes from 'prop-types';

// Severity is a reserved status scale: always shown with an icon and a label, never colour alone.
const LEVELS = {
    CRITICAL: { tone: 'critical', icon: 'error',          label: 'Critical' },
    HIGH:     { tone: 'high',     icon: 'warning',        label: 'High' },
    MEDIUM:   { tone: 'medium',   icon: 'info',           label: 'Medium' },
    LOW:      { tone: 'low',      icon: 'arrow_downward', label: 'Low' },
};

// CVSS v3 qualitative bands
export const cvssLevel = score => {
    const s = Number(score);
    if (!isFinite(s)) return null;
    if (s >= 9) return 'CRITICAL';
    if (s >= 7) return 'HIGH';
    if (s >= 4) return 'MEDIUM';
    if (s > 0) return 'LOW';
    return null;
};

export const SeverityBadge = ({ severity }) => {
    const level = LEVELS[String(severity || '').toUpperCase()];
    if (!level) return <span className="text-muted">-</span>;
    return (
        <span className={`wt-sev wt-sev-${level.tone}`}>
            <i className="material-icons" aria-hidden="true">{level.icon}</i>
            {String(severity).toUpperCase()}
        </span>
    );
};

SeverityBadge.propTypes = {
    severity: PropTypes.string,
};

// Score + a small meter whose fill carries the severity band.
export const CvssScore = ({ score }) => {
    if (score == null || score === '') return <span className="text-muted">-</span>;
    const value = Number(score);
    const level = LEVELS[cvssLevel(value)];
    const pct = Math.max(0, Math.min(100, (value / 10) * 100));
    return (
        <span className={`wt-cvss ${level ? `wt-sev-${level.tone}` : ''}`} title={`CVSS ${value}${level ? ` - ${level.label}` : ''}`}>
            <span className="wt-cvss-value">{isFinite(value) ? value.toFixed(1) : score}</span>
            <span className="wt-cvss-meter" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
        </span>
    );
};

CvssScore.propTypes = {
    score: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};

export default SeverityBadge;
