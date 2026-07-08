const API_URL = 'https://q8f8dfzb0j.execute-api.us-east-1.amazonaws.com';
const PROFILES = ['asher', 'aubyn']; // add a family member here + a hash in the Lambda's USER_SECRETS
const MEALS = ['breakfast', 'lunch', 'dinner', 'snack']; // entry.meal buckets; order = display order

const el = (id) => document.getElementById(id);

// ---- device keyring ---------------------------------------------------------
// Every profile authenticated on THIS device is remembered here, so switching
// profiles never re-asks for a key. Shape: { user: secret }.
function keyring() {
    try { return JSON.parse(localStorage.getItem('nutri:keys')) || {}; } catch { return {}; }
}
function rememberKey(user, secret) {
    const ks = keyring(); ks[user] = secret;
    localStorage.setItem('nutri:keys', JSON.stringify(ks));
}
function forgetKey(user) {
    const ks = keyring(); delete ks[user];
    localStorage.setItem('nutri:keys', JSON.stringify(ks));
}

// ---- session + per-user local cache ----------------------------------------
let session = null;                       // { user, secret }
let selectedDate = dateKey(new Date());

function cacheKey() { return `nutri:${session.user}`; }
function loadCache() {
    try { return JSON.parse(localStorage.getItem(cacheKey())) || { days: {}, goals: {}, meals: [] }; }
    catch { return { days: {}, goals: {}, meals: [] }; }
}
function saveCache(state) { localStorage.setItem(cacheKey(), JSON.stringify(state)); }

// ---- server sync ------------------------------------------------------------
async function api(path, payload) {
    const resp = await fetch(API_URL + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!resp.ok) throw new Error(`${path} ${resp.status}`);
    return resp.json();
}
async function pull() {
    const data = await api('/pull', { user: session.user, secret: session.secret });
    saveCache(data);
    return data;
}
async function pushItem(item) {
    try { await api('/push', { user: session.user, secret: session.secret, item }); return true; }
    catch (e) { console.error('sync failed', e); return false; } // local already saved; offline-ok
}

// ---- login / keyring boot ---------------------------------------------------
function initLogin() {
    applyTheme(localStorage.getItem('nutri:theme') || 'system');
    renderProfilePicker();

    el('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await attemptLogin(el('loginForm').dataset.user, el('secretInput').value.trim(), true);
    });
    el('loginBack').addEventListener('click', () => {
        el('loginForm').hidden = true;
        el('profilePicker').hidden = false;
        setText('loginStatus', '');
    });

    // Auto-resume: last active profile whose key is on this device.
    const active = localStorage.getItem('nutri:active');
    const ks = keyring();
    if (active && ks[active]) attemptLogin(active, ks[active], false);
}

function renderProfilePicker() {
    const picker = el('profilePicker');
    picker.replaceChildren();
    const ks = keyring();
    PROFILES.forEach((name) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'profile-btn';
        btn.textContent = ks[name] ? name : `${name} 🔑`; // 🔑 = will ask for key
        btn.title = ks[name] ? 'Signed-in on this device' : 'First sign-in on this device';
        btn.addEventListener('click', () => {
            if (ks[name]) attemptLogin(name, ks[name], false);
            else showSecretForm(name);
        });
        picker.appendChild(btn);
    });
}

async function attemptLogin(user, secret, fromForm) {
    if (!secret) return;
    setText('loginStatus', 'Signing in…');
    session = { user, secret };
    try {
        await pull();                       // validates the key (401 throws)
        rememberKey(user, secret);          // keyring: never ask again on this device
        localStorage.setItem('nutri:active', user);
        startApp();
    } catch {
        session = null;
        if (fromForm) { setText('loginStatus', 'Wrong access key. Try again.', true); }
        else { forgetKey(user); renderProfilePicker(); setText('loginStatus', 'Saved key was invalid — enter it again.', true); }
    }
}

function showSecretForm(name) {
    el('profilePicker').hidden = true;
    const form = el('loginForm');
    form.hidden = false;
    form.dataset.user = name;
    setText('loginName', `Signing in as ${name}`);
    el('secretInput').value = '';
    el('secretInput').focus();
}

