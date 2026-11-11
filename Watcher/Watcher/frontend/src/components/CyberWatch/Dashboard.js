import React, { Component, Fragment } from 'react';
import WatchRules from './WatchRules';
import MonitoredKeywordsPanel from './MonitoredKeywordsPanel';
import SourcesPanel from './SourcesPanel';
import BannedWordsPanel from './BannedWordsPanel';
import ArchivedAlerts from './ArchivedAlerts';
import PanelGrid from '../common/PanelGrid';
import { LAYOUT_PRESETS } from '../../config/layoutPresets';
import ModuleTabs from '../common/ModuleTabs';
import { CYBER_WATCH_TABS, CyberSurveillanceKpis } from './StatisticsPage';

const DEFAULT_LAYOUT = [
    { i: 'monitored', x: 0, y: 4,  w: 6,  h: 11, minW: 4, minH: 5 },
    { i: 'watchrules',x: 6, y: 4,  w: 6,  h: 11, minW: 4, minH: 5 },
    { i: 'sources',   x: 0, y: 15, w: 6,  h: 11, minW: 4, minH: 5 },
    { i: 'banned',    x: 6, y: 15, w: 6,  h: 11, minW: 4, minH: 5 },
    { i: 'archived',  x: 0, y: 26, w: 12, h: 12, minW: 4, minH: 6 },
];

const DEFAULT_ACTIVE = ['monitored', 'watchrules', 'sources', 'banned', 'archived'];

class CyberWatchDashboard extends Component {
    buildPanels() {
        return {
            monitored: {
                label: 'Monitored Keywords',
                icon: 'track_changes',
                tooltip: 'Manage keywords tracked across all RSS feed articles',
                children: (
                    <div style={{ padding: '12px 16px', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <MonitoredKeywordsPanel />
                    </div>
                ),
            },
            watchrules: {
                label: 'Watch Rules',
                icon: 'visibility',
                tooltip: 'Configure rules to match CVEs and ransomware events',
                children: (
                    <div style={{ padding: '12px 16px', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <WatchRules />
                    </div>
                ),
            },
            sources: {
                label: 'Sources',
                icon: 'rss_feed',
                tooltip: 'Manage RSS feed sources monitored for threats',
                children: (
                    <div style={{ padding: '12px 16px', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <SourcesPanel />
                    </div>
                ),
            },
            banned: {
                label: 'Banned Words',
                icon: 'block',
                tooltip: 'Words excluded from trending detection',
                children: (
                    <div style={{ padding: '12px 16px', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <BannedWordsPanel />
                    </div>
                ),
            },
            archived: {
                label: 'Archived Alerts',
                icon: 'inventory',
                tooltip: 'CVE alerts and ransomware victims that have been archived',
                children: (
                    <div style={{ padding: '12px 16px', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <ArchivedAlerts />
                    </div>
                ),
            },
        };
    }

    render() {
        return (
            <Fragment>
                <ModuleTabs tabs={CYBER_WATCH_TABS} />
                <CyberSurveillanceKpis />
                <PanelGrid
                    panels={this.buildPanels()}
                    defaultLayout={DEFAULT_LAYOUT}
                    defaultActive={DEFAULT_ACTIVE}
                    storageKey="watcher_cyber_watch_grid"
                    layoutPresets={LAYOUT_PRESETS['watcher_cyber_watch_grid']}
                />
            </Fragment>
        );
    }
}

export default CyberWatchDashboard;

