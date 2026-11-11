import axios from 'axios';
import { tokenConfig } from './auth';

// Read-only data for the Overview page. It deliberately does not dispatch into the module
// reducers (their list actions replace the stored lists), so visiting the Overview never
// changes what the module pages show. Each request settles on its own: one failing module
// leaves the others intact.

const REQUESTS = {
    threatsStats:  '/api/threats_watcher/source/statistics/',
    dataLeakStats: '/api/data_leak/keyword/statistics/',
    dnsStats:      '/api/dns_finder/dns_monitored/statistics/',
    siteStats:     '/api/site_monitoring/site/statistics/',
    legitStats:    '/api/common/legitimate_domains/statistics/',
    words:         '/api/threats_watcher/trendyword/',
    cves:          '/api/cyber_watch/cves/?page=1&page_size=200',
    victims:       '/api/cyber_watch/ransomware/victims/?page=1&page_size=100',
    dataLeakAlerts: '/api/data_leak/alert/?page=1&page_size=8',
    dnsAlerts:     '/api/dns_finder/alert/?page=1&page_size=8',
    siteAlerts:    '/api/site_monitoring/alert/?page=1&page_size=8',
    breaking:      '/api/threats_watcher/summary/?type=breaking_news',
    weekly:        '/api/threats_watcher/summary/?type=weekly_summary',
};

const unwrap = data => (data && Array.isArray(data.results) ? data.results : data);

export const loadOverview = () => (dispatch, getState) => {
    const config = tokenConfig(getState);
    const keys = Object.keys(REQUESTS);
    return Promise.allSettled(keys.map(key => axios.get(REQUESTS[key], config)))
        .then(results => {
            const data = {};
            results.forEach((res, i) => {
                data[keys[i]] = res.status === 'fulfilled' ? unwrap(res.value.data) : null;
            });
            return data;
        });
};
