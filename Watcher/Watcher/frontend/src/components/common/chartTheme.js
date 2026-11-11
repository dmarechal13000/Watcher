import Chart from 'chart.js';

// Theme-aware colours for Chart.js.
//
// Charts describe colours with tokens ("wt:<name>:<alpha>") instead of fixed hex values.
// ThemedCharts resolves the tokens against the active theme's Bootstrap CSS variables at
// draw time, so the same chart follows every Bootswatch theme (and redraws on theme change).

const TOKEN = /^wt:([a-z-]+):([\d.]+)$/;

// Names map to the theme's "--bs-<name>-rgb" variables; a few semantic aliases on top.
const ALIASES = {
    ink:     'body-color',   // text-strength marks
    muted:   'body-color',   // axis labels, legends (used with a low alpha)
    surface: 'body-bg',      // separators between filled segments
};

export const token = (name, alpha = 1) => `wt:${name}:${alpha}`;

const readRgb = name => {
    const value = window.getComputedStyle(document.documentElement)
        .getPropertyValue(`--bs-${ALIASES[name] || name}-rgb`).trim();
    return value || null;
};

export const resolveColor = value => {
    if (typeof value !== 'string') return value;
    const m = TOKEN.exec(value);
    if (!m) return value;
    const rgb = readRgb(m[1]);
    return rgb ? `rgba(${rgb}, ${m[2]})` : 'rgba(128, 128, 128, 0.6)';
};

// Deep-resolve tokens in chart data / options (functions and non-plain objects pass through).
export const resolveTokens = value => {
    if (typeof value === 'string') return resolveColor(value);
    if (Array.isArray(value)) return value.map(resolveTokens);
    if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
        const out = {};
        Object.keys(value).forEach(k => { out[k] = resolveTokens(value[k]); });
        return out;
    }
    return value;
};

const swatch = name => ({ solid: token(name, 1), faded: token(name, 0.78), hover: token(name, 1) });

// Drop-in replacement for the per-module `C` palettes.
export const CHART_COLORS = {
    primary:   swatch('primary'),
    success:   swatch('success'),
    info:      swatch('info'),
    warning:   swatch('warning'),
    danger:    swatch('danger'),
    secondary: { solid: token('muted', 0.55), faded: token('muted', 0.4), hover: token('muted', 0.6) },
    dark:      { solid: token('muted', 0.75), faded: token('muted', 0.6), hover: token('muted', 0.8) },
};

// Axis / legend ink and gridlines: recessive, derived from the text colour.
export const CHART_INK = {
    text: token('muted', 0.68),
    grid: token('muted', 0.1),
};

// Global Chart.js defaults for the active theme. Called by ThemedCharts before drawing.
let appliedFor = null;
export const applyChartDefaults = version => {
    installChartFinish();
    if (appliedFor === version) return;
    appliedFor = version;
    const g = Chart.defaults.global;
    g.defaultFontFamily = getComputedStyle(document.body).fontFamily || g.defaultFontFamily;
    g.defaultFontColor = resolveColor(CHART_INK.text);
    g.legend.labels.usePointStyle = true;
    g.legend.labels.boxWidth = 8;
    g.tooltips.backgroundColor = 'rgba(20, 20, 22, 0.92)';
    g.tooltips.titleFontStyle = '600';
    g.tooltips.cornerRadius = 8;
    g.tooltips.xPadding = 10;
    g.tooltips.yPadding = 8;
    g.tooltips.caretSize = 5;
    g.tooltips.displayColors = true;
    g.elements.arc.borderColor = resolveColor(token('surface', 1));
    g.elements.arc.borderWidth = 2;
    g.elements.line.borderWidth = 2;
    g.elements.point.radius = 0;
    g.elements.point.hoverRadius = 4;
    g.elements.point.hitRadius = 10;
    if (g.datasets && g.datasets.bar) g.datasets.bar.maxBarThickness = 28;
    Chart.defaults.scale.gridLines.color = resolveColor(CHART_INK.grid);
    Chart.defaults.scale.gridLines.zeroLineColor = resolveColor(token('muted', 0.2));
};

// ---------------------------------------------------------------- finishing touches (installed once)
//
// 1. Bars: rounded data-end (4px), anchored square on the baseline; in stacked bars only the
//    top segment is rounded and segments are separated by a 2px gap.
// 2. "wtLabels" plugin, opt-in per chart through options.plugins.wtLabels:
//    - values: true      -> value printed at the end of each horizontal bar
//    - centerTotal: true -> total printed in the middle of a doughnut (centerLabel: caption)

const isStacked = chart => {
    const scales = chart.options.scales || {};
    return !!(((scales.xAxes || [])[0] || {}).stacked || ((scales.yAxes || [])[0] || {}).stacked);
};

const isTopOfStack = el => {
    const chart = el._chart;
    if (!chart || !isStacked(chart)) return true;
    const datasets = chart.data.datasets || [];
    for (let d = el._datasetIndex + 1; d < datasets.length; d++) {
        if (chart.isDatasetVisible(d) && Number(datasets[d].data[el._index])) return false;
    }
    return true;
};

