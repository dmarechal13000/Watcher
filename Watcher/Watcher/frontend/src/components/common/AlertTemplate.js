import React from 'react';

// Toast used by react-alert. Colours come from the active theme (see .wt-toast in watcher-modern.css).
const TYPES = {
    success: { icon: 'check_circle', label: 'Success' },
    error:   { icon: 'error',        label: 'Error' },
    warning: { icon: 'warning',      label: 'Warning' },
    info:    { icon: 'info',         label: 'Information' },
    delete:  { icon: 'delete',       label: 'Deleted' },
};

const AlertTemplate = ({ style, options, message, close }) => {
    const type = TYPES[options.type] ? options.type : 'info';
    const { icon, label } = TYPES[type];
    const timeout = Number(options.timeout) || 0;

    return (
        <div
            className={`wt-toast wt-toast-${type}`}
            style={style}
            role={type === 'error' ? 'alert' : 'status'}
            aria-live={type === 'error' ? 'assertive' : 'polite'}
        >
            <span className="wt-toast-icon" aria-hidden="true">
                <span className="material-icons">{icon}</span>
            </span>
            <div className="wt-toast-body">
                <span className="visually-hidden">{label}: </span>
                {message}
            </div>
            <button type="button" className="wt-toast-close" onClick={close} aria-label="Close">
                <span className="material-icons">close</span>
            </button>
            {timeout > 0 && (
                <span className="wt-toast-timer" style={{ animationDuration: `${timeout}ms` }} aria-hidden="true" />
            )}
        </div>
    );
};

export default AlertTemplate;
