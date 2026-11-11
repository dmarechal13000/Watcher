import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import moment from 'moment';
import { loadOverview } from '../../actions/Overview';
import { SeverityBadge, CvssScore } from '../common/SeverityBadge';
import OnboardingChecklist from './OnboardingChecklist';

// Cross-module landing page: what happened this week, the state of each module,
// and the latest detections, vulnerabilities and trending words.

const WEEK_MS = 7 * 24 * 3600 * 1000;
const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const DNS_SOURCES = {
    dnstwist: 'Dnstwist permutation',
    certstream_keyword: 'Certificate Transparency',
    subdomain_takeover: 'Subdomain takeover',
};

const num = value => (typeof value === 'number' && isFinite(value) ? value : null);
const fmt = value => (num(value) === null ? '-' : value.toLocaleString());
const isThisWeek = date => !!date && Date.now() - new Date(date).getTime() <= WEEK_MS;
const hostOf = url => { try { return new URL(url).hostname; } catch (_) { return url || ''; } };
const fromNow = date => (date ? moment(date).fromNow() : '');

const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
};

const reliability = score => {
    if (score === null || score === undefined || isNaN(score)) return 'none';
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
};

// Small trend line (same look as StatCard's)
const Spark = ({ points }) => {
    const data = (points || []).map(Number).filter(n => isFinite(n));
    if (data.length < 2) return null;
    const w = 120, h = 34, pad = 3;
    const max = Math.max(...data, 1);
    const x = i => pad + (i * (w - pad * 2)) / (data.length - 1);
    const y = v => h - pad - (v * (h - pad * 2)) / max;
    const line = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    return (
        <svg className="wt-stat-spark" viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img"
             aria-label={`New words per day, last 7 days: ${data.join(', ')}`}>
            <polygon className="wt-stat-spark-area" points={`${x(0)},${h - pad} ${line} ${x(data.length - 1)},${h - pad}`} />
            <polyline className="wt-stat-spark-line" points={line} />
            <circle className="wt-stat-spark-dot" cx={x(data.length - 1)} cy={y(data[data.length - 1])} r="3" />
        </svg>
    );
};

const Skeleton = ({ lines = 3 }) => (
    <div className="wt-ov-skeleton" aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
            <span key={i} className="wt-skeleton" style={{ width: `${[70, 45, 85, 55][i % 4]}%` }} />
        ))}
    </div>
);

const Empty = ({ icon, text }) => (
    <div className="wt-ov-empty">
        <i className="material-icons" aria-hidden="true">{icon}</i>
        <span>{text}</span>
    </div>
);

const ModuleCard = ({ to, icon, name, value, valueLabel, delta, items, children, loading, alert }) => (
    <Link to={to} className={`card wt-ov-card ${alert ? 'wt-ov-card-alert' : ''}`}>
        <div className="card-body">
            <div className="wt-ov-card-head">
                <span className="wt-icon-chip wt-icon-chip-lg"><i className="material-icons">{icon}</i></span>
                <span className="wt-ov-card-name">{name}</span>
                <i className="material-icons wt-ov-card-go" aria-hidden="true">arrow_forward</i>
            </div>
            {loading ? <Skeleton /> : (
                <>
                    <div className="wt-ov-card-main">
                        <div>
                            <div className="wt-ov-card-value">{fmt(value)}</div>
                            <div className="wt-ov-card-label">{valueLabel}</div>
                        </div>
                        {num(delta) !== null && delta > 0 && (
                            <span className="wt-ov-delta" title="New in the last 7 days">
                                <i className="material-icons" aria-hidden="true">call_made</i>
                                {fmt(delta)} this week
                            </span>
                        )}
                    </div>
                    {children}
                    <dl className="wt-ov-card-items">
                        {items.map(item => (
                            <div key={item.label} className={item.status && num(item.value) > 0 ? `wt-ov-item-${item.status}` : ''}>
                                <dt>{item.label}</dt>
                                <dd>{fmt(item.value)}</dd>
                            </div>
                        ))}
                    </dl>
                </>
            )}
        </div>
    </Link>
);

