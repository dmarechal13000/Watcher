import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import WatcherMark from './WatcherMark';
import { openCommandPalette, SHORTCUT_LABEL } from '../layout/CommandPalette';

const NotFound = ({ isAuthenticated }) => {
    const { pathname } = useLocation();

    return (
        <div className="wt-notfound">
            <div className="wt-notfound-mark" aria-hidden="true">
                <WatcherMark />
            </div>
            <div className="wt-eyebrow">Error 404</div>
            <h1>Nothing to watch here</h1>
            <p>
                The page <code>{pathname}</code> doesn't exist or has been moved.
            </p>
            <div className="wt-notfound-actions">
                <Link to={isAuthenticated ? '/overview' : '/'} replace className="btn btn-primary">
                    <i className="material-icons" aria-hidden="true">{isAuthenticated ? 'space_dashboard' : 'radar'}</i>
                    {isAuthenticated ? 'Back to Overview' : 'Back to Threats Watcher'}
                </Link>
                <button type="button" className="btn btn-secondary wt-btn-ghost" onClick={openCommandPalette}>
                    <i className="material-icons" aria-hidden="true">search</i>
                    Search Watcher
                    <kbd>{SHORTCUT_LABEL}</kbd>
                </button>
            </div>
        </div>
    );
};

NotFound.propTypes = { isAuthenticated: PropTypes.bool };

const mapStateToProps = state => ({ isAuthenticated: !!state.auth.isAuthenticated });

export default connect(mapStateToProps)(NotFound);
