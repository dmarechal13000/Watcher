import moment from 'moment';

// Helpers for the module Statistics pages: time buckets over a selectable period.

export const PERIODS = [
    { days: 7,  label: '7 days' },
    { days: 30, label: '30 days' },
    { days: 90, label: '90 days' },
];

// Daily buckets up to 30 days, weekly beyond (90 days -> 13 bars), oldest -> newest.
export const buildBuckets = (days) => {
    const weekly = days > 31;
    const size = weekly ? 7 : 1;
    const count = Math.ceil(days / size);
    const end = moment().endOf('day');
    const buckets = Array.from({ length: count }, (_, i) => {
        const stop = end.clone().subtract((count - 1 - i) * size, 'days');
        const start = stop.clone().subtract(size, 'days').add(1, 'ms');
        return {
            start,
            stop,
            label: weekly ? `${start.format('D MMM')}` : (days <= 7 ? stop.format('ddd') : stop.format('D MMM')),
            title: weekly ? `Week of ${start.format('D MMM')}` : stop.format('dddd D MMMM'),
        };
    });
    const since = buckets[0].start;
    const indexOf = (date) => {
        if (!date) return -1;
        const d = moment(date);
        if (!d.isValid() || d.isBefore(since) || d.isAfter(end)) return -1;
        return Math.min(count - 1, Math.floor(d.diff(since, 'days') / size));
    };
    return { buckets, labels: buckets.map(b => b.label), titles: buckets.map(b => b.title), indexOf, since, weekly };
};

export const inPeriod = (date, since) => !!date && moment(date).isSameOrAfter(since);

export const countByBucket = (items, dateOf, buckets, predicate = null) => {
    const counts = new Array(buckets.buckets.length).fill(0);
    items.forEach(item => {
        if (predicate && !predicate(item)) return;
        const i = buckets.indexOf(dateOf(item));
        if (i >= 0) counts[i]++;
    });
    return counts;
};

// Top N values of a key, the rest folded into "Other" when asked.
export const topCounts = (items, keyOf, n = 5, withOther = false) => {
    const map = {};
    items.forEach(item => {
        const k = keyOf(item);
        if (k === null || k === undefined || k === '') return;
        map[k] = (map[k] || 0) + 1;
    });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, n);
    if (withOther) {
        const rest = sorted.slice(n).reduce((s, [, v]) => s + v, 0);
        if (rest > 0) top.push(['Other', rest]);
    }
    return top;
};
