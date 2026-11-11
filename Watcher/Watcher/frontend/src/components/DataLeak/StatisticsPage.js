import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { getDataLeakStatistics, getAllDataLeakAlerts, getAllDataLeakKeywords } from '../../actions/DataLeak';
import StatCard from '../common/StatCard';
import KpiStrip from '../common/KpiStrip';
import { Bar, HorizontalBar, Doughnut } from '../common/ThemedCharts';
import { CHART_COLORS as C } from '../common/chartTheme';
import { ChartCard, Section, StatsShell, clickable, barOptions, hbarOptions, doughnutOptions, singleBar, doughnutData, moduleTabs } from '../common/StatsKit';
import { countByBucket, inPeriod, topCounts } from '../common/statsUtils';
import { requestFilters } from '../common/pendingFilters';

// Data Leak "Statistics" tab + the compact KPI row of its Surveillance tab.

export const DATA_LEAK_TABS = moduleTabs('/data_leak');
// Same host extraction as the Surveillance tab's "Source" filter, so a click can filter on it
const hostOf = url => { try { return url.split('//', 2)[1].split('/', 20)[0] || null; } catch (_) { return null; } };

const mapStateToProps = state => ({
    statistics: state.DataLeak.statistics || {},
    alerts:     state.DataLeak.allAlerts || [],
    keywords:   state.DataLeak.allKeywords || [],
});
const actions = { getDataLeakStatistics, getAllDataLeakAlerts, getAllDataLeakKeywords };

class DataLeakKpisBase extends Component {
    static propTypes = { statistics: PropTypes.object.isRequired, getDataLeakStatistics: PropTypes.func.isRequired };

    componentDidMount() { this.props.getDataLeakStatistics(); }

    render() {
        const s = this.props.statistics;
        return (
            <KpiStrip statsTo="/data_leak/statistics" cards={[
                { title: 'Active alerts', value: s.activeAlerts ?? 0, sub: 'currently unresolved', icon: 'warning', variant: 'danger' },
                { title: 'New today', value: s.newToday ?? 0, sub: `${s.newThisWeek ?? 0} this week`, icon: 'today', variant: 'warning' },
                { title: 'All alerts', value: s.totalAlerts ?? 0, sub: 'since monitoring started', icon: 'notifications', variant: 'primary' },
                { title: 'Search patterns', value: s.totalKeywords ?? 0, sub: 'keywords monitored', icon: 'search', variant: 'info' },
            ]} />
        );
    }
}

export const DataLeakSurveillanceKpis = connect(mapStateToProps, actions)(DataLeakKpisBase);

export class DataLeakStatisticsPage extends Component {
    static propTypes = {
        statistics: PropTypes.object.isRequired,
        alerts: PropTypes.array.isRequired,
        keywords: PropTypes.array.isRequired,
        getDataLeakStatistics: PropTypes.func.isRequired,
        getAllDataLeakAlerts: PropTypes.func.isRequired,
        getAllDataLeakKeywords: PropTypes.func.isRequired,
        history: PropTypes.object.isRequired,
    };

    componentDidMount() {
        this.props.getDataLeakStatistics();
        this.props.getAllDataLeakAlerts();
        this.props.getAllDataLeakKeywords();
    }

    // Chart click: open the Surveillance tab with that filter applied
    filterBy = (filters) => {
        requestFilters('data_leak', filters);
        this.props.history.push('/data_leak');
    };