// CVE severity distribution as a segmented meter + labelled counts
const SeverityMix = ({ counts }) => {
    const total = SEVERITIES.reduce((s, k) => s + counts[k], 0);
    if (!total) return null;
    return (
        <div className="wt-ov-sevmix">
            <div className="wt-ov-sevbar" role="img"
                 aria-label={SEVERITIES.map(k => `${k.toLowerCase()} ${counts[k]}`).join(', ')}>
                {SEVERITIES.filter(k => counts[k] > 0).map(k => (
                    <span key={k} className={`wt-sev-${k.toLowerCase()}`} style={{ flexGrow: counts[k] }} />
                ))}
            </div>
            <div className="wt-ov-sevlegend">
                {SEVERITIES.map(k => (
                    <span key={k} className={`wt-sev-${k.toLowerCase()}`}>
                        <i aria-hidden="true" />{k.charAt(0) + k.slice(1).toLowerCase()} <b>{counts[k]}</b>
                    </span>
                ))}
            </div>
        </div>
    );
};

export class Overview extends Component {
    static propTypes = {
        loadOverview: PropTypes.func.isRequired,
        user: PropTypes.object,
        token: PropTypes.string,
    };

    state = { data: null, loading: true, refreshedAt: null };

    componentDidMount() {
        this.refresh();
    }

    componentWillUnmount() {
        this.unmounted = true;
    }

    refresh = () => {
        this.setState({ loading: true });
        this.props.loadOverview().then(data => {
            if (!this.unmounted) this.setState({ data, loading: false, refreshedAt: new Date() });
        });
    };

    derive() {
        const d = this.state.data || {};
        const list = v => (Array.isArray(v) ? v : []);
        const cves = list(d.cves);
        const victims = list(d.victims);

        const severity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
        cves.forEach(c => { const k = String(c.severity || '').toUpperCase(); if (k in severity) severity[k]++; });

        const cvesThisWeek = cves.filter(c => isThisWeek(c.published || c.fetched_at)).length;
        const victimsThisWeek = victims.filter(v => isThisWeek(v.attacked_at)).length;

        const breakdown = [
            { key: 'leaks',    icon: 'policy',      label: 'Data leaks',      to: '/data_leak',          value: num(d.dataLeakStats?.newThisWeek) },
            { key: 'dns',      icon: 'dns',         label: 'DNS threats',     to: '/dns_finder',         value: num(d.dnsStats?.newThisWeek) },
            { key: 'sites',    icon: 'language',    label: 'Website changes', to: '/website_monitoring', value: num(d.siteStats?.newThisWeek) },
            { key: 'cves',     icon: 'bug_report',  label: 'CVEs',            to: '/cyber_watch',        value: d.cves ? cvesThisWeek : null },
            { key: 'victims',  icon: 'lock',        label: 'Ransomware victims', to: '/',               value: d.victims ? victimsThisWeek : null },
        ];
        const weekTotal = breakdown.reduce((s, b) => s + (b.value || 0), 0);

        const feed = [
            ...list(d.dataLeakAlerts).map(a => ({
                id: `dl-${a.id}`, icon: 'policy', to: '/data_leak', date: a.created_at,
                title: a.keyword?.name ? `“${a.keyword.name}” found` : 'Data leak',
                sub: `Data Leak · ${hostOf(a.url)}`,
            })),
            ...list(d.dnsAlerts).map(a => ({
                id: `dns-${a.id}`, icon: 'dns', to: '/dns_finder', date: a.created_at,
                title: a.dns_twisted?.domain_name || 'Suspicious domain',
                sub: `DNS Threats · ${DNS_SOURCES[a.source] || 'Detection'}`,
            })),
            ...list(d.siteAlerts).map(a => ({
                id: `site-${a.id}`, icon: 'language', to: '/website_monitoring', date: a.created_at,
                title: a.site?.domain_name || 'Monitored website',
                sub: `Website Monitoring · ${a.type || 'Change detected'}`,
            })),
            ...victims.slice(0, 8).map(v => ({
                id: `rv-${v.id}`, icon: 'lock', to: '/', date: v.attacked_at,
                title: v.victim_name,
                sub: `Ransomware · ${[v.group_name, v.country].filter(Boolean).join(' · ')}`,
            })),
            ...cves.slice(0, 8).map(c => ({
                id: `cve-${c.id}`, icon: 'bug_report', to: '/cyber_watch', date: c.published || c.fetched_at,
                title: c.cve_id, sub: 'Cyber Watch · new CVE', severity: c.severity,
            })),
        ]
            .filter(item => item.date)
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 8);

