import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import axios from 'axios';
import preferencesService from '../../services/preferencesService';

// "Getting started" card on the Overview: the setup steps a fresh instance needs before the
// modules produce anything. Hidden once every step is done, or when the user dismisses it.

const DISMISS_PREF = 'onboarding_dismissed';
const DOCS = 'https://thalesgroup-cert.github.io/Watcher/';
// Connectors that deliver detections somewhere (ticketing, chat, mail)
const OUTBOUND = ['thehive', 'misp', 'slack', 'citadel', 'smtp'];

const count = value => (typeof value === 'number' && isFinite(value) ? value : 0);

function buildSteps(d, connectors) {
    const tw = d.threatsStats || {};
    const dns = d.dnsStats || {};
    const steps = [
        {
            key: 'sources',
            icon: 'rss_feed',
            title: 'Load the RSS sources',
            done: count(tw.totalSources) > 0,
            detail: count(tw.totalSources) > 0
                ? `${count(tw.totalSources)} sources feeding Threats Watcher`
                : <>Run <code>python manage.py populate_db</code> to seed the default CERT feeds and banned words</>,
            href: '/admin/threats_watcher/source/',
            action: 'Manage sources',
        },
        {
            key: 'words',
            icon: 'radar',
            title: 'Collect the first trending words',
            done: count(tw.totalWords) > 0,
            detail: count(tw.totalWords) > 0
                ? `${count(tw.totalWords)} words collected so far`
                : 'The RSS job runs every 30 minutes once sources exist',
            to: '/',
            action: 'Open Threats Watcher',
        },
        {
            key: 'keywords',
            icon: 'notifications_active',
            title: 'Watch keywords that matter to you',
            done: count(tw.monitoredKeywords) > 0,
            detail: 'Monitored keywords raise alerts as soon as they trend',
            to: '/',
            action: 'Add keywords',
        },
        {
            key: 'leaks',
            icon: 'policy',
            title: 'Add data leak search patterns',
            done: count(d.dataLeakStats?.totalKeywords) > 0,
            detail: 'Company names, domains or code names searched across paste sites and code hosts',
            to: '/data_leak',
            action: 'Add patterns',
        },
        {
            key: 'dns',
            icon: 'dns',
            title: 'Monitor your domains for look-alikes',
            done: count(dns.totalDnsMonitored) + count(dns.totalKeywords) > 0,
            detail: 'Domains for dnstwist permutations, keywords for Certificate Transparency',
            to: '/dns_finder',
            action: 'Add domains',
        },
        {
            key: 'legit',
            icon: 'verified_user',
            title: 'Register your legitimate domains',
            done: count(d.legitStats?.total) > 0,
            detail: 'Tracks expiry and RDAP changes of the domains you own',
            to: '/legitimate_domains',
            action: 'Add domains',
        },
    ];
    if (connectors) {
        const ready = connectors.filter(c => OUTBOUND.includes(c.id) && c.status === 'configured');
        steps.push({
            key: 'connectors',
            icon: 'hub',
            title: 'Connect an alert destination',
            done: ready.length > 0,
            detail: ready.length > 0
                ? `Alerts go to ${ready.map(c => c.name).join(', ')}`
                : 'TheHive, MISP, Slack, Citadel or email, so detections reach your team',
            to: '/connectors',
            action: 'Configure',
        });
    }
    return steps;
}

const OnboardingChecklist = ({ data, isSuperuser, token }) => {
    const [dismissed, setDismissed] = useState(() => !!preferencesService.get(DISMISS_PREF, false));
    const [connectors, setConnectors] = useState(null);
    const [open, setOpen] = useState(true);

    useEffect(() => {
        const onReady = () => setDismissed(!!preferencesService.get(DISMISS_PREF, false));
        window.addEventListener('watcher:prefs:ready', onReady);
        return () => window.removeEventListener('watcher:prefs:ready', onReady);
    }, []);

    useEffect(() => {
        if (!isSuperuser || dismissed) return;
        axios.get('/api/connectors/', { headers: { Authorization: `Token ${token}` } })
            .then(res => setConnectors(Array.isArray(res.data) ? res.data : []))
            .catch(() => setConnectors(null));
    }, [isSuperuser, dismissed, token]);

    if (dismissed || !data) return null;

    const steps = buildSteps(data, isSuperuser ? connectors : null);
    const done = steps.filter(s => s.done).length;
    if (done === steps.length) return null;
    const next = steps.find(s => !s.done);

    const dismiss = () => {
        setDismissed(true);
        preferencesService.set(DISMISS_PREF, true);
    };

    return (
        <section className="card wt-onboard" aria-label="Getting started">
            <div className="card-body">
                <div className="wt-onboard-head">
                    <div className="wt-onboard-ring" style={{ '--wt-progress': done / steps.length }}>
                        <span>{done}/{steps.length}</span>
                    </div>
                    <div className="wt-onboard-intro">
                        <h2>Get Watcher ready</h2>
                        <p>{steps.length - done} step{steps.length - done > 1 ? 's' : ''} left before every module is watching for you.</p>
                    </div>
                    <div className="wt-onboard-tools">
                        <a href={DOCS} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary wt-btn-ghost">
                            <i className="material-icons" aria-hidden="true">menu_book</i> Docs
                        </a>
                        <button type="button" className="btn btn-sm btn-secondary wt-btn-ghost" onClick={() => setOpen(o => !o)} aria-expanded={open}>
                            <i className="material-icons" aria-hidden="true">{open ? 'expand_less' : 'expand_more'}</i>
                        </button>
                        <button type="button" className="btn-close" aria-label="Hide the checklist" title="Hide the checklist" onClick={dismiss} />
                    </div>
                </div>

                {open && (
                    <ol className="wt-onboard-steps">
                        {steps.map(step => {
                            const isNext = step === next;
                            const cta = step.href
                                ? <a href={step.href} className={`btn btn-sm ${isNext ? 'btn-primary' : 'btn-secondary wt-btn-soft'}`}>{step.action}</a>
                                : <Link to={step.to} className={`btn btn-sm ${isNext ? 'btn-primary' : 'btn-secondary wt-btn-soft'}`}>{step.action}</Link>;
                            return (
                                <li key={step.key} className={`wt-onboard-step ${step.done ? 'is-done' : ''} ${isNext ? 'is-next' : ''}`}>
                                    <span className="wt-onboard-check" aria-hidden="true">
                                        <i className="material-icons">{step.done ? 'check' : step.icon}</i>
                                    </span>
                                    <div className="wt-onboard-text">
                                        <strong>{step.title}</strong>
                                        <span>{step.detail}</span>
                                    </div>
                                    {step.done
                                        ? <span className="wt-onboard-done">Done</span>
                                        : (step.href && !isSuperuser ? null : cta)}
                                </li>
                            );
                        })}
                    </ol>
                )}
            </div>
        </section>
    );
};

OnboardingChecklist.propTypes = {
    data: PropTypes.object,
    isSuperuser: PropTypes.bool,
    token: PropTypes.string,
};

export default OnboardingChecklist;
