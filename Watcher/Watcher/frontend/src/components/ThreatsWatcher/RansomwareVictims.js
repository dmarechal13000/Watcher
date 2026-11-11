import React, { Component, Fragment } from 'react';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import TableManager from '../common/TableManager';
import DateWithTooltip from '../common/DateWithTooltip';
import { getRansomwareVictims, getWatchRuleHits, archiveVictim, archiveHit } from '../../actions/CyberWatch';
import { ISO2_TO_GEO, isoToFlag } from '../../utils/isoCountries';
import { Badge } from 'react-bootstrap';
import { DetailDrawer, DrawerSection, DrawerFields, rowOpenProps } from '../common/DetailDrawer';
import { claimDetail, onDetailRequest } from '../common/detailFocus';
import { claimFilters, withFilterDefaults } from '../common/pendingFilters';

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

const FILTER_CONFIG = [
    {
        key: 'search',
        type: 'search',
        label: 'Search',
        placeholder: 'Search victim or group...',
        width: 2,
    },
    {
        key: 'country',
        type: 'select',
        label: 'Country',
        width: 2,
        options: [],
    },    
    {
        key: 'sector',
        type: 'select',
        label: 'Sector',
        width: 2,
        options: [],
    },
];

class RansomwareVictims extends Component {
    constructor(props) {
        super(props);
        // Filter requested by a click on the Statistics tab (see common/pendingFilters)
        this.anchorRef = React.createRef();
        this.requestedFilters = claimFilters('victims');
        this.state = {
            activeTab: 'all', // 'hits' or 'all'
            selectedHit:     null,
            showDetailModal: false,
            selectedVictim: null,
        };
    }

    static propTypes = {
        ransomwareVictims: PropTypes.array.isRequired,
        watchRuleHits: PropTypes.array.isRequired,
        getRansomwareVictims: PropTypes.func.isRequired,
        getWatchRuleHits: PropTypes.func.isRequired,
        archiveVictim: PropTypes.func.isRequired,
        archiveHit: PropTypes.func.isRequired,
        auth: PropTypes.object.isRequired,
        filterCountry: PropTypes.string,
        onCountrySelect: PropTypes.func,
        onVictimClick: PropTypes.func,
    };

    componentWillUnmount() {
        if (this._unwatchDetail) this._unwatchDetail();
    }

    // Open a record requested from the command palette (Ctrl+K) once it is in the list
    claimPendingDetail = () => {
        const item = claimDetail('victim', id => (this.props.ransomwareVictims).find(x => String(x.id) === id));
        if (item) { this.setState({ activeTab: 'all' }); this.openVictimDetail(item); }
    };

    componentDidMount() {
        if (this.requestedFilters) {
            // Arriving from a chart click: bring the filtered table into view
            setTimeout(() => this.anchorRef.current && this.anchorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400);
        }
        this._unwatchDetail = onDetailRequest(this.claimPendingDetail);
        this.claimPendingDetail();
        if (!this.props.ransomwareVictims.length) {
            this.props.getRansomwareVictims();
        }
        if (!this.props.watchRuleHits.length) {
            this.props.getWatchRuleHits();
        }
    }

    componentDidUpdate(prevProps) {
        if (prevProps.ransomwareVictims !== this.props.ransomwareVictims) this.claimPendingDetail();
    }

    getRansomwareHits = () => {
        const { watchRuleHits } = this.props;
        return watchRuleHits.filter(h => h.hit_type === 'ransomware_victim');
    };

    getVictimForHit = (hit) => {
        // object_id format: "GroupName::VictimName"
        const parts = (hit.object_id || '').split('::');
        const victimName = parts.length >= 2 ? parts.slice(1).join('::') : parts[0];
        const groupName  = parts.length >= 2 ? parts[0] : null;
        return this.props.ransomwareVictims.find(v => {
            const nameMatch = v.victim_name === victimName;
            if (!nameMatch) return false;
            if (groupName) return (v.group_name || '') === groupName || (v.group || '') === groupName;
            return true;
        }) || null;
    };

    openDetailModal = (hit) =>
        this.setState({ selectedHit: hit, selectedVictim: null, showDetailModal: true });

    openVictimDetail = (victim) =>
        this.setState({ selectedHit: null, selectedVictim: victim, showDetailModal: true });

    // Keep the selection while the drawer slides out; it is replaced on the next open.
    closeDetailModal = () =>
        this.setState({ showDetailModal: false });

