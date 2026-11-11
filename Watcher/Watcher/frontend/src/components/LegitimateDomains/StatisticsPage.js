import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import moment from 'moment';
import { getLegitimateDomainStatistics, getAllLegitimateDomains } from '../../actions/LegitimateDomain';
import StatCard from '../common/StatCard';
import KpiStrip from '../common/KpiStrip';
import { Bar, HorizontalBar, Doughnut } from '../common/ThemedCharts';
import { CHART_COLORS as C } from '../common/chartTheme';
import { ChartCard, Section, StatsShell, GREY, SEVERITY_HIGH, barOptions, hbarOptions, doughnutOptions, singleBar, doughnutData, moduleTabs } from '../common/StatsKit';
import { countByBucket, inPeriod, topCounts } from '../common/statsUtils';

// Legitimate Domains "Statistics" tab + the compact KPI row of its Surveillance tab.
// The period applies to domains added to Watcher; renewals look ahead over the next 12 months.

export const LEGITIMATE_DOMAINS_TABS = moduleTabs('/legitimate_domains');

const daysUntil = date => (date ? moment(date).startOf('day').diff(moment().startOf('day'), 'days') : null);
const tldOf = name => {
    const parts = String(name || '').split('.');
    return parts.length >= 2 ? `.${parts[parts.length - 1]}` : null;
};
const EXPIRY_STATES = [
    { label: 'Expired',      test: d => d !== null && d < 0,              color: C.danger },
    { label: 'Within 30 days', test: d => d !== null && d >= 0 && d <= 30, color: SEVERITY_HIGH },
    { label: '31-90 days',   test: d => d !== null && d > 30 && d <= 90,  color: C.warning },
    { label: 'More than 90 days', test: d => d !== null && d > 90,        color: C.success },
    { label: 'Unknown',      test: d => d === null,                       color: GREY },
];

const mapStateToProps = state => ({
    statistics: state.LegitimateDomain.statistics || {},
    domains:    state.LegitimateDomain.allDomains || [],
});
const actions = { getLegitimateDomainStatistics, getAllLegitimateDomains };

class LegitKpisBase extends Component {
    static propTypes = { statistics: PropTypes.object.isRequired, getLegitimateDomainStatistics: PropTypes.func.isRequired };

    componentDidMount() { this.props.getLegitimateDomainStatistics(); }

    render() {
        const s = this.props.statistics;
        return (
            <KpiStrip statsTo="/legitimate_domains/statistics" cards={[
                { title: 'TOTAL DOMAINS', value: s.total ?? 0, sub: 'all tracked domains', icon: 'link', variant: 'primary' },
                { title: 'REPURCHASED', value: s.repurchased ?? 0, sub: 'successfully reclaimed', icon: 'check_circle', variant: 'success' },
                { title: 'EXPIRED', value: s.expired ?? 0, sub: 'past expiry, not renewed', icon: 'error', variant: 'danger' },
                { title: 'EXPIRING SOON', value: s.expiringSoon ?? 0, sub: 'within the next 30 days', icon: 'warning', variant: 'warning' },
            ]} />
        );
    }
}

export const LegitSurveillanceKpis = connect(mapStateToProps, actions)(LegitKpisBase);

export class LegitStatisticsPage extends Component {
    static propTypes = {
        statistics: PropTypes.object.isRequired,
        domains: PropTypes.array.isRequired,
        getLegitimateDomainStatistics: PropTypes.func.isRequired,
        getAllLegitimateDomains: PropTypes.func.isRequired,
    };

    componentDidMount() {
        this.props.getLegitimateDomainStatistics();
        this.props.getAllLegitimateDomains();
    }

