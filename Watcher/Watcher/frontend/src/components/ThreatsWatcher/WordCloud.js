import React, {Component, Fragment} from 'react';

import 'd3-transition';
import {select} from 'd3-selection';
import ReactWordcloud from 'react-wordcloud';
import PropTypes from "prop-types";
import {connect} from "react-redux";
import {getLeads, getMonitoredKeywords} from "../../actions/leads";

// Read the active theme's colours from its Bootstrap CSS variables (not from a rendered element,
// whose styling can differ: badges are soft pills in watcher-modern.css). Re-read on every render
// so a theme switch is picked up without reloading the page.
const themeColor = (name, fallback) => {
    const value = window.getComputedStyle(document.documentElement).getPropertyValue(`--bs-${name}`).trim();
    return value || fallback;
};

const readThemeColors = () => ({
    success: themeColor('success', '#28a745'),
    warning: themeColor('warning', '#ffc107'),
    danger:  themeColor('danger', '#dc3545'),
    primary: themeColor('primary', '#4e73df'),
    muted:   themeColor('secondary-color', '#9e9e9e'),
});

// Reliability buckets (same thresholds as the Word List score badge)
const scoreBucket = score => {
    if (score === null || score === undefined || isNaN(score)) return 'none';
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
};

const LEGEND = [
    { key: 'high',   label: 'High reliability',   hint: 'score 70% and above', color: 'success' },
    { key: 'medium', label: 'Medium',             hint: 'score 40 to 69%',     color: 'warning' },
    { key: 'low',    label: 'Low',                hint: 'score below 40%',     color: 'danger' },
    { key: 'none',   label: 'Not scored',         hint: 'no reliability score yet', color: 'muted' },
];

// Font sizes follow the area actually available, so big words never overflow a small panel
const fontSizesFor = ({ width, height }, count) => {
    const side = Math.sqrt(Math.max(width, 1) * Math.max(height, 1));
    const crowd = Math.min(1, Math.max(0.75, 1.2 - count / 220));
    const max = Math.round(Math.min(90, Math.max(26, (side / 6.5) * crowd)));
    const min = Math.round(Math.min(18, Math.max(11, side / 36)));
    return [min, Math.max(min + 8, max)];
};

const options = {
    enableTooltip: true,
    deterministic: true,
    fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
    fontSizes: [20, 90],
    fontStyle: 'normal',
    fontWeight: '600',
    padding: 3,
    rotations: 1,
    rotationAngles: [0, 90],
    scale: 'sqrt',
    spiral: 'archimedean',
    transitionDuration: 650,
};

export class WordCloud extends Component {

    constructor(props) {
        super(props);
        this.state = {
            key: 0,
            canvas: null,
        };
        this.colors = readThemeColors();
        this.containerRef = React.createRef();
        this.resizeTimeout = null;
        this._selectedEl = null;
        this._canvasObserver = null;
    }

    // The cloud is laid out for the exact size of its area (panel minus legend) and redrawn
    // when the panel is resized, instead of a height guessed from the number of words.
    setCanvasEl = (el) => {
        if (this._canvasObserver) {
            this._canvasObserver.disconnect();
            this._canvasObserver = null;
        }
        if (!el || typeof ResizeObserver === 'undefined') return;
        this._canvasObserver = new ResizeObserver(([entry]) => {
            const width = Math.floor(entry.contentRect.width);
            const height = Math.floor(entry.contentRect.height);
            if (width < 40 || height < 40) return;
            const prev = this.state.canvas;
            if (prev && Math.abs(prev.width - width) < 8 && Math.abs(prev.height - height) < 8) return;
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(() => {
                this.setState(state => ({ canvas: { width, height }, key: state.key + 1 }));
            }, prev ? 180 : 0);
        });
        this._canvasObserver.observe(el);
    };

    static propTypes = {
        leads: PropTypes.array.isRequired,
        monitoredKeywords: PropTypes.array,
        filteredData: PropTypes.array,
        fromSourceFilter: PropTypes.string,
        getLeads: PropTypes.func.isRequired,
        getMonitoredKeywords: PropTypes.func.isRequired,
        selectedWord: PropTypes.string,
    };

    componentDidMount() {
        this.props.getLeads();
        this.props.getMonitoredKeywords();
    }

