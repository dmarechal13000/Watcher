import axios from 'axios';
import { tokenConfig } from './auth';

// Read-only search index for the command palette (Ctrl+K). Loaded on first open and cached
// for a short while; it never dispatches into the module reducers. Each source settles on its
// own, so one unreachable module just contributes no results.

const SOURCES = {
    words:       '/api/threats_watcher/trendyword/',
    cves:        '/api/cyber_watch/cves/?page=1&page_size=500',
    victims:     '/api/cyber_watch/ransomware/victims/?page=1&page_size=500',
    leakAlerts:  '/api/data_leak/alert/?page=1&page_size=500',
    dnsAlerts:   '/api/dns_finder/alert/?page=1&page_size=500',
    sites:       '/api/site_monitoring/site/?page=1&page_size=500',
    legitDomains: '/api/common/legitimate_domains/?page=1&page_size=500',
};

const CACHE_MS = 2 * 60 * 1000;
let cache = null;

const unwrap = data => (data && Array.isArray(data.results) ? data.results : (Array.isArray(data) ? data : []));

export const loadSearchIndex = (force = false) => (dispatch, getState) => {
    if (!force && cache && Date.now() - cache.at < CACHE_MS) return Promise.resolve(cache.data);
    const config = tokenConfig(getState);
    const keys = Object.keys(SOURCES);
    return Promise.allSettled(keys.map(k => axios.get(SOURCES[k], config))).then(results => {
        const data = {};
        results.forEach((res, i) => {
            data[keys[i]] = res.status === 'fulfilled' ? unwrap(res.value.data) : [];
        });
        cache = { at: Date.now(), data };
        return data;
    });
};
