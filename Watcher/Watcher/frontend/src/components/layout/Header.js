import React, { Component, useRef, useEffect } from 'react';
import { withRouter } from "react-router-dom";
import { connect } from "react-redux";
import PropTypes from "prop-types";
import PendingActionsPanel from "./PendingActionsPanel";
import { openCommandPalette, SHORTCUT_LABEL } from "./CommandPalette";



function positionMenuUnderButton(button, menu, gap = 6) {
    const originalDisplay = menu.style.display;
    const originalVisibility = menu.style.visibility;
    menu.style.display = 'block';
    menu.style.visibility = 'hidden';

    const btnRect = button.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    menu.style.position = 'absolute';
    // Relative to the .btn-group wrapper, whose height is the button's: no measurement needed
    menu.style.top = `calc(100% + ${gap}px)`;

    const menuRight = btnRect.left + menuRect.width;
    if (menuRight > viewportWidth) {
        menu.style.left = 'auto';
        menu.style.right = '0';
    } else {
        menu.style.left = '0';
        menu.style.right = 'auto';
    }

    const spaceBelow = viewportHeight - btnRect.bottom - gap;
    if (menuRect.height > spaceBelow) {
        const maxHeight = Math.max(spaceBelow, 120);
        menu.style.maxHeight = `${maxHeight}px`;
        menu.style.overflowY = 'auto';
    } else {
        menu.style.maxHeight = 'none';
        menu.style.overflowY = 'visible';
    }

    menu.style.display = originalDisplay;
    menu.style.visibility = originalVisibility;
}

const HelpButton = ({ swaggerUrl, swaggerLabel }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const buttonRef = useRef(null);
    const menuRef = useRef(null);

    const handleToggle = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isOpen && buttonRef.current && menuRef.current) {
            positionMenuUnderButton(buttonRef.current, menuRef.current);
        }
        setIsOpen(!isOpen);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (buttonRef.current && !buttonRef.current.contains(event.target) &&
                menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    return (
        <div className="btn-group position-relative me-2">
            <button
                ref={buttonRef}
                className="btn btn-secondary dropdown-toggle ms-2"
                type="button"
                onClick={handleToggle}
                title="Help"
                aria-haspopup="true"
                aria-expanded={isOpen}
            >
                <i className="material-icons align-middle small">help_outline</i>
            </button>
            <div ref={menuRef} className={`dropdown-menu dropdown-menu-end ${isOpen ? 'show' : ''}`} style={{ minWidth: 200 }}>
                {swaggerUrl && (
                    <a
                        className="dropdown-item"
                        href={swaggerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setIsOpen(false)}
                    >
                        <i className="material-icons me-2 align-middle small">settings</i>
                        {swaggerLabel}
                    </a>
                )}
                {swaggerUrl && <div className="dropdown-divider"></div>}
                <a
                    className="dropdown-item"
                    href="https://thalesgroup-cert.github.io/Watcher/"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsOpen(false)}
                >
                    <i className="material-icons me-2 align-middle small">notes</i>
                    Documentation
                </a>
                <a
                    className="dropdown-item"
                    href="https://github.com/thalesgroup-cert/Watcher"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsOpen(false)}
                >
                    <i className="material-icons me-2 align-middle small">info</i>
                    About Watcher
                </a>
            </div>
        </div>
    );
};