    renderDetailModal = () => {
        const { selectedHit, selectedVictim, showDetailModal } = this.state;
        if (!selectedHit && !selectedVictim) return null;
        const victim = selectedVictim || this.getVictimForHit(selectedHit);
        const parts = ((selectedHit && selectedHit.object_id) || '').split('::');
        const name = victim ? victim.victim_name : (parts.length >= 2 ? parts.slice(1).join('::') : parts[0]);
        const group = victim ? (victim.group_name || victim.group) : (parts.length >= 2 ? parts[0] : null);
        const sector = victim && victim.sector && victim.sector !== 'Not Found' ? victim.sector : null;
        const country = victim && victim.country && victim.country !== '-' ? victim.country : null;

        return (
            <DetailDrawer
                show={showDetailModal}
                onHide={this.closeDetailModal}
                icon="lock"
                title={name}
                subtitle={group ? `Claimed by ${group}` : 'Ransomware victim'}
                badges={(group || country) ? (
                    <>
                        {group && <Badge bg="danger">{group}</Badge>}
                        {country && <Badge bg="secondary">{isoToFlag(country)} {country}</Badge>}
                        {sector && <Badge bg="secondary">{sector}</Badge>}
                    </>
                ) : null}
                actions={victim && victim.url ? (
                    <a href={victim.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                        <i className="material-icons" aria-hidden="true">open_in_new</i>
                        Open source page
                    </a>
                ) : null}
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

                {victim ? (
                    <DrawerSection title="Attack" icon="gavel">
                        <DrawerFields items={[
                            { label: 'Group', value: group },
                            { label: 'Country', value: country && `${isoToFlag(country)} ${country}` },
                            { label: 'Sector', value: sector },
                            { label: 'Attacked', value: victim.attacked_at && <DateWithTooltip date={victim.attacked_at} includeTime={false} type="created" /> },
                            { label: 'Collected', value: victim.fetched_at && <DateWithTooltip date={victim.fetched_at} includeTime={true} type="created" /> },
                            { label: 'Source page', value: victim.url && <a href={victim.url} target="_blank" rel="noopener noreferrer">{victim.url}</a>, mono: true, wide: true },
                        ]} />
                    </DrawerSection>
                ) : (
                    <DrawerSection title="Attack" icon="gavel">
                        <p className="wt-drawer-text text-muted fst-italic">
                            {(selectedHit && selectedHit.hit_display) || 'No additional details available.'}
                        </p>
                    </DrawerSection>
                )}
            </DetailDrawer>
        );
    };

    customFilters = (filtered, filters) => {
        if (filters.search) {
            const t = filters.search.toLowerCase();
            filtered = filtered.filter(v =>
                (v.victim_name || '').toLowerCase().includes(t) ||
                (v.group_name  || '').toLowerCase().includes(t)
            );
        }

        if (filters.sector) {
            filtered = filtered.filter(v =>
                (v.sector || '').toLowerCase() === filters.sector.toLowerCase()
            );
        }

        if (filters.country) {
            filtered = filtered.filter(v => (v.country || '') === filters.country);
        }

        return filtered;
    };

    render() {
        const { ransomwareVictims, filterCountry, auth } = this.props;
        const { activeTab } = this.state;
        const { isAuthenticated, user } = auth;
        const canManage = isAuthenticated && !!user && (user.is_superuser || user.is_staff || (Array.isArray(user.permissions) && user.permissions.some(p => p === 'cyber_watch.change_ransomwarevictim' || p === 'cyber_watch.delete_ransomwarevictim')));
        const ransomwareHits = this.getRansomwareHits();

        // Pre-filter by country so TableManager sees a new data prop and re-applies filters.
        // If the country filter yields 0 results, fall back to showing all victims.
        const filteredByCountry = filterCountry
            ? ransomwareVictims.filter(v => v.country === filterCountry)
            : ransomwareVictims;
        const data = activeTab === 'all'
            ? (filteredByCountry.length > 0 ? filteredByCountry : ransomwareVictims)
            : ransomwareHits;

        // Build sector and country options dynamically from data
        const sectors = [...new Set(
            ransomwareVictims
                .map(v => v.sector)
                .filter(s => s && s !== 'Not Found')
        )].sort();
        const countries = [...new Set(
            ransomwareVictims
                .map(v => v.country)
                .filter(c => c && c !== '-')
        )].sort();
        const filterConfig = FILTER_CONFIG.map(f => {
            if (f.key === 'sector') return { ...f, options: sectors.map(s => ({ value: s, label: s })) };
            if (f.key === 'country') return { ...f, options: countries.map(c => ({ value: c, label: c })) };
            return f;
        });

        const ruleNames = [...new Set(ransomwareHits.map(h => h.rule_name).filter(Boolean))].sort();
        const hitsFilterConfig = [
            { key: 'search', type: 'search', label: 'Search', placeholder: 'Search by rule, match or keyword...', width: 4 },
            { key: 'rule_name', type: 'select', label: 'Rule', width: 2, options: ruleNames.map(r => ({ value: r, label: r })) },
        ];

        // Country display
        const countryName = filterCountry ? (ISO2_TO_GEO[filterCountry] || filterCountry) : null;

        return (
            <Fragment>
                <span ref={this.anchorRef} className="wt-scroll-anchor" aria-hidden="true" />
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <h4 className="mb-0 wt-panel-heading">Ransomware Victims</h4>
                    {countryName && (
                        <div
                            className="d-flex align-items-center gap-1 px-2 py-1"
                            style={{
                                background: 'rgba(13,110,253,0.1)',
                                border: '1.5px solid #0d6efd',
                                borderRadius: 20,
                                fontSize: '0.85rem',
                                color: '#0d6efd',
                                fontWeight: 500,
                            }}
                        >
                            <span style={{ fontSize: '1rem' }}>{isoToFlag(filterCountry)}</span>
                            <span>{countryName}</span>
                            {this.props.onCountrySelect && (
                                <button
                                    className="btn btn-sm p-0 ms-1"
                                    style={{ color: '#dc3545', lineHeight: 1 }}
                                    title="Clear country filter"
                                    onClick={() => this.props.onCountrySelect(null)}
                                >
                                    <i className="material-icons" style={{ fontSize: '1rem' }}>close</i>
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <ul className="nav nav-tabs mb-3">
                    <li className="nav-item">
                        <button
                            className={`nav-link ${activeTab === 'hits' ? 'active' : ''}`}
                            onClick={() => this.setState({ activeTab: 'hits' })}
                        >
                            My Watch Rules Hits ({ransomwareHits.length})
                        </button>
                    </li>
                    <li className="nav-item">
                        <button
                            className={`nav-link ${activeTab === 'all' ? 'active' : ''}`}
                            onClick={() => this.setState({ activeTab: 'all' })}
                        >
                            All Victims ({ransomwareVictims.length})
                        </button>
                    </li>
                </ul>

                {activeTab === 'hits' ? (
                    <TableManager
                        data={data}
                        filterConfig={hitsFilterConfig}
                        searchFields={['rule_name', 'hit_display', 'matched_keyword']}
                        dateFields={['hit_at']}
                        defaultSort="hit_at"
                        customFilters={(filtered, filters) => {
                            if (filters.rule_name) {
                                filtered = filtered.filter(h => h.rule_name === filters.rule_name);
                            }
                            return filtered;
                        }}
                        onItemsPerPageChange={this.props.onItemsPerPageChange}
                        enableDateFilter={true}
                        dateFilterWidth={4}
                        moduleKey="threatsWatcher_victimHits"
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
                            theadRef,
                        }) => (
                            <Fragment>
                                {renderFilterControls()}
                                {renderFilters()}
                                {renderItemsInfo()}

                                <div className="row">
                                    <div className="col-12">
                                        <div style={{ ...getTableContainerStyle(), overflowX: 'auto' }}>
                                            <table className="table table-striped table-hover mb-0" style={{ fontSize: '0.95rem' }}>
                                                <thead ref={theadRef}>
                                                    <tr>
                                                        <th role="button" onClick={() => handleSort('rule_name')}>
                                                            Rule {renderSortIcons('rule_name')}
                                                        </th>
                                                        <th role="button" onClick={() => handleSort('object_id')}>
                                                            Victim {renderSortIcons('object_id')}
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
                                                        <EmptyHitsState type="ransomware victims" />
                                                    ) : (
                                                        paginatedData.map(hit => {
                                                            const parts = (hit.object_id || '').split('::');
                                                            const victimName = parts.length >= 2 ? parts.slice(1).join('::') : parts[0];
                                                            const groupName  = parts.length >= 2 ? parts[0] : null;
                                                            return (
                                                                <tr
                                                                    key={hit.id}
                                                                    {...rowOpenProps(
                                                                        () => this.openDetailModal(hit),
                                                                        this.state.showDetailModal && this.state.selectedHit?.id === hit.id
                                                                    )}
                                                                >
                                                                    <td className="align-middle fw-semibold">{hit.rule_name}</td>
                                                                    <td className="align-middle">
                                                                        <span className="fw-medium">{victimName}</span>
                                                                        {groupName && (
                                                                            <span className="ms-2">
                                                                                <Badge bg="danger" style={{ fontSize: '0.75em' }}>{groupName}</Badge>
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td className="align-middle">
                                                                        <span className="badge bg-secondary">{hit.matched_keyword}</span>
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
                ) : (
                    <TableManager
                        data={data}
                        filterConfig={withFilterDefaults(filterConfig, this.requestedFilters)}
                        revealFilters={!!this.requestedFilters}
                        searchFields={['victim_name', 'group_name']}
                        dateFields={['attacked_at']}
                        defaultSort="attacked_at"
                        customFilters={this.customFilters}
                        onItemsPerPageChange={this.props.onItemsPerPageChange}
                        enableDateFilter={true}
                        dateFilterWidth={4}
                        moduleKey="threatsWatcher_ransomwareVictims"
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
                            theadRef,
                        }) => (
                            <Fragment>
                                {renderFilterControls()}
                                {renderFilters()}
                                {renderItemsInfo()}

                            <div className="row">
                                <div className="col-12">
                                    <div style={{ ...getTableContainerStyle(), overflowX: 'auto' }}>
                                        <table className="table table-striped table-hover mb-0" style={{ fontSize: '0.95rem' }}>
                                            <thead ref={theadRef}>
                                                <tr>
                                                    <th className="user-select-none" role="button"
                                                        onClick={() => handleSort('victim_name')}>
                                                        Victim {renderSortIcons('victim_name')}
                                                    </th>
                                                    <th className="user-select-none" role="button"
                                                        onClick={() => handleSort('group_name')}>
                                                        Group {renderSortIcons('group_name')}
                                                    </th>
                                                    <th className="text-center user-select-none" role="button"
                                                        onClick={() => handleSort('country')}>
                                                        Country {renderSortIcons('country')}
                                                    </th>
                                                    <th className="text-center user-select-none" role="button"
                                                        onClick={() => handleSort('sector')}>
                                                        Sector {renderSortIcons('sector')}
                                                    </th>
                                                    <th className="text-center user-select-none" role="button"
                                                        onClick={() => handleSort('attacked_at')}>
                                                        Attacked {renderSortIcons('attacked_at')}
                                                    </th>
                                                    {canManage && <th className="text-center">Actions</th>}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {paginatedData.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="6" className="text-center text-muted py-4">
                                                            {countryName
                                                                ? `No results found in ${countryName}`
                                                                : 'No results found'}
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    paginatedData.map(v => (
                                                        <tr
                                                            key={v.id}
                                                            {...rowOpenProps(
                                                                () => this.openVictimDetail(v),
                                                                this.state.showDetailModal && this.state.selectedVictim?.id === v.id
                                                            )}
                                                        >
                                                            <td className="align-middle fw-medium">
                                                                {v.victim_name}
                                                            </td>
                                                            <td className="align-middle">
                                                                <span className="badge bg-danger" style={{ fontSize: 'inherit', padding: '0.3rem 0.55rem' }}>
                                                                    {v.group_name || v.group}
                                                                </span>
                                                            </td>
                                                            <td className="text-center align-middle">
                                                                {v.country && v.country !== '-' ? (
                                                                    <span className="badge bg-secondary" style={{ fontSize: 'inherit', padding: '0.3rem 0.55rem' }}>
                                                                        {v.country}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-muted">-</span>
                                                                )}
                                                            </td>
                                                            <td className="text-center align-middle">
                                                                {v.sector && v.sector !== 'Not Found'
                                                                    ? <span className="text-muted">{v.sector}</span>
                                                                    : <span className="text-muted">-</span>
                                                                }
                                                            </td>
                                                            <td className="text-center align-middle">
                                                                <DateWithTooltip
                                                                    date={v.attacked_at}
                                                                    includeTime={false}
                                                                    type="created"
                                                                />
                                                            </td>
                                                            {canManage && (
                                                                <td className="text-center align-middle" onClick={e => e.stopPropagation()}>
                                                                    <button
                                                                        className="btn btn-outline-warning btn-sm"
                                                                        onClick={() => this.props.archiveVictim(v.id)}
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
    ransomwareVictims: state.CyberWatch.ransomwareVictims || [],
    watchRuleHits: state.CyberWatch.watchRuleHits || [],
    auth: state.auth,
});

export default connect(mapStateToProps, { getRansomwareVictims, getWatchRuleHits, archiveVictim, archiveHit })(RansomwareVictims);
