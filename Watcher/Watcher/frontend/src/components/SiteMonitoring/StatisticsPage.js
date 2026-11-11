import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import moment from 'moment';
import { getSiteStatistics, getAllSites, getAllSiteAlerts } from '../../actions/SiteMonitoring';
import StatCard from '../common/StatCard';
import KpiStrip from '../common/KpiStrip';
import { Bar, HorizontalBar, Doughnut } from '../common/ThemedCharts';
import { CHART_COLORS as C } from '../common/chartTheme';
import { ChartCard, Section, StatsShell, clickable, GREY, SEVERITY_HIGH, CATEGORICAL, barOptions, hbarOptions, doughnutOptions, singleBar, doughnutData, moduleTabs } from '../common/StatsKit';
import { countByBucket, inPeriod, topCounts } from '../common/statsUtils';
import { requestFilters } from '../common/pendingFilters';

// Website Monitoring "Statistics" tab + the compact KPI row of its Surveillance tab.

export const SITE_MONITORING_TABS = moduleTabs('/website_monitoring');

// Legitimacy scale (same order and meaning as the Suspicious Websites table)
const LEGITIMACY = [
    { value: 1, label: 'Unknown', color: GREY },
    { value: 2, label: 'Suspicious, not harmful', color: C.warning },
    { value: 3, label: 'Likely harmful (registered)', color: SEVERITY_HIGH },
    { value: 4, label: 'Likely harmful (available)', color: SEVERITY_HIGH },
    { value: 5, label: 'Malicious (registered)', color: C.danger },
    { value: 6, label: 'Malicious (available / disabled)', color: C.danger },
];
const EXPIRY_WINDOWS = [
    { label: 'Expired', test: d => d < 0 },
    { label: '0-30 days', test: d => d >= 0 && d <= 30 },
    { label: '31-60 days', test: d => d > 30 && d <= 60 },
    { label: '61-90 days', test: d => d > 60 && d <= 90 },
];
const daysUntil = date => (date ? moment(date).startOf('day').diff(moment().startOf('day'), 'days') : null);

const mapStateToProps = state => ({
    statistics: state.SiteMonitoring.statistics || {},
    sites:      state.SiteMonitoring.allSites || [],
    alerts:     state.SiteMonitoring.allAlerts || [],
});
const actions = { getSiteStatistics, getAllSites, getAllSiteAlerts };

class SiteKpisBase extends Component {
    static propTypes = { statistics: PropTypes.object.isRequired, getSiteStatistics: PropTypes.func.isRequired };

    componentDidMount() { this.props.getSiteStatistics(); }

    render() {
        const s = this.props.statistics;
        return (
            <KpiStrip statsTo="/website_monitoring/statistics" cards={[
                { title: 'TOTAL SITES', value: s.total ?? 0, sub: `${s.newThisWeek ?? 0} added this week`, icon: 'link', variant: 'primary' },
                { title: 'MALICIOUS', value: s.malicious ?? 0, sub: 'confirmed malicious', icon: 'dangerous', variant: 'danger' },
                { title: 'TAKEDOWN REQUESTS', value: s.takedownRequests ?? 0, sub: 'sites under takedown', icon: 'block', variant: 'warning' },
                { title: 'LEGAL TEAM', value: s.legalTeam ?? 0, sub: 'legal team involvement', icon: 'gavel', variant: 'success' },
            ]} />
        );
    }
}

export const SiteSurveillanceKpis = connect(mapStateToProps, actions)(SiteKpisBase);

export class SiteStatisticsPage extends Component {
    static propTypes = {
        statistics: PropTypes.object.isRequired,
        sites: PropTypes.array.isRequired,
        alerts: PropTypes.array.isRequired,
        getSiteStatistics: PropTypes.func.isRequired,
        getAllSites: PropTypes.func.isRequired,
        getAllSiteAlerts: PropTypes.func.isRequired,
        history: PropTypes.object.isRequired,
    };

    componentDidMount() {
        this.props.getSiteStatistics();
        this.props.getAllSites();
        this.props.getAllSiteAlerts();
    }

    // Chart click: open the Surveillance tab with that filter applied
    filterBy = (filters) => {
        requestFilters('website_monitoring', filters);
        this.props.history.push('/website_monitoring');
    };