const roundedBarPath = (ctx, left, top, right, bottom, r, vertical, positive) => {
    ctx.beginPath();
    if (r <= 0) {
        ctx.rect(left, top, right - left, bottom - top);
        return;
    }
    if (vertical && positive) {
        ctx.moveTo(left, bottom);
        ctx.lineTo(left, top + r);
        ctx.quadraticCurveTo(left, top, left + r, top);
        ctx.lineTo(right - r, top);
        ctx.quadraticCurveTo(right, top, right, top + r);
        ctx.lineTo(right, bottom);
    } else if (vertical) {
        ctx.moveTo(left, top);
        ctx.lineTo(right, top);
        ctx.lineTo(right, bottom - r);
        ctx.quadraticCurveTo(right, bottom, right - r, bottom);
        ctx.lineTo(left + r, bottom);
        ctx.quadraticCurveTo(left, bottom, left, bottom - r);
    } else if (positive) {
        ctx.moveTo(left, top);
        ctx.lineTo(right - r, top);
        ctx.quadraticCurveTo(right, top, right, top + r);
        ctx.lineTo(right, bottom - r);
        ctx.quadraticCurveTo(right, bottom, right - r, bottom);
        ctx.lineTo(left, bottom);
    } else {
        ctx.moveTo(right, top);
        ctx.lineTo(right, bottom);
        ctx.lineTo(left + r, bottom);
        ctx.quadraticCurveTo(left, bottom, left, bottom - r);
        ctx.lineTo(left, top + r);
        ctx.quadraticCurveTo(left, top, left + r, top);
    }
    ctx.closePath();
};

function drawRoundedBar() {
    const vm = this._view;
    const ctx = this._chart.ctx;
    const vertical = vm.width !== undefined;
    let left; let right; let top; let bottom;
    if (vertical) {
        const half = vm.width / 2;
        left = vm.x - half; right = vm.x + half;
        top = Math.min(vm.y, vm.base); bottom = Math.max(vm.y, vm.base);
    } else {
        const half = vm.height / 2;
        top = vm.y - half; bottom = vm.y + half;
        left = Math.min(vm.x, vm.base); right = Math.max(vm.x, vm.base);
    }
    const positive = vertical ? vm.y <= vm.base : vm.x >= vm.base;
    const topOfStack = isTopOfStack(this);
    if (!topOfStack) {
        if (vertical) { if (positive) top += 2; else bottom -= 2; }
        else if (positive) right -= 2; else left += 2;
    }
    const w = right - left;
    const h = bottom - top;
    if (w <= 0 || h <= 0) return;
    const r = topOfStack ? Math.min(4, w / 2, h / 2) : 0;
    ctx.save();
    ctx.fillStyle = vm.backgroundColor;
    roundedBarPath(ctx, left, top, right, bottom, r, vertical, positive);
    ctx.fill();
    ctx.restore();
}

const labelsPlugin = {
    id: 'wtLabels',
    afterDatasetsDraw(chart, easing, opts) {
        if (!opts || (!opts.values && !opts.centerTotal)) return;
        const ctx = chart.ctx;
        const family = Chart.defaults.global.defaultFontFamily;
        const ink = resolveColor(token('ink', 0.9));
        const muted = resolveColor(CHART_INK.text);
        ctx.save();

        if (opts.values && chart.config.type === 'horizontalBar') {
            ctx.font = `600 11px ${family}`;
            ctx.textBaseline = 'middle';
            chart.data.datasets.forEach((dataset, d) => {
                if (!chart.isDatasetVisible(d)) return;
                chart.getDatasetMeta(d).data.forEach((el, i) => {
                    const value = dataset.data[i];
                    if (!value || !el._view) return;
                    const text = Number(value).toLocaleString();
                    const width = ctx.measureText(text).width;
                    const x = el._view.x + 6;
                    if (x + width > chart.chartArea.right + 30) {
                        ctx.fillStyle = '#fff';
                        ctx.textAlign = 'right';
                        ctx.fillText(text, el._view.x - 6, el._view.y);
                    } else {
                        ctx.fillStyle = ink;
                        ctx.textAlign = 'left';
                        ctx.fillText(text, x, el._view.y);
                    }
                });
            });
        }

        if (opts.centerTotal && (chart.config.type === 'doughnut' || chart.config.type === 'pie')) {
            const meta = chart.getDatasetMeta(0);
            const data = (chart.data.datasets[0] || {}).data || [];
            const total = data.reduce((s, v, i) => s + ((meta.data[i] && meta.data[i].hidden) ? 0 : Number(v) || 0), 0);
            const area = chart.chartArea;
            const cx = (area.left + area.right) / 2;
            const cy = (area.top + area.bottom) / 2;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = ink;
            ctx.font = `700 22px ${family}`;
            ctx.fillText(total.toLocaleString(), cx, cy - 7);
            ctx.fillStyle = muted;
            ctx.font = `500 11px ${family}`;
            ctx.fillText(opts.centerLabel || 'total', cx, cy + 13);
        }
        ctx.restore();
    },
};

let finishInstalled = false;
export const installChartFinish = () => {
    if (finishInstalled) return;
    finishInstalled = true;
    Chart.elements.Rectangle.prototype.draw = drawRoundedBar;
    Chart.plugins.register(labelsPlugin);
};