        const recent = cves.filter(c => Date.now() - new Date(c.published || c.fetched_at).getTime() <= 30 * 24 * 3600 * 1000);
        const topCves = [...(recent.length ? recent : cves)]
            .sort((a, b) => (Number(b.cvss_score) || 0) - (Number(a.cvss_score) || 0))
            .slice(0, 5);

        const words = [...list(d.words)].sort((a, b) => b.occurrences - a.occurrences).slice(0, 8);

        const breaking = list(d.breaking)
            .filter(n => n.summary_text && isThisWeek(n.created_at))
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
        const weekly = list(d.weekly)[0];
        const brief = breaking
            ? { kind: 'breaking', label: 'Breaking news', icon: 'bolt', text: breaking.summary_text, date: breaking.created_at }
            : weekly && weekly.summary_text
                ? { kind: 'weekly', label: 'Weekly report', icon: 'description', text: weekly.summary_text, date: weekly.created_at }
                : null;

        return { d, cves, victimsThisWeek, severity, breakdown, weekTotal, feed, topCves, words, brief };
    }

    render() {
        const { loading, refreshedAt } = this.state;
        const { user } = this.props;
        const { d, cves, victimsThisWeek, severity, breakdown, weekTotal, feed, topCves, words, brief } = this.derive();
        const firstLoad = loading && !this.state.data;
        const tw = d.threatsStats || {};
        const maxOcc = words.length ? words[0].occurrences : 1;

        return (
            <div className="wt-ov">
                <OnboardingChecklist data={this.state.data} isSuperuser={!!user?.is_superuser} token={this.props.token} />

                {/* Hero */}
                <section className="wt-ov-hero">
                    <div className="card wt-ov-headline">
                        <div className="card-body">
                            <div className="wt-ov-greet">
                                <div>
                                    <h2>{greeting()}{user?.first_name ? `, ${user.first_name}` : ''}</h2>
                                    <p>{moment().format('dddd D MMMM YYYY')}</p>
                                </div>
                                <button type="button" className="btn btn-secondary wt-btn-ghost btn-sm" onClick={this.refresh} disabled={loading}>
                                    <i className={`material-icons ${loading ? 'wt-spin' : ''}`} style={{ fontSize: 17 }}>refresh</i>
                                    {refreshedAt ? `Updated ${moment(refreshedAt).format('HH:mm')}` : 'Refresh'}
                                </button>
                            </div>

                            {firstLoad ? <Skeleton lines={2} /> : (
                                <>
                                    <div className="wt-ov-hero-figure">
                                        <span className="wt-ov-hero-value">{weekTotal.toLocaleString()}</span>
                                        <span className="wt-ov-hero-label">new detections<br />in the last 7 days</span>
                                    </div>
                                    <div className="wt-ov-breakdown">
                                        {breakdown.map(b => (
                                            <Link key={b.key} to={b.to} className="wt-ov-chip">
                                                <i className="material-icons" aria-hidden="true">{b.icon}</i>
                                                <b>{fmt(b.value)}</b>
                                                <span>{b.label}</span>
                                            </Link>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className={`card wt-ov-brief ${brief ? `wt-ov-brief-${brief.kind}` : ''}`}>
                        <div className="card-body">
                            <div className="wt-ov-section-head">
                                <span className="wt-ov-section-title">
                                    <i className="material-icons" aria-hidden="true">{brief ? brief.icon : 'lightbulb_outline'}</i>
                                    {brief ? brief.label : 'Intelligence brief'}
                                </span>
                                <span className="wt-ov-muted">AI summary</span>
                            </div>
                            {firstLoad ? <Skeleton lines={4} /> : brief ? (
                                <>
                                    <div className="wt-ov-brief-text" dangerouslySetInnerHTML={{ __html: brief.text }} />
                                    <div className="wt-ov-brief-meta">
                                        <i className="material-icons" aria-hidden="true">schedule</i>
                                        Generated {fromNow(brief.date)}
                                        <Link to="/" className="ms-auto">Open Threats Watcher</Link>
                                    </div>
                                </>
                            ) : (
                                <Empty icon="hourglass_empty" text="No summary yet. Breaking news and the weekly report appear here once generated." />
                            )}
                        </div>
                    </div>
                </section>

                {/* Modules */}
                <section className="wt-ov-modules">
                    <ModuleCard to="/" icon="radar" name="Threats Watcher" loading={firstLoad}
                                value={num(tw.totalWords)} valueLabel="trending words" delta={num(tw.newThisWeek)}
                                items={[
                                    { label: 'New today', value: num(tw.newToday) },
                                    { label: 'RSS sources', value: num(tw.totalSources) },
                                    { label: 'Monitored keywords', value: num(tw.monitoredKeywords) },
                                ]}>
                        <Spark points={tw.dailyNew} />
                    </ModuleCard>

                    <ModuleCard to="/cyber_watch" icon="bug_report" name="Cyber Watch" loading={firstLoad}
                                value={d.cves ? cves.length : null} valueLabel="CVEs tracked"
                                alert={severity.CRITICAL > 0}
                                items={[
                                    { label: 'Critical CVEs', value: d.cves ? severity.CRITICAL : null, status: 'danger' },
                                    { label: 'Victims (7 days)', value: d.victims ? victimsThisWeek : null },
                                ]}>
                        <SeverityMix counts={severity} />
                    </ModuleCard>

                    <ModuleCard to="/data_leak" icon="policy" name="Data Leak" loading={firstLoad}
                                value={num(d.dataLeakStats?.activeAlerts)} valueLabel="active alerts"
                                delta={num(d.dataLeakStats?.newThisWeek)}
                                alert={num(d.dataLeakStats?.newToday) > 0}
                                items={[
                                    { label: 'New today', value: num(d.dataLeakStats?.newToday), status: 'warning' },
                                    { label: 'All alerts', value: num(d.dataLeakStats?.totalAlerts) },
                                    { label: 'Search patterns', value: num(d.dataLeakStats?.totalKeywords) },
                                ]} />

                    <ModuleCard to="/dns_finder" icon="dns" name="DNS Threats" loading={firstLoad}
                                value={num(d.dnsStats?.totalAlerts)} valueLabel="suspicious domains"
                                delta={num(d.dnsStats?.newThisWeek)}
                                alert={num(d.dnsStats?.totalDanglingConfirmed) > 0}
                                items={[
                                    { label: 'Takeover risks', value: num(d.dnsStats?.totalDanglingConfirmed), status: 'danger' },
                                    { label: 'Domains watched', value: num(d.dnsStats?.totalDnsMonitored) },
                                    { label: 'Keywords', value: num(d.dnsStats?.totalKeywords) },
                                ]} />

                    <ModuleCard to="/website_monitoring" icon="language" name="Website Monitoring" loading={firstLoad}
                                value={num(d.siteStats?.total)} valueLabel="sites monitored"
                                delta={num(d.siteStats?.newThisWeek)}
                                alert={num(d.siteStats?.malicious) > 0}
                                items={[
                                    { label: 'Malicious', value: num(d.siteStats?.malicious), status: 'danger' },
                                    { label: 'Takedown requests', value: num(d.siteStats?.takedownRequests) },
                                    { label: 'Legal team', value: num(d.siteStats?.legalTeam) },
                                ]} />

                    <ModuleCard to="/legitimate_domains" icon="verified_user" name="Legitimate Domains" loading={firstLoad}
                                value={num(d.legitStats?.total)} valueLabel="registered domains"
                                alert={num(d.legitStats?.expiringSoon) > 0 || num(d.legitStats?.expired) > 0}
                                items={[
                                    { label: 'Expiring soon', value: num(d.legitStats?.expiringSoon), status: 'warning' },
                                    { label: 'Expired', value: num(d.legitStats?.expired), status: 'danger' },
                                    { label: 'Repurchased', value: num(d.legitStats?.repurchased) },
                                ]} />
                </section>

                {/* Lists */}
                <section className="wt-ov-lists">
                    <div className="card">
                        <div className="card-body">
                            <div className="wt-ov-section-head">
                                <span className="wt-ov-section-title">
                                    <i className="material-icons" aria-hidden="true">notifications_active</i>Latest detections
                                </span>
                            </div>
                            {firstLoad ? <Skeleton lines={6} /> : feed.length === 0 ? (
                                <Empty icon="inbox" text="Nothing detected yet." />
                            ) : (
                                <ul className="wt-ov-feed">
                                    {feed.map(item => (
                                        <li key={item.id}>
                                            <Link to={item.to}>
                                                <span className="wt-ov-feed-icon"><i className="material-icons">{item.icon}</i></span>
                                                <span className="wt-ov-feed-text">
                                                    <b>{item.title}</b>
                                                    <small>{item.sub}</small>
                                                </span>
                                                <span className="wt-ov-feed-side">
                                                    {item.severity && <SeverityBadge severity={item.severity} />}
                                                    <time dateTime={item.date} title={moment(item.date).format('LLL')}>{fromNow(item.date)}</time>
                                                </span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-body">
                            <div className="wt-ov-section-head">
                                <span className="wt-ov-section-title">
                                    <i className="material-icons" aria-hidden="true">report</i>Top vulnerabilities
                                </span>
                                <Link to="/cyber_watch" className="wt-ov-link">All CVEs</Link>
                            </div>
                            {firstLoad ? <Skeleton lines={5} /> : topCves.length === 0 ? (
                                <Empty icon="done_all" text="No CVEs tracked yet." />
                            ) : (
                                <ul className="wt-ov-cves">
                                    {topCves.map(c => (
                                        <li key={c.id}>
                                            <div className="wt-ov-cve-top">
                                                <b>{c.cve_id}</b>
                                                <CvssScore score={c.cvss_score} />
                                            </div>
                                            <div className="wt-ov-cve-bottom">
                                                <SeverityBadge severity={c.severity} />
                                                <span title={c.description}>{c.description}</span>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-body">
                            <div className="wt-ov-section-head">
                                <span className="wt-ov-section-title">
                                    <i className="material-icons" aria-hidden="true">trending_up</i>Trending now
                                </span>
                                <Link to="/" className="wt-ov-link">Word cloud</Link>
                            </div>
                            {firstLoad ? <Skeleton lines={6} /> : words.length === 0 ? (
                                <Empty icon="cloud_queue" text="Trending words appear after the first RSS crawl." />
                            ) : (
                                <ol className="wt-ov-words">
                                    {words.map(w => (
                                        <li key={w.id || w.name}>
                                            <span className={`wt-ov-rel wt-ov-rel-${reliability(w.score)}`}
                                                  title={w.score !== null && w.score !== undefined ? `Reliability ${Number(w.score).toFixed(0)}%` : 'Not scored'} />
                                            <span className="wt-ov-word">{w.name}</span>
                                            <span className="wt-ov-word-bar" aria-hidden="true">
                                                <span style={{ width: `${Math.max(4, (w.occurrences / maxOcc) * 100)}%` }} />
                                            </span>
                                            <span className="wt-ov-word-count">{w.occurrences}</span>
                                        </li>
                                    ))}
                                </ol>
                            )}
                        </div>
                    </div>
                </section>
            </div>
        );
    }
}

const mapStateToProps = state => ({ user: state.auth.user, token: state.auth.token });

export default connect(mapStateToProps, { loadOverview })(Overview);
