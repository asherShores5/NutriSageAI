// Pure helpers — no DOM, no network. Shared by script.js (browser global) and macros.test.js (node).

function num(v) {
    return Number(v) || 0;
}

const MACRO_KEYS = ['carbs', 'protein', 'fat', 'fiber', 'sodium', 'calories'];

function sumMacros(entries) {
    return (entries || []).reduce((acc, entry) => {
        const m = (entry && entry.macros) || {};
        MACRO_KEYS.forEach((k) => { acc[k] += num(m[k]); });
        return acc;
    }, Object.fromEntries(MACRO_KEYS.map((k) => [k, 0])));
}

// YYYY-MM-DD for a Date (local time, not UTC — the day boundary should match the user's).
function dateKey(d) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// The 7 date keys ending at (and including) `endKey`, oldest first. Pure string/Date math.
function weekKeys(endKey) {
    const [y, m, d] = endKey.split('-').map(Number);
    const end = new Date(y, m - 1, d);
    const keys = [];
    for (let i = 6; i >= 0; i--) {
        const dt = new Date(end);
        dt.setDate(end.getDate() - i);
        keys.push(dateKey(dt));
    }
    return keys;
}

// Sum a week of days. `days` is {dateKey: {entries:[...]}}. Returns combined macro totals.
function sumWeek(days, endKey) {
    return weekKeys(endKey).reduce((acc, k) => {
        const t = sumMacros((days[k] || {}).entries);
        MACRO_KEYS.forEach((key) => { acc[key] += t[key]; });
        return acc;
    }, Object.fromEntries(MACRO_KEYS.map((k) => [k, 0])));
}

// Percent of goal, clamped 0..100 for a progress bar. goal<=0 -> 0 (no goal set).
function pct(value, goal) {
    if (!goal || goal <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((num(value) / goal) * 100)));
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { num, sumMacros, dateKey, weekKeys, sumWeek, pct, MACRO_KEYS };
}
