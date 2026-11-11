import React from 'react';
import PropTypes from 'prop-types';

// Shared table body states used by every TableManager-driven table.

const SKELETON_WIDTHS = ['72%', '48%', '86%', '60%', '38%', '66%'];

export const LoadingRows = ({ colSpan, rows = 5 }) => (
    <>
        {Array.from({ length: rows }, (_, r) => (
            <tr key={r} className="wt-skeleton-row" aria-hidden={r > 0 ? true : undefined}>
                {Array.from({ length: Math.max(Number(colSpan) || 1, 1) }, (_, c) => (
                    <td key={c}>
                        <span
                            className="wt-skeleton"
                            style={{ width: SKELETON_WIDTHS[(r + c) % SKELETON_WIDTHS.length] }}
                        />
                        {r === 0 && c === 0 && <span className="visually-hidden">Loading data...</span>}
                    </td>
                ))}
            </tr>
        ))}
    </>
);

LoadingRows.propTypes = {
    colSpan: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    rows:    PropTypes.number,
};

export const EmptyRow = ({ colSpan, title = 'No results found', hint, icon = 'inbox' }) => (
    <tr className="wt-empty-row">
        <td colSpan={colSpan}>
            <div className="wt-empty">
                <span className="wt-empty-icon"><i className="material-icons">{icon}</i></span>
                <div className="wt-empty-title">{title}</div>
                <div className="wt-empty-hint">{hint || 'Try adjusting your search or filters.'}</div>
            </div>
        </td>
    </tr>
);

EmptyRow.propTypes = {
    colSpan: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    title:   PropTypes.string,
    hint:    PropTypes.string,
    icon:    PropTypes.string,
};
