import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { getWordSummary, generateWordSummary, getSummaryConfig, regenerateWordSummary } from "../../actions/Common";
import { createMessage } from "../../actions/messages"

function formatDate(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleString("en-GB", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function convertTextToHTML(text) {
    if (!text) return "";
    let html = text.replace(
        /(CVE-\d{4}-\d{4,7})\s*\((https:\/\/[^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer" class="cve-link">$1</a>'
    );
    html = html.replace(/\n/g, "<br/>");
    html = html.replace(/  /g, " &nbsp;");
    return html;
}

const WordSummary = ({ word, getWordSummary, generateWordSummary, typewriterEnabled, createMessage, getSummaryConfig, regenerateWordSummary }) => {
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [errorType, setErrorType] = useState(null);
    const [displayHTML, setDisplayHTML] = useState("");
    const [typing, setTyping] = useState(false);
    const [postsCount, setPostsCount] = useState(0);
    const [isRegenerating, setIsRegenerating] = useState(false);

    const [cooldownMinutes, setCooldownMinutes] = useState(15);
    const [currentTime, setCurrentTime] = useState(Date.now());

    useEffect(() => {
        getSummaryConfig()
            .then(data => {
                if (data.regenerate_cooldown_minutes !== undefined) {
                    setCooldownMinutes(data.regenerate_cooldown_minutes);
                }
            })
            .catch(err => console.error("Error fetching config:", err));

        const interval = setInterval(() => setCurrentTime(Date.now()), 10000);
        return () => clearInterval(interval);
    }, []);

    const handleRegenerate = async () => {
        setIsRegenerating(true);
        try {
            const data = await regenerateWordSummary(word);
            if (data.success && data.data) {
                setSummary(data.data);
                setCurrentTime(Date.now());
            }
        } catch (err) {
            if (err.response) {
                createMessage({ error: "Regeneration failed: " + (err.response.data?.message || err.response.statusText) });
            } else {
                console.error("Network error :", err);
                createMessage({ error: "Network error during regeneration." });
            }
        } finally {
            setIsRegenerating(false);
        }
    };

    useEffect(() => {
        if (!summary?.summary_text) {
            setDisplayHTML("");
            return;
        }

        if (!typewriterEnabled) {
            setDisplayHTML(convertTextToHTML(summary.summary_text));
            setTyping(false);
            return;
        }
        
        const text = summary.summary_text;
        // Tuning: 3 = max characters per tick (lower = more like real typing, 1 = character by character), 4000 = target duration in ms (higher = calmer display)
        const step = Math.min(3, Math.max(1, Math.ceil(text.length / (4000 / 12))));
        let i = 0;
        let timeoutId;
        function write() {
            i = Math.min(text.length, i + step);
            setDisplayHTML(convertTextToHTML(text.slice(0, i)));
            if (i < text.length) {
                timeoutId = setTimeout(write, 12);
            } else {
                setTyping(false);
            }
        }
        setTyping(true);
        setDisplayHTML("");
        write();
        return () => clearTimeout(timeoutId);
    }, [summary?.summary_text, typewriterEnabled]);

    useEffect(() => {
        setLoading(true);
        setError(null);
        setErrorType(null);
        setDisplayHTML("");
        setTyping(false);
        setPostsCount(0);

        getWordSummary(word)
            .then(data => {
                if (Array.isArray(data) && data.length > 0 && data[0].summary_text?.trim()) {
                    setSummary(data[0]);
                    setLoading(false);
                } else {
                    return generateWordSummary(word);
                }
            })
            .then(data => {
                if (data && data.summary_text) {
                    setSummary(data);
                    setLoading(false);
                }
            })
            .catch(err => {
                let errorMessage = 'Failed to load summary';
                let errorType = 'unknown';
                let postsCount = 0;

                if (err.data) {
                    errorType = err.data.error || 'unknown';
                    errorMessage = err.data.message || errorMessage;
                    postsCount = err.data.posts_count || 0;
                }

                setLoading(false);
                setError(errorMessage);
                setErrorType(errorType);
                setTyping(false);
                setPostsCount(postsCount);
            });
    }, [word, getWordSummary, generateWordSummary]);

    function renderErrorState() {
        const errorConfig = {
            'not_found': {
                title: 'Keyword Not Found',
                message: `The keyword "${word}" was not found in Trendy Words or Monitored Keywords.`
            },
            'insufficient_data': {
                title: 'Insufficient Data',
                message: `Not enough data to generate an AI summary for "${word}".`,
                detail: `Currently ${postsCount} post${postsCount !== 1 ? 's' : ''} available (minimum 3 required).`
            },
            'generation_failed': {
                title: 'Generation Failed',
                message: 'The AI summary generation process encountered an error.'
            },
            'generation_error': {
                title: 'Technical Error',
                message: error
            },
            'unknown': {
                title: 'Error',
                message: error || 'An unknown error occurred'
            }
        };

        const config = errorConfig[errorType] || errorConfig['unknown'];

        return (
            <div className="wt-summary-state">
                <i className="material-icons" aria-hidden="true">info</i>
                <div className="wt-summary-state-title">{config.title}</div>
                <div>{config.message}</div>
                {config.detail && <small>{config.detail}</small>}
            </div>
        );
    }

    let isRegenerateDisabled = false;
    let regenerateTooltip = "Force AI to regenerate this summary";

    if (summary && (summary.updated_at || summary.created_at)) {
        const lastUpdate = new Date(summary.updated_at || summary.created_at).getTime();
        const elapsedMinutes = (currentTime - lastUpdate) / (1000 * 60);

        if (elapsedMinutes < cooldownMinutes) {
            isRegenerateDisabled = true;
            const remainingMinutes = Math.ceil(cooldownMinutes - elapsedMinutes);
            regenerateTooltip = `Please wait ${remainingMinutes} minute(s) before the next regeneration.`;
        }
    }
    const buttonShouldBeDisabled = isRegenerating || loading || !!error || isRegenerateDisabled;

    return (
        <div className="wt-summary-wrap">
            <div className="word-summary card wt-summary">
                <div className="wt-summary-head">
                    <span className="wt-icon-chip" aria-hidden="true">
                        <i className="material-icons">auto_awesome</i>
                    </span>
                    <div className="wt-summary-title">
                        <span>Word Summary for</span>{' '}
                        <strong>{word}</strong>
                    </div>
                    <span className="wt-summary-badge">AI summary</span>
                    <button
                        type="button"
                        className="btn btn-sm btn-secondary wt-btn-ghost wt-summary-regen"
                        onClick={() => { if (!buttonShouldBeDisabled) handleRegenerate(); }}
                        disabled={buttonShouldBeDisabled}
                        title={regenerateTooltip}
                    >
                        <i className={`material-icons ${isRegenerating ? 'wt-spin' : ''}`} aria-hidden="true">
                            {isRegenerating ? 'sync' : 'refresh'}
                        </i>
                        {isRegenerating ? 'Regenerating…' : 'Regenerate'}
                    </button>
                </div>

                <div className="wt-summary-body">
                    {loading && (
                        <div className="wt-summary-state">
                            <span className="loading-dots" aria-hidden="true">
                                <span>.</span>
                                <span>.</span>
                                <span>.</span>
                            </span>
                            <div>Loading summary for <strong>{word}</strong></div>
                        </div>
                    )}

                    {error && renderErrorState()}

                    {!loading && !error && summary && (
                        <>
                            <div className="wt-summary-text">
                                <span dangerouslySetInnerHTML={{ __html: displayHTML }} />
                                {typing && <span className="blinking-cursor" aria-hidden="true">|</span>}
                            </div>
                            <div className="wt-summary-meta">
                                <span>
                                    <i className="material-icons" aria-hidden="true">schedule</i>
                                    Generated at {formatDate(summary.created_at)}
                                </span>
                                {summary.ai_model && (
                                    <span title="AI model used for this summary">
                                        <i className="material-icons" aria-hidden="true">smart_toy</i>
                                        {summary.ai_model}
                                    </span>
                                )}
                                <span>
                                    <i className="material-icons" aria-hidden="true">update</i>
                                    Updated at {formatDate(summary.updated_at)}
                                </span>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

WordSummary.propTypes = {
    word: PropTypes.string.isRequired,
    getWordSummary: PropTypes.func.isRequired,
    generateWordSummary: PropTypes.func.isRequired,
    createMessage: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => {
    let isEnabled = state.profile?.typewriter_enabled;
    if (isEnabled === undefined) {
        isEnabled = state.auth?.user?.userprofile?.typewriter_enabled;
    }
    
    return {
        typewriterEnabled: isEnabled !== false
    };
};

export default connect(mapStateToProps, { getWordSummary, generateWordSummary, createMessage, getSummaryConfig, regenerateWordSummary })(WordSummary);