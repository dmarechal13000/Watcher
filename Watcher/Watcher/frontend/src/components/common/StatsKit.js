import React, { Component } from 'react';
import PropTypes from 'prop-types';
import preferencesService from '../../services/preferencesService';
import ModuleTabs from './ModuleTabs';
import { CHART_COLORS as C, CHART_INK, token } from './chartTheme';
import { PERIODS, buildBuckets } from './statsUtils';

// Building blocks shared by every module's "Statistics" tab.

export const SEVERITY_HIGH = { faded: 'rgba(232,89,12,0.78)', hover: 'rgba(232,89,12,1)' };
export const GREY = { faded: token('muted', 0.35), hover: token('muted', 0.5) };
export const PURPLE = { faded: 'rgba(133,103,196,0.78)', hover: 'rgba(133,103,196,1)' };
// Categorical order for "top N" breakdowns (identity, not status)
export const CATEGORICAL = [C.primary, C.info, C.success, C.warning, PURPLE, SEVERITY_HIGH, GREY];

const tooltip = { mode: 'index', intersect: false };

export const barOptions = ({ stacked = false, titles = null, legend = false } = {}) => ({
    maintainAspectRatio: false,
    legend: { display: legend, position: 'bottom', labels: { padding: 14 } },
    tooltips: {
        ...tooltip,
        callbacks: titles ? { title: items => (items[0] ? titles[items[0].index] : '') } : undefined,
    },
    scales: {
        xAxes: [{ stacked, gridLines: { display: false }, ticks: { fontColor: CHART_INK.text, maxRotation: 0, autoSkipPadding: 12 } }],
        yAxes: [{ stacked, ticks: { beginAtZero: true, precision: 0, maxTicksLimit: 5, fontColor: CHART_INK.text },
                  gridLines: { color: CHART_INK.grid, borderDash: [2], drawBorder: false } }],
    },
});

export const hbarOptions = {
    maintainAspectRatio: false,
    legend: { display: false },
    tooltips: tooltip,
    layout: { padding: { right: 30 } },
    plugins: { wtLabels: { values: true } },
    scales: {
        xAxes: [{ ticks: { beginAtZero: true, precision: 0, maxTicksLimit: 5, fontColor: CHART_INK.text },
                  gridLines: { color: CHART_INK.grid, borderDash: [2], drawBorder: false } }],
        yAxes: [{ gridLines: { display: false }, ticks: { fontColor: CHART_INK.text } }],
    },
};

export const doughnutOptions = {
    maintainAspectRatio: false,
    legend: { display: true, position: 'right', labels: { padding: 12 } },
    cutoutPercentage: 68,
    plugins: { wtLabels: { centerTotal: true } },
};

// Doughnut options with a custom caption under the centre total ("CVEs", "alerts"...)
export const doughnutWith = (centerLabel) => ({
    ...doughnutOptions,
    plugins: { wtLabels: { centerTotal: true, centerLabel } },
});

// Make a chart clickable: `onPick(index, datasetIndex)` on a bar / slice, pointer cursor on hover.
export const clickable = (options, onPick) => ({
    ...options,
    onClick: (evt, elements) => {
        const el = elements && elements[0];
        if (el) onPick(el._index, el._datasetIndex);
    },
    onHover: (evt, elements) => {
        const target = evt && (evt.native ? evt.native.target : evt.target);
        if (target && target.style) target.style.cursor = elements && elements.length ? 'pointer' : 'default';
    },
});

export const singleBar = (labels, data, label, color = C.primary) => ({
    labels,
    datasets: [{ label, data, backgroundColor: color.faded, hoverBackgroundColor: color.hover, borderWidth: 0 }],
});

export const doughnutData = (labels, data, colors) => ({
    labels,
    datasets: [{
        data,
        backgroundColor: colors.map(c => c.faded),
        hoverBackgroundColor: colors.map(c => c.hover),
    }],
});

