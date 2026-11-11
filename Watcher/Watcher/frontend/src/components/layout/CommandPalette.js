import React, { useEffect, useMemo, useRef, useState } from 'react';
import { connect } from 'react-redux';
import { useHistory } from 'react-router-dom';
import PropTypes from 'prop-types';
import { Modal } from 'react-bootstrap';
import { logout } from '../../actions/auth';
import { loadSearchIndex } from '../../actions/Search';
import { useTheme, THEMES, EFFECT_LEVELS } from '../../contexts/ThemeContext';
import { requestDetail } from '../common/detailFocus';

// Command palette (Ctrl+K / Cmd+K): jump to a module, run an action, or search the data
// (trending words, CVEs, ransomware victims, leak alerts, DNS threats, sites, legitimate domains).

export const OPEN_PALETTE_EVENT = 'wt:open-palette';
export const openCommandPalette = () => window.dispatchEvent(new CustomEvent(OPEN_PALETTE_EVENT));

const PER_SOURCE = 5;
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');
export const SHORTCUT_LABEL = isMac ? '⌘K' : 'Ctrl K';

const hostOf = url => { try { return new URL(url).hostname; } catch (_) { return url || ''; } };

// 0 = starts with, 1 = a word starts with it, 2 = contains, -1 = no match
const rank = (text, q) => {
    const t = String(text || '').toLowerCase();
    if (!q) return 0;
    if (t.startsWith(q)) return 0;
    if (t.includes(` ${q}`) || t.includes(`-${q}`) || t.includes(`.${q}`)) return 1;
    return t.includes(q) ? 2 : -1;
};

const bestRank = (fields, q) => {
    const ranks = fields.map(f => rank(f, q)).filter(r => r >= 0);
    return ranks.length ? Math.min(...ranks) : -1;
};

const Highlight = ({ text, query }) => {
    const value = String(text || '');
    const i = query ? value.toLowerCase().indexOf(query) : -1;
    if (i < 0) return value;
    return (
        <>
            {value.slice(0, i)}
            <mark>{value.slice(i, i + query.length)}</mark>
            {value.slice(i + query.length)}
        </>
    );
};

const searchIndex = (index, q) => {
    if (!index || q.length < 2) return [];
    const groups = [
        {
            group: 'Trending words', icon: 'track_changes', list: index.words,
            fields: w => [w.name],
            make: w => ({
                id: `w-${w.id ?? w.name}`, title: w.name,
                subtitle: `Threats Watcher · ${w.occurrences} mentions`,
                run: h => { requestDetail('word', w.name); h.push('/'); },
            }),
        },
        {
            group: 'CVEs', icon: 'bug_report', list: index.cves,
            fields: c => [c.cve_id, c.description],
            make: c => ({
                id: `cve-${c.id}`, title: c.cve_id,
                subtitle: [c.severity, c.cvss_score != null ? `CVSS ${c.cvss_score}` : null, c.description].filter(Boolean).join(' · '),
                run: h => { requestDetail('cve', c.id); h.push('/'); },
            }),
        },
        {
            group: 'Ransomware victims', icon: 'lock', list: index.victims,
            fields: v => [v.victim_name, v.group_name, v.country, v.sector],
            make: v => ({
                id: `v-${v.id}`, title: v.victim_name,
                subtitle: ['Ransomware', v.group_name, v.country].filter(Boolean).join(' · '),
                run: h => { requestDetail('victim', v.id); h.push('/'); },
            }),
        },
        {
            group: 'Data leak alerts', icon: 'policy', list: index.leakAlerts,
            fields: a => [a.keyword?.name, a.url, `#${a.id}`],
            make: a => ({
                id: `dl-${a.id}`, title: `“${a.keyword?.name || '-'}” on ${hostOf(a.url)}`,
                subtitle: `Data Leak · alert #${a.id}${a.status === false ? ' (archived)' : ''}`,
                run: h => { requestDetail('leak-alert', a.id); h.push('/data_leak'); },
            }),
        },
        {
            group: 'DNS threats', icon: 'dns', list: index.dnsAlerts,
            fields: a => [a.dns_twisted?.domain_name],
            make: a => ({
                id: `dns-${a.id}`, title: a.dns_twisted?.domain_name || `Alert #${a.id}`,
                subtitle: 'DNS Threats Monitored',
                run: h => h.push('/dns_finder'),
            }),
        },
        {
            group: 'Monitored websites', icon: 'language', list: index.sites,
            fields: s => [s.domain_name, s.ticket_id, s.ip],
            make: s => ({
                id: `site-${s.id}`, title: s.domain_name,
                subtitle: ['Website Monitoring', s.ticket_id, s.ip].filter(Boolean).join(' · '),
                run: h => { requestDetail('site', s.id); h.push('/website_monitoring'); },
            }),
        },
        {
            group: 'Legitimate domains', icon: 'verified_user', list: index.legitDomains,
            fields: d => [d.domain_name, d.ticket_id],
            make: d => ({
                id: `ld-${d.id}`, title: d.domain_name,
                subtitle: ['Legitimate Domains', d.ticket_id].filter(Boolean).join(' · '),
                run: h => h.push('/legitimate_domains'),
            }),
        },
    ];

    return groups.flatMap(g => (g.list || [])
        .map(item => ({ item, r: bestRank(g.fields(item), q) }))
        .filter(x => x.r >= 0)
        .sort((a, b) => a.r - b.r)
        .slice(0, PER_SOURCE)
        .map(x => ({ ...g.make(x.item), group: g.group, icon: g.icon })));
};