// ---- app boot ---------------------------------------------------------------
function startApp() {
    el('loginSection').hidden = true;
    el('appSection').hidden = false;
    const who = el('whoami');
    who.hidden = false;
    who.textContent = session.user;
    who.title = 'Go to profile';
    who.onclick = () => switchTab('profile');

    el('dateInput').value = selectedDate;
    wireAppEvents();
    render();
}

let eventsWired = false;
function wireAppEvents() {
    if (eventsWired) return;              // survive profile switches (startApp re-runs)
    eventsWired = true;
    el('foodForm').addEventListener('submit', (e) => { e.preventDefault(); addFood(); });
    el('clearButton').addEventListener('click', clearDay);
    el('prevDay').addEventListener('click', () => shiftDay(-1));
    el('nextDay').addEventListener('click', () => shiftDay(1));
    el('todayBtn').addEventListener('click', () => { selectedDate = dateKey(new Date()); el('dateInput').value = selectedDate; render(); });
    el('dateInput').addEventListener('change', (e) => { if (e.target.value) { selectedDate = e.target.value; render(); } });
    el('goalsForm').addEventListener('submit', (e) => { e.preventDefault(); saveGoals(); });
    el('themeSelect').addEventListener('change', (e) => { applyTheme(e.target.value); localStorage.setItem('nutri:theme', e.target.value); });
    el('exportBtn').addEventListener('click', exportData);
    el('refreshBtn').addEventListener('click', async () => { setText('goalsStatus', ''); await pull(); render(); });
    el('waterPlus').addEventListener('click', () => setWater(currentWater() + 1));
    el('waterMinus').addEventListener('click', () => setWater(currentWater() - 1));
    el('waterGoal').addEventListener('change', () => { setGoal('waterGoal', num(el('waterGoal').value)); render(); });
    el('trendMetric').addEventListener('change', renderTrends);
    document.querySelectorAll('.tab-btn').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
}

// ---- tabs -------------------------------------------------------------------
function switchTab(name) {
    document.querySelectorAll('.tab-panel').forEach((p) => { p.hidden = p.id !== `tab-${name}`; });
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    if (name === 'profile') renderProfileTab();
    if (name === 'trends') renderTrends();
    window.scrollTo(0, 0);
}

function shiftDay(delta) {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + delta);
    selectedDate = dateKey(dt);
    el('dateInput').value = selectedDate;
    render();
}

// ---- day data ---------------------------------------------------------------
// A day is { entries:[...], water:<cups>, updatedAt }. Entries and water are edited
// independently, so each writer preserves the other field on the day.
function currentDay() { return loadCache().days[selectedDate] || {}; }
function currentEntries() { return currentDay().entries || []; }
function currentWater() { return num(currentDay().water); }

function writeDay(patch) {
    const state = loadCache();
    const day = { entries: [], ...(state.days[selectedDate] || {}), ...patch, updatedAt: new Date().toISOString() };
    state.days[selectedDate] = day;
    saveCache(state);
    pushItem({ type: 'day', date: selectedDate, entries: day.entries, water: day.water, updatedAt: day.updatedAt });
}
function setDayEntries(entries) { writeDay({ entries }); }
function setWater(cups) { writeDay({ water: Math.max(0, cups) }); render(); }

// ---- food entry -------------------------------------------------------------
async function addFood() {
    const foodItem = el('foodInput').value.trim();
    if (!foodItem) return;
    el('addButton').disabled = true;
    setText('status', 'Fetching macros…');
    try {
        const base = await getMacroData(foodItem);       // per-portion macros as described
        const factor = portionFactor();
        addEntry({ food: portionLabel(foodItem, factor), macros: scaleMacros(base, factor), meal: el('mealSelect').value });
        el('foodInput').value = '';
        el('portionInput').value = 1;                     // reset to default 1 after each add
        setText('status', '');
        rememberFavorite(foodItem, base);                 // library stores the 1× base
    } catch (error) {
        console.error('Error fetching macro data:', error);
        setText('status', 'Could not fetch macros. Check your connection and try again.', true);
    } finally {
        el('addButton').disabled = false;
    }
}

