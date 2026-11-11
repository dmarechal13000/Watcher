import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { getMonitoredKeywords, getSources, getBannedWords } from '../../actions/leads';
import { getWatchRules, getWatchRuleHits } from '../../actions/CyberWatch';
import StatCard from '../common/StatCard';
import KpiStrip from '../common/KpiStrip';
import { Bar, HorizontalBar, Doughnut } from '../common/ThemedCharts';
import { CHART_COLORS as C } from '../common/chartTheme';
import { ChartCard, Section, StatsShell, GREY, SEVERITY_HIGH, PURPLE, barOptions, hbarOptions, doughnutOptions, singleBar, doughnutData, moduleTabs } from '../common/StatsKit';
import { countByBucket, inPeriod, topCounts } from '../common/statsUtils';

// Cyber Watch "Statistics" tab + the compact KPI row of its Surveillance tab.
// No statistics endpoint here: everything is derived from the lists the module already loads.

export const CYBER_WATCH_TABS = moduleTabs('/cyber_watch');

const HIT_TYPES = [
    { key: 'cve',               label: 'CVE',               color: C.info },
    { key: 'ransomware_victim', label: 'Ransomware victim', color: C.primary },
];
const LEVELS = [
    { key: 'warm',      label: 'Warm',      color: C.warning },
    { key: 'hot',       label: 'Hot',       color: SEVERITY_HIGH },
    { key: 'super_hot', label: 'Super hot', color: C.danger },
];
// RSS source health from the last fetch's HTTP status
const HEALTH = [
    { label: 'OK (200)',          test: c => c === 200,                       color: C.success },
    { label: 'Forbidden (403)',   test: c => c === 403,                       color: C.warning },
    { label: 'Not found (404)',   test: c => c === 404,                       color: SEVERITY_HIGH },
    { label: 'Unreachable',       test: c => c === 0,                         color: C.danger },
    { label: 'Other error',       test: c => c && c !== 200 && c !== 403 && c !== 404, color: PURPLE },
    { label: 'Not checked yet',   test: c => c === null || c === undefined,   color: GREY },
];
const CONFIDENCE = { 1: 'High (100%)', 2: 'Medium (50%)', 3: 'Low (20%)' };

const mapStateToProps = state => ({
    monitoredKeywords: state.leads.monitoredKeywords || [],
    sources:           state.leads.sources || [],
    bannedWords:       state.leads.bannedWords || [],
    watchRules:        state.CyberWatch.watchRules || [],
    watchRuleHits:     state.CyberWatch.watchRuleHits || [],
});
const actions = { getMonitoredKeywords, getSources, getBannedWords, getWatchRules, getWatchRuleHits };

const WEEK_MS = 7 * 24 * 3600 * 1000;

class CyberKpisBase extends Component {
    static propTypes = {
        sources: PropTypes.array.isRequired,
        watchRules: PropTypes.array.isRequired,
        watchRuleHits: PropTypes.array.isRequired,
        monitoredKeywords: PropTypes.array.isRequired,
    };

    render() {
        const { sources, watchRules, watchRuleHits, monitoredKeywords } = this.props;
        const failing = sources.filter(s => s.last_status_code !== null && s.last_status_code !== undefined && s.last_status_code !== 200).length;
        const hitsWeek = watchRuleHits.filter(h => h.hit_at && Date.now() - new Date(h.hit_at).getTime() <= WEEK_MS).length;
        return (
            <KpiStrip statsTo="/cyber_watch/statistics" cards={[
                { title: 'Rule hits', value: hitsWeek, sub: `in the last 7 days, ${watchRuleHits.length} total`, icon: 'notifications_active', variant: 'primary' },
                { title: 'Active rules', value: watchRules.filter(r => r.is_active).length, sub: `of ${watchRules.length} watch rules`, icon: 'playlist_add_check', variant: 'success' },
                { title: 'Monitored keywords', value: monitoredKeywords.length, sub: `${monitoredKeywords.filter(k => k.level === 'super_hot').length} super hot`, icon: 'track_changes', variant: 'warning' },
                { title: 'Failing sources', value: failing, sub: `of ${sources.length} RSS feeds`, icon: 'rss_feed', variant: failing ? 'danger' : 'info' },
            ]} />
        );
    }
}

