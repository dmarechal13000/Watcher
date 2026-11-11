import React, { Component, Fragment } from 'react';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import { getCVEs, getWatchRuleHits, archiveCVE, archiveHit } from '../../actions/CyberWatch';
import { OverlayTrigger, Tooltip, Badge } from 'react-bootstrap';
import TableManager from '../common/TableManager';
import DateWithTooltip from '../common/DateWithTooltip';
import { SeverityBadge, CvssScore } from '../common/SeverityBadge';
import { EmptyRow } from '../common/TableStates';
import { DetailDrawer, DrawerSection, DrawerFields, rowOpenProps } from '../common/DetailDrawer';
import { claimDetail, onDetailRequest } from '../common/detailFocus';
import { claimFilters, withFilterDefaults } from '../common/pendingFilters';

const getCveUrl = (id) => {
    if (!id) return '#';
    if (id.startsWith('CVE-'))  return `https://www.cve.org/CVERecord?id=${id}`;
    if (id.startsWith('GHSA-')) return `https://github.com/advisories/${id}`;
    if (id.startsWith('MAL-'))  return `https://vulnerability.circl.lu/vuln/${id}`;
    return `https://vulnerability.circl.lu/vuln/${id}`;
};

const FILTER_CONFIG = [
    {
        key: 'search',
        type: 'search',
        label: 'Search',
        placeholder: 'Search by CVE ID or description...',
        width: 4
    },
    {
        key: 'severity',
        type: 'select',
        label: 'Severity',
        width: 2,
        options: [
            { value: 'CRITICAL', label: 'Critical' },
            { value: 'HIGH',     label: 'High' },
            { value: 'MEDIUM',   label: 'Medium' },
            { value: 'LOW',      label: 'Low' },
        ]
    },
];

const EmptyHitsState = ({ type }) => (
    <tr>
        <td colSpan={99} className="text-center py-5">
            <div className="d-flex flex-column align-items-center gap-2 text-muted">
                <span className="fw-semibold">No results found</span>
                <span className="small">
                    No {type} matched your Watch Rules yet.{' '}
                    <Link to="/cyber_watch" className="text-primary">
                        Add or review your rules on Cyber Watch
                    </Link>
                </span>
            </div>
        </td>
    </tr>
);

const HITS_FILTER_CONFIG = [
    {
        key: 'search',
        type: 'search',
        label: 'Search',
        placeholder: 'Search by CVE ID or keyword...',
        width: 4
    },
    {
        key: 'severity',
        type: 'select',
        label: 'Severity',
        width: 2,
        options: [
            { value: 'CRITICAL', label: 'Critical' },
            { value: 'HIGH',     label: 'High' },
            { value: 'MEDIUM',   label: 'Medium' },
            { value: 'LOW',      label: 'Low' },
        ]
    },
];

class CVEVulnerabilities extends Component {
    constructor(props) {
        super(props);
        // Filter requested by a click on the Statistics tab (see common/pendingFilters)
        this.anchorRef = React.createRef();
        this.requestedFilters = claimFilters('cve');
        this.state = {
            activeTab:       'all',
            selectedHit:     null,
            showDetailModal: false,
            selectedCve: null,
        };
    }

    static propTypes = {
        cves:             PropTypes.array.isRequired,
        watchRuleHits:    PropTypes.array.isRequired,
        getCVEs:          PropTypes.func.isRequired,
        getWatchRuleHits: PropTypes.func.isRequired,
        archiveCVE:       PropTypes.func.isRequired,
        archiveHit:       PropTypes.func.isRequired,
        auth:             PropTypes.object.isRequired,
    };

    componentWillUnmount() {
        if (this._unwatchDetail) this._unwatchDetail();
    }

    // Open a record requested from the command palette (Ctrl+K) once it is in the list
    claimPendingDetail = () => {
        const item = claimDetail('cve', id => (this.props.cves).find(x => String(x.id) === id));
        if (item) { this.setState({ activeTab: 'all' }); this.openCveDetail(item); }
    };