async function getMacroData(foodItem) {
    const resp = await fetch(API_URL + '/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foodItem }),
    });
    if (!resp.ok) throw new Error(`API request failed: ${resp.status}`);
    return resp.json();
}

// Portion multiplier (defaults to 1 = "as described"). Clamped to a sane range.
function portionFactor() {
    const f = num(el('portionInput').value);
    return f > 0 ? Math.min(f, 20) : 1;
}
function portionLabel(food, factor) {
    return factor === 1 ? food : `${food} (×${factor})`;
}

function addEntry(entry) {
    const entries = currentEntries();
    entries.push(entry);
    setDayEntries(entries);
    render();
}
function removeEntry(index) {
    const entries = currentEntries();
    entries.splice(index, 1);
    setDayEntries(entries);
    render();
}

// Edit: re-estimate the corrected description and replace the row in place.
async function saveEdit(index, newFood, statusNode) {
    newFood = newFood.trim();
    if (!newFood) return;
    statusNode.textContent = 'Updating…';
    try {
        const macros = await getMacroData(newFood);
        const entries = currentEntries();
        entries[index] = { food: newFood, macros, meal: entries[index].meal }; // keep the meal bucket
        setDayEntries(entries);
        rememberFavorite(newFood, macros);   // keep quick-add in sync
        render();
    } catch {
        statusNode.textContent = 'Could not update. Try again.';
        statusNode.className = 'status error';
    }
}

function clearDay() {
    if (!currentEntries().length) return;
    if (!confirm(`Clear all entries for ${selectedDate}? This can't be undone.`)) return;
    setDayEntries([]);
    render();
}

// ---- favorites / shared meal library ---------------------------------------
function rememberFavorite(food, macros) {
    const state = loadCache();
    const meals = state.meals || [];
    const key = food.toLowerCase();
    const existing = meals.findIndex((m) => m.name.toLowerCase() === key);
    if (existing >= 0) meals[existing] = { name: food, macros };  // refresh macros on edit
    else meals.unshift({ name: food, macros });
    state.meals = meals.slice(0, 20); // ponytail: cap at 20; add search if it grows past that
    saveCache(state);
    pushItem({ type: 'meals', library: state.meals });
}

// ---- goals ------------------------------------------------------------------
function saveGoals() {
    const state = loadCache();
    const goals = {
        ...state.goals,                          // keep non-form goals (e.g. waterGoal)
        carbs: num(el('goalCarbs').value),
        protein: num(el('goalProtein').value),
        fat: num(el('goalFat').value),
        fiber: num(el('goalFiber').value),
        sodium: num(el('goalSodium').value),
        calories: num(el('goalCalories').value),
    };
    state.goals = goals;
    saveCache(state);
    pushItem({ type: 'goals', goals });
    setText('goalsStatus', 'Goals saved.');
    render();
}

// Set a single goal key (used by the water goal control) and sync.
function setGoal(key, value) {
    const state = loadCache();
    state.goals = { ...state.goals, [key]: value };
    saveCache(state);
    pushItem({ type: 'goals', goals: state.goals });
}

// ---- profile tab ------------------------------------------------------------
function renderProfileTab() {
    el('profileName').textContent = session.user;
    el('themeSelect').value = localStorage.getItem('nutri:theme') || 'system';

    // switch-profile buttons (only profiles with a saved key = one tap)
    const sw = el('switchList');
    sw.replaceChildren();
    const ks = keyring();
    PROFILES.forEach((name) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'profile-btn' + (name === session.user ? ' active' : '');
        btn.textContent = ks[name] ? name : `${name} 🔑`;
        btn.disabled = name === session.user;
        btn.addEventListener('click', () => {
            if (ks[name]) { attemptLogin(name, ks[name], false); switchTab('today'); }
            else { el('appSection').hidden = true; el('loginSection').hidden = false; showSecretForm(name); }
        });
        sw.appendChild(btn);
    });

    // per-device saved keys with "forget" (data control)
    const list = el('keyList');
    list.replaceChildren();
    Object.keys(ks).forEach((name) => {
        const rowEl = document.createElement('div');
        rowEl.className = 'row keyrow';
        const label = document.createElement('span');
        label.textContent = `${name} — key saved`;
        const forget = document.createElement('button');
        forget.type = 'button';
        forget.className = 'ghost danger';
        forget.textContent = name === session.user ? 'Sign out' : 'Forget key';
        forget.addEventListener('click', () => {
            if (!confirm(`Remove ${name}'s saved key and cached data from THIS device? Server data is untouched; you'll re-enter the key next time.`)) return;
            forgetKey(name);
            localStorage.removeItem(`nutri:${name}`);
            if (name === session.user) {
                localStorage.removeItem('nutri:active');
                location.reload();
            } else { renderProfileTab(); }
        });
        rowEl.append(label, forget);
        list.appendChild(rowEl);
    });
}

