import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import { getThreatsWatcherStatistics } from '../../actions/leads';
import StatCard from '../common/StatCard';
import { THREATS_WATCHER_STATS_PATH } from './tabs';

const WEEK_MS = 7 * 24 * 3600 * 1000;

// Compact KPI row kept on the Surveillance tab; the charts live on the Statistics tab.
export class SurveillanceKpis extends Component {
    static propTypes = {
        statistics: PropTypes.object.isRequired,
        cves: PropTypes.array.isRequired,
        ransomwareVictims: PropTypes.array.isRequired,
        getThreatsWatcherStatistics: PropTypes.func.isRequired,
    };

    componentDidMount() {
        this.props.getThreatsWatcherStatistics();
    }

    render() {
        const { statistics: s, cves, ransomwareVictims } = this.props;
        const critical = cves.filter(c => String(c.severity || '').toUpperCase() === 'CRITICAL').length;
        const victimsWeek = ransomwareVictims.filter(v => v.attacked_at && Date.now() - new Date(v.attacked_at).getTime() <= WEEK_MS).length;

        return (
            <div className="wt-kpi-strip">
                <StatCard title="Trending words" value={s.totalWords || 0} sub={`+${s.newThisWeek || 0} this week`}
                          icon="list_alt" variant="primary" trend={s.dailyNew} trendLabel="New words per day, last 7 days" />
                <StatCard title="New today" value={s.newToday || 0} sub="words discovered today" icon="add_circle_outline" variant="success" />
                <StatCard title="Critical CVEs" value={critical} sub={`of ${cves.length} tracked`} icon="security" variant="danger" />
                <StatCard title="Ransomware victims" value={victimsWeek} sub="in the last 7 days" icon="lock" variant="warning" />
                <Link to={THREATS_WATCHER_STATS_PATH} className="wt-kpi-more" title="Open the Statistics tab">
                    <i className="material-icons" aria-hidden="true">insert_chart</i>
                    <span>All statistics</span>
                    <i className="material-icons" aria-hidden="true">arrow_forward</i>
                </Link>
            </div>
        );
    }
}

const mapStateToProps = state => ({
    statistics: state.leads.statistics || {},
    cves: state.CyberWatch.cves || [],
    ransomwareVictims: state.CyberWatch.ransomwareVictims || [],
});

export default connect(mapStateToProps, { getThreatsWatcherStatistics })(SurveillanceKpis);