    componentDidUpdate(prevProps, prevState) {
        // The cloud is rebuilt when its key changes: old SVG nodes are gone, so drop the
        // selection and re-apply the current one once the new words are laid out.
        if (prevState.key !== this.state.key) {
            this._markSelected(null);
            if (this.props.selectedWord) {
                const word = this.props.selectedWord;
                setTimeout(() => this._applyExternalSelection(word), 60);
            }
        }

        const prevDataLength = prevProps.filteredData ? prevProps.filteredData.length : prevProps.leads.length;
        const currentDataLength = this.props.filteredData ? this.props.filteredData.length : this.props.leads.length;
        
        if (prevDataLength !== currentDataLength) {
            if (this.resizeTimeout) {
                clearTimeout(this.resizeTimeout);
            }

            this.setState({ key: this.state.key + 1 });

            this.resizeTimeout = setTimeout(() => {
                this.setState(prevState => ({
                    key: prevState.key + 1
                }));
            }, 150);
        }

        if (prevProps.selectedWord !== this.props.selectedWord) {
            const newWord = this.props.selectedWord;

            // If the clicked element in the cloud already matches, the click handler already
            // applied the halo - skip clearing to avoid flickering.
            const currentText = this._selectedEl
                ? this._selectedEl.textContent.replace(/\*$/, '').toLowerCase().trim()
                : null;
            if (newWord && currentText === newWord.toLowerCase().trim()) return;

            // Clear old selection
            if (this._selectedEl) {
                this._markSelected(null);
            }
            // Apply from external selection (e.g. WordList click)
            if (newWord) {
                requestAnimationFrame(() => this._applyExternalSelection(newWord));
            }
        }
    }

    // The cloud lays its words out asynchronously: retry for a moment until the word is drawn.
    _applyExternalSelection = (word, attempt = 0) => {
        if (!this.containerRef.current || !word) return;
        const needle = word.toLowerCase().trim();
        this.containerRef.current.querySelectorAll('text').forEach(el => {
            const text = el.textContent.replace(/\*$/, '').toLowerCase().trim();
            if (text === needle && !this._selectedEl) {
                this._markSelected(el);
            }
        });
        if (!this._selectedEl && attempt < 25 && this.props.selectedWord === word) {
            this._selectionRetry = setTimeout(() => this._applyExternalSelection(word, attempt + 1), 200);
        }
    };

    _markSelected = (el) => {
        if (this._selectedEl && this._selectedEl !== el) {
            select(this._selectedEl).classed('wt-cloud-selected', false);
        }
        this._selectedEl = el;
        if (el) select(el).classed('wt-cloud-selected', true);
        if (this.containerRef.current) {
            this.containerRef.current.classList.toggle('wt-cloud-has-selection', !!el);
        }
    };

