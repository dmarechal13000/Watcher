// Routes of the Threats Watcher views (see common/ModuleTabs).
export const THREATS_WATCHER_STATS_PATH = '/threats_watcher/statistics';

export const THREATS_WATCHER_TABS = [
    { to: '/',                        label: 'Surveillance', icon: 'visibility' },
    { to: THREATS_WATCHER_STATS_PATH, label: 'Statistics',   icon: 'insert_chart' },
];
