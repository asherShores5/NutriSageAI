// Pure helpers — no DOM, no network. Shared by script.js (browser global) and macros.test.js (node).

function num(v) {
    return Number(v) || 0;
}

const MACRO_KEYS = ['carbs', 'protein', 'fat', 'fiber', 'sodium', 'iron', 'calories'];

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

// The n date keys ending at (and including) `endKey`, oldest first. Pure string/Date math.
function lastDays(endKey, n) {
    const [y, m, d] = endKey.split('-').map(Number);
    const end = new Date(y, m - 1, d);
    const keys = [];
    for (let i = n - 1; i >= 0; i--) {
        const dt = new Date(end);
        dt.setDate(end.getDate() - i);
        keys.push(dateKey(dt));
    }
    return keys;
}

// The 7 date keys ending at (and including) `endKey`, oldest first.
function weekKeys(endKey) { return lastDays(endKey, 7); }

// Scale every macro by a portion factor (1 = unchanged), rounded to 0.1.
function scaleMacros(macros, factor) {
    const m = macros || {};
    const out = {};
    MACRO_KEYS.forEach((k) => { out[k] = Math.round(num(m[k]) * factor * 10) / 10; });
    return out;
}

// Week averages over LOGGED days (days with ≥1 entry) — averaging over empty days is misleading.
// Returns { avg:{macro:...}, logged, days:7 }.
function weekStats(days, endKey) {
    const keys = weekKeys(endKey);
    const logged = keys.filter((k) => (((days[k] || {}).entries) || []).length > 0).length;
    const total = sumWeek(days, endKey);
    const avg = {};
    MACRO_KEYS.forEach((k) => { avg[k] = logged ? total[k] / logged : 0; });
    return { avg, logged, days: 7 };
}

// Consecutive logged days ending at endKey. Grace: an unlogged "today" doesn't break the streak
// (count from yesterday), so the number only drops once you actually miss a full day.
function streak(days, endKey) {
    const isLogged = (k) => (((days[k] || {}).entries) || []).length > 0;
    const [y, m, d] = endKey.split('-').map(Number);
    const cur = new Date(y, m - 1, d);
    if (!isLogged(dateKey(cur))) cur.setDate(cur.getDate() - 1);
    let n = 0;
    while (isLogged(dateKey(cur))) { n++; cur.setDate(cur.getDate() - 1); }
    return n;
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
    module.exports = { num, sumMacros, dateKey, weekKeys, lastDays, sumWeek, scaleMacros, weekStats, streak, pct, MACRO_KEYS };
}
