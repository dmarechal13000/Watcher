/**
 * layoutPresets.js
 *
 * Named layout presets for each PanelGrid module.
 * The first preset (id:'default') always mirrors the Dashboard's DEFAULT_LAYOUT / DEFAULT_ACTIVE.
 *
 * Helper functions to apply / read the active preset via preferencesService.
 */
import preferencesService from '../services/preferencesService';

// ThreatsWatcher
const THREATS_PRESETS = [
    {
        id: 'default',
        name: 'Standard',
        description: 'Balanced view: cloud, word list, sources, trend chart, map, victims, CVE.',
        icon: 'dashboard',
        layout: [
            { i: 'cloud',   x: 0, y: 10, w: 6,  h: 10, minW: 3, minH: 5 },
            { i: 'words',   x: 6, y: 10, w: 6,  h: 10, minW: 3, minH: 5 },
            { i: 'sources', x: 0, y: 20, w: 12, h: 11, minW: 6, minH: 5 },
            { i: 'chart',   x: 0, y: 31, w: 12, h: 8,  minW: 6, minH: 4 },
            { i: 'victims', x: 6, y: 39, w: 6,  h: 10, minW: 3, minH: 5 },
            { i: 'map',     x: 0, y: 39, w: 6,  h: 10, minW: 3, minH: 6 },
            { i: 'cve',     x: 0, y: 49, w: 12, h: 12, minW: 4, minH: 5 },
        ],
        active: ['cloud', 'words', 'map', 'victims', 'cve', 'sources', 'chart'],
    },
    {
        id: 'tv',
        name: 'TV / Wall Display',
        description: 'Visual-first: world map, word cloud and ransomware victims. No tables.',
        icon: 'tv',
        layout: [
            { i: 'map',     x: 0, y: 8,  w: 6,  h: 14, minW: 3, minH: 6 },
            { i: 'cloud',   x: 6, y: 8,  w: 6,  h: 14, minW: 3, minH: 5 },
            { i: 'victims', x: 0, y: 22, w: 6,  h: 10, minW: 3, minH: 5 },
            { i: 'cve',     x: 6, y: 22, w: 6,  h: 10, minW: 4, minH: 5 },
        ],
        active: ['map', 'cloud', 'victims', 'cve'],
    },
    {
        id: 'analysis',
        name: 'Deep Analysis',
        description: 'Focus on word lists, CVE details and trend data. No visual widgets.',
        icon: 'trending_up',
        layout: [
            { i: 'words',   x: 0, y: 8,  w: 12, h: 14, minW: 3, minH: 5 },
            { i: 'cve',     x: 0, y: 22, w: 12, h: 14, minW: 4, minH: 5 },
            { i: 'sources', x: 0, y: 36, w: 12, h: 11, minW: 6, minH: 5 },
            { i: 'chart',   x: 0, y: 47, w: 12, h: 8,  minW: 6, minH: 4 },
        ],
        active: ['words', 'cve', 'sources', 'chart'],
    },
    {
        id: 'minimal',
        name: 'Minimal',
        description: 'Word cloud and world map only - minimal distraction.',
        icon: 'crop_free',
        layout: [
            { i: 'cloud', x: 0, y: 8,  w: 6,  h: 12, minW: 3, minH: 5 },
            { i: 'map',   x: 6, y: 8,  w: 6,  h: 12, minW: 3, minH: 6 },
        ],
        active: ['cloud', 'map'],
    },
];

