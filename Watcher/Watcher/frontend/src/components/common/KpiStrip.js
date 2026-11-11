import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import StatCard from './StatCard';

// Compact KPI row shown on a module's Surveillance tab, with a shortcut to its Statistics tab.
const KpiStrip = ({ cards, statsTo }) => (
    <div className="wt-kpi-strip">
        {cards.map(card => <StatCard key={card.title} {...card} />)}
        {statsTo && (
            <Link to={statsTo} className="wt-kpi-more" title="Open the Statistics tab">
                <i className="material-icons" aria-hidden="true">insert_chart</i>
                <span>All statistics</span>
                <i className="material-icons" aria-hidden="true">arrow_forward</i>
            </Link>
        )}
    </div>
);

KpiStrip.propTypes = {
    cards: PropTypes.arrayOf(PropTypes.shape({
        title: PropTypes.string.isRequired,
        value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
        icon:  PropTypes.string.isRequired,
    })).isRequired,
    statsTo: PropTypes.string,
};

export default KpiStrip;