export const ChartCard = ({ title, icon, hint, total, children, empty, height = 260, className = '', clickHint }) => (
    <div className={`card wt-chart-card ${className}`}>
        <div className="card-body">
            <div className="wt-chart-head">
                <span className="wt-chart-title">
                    {icon && <i className="material-icons" aria-hidden="true">{icon}</i>}
                    {title}
                    {hint && <i className="material-icons wt-chart-hint" title={hint} aria-label={hint}>info</i>}
                </span>
                <span className="wt-chart-meta">
                    {clickHint && !empty && (
                        <span className="wt-chart-clickhint" title={clickHint}>
                            <i className="material-icons" aria-hidden="true">filter_list</i>
                            Click to filter
                        </span>
                    )}
                    {total !== undefined && total !== null && <span className="wt-chart-total">{total}</span>}
                </span>
            </div>
            <div className="wt-chart-body" style={{ height }}>
                {empty ? (
                    <div className="wt-chart-empty">
                        <i className="material-icons" aria-hidden="true">insert_chart</i>
                        <span>{empty}</span>
                    </div>
                ) : children}
            </div>
        </div>
    </div>
);

ChartCard.propTypes = {
    title: PropTypes.node.isRequired,
    icon: PropTypes.string,
    hint: PropTypes.string,
    total: PropTypes.node,
    children: PropTypes.node,
    empty: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
    height: PropTypes.number,
    className: PropTypes.string,
    clickHint: PropTypes.string,
};

export const Section = ({ title, icon, children }) => (
    <section className="wt-stats-section">
        <h2 className="wt-stats-section-title">
            <i className="material-icons" aria-hidden="true">{icon}</i>
            {title}
        </h2>
        {children}
    </section>
);

Section.propTypes = { title: PropTypes.node.isRequired, icon: PropTypes.string.isRequired, children: PropTypes.node };

export const PeriodPicker = ({ days, onChange }) => (
    <div className="wt-segmented" role="radiogroup" aria-label="Period">
        {PERIODS.map(p => (
            <button
                key={p.days}
                type="button"
                role="radio"
                aria-checked={days === p.days}
                className={days === p.days ? 'is-active' : ''}
                onClick={() => onChange(p.days)}
            >
                {p.label}
            </button>
        ))}
    </div>
);

PeriodPicker.propTypes = { days: PropTypes.number.isRequired, onChange: PropTypes.func.isRequired };

/**
 * Page frame for a module's Statistics tab: module tabs + a period picker remembered per module
 * (user preference `prefKey`). `children` is a function receiving
 * { days, buckets, periodLabel, perBucket } and returning the page body.
 */
export class StatsShell extends Component {
    static propTypes = {
        tabs: PropTypes.array.isRequired,
        prefKey: PropTypes.string.isRequired,
        children: PropTypes.func.isRequired,
        defaultDays: PropTypes.number,
    };

    constructor(props) {
        super(props);
        this.state = { days: this.readSaved(props.defaultDays || 30) };
    }

    componentDidMount() {
        window.addEventListener('watcher:prefs:ready', this.onPrefsReady);
    }

    componentWillUnmount() {
        window.removeEventListener('watcher:prefs:ready', this.onPrefsReady);
    }

    readSaved = (fallback) => {
        const saved = Number(preferencesService.get(this.props.prefKey, fallback));
        return PERIODS.some(p => p.days === saved) ? saved : fallback;
    };

    onPrefsReady = () => this.setState(s => ({ days: this.readSaved(s.days) }));

    setPeriod = (days) => {
        this.setState({ days });
        preferencesService.set(this.props.prefKey, days);
    };

    render() {
        const { days } = this.state;
        const buckets = buildBuckets(days);
        return (
            <div className="wt-stats-page">
                <ModuleTabs tabs={this.props.tabs} extra={<PeriodPicker days={days} onChange={this.setPeriod} />} />
                {this.props.children({
                    days,
                    buckets,
                    periodLabel: `last ${days} days`,
                    perBucket: buckets.weekly ? 'per week' : 'per day',
                })}
            </div>
        );
    }
}

// Tabs of a module: Surveillance on its base path, Statistics on `${base}/statistics`.
export const moduleTabs = (base) => [
    { to: base, label: 'Surveillance', icon: 'visibility' },
    { to: `${base}/statistics`, label: 'Statistics', icon: 'insert_chart' },
];