    componentDidMount() {
        if (this.requestedFilters) {
            // Arriving from a chart click: bring the filtered table into view
            setTimeout(() => this.anchorRef.current && this.anchorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400);
        }
        this._unwatchDetail = onDetailRequest(this.claimPendingDetail);
        this.claimPendingDetail();
        this.props.getCVEs({});
        if (!this.props.watchRuleHits.length) {
            this.props.getWatchRuleHits();
        }
    }

    componentDidUpdate(prevProps) {
        if (prevProps.cves !== this.props.cves) this.claimPendingDetail();
    }

    getCVEHits = () =>
        this.props.watchRuleHits.filter(h => h.hit_type === 'cve');

    getCVEForHit = (hit) =>
        this.props.cves.find(c => c.cve_id === hit.object_id) || null;

    customFilters = (filtered, filters) => {
        if (filters.severity) {
            filtered = filtered.filter(c => c.severity === filters.severity);
        }
        return filtered;
    };

    hitsCustomFilters = (filtered, filters) => {
        if (filters.severity) {
            const { cves } = this.props;
            filtered = filtered.filter(hit => {
                const cve = cves.find(c => c.cve_id === hit.object_id);
                return cve && cve.severity === filters.severity;
            });
        }
        return filtered;
    };

    renderSeverityBadge = (severity) => {
        return <SeverityBadge severity={severity} />;
    };

    openDetailModal = (hit) =>
        this.setState({ selectedHit: hit, selectedCve: null, showDetailModal: true });

    openCveDetail = (cve) =>
        this.setState({ selectedHit: null, selectedCve: cve, showDetailModal: true });

    // Keep the selection while the drawer slides out; it is replaced on the next open.
    closeDetailModal = () =>
        this.setState({ showDetailModal: false });

    renderReferences = (references) => {
        const urls = (Array.isArray(references) ? references : [])
            .map(ref => (typeof ref === 'object' ? (ref.url || '') : ref))
            .filter(Boolean);
        if (urls.length === 0) return null;
        return (
            <DrawerSection title={`References (${urls.length})`} icon="link">
                <ul className="wt-drawer-links">
                    {urls.slice(0, 12).map((url, i) => (
                        <li key={i}>
                            <a href={url} target="_blank" rel="noopener noreferrer">{url}</a>
                        </li>
                    ))}
                    {urls.length > 12 && <li className="text-muted">...and {urls.length - 12} more</li>}
                </ul>
            </DrawerSection>
        );
    };

    renderDetailModal = () => {
        const { selectedHit, selectedCve, showDetailModal } = this.state;
        if (!selectedHit && !selectedCve) return null;
        const cve = selectedCve || this.getCVEForHit(selectedHit);
        const cveId = cve ? cve.cve_id : selectedHit.object_id;

        return (
            <DetailDrawer
                show={showDetailModal}
                onHide={this.closeDetailModal}
                icon="bug_report"
                title={cveId}
                subtitle={cve && cve.published ? `Published ${new Date(cve.published).toLocaleDateString()}` : 'Vulnerability'}
                badges={cve ? (
                    <>
                        <SeverityBadge severity={cve.severity} />
                        <CvssScore score={cve.cvss_score} />
                    </>
                ) : null}
                actions={
                    <a href={getCveUrl(cveId)} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                        <i className="material-icons" aria-hidden="true">open_in_new</i>
                        Open in CIRCL
                    </a>
                }
            >
                {selectedHit && (
                    <DrawerSection title="Watch rule match" icon="visibility">
                        <DrawerFields items={[
                            { label: 'Rule', value: selectedHit.rule_name },
                            { label: 'Keyword', value: selectedHit.matched_keyword && <Badge bg="secondary">{selectedHit.matched_keyword}</Badge> },
                            { label: 'Hit date', value: <DateWithTooltip date={selectedHit.hit_at} includeTime={true} type="created" /> },
                        ]} />
                    </DrawerSection>
                )}

                {cve ? (
                    <>
                        <DrawerSection title="Vulnerability" icon="report">
                            <DrawerFields items={[
                                { label: 'Severity', value: <SeverityBadge severity={cve.severity} /> },
                                { label: 'CVSS score', value: cve.cvss_score != null ? <CvssScore score={cve.cvss_score} /> : null },
                                { label: 'Published', value: cve.published && <DateWithTooltip date={cve.published} includeTime={false} type="created" /> },
                                { label: 'Fetched', value: cve.fetched_at && <DateWithTooltip date={cve.fetched_at} includeTime={true} type="created" /> },
                            ]} />
                        </DrawerSection>
                        <DrawerSection title="Information" icon="notes">
                            <p className="wt-drawer-text">
                                {cve.description || <span className="text-muted fst-italic">No information</span>}
                            </p>
                        </DrawerSection>
                        {this.renderReferences(cve.references)}
                    </>
                ) : (
                    <DrawerSection title="Vulnerability" icon="report">
                        <p className="wt-drawer-text text-muted fst-italic">
                            CVE details not loaded - switch to the "All CVEs" tab to load them.
                        </p>
                    </DrawerSection>
                )}
            </DetailDrawer>
        );
    };

