import React, {Component, Fragment, useState, useEffect} from 'react';
import { createRoot } from 'react-dom/client';
import {
    HashRouter as Router,
    Route,
    Switch,
    Redirect,
    useLocation
} from "react-router-dom";

import Header from "./layout/Header";
import Sidebar from "./layout/Sidebar";
import CommandPalette from "./layout/CommandPalette";
import ThemeBackdrop from "./common/ThemeBackdrop";
import Alerts from "./layout/Alerts";
import {transitions, positions, Provider as AlertProvider} from "react-alert";
import Dashboard from "./ThreatsWatcher/Dashboard";
import Overview from "./Overview/Overview";
import ThreatsWatcherStatisticsPage from "./ThreatsWatcher/StatisticsPage";
import CyberWatchStatisticsPage from "./CyberWatch/StatisticsPage";
import DataLeakStatisticsPage from "./DataLeak/StatisticsPage";
import DnsFinderStatisticsPage from "./DnsFinder/StatisticsPage";
import SiteMonitoringStatisticsPage from "./SiteMonitoring/StatisticsPage";
import LegitimateDomainsStatisticsPage from "./LegitimateDomains/StatisticsPage";
import Login from "./accounts/Login";
import PasswordChange from "./accounts/PasswordChange";
import DataLeakDashboard from './DataLeak/Dashboard'
import SiteMonitoringDashboard from './SiteMonitoring/Dashboard'
import DnsFinderDashboard from './DnsFinder/Dashboard'
import LegitimateDomainsDashboard from './LegitimateDomains/Dashboard';
import CyberWatchDashboard from './CyberWatch/Dashboard';
import ConnectorsDashboard from './Connectors/Dashboard';
import NotFound from './common/NotFound';
import AlertTemplate from "./common/AlertTemplate";
import BulkResultModal from "./common/BulkResultModal";
import BulkProgress from "./common/BulkProgress";

import PrivateRoute from "./common/PrivateRoute";
import Profile from "./accounts/Profile";

import {Provider} from 'react-redux';
import store from "../store";
import {loadUser, loginWithToken} from "../actions/auth";
import {loadConfig} from "../actions/config";
import { ThemeProvider } from '../contexts/ThemeContext';
import GlobalZoomHandler from './common/GlobalZoomHandler';

// Alert Options
const alertOptions = {
    timeout: 3000,
    position: positions.TOP_CENTER,
    transition: transitions.SCALE
};

// Scroll to Top Button
function ScrollToTopButton() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const handleScroll = () => setVisible(window.pageYOffset > 100);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const scrollToTop = () => {
        const duration = 600, start = window.scrollY, startTime = performance.now();
        function animateScroll(now) {
            const progress = Math.min((now - startTime) / duration, 1);
            window.scrollTo(0, start * (1 - progress));
            if (progress < 1) requestAnimationFrame(animateScroll);
        }
        requestAnimationFrame(animateScroll);
    };

    return (
        <button
            onClick={scrollToTop}
            className="btn btn-primary wt-scroll-top shadow-lg"
            style={{ display: visible ? "grid" : "none" }}
            aria-label="Scroll to top"
            title="Scroll to top"
        >
            <i className="material-icons" style={{ fontSize: 24 }}>keyboard_arrow_up</i>
        </button>
    );
}

// Sidebar + top bar around every page except the full-screen login.
function AppShell({ children }) {
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => setSidebarOpen(false), [location.pathname]);

    if (location.pathname === '/login') {
        return <main className="wt-page-layer">{children}</main>;
    }

    return (
        <div className={`wt-shell ${sidebarOpen ? 'wt-sidebar-open' : ''}`}>
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
            <div className="wt-sidebar-scrim" onClick={() => setSidebarOpen(false)} />
            <div className="wt-main">
                <Header onToggleSidebar={() => setSidebarOpen(o => !o)} />
                <main className="container-fluid wt-content">
                    {/* keyed on the path so each page plays the entry transition */}
                    <div key={location.pathname} className="wt-page">
                        {children}
                    </div>
                </main>
            </div>
            <CommandPalette />
        </div>
    );
}

class App extends Component {
    componentDidMount() {
        store.dispatch(loadConfig());
        const params = new URLSearchParams(window.location.search);
        const ssoToken = params.get('sso_token');
        if (window.location.search) {
            window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
        }
        if (ssoToken) {
            store.dispatch(loginWithToken(ssoToken));
        } else {
            store.dispatch(loadUser());
        }
    }

    render() {
        return (
            <Provider store={store}>
                <ThemeProvider>
                    <AlertProvider template={AlertTemplate} {...alertOptions}>
                        <Router>
                            <Fragment>
                                <GlobalZoomHandler />
                                <Alerts/>
                                <BulkProgress/>
                                <BulkResultModal/>
                                <ThemeBackdrop/>
                                <AppShell>
                                    <Switch>
                                        <Route exact path="/" component={Dashboard}/>
                                        <PrivateRoute exact path="/overview" component={Overview}/>
                                        <Route exact path="/threats_watcher/statistics" component={ThreatsWatcherStatisticsPage}/>
                                        <Route exact path="/legitimate_domains/statistics" component={LegitimateDomainsStatisticsPage}/>
                                        <PrivateRoute exact path="/cyber_watch/statistics" component={CyberWatchStatisticsPage}/>
                                        <PrivateRoute exact path="/data_leak/statistics" component={DataLeakStatisticsPage}/>
                                        <PrivateRoute exact path="/dns_finder/statistics" component={DnsFinderStatisticsPage}/>
                                        <PrivateRoute exact path="/website_monitoring/statistics" component={SiteMonitoringStatisticsPage}/>
                                        <Route exact path="/login" component={Login}/>
                                        <PrivateRoute exact path="/password_change" component={PasswordChange}/>
                                        <PrivateRoute exact path="/profile" component={Profile}/>
                                        <Route exact path="/legitimate_domains" component={LegitimateDomainsDashboard}/>
                                        <PrivateRoute exact path="/data_leak" component={DataLeakDashboard}/>
                                        <PrivateRoute exact path="/website_monitoring" component={SiteMonitoringDashboard}/>
                                        <PrivateRoute exact path="/dns_finder" component={DnsFinderDashboard}/>
                                        <PrivateRoute exact path="/cyber_watch" component={CyberWatchDashboard}/>
                                        <PrivateRoute exact path="/connectors" component={ConnectorsDashboard}/>
                                        <Route component={NotFound}/>
                                    </Switch>
                                </AppShell>
                                <ScrollToTopButton />
                            </Fragment>
                        </Router>
                    </AlertProvider>
                </ThemeProvider>
            </Provider>
        );
    }
}

createRoot(document.getElementById('app')).render(<App/>);