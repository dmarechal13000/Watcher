// Cross-component "open this record" requests, used by the command palette (Ctrl+K).
//
// The palette navigates to a module and leaves a request here; the component that owns the
// record claims it once its list is loaded (it may only mount after the navigation) and opens
// its detail drawer. Requests expire after a minute so a stale one never fires later.

const EVENT = 'wt:detail-request';
const TTL_MS = 60 * 1000;
let pending = null;

export const requestDetail = (kind, id) => {
    pending = { kind, id: String(id), at: Date.now() };
    try { window.dispatchEvent(new CustomEvent(EVENT)); } catch (_) { /* ignore */ }
};

// Returns the matching item (and clears the request) when `find(id)` locates it, otherwise null.
export const claimDetail = (kind, find) => {
    if (!pending || pending.kind !== kind) return null;
    if (Date.now() - pending.at > TTL_MS) {
        pending = null;
        return null;
    }
    const item = find(pending.id);
    if (item) pending = null;
    return item || null;
};

export const onDetailRequest = (handler) => {
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
};
