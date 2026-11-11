// Filters requested from a Statistics tab (click on a chart) and applied by the Surveillance
// tab when it mounts: the table's filter starts with that value and the filter panel opens.
// Requests are scoped (e.g. 'data_leak', 'cve') and expire after a minute.

const TTL_MS = 60 * 1000;
const pending = {};

export const requestFilters = (scope, filters) => {
    pending[scope] = { filters, at: Date.now() };
};

// Returns the requested filters once (then forgets them), or null.
export const claimFilters = (scope) => {
    const entry = pending[scope];
    delete pending[scope];
    if (!entry || Date.now() - entry.at > TTL_MS) return null;
    return entry.filters;
};

// Applies claimed filters as default values of a TableManager filter configuration.
export const withFilterDefaults = (config, filters) => (
    filters ? config.map(f => (filters[f.key] !== undefined ? { ...f, defaultValue: filters[f.key] } : f)) : config
);
