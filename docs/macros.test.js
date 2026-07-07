// Run with: node docs/macros.test.js
const assert = require('assert');
const { num, sumMacros } = require('./macros.js');

// num() coerces junk to 0, keeps real numbers
assert.strictEqual(num('12'), 12);
assert.strictEqual(num(undefined), 0);
assert.strictEqual(num('abc'), 0);
assert.strictEqual(num(3.5), 3.5);

// sumMacros() tolerates missing / non-numeric fields and sums the rest
assert.deepStrictEqual(
    sumMacros([
        { food: 'a', macros: { carbs: 10, protein: 5, fat: 2, calories: 100 } },
        { food: 'b', macros: { carbs: '20', protein: null, calories: 'x' } },
        { food: 'c' } // no macros object at all
    ]),
    { carbs: 30, protein: 5, fat: 2, calories: 100 }
);

// empty / bad input never throws
assert.deepStrictEqual(sumMacros([]), { carbs: 0, protein: 0, fat: 0, calories: 0 });
assert.deepStrictEqual(sumMacros(null), { carbs: 0, protein: 0, fat: 0, calories: 0 });

console.log('macros.test.js: all assertions passed');
