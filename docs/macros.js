// Pure macro helpers — no DOM. Shared by script.js (browser global) and macros.test.js (node).
function num(v) {
    return Number(v) || 0;
}

function sumMacros(entries) {
    return (entries || []).reduce((acc, entry) => {
        const m = (entry && entry.macros) || {};
        acc.carbs += num(m.carbs);
        acc.protein += num(m.protein);
        acc.fat += num(m.fat);
        acc.calories += num(m.calories);
        return acc;
    }, { carbs: 0, protein: 0, fat: 0, calories: 0 });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { num, sumMacros };
}