export const CyberSurveillanceKpis = connect(mapStateToProps)(CyberKpisBase);

export class CyberStatisticsPage extends Component {
    static propTypes = {
        monitoredKeywords: PropTypes.array.isRequired,
        sources: PropTypes.array.isRequired,
        bannedWords: PropTypes.array.isRequired,
        watchRules: PropTypes.array.isRequired,
        watchRuleHits: PropTypes.array.isRequired,
        getMonitoredKeywords: PropTypes.func.isRequired,
        getSources: PropTypes.func.isRequired,
        getBannedWords: PropTypes.func.isRequired,
        getWatchRules: PropTypes.func.isRequired,
        getWatchRuleHits: PropTypes.func.isRequired,
    };

    componentDidMount() {
        const p = this.props;
        p.getMonitoredKeywords();
        p.getSources();
        p.getBannedWords();
        p.getWatchRules();
        p.getWatchRuleHits({ page_size: 10000 });
    }

    renderBody = ({ buckets, periodLabel, perBucket }) => {
        const { monitoredKeywords, sources, bannedWords, watchRules, watchRuleHits } = this.props;
        const hits = watchRuleHits.filter(h => inPeriod(h.hit_at, buckets.since));
        const series = HIT_TYPES.map(t => ({
            ...t,
            data: countByBucket(hits, h => h.hit_at, buckets, h => h.hit_type === t.key),
            total: hits.filter(h => h.hit_type === t.key).length,
        }));
        const perAll = countByBucket(hits, h => h.hit_at, buckets);
        const topRules = topCounts(hits, h => h.rule_name, 8);
        const topKeywords = topCounts(hits, h => h.matched_keyword, 8);
        const health = HEALTH.map(hh => sources.filter(s => hh.test(s.last_status_code)).length);
        const failing = health.slice(1, 5).reduce((s, v) => s + v, 0);
        const confidence = [1, 2, 3].map(c => sources.filter(s => Number(s.confident) === c).length);
        const levels = LEVELS.map(l => monitoredKeywords.filter(k => k.level === l.key).length);
        const seenInPeriod = monitoredKeywords.filter(k => inPeriod(k.last_seen, buckets.since)).length;
        const countries = topCounts(sources, s => s.country, 8);
        const emptyHits = hits.length === 0 && `No watch rule hit in the ${periodLabel}.`;
        const emptySources = sources.length === 0 && 'No RSS source yet. Run populate_db to load the default ones.';

        return (
            <>
                <div className="wt-kpi-strip wt-kpi-strip-6">
                    <StatCard title="Rule hits" value={hits.length} sub={periodLabel} icon="notifications_active" variant="primary"
                              trend={perAll} trendLabel={`Watch rule hits ${perBucket}, ${periodLabel}`} />
                    <StatCard title="Active rules" value={watchRules.filter(r => r.is_active).length} sub={`of ${watchRules.length} watch rules`} icon="playlist_add_check" variant="success" />
                    <StatCard title="Keywords seen" value={seenInPeriod} sub={`of ${monitoredKeywords.length} monitored`} icon="track_changes" variant="warning" />
                    <StatCard title="RSS sources" value={sources.length} sub={`${health[0]} answering`} icon="rss_feed" variant="info" />
                    <StatCard title="Failing sources" value={failing} sub="403, 404 or unreachable" icon="report" variant={failing ? 'danger' : 'secondary'} />
                    <StatCard title="Banned words" value={bannedWords.length} sub="excluded from detection" icon="block" variant="secondary" />
                </div>

                <Section title="Watch rules" icon="playlist_add_check">
                    <div className="wt-stats-grid wt-stats-grid-2-1">
                        <ChartCard title={`Rule hits ${perBucket}, by type`} icon="bar_chart" total={`${hits.length} in the ${periodLabel}`} empty={emptyHits}
                                   hint="Matches of your watch rules on new CVEs and ransomware victims.">
                            <Bar
                                data={{
                                    labels: buckets.labels,
                                    datasets: series.map(s => ({ label: s.label, data: s.data, backgroundColor: s.color.faded, hoverBackgroundColor: s.color.hover, borderWidth: 0 })),
                                }}
                                options={barOptions({ stacked: true, titles: buckets.titles, legend: true })}
                            />
                        </ChartCard>
                        <ChartCard title="Hits by type" icon="donut_large" empty={emptyHits}>
                            <Doughnut data={doughnutData(series.map(s => s.label), series.map(s => s.total), series.map(s => s.color))} options={doughnutOptions} />
                        </ChartCard>
                    </div>
                    <div className="wt-stats-grid wt-stats-grid-2">
                        <ChartCard title="Most matching rules" icon="playlist_add_check" height={240} empty={emptyHits}>
                            <HorizontalBar data={singleBar(topRules.map(([k]) => k), topRules.map(([, v]) => v), 'Hits')} options={hbarOptions} />
                        </ChartCard>
                        <ChartCard title="Most matched keywords" icon="vpn_key" height={240} empty={emptyHits}>
                            <HorizontalBar data={singleBar(topKeywords.map(([k]) => k), topKeywords.map(([, v]) => v), 'Hits', C.info)} options={hbarOptions} />
                        </ChartCard>
                    </div>
                </Section>

                <Section title="RSS feeds & keywords" icon="rss_feed">
                    <div className="wt-stats-grid wt-stats-grid-2-1">
                        <ChartCard title="Feed health" icon="network_check" empty={emptySources}
                                   hint="Result of the last fetch of each RSS source. Failing feeds stop contributing trending words.">
                            <HorizontalBar
                                data={{
                                    labels: HEALTH.map(h => h.label),
                                    datasets: [{ label: 'Sources', data: health, backgroundColor: HEALTH.map(h => h.color.faded), hoverBackgroundColor: HEALTH.map(h => h.color.hover), borderWidth: 0 }],
                                }}
                                options={hbarOptions}
                            />
                        </ChartCard>
                        <ChartCard title="Source confidence" icon="verified_user" empty={emptySources}
                                   hint="Confidence level assigned to each RSS source; it weights the reliability score of trending words.">
                            <Doughnut data={doughnutData([1, 2, 3].map(c => CONFIDENCE[c]), confidence, [C.success, C.warning, C.danger])} options={doughnutOptions} />
                        </ChartCard>
                    </div>
                    <div className="wt-stats-grid wt-stats-grid-2">
                        <ChartCard title="Monitored keywords by level" icon="whatshot" height={240}
                                   empty={monitoredKeywords.length === 0 && 'No monitored keyword yet.'}
                                   hint="Levels are computed from occurrences: warm (1+), hot (3+), super hot (10+).">
                            <Bar
                                data={{
                                    labels: LEVELS.map(l => l.label),
                                    datasets: [{ label: 'Keywords', data: levels, backgroundColor: LEVELS.map(l => l.color.faded), hoverBackgroundColor: LEVELS.map(l => l.color.hover), borderWidth: 0 }],
                                }}
                                options={barOptions()}
                            />
                        </ChartCard>
                        <ChartCard title="Sources by country" icon="public" height={240} empty={emptySources}>
                            <HorizontalBar data={singleBar(countries.map(([k]) => k), countries.map(([, v]) => v), 'Sources', C.info)} options={hbarOptions} />
                        </ChartCard>
                    </div>
                </Section>
            </>
        );
    };

    render() {
        return <StatsShell tabs={CYBER_WATCH_TABS} prefKey="cyberwatch_stats_period">{this.renderBody}</StatsShell>;
    }
}

export default connect(mapStateToProps, actions)(CyberStatisticsPage);