    render() {
        const { cves, auth } = this.props;
        const { activeTab } = this.state;
        const { isAuthenticated, user } = auth;
        const canManage = isAuthenticated && !!user && (user.is_superuser || user.is_staff || (Array.isArray(user.permissions) && user.permissions.some(p => p === 'cyber_watch.change_cvealert' || p === 'cyber_watch.delete_cvealert')));
        const cveHits = this.getCVEHits();
        const colCount = 5;

        return (
            <Fragment>
                <span ref={this.anchorRef} className="wt-scroll-anchor" aria-hidden="true" />
                <h4 className="mb-3 wt-panel-heading">CVE Vulnerabilities</h4>

                <ul className="nav nav-tabs mb-3">
                    <li className="nav-item">
                        <button
                            className={`nav-link ${activeTab === 'hits' ? 'active' : ''}`}
                            onClick={() => this.setState({ activeTab: 'hits' })}
                        >
                            My Watch Rules Hits ({cveHits.length})
                        </button>
                    </li>
                    <li className="nav-item">
                        <button
                            className={`nav-link ${activeTab === 'all' ? 'active' : ''}`}
                            onClick={() => this.setState({ activeTab: 'all' })}
                        >
                            All CVEs ({cves.length})
                        </button>
                    </li>
                </ul>

                {activeTab === 'hits' && (
                    <TableManager
                        data={cveHits}
                        filterConfig={HITS_FILTER_CONFIG}
                        searchFields={['object_id', 'matched_keyword', 'rule_name']}
                        dateFields={['hit_at']}
                        defaultSort="hit_at"
                        customFilters={this.hitsCustomFilters}
                        enableDateFilter={true}
                        dateFilterWidth={4}
                        moduleKey="cyberWatch_cveHits"
                    >
                        {({
                            paginatedData,
                            handleSort,
                            renderSortIcons,
                            renderFilters,
                            renderPagination,
                            renderItemsInfo,
                            renderFilterControls,
                            renderSaveModal,
                            getTableContainerStyle,
                            theadRef
                        }) => (
                            <Fragment>
                                {renderFilterControls()}
                                {renderFilters()}
                                {renderItemsInfo()}
                                <div className="row">
                                    <div className="col-lg-12">
                                        <div style={{ ...getTableContainerStyle(), overflowX: 'auto' }}>
                                            <table className="table table-striped table-hover mb-0" style={{ fontSize: '0.95rem' }}>
                                                <thead ref={theadRef}>
                                                    <tr>
                                                        <th role="button" onClick={() => handleSort('rule_name')}>
                                                            Rule {renderSortIcons('rule_name')}
                                                        </th>
                                                        <th role="button" onClick={() => handleSort('object_id')}>
                                                            CVE ID {renderSortIcons('object_id')}
                                                        </th>
                                                        <th role="button" onClick={() => handleSort('matched_keyword')}>
                                                            Keyword {renderSortIcons('matched_keyword')}
                                                        </th>
                                                        <th className="text-center" role="button" onClick={() => handleSort('hit_at')}>
                                                            Date {renderSortIcons('hit_at')}
                                                        </th>
                                                        <th className="text-end"></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {paginatedData.length === 0 ? (
                                                        <EmptyHitsState type="CVE vulnerabilities" />
                                                    ) : (
                                                        paginatedData.map(hit => {
                                                            const cve = this.getCVEForHit(hit);
                                                            return (
                                                                <tr
                                                                    key={hit.id}
                                                                    {...rowOpenProps(
                                                                        () => this.openDetailModal(hit),
                                                                        this.state.showDetailModal && this.state.selectedHit?.id === hit.id
                                                                    )}
                                                                >
                                                                    <td className="align-middle fw-semibold">
                                                                        {hit.rule_name || '-'}
                                                                    </td>
                                                                    <td className="align-middle">
                                                                        <a
                                                                            href={getCveUrl(hit.object_id)}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="fw-semibold text-decoration-none"
                                                                        >
                                                                            {hit.object_id}
                                                                        </a>
                                                                        {cve && (
                                                                            <span className="ms-2">
                                                                                {this.renderSeverityBadge(cve.severity)}
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td className="align-middle">
                                                                        <Badge bg="secondary">{hit.matched_keyword}</Badge>
                                                                    </td>
                                                                    <td className="text-center align-middle">
                                                                        <DateWithTooltip date={hit.hit_at} includeTime={true} type="created" />
                                                                    </td>
                                                                    <td className="text-end align-middle" style={{ whiteSpace: 'nowrap' }}>
                                                                        <button
                                                                            className="btn btn-outline-info btn-sm me-2"
                                                                            onClick={() => this.openDetailModal(hit)}
                                                                            title="Details"
                                                                        >
                                                                            <i className="material-icons" style={{ fontSize: '1rem', verticalAlign: 'middle' }}>info</i>
                                                                        </button>
                                                                        {canManage && (
                                                                            <button
                                                                                className="btn btn-outline-warning btn-sm"
                                                                                onClick={() => this.props.archiveHit(hit.id)}
                                                                            >
                                                                                Disable
                                                                            </button>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                                {renderPagination()}
                                {renderSaveModal()}
                            </Fragment>
                        )}
                    </TableManager>
                )}

                {activeTab === 'all' && (
                    <TableManager
                        data={cves}
                        filterConfig={withFilterDefaults(FILTER_CONFIG, this.requestedFilters)}
                        revealFilters={!!this.requestedFilters}
                        searchFields={['cve_id', 'description']}
                        dateFields={['published']}
                        defaultSort="published"
                        customFilters={this.customFilters}
                        enableDateFilter={true}
                        dateFilterWidth={4}
                        moduleKey="cyberWatch_cveVulnerabilities"
                    >
                        {({
                            paginatedData,
                            handleSort,
                            renderSortIcons,
                            renderFilters,
                            renderPagination,
                            renderItemsInfo,
                            renderFilterControls,
                            renderSaveModal,
                            getTableContainerStyle,
                            theadRef
                        }) => (
                            <Fragment>
                                {renderFilterControls()}
                                {renderFilters()}
                                {renderItemsInfo()}
                                <div className="row">
                                    <div className="col-lg-12">
                                        <div style={{ ...getTableContainerStyle(), overflowX: 'auto' }}>
                                            <table className="table table-striped table-hover mb-0" style={{ fontSize: '0.95rem' }}>
                                                <thead ref={theadRef}>
                                                    <tr>
                                                        <th role="button" onClick={() => handleSort('cve_id')}>
                                                            CVE ID {renderSortIcons('cve_id')}
                                                        </th>
                                                        <th className="text-center" role="button" onClick={() => handleSort('severity')}>
                                                            Severity {renderSortIcons('severity')}
                                                        </th>
                                                        <th className="text-center" role="button" onClick={() => handleSort('cvss_score')}>
                                                            CVSS {renderSortIcons('cvss_score')}
                                                        </th>
                                                        <th>Information</th>
                                                        <th className="text-center" role="button" onClick={() => handleSort('published')}>
                                                            Published {renderSortIcons('published')}
                                                        </th>
                                                        {canManage && <th className="text-end">Actions</th>}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {paginatedData.length === 0 ? (
                                                        <EmptyRow colSpan={99} />
                                                    ) : (
                                                        paginatedData.map(cve => (
                                                            <tr
                                                                key={cve.id}
                                                                {...rowOpenProps(
                                                                    () => this.openCveDetail(cve),
                                                                    this.state.showDetailModal && this.state.selectedCve?.id === cve.id
                                                                )}
                                                            >
                                                                <td className="align-middle">
                                                                    <a
                                                                        href={getCveUrl(cve.cve_id)}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="fw-semibold text-decoration-none"
                                                                    >
                                                                        {cve.cve_id}
                                                                    </a>
                                                                </td>
                                                                <td className="text-center align-middle">
                                                                    {this.renderSeverityBadge(cve.severity)}
                                                                </td>
                                                                <td className="text-center align-middle">
                                                                    <CvssScore score={cve.cvss_score} />
                                                                </td>
                                                                <td className="align-middle" style={{ maxWidth: '380px' }}>
                                                                    {cve.description && cve.description.length > 50 ? (
                                                                        <OverlayTrigger
                                                                            placement="left"
                                                                            delay={{ show: 250, hide: 400 }}
                                                                            overlay={
                                                                                <Tooltip id={`tooltip-desc-${cve.id}`}>
                                                                                    <div style={{ 
                                                                                        textAlign: 'left',
                                                                                        maxWidth: '400px',
                                                                                        whiteSpace: 'pre-wrap',
                                                                                        wordBreak: 'break-word'
                                                                                    }}>
                                                                                        {cve.description}
                                                                                    </div>
                                                                                </Tooltip>
                                                                            }
                                                                        >
                                                                            <div style={{ 
                                                                                display: 'inline-flex', 
                                                                                alignItems: 'center',
                                                                                cursor: 'help',
                                                                                gap: '6px'
                                                                            }}>
                                                                                <span
                                                                                    style={{
                                                                                        maxWidth: 300,
                                                                                        whiteSpace: 'nowrap',
                                                                                        overflow: 'hidden',
                                                                                        textOverflow: 'ellipsis',
                                                                                        borderBottom: '1px dotted currentColor'
                                                                                    }}
                                                                                >
                                                                                    {cve.description}
                                                                                </span>
                                                                                <i 
                                                                                    className="material-icons text-info" 
                                                                                    style={{ 
                                                                                        fontSize: 16,
                                                                                        verticalAlign: 'middle',
                                                                                        flexShrink: 0
                                                                                    }}
                                                                                >
                                                                                    info
                                                                                </i>
                                                                            </div>
                                                                        </OverlayTrigger>
                                                                    ) : (
                                                                        <span className="text-muted fst-italic">
                                                                            {cve.description || 'No information'}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="text-center align-middle">
                                                                    {cve.published ? (
                                                                        <DateWithTooltip date={cve.published} includeTime={false} type="created" />
                                                                    ) : (
                                                                        <span className="text-muted">-</span>
                                                                    )}
                                                                </td>
                                                                {canManage && (
                                                                    <td className="text-end align-middle">
                                                                        <button
                                                                            className="btn btn-outline-warning btn-sm"
                                                                            onClick={() => this.props.archiveCVE(cve.id)}
                                                                        >
                                                                            Disable
                                                                        </button>
                                                                    </td>
                                                                )}
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                                {renderPagination()}
                                {renderSaveModal()}
                            </Fragment>
                        )}
                    </TableManager>
                )}

                {this.renderDetailModal()}
            </Fragment>
        );
    }
}

const mapStateToProps = state => ({
    cves:          state.CyberWatch.cves,
    watchRuleHits: state.CyberWatch.watchRuleHits || [],
    auth:          state.auth,
});

export default connect(mapStateToProps, { getCVEs, getWatchRuleHits, archiveCVE, archiveHit })(CVEVulnerabilities);