function exportData() {
    const blob = new Blob([JSON.stringify(loadCache(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nutrisage-${session.user}-${dateKey(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
}

// ---- theme ------------------------------------------------------------------
function applyTheme(mode) {
    // 'system' -> let CSS media query decide; else force via data-theme
    if (mode === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', mode);
}

// ---- rendering (all textContent/createElement — never innerHTML) ------------
function render() {
    const state = loadCache();
    const entries = (state.days[selectedDate] || {}).entries || [];
    renderEntries(entries);
    renderProgress(sumMacros(entries), state.goals);
    renderWater(state.goals);
    renderWeek(state.days, state.goals);
    renderFavorites(state.meals || []);
    renderGoalInputs(state.goals);
    if (!el('tab-trends').hidden) renderTrends();
}

function renderEntries(entries) {
    const list = el('entries');
    list.replaceChildren();
    if (!entries.length) {
        const li = document.createElement('li');
        li.className = 'muted empty';
        li.textContent = 'No entries yet. Add a food above.';
        list.appendChild(li);
        return;
    }
    // Group by meal, preserving each entry's original index (edit/remove need it).
    // Legacy entries with no `meal` fall into snack.
    MEALS.forEach((meal) => {
        const rows = entries
            .map((entry, index) => ({ entry, index }))
            .filter(({ entry }) => (entry.meal || 'snack') === meal);
        if (!rows.length) return;
        const header = document.createElement('li');
        header.className = 'meal-header';
        const title = document.createElement('span');
        title.textContent = meal[0].toUpperCase() + meal.slice(1);
        const cals = document.createElement('span');
        cals.className = 'meal-cals';
        cals.textContent = `${Math.round(sumMacros(rows.map((r) => r.entry)).calories)} cal`;
        header.append(title, cals);
        list.appendChild(header);
        rows.forEach(({ entry, index }) => list.appendChild(entryRow(entry, index)));
    });
}

function entryRow(entry, index) {
    const m = entry.macros || {};
    const li = document.createElement('li');
    li.className = 'entry';

    const main = document.createElement('div');
    main.className = 'entry-main';
    const name = document.createElement('span');
    name.className = 'entry-name';
    name.textContent = entry.food;
    const macros = document.createElement('span');
    macros.className = 'entry-macros';
    macros.textContent = `${num(m.calories)} cal · ${num(m.carbs)}c / ${num(m.protein)}p / ${num(m.fat)}f · ${num(m.fiber)}g fiber · ${num(m.sodium)}mg Na`;
    main.append(name, macros);

    const actions = document.createElement('div');
    actions.className = 'entry-actions';
    const editBtn = iconBtn('✎', `Edit ${entry.food}`, () => openEditor(li, entry, index));
    const rmBtn = iconBtn('✕', `Remove ${entry.food}`, () => removeEntry(index));
    rmBtn.classList.add('danger');
    actions.append(editBtn, rmBtn);

    li.append(main, actions);
    return li;
}

function openEditor(li, entry, index) {
    li.replaceChildren();
    li.classList.add('editing');
    const input = document.createElement('input');
    input.type = 'text';
    input.value = entry.food;
    input.maxLength = 80;
    const status = document.createElement('span');
    status.className = 'status';
    const save = document.createElement('button');
    save.textContent = 'Save';
    save.addEventListener('click', () => saveEdit(index, input.value, status));
    const cancel = document.createElement('button');
    cancel.className = 'ghost';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', render);
    const row = document.createElement('div');
    row.className = 'edit-row';
    row.append(input, save, cancel);
    li.append(row, status);
    input.focus();
    input.select();
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveEdit(index, input.value, status); if (e.key === 'Escape') render(); });
}

function iconBtn(glyph, label, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'icon-btn';
    b.textContent = glyph;
    b.setAttribute('aria-label', label);
    b.addEventListener('click', onClick);
    return b;
}

const MACRO_ROWS = [['Carbs', 'carbs', 'g'], ['Protein', 'protein', 'g'], ['Fat', 'fat', 'g'], ['Fiber', 'fiber', 'g'], ['Sodium', 'sodium', 'mg'], ['Calories', 'calories', '']];

function renderProgress(totals, goals) {
    const c = el('progressBars');
    c.replaceChildren();
    MACRO_ROWS.forEach(([label, key, unit]) => c.appendChild(bar(label, totals[key], (goals || {})[key] || 0, unit, key)));
}

function renderWeek(days, goals) {
    days = days || {};
    goals = goals || {};
    const keys = weekKeys(selectedDate);

    // streak
    const n = streak(days, selectedDate);
    el('streakBig').textContent = n ? `🔥 ${n}` : '—';
    el('streakSub').textContent = n
        ? `day${n === 1 ? '' : 's'} logged in a row. Keep it going!`
        : 'No active streak — log a day to start one.';

    // daily average over logged days
    const stats = weekStats(days, selectedDate);
    el('avgSub').textContent = stats.logged
        ? `Averaged over ${stats.logged} logged day${stats.logged === 1 ? '' : 's'} this week.`
        : 'No days logged this week yet.';
    const avgC = el('weekAvgBars');
    avgC.replaceChildren();
    MACRO_ROWS.forEach(([label, key, unit]) => avgC.appendChild(bar(label, stats.avg[key], goals[key] || 0, unit, key)));

    // week total
    el('weekRange').textContent = `${keys[0]} → ${keys[6]}`;
    const wk = sumWeek(days, selectedDate);
    const totalC = el('weekBars');
    totalC.replaceChildren();
    MACRO_ROWS.forEach(([label, key, unit]) => totalC.appendChild(bar(label, wk[key], (goals[key] || 0) * 7, unit, key)));
}

// ---- water ------------------------------------------------------------------
function renderWater(goals) {
    const cups = currentWater();
    const goal = num((goals || {}).waterGoal) || 8;
    el('waterGoal').value = goal;
    el('waterCount').textContent = `${cups} / ${goal} cups`;
    const wrap = el('waterCups');
    wrap.replaceChildren();
    const shown = Math.max(goal, cups);          // show overflow cups too
    for (let i = 0; i < shown; i++) {
        const cup = document.createElement('button');
        cup.type = 'button';
        cup.className = 'cup' + (i < cups ? ' filled' : '') + (i >= goal ? ' extra' : '');
        cup.textContent = i < cups ? '💧' : '○';
        cup.setAttribute('aria-label', `Set water to ${i + 1} cups`);
        cup.addEventListener('click', () => setWater(i + 1 === cups ? i : i + 1)); // tap filled top cup to undo
        wrap.appendChild(cup);
    }
}

// ---- trends (30-day canvas line chart, no libs) -----------------------------
function renderTrends() {
    const days = loadCache().days || {};
    const metric = el('trendMetric').value;
    const keys = lastDays(selectedDate, 30);
    const vals = keys.map((k) => Math.round(sumMacros((days[k] || {}).entries)[metric]));
    const logged = vals.filter((v) => v > 0).length;
    el('trendSub').textContent = logged
        ? `Last 30 days · ${logged} logged · max ${Math.max(...vals)}`
        : 'No data in the last 30 days.';
    drawChart(el('trendChart'), keys, vals);
}

function drawChart(canvas, keys, vals) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, pad = 28;
    ctx.clearRect(0, 0, W, H);
    const css = getComputedStyle(document.documentElement);
    const brand = css.getPropertyValue('--brand').trim() || '#3e4eb8';
    const muted = css.getPropertyValue('--muted').trim() || '#888';
    const border = css.getPropertyValue('--border').trim() || '#ddd';
    const max = Math.max(1, ...vals);
    const x = (i) => pad + (i * (W - 2 * pad)) / (keys.length - 1);
    const y = (v) => H - pad - (v / max) * (H - 2 * pad);

    // baseline
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad, H - pad); ctx.lineTo(W - pad, H - pad); ctx.stroke();

    // max label
    ctx.fillStyle = muted;
    ctx.font = '12px sans-serif';
    ctx.fillText(String(max), 2, pad);

    // line
    ctx.strokeStyle = brand;
    ctx.lineWidth = 2;
    ctx.beginPath();
    vals.forEach((v, i) => { i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v)); });
    ctx.stroke();

    // dots on logged days
    ctx.fillStyle = brand;
    vals.forEach((v, i) => { if (v > 0) { ctx.beginPath(); ctx.arc(x(i), y(v), 2.5, 0, 7); ctx.fill(); } });

    // first/last date labels
    ctx.fillStyle = muted;
    ctx.fillText(keys[0].slice(5), pad, H - 8);
    ctx.fillText(keys[keys.length - 1].slice(5), W - pad - 28, H - 8);
}

// Bar color intent (green = on target). Protein/fiber: green once at/over goal (more is fine).
// Others: green within ±10% of goal, red when >10% over. Under-target stays neutral.
const MORE_IS_GOOD = new Set(['protein', 'fiber']);
function barState(key, value, goal) {
    if (goal <= 0) return '';
    const v = num(value);
    if (MORE_IS_GOOD.has(key)) return v >= goal * 0.9 ? 'good' : '';
    if (v >= goal * 0.9 && v <= goal * 1.1) return 'good';
    if (v > goal * 1.1) return 'over';
    return '';
}

function bar(label, value, goal, unit, key) {
    const wrap = document.createElement('div');
    wrap.className = 'bar';
    const head = document.createElement('div');
    head.className = 'bar-head';
    const name = document.createElement('span');
    name.textContent = label;
    const val = document.createElement('span');
    const rounded = Math.round(num(value));
    val.textContent = goal > 0 ? `${rounded}${unit} / ${goal}${unit}` : `${rounded}${unit}`;
    head.append(name, val);
    const track = document.createElement('div');
    track.className = 'bar-track';
    const fill = document.createElement('div');
    fill.className = 'bar-fill';
    fill.style.width = pct(value, goal) + '%';
    const state = barState(key, value, goal); // 'good' | 'over' | ''
    if (state) fill.classList.add(state);
    track.appendChild(fill);
    wrap.append(head, track);
    return wrap;
}

function renderFavorites(meals) {
    const c = el('favoriteChips');
    c.replaceChildren();
    if (!meals.length) {
        const p = document.createElement('p');
        p.className = 'muted';
        p.textContent = 'Foods you add show up here for one-tap re-adding.';
        c.appendChild(p);
        return;
    }
    meals.forEach((meal) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip';
        chip.textContent = meal.name;
        chip.title = `Add ${meal.name}`;
        chip.addEventListener('click', () => {
            const factor = portionFactor();
            addEntry({ food: portionLabel(meal.name, factor), macros: scaleMacros(meal.macros, factor), meal: el('mealSelect').value });
        });
        c.appendChild(chip);
    });
}

function renderGoalInputs(goals) {
    goals = goals || {};
    el('goalCarbs').value = goals.carbs || '';
    el('goalProtein').value = goals.protein || '';
    el('goalFat').value = goals.fat || '';
    el('goalFiber').value = goals.fiber || '';
    el('goalSodium').value = goals.sodium || '';
    el('goalCalories').value = goals.calories || '';
}

// ---- helpers ----------------------------------------------------------------
function setText(id, message, isError) {
    const node = el(id);
    node.textContent = message || '';
    node.className = isError ? 'status error' : 'status';
}

initLogin();