    renderBody = ({ buckets, periodLabel, perBucket }) => {
        const { statistics, sites, alerts } = this.props;
        const inRange = alerts.filter(a => inPeriod(a.created_at, buckets.since));
        const types = topCounts(inRange, a => a.type || 'Other change', 4, true);
        const typeSeries = types.map(([type], i) => ({
            label: type,
            color: CATEGORICAL[i % CATEGORICAL.length],
            data: countByBucket(inRange, a => a.created_at, buckets,
                type === 'Other' ? a => !types.slice(0, 4).some(([t]) => t === (a.type || 'Other change')) : a => (a.type || 'Other change') === type),
        }));
        const perAll = countByBucket(inRange, a => a.created_at, buckets);
        const added = sites.filter(s => inPeriod(s.created_at, buckets.since));
        const legit = LEGITIMACY.map(l => sites.filter(s => s.legitimacy === l.value).length);
        const actionsCounts = [
            sites.filter(s => s.takedown_request).length,
            sites.filter(s => s.legal_team).length,
            sites.filter(s => s.blocking_request).length,
        ];
        const expiry = EXPIRY_WINDOWS.map(w => ({
            domain: sites.filter(s => { const d = daysUntil(s.domain_expiry); return d !== null && w.test(d); }).length,
            ssl: sites.filter(s => { const d = daysUntil(s.ssl_expiry); return d !== null && w.test(d); }).length,
        }));
        const sslSoon = expiry[1].ssl;
        const emptyAlerts = inRange.length === 0 && `No change detected in the ${periodLabel}.`;
        const emptySites = sites.length === 0 && 'No monitored website yet.';

        return (
            <>
                <div className="wt-kpi-strip wt-kpi-strip-6">
                    <StatCard title="Changes detected" value={inRange.length} sub={periodLabel} icon="notifications" variant="primary"
                              trend={perAll} trendLabel={`Alerts ${perBucket}, ${periodLabel}`} />
                    <StatCard title="Sites added" value={added.length} sub={periodLabel} icon="add_circle_outline" variant="info" />
                    <StatCard title="Sites monitored" value={statistics.total ?? sites.length} sub="all periods" icon="language" variant="secondary" />
                    <StatCard title="Malicious" value={statistics.malicious ?? 0} sub="confirmed malicious" icon="report" variant="danger" />
                    <StatCard title="Takedown requests" value={statistics.takedownRequests ?? actionsCounts[0]} sub="in progress" icon="gavel" variant="warning" />
                    <StatCard title="SSL expiring" value={sslSoon} sub="within 30 days" icon="lock" variant="warning" />
                </div>

                <Section title="Changes detected" icon="track_changes">
                    <div className="wt-stats-grid wt-stats-grid-2-1">
                        <ChartCard title={`Alerts ${perBucket}, by change type`} icon="bar_chart" total={`${inRange.length} in the ${periodLabel}`}
                                   empty={emptyAlerts} hint="IP, MX, content, banner or registrar changes detected on monitored websites.">
                            <Bar
                                data={{
                                    labels: buckets.labels,
                                    datasets: typeSeries.map(s => ({ label: s.label, data: s.data, backgroundColor: s.color.faded, hoverBackgroundColor: s.color.hover, borderWidth: 0 })),
                                }}
                                options={barOptions({ stacked: true, titles: buckets.titles, legend: true })}
                            />
                        </ChartCard>
                        <ChartCard title="Change types" icon="donut_large" empty={emptyAlerts}>
                            <Doughnut data={doughnutData(types.map(([k]) => k), types.map(([, v]) => v), typeSeries.map(s => s.color))} options={doughnutOptions} />
                        </ChartCard>
                    </div>
                </Section>

                <Section title="Monitored websites" icon="language">
                    <div className="wt-stats-grid wt-stats-grid-2">
                        <ChartCard title="Legitimacy" icon="policy" height={240} empty={emptySites} hint="Current legitimacy assessment of every monitored website."
                                   clickHint="Click a level to list those websites">
                            <HorizontalBar
                                data={{
                                    labels: LEGITIMACY.map(l => l.label),
                                    datasets: [{ label: 'Sites', data: legit, backgroundColor: LEGITIMACY.map(l => l.color.faded), hoverBackgroundColor: LEGITIMACY.map(l => l.color.hover), borderWidth: 0 }],
                                }}
                                options={clickable(hbarOptions, i => this.filterBy({ legitimacy: String(LEGITIMACY[i].value) }))}
                            />
                        </ChartCard>
                        <ChartCard title="Response actions" icon="gavel" height={240} empty={emptySites} hint="Sites with a takedown request, escalated to the legal team, or with a blocking request."
                                   clickHint="Click a bar to list those websites">
                            <Bar data={singleBar(['Takedown', 'Legal team', 'Blocking'], actionsCounts, 'Sites', C.warning)}
                                 options={clickable(barOptions(), i => this.filterBy({ [['takedown', 'legal', 'blocking'][i]]: 'yes' }))} />
                        </ChartCard>
                    </div>
                    <div className="wt-stats-grid wt-stats-grid-2">
                        <ChartCard title="Upcoming expirations" icon="event" height={240} empty={emptySites}
                                   hint="Monitored domains and SSL certificates by time left before they expire.">
                            <Bar
                                data={{
                                    labels: EXPIRY_WINDOWS.map(w => w.label),
                                    datasets: [
                                        { label: 'Domain', data: expiry.map(e => e.domain), backgroundColor: C.primary.faded, hoverBackgroundColor: C.primary.hover, borderWidth: 0 },
                                        { label: 'SSL certificate', data: expiry.map(e => e.ssl), backgroundColor: C.info.faded, hoverBackgroundColor: C.info.hover, borderWidth: 0 },
                                    ],
                                }}
                                options={barOptions({ legend: true })}
                            />
                        </ChartCard>
                        <ChartCard title="Monitoring status" icon="visibility" height={240} empty={emptySites}>
                            <Doughnut
                                data={doughnutData(['Monitored', 'Pending first check'],
                                    [sites.filter(s => s.monitored).length, sites.filter(s => !s.monitored).length], [C.success, GREY])}
                                options={doughnutOptions}
                            />
                        </ChartCard>
                    </div>
                </Section>
            </>
        );
    };

    render() {
        return <StatsShell tabs={SITE_MONITORING_TABS} prefKey="sitemonitoring_stats_period">{this.renderBody}</StatsShell>;
    }
}

export default connect(mapStateToProps, actions)(SiteStatisticsPage);