    renderBody = ({ buckets, periodLabel, perBucket }) => {
        const { statistics, domains } = this.props;
        const added = domains.filter(d => inPeriod(d.created_at, buckets.since));
        const perAdded = countByBucket(added, d => d.created_at, buckets);
        const months = Array.from({ length: 12 }, (_, i) => moment().startOf('month').add(i, 'months'));
        const monthIndex = date => {
            if (!date) return -1;
            const m = moment(date).startOf('month');
            const i = m.diff(months[0], 'months');
            return i >= 0 && i < 12 ? i : -1;
        };
        const renewDomain = new Array(12).fill(0);
        const renewSsl = new Array(12).fill(0);
        domains.forEach(d => {
            const a = monthIndex(d.expiry); if (a >= 0) renewDomain[a]++;
            const b = monthIndex(d.ssl_expiry); if (b >= 0) renewSsl[b]++;
        });
        const domainStates = EXPIRY_STATES.map(st => domains.filter(d => st.test(daysUntil(d.expiry))).length);
        const sslStates = EXPIRY_STATES.map(st => domains.filter(d => st.test(daysUntil(d.ssl_expiry))).length);
        const tlds = topCounts(domains, d => tldOf(d.domain_name), 8);
        const sslSoon = domains.filter(d => { const x = daysUntil(d.ssl_expiry); return x !== null && x >= 0 && x <= 30; }).length;
        const emptyDomains = domains.length === 0 && 'No legitimate domain yet.';

        return (
            <>
                <div className="wt-kpi-strip wt-kpi-strip-6">
                    <StatCard title="Domains" value={statistics.total ?? domains.length} sub="registered domains" icon="verified_user" variant="primary" />
                    <StatCard title="Added" value={added.length} sub={periodLabel} icon="add_circle_outline" variant="info"
                              trend={perAdded} trendLabel={`Domains added ${perBucket}, ${periodLabel}`} />
                    <StatCard title="Expired" value={statistics.expired ?? domainStates[0]} sub="need renewal" icon="event_busy" variant="danger" />
                    <StatCard title="Expiring soon" value={statistics.expiringSoon ?? domainStates[1]} sub="within 30 days" icon="schedule" variant="warning" />
                    <StatCard title="SSL expiring" value={sslSoon} sub="within 30 days" icon="lock" variant="warning" />
                    <StatCard title="Repurchased" value={statistics.repurchased ?? domains.filter(d => d.repurchased).length} sub="recovered domains" icon="shopping_cart" variant="success" />
                </div>

                <Section title="Renewals" icon="event">
                    <div className="wt-stats-grid wt-stats-grid-2-1">
                        <ChartCard title="Expirations over the next 12 months" icon="bar_chart" empty={emptyDomains}
                                   hint="Domains and SSL certificates reaching their expiry date, by month. Independent of the selected period."
                                   total={`${renewDomain.reduce((s, v) => s + v, 0)} domains, ${renewSsl.reduce((s, v) => s + v, 0)} certificates`}>
                            <Bar
                                data={{
                                    labels: months.map(m => m.format('MMM YY')),
                                    datasets: [
                                        { label: 'Domain', data: renewDomain, backgroundColor: C.primary.faded, hoverBackgroundColor: C.primary.hover, borderWidth: 0 },
                                        { label: 'SSL certificate', data: renewSsl, backgroundColor: C.info.faded, hoverBackgroundColor: C.info.hover, borderWidth: 0 },
                                    ],
                                }}
                                options={barOptions({ legend: true, titles: months.map(m => m.format('MMMM YYYY')) })}
                            />
                        </ChartCard>
                        <ChartCard title="Domain expiry status" icon="donut_large" empty={emptyDomains}>
                            <Doughnut data={doughnutData(EXPIRY_STATES.map(s => s.label), domainStates, EXPIRY_STATES.map(s => s.color))} options={doughnutOptions} />
                        </ChartCard>
                    </div>
                </Section>

                <Section title="Portfolio" icon="verified_user">
                    <div className="wt-stats-grid wt-stats-grid-2-1">
                        <ChartCard title={`Domains added to Watcher ${perBucket}`} icon="bar_chart" total={`${added.length} in the ${periodLabel}`}
                                   empty={added.length === 0 && `No domain added in the ${periodLabel}.`}>
                            <Bar data={singleBar(buckets.labels, perAdded, 'Domains')} options={barOptions({ titles: buckets.titles })} />
                        </ChartCard>
                        <ChartCard title="SSL certificate status" icon="lock" empty={emptyDomains}>
                            <Doughnut data={doughnutData(EXPIRY_STATES.map(s => s.label), sslStates, EXPIRY_STATES.map(s => s.color))} options={doughnutOptions} />
                        </ChartCard>
                    </div>
                    <div className="wt-stats-grid wt-stats-grid-2">
                        <ChartCard title="Top-level domains" icon="public" height={240} empty={emptyDomains}>
                            <HorizontalBar data={singleBar(tlds.map(([k]) => k), tlds.map(([, v]) => v), 'Domains')} options={hbarOptions} />
                        </ChartCard>
                        <ChartCard title="Repurchased domains" icon="shopping_cart" height={240} empty={emptyDomains}
                                   hint="Domains Watcher recovered (for example after a UDRP procedure) versus domains registered directly.">
                            <Doughnut
                                data={doughnutData(['Repurchased', 'Registered directly'],
                                    [domains.filter(d => d.repurchased).length, domains.filter(d => !d.repurchased).length], [C.success, C.primary])}
                                options={doughnutOptions}
                            />
                        </ChartCard>
                    </div>
                </Section>
            </>
        );
    };

    render() {
        return <StatsShell tabs={LEGITIMATE_DOMAINS_TABS} prefKey="legit_stats_period">{this.renderBody}</StatsShell>;
    }
}

export default connect(mapStateToProps, actions)(LegitStatisticsPage);
