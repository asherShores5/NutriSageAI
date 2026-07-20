// Run with: node docs/macros.test.js
const assert = require('assert');
const { num, sumMacros, dateKey, weekKeys, lastDays, sumWeek, scaleMacros, portionLabel, parsePortion, adjustEntry, weekStats, streak, pct } = require('./macros.js');

// num() coerces junk to 0, keeps real numbers
assert.strictEqual(num('12'), 12);
assert.strictEqual(num(undefined), 0);
assert.strictEqual(num('abc'), 0);
assert.strictEqual(num(3.5), 3.5);

// sumMacros() tolerates missing / non-numeric fields
assert.deepStrictEqual(
    sumMacros([
        { food: 'a', macros: { carbs: 10, protein: 5, fat: 2, fiber: 3, sodium: 200, iron: 1.5, calories: 100 } },
        { food: 'b', macros: { carbs: '20', protein: null, sodium: '50', iron: '0.5', calories: 'x' } },
        { food: 'c' }
    ]),
    { carbs: 30, protein: 5, fat: 2, fiber: 3, sodium: 250, iron: 2, calories: 100 }
);
assert.deepStrictEqual(sumMacros([]), { carbs: 0, protein: 0, fat: 0, fiber: 0, sodium: 0, iron: 0, calories: 0 });
assert.deepStrictEqual(sumMacros(null), { carbs: 0, protein: 0, fat: 0, fiber: 0, sodium: 0, iron: 0, calories: 0 });

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

// lastDays() -> n keys oldest-first, weekKeys is the 7-day case
assert.deepStrictEqual(lastDays('2026-03-03', 3), ['2026-03-01', '2026-03-02', '2026-03-03']);
assert.strictEqual(lastDays('2026-03-03', 30).length, 30);

// scaleMacros() scales every key, rounds to 0.1, default-safe on junk
assert.deepStrictEqual(
    scaleMacros({ carbs: 10, protein: 5, fat: 2, fiber: 3, sodium: 200, iron: 1.5, calories: 100 }, 2),
    { carbs: 20, protein: 10, fat: 4, fiber: 6, sodium: 400, iron: 3, calories: 200 }
);
assert.deepStrictEqual(
    scaleMacros({ carbs: 10, calories: 100 }, 0.5),
    { carbs: 5, protein: 0, fat: 0, fiber: 0, sodium: 0, iron: 0, calories: 50 }
);
assert.strictEqual(scaleMacros({ calories: 33 }, 0.5).calories, 16.5); // rounds to 0.1

// portionLabel/parsePortion are inverses; 1× has no suffix
assert.strictEqual(portionLabel('eggs', 1), 'eggs');
assert.strictEqual(portionLabel('eggs', 2), 'eggs (×2)');
assert.deepStrictEqual(parsePortion('eggs'), { name: 'eggs', factor: 1 });
assert.deepStrictEqual(parsePortion('eggs (×2)'), { name: 'eggs', factor: 2 });
assert.deepStrictEqual(parsePortion('eggs (×1.5)'), { name: 'eggs', factor: 1.5 });
assert.deepStrictEqual(parsePortion('bag (of chips)'), { name: 'bag (of chips)', factor: 1 }); // only ×N suffix counts

// adjustEntry() re-scales from the recovered 1× base, relabels, keeps meal
const e2 = adjustEntry({ food: 'eggs', macros: { carbs: 10, calories: 100 }, meal: 'lunch' }, 2);
assert.strictEqual(e2.food, 'eggs (×2)');
assert.strictEqual(e2.macros.calories, 200);
assert.strictEqual(e2.meal, 'lunch');
const back = adjustEntry(e2, 1); // 2× back to 1× recovers the base and drops the suffix
assert.strictEqual(back.food, 'eggs');
assert.strictEqual(back.macros.calories, 100);

// weekStats() averages over LOGGED days only (2 logged of 7 here)
const stats = weekStats(days, '2026-03-03');
assert.strictEqual(stats.logged, 2);
assert.strictEqual(stats.avg.calories, 150); // (100+200)/2
assert.strictEqual(stats.avg.protein, 15);   // (10+20)/2
assert.strictEqual(weekStats({}, '2026-03-03').avg.calories, 0); // no divide-by-zero

// streak() counts consecutive logged days back from endKey
const strk = {
    '2026-03-01': { entries: [{ macros: {} }] },
    '2026-03-02': { entries: [{ macros: {} }] },
    '2026-03-03': { entries: [{ macros: {} }] },
};
assert.strictEqual(streak(strk, '2026-03-03'), 3);
assert.strictEqual(streak(strk, '2026-03-04'), 3); // unlogged "today" doesn't break it (grace)
assert.strictEqual(streak(strk, '2026-03-05'), 0); // missed a full day -> broken
assert.strictEqual(streak({ '2026-03-02': { entries: [] } }, '2026-03-02'), 0); // empty entries != logged

console.log('macros.test.js: all assertions passed');
