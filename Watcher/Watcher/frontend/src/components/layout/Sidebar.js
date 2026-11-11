import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { logout } from '../../actions/auth';
import UserAvatar, { displayName } from '../common/UserAvatar';
import { WatcherLogo } from '../common/WatcherMark';

// Module navigation, grouped like the icon rail: home / detection modules / organisation assets.
export const NAV_GROUPS = [
    [
        { to: '/overview', label: 'Overview', icon: 'space_dashboard', auth: true },
        { to: '/', label: 'Threats Watcher', icon: 'radar', exact: true, also: ['/threats_watcher'] },
    ],
    [
        { to: '/cyber_watch',        label: 'Cyber Watch',           icon: 'bug_report' },
        { to: '/data_leak',          label: 'Data Leak',             icon: 'policy' },
        { to: '/dns_finder',         label: 'DNS Threats Monitored', icon: 'dns' },
        { to: '/website_monitoring', label: 'Website Monitoring',    icon: 'language' },
    ],
    [
        { to: '/legitimate_domains', label: 'Legitimate Domains',    icon: 'verified_user' },
    ],
];

// `also`: extra path prefixes that keep the entry highlighted (e.g. a module's Statistics tab)
const SideLink = ({ to, label, icon, exact, also, onNavigate }) => (
    <NavLink
        to={to}
        exact={exact}
        isActive={also ? (match, location) => !!match || also.some(p => location.pathname.startsWith(p)) : undefined}
        replace
        className="wt-side-link"
        activeClassName="active"
        data-label={label}
        aria-label={label}
        onClick={onNavigate}
    >
        <i className="material-icons">{icon}</i>
        <span className="wt-side-label">{label}</span>
    </NavLink>
);

export const Sidebar = ({ auth, avatarColor, logout, onNavigate }) => {
    const { isAuthenticated, user } = auth;

    return (
        <nav className="wt-sidebar" aria-label="Main navigation">
            <Link to={isAuthenticated ? '/overview' : '/'} replace className="navbar-brand wt-sidebar-brand" onClick={onNavigate} title="Watcher">
                <WatcherLogo size={40} />
            </Link>

            {NAV_GROUPS.map((group, i) => (
                <React.Fragment key={i}>
                    <div className="wt-sidebar-sep" />
                    <div className="wt-sidebar-group">
                        {group.filter(item => !item.auth || isAuthenticated).map(item => (
                            <SideLink key={item.to} {...item} onNavigate={onNavigate} />
                        ))}
                    </div>
                </React.Fragment>
            ))}

            {/* Account actions live here only (not in the top bar) */}
            <div className="wt-sidebar-group wt-sidebar-bottom">
                <div className="wt-sidebar-sep" />
                {isAuthenticated ? (
                    <>
                        {user && user.is_superuser && (
                            <SideLink to="/connectors" label="Connectors" icon="settings_input_component" onNavigate={onNavigate} />
                        )}
                        <NavLink
                            to="/profile"
                            replace
                            className="wt-side-link wt-side-profile"
                            activeClassName="active"
                            data-label={user ? `My Profile · ${displayName(user.first_name, user.last_name, user.username)}` : 'My Profile'}
                            aria-label="My Profile"
                            onClick={onNavigate}
                        >
                            <UserAvatar
                                username={user?.username || ''}
                                firstName={user?.first_name || ''}
                                lastName={user?.last_name || ''}
                                avatarColor={avatarColor}
                                size={26}
                                tooltip={false}
                            />
                            <span className="wt-side-label">My Profile</span>
                        </NavLink>
                        <button
                            type="button"
                            className="wt-side-link border-0"
                            data-label="Logout"
                            aria-label="Logout"
                            onClick={() => { if (onNavigate) onNavigate(); logout(); }}
                        >
                            <i className="material-icons">logout</i>
                            <span className="wt-side-label">Logout</span>
                        </button>
                    </>
                ) : (
                    <SideLink to="/login" label="Login" icon="key" onNavigate={onNavigate} />
                )}
            </div>
        </nav>
    );
};

Sidebar.propTypes = {
    auth: PropTypes.object.isRequired,
    avatarColor: PropTypes.string,
    logout: PropTypes.func.isRequired,
    onNavigate: PropTypes.func,
};

const mapStateToProps = state => ({ auth: state.auth, avatarColor: state.profile?.avatar_color });

export default connect(mapStateToProps, { logout })(Sidebar);