//DNS Threats Monitored
const DNS_PRESETS = [
    {
        id: 'default',
        name: 'Standard',
        description: 'Full view: unified DNS threats, corporate assets and keywords.',
        icon: 'dashboard',
        layout: [
            { i: 'threats',  x: 0, y: 8,  w: 12, h: 14, minW: 6, minH: 6 },
            { i: 'dns',      x: 0, y: 22, w: 6,  h: 11, minW: 3, minH: 5 },
            { i: 'keywords', x: 6, y: 22, w: 6,  h: 11, minW: 3, minH: 5 },
        ],
        active: ['threats', 'dns', 'keywords'],
    },
    {
        id: 'triage',
        name: 'Threat Triage',
        description: 'Rapid threat review: the full unified threats table - no asset/keyword panels.',
        icon: 'warning',
        layout: [
            { i: 'threats',  x: 0, y: 6,  w: 12, h: 22, minW: 6, minH: 6 },
        ],
        active: ['threats'],
    },
    {
        id: 'management',
        name: 'Asset Management',
        description: 'Corporate DNS assets and keyword configuration side by side.',
        icon: 'find_in_page',
        layout: [
            { i: 'keywords', x: 0, y: 6,  w: 5,  h: 14, minW: 3, minH: 5 },
            { i: 'dns',      x: 5, y: 6,  w: 7,  h: 14, minW: 3, minH: 5 },
        ],
        active: ['keywords', 'dns'],
    },
    {
        id: 'minimal',
        name: 'Minimal',
        description: 'Threats table only - stripped down.',
        icon: 'crop_free',
        layout: [
            { i: 'threats', x: 0, y: 8, w: 12, h: 16, minW: 6, minH: 6 },
        ],
        active: ['threats'],
    },
];

// Site Monitoring
const SITE_PRESETS = [
    {
        id: 'default',
        name: 'Standard',
        description: 'Full monitored-sites table.',
        icon: 'dashboard',
        layout: [
            { i: 'sites', x: 0, y: 9, w: 12, h: 11, minW: 5, minH: 6 },
        ],
        active: ['sites'],
    },
    {
        id: 'table',
        name: 'Table Focus',
        description: 'Maximum space for the sites table.',
        icon: 'table_chart',
        layout: [
            { i: 'sites', x: 0, y: 6, w: 12, h: 18, minW: 5, minH: 6 },
        ],
        active: ['sites'],
    },
];

// Data Leak
const DATALEAK_PRESETS = [
    {
        id: 'default',
        name: 'Standard',
        description: 'Alerts alongside search patterns, and archived section.',
        icon: 'dashboard',
        layout: [
            { i: 'alerts',   x: 0, y: 8,  w: 8,  h: 11, minW: 4, minH: 5 },
            { i: 'patterns', x: 8, y: 8,  w: 4,  h: 11, minW: 3, minH: 5 },
            { i: 'archived', x: 0, y: 19, w: 12, h: 9,  minW: 6, minH: 5 },
        ],
        active: ['alerts', 'patterns', 'archived'],
    },
    {
        id: 'triage',
        name: 'Alert Triage',
        description: 'Active alerts maximised - cut through the noise fast.',
        icon: 'warning',
        layout: [
            { i: 'alerts', x: 0, y: 7, w: 12, h: 16, minW: 4, minH: 5 },
        ],
        active: ['alerts'],
    },
    {
        id: 'management',
        name: 'Keyword Management',
        description: 'Manage search patterns and review archived alerts, no live feed.',
        icon: 'find_in_page',
        layout: [
            { i: 'patterns', x: 0, y: 7,  w: 12, h: 16, minW: 3, minH: 5 },
            { i: 'archived', x: 0, y: 23, w: 12, h: 12, minW: 6, minH: 5 },
        ],
        active: ['patterns', 'archived'],
    },
    {
        id: 'full',
        name: 'Full View',
        description: 'All four panels with tighter heights for maximum density.',
        icon: 'view_agenda',
        layout: [
            { i: 'alerts',   x: 0, y: 7,  w: 8,  h: 14, minW: 4, minH: 5 },
            { i: 'patterns', x: 8, y: 7,  w: 4,  h: 14, minW: 3, minH: 5 },
            { i: 'archived', x: 0, y: 21, w: 12, h: 12, minW: 6, minH: 5 },
        ],
        active: ['alerts', 'patterns', 'archived'],
    },
];

