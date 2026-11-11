import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { getDnsFinderStatistics, getAllThreatsMonitored, getAllDnsMonitored, getAllKeywordMonitored } from '../../actions/DnsFinder';
import StatCard from '../common/StatCard';
import KpiStrip from '../common/KpiStrip';
import { Bar, HorizontalBar, Doughnut } from '../common/ThemedCharts';
import { CHART_COLORS as C } from '../common/chartTheme';
import { ChartCard, Section, StatsShell, clickable, GREY, PURPLE, barOptions, hbarOptions, doughnutOptions, singleBar, doughnutData, moduleTabs } from '../common/StatsKit';
import { countByBucket, inPeriod, topCounts } from '../common/statsUtils';
import { requestFilters } from '../common/pendingFilters';

// DNS Threats Monitored "Statistics" tab + the compact KPI row of its Surveillance tab.

export const DNS_FINDER_TABS = moduleTabs('/dns_finder');

const SOURCES = [
    { key: 'dnstwist',           label: 'Dnstwist permutations',    color: C.primary },
    { key: 'certstream_keyword', label: 'Certificate Transparency', color: C.info },
    { key: 'subdomain_takeover', label: 'Subdomain takeover',       color: PURPLE },
];
const STATUSES = [
    { key: 'pending',        label: 'Pending',        color: GREY },
    { key: 'suspected',      label: 'Suspected',      color: C.warning },
    { key: 'confirmed',      label: 'Confirmed',      color: C.danger },
    { key: 'resolved',       label: 'Resolved',       color: C.success },
    { key: 'false_positive', label: 'False positive', color: PURPLE },
];
const OPEN = new Set(['pending', 'suspected', 'confirmed']);
const tldOf = name => {
    const parts = String(name || '').split('.');
    return parts.length >= 2 ? `.${parts[parts.length - 1]}` : null;
};

const mapStateToProps = state => ({
    statistics:       state.DnsFinder.statistics || {},
    threatsMonitored: state.DnsFinder.allThreatsMonitored || [],
    dnsMonitored:     state.DnsFinder.allDnsMonitored || [],
    keywordMonitored: state.DnsFinder.allKeywordMonitored || [],
});
const actions = { getDnsFinderStatistics, getAllThreatsMonitored, getAllDnsMonitored, getAllKeywordMonitored };

class DnsKpisBase extends Component {
    static propTypes = { statistics: PropTypes.object.isRequired, getDnsFinderStatistics: PropTypes.func.isRequired };

    componentDidMount() { this.props.getDnsFinderStatistics(); }

    render() {
        const s = this.props.statistics;
        return (
            <KpiStrip statsTo="/dns_finder/statistics" cards={[
                { title: 'Suspicious domains', value: s.totalAlerts ?? 0, sub: `${s.newThisWeek ?? 0} this week`, icon: 'dns', variant: 'primary' },
                { title: 'New today', value: s.newToday ?? 0, sub: 'detected today', icon: 'today', variant: 'warning' },
                { title: 'Takeover risks', value: s.totalDanglingConfirmed ?? 0, sub: `${s.totalDanglingSuspected ?? 0} suspected`, icon: 'link_off', variant: 'danger' },
                { title: 'Assets watched', value: s.totalDnsMonitored ?? 0, sub: `${s.totalKeywords ?? 0} keywords`, icon: 'shield', variant: 'info' },
            ]} />
        );
    }
}

export const DnsSurveillanceKpis = connect(mapStateToProps, actions)(DnsKpisBase);

export class DnsStatisticsPage extends Component {
    static propTypes = {
        statistics: PropTypes.object.isRequired,
        threatsMonitored: PropTypes.array.isRequired,
        dnsMonitored: PropTypes.array.isRequired,
        keywordMonitored: PropTypes.array.isRequired,
        getDnsFinderStatistics: PropTypes.func.isRequired,
        getAllThreatsMonitored: PropTypes.func.isRequired,
        getAllDnsMonitored: PropTypes.func.isRequired,
        getAllKeywordMonitored: PropTypes.func.isRequired,
        history: PropTypes.object.isRequired,
    };

    componentDidMount() {
        const p = this.props;
        p.getDnsFinderStatistics();
        p.getAllThreatsMonitored();
        p.getAllDnsMonitored();
        p.getAllKeywordMonitored();
    }

    // Chart click: open the Surveillance tab with that filter applied
    filterBy = (filters) => {
        requestFilters('dns_finder', filters);
        this.props.history.push('/dns_finder');
    };