const PAGE_META = {
    '/overview':           { title: 'Overview',               subtitle: 'What happened across every module',             icon: 'space_dashboard' },
    '/threats_watcher/statistics': { title: 'Threats Watcher', subtitle: 'Statistics · trending words, CVEs and ransomware', icon: 'radar' },
    '/cyber_watch/statistics':        { title: 'Cyber Watch',           subtitle: 'Statistics · watch rules, RSS feeds and keywords', icon: 'bug_report' },
    '/data_leak/statistics':          { title: 'Data Leak',             subtitle: 'Statistics · leak alerts, patterns and sources',   icon: 'policy' },
    '/dns_finder/statistics':         { title: 'DNS Threats Monitored', subtitle: 'Statistics · suspicious domains and triage',       icon: 'dns' },
    '/website_monitoring/statistics': { title: 'Website Monitoring',    subtitle: 'Statistics · changes, legitimacy and expirations', icon: 'language' },
    '/legitimate_domains/statistics': { title: 'Legitimate Domains',    subtitle: 'Statistics · renewals and portfolio',              icon: 'verified_user' },
    '/':                   { title: 'Threats Watcher',        subtitle: 'Trending threats, CVEs and ransomware activity',   icon: 'radar' },
    '/legitimate_domains': { title: 'Legitimate Domains',     subtitle: "Your organisation's registered domains",           icon: 'verified_user' },
    '/cyber_watch':        { title: 'Cyber Watch',            subtitle: 'CVE and ransomware intelligence, watch rules',     icon: 'bug_report' },
    '/data_leak':          { title: 'Data Leak',              subtitle: 'Leaks across paste sites and code registries',     icon: 'policy' },
    '/website_monitoring': { title: 'Website Monitoring',     subtitle: 'Malicious domain surveillance and UDRP cases',     icon: 'language' },
    '/dns_finder':         { title: 'DNS Threats Monitored',  subtitle: 'Typosquatted and look-alike domains',              icon: 'dns' },
    '/connectors':         { title: 'Connectors',             subtitle: 'Integrations and health checks',                   icon: 'settings_input_component' },
    '/login':              { title: 'Login',                  subtitle: '',                                                 icon: 'vpn_key' },
    '/password_change':    { title: 'Password Change',        subtitle: 'Update your account password',                     icon: 'lock' },
    '/profile':            { title: 'My Profile',             subtitle: 'Settings, themes and layouts',                     icon: 'account_circle' },
};

export class Header extends Component {
    static propTypes = {
        auth: PropTypes.object.isRequired,
        location: PropTypes.object.isRequired,
        history: PropTypes.object.isRequired,
        onToggleSidebar: PropTypes.func,
    };

    updateTitle() {
        const meta = PAGE_META[this.props.location.pathname];
        document.title = meta && this.props.location.pathname !== '/' ? `${meta.title} - Watcher` : 'Watcher';
    }

    componentDidMount() {
        this.updateTitle();
    }

    componentDidUpdate(prevProps) {
        if (prevProps.location.pathname !== this.props.location.pathname) {
            this.updateTitle();
        }
    }

    render() {
        const { isAuthenticated } = this.props.auth;
        const { helpButtonUrl, helpButtonLabel } = this.props.config;
        const meta = PAGE_META[this.props.location.pathname] || { title: 'Watcher', subtitle: '', icon: 'visibility' };

        return (
            <header className="navbar wt-topbar">
                <div className="wt-page-title">
                    <button
                        type="button"
                        className="btn btn-secondary wt-burger"
                        onClick={this.props.onToggleSidebar}
                        aria-label="Toggle navigation"
                        title="Menu"
                    >
                        <i className="material-icons" style={{ fontSize: 20 }}>menu</i>
                    </button>
                    <span className="wt-icon-chip wt-icon-chip-lg">
                        <i className="material-icons">{meta.icon}</i>
                    </span>
                    <div style={{ minWidth: 0 }}>
                        <h1>{meta.title}</h1>
                        {meta.subtitle && <p>{meta.subtitle}</p>}
                    </div>
                </div>

                <ul className="navbar-nav ms-auto d-flex flex-row align-items-center">
                    <li className="nav-item">
                        <button
                            type="button"
                            className="btn btn-secondary wt-search-trigger"
                            onClick={openCommandPalette}
                            title={`Search and jump anywhere (${SHORTCUT_LABEL})`}
                        >
                            <i className="material-icons" aria-hidden="true">search</i>
                            <span className="wt-search-label">Search…</span>
                            <kbd>{SHORTCUT_LABEL}</kbd>
                        </button>
                    </li>
                    <li className="nav-item">
                        <HelpButton swaggerUrl={helpButtonUrl} swaggerLabel={helpButtonLabel} />
                    </li>
                    {/* Account actions (profile, logout, login) live in the sidebar */}
                    {isAuthenticated && (
                        <li className="nav-item">
                            <PendingActionsPanel />
                        </li>
                    )}
                </ul>
            </header>
        );
    }
}

const mapStateToProps = state => ({
    auth:    state.auth,
    config:  state.config,
});

export default withRouter(connect(mapStateToProps)(Header));