// Cyber Watch
const CYBERWATCH_PRESETS = [
    {
        id: 'default',
        name: 'Standard',
        description: 'Complete view of all configuration and alert panels.',
        icon: 'dashboard',
        layout: [
            { i: 'monitored',  x: 0, y: 4,  w: 6,  h: 11, minW: 4, minH: 5 },
            { i: 'watchrules', x: 6, y: 4,  w: 6,  h: 11, minW: 4, minH: 5 },
            { i: 'sources',    x: 0, y: 15, w: 6,  h: 11, minW: 4, minH: 5 },
            { i: 'banned',     x: 6, y: 15, w: 6,  h: 11, minW: 4, minH: 5 },
            { i: 'archived',   x: 0, y: 26, w: 12, h: 12, minW: 4, minH: 6 },
        ],
        active: ['monitored', 'watchrules', 'sources', 'banned', 'archived'],
    },
    {
        id: 'config',
        name: 'Configuration',
        description: 'Manage keywords, watch rules, sources and banned words - no alert review.',
        icon: 'tune',
        layout: [
            { i: 'monitored',  x: 0, y: 4,  w: 6,  h: 14, minW: 4, minH: 5 },
            { i: 'watchrules', x: 6, y: 4,  w: 6,  h: 14, minW: 4, minH: 5 },
            { i: 'sources',    x: 0, y: 18, w: 6,  h: 11, minW: 4, minH: 5 },
            { i: 'banned',     x: 6, y: 18, w: 6,  h: 11, minW: 4, minH: 5 },
        ],
        active: ['monitored', 'watchrules', 'sources', 'banned'],
    },
    {
        id: 'review',
        name: 'Alert Review',
        description: 'Archived alerts only - focused on investigation.',
        icon: 'check_circle',
        layout: [
            { i: 'archived', x: 0, y: 5, w: 12, h: 18, minW: 4, minH: 6 },
        ],
        active: ['archived'],
    },
];

// Legitimate Domains
const LEGIT_PRESETS = [
    {
        id: 'default',
        name: 'Standard',
        description: 'Full domain list.',
        icon: 'dashboard',
        layout: [
            { i: 'domains', x: 0, y: 9, w: 12, h: 11, minW: 5, minH: 6 },
        ],
        active: ['domains'],
    },
    {
        id: 'table',
        name: 'Table Focus',
        description: 'Maximum space for domain management.',
        icon: 'table_chart',
        layout: [
            { i: 'domains', x: 0, y: 6, w: 12, h: 18, minW: 5, minH: 6 },
        ],
        active: ['domains'],
    },
];

export const LAYOUT_PRESETS = {
    'watcher_threats_grid':          THREATS_PRESETS,
    'watcher_dns_finder_grid_v2':    DNS_PRESETS,
    'watcher_site_monitoring_grid':  SITE_PRESETS,
    'watcher_dataleak_grid':         DATALEAK_PRESETS,
    'watcher_cyber_watch_grid':      CYBERWATCH_PRESETS,
    'watcher_legitimate_domains_grid': LEGIT_PRESETS,
};


export const getActivePresetId = (storageKey) =>
    preferencesService.get(`${storageKey}_preset`, 'default');

/**
 * Apply a preset: write layout + active to preferencesService,
 * clear manual-resize flag, and record the preset id.
 */
export const applyPreset = (storageKey, preset) => {
    preferencesService.set(`${storageKey}_layout`,  preset.layout);
    preferencesService.set(`${storageKey}_active`,  preset.active);
    preferencesService.remove(`${storageKey}_resized`);
    preferencesService.set(`${storageKey}_preset`,  preset.id);
    // Notify any mounted PanelGrid for this storageKey to re-hydrate
    window.dispatchEvent(new CustomEvent('watcher:layout:updated', { detail: { storageKey } }));
};
