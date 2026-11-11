import React from 'react';

// Monochrome Watcher eye, drawn with currentColor so it follows the surrounding text color.
const WatcherMark = ({ className, style, title }) => {
    const maskId = `wt-mark-pupil-${React.useId().replace(/:/g, '')}`;
    return (
        <svg
            viewBox="0 0 120 80"
            className={className}
            style={style}
            role={title ? 'img' : undefined}
            aria-hidden={title ? undefined : true}
            aria-label={title}
        >
            <defs>
                <mask id={maskId}>
                    <rect x="-20" y="-20" width="160" height="120" fill="#fff" />
                    <circle cx="54" cy="27" r="5.5" fill="#000" />
                </mask>
            </defs>
            <path
                d="M6 40 C 30 10, 90 10, 114 40 C 90 70, 30 70, 6 40 Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="7"
                strokeLinejoin="round"
            />
            {/* Iris group: themes can shift it (CSS transform) to make the eye look around */}
            <g className="wt-mark-iris">
                <circle cx="60" cy="37" r="23" fill="none" stroke="currentColor" strokeWidth="6" />
                <circle cx="60" cy="34" r="14" fill="currentColor" mask={`url(#${maskId})`} />
                <path
                    d="M48 49 Q 60 57 72 49"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                />
            </g>
        </svg>
    );
};

// App logo: the eye on a tile tinted with the active theme's primary colour.
export const WatcherLogo = ({ size = 40, className = '' }) => (
    <span className={`wt-logo ${className}`} style={{ width: size, height: size }} role="img" aria-label="Watcher">
        <WatcherMark />
    </span>
);

export default WatcherMark;
