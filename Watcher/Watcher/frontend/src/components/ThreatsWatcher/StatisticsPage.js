import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { getLeads, getMonitoredKeywords, getThreatsWatcherStatistics } from '../../actions/leads';
import { getCVEs, getRansomwareVictims, getWatchRuleHits } from '../../actions/CyberWatch';
import preferencesService from '../../services/preferencesService';
import ModuleTabs from '../common/ModuleTabs';
import StatCard from '../common/StatCard';
import { Bar, HorizontalBar, Doughnut } from '../common/ThemedCharts';
import { CHART_COLORS as C } from '../common/chartTheme';
import { ChartCard, Section, SEVERITY_HIGH, GREY, barOptions, hbarOptions, doughnutWith, clickable, singleBar } from '../common/StatsKit';
import { requestFilters } from '../common/pendingFilters';
import { requestDetail } from '../common/detailFocus';
import { PERIODS, buildBuckets, countByBucket, inPeriod, topCounts } from '../common/statsUtils';
import { THREATS_WATCHER_TABS } from './tabs';

// Threats Watcher "Statistics" tab: trending words, vulnerabilities and ransomware activity
// over a selectable period. Uses the same store data as the Surveillance tab panels.

const PERIOD_PREF = 'tw_stats_period';
const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const SEVERITY_COLORS = { CRITICAL: C.danger, HIGH: SEVERITY_HIGH, MEDIUM: C.warning, LOW: C.info };
const CVSS_RANGES = [
    { label: '0 - 3.9', min: 0, max: 3.95, color: C.info },
    { label: '4 - 6.9', min: 4, max: 6.95, color: C.warning },
    { label: '7 - 8.9', min: 7, max: 8.95, color: SEVERITY_HIGH },
    { label: '9 - 10',  min: 9, max: 10,   color: C.danger },
];

const reliability = score => {
    if (score === null || score === undefined || isNaN(score)) return 'none';
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
};

export class StatisticsPage extends Component {
    static propTypes = {
        leads: PropTypes.array.isRequired,
        monitoredKeywords: PropTypes.array.isRequired,
        statistics: PropTypes.object.isRequired,
        cves: PropTypes.array.isRequired,
        ransomwareVictims: PropTypes.array.isRequired,
        watchRuleHits: PropTypes.array.isRequired,
        getLeads: PropTypes.func.isRequired,
        getMonitoredKeywords: PropTypes.func.isRequired,
        getThreatsWatcherStatistics: PropTypes.func.isRequired,
        getCVEs: PropTypes.func.isRequired,
        getRansomwareVictims: PropTypes.func.isRequired,
        getWatchRuleHits: PropTypes.func.isRequired,
        history: PropTypes.object.isRequired,
    };

    state = { days: 30 };

    componentDidMount() {
        const saved = Number(preferencesService.get(PERIOD_PREF, 30));
        if (PERIODS.some(p => p.days === saved)) this.setState({ days: saved });
        this.onPrefsReady = () => {
            const value = Number(preferencesService.get(PERIOD_PREF, this.state.days));
            if (PERIODS.some(p => p.days === value)) this.setState({ days: value });
        };
        window.addEventListener('watcher:prefs:ready', this.onPrefsReady);

        const p = this.props;
        p.getThreatsWatcherStatistics();
        if (!p.leads.length) p.getLeads();
        if (!p.monitoredKeywords.length) p.getMonitoredKeywords();
        p.getCVEs({ page_size: 10000 });
        p.getRansomwareVictims({ page_size: 10000 });
        p.getWatchRuleHits({ page_size: 10000 });
    }

    componentWillUnmount() {
        window.removeEventListener('watcher:prefs:ready', this.onPrefsReady);
    }

    // Chart clicks: open the Surveillance tab narrowed to what was clicked
    openWord = (name) => {
        requestDetail('word', name);
        this.props.history.push('/');
    };

    filterCves = (severity) => {
        requestFilters('cve', { severity });
        this.props.history.push('/');
    };

    filterVictims = (filters) => {
        requestFilters('victims', filters);
        this.props.history.push('/');
    };

    setPeriod = (days) => {
        this.setState({ days });
        preferencesService.set(PERIOD_PREF, days);
    };

    renderPeriodPicker() {
        return (
            <div className="wt-segmented" role="radiogroup" aria-label="Period">
                {PERIODS.map(p => (
                    <button
                        key={p.days}
                        type="button"
                        role="radio"
                        aria-checked={this.state.days === p.days}
                        className={this.state.days === p.days ? 'is-active' : ''}
                        onClick={() => this.setPeriod(p.days)}
                    >
                        {p.label}
                    </button>
                ))}
            </div>
        );
    }