    renderBody = ({ buckets, periodLabel, perBucket }) => {
        const { statistics, alerts, keywords } = this.props;
        const inRange = alerts.filter(a => inPeriod(a.created_at, buckets.since));
        const active = inRange.filter(a => a.status);
        const archived = inRange.filter(a => !a.status);
        const perActive = countByBucket(active, a => a.created_at, buckets);
        const perArchived = countByBucket(archived, a => a.created_at, buckets);
        const perAll = countByBucket(inRange, a => a.created_at, buckets);
        const hosts = topCounts(inRange, a => hostOf(a.url), 8);
        const kw = topCounts(inRange, a => a.keyword?.name, 8);
        const kwWithAlerts = new Set(inRange.map(a => a.keyword?.name).filter(Boolean));
        const quietPatterns = keywords.filter(k => !kwWithAlerts.has(k.name)).length;
        const empty = inRange.length === 0 && `No data leak alert in the ${periodLabel}.`;

        return (
            <>
                <div className="wt-kpi-strip wt-kpi-strip-6">
                    <StatCard title="Alerts" value={inRange.length} sub={periodLabel} icon="notifications" variant="primary"
                              trend={perAll} trendLabel={`Alerts ${perBucket}, ${periodLabel}`} />
                    <StatCard title="Still active" value={active.length} sub={`of the ${periodLabel}`} icon="warning" variant="danger" />
                    <StatCard title="Archived" value={archived.length} sub={`of the ${periodLabel}`} icon="archive" variant="success" />
                    <StatCard title="Active overall" value={statistics.activeAlerts ?? 0} sub="all periods" icon="report" variant="warning" />
                    <StatCard title="Leak sources" value={new Set(inRange.map(a => hostOf(a.url)).filter(Boolean)).size} sub="distinct sites" icon="language" variant="info" />
                    <StatCard title="Quiet patterns" value={quietPatterns} sub={`of ${keywords.length} with no alert`} icon="remove_circle_outline" variant="secondary" />
                </div>

                <Section title="Alert activity" icon="notifications">
                    <div className="wt-stats-grid wt-stats-grid-2-1">
                        <ChartCard title={`Alerts ${perBucket}`} icon="bar_chart" total={`${inRange.length} in the ${periodLabel}`} empty={empty}
                                   hint="Data leak alerts detected over the period, split by their current status.">
                            <Bar
                                data={{
                                    labels: buckets.labels,
                                    datasets: [
                                        { label: 'Active', data: perActive, backgroundColor: C.danger.faded, hoverBackgroundColor: C.danger.hover, borderWidth: 0 },
                                        { label: 'Archived', data: perArchived, backgroundColor: C.success.faded, hoverBackgroundColor: C.success.hover, borderWidth: 0 },
                                    ],
                                }}
                                options={barOptions({ stacked: true, titles: buckets.titles, legend: true })}
                            />
                        </ChartCard>
                        <ChartCard title="Status" icon="donut_large" empty={empty}>
                            <Doughnut data={doughnutData(['Active', 'Archived'], [active.length, archived.length], [C.danger, C.success])} options={doughnutOptions} />
                        </ChartCard>
                    </div>
                </Section>

                <Section title="Where leaks are found" icon="public">
                    <div className="wt-stats-grid wt-stats-grid-2">
                        <ChartCard title="Top search patterns" icon="search" empty={empty} hint="Keywords that triggered the most alerts over the period."
                                   clickHint="Click a pattern to list its alerts">
                            <HorizontalBar data={singleBar(kw.map(([k]) => k), kw.map(([, v]) => v), 'Alerts')}
                                           options={clickable(hbarOptions, i => this.filterBy({ keyword: kw[i][0] }))} />
                        </ChartCard>
                        <ChartCard title="Top leak sources" icon="language" empty={empty} hint="Sites (paste sites, code hosting...) where the leaks were found."
                                   clickHint="Click a site to list its alerts">
                            <HorizontalBar data={singleBar(hosts.map(([k]) => k), hosts.map(([, v]) => v), 'Alerts', C.info)}
                                           options={clickable(hbarOptions, i => this.filterBy({ source: hosts[i][0] }))} />
                        </ChartCard>
                    </div>
                </Section>
            </>
        );
    };

    render() {
        return <StatsShell tabs={DATA_LEAK_TABS} prefKey="dataleak_stats_period">{this.renderBody}</StatsShell>;
    }
}

export default connect(mapStateToProps, actions)(DataLeakStatisticsPage);