    componentWillUnmount() {
        clearTimeout(this._selectionRetry);
        if (this._canvasObserver) this._canvasObserver.disconnect();
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }
    }

    getMonitoredInfo = (wordText) => {
        const { monitoredKeywords = [] } = this.props;
        const cleanText = wordText.replace(/\*$/, '');
        return monitoredKeywords.find(mk =>
            mk.name.toLowerCase() === cleanText.toLowerCase() && mk.last_seen
        ) || null;
    };

    getCallback = (callback) => {
        return (word, event) => {
            const isActive = callback !== 'onWordMouseOut';
            const element = event.target;
            const text = select(element);
            text
                .on('click', () => {
                    if (isActive) {
                        const dataToUse = this.props.filteredData || this.props.leads;
                        const { monitoredKeywords = [] } = this.props;
                        const cleanName = word.text.replace(/\*$/, '');

                        this._markSelected(element);

                        // Trigger postUrls update - fall back to monitored keyword posturls if the lead has none
                        const lead = dataToUse.find(l => l.name === cleanName);
                        let posturls = lead ? (lead.posturls || []) : null;
                        if (!posturls || posturls.length === 0) {
                            const mk = monitoredKeywords.find(m => m.name.toLowerCase() === cleanName.toLowerCase() && m.last_seen);
                            if (mk) posturls = mk.posturls || [];
                        }
                        if (this.props.setPostUrls) this.props.setPostUrls(posturls || [], cleanName);
                    }
                })
                .transition()
                .attr('font-weight', isActive ? '750' : options.fontWeight);
        };
    };

    leadScore = lead => (lead && lead.score !== undefined && lead.score !== null ? Number(lead.score) : null);

    renderLegend(words, hasMonitored) {
        const dataToUse = this.props.filteredData || this.props.leads;
        const byName = new Map(dataToUse.map(l => [l.name, l]));
        const counts = { high: 0, medium: 0, low: 0, none: 0 };
        words.forEach(w => { counts[scoreBucket(this.leadScore(byName.get(w.text.replace(/\*$/, ''))))]++; });

        return (
            <div className="wt-cloud-legend" aria-label="Word colour legend">
                {LEGEND.filter(item => item.key !== 'none' || counts.none > 0).map(item => (
                    <span key={item.key} className="wt-cloud-legend-item" title={`${item.label}: ${item.hint}`}>
                        <span className="wt-cloud-swatch" style={{ background: this.colors[item.color] }} />
                        {item.label}
                        <span className="wt-cloud-count">{counts[item.key]}</span>
                    </span>
                ))}
                {hasMonitored && (
                    <span className="wt-cloud-legend-item" title="Words ending with * are monitored keywords">
                        <span className="wt-cloud-star">*</span>
                        Monitored keyword
                    </span>
                )}
            </div>
        );
    }

    callbacks = {
        getWordTooltip: word => {
            const mk = this.getMonitoredInfo(word.text);
            if (mk) {
                return `Monitored - Level: ${mk.level_display || mk.level} - ${mk.occurrences} occurrences\nCaught ${word.value} times.`;
            }
            return `The word "${word.text}" caught ${word.value} times.`;
        },
        onWordClick: this.getCallback('onWordClick'),
        onWordMouseOut: this.getCallback('onWordMouseOut'),
        onWordMouseOver: this.getCallback('onWordMouseOver'),
        getWordColor: word => {
            const dataToUse = this.props.filteredData || this.props.leads;
            const lead = dataToUse.find(l => l.name === word.text.replace(/\*$/, ''));
            return this.colors[LEGEND.find(l => l.key === scoreBucket(this.leadScore(lead))).color];
        }
    };

    render() {
        this.colors = readThemeColors();
        const dataToUse = this.props.filteredData || this.props.leads;
        const { monitoredKeywords = [] } = this.props;
        const { fromSourceFilter } = this.props;

        // Build a set of monitored keyword names that have been seen (last_seen != null)
        const monitoredSeen = new Set(
            monitoredKeywords
                .filter(mk => mk.last_seen)
                .map(mk => mk.name.toLowerCase())
        );

        const words = dataToUse.map(lead => {
            const isMonitored = monitoredSeen.has(lead.name.toLowerCase());
            return {
                text: isMonitored ? `${lead.name}*` : lead.name,
                value: lead.occurrences,
            };
        });

        if (fromSourceFilter !== 'trendy_words') {
            const existingNames = new Set(dataToUse.map(l => l.name.toLowerCase()));
            monitoredKeywords
                .filter(mk => mk.last_seen && !existingNames.has(mk.name.toLowerCase()))
                .forEach(mk => words.push({ text: `${mk.name}*`, value: 1 }));
        }

        if (words.length === 0) {
            return (
                <div className="d-flex align-items-center justify-content-center h-100 text-muted">
                    <div className="text-center py-4">
                        <i className="material-icons d-block mb-2" style={{ fontSize: '2.5rem', opacity: 0.25 }}>cloud</i>
                        <div className="fw-semibold mb-1">No data yet</div>
                        <small>Words will appear here once Watcher collects threat intelligence</small>
                    </div>
                </div>
            );
        }

        return (
            <Fragment>
                <div 
                    ref={this.containerRef} 
                    className="wt-cloud"
                    style={{ width: '100%', height: '100%', minHeight: '200px', overflow: 'hidden' }}
                >
                    <div className="wt-cloud-canvas" ref={this.setCanvasEl}>
                        {this.state.canvas && (
                            <ReactWordcloud
                                key={this.state.key}
                                options={{ ...options, fontSizes: fontSizesFor(this.state.canvas, words.length) }}
                                callbacks={this.callbacks}
                                words={words}
                                size={[this.state.canvas.width, this.state.canvas.height]}
                            />
                        )}
                    </div>
                    {this.renderLegend(words, words.some(w => w.text.endsWith('*')))}
                </div>
            </Fragment>
        )
    }
}

const mapStateToProps = state => ({
    leads: state.leads.leads,
    monitoredKeywords: state.leads.monitoredKeywords
});

export default connect(mapStateToProps, {getLeads, getMonitoredKeywords})(WordCloud);