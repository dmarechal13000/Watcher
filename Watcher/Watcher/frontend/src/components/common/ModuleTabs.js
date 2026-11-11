import React from 'react';
import PropTypes from 'prop-types';
import { NavLink } from 'react-router-dom';

// Page-level tabs shared by the modules: "Surveillance" (the operational view) and
// "Statistics" (the analytics view). Each tab is a route, so it can be bookmarked or linked.
const ModuleTabs = ({ tabs, extra }) => (
    <div className="wt-module-tabs">
        <nav className="wt-module-tabs-nav" aria-label="Module views">
            {tabs.map(tab => (
                <NavLink
                    key={tab.to}
                    to={tab.to}
                    exact
                    replace
                    className="wt-module-tab"
                    activeClassName="is-active"
                >
                    <i className="material-icons" aria-hidden="true">{tab.icon}</i>
                    {tab.label}
                </NavLink>
            ))}
        </nav>
        {extra && <div className="wt-module-tabs-extra">{extra}</div>}
    </div>
);

ModuleTabs.propTypes = {
    tabs: PropTypes.arrayOf(PropTypes.shape({
        to:    PropTypes.string.isRequired,
        label: PropTypes.string.isRequired,
        icon:  PropTypes.string.isRequired,
    })).isRequired,
    extra: PropTypes.node,
};

export default ModuleTabs;
