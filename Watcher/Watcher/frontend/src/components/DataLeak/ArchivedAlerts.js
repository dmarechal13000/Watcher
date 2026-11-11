import React, {Component, Fragment} from 'react';
import {connect} from 'react-redux';
import PropTypes from 'prop-types';
import {getAlerts, updateAlertStatus} from "../../actions/DataLeak";
import {Button, Modal, InputGroup, FormControl, Form} from 'react-bootstrap';
import TableManager from '../common/TableManager';
import DateWithTooltip from '../common/DateWithTooltip';
import { DATALEAK_ALERT_BULK } from '../../actions/DataLeak';
import { LoadingRows, EmptyRow } from '../common/TableStates';
import { rowOpenProps } from '../common/DetailDrawer';
import AlertDrawer from './AlertDrawer';
import { claimDetail, onDetailRequest } from '../common/detailFocus';

export class ArchivedAlerts extends Component {
    constructor(props) {
        super(props);
        this.state = {
            show: false,
            showContentModal: false,
            id: 0,
            keyword: "",
            content: "",
            isLoading: true
        };
    }

    static propTypes = {
        alerts: PropTypes.array.isRequired,
        getAlerts: PropTypes.func.isRequired,
        updateAlertStatus: PropTypes.func.isRequired,
        auth: PropTypes.object.isRequired,
        globalFilters: PropTypes.object,
        filteredData: PropTypes.array
    };

    componentWillUnmount() {
        if (this._unwatchDetail) this._unwatchDetail();
    }

    // Open a record requested from the command palette (Ctrl+K) once it is in the list
    claimPendingDetail = () => {
        const item = claimDetail('leak-alert', id => ((this.props.alerts || []).filter(a => a.status === false)).find(x => String(x.id) === id));
        if (item) { this.openAlertDetail(item); }
    };

    componentDidMount() {
        this._unwatchDetail = onDetailRequest(this.claimPendingDetail);
        this.claimPendingDetail();
        this.props.getAlerts();
    }

    componentDidUpdate(prevProps) {
        if (prevProps.alerts !== this.props.alerts) this.claimPendingDetail();
        if (this.props.alerts !== prevProps.alerts && this.state.isLoading) {
            this.setState({ isLoading: false });
        }
    }

    customFilters = (filtered, filters) => {
        const alertsToFilter = this.props.filteredData || this.props.alerts;
        const { globalFilters = {} } = this.props;
        
        filtered = (alertsToFilter || []).filter(alert => alert && alert.status === false);

        if (globalFilters.search) {
            const searchTerm = globalFilters.search.toLowerCase();
            filtered = filtered.filter(alert =>
                (alert.keyword?.name || '').toLowerCase().includes(searchTerm) ||
                (alert.content || '').toLowerCase().includes(searchTerm) ||
                (alert.url || '').toLowerCase().includes(searchTerm) ||
                (alert.id || '').toString().includes(searchTerm)
            );
        }

        if (globalFilters.keyword) {
            filtered = filtered.filter(alert => 
                alert.keyword?.name === globalFilters.keyword
            );
        }

        if (globalFilters.source) {
            filtered = filtered.filter(alert => {
                if (!alert.url) return false;
                try {
                    const domain = alert.url.split('//', 2)[1].split('/', 20)[0];
                    return domain === globalFilters.source;
                } catch {
                    return false;
                }
            });
        }

        return filtered;
    };

    displayModal = (id) => {
        this.setState({ show: true, id });
    };

    openAlertDetail = (alert) => {
        this.setState({ showContentModal: true, selectedAlert: alert });
    };

    modal = () => {
        const handleClose = () => this.setState({ show: false });

        const onSubmit = e => {
            e.preventDefault();
            const status = true;
            const json_status = { status };
            this.props.updateAlertStatus(this.state.id, json_status);
            this.setState({ id: 0 });
            handleClose();
        };

        return (
            <Modal show={this.state.show} onHide={handleClose} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Action Requested</Modal.Title>
                </Modal.Header>
                <Modal.Body>Are you sure you want to <u><b>enable</b></u> this alert?</Modal.Body>
                <Modal.Footer>
                    <form onSubmit={onSubmit}>
                        <Button variant="secondary" className="me-2" onClick={handleClose}>
                            Close
                        </Button>
                        <Button type="submit" variant="warning">
                            Yes, I'm sure
                        </Button>
                    </form>
                </Modal.Footer>
            </Modal>
        );
    };

    getTitleAtUrl = (url) => {
        const lastChar = url.substr(url.length - 1);
        if (lastChar === '/') {
            const urlTab = url.split('/', 20);
            return urlTab[urlTab.length - 2];
        } else {
            return url.split('/', 20).pop();
        }
    };

    renderLoadingState = () => (
        <LoadingRows colSpan={7} />
    );

