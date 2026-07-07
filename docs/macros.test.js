// Run with: node docs/macros.test.js
const assert = require('assert');
const { num, sumMacros, dateKey, weekKeys, sumWeek, pct } = require('./macros.js');

// num() coerces junk to 0, keeps real numbers
assert.strictEqual(num('12'), 12);
assert.strictEqual(num(undefined), 0);
assert.strictEqual(num('abc'), 0);
assert.strictEqual(num(3.5), 3.5);

// sumMacros() tolerates missing / non-numeric fields
assert.deepStrictEqual(
    sumMacros([
        { food: 'a', macros: { carbs: 10, protein: 5, fat: 2, calories: 100 } },
        { food: 'b', macros: { carbs: '20', protein: null, calories: 'x' } },
        { food: 'c' }
    ]),
    { carbs: 30, protein: 5, fat: 2, calories: 100 }
);
assert.deepStrictEqual(sumMacros([]), { carbs: 0, protein: 0, fat: 0, calories: 0 });
assert.deepStrictEqual(sumMacros(null), { carbs: 0, protein: 0, fat: 0, calories: 0 });

// dateKey() -> zero-padded local YYYY-MM-DD
assert.strictEqual(dateKey(new Date(2026, 0, 5)), '2026-01-05'); // Jan 5
assert.strictEqual(dateKey(new Date(2026, 11, 31)), '2026-12-31');

// weekKeys() -> 7 keys oldest-first ending at endKey, crossing a month boundary correctly
assert.deepStrictEqual(
    weekKeys('2026-03-03'),
    ['2026-02-25', '2026-02-26', '2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02', '2026-03-03']
);

// sumWeek() adds only the days in the trailing week, ignores days outside it
const days = {
    '2026-03-01': { entries: [{ macros: { protein: 10, calories: 100 } }] },
    '2026-03-03': { entries: [{ macros: { protein: 20, calories: 200 } }] },
    '2026-02-20': { entries: [{ macros: { protein: 999, calories: 999 } }] }, // outside the week
};
const wk = sumWeek(days, '2026-03-03');
assert.strictEqual(wk.protein, 30);
assert.strictEqual(wk.calories, 300);

// pct() clamps and handles no-goal
assert.strictEqual(pct(50, 100), 50);
assert.strictEqual(pct(150, 100), 100); // clamped
assert.strictEqual(pct(50, 0), 0);      // no goal
assert.strictEqual(pct(50, undefined), 0);

console.log('macros.test.js: all assertions passed');