export const CommandPalette = ({ auth, config, logout, loadSearchIndex }) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(0);
    const [index, setIndex] = useState(null);
    const [loading, setLoading] = useState(false);
    const history = useHistory();
    const { currentTheme, changeTheme, effects, setEffects } = useTheme();
    const listRef = useRef(null);
    const { isAuthenticated, user } = auth;

    useEffect(() => {
        const onKey = e => {
            if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setOpen(o => !o);
            }
        };
        const onOpen = () => setOpen(true);
        window.addEventListener('keydown', onKey);
        window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
        return () => {
            window.removeEventListener('keydown', onKey);
            window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
        };
    }, []);

    useEffect(() => {
        if (!open) return;
        setQuery('');
        setActive(0);
        if (isAuthenticated) {
            setLoading(true);
            loadSearchIndex().then(data => { setIndex(data); setLoading(false); });
        }
    }, [open, isAuthenticated, loadSearchIndex]);

    const q = query.trim().toLowerCase();

    const items = useMemo(() => {
        const pages = [
            { to: '/overview', title: 'Overview', icon: 'space_dashboard', keywords: 'home dashboard summary', auth: true },
            { to: '/', title: 'Threats Watcher', icon: 'radar', keywords: 'trending words rss word cloud ransomware cve' },
            { to: '/threats_watcher/statistics', title: 'Threats Watcher · Statistics', icon: 'insert_chart', keywords: 'charts analytics trends cve ransomware words' },
            { to: '/cyber_watch/statistics', title: 'Cyber Watch · Statistics', icon: 'insert_chart', keywords: 'charts analytics watch rules hits feeds health', auth: true },
            { to: '/data_leak/statistics', title: 'Data Leak · Statistics', icon: 'insert_chart', keywords: 'charts analytics leaks alerts sources', auth: true },
            { to: '/dns_finder/statistics', title: 'DNS Threats · Statistics', icon: 'insert_chart', keywords: 'charts analytics domains typosquatting', auth: true },
            { to: '/website_monitoring/statistics', title: 'Website Monitoring · Statistics', icon: 'insert_chart', keywords: 'charts analytics sites expirations', auth: true },
            { to: '/legitimate_domains/statistics', title: 'Legitimate Domains · Statistics', icon: 'insert_chart', keywords: 'charts analytics renewals expiry' },
            { to: '/cyber_watch', title: 'Cyber Watch', icon: 'bug_report', keywords: 'cve watch rules sources banned', auth: true },
            { to: '/data_leak', title: 'Data Leak', icon: 'policy', keywords: 'leak paste alerts search patterns', auth: true },
            { to: '/dns_finder', title: 'DNS Threats Monitored', icon: 'dns', keywords: 'typosquatting domains certstream dnstwist', auth: true },
            { to: '/website_monitoring', title: 'Website Monitoring', icon: 'language', keywords: 'sites malicious udrp takedown', auth: true },
            { to: '/legitimate_domains', title: 'Legitimate Domains', icon: 'verified_user', keywords: 'domains expiry registrar' },
            { to: '/connectors', title: 'Connectors', icon: 'settings_input_component', keywords: 'integrations thehive misp slack smtp', superuser: true },
            { to: '/profile', title: 'My Profile', icon: 'account_circle', keywords: 'settings account themes layouts', auth: true },
        ]
            .filter(p => (!p.auth || isAuthenticated) && (!p.superuser || (user && user.is_superuser)))
            .map(p => ({ id: `page-${p.to}`, group: 'Go to', icon: p.icon, title: p.title, subtitle: p.keywords, hideSubtitle: true,
                         match: [p.title, p.keywords], run: h => h.push(p.to) }));

        const actions = [];
        if (THEMES[currentTheme]?.ambient) {
            Object.entries(EFFECT_LEVELS).filter(([key]) => key !== effects).forEach(([key, level]) => {
                actions.push({ id: `fx-${key}`, group: 'Actions', icon: 'blur_on', title: `Background effects: ${level.label}`,
                               subtitle: level.description, match: ['background effects animation', level.label], run: () => setEffects(key) });
            });
        }
        if (config.helpButtonUrl) {
            actions.push({ id: 'api-docs', group: 'Actions', icon: 'settings', title: config.helpButtonLabel || 'API Docs',
                           subtitle: 'Open the API documentation', match: ['api docs swagger', config.helpButtonLabel],
                           run: () => window.open(config.helpButtonUrl, '_blank', 'noopener') });
        }
        actions.push({ id: 'docs', group: 'Actions', icon: 'notes', title: 'Documentation', subtitle: 'Watcher user & admin guide',
                       match: ['documentation help guide'], run: () => window.open('https://thalesgroup-cert.github.io/Watcher/', '_blank', 'noopener') });
        if (isAuthenticated) {
            actions.push({ id: 'logout', group: 'Actions', icon: 'logout', title: 'Log out', subtitle: 'End your session',
                           match: ['logout sign out'], run: () => logout() });
        }

        // Themes only when asked for ("theme", a theme name, "dark"...), to keep the list short
        const themes = Object.entries(THEMES)
            .filter(([key, t]) => !t.hidden && key !== currentTheme)
            .map(([key, t]) => ({ id: `theme-${key}`, group: 'Themes', icon: 'palette', title: `Theme: ${t.name}`,
                                  subtitle: t.description, match: [`theme ${t.name}`, t.dark ? 'dark' : 'light'],
                                  run: () => changeTheme(key) }));

        const filterStatic = list => (q ? list.filter(i => bestRank(i.match, q) >= 0)
            .sort((a, b) => bestRank(a.match, q) - bestRank(b.match, q)) : list);

        return [
            ...filterStatic(pages),
            ...(q ? searchIndex(index, q) : []),
            ...filterStatic(actions),
            ...(q ? filterStatic(themes) : []),
        ];
    }, [q, index, isAuthenticated, user, currentTheme, effects, config, changeTheme, setEffects, logout]);

    useEffect(() => { setActive(0); }, [q]);

    useEffect(() => {
        const el = listRef.current && listRef.current.querySelector(`[data-index="${active}"]`);
        if (el) el.scrollIntoView({ block: 'nearest' });
    }, [active]);

    const close = () => setOpen(false);
    const runItem = item => {
        close();
        item.run(history);
    };

    const onKeyDown = e => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive(a => (items.length ? (a + 1) % items.length : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive(a => (items.length ? (a - 1 + items.length) % items.length : 0));
        } else if (e.key === 'Enter' && items[active]) {
            e.preventDefault();
            runItem(items[active]);
        }
    };

    let lastGroup = null;

    return (
        <Modal
            show={open}
            onHide={close}
            dialogClassName="wt-palette-dialog"
            contentClassName="wt-palette"
            aria-label="Command palette"
        >
            <div className="wt-palette-input">
                <i className="material-icons" aria-hidden="true">search</i>
                <input
                    autoFocus
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={isAuthenticated ? 'Search words, CVEs, victims, domains, alerts… or jump to a page' : 'Jump to a page or run an action'}
                    aria-label="Search"
                    role="combobox"
                    aria-expanded="true"
                    aria-controls="wt-palette-list"
                    aria-activedescendant={items[active] ? `wt-palette-${items[active].id}` : undefined}
                />
                {loading && <span className="spinner-border spinner-border-sm text-secondary" role="status" aria-label="Loading" />}
                <kbd>Esc</kbd>
            </div>

            <ul className="wt-palette-list" id="wt-palette-list" role="listbox" ref={listRef}>
                {items.length === 0 && (
                    <li className="wt-palette-empty">
                        {q.length < 2 ? 'Type at least 2 characters to search the data.' : `No results for “${query}”.`}
                    </li>
                )}
                {items.map((item, i) => {
                    const header = item.group !== lastGroup ? item.group : null;
                    lastGroup = item.group;
                    return (
                        <React.Fragment key={item.id}>
                            {header && <li className="wt-palette-group" role="presentation">{header}</li>}
                            <li
                                id={`wt-palette-${item.id}`}
                                data-index={i}
                                role="option"
                                aria-selected={i === active}
                                className={`wt-palette-item ${i === active ? 'is-active' : ''}`}
                                onMouseMove={() => i !== active && setActive(i)}
                                onClick={() => runItem(item)}
                            >
                                <span className="wt-palette-icon"><i className="material-icons">{item.icon}</i></span>
                                <span className="wt-palette-text">
                                    <span className="wt-palette-title"><Highlight text={item.title} query={q} /></span>
                                    {!item.hideSubtitle && item.subtitle && (
                                        <span className="wt-palette-sub"><Highlight text={item.subtitle} query={q} /></span>
                                    )}
                                </span>
                                {i === active && <i className="material-icons wt-palette-enter" aria-hidden="true">keyboard_return</i>}
                            </li>
                        </React.Fragment>
                    );
                })}
            </ul>

            <div className="wt-palette-foot">
                <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
                <span><kbd>↵</kbd> open</span>
                <span><kbd>Esc</kbd> close</span>
                <span className="ms-auto"><kbd>{SHORTCUT_LABEL}</kbd> anywhere</span>
            </div>
        </Modal>
    );
};

CommandPalette.propTypes = {
    auth: PropTypes.object.isRequired,
    config: PropTypes.object.isRequired,
    logout: PropTypes.func.isRequired,
    loadSearchIndex: PropTypes.func.isRequired,
};

const mapStateToProps = state => ({ auth: state.auth, config: state.config });

export default connect(mapStateToProps, { logout, loadSearchIndex })(CommandPalette);
