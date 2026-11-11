import React from 'react';
import PropTypes from 'prop-types';
import { Offcanvas } from 'react-bootstrap';

// Right-hand side panel showing one record (alert, CVE, victim, site...) while the list stays visible.
// Read-only details live here; forms and confirmations stay in modals.

export const DetailDrawer = ({ show, onHide, icon, title, subtitle, badges, actions, children, width }) => (
    <Offcanvas
        show={show}
        onHide={onHide}
        placement="end"
        className="wt-drawer"
        style={width ? { '--wt-drawer-width': `${width}px` } : undefined}
        aria-labelledby="wt-drawer-title"
    >
        <Offcanvas.Header closeButton closeLabel="Close details" className="wt-drawer-header">
            <div className="wt-drawer-heading">
                {icon && <span className="wt-icon-chip wt-icon-chip-lg"><i className="material-icons">{icon}</i></span>}
                <div className="wt-drawer-titles">
                    <Offcanvas.Title id="wt-drawer-title" as="h2">{title}</Offcanvas.Title>
                    {subtitle && <div className="wt-drawer-subtitle">{subtitle}</div>}
                </div>
            </div>
        </Offcanvas.Header>
        {badges && <div className="wt-drawer-badges">{badges}</div>}
        <Offcanvas.Body className="wt-drawer-body">
            {children}
        </Offcanvas.Body>
        {actions && <div className="wt-drawer-actions">{actions}</div>}
    </Offcanvas>
);

DetailDrawer.propTypes = {
    show:     PropTypes.bool.isRequired,
    onHide:   PropTypes.func.isRequired,
    icon:     PropTypes.string,
    title:    PropTypes.node.isRequired,
    subtitle: PropTypes.node,
    badges:   PropTypes.node,
    actions:  PropTypes.node,
    children: PropTypes.node,
    width:    PropTypes.number,
};

export const DrawerSection = ({ title, icon, children }) => (
    <section className="wt-drawer-section">
        {title && (
            <h3 className="wt-drawer-section-title">
                {icon && <i className="material-icons" aria-hidden="true">{icon}</i>}
                {title}
            </h3>
        )}
        {children}
    </section>
);

DrawerSection.propTypes = {
    title:    PropTypes.node,
    icon:     PropTypes.string,
    children: PropTypes.node,
};

const isEmpty = v => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

// Label / value list; empty values render as a muted dash. `mono` for IPs, hashes, URLs.
export const DrawerFields = ({ items }) => (
    <dl className="wt-drawer-fields">
        {items.filter(Boolean).map(item => (
            <div key={item.label} className={item.wide ? 'is-wide' : ''}>
                <dt>{item.label}</dt>
                <dd className={item.mono ? 'is-mono' : ''}>
                    {isEmpty(item.value) ? <span className="text-muted">-</span> : item.value}
                </dd>
            </div>
        ))}
    </dl>
);

DrawerFields.propTypes = {
    items: PropTypes.arrayOf(PropTypes.shape({
        label: PropTypes.string.isRequired,
        value: PropTypes.node,
        mono:  PropTypes.bool,
        wide:  PropTypes.bool,
    })).isRequired,
};

// Make a table row open the drawer on click / Enter, without hijacking clicks on
// links, buttons, checkboxes or inputs inside the row.
const INTERACTIVE = 'a, button, input, select, textarea, label, [role="button"], .form-check, .dropdown-menu';

export const rowOpenProps = (onOpen, active = false) => ({
    className: `wt-row-clickable${active ? ' wt-row-active' : ''}`,
    tabIndex: 0,
    'aria-selected': active || undefined,
    onClick: e => {
        if (e.target.closest(INTERACTIVE)) return;
        if (window.getSelection && String(window.getSelection())) return; // let users select text
        onOpen();
    },
    onKeyDown: e => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
            e.preventDefault();
            onOpen();
        }
    },
});

export default DetailDrawer;