    renderBody = ({ buckets, periodLabel, perBucket }) => {
        const { statistics, threatsMonitored, dnsMonitored, keywordMonitored } = this.props;
        const inRange = threatsMonitored.filter(a => inPeriod(a.created_at, buckets.since));
        const real = inRange.filter(a => a.status !== 'false_positive');
        const series = SOURCES.map(src => ({
            ...src,
            data: countByBucket(real, a => a.created_at, buckets, a => a.source === src.key),
            total: real.filter(a => a.source === src.key).length,
        }));
        const perAll = countByBucket(real, a => a.created_at, buckets);
        const statusCounts = STATUSES.map(st => inRange.filter(a => (a.status || 'pending') === st.key).length);
        const fuzzers = topCounts(real.filter(a => a.source === 'dnstwist'), a => a.technical_details?.fuzzer, 8);
        const issuers = topCounts(real.filter(a => a.source === 'certstream_keyword'), a => a.technical_details?.issuer, 8);
        const tlds = topCounts(real, a => tldOf(a.dns_twisted?.domain_name), 8);
        const open = real.filter(a => OPEN.has(a.status || 'pending')).length;
        const falsePositives = inRange.length - real.length;
        const empty = real.length === 0 && `No suspicious domain in the ${periodLabel}.`;

        return (
            <>
                <div className="wt-kpi-strip wt-kpi-strip-6">
                    <StatCard title="Detections" value={real.length} sub={periodLabel} icon="dns" variant="primary"
                              trend={perAll} trendLabel={`Detections ${perBucket}, ${periodLabel}`} />
                    <StatCard title="Still open" value={open} sub="pending, suspected, confirmed" icon="hourglass_empty" variant="warning" />
                    <StatCard title="Takeover risks" value={statistics.totalDanglingConfirmed ?? 0} sub="confirmed, all periods" icon="link_off" variant="danger" />
                    <StatCard title="False positives" value={falsePositives} sub={periodLabel} icon="do_not_disturb" variant="secondary" />
                    <StatCard title="Assets watched" value={statistics.totalDnsMonitored ?? dnsMonitored.length} sub="corporate domains" icon="shield" variant="info" />
                    <StatCard title="Keywords" value={statistics.totalKeywords ?? keywordMonitored.length} sub="certificate patterns" icon="search" variant="success" />
                </div>

                <Section title="Detections" icon="track_changes">
                    <div className="wt-stats-grid wt-stats-grid-2-1">
                        <ChartCard title={`Suspicious domains ${perBucket}, by source`} icon="bar_chart" total={`${real.length} in the ${periodLabel}`}
                                   empty={empty} hint="False positives are excluded." clickHint="Click a bar to list the domains of that source">
                            <Bar
                                data={{
                                    labels: buckets.labels,
                                    datasets: series.map(s => ({ label: s.label, data: s.data, backgroundColor: s.color.faded, hoverBackgroundColor: s.color.hover, borderWidth: 0 })),
                                }}
                                options={clickable(barOptions({ stacked: true, titles: buckets.titles, legend: true }), (i, ds) => this.filterBy({ source: SOURCES[ds].key, status: '' }))}
                            />
                        </ChartCard>
                        <ChartCard title="Detection source" icon="donut_large" empty={empty} clickHint="Click a slice to list the domains of that source">
                            <Doughnut data={doughnutData(series.map(s => s.label), series.map(s => s.total), series.map(s => s.color))}
                                      options={clickable(doughnutOptions, i => this.filterBy({ source: SOURCES[i].key, status: '' }))} />
                        </ChartCard>
                    </div>
                </Section>

                <Section title="Triage & patterns" icon="assignment_turned_in">
                    <div className="wt-stats-grid wt-stats-grid-2">
                        <ChartCard title="Triage status" icon="pie_chart" height={240} empty={inRange.length === 0 && `No detection in the ${periodLabel}.`}
                                   hint="Status of the domains detected over the period, false positives included."
                                   clickHint="Click a status to list those domains">
                            <Doughnut data={doughnutData(STATUSES.map(s => s.label), statusCounts, STATUSES.map(s => s.color))}
                                      options={clickable(doughnutOptions, i => this.filterBy({ status: STATUSES[i].key }))} />
                        </ChartCard>
                        <ChartCard title="Suspicious TLDs" icon="public" height={240} empty={empty} hint="Top-level domains used by the suspicious domains."
                                   clickHint="Click a TLD to search those domains">
                            <HorizontalBar data={singleBar(tlds.map(([k]) => k), tlds.map(([, v]) => v), 'Domains')}
                                           options={clickable(hbarOptions, i => this.filterBy({ search: tlds[i][0], status: '' }))} />
                        </ChartCard>
                    </div>
                    <div className="wt-stats-grid wt-stats-grid-2">
                        <ChartCard title="Permutation techniques (dnstwist)" icon="shuffle" height={240}
                                   empty={fuzzers.length === 0 && 'No dnstwist detection in this period.'}
                                   hint="Typosquatting techniques that produced the detections: homoglyph, bitsquatting, addition...">
                            <HorizontalBar data={singleBar(fuzzers.map(([k]) => k), fuzzers.map(([, v]) => v), 'Domains', C.primary)} options={hbarOptions} />
                        </ChartCard>
                        <ChartCard title="Certificate issuers (Certificate Transparency)" icon="verified_user" height={240}
                                   empty={issuers.length === 0 && 'No certificate detection in this period.'}
                                   hint="Certificate authorities that issued the certificates of the suspicious domains.">
                            <HorizontalBar data={singleBar(issuers.map(([k]) => k), issuers.map(([, v]) => v), 'Domains', C.info)} options={hbarOptions} />
                        </ChartCard>
                    </div>
                </Section>
            </>
        );
    };

    render() {
        return <StatsShell tabs={DNS_FINDER_TABS} prefKey="dnsfinder_stats_period">{this.renderBody}</StatsShell>;
    }
}

export default connect(mapStateToProps, actions)(DnsStatisticsPage);
