import React, { Component, Fragment, useState, useEffect, useRef } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { Modal, Form, Button, Badge, Spinner, Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import TableManager from '../common/TableManager';
import { getConnectors, updateConnector, revealConnector, testConnector, resetConnectorField, setDefaultLlm } from '../../actions/Connectors';
import StatCard from '../common/StatCard';

const LOGO_BASE = '/static/frontend/images/connectors/';

const STATUS_CFG = {
    configured: { bg: 'success',   label: 'Configured'  },
    partial:    { bg: 'warning',   label: 'Incomplete', text: 'dark' },
    disabled:   { bg: 'secondary', label: 'Disabled'    },
};

const HEALTH_CFG = {
    healthy:   { bg: 'success',   label: 'Healthy'   },
    unhealthy: { bg: 'danger',    label: 'Unhealthy' },
    unknown:   { bg: 'secondary', label: 'Not tested yet' },
};

const CATEGORY_ORDER = ['Notifications', 'Incident Response', 'Threat Intelligence', 'Certificate Monitoring', 'Domain Monitoring', 'Search', 'Authentication', 'Database', 'Other'];

// StatusBadge
function StatusBadge({ status }) {
    const c = STATUS_CFG[status] || STATUS_CFG.disabled;
    return <Badge bg={c.bg} text={c.text}>{c.label}</Badge>;
}

// HealthBadge
function HealthBadge({ health }) {
    const status = health?.status || 'unknown';
    const c = HEALTH_CFG[status] || HEALTH_CFG.unknown;
    const title = health?.checked_at
        ? `Last checked ${new Date(health.checked_at).toLocaleString()}${health.message ? ' - ' + health.message : ''}`
        : 'Never tested yet';
    return <Badge bg={c.bg} text={c.text} title={title}>{c.label}</Badge>;
}

// ConnectorLogo - brand image if available, emoji fallback otherwise
function ConnectorLogo({ connector, size = 72 }) {
    const [failed, setFailed] = useState(false);
    if (!failed) {
        return (
            <img
                src={`${LOGO_BASE}${connector.id}.png`}
                alt={connector.name}
                onError={() => setFailed(true)}
                style={{ height: size, width: 'auto', maxWidth: size * 2, objectFit: 'contain' }}
            />
        );
    }
    return (
        <span style={{ fontSize: size * 0.7, lineHeight: 1, opacity: 0.85 }}>
            {connector.logo || '🔌'}
        </span>
    );
}

// ConnectorEditModal
function ConnectorEditModal({ connector, show, onClose, onReveal, onSave, onResetField }) {
    const [fields, setFields]       = useState([]);
    const [revealed, setRevealed]   = useState(new Set());
    const [revealing, setRevealing] = useState({});
    const [resetting, setResetting] = useState({});
    const [saving, setSaving]       = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [dirty, setDirty]         = useState(false);

    useEffect(() => {
        if (connector) {
            setFields((connector.fields || []).map(f => ({ ...f })));
            setRevealed(new Set());
            setSaveError(null);
            setDirty(false);
        }
    }, [connector]);

    const handleChange = (name, value) => {
        setFields(prev => prev.map(f => f.name === name ? { ...f, value } : f));
        setDirty(true);
    };

    const handleReveal = async (fieldName) => {
        if (!connector) return;
        setRevealing(prev => ({ ...prev, [fieldName]: true }));
        try {
            const data = await onReveal(connector.id);
            const field = data && (data.fields || []).find(f => f.name === fieldName);
            if (field) {
                setRevealed(prev => new Set([...prev, fieldName]));
                setFields(prev => prev.map(f => f.name === fieldName ? { ...f, value: field.value } : f));
            }
        } catch (err) {
            console.error('Reveal failed', err);
        } finally {
            setRevealing(prev => ({ ...prev, [fieldName]: false }));
        }
    };

    const handleHide = (fieldName) =>
        setRevealed(prev => { const n = new Set(prev); n.delete(fieldName); return n; });

    const handleReset = async (fieldName) => {
        if (!connector) return;
        setResetting(prev => ({ ...prev, [fieldName]: true }));
        try {
            const data = await onResetField(connector.id, fieldName);
            const field = data && (data.fields || []).find(f => f.name === fieldName);
            if (field) {
                setFields(prev => prev.map(f => f.name === fieldName ? { ...field } : f));
                setRevealed(prev => { const n = new Set(prev); n.delete(fieldName); return n; });
            }
        } catch (err) {
            console.error('Reset failed', err);
        } finally {
            setResetting(prev => ({ ...prev, [fieldName]: false }));
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!connector) return;
        setSaving(true);
        setSaveError(null);
        try {
            const fieldsToSave = {};
            fields.forEach(f => { fieldsToSave[f.name] = f.value; });
            await onSave(connector.id, fieldsToSave);
            setDirty(false);
            onClose();
        } catch (err) {
            setSaveError(err.message);
        } finally {
            setSaving(false);
        }
    };

    if (!connector) return null;

    return (
        <Modal show={show} onHide={onClose} centered size="lg">
            <Modal.Header closeButton>
                <Modal.Title>
                    Edit {connector.name}
                    <Badge bg="secondary" className="ms-2"
                           style={{ fontSize: 11, fontWeight: 500, verticalAlign: 'middle' }}>
                        {connector.category}
                    </Badge>
                    {connector.version && (
                        <Badge bg="secondary" className="ms-2" style={{ fontSize: 11, fontWeight: 500, verticalAlign: 'middle' }}>
                            v{connector.version}
                        </Badge>
                    )}
                </Modal.Title>
            </Modal.Header>
            <form onSubmit={handleSave}>
                <Modal.Body>
                    {connector.description && (
                        <p className="text-muted mb-3" style={{ fontSize: 13 }}>
                            {connector.description}
                        </p>
                    )}
                    {fields.map(f => (
                        <Form.Group className="mb-3" key={f.name}>
                            <Form.Label className="fw-semibold mb-1" style={{ fontSize: 13 }}>
                                {f.label}
                                {f.sensitive && (
                                    <Badge bg="secondary" className="ms-2"
                                           style={{ fontSize: 9, fontWeight: 400 }}>
                                        sensitive
                                    </Badge>
                                )}
                                <Badge bg={f.overridden ? 'info' : 'light'}
                                       text={f.overridden ? undefined : 'dark'}
                                       className="ms-2"
                                       style={{ fontSize: 9, fontWeight: 400 }}>
                                    {f.overridden ? 'Manually set' : 'From .env'}
                                </Badge>
                            </Form.Label>
                            <div className="input-group input-group-sm">
                                <Form.Control
                                    type={f.sensitive && !revealed.has(f.name) ? 'password' : 'text'}
                                    value={f.value || ''}
                                    onChange={e => handleChange(f.name, e.target.value)}
                                    disabled={connector.readonly}
                                    className="font-monospace"
                                    style={{ fontSize: 13 }}
                                />
                                {f.sensitive && !revealed.has(f.name) && (
                                    <Button type="button" variant="outline-secondary"
                                            disabled={!!revealing[f.name]}
                                            onClick={() => handleReveal(f.name)}
                                            title="Reveal stored value">
                                        {revealing[f.name]
                                            ? <Spinner animation="border" size="sm" />
                                            : <i className="material-icons"
                                                 style={{ fontSize: 16, verticalAlign: 'middle' }}>visibility</i>
                                        }
                                    </Button>
                                )}
                                {f.sensitive && revealed.has(f.name) && (
                                    <Button type="button" variant="outline-secondary"
                                            onClick={() => handleHide(f.name)}
                                            title="Hide value">
                                        <i className="material-icons"
                                           style={{ fontSize: 16, verticalAlign: 'middle' }}>visibility_off</i>
                                    </Button>
                                )}
                                {!connector.readonly && f.overridden && (
                                    <Button type="button" variant="outline-secondary"
                                            disabled={!!resetting[f.name]}
                                            onClick={() => handleReset(f.name)}
                                            title="Reset to .env default">
                                        {resetting[f.name]
                                            ? <Spinner animation="border" size="sm" />
                                            : <i className="material-icons"
                                                 style={{ fontSize: 16, verticalAlign: 'middle' }}>refresh</i>
                                        }
                                    </Button>
                                )}
                            </div>
                            <div className="text-muted mt-1" style={{ fontSize: 11, fontFamily: 'monospace' }}>
                                {f.name}
                            </div>
                        </Form.Group>
                    ))}

                    {connector.readonly && (
                        <Alert variant="warning" className="py-2 px-3 mb-0" style={{ fontSize: 13 }}>
                            This connector is informational only. Settings are managed in <code>settings.py</code>.
                        </Alert>
                    )}

                    {saveError && (
                        <Alert variant="danger" className="py-2 px-3 mb-0 mt-3" style={{ fontSize: 13 }}>
                            <i className="material-icons me-1"
                               style={{ fontSize: 14, verticalAlign: 'text-bottom' }}>error</i>
                            {saveError}
                        </Alert>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={onClose} disabled={saving}>
                        Close
                    </Button>
                    {!connector.readonly && (
                        <Button type="submit" variant="primary" disabled={saving || !dirty}>
                            {saving
                                ? <><Spinner animation="border" size="sm" className="me-1" />Saving&hellip;</>
                                : 'Save changes'
                            }
                        </Button>
                    )}
                </Modal.Footer>
            </form>
        </Modal>
    );
}

// ConnectorCard
class ConnectorCard extends Component {
    constructor(props) {
        super(props);
        this.state = { testResult: null, testing: false };
    }

    handleTest = async () => {
        this.setState({ testing: true, testResult: null });
        clearTimeout(this._testTimer);
        try {
            const result = await this.props.onTest(this.props.connector.id);
            this.setState({ testResult: result });
        } catch (err) {
            this.setState({ testResult: { success: false, message: err.message } });
        } finally {
            this.setState({ testing: false });
            this._testTimer = setTimeout(
                () => this.setState({ testResult: null }),
                10000
            );
        }
    };

    componentWillUnmount() {
        clearTimeout(this._testTimer);
    }

    render() {
        const { connector, onEditClick, onSetDefaultLLM } = this.props;
        const { testResult, testing } = this.state;
        const isAI = ['openai', 'anthropic', 'gemini', 'ollama', 'generic_llm_provider'].includes(connector.id) ||
                     (connector.category && connector.category.includes('Artificial Intelligence'));

        const health = connector.health?.status || 'unknown';

        return (
            <div className={`card wt-conn-card wt-conn-${connector.status} wt-conn-health-${health}`}>
                <div className="card-body">
                    <div className="wt-conn-head">
                        <span className="wt-conn-logo">
                            <ConnectorLogo connector={connector} size={30} />
                            <span className="wt-conn-health-dot" title={HEALTH_CFG[health]?.label} />
                        </span>
                        <div className="wt-conn-title">
                            <strong>{connector.name}</strong>
                            <span>{connector.category} · v{connector.version}</span>
                        </div>
                        {connector.readonly && (
                            <i className="material-icons wt-conn-lock" title="Read-only: configured in settings.py">lock</i>
                        )}
                    </div>

                    {connector.description && <p className="wt-conn-desc" title={connector.description}>{connector.description}</p>}

                    <div className="wt-conn-badges">
                        <StatusBadge status={connector.status} />
                        <HealthBadge health={connector.health} />
                        {connector.readonly && <Badge bg="warning" text="dark">Read-only</Badge>}
                        {connector.is_default_llm && (
                            <Badge bg="primary" className="wt-conn-default">
                                <i className="material-icons" aria-hidden="true">star</i>
                                Default LLM
                            </Badge>
                        )}
                    </div>

                    {isAI && (
                        <div className="form-check form-switch wt-conn-llm">
                            <input
                                className="form-check-input"
                                type="checkbox"
                                role="switch"
                                id={`default_llm_${connector.id}`}
                                checked={connector.is_default_llm || false}
                                onChange={(e) => onSetDefaultLLM(connector.id, e.target.checked)}
                            />
                            <label className="form-check-label" htmlFor={`default_llm_${connector.id}`}>
                                Set as Default LLM
                            </label>
                        </div>
                    )}

                    {testResult && (
                        <div className={`wt-conn-test ${testResult.success ? 'is-ok' : 'is-error'}`} role="status">
                            <i className="material-icons" aria-hidden="true">{testResult.success ? 'check_circle' : 'error'}</i>
                            <span>{testResult.message}</span>
                            <button type="button" className="btn-close" aria-label="Dismiss"
                                    onClick={() => this.setState({ testResult: null })} />
                        </div>
                    )}
                </div>

                <div className="wt-conn-actions">
                    <button type="button" className="btn btn-sm btn-secondary wt-btn-soft" onClick={() => onEditClick(connector)}>
                        <i className="material-icons" aria-hidden="true">{connector.readonly ? 'visibility' : 'tune'}</i>
                        {connector.readonly ? 'View' : 'Configure'}
                    </button>
                    <button type="button" className="btn btn-sm btn-secondary wt-btn-ghost" onClick={this.handleTest} disabled={testing}>
                        {testing
                            ? <Spinner animation="border" size="sm" />
                            : <i className="material-icons" aria-hidden="true">network_check</i>}
                        {testing ? 'Testing…' : 'Test'}
                    </button>
                </div>
            </div>
        );
    }
}

// ConnectorsDashboard
class ConnectorsDashboard extends Component {
    static propTypes = {
        connectors: PropTypes.array.isRequired,
        user: PropTypes.object,
        getConnectors: PropTypes.func.isRequired,
        revealConnector: PropTypes.func.isRequired,
        updateConnector: PropTypes.func.isRequired,
        testConnector: PropTypes.func.isRequired,
    };

    constructor(props) {
        super(props);
        this.state = {
            loading:         true,
            error:           null,
            editConnector:   null,
            showEdit:        false,
            groupByCategory: true,
            showHelp:        false,
        };
    }

    componentDidMount() {
        if (this.props.user && this.props.user.is_superuser) {
            this.setState({ loading: true, error: null });
            this.props.getConnectors()
                .then(() => this.setState({ loading: false }))
                .catch(err => this.setState({ loading: false, error: err?.message || 'Failed to load connectors.' }));
        }
    }

    customFilters = (filtered, filters) => {
        if (filters.status) {
            filtered = filtered.filter(c => c.status === filters.status);
        }
        if (filters.health) {
            filtered = filtered.filter(c => (c.health?.status || 'unknown') === filters.health);
        }
        if (filters.category) {
            filtered = filtered.filter(c => c.category === filters.category);
        }
        return filtered;
    };

    getFilterConfig = () => {
        const categories = [...new Set(this.props.connectors.map(c => c.category))];
        return [
            {
                key:         'search',
                type:        'search',
                label:       'Search',
                placeholder: 'Search by name, category, description…',
                width:       4,
            },
            {
                key:     'status',
                type:    'select',
                label:   'Status',
                width:   3,
                options: [
                    { value: 'configured', label: 'Configured' },
                    { value: 'partial',    label: 'Incomplete' },
                    { value: 'disabled',   label: 'Disabled'   },
                ],
            },
            {
                key:     'health',
                type:    'select',
                label:   'Health',
                width:   3,
                options: [
                    { value: 'healthy',   label: 'Healthy'        },
                    { value: 'unhealthy', label: 'Unhealthy'      },
                    { value: 'unknown',   label: 'Not tested yet' },
                ],
            },
            {
                key:     'category',
                type:    'select',
                label:   'Category',
                width:   3,
                options: categories.map(c => ({ value: c, label: c })),
            },
        ];
    };

    openEdit  = (c) => this.setState({ editConnector: c, showEdit: true });
    closeEdit = ()  => this.setState({ showEdit: false, editConnector: null });

    handleSave       = (connectorId, fields) => this.props.updateConnector(connectorId, fields);
    handleReveal     = (connectorId) => this.props.revealConnector(connectorId);
    handleTest       = (connectorId) => this.props.testConnector(connectorId);
    handleResetField = (connectorId, fieldName) => this.props.resetConnectorField(connectorId, fieldName);
    
    handleSetDefaultLLM = async (connectorId, isDefault) => {
        try {
            await this.props.setDefaultLlm(connectorId, isDefault);
            this.props.getConnectors();
        } catch (error) {
            console.error("Failed to update default LLM:", error);
        }
    };

    toggleHelp = () => this.setState(prev => ({ showHelp: !prev.showHelp }));

    renderConnectorsGrid = (data) => {
        if (data.length === 0) {
            return (
                <div className="wt-empty">
                    <i className="material-icons" aria-hidden="true">power_off</i>
                    <p>No connectors match your filters.</p>
                </div>
            );
        }

        if (!this.state.groupByCategory) {
            return (
                <div className="wt-conn-grid mb-3">
                    {data.map(c => (
                        <ConnectorCard key={c.id} connector={c} onEditClick={this.openEdit} onTest={this.handleTest} onSetDefaultLLM={this.handleSetDefaultLLM} />
                    ))}
                </div>
            );
        }

        const byCategory = {};
        data.forEach(c => {
            const cat = c.category || 'Other';
            if (!byCategory[cat]) byCategory[cat] = [];
            byCategory[cat].push(c);
        });
        const sortedCategories = CATEGORY_ORDER.filter(cat => byCategory[cat])
            .concat(Object.keys(byCategory).filter(cat => !CATEGORY_ORDER.includes(cat)));

        return sortedCategories.map(category => (
            <section key={category} className="mb-4">
                <h2 className="wt-stats-section-title">
                    {category}
                    <span className="wt-conn-count">{byCategory[category].length}</span>
                </h2>
                <div className="wt-conn-grid">
                    {byCategory[category].map(c => (
                        <ConnectorCard key={c.id} connector={c} onEditClick={this.openEdit} onTest={this.handleTest} onSetDefaultLLM={this.handleSetDefaultLLM} />
                    ))}
                </div>
            </section>
        ));
    };

    render() {
        const { user } = this.props;
        const { loading, error, editConnector, showEdit } = this.state;
        const connectors = this.props.connectors || [];

        if (!user || !user.is_superuser) {
            return (
                <div className="wt-notfound">
                    <div className="wt-notfound-icon" aria-hidden="true"><i className="material-icons">lock</i></div>
                    <div className="wt-eyebrow">Superuser only</div>
                    <h1>Access restricted</h1>
                    <p>Connectors hold credentials for external services, so only superusers can see them.</p>
                    <div className="wt-notfound-actions">
                        <Link to="/" className="btn btn-primary">Back to Threats Watcher</Link>
                    </div>
                </div>
            );
        }

        const stats = {
            total:      connectors.length,
            configured: connectors.filter(c => c.status === 'configured').length,
            partial:    connectors.filter(c => c.status === 'partial').length,
            healthy:    connectors.filter(c => c.health?.status === 'healthy').length,
            unhealthy:  connectors.filter(c => c.health?.status === 'unhealthy').length,
            untested:   connectors.filter(c => (c.health?.status || 'unknown') === 'unknown').length,
        };

        return (
            <div className="wt-connectors">
                <div className="wt-kpi-strip">
                    <StatCard title="Connectors" value={stats.total} icon="hub" variant="primary" />
                    <StatCard title="Configured" value={stats.configured} icon="check_circle" variant="success" />
                    <StatCard title="Incomplete" value={stats.partial} icon="warning" variant="warning" />
                    <StatCard title="Unhealthy" value={stats.unhealthy} icon="error" variant="danger"
                              sub={`${stats.healthy} healthy · ${stats.untested} not tested`} />
                </div>

                <div className={`card wt-help ${this.state.showHelp ? 'is-open' : ''}`}>
                    <button type="button" className="wt-help-toggle" onClick={this.toggleHelp} aria-expanded={this.state.showHelp}>
                        <i className="material-icons" aria-hidden="true">help</i>
                        <span>How connectors work</span>
                        <i className="material-icons ms-auto" aria-hidden="true">{this.state.showHelp ? 'expand_less' : 'expand_more'}</i>
                    </button>
                    {this.state.showHelp && (
                        <ul className="wt-help-list">
                            <li>
                                <i className="material-icons" aria-hidden="true">download</i>
                                <span>The first time a connector's fields are read, they're seeded from your <strong>settings.py</strong> / <strong>.env</strong> values.</span>
                            </li>
                            <li>
                                <i className="material-icons" aria-hidden="true">tune</i>
                                <span>
                                    <strong>Configure</strong> overrides a value: it is stored in the database and takes effect immediately across the whole app
                                    (SMTP, Slack, Citadel, TheHive, MISP, CertStream, SearxNG, CyberWatch...), not only for the <strong>Test</strong> button.
                                </span>
                            </li>
                            <li>
                                <i className="material-icons" aria-hidden="true">link_off</i>
                                <span>
                                    Once saved here, even cleared to empty, a field stops following <strong>settings.py</strong>/<strong>.env</strong>.
                                    Each field shows <strong>From .env</strong> or <strong>Manually set</strong>; manual fields get a reset button to follow the file again.
                                </span>
                            </li>
                            <li>
                                <i className="material-icons" aria-hidden="true">lock</i>
                                <span>Passwords, tokens and API keys are encrypted before being stored and masked by default; the eye icon reveals them.</span>
                            </li>
                            <li>
                                <i className="material-icons" aria-hidden="true">network_check</i>
                                <span><strong>Test</strong> runs a real connectivity check with the saved values and reports the result on the card.</span>
                            </li>
                            <li>
                                <i className="material-icons" aria-hidden="true">visibility</i>
                                <span>
                                    <strong>Read-only</strong> connectors are informational: their configuration lives only in <strong>settings.py</strong>.
                                    For LDAP and OIDC/SSO, Django builds its authentication backends from it at startup, not per request.
                                </span>
                            </li>
                        </ul>
                    )}
                </div>

                {error && (
                    <div className="alert alert-danger mb-3">
                        <i className="material-icons me-2 align-middle" style={{ fontSize: 16 }}>error</i>
                        {error}
                    </div>
                )}

                {loading && (
                    <div className="wt-conn-grid" aria-busy="true">
                        {Array.from({ length: 8 }, (_, i) => <div key={i} className="card wt-conn-card wt-conn-skeleton" />)}
                    </div>
                )}

                {!loading && (
                    <TableManager
                        data={connectors}
                        filterConfig={this.getFilterConfig()}
                        searchFields={['name', 'category', 'description']}
                        customFilters={this.customFilters}
                        moduleKey="connectors_dashboard"
                        itemsPerPage={24}
                        defaultSort="name"
                        defaultSortDirection="asc"
                    >
                        {({ paginatedData, renderFilterControls, renderFilters, renderPagination, renderItemsInfo }) => (
                            <Fragment>
                                {renderFilterControls()}
                                {renderFilters()}

                                {renderItemsInfo()}

                                <div className="wt-segmented mb-3" role="radiogroup" aria-label="Layout">
                                    {[{ key: false, label: 'All', icon: 'grid_view' }, { key: true, label: 'By category', icon: 'category' }].map(opt => (
                                        <button key={String(opt.key)} type="button" role="radio" aria-checked={this.state.groupByCategory === opt.key}
                                                className={this.state.groupByCategory === opt.key ? 'is-active' : ''}
                                                onClick={() => this.setState({ groupByCategory: opt.key })}>
                                            <i className="material-icons" aria-hidden="true">{opt.icon}</i>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>

                                {this.renderConnectorsGrid(paginatedData)}

                                {renderPagination()}
                            </Fragment>
                        )}
                    </TableManager>
                )}

                <ConnectorEditModal
                    connector={editConnector}
                    show={showEdit}
                    onClose={this.closeEdit}
                    onReveal={this.handleReveal}
                    onSave={this.handleSave}
                    onResetField={this.handleResetField}
                />
            </div>
        );
    }
}

const mapStateToProps = state => ({
    user:       state.auth.user,
    connectors: state.connectors.connectors,
});

export default connect(mapStateToProps, {
    getConnectors,
    updateConnector,
    revealConnector,
    testConnector,
    resetConnectorField,
    setDefaultLlm,
})(ConnectorsDashboard);