    render() {
        const { leads, monitoredKeywords, statistics, cves, ransomwareVictims, watchRuleHits } = this.props;
        const { days } = this.state;
        const buckets = buildBuckets(days);
        const periodLabel = `last ${days} days`;
        const perBucket = buckets.weekly ? 'per week' : 'per day';

        // ---- Trending words
        const newWords = countByBucket(leads, w => w.created_at, buckets);
        const newWordsTotal = newWords.reduce((s, v) => s + v, 0);
        const topWords = [...leads].sort((a, b) => b.occurrences - a.occurrences).slice(0, 10);
        const relCounts = { high: 0, medium: 0, low: 0, none: 0 };
        leads.forEach(w => { relCounts[reliability(w.score)]++; });
        // Banned words are excluded from detection, so they are not part of the trending words
        const monitoredNames = new Set(monitoredKeywords.map(k => String(k.name).toLowerCase()));
        const monitored = leads.filter(w => monitoredNames.has(String(w.name).toLowerCase())).length;
        const unclassified = Math.max(0, leads.length - monitored);
        const banned = statistics.bannedWords ?? 0;

        // ---- Vulnerabilities
        const cvesInPeriod = cves.filter(c => inPeriod(c.published || c.fetched_at, buckets.since));
        const cveSeries = SEVERITIES.map(sev => ({
            label: sev.charAt(0) + sev.slice(1).toLowerCase(),
            data: countByBucket(cvesInPeriod, c => c.published || c.fetched_at, buckets, c => String(c.severity || '').toUpperCase() === sev),
            color: SEVERITY_COLORS[sev],
        }));
        const cvePerBucket = countByBucket(cvesInPeriod, c => c.published || c.fetched_at, buckets);
        const severityCounts = SEVERITIES.map(sev => cvesInPeriod.filter(c => String(c.severity || '').toUpperCase() === sev).length);
        const criticalInPeriod = severityCounts[0];
        const cvssCounts = CVSS_RANGES.map(r => cvesInPeriod.filter(c => c.cvss_score != null && c.cvss_score >= r.min && c.cvss_score <= r.max).length);
        const hitsInPeriod = watchRuleHits.filter(h => inPeriod(h.hit_at, buckets.since));
        const cveHits = hitsInPeriod.filter(h => h.hit_type === 'cve');
        const cveKeywords = topCounts(cveHits, h => h.matched_keyword, 8);

        // ---- Ransomware
        const victimsInPeriod = ransomwareVictims.filter(v => inPeriod(v.attacked_at, buckets.since));
        const victimsPerBucket = countByBucket(victimsInPeriod, v => v.attacked_at, buckets);
        const topGroups = topCounts(victimsInPeriod, v => v.group_name || v.group, 8);
        const topCountries = topCounts(victimsInPeriod, v => (v.country && v.country !== '-' ? v.country : null), 8);
        const sectors = topCounts(victimsInPeriod, v => (v.sector && v.sector !== 'Not Found' ? v.sector : 'Unknown'), 6, true);
        const SECTOR_COLORS = [C.primary, C.info, C.success, C.warning, C.danger, SEVERITY_HIGH, GREY];

        return (
            <div className="wt-stats-page">
                <ModuleTabs tabs={THREATS_WATCHER_TABS} extra={this.renderPeriodPicker()} />

                <div className="wt-kpi-strip wt-kpi-strip-6">
                    <StatCard title="New words" value={newWordsTotal} sub={periodLabel} icon="add_circle_outline" variant="primary"
                              trend={newWords} trendLabel={`New words ${perBucket}, ${periodLabel}`} />
                    <StatCard title="Trending words" value={statistics.totalWords || leads.length} sub={`${statistics.totalSources ?? 0} RSS sources`} icon="list_alt" variant="info" />
                    <StatCard title="CVEs published" value={cvesInPeriod.length} sub={periodLabel} icon="security" variant="primary"
                              trend={cvePerBucket} trendLabel={`CVEs ${perBucket}, ${periodLabel}`} />
                    <StatCard title="Critical CVEs" value={criticalInPeriod} sub={periodLabel} icon="report" variant="danger" />
                    <StatCard title="Ransomware victims" value={victimsInPeriod.length} sub={periodLabel} icon="lock" variant="warning"
                              trend={victimsPerBucket} trendLabel={`Victims ${perBucket}, ${periodLabel}`} />
                    <StatCard title="Watch rule hits" value={hitsInPeriod.length} sub={periodLabel} icon="notifications_active" variant="success" />
                </div>

                <Section title="Trending words" icon="track_changes">
                    <div className="wt-stats-grid wt-stats-grid-2-1">
                        <ChartCard title={`New trending words ${perBucket}`} icon="bar_chart" total={`${newWordsTotal} in the ${periodLabel}`}
                                   hint="Words detected for the first time in RSS feeds. Older words are cleaned up daily, so long periods mostly reflect recent activity."
                                   empty={newWordsTotal === 0 && `No new words in the ${periodLabel}.`}>
                            <Bar data={singleBar(buckets.labels, newWords, 'New words')} options={barOptions({ titles: buckets.titles })} />
                        </ChartCard>
                        <ChartCard title="Top 10 words" icon="format_list_numbered" hint="Current trending words by number of occurrences."
                                   clickHint="Click a word to open it on the Surveillance tab"
                                   empty={topWords.length === 0 && 'No trending words yet.'}>
                            <HorizontalBar data={singleBar(topWords.map(w => w.name), topWords.map(w => w.occurrences), 'Occurrences')}
                                           options={clickable(hbarOptions, i => this.openWord(topWords[i].name))} />
                        </ChartCard>
                    </div>
                    <div className="wt-stats-grid wt-stats-grid-2">
                        <ChartCard title="Reliability of trending words" icon="verified_user" height={220}
                                   hint="Share of words by source reliability score: high (70% and above), medium (40 to 69%), low (below 40%)."
                                   empty={leads.length === 0 && 'No trending words yet.'}>
                            <Doughnut
                                data={{
                                    labels: ['High', 'Medium', 'Low', 'Not scored'],
                                    datasets: [{
                                        data: [relCounts.high, relCounts.medium, relCounts.low, relCounts.none],
                                        backgroundColor: [C.success.faded, C.warning.faded, C.danger.faded, GREY.faded],
                                        hoverBackgroundColor: [C.success.hover, C.warning.hover, C.danger.hover, GREY.hover],
                                    }],
                                }}
                                options={doughnutWith('words')}
                            />
                        </ChartCard>
                        <ChartCard title="Word classification" icon="category" height={220}
                                   hint="Trending words that match one of your monitored keywords, versus words not classified yet. Banned words are excluded from detection."
                                   total={`${banned.toLocaleString()} banned words excluded`}
                                   empty={leads.length === 0 && 'No trending words yet.'}>
                            <Doughnut
                                data={{
                                    labels: ['Monitored keywords', 'Unclassified'],
                                    datasets: [{
                                        data: [monitored, unclassified],
                                        backgroundColor: [C.success.faded, C.primary.faded],
                                        hoverBackgroundColor: [C.success.hover, C.primary.hover],
                                    }],
                                }}
                                options={doughnutWith('words')}
                            />
                        </ChartCard>
                    </div>
                </Section>

                <Section title="Vulnerabilities" icon="bug_report">
                    <div className="wt-stats-grid wt-stats-grid-2-1">
                        <ChartCard title={`CVEs published ${perBucket}, by severity`} icon="bar_chart" total={`${cvesInPeriod.length} in the ${periodLabel}`}
                                   clickHint="Click a bar to list the CVEs of that severity"
                                   empty={cvesInPeriod.length === 0 && `No CVE published in the ${periodLabel}.`}>
                            <Bar
                                data={{
                                    labels: buckets.labels,
                                    datasets: cveSeries.map(s => ({
                                        label: s.label, data: s.data,
                                        backgroundColor: s.color.faded, hoverBackgroundColor: s.color.hover, borderWidth: 0,
                                    })),
                                }}
                                options={clickable(barOptions({ stacked: true, titles: buckets.titles, legend: true }), (i, ds) => this.filterCves(SEVERITIES[ds]))}
                            />
                        </ChartCard>
                        <ChartCard title="Severity" icon="donut_large" empty={cvesInPeriod.length === 0 && 'No CVE in this period.'}
                                   clickHint="Click a slice to list the CVEs of that severity">
                            <Doughnut
                                data={{
                                    labels: cveSeries.map(s => s.label),
                                    datasets: [{
                                        data: severityCounts,
                                        backgroundColor: cveSeries.map(s => s.color.faded),
                                        hoverBackgroundColor: cveSeries.map(s => s.color.hover),
                                    }],
                                }}
                                options={clickable(doughnutWith('CVEs'), i => this.filterCves(SEVERITIES[i]))}
                            />
                        </ChartCard>
                    </div>
                    <div className="wt-stats-grid wt-stats-grid-2">
                        <ChartCard title="CVSS score ranges" icon="speed" height={220} empty={cvssCounts.every(v => v === 0) && 'No scored CVE in this period.'}>
                            <Bar
                                data={{
                                    labels: CVSS_RANGES.map(r => r.label),
                                    datasets: [{
                                        label: 'CVEs', data: cvssCounts,
                                        backgroundColor: CVSS_RANGES.map(r => r.color.faded),
                                        hoverBackgroundColor: CVSS_RANGES.map(r => r.color.hover), borderWidth: 0,
                                    }],
                                }}
                                options={barOptions()}
                            />
                        </ChartCard>
                        <ChartCard title="Watch rule keywords matching CVEs" icon="visibility" height={220}
                                   empty={cveKeywords.length === 0 && 'No watch rule hit on CVEs in this period.'}>
                            <HorizontalBar data={singleBar(cveKeywords.map(([k]) => k), cveKeywords.map(([, v]) => v), 'Hits')} options={hbarOptions} />
                        </ChartCard>
                    </div>
                </Section>

                <Section title="Ransomware" icon="lock">
                    <div className="wt-stats-grid wt-stats-grid-2-1">
                        <ChartCard title={`Victims ${perBucket}`} icon="bar_chart" total={`${victimsInPeriod.length} in the ${periodLabel}`}
                                   empty={victimsInPeriod.length === 0 && `No victim reported in the ${periodLabel}.`}>
                            <Bar data={singleBar(buckets.labels, victimsPerBucket, 'Victims', C.danger)} options={barOptions({ titles: buckets.titles })} />
                        </ChartCard>
                        <ChartCard title="Sectors" icon="pie_chart" empty={victimsInPeriod.length === 0 && 'No victim in this period.'}
                                   clickHint="Click a sector to list its victims">
                            <Doughnut
                                data={{
                                    labels: sectors.map(([k]) => k),
                                    datasets: [{
                                        data: sectors.map(([, v]) => v),
                                        backgroundColor: sectors.map((_, i) => SECTOR_COLORS[i % SECTOR_COLORS.length].faded),
                                        hoverBackgroundColor: sectors.map((_, i) => SECTOR_COLORS[i % SECTOR_COLORS.length].hover),
                                    }],
                                }}
                                options={clickable(doughnutWith('victims'), i => {
                                    const sector = sectors[i][0];
                                    if (sector !== 'Other' && sector !== 'Unknown') this.filterVictims({ sector });
                                })}
                            />
                        </ChartCard>
                    </div>
                    <div className="wt-stats-grid wt-stats-grid-2">
                        <ChartCard title="Most active groups" icon="people" empty={topGroups.length === 0 && 'No victim in this period.'}
                                   clickHint="Click a group to list its victims">
                            <HorizontalBar data={singleBar(topGroups.map(([k]) => k), topGroups.map(([, v]) => v), 'Victims', C.danger)}
                                           options={clickable(hbarOptions, i => this.filterVictims({ search: topGroups[i][0] }))} />
                        </ChartCard>
                        <ChartCard title="Most targeted countries" icon="public" empty={topCountries.length === 0 && 'No victim in this period.'}
                                   clickHint="Click a country to list its victims">
                            <HorizontalBar data={singleBar(topCountries.map(([k]) => k), topCountries.map(([, v]) => v), 'Victims', C.info)}
                                           options={clickable(hbarOptions, i => this.filterVictims({ country: topCountries[i][0] }))} />
                        </ChartCard>
                    </div>
                </Section>
            </div>
        );
    }
}

const mapStateToProps = state => ({
    leads: state.leads.leads || [],
    monitoredKeywords: state.leads.monitoredKeywords || [],
    statistics: state.leads.statistics || {},
    cves: state.CyberWatch.cves || [],
    ransomwareVictims: state.CyberWatch.ransomwareVictims || [],
    watchRuleHits: state.CyberWatch.watchRuleHits || [],
});

export default connect(mapStateToProps, {
    getLeads, getMonitoredKeywords, getThreatsWatcherStatistics, getCVEs, getRansomwareVictims, getWatchRuleHits,
})(StatisticsPage);