    render() {
        const { globalFilters, filteredData } = this.props;
        const dataToUse = filteredData || this.props.alerts;
        const { isAuthenticated, user } = this.props.auth || {};
        const canManage = isAuthenticated && !!user && (user.is_superuser || user.is_staff || (Array.isArray(user.permissions) && user.permissions.includes('data_leak.change_alert')));

        return (
            <Fragment>
                <div className="row">
                    <div className="col-lg-12">
                        <div className="d-flex justify-content-between align-items-center" style={{marginBottom: 12}}>
                            <h4 className="wt-panel-heading">Archived Alerts</h4>
                        </div>
                    </div>
                </div>

                <TableManager
                    data={dataToUse}
                    filterConfig={[]}
                    customFilters={this.customFilters}
                    searchFields={['keyword.name', 'content', 'url', 'id']}
                    dateFields={['created_at']}
                    defaultSort="created_at"
                    globalFilters={globalFilters}
                    moduleKey="dataLeak_archived"
                    bulkActions={canManage ? {
                        target: DATALEAK_ALERT_BULK,
                        label: 'archived data leak alerts',
                        canDelete: false,
                        updateFields: [{
                            field: 'status',
                            label: 'Status',
                            type: 'select',
                            options: [{ value: true, label: 'Active' }, { value: false, label: 'Archived' }]
                        }]
                    } : undefined}
                >
                    {({
                        paginatedData,
                        renderItemsInfo,
                        renderPagination,
                        handleSort,
                        renderSortIcons,
                        getTableContainerStyle,
                        theadRef,
                        renderSelectAll,
                        renderSelectRow,
                        renderBulkBar
                    }) => (
                        <Fragment>
                            {renderItemsInfo()}
                            {renderBulkBar()}

                            <div className="row">
                                <div className="col-lg-12">
                                    <div style={{ ...getTableContainerStyle(),  overflowX: 'auto' }}>
                                        <table className="table table-striped table-hover">
                                            <thead ref={theadRef}>
                                                <tr>
                                                    {canManage && <th style={{ width: 32 }}>{renderSelectAll()}</th>}
                                                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('id')}>
                                                        ID{renderSortIcons('id')}
                                                    </th>
                                                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('keyword.name')}>
                                                        Keyword{renderSortIcons('keyword.name')}
                                                    </th>
                                                    <th>From</th>
                                                    <th>Info</th>
                                                    <th>Source</th>
                                                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('created_at')}>
                                                        Created At{renderSortIcons('created_at')}
                                                    </th>
                                                    <th/>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {this.state.isLoading ? (
                                                    this.renderLoadingState()
                                                ) : paginatedData.length === 0 ? (
                                                    <EmptyRow colSpan={7} />
                                                ) : (
                                                    paginatedData.map(alert => {
                                                        if (!alert || !alert.url) {
                                                            return null;
                                                        }

                                                        let domainName = 'Unknown';
                                                        try {
                                                            domainName = alert.url.split('//', 2)[1].split('/', 20)[0];
                                                        } catch (error) {
                                                            console.error('Error parsing domain from URL:', error);
                                                        }

                                                        let pastContentButton;
                                                        if (domainName === "pastebin.com") {
                                                            pastContentButton = (
                                                                <button 
                                                                    onClick={() => this.openAlertDetail(alert)}
                                                                    className="btn btn-info btn-sm ms-2"
                                                                >
                                                                    Content
                                                                </button>
                                                            );
                                                        }
                                                        
                                                        return (
                                                            <tr
                                                                key={alert.id}
                                                                {...rowOpenProps(
                                                                    () => this.openAlertDetail(alert),
                                                                    this.state.showContentModal && this.state.selectedAlert?.id === alert.id
                                                                )}
                                                            >
                                                                {canManage && <td>{renderSelectRow(alert)}</td>}
                                                                <td><h5>#{alert.id}</h5></td>
                                                                <td>{alert.keyword?.name || '-'}</td>
                                                                <td>{domainName}</td>
                                                                <td><h5>{this.getTitleAtUrl(alert.url)}</h5></td>
                                                                <td style={{whiteSpace: 'nowrap'}}>
                                                                    <button 
                                                                        onClick={() => window.open(alert.url, '_blank', 'noreferrer')} 
                                                                        rel="noreferrer"
                                                                        className="btn btn-primary btn-sm"
                                                                    >
                                                                        Link
                                                                    </button>
                                                                    {pastContentButton}
                                                                </td>
                                                                <td>
                                                                    <DateWithTooltip 
                                                                        date={alert.created_at} 
                                                                        includeTime={true}
                                                                        type="created"
                                                                    />
                                                                </td>
                                                                <td>
                                                                    <button 
                                                                        onClick={() => this.displayModal(alert.id)}
                                                                        className="btn btn-outline-primary btn-sm"
                                                                    >
                                                                        Enable
                                                                    </button>
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
                        </Fragment>
                    )}
                </TableManager>

                {this.modal()}
                <AlertDrawer
                    alert={this.state.selectedAlert}
                    show={this.state.showContentModal}
                    onHide={() => this.setState({ showContentModal: false })}
                />
            </Fragment>
        );
    }
}

const mapStateToProps = state => ({
    alerts: state.DataLeak.alerts,
    auth: state.auth
});

export default connect(mapStateToProps, { getAlerts, updateAlertStatus })(ArchivedAlerts);