import React from 'react';
import PropTypes from 'prop-types';
import { Badge } from 'react-bootstrap';
import DateWithTooltip from '../common/DateWithTooltip';
import { DetailDrawer, DrawerSection, DrawerFields } from '../common/DetailDrawer';

const hostOf = url => {
    try { return new URL(url).hostname; } catch (_) { return url || ''; }
};

const download = (filename, text) => {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
};

// Detail panel for a data leak alert (active or archived), including its raw content when captured.
const AlertDrawer = ({ alert, show, onHide }) => {
    if (!alert) return null;
    const keyword = alert.keyword?.name || '-';
    const active = alert.status !== false;

    return (
        <DetailDrawer
            show={show}
            onHide={onHide}
            icon="policy"
            title={<>Alert #{alert.id}</>}
            subtitle={<>“{keyword}” found on {hostOf(alert.url)}</>}
            badges={
                <>
                    <Badge bg={active ? 'warning' : 'secondary'}>{active ? 'Active' : 'Archived'}</Badge>
                    <Badge bg="secondary">{keyword}</Badge>
                </>
            }
            actions={
                <>
                    {alert.content && (
                        <button type="button" className="btn btn-secondary wt-btn-ghost" onClick={() => download(`#${alert.id}_raw.txt`, alert.content)}>
                            <i className="material-icons" aria-hidden="true">file_download</i>
                            Download raw
                        </button>
                    )}
                    {alert.url && (
                        <a href={alert.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                            <i className="material-icons" aria-hidden="true">open_in_new</i>
                            Open source
                        </a>
                    )}
                </>
            }
        >
            <DrawerSection title="Detection" icon="search">
                <DrawerFields items={[
                    { label: 'Keyword', value: keyword },
                    { label: 'Source', value: hostOf(alert.url) },
                    { label: 'Detected', value: alert.created_at && <DateWithTooltip date={alert.created_at} includeTime={true} type="created" /> },
                    { label: 'Status', value: active ? 'Active' : 'Archived' },
                    { label: 'URL', value: alert.url && <a href={alert.url} target="_blank" rel="noopener noreferrer">{alert.url}</a>, mono: true, wide: true },
                ]} />
            </DrawerSection>

            <DrawerSection title="Raw content" icon="description">
                {alert.content ? (
                    <pre className="wt-drawer-code">{alert.content}</pre>
                ) : (
                    <p className="wt-drawer-text text-muted fst-italic">
                        No raw content captured for this source. Open the source to review it.
                    </p>
                )}
            </DrawerSection>
        </DetailDrawer>
    );
};

AlertDrawer.propTypes = {
    alert:  PropTypes.object,
    show:   PropTypes.bool.isRequired,
    onHide: PropTypes.func.isRequired,
};

export default AlertDrawer;
