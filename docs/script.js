const API_URL = 'https://q8f8dfzb0j.execute-api.us-east-1.amazonaws.com';
const PROFILES = ['asher', 'aubyn']; // add a family member here + a hash in the Lambda's USER_SECRETS

// ---- session + local cache --------------------------------------------------
// localStorage is the working copy; the server is the sync layer.
// Per-user cache key so two profiles on one device don't clobber each other.
let session = null; // { user, secret }
let selectedDate = dateKey(new Date());

function cacheKey() { return `nutri:${session.user}`; }

function loadCache() {
    try {
        return JSON.parse(localStorage.getItem(cacheKey())) || { days: {}, goals: {}, meals: [] };
    } catch {
        return { days: {}, goals: {}, meals: [] };
    }
}

function saveCache(state) {
    localStorage.setItem(cacheKey(), JSON.stringify(state));
}

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

// Write-through: update local first (instant), then best-effort sync to server.
async function pushItem(item) {
    try {
        await api('/push', { user: session.user, secret: session.secret, item });
        return true;
    } catch (e) {
        console.error('sync failed', e);
        return false; // local cache already updated; user keeps working offline
    }
}

// ---- login ------------------------------------------------------------------
const el = (id) => document.getElementById(id);

function initLogin() {
    const picker = el('profilePicker');
    picker.replaceChildren();
    PROFILES.forEach((name) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'profile-btn';
        btn.textContent = name;
        btn.addEventListener('click', () => showSecretForm(name));
        picker.appendChild(btn);
    });

    el('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = el('loginForm').dataset.user;
        const secret = el('secretInput').value.trim();
        if (!secret) return;
        setText('loginStatus', 'Signing in…');
        try {
            session = { user, secret };
            await pull(); // validates the secret (401 throws)
            localStorage.setItem('nutri:session', JSON.stringify(session));
            startApp();
        } catch {
            session = null;
            setText('loginStatus', 'Wrong access key. Try again.', true);
        }
    });

    el('loginBack').addEventListener('click', () => {
        el('loginForm').hidden = true;
        el('profilePicker').hidden = false;
        setText('loginStatus', '');
    });

    // auto-resume a saved session
    try {
        const saved = JSON.parse(localStorage.getItem('nutri:session'));
        if (saved && PROFILES.includes(saved.user)) {
            session = saved;
            pull().then(startApp).catch(() => { session = null; }); // stale/rotated secret → fall back to picker
        }
    } catch { /* no saved session */ }
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

function logout() {
    localStorage.removeItem('nutri:session');
    session = null;
    location.reload();
}

// ---- app boot ---------------------------------------------------------------
function startApp() {
    el('loginSection').hidden = true;
    el('appSection').hidden = false;
    const who = el('whoami');
    who.hidden = false;
    who.textContent = session.user;
    who.title = 'Sign out';
    who.addEventListener('click', logout, { once: true });

    el('dateInput').value = selectedDate;
    wireAppEvents();
    render();
}

function wireAppEvents() {
    el('foodForm').addEventListener('submit', (e) => { e.preventDefault(); addFood(); });
    el('clearButton').addEventListener('click', clearDay);
    el('prevDay').addEventListener('click', () => shiftDay(-1));
    el('nextDay').addEventListener('click', () => shiftDay(1));
    el('todayBtn').addEventListener('click', () => { selectedDate = dateKey(new Date()); el('dateInput').value = selectedDate; render(); });
    el('dateInput').addEventListener('change', (e) => { if (e.target.value) { selectedDate = e.target.value; render(); } });
    el('goalsForm').addEventListener('submit', (e) => { e.preventDefault(); saveGoals(); });
}

function shiftDay(delta) {
    const keys = weekKeys(selectedDate); // reuse date math; take yesterday/tomorrow
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + delta);
    selectedDate = dateKey(dt);
    el('dateInput').value = selectedDate;
    render();
}

// ---- data access on the current cache --------------------------------------
function currentEntries() {
    const state = loadCache();
    return (state.days[selectedDate] || {}).entries || [];
}

function setDayEntries(entries) {
    const state = loadCache();
    state.days[selectedDate] = { entries, updatedAt: new Date().toISOString() };
    saveCache(state);
    pushItem({ type: 'day', date: selectedDate, entries, updatedAt: state.days[selectedDate].updatedAt });
}

// ---- food entry -------------------------------------------------------------
async function addFood() {
    const foodItem = el('foodInput').value.trim();
    if (!foodItem) return;
    el('addButton').disabled = true;
    setText('status', 'Fetching macros…');
    try {
        const macros = await getMacroData(foodItem);
        addEntry({ food: foodItem, macros });
        el('foodInput').value = '';
        setText('status', '');
        rememberFavorite(foodItem, macros);
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

function clearDay() {
    setDayEntries([]);
    render();
}

// ---- favorites (shared meal library) ---------------------------------------
function rememberFavorite(food, macros) {
    const state = loadCache();
    const meals = state.meals || [];
    if (meals.some((m) => m.name.toLowerCase() === food.toLowerCase())) return; // dedupe
    meals.unshift({ name: food, macros });
    state.meals = meals.slice(0, 20); // ponytail: cap the library at 20; add search if it ever grows past that
    saveCache(state);
    pushItem({ type: 'meals', library: state.meals });
}

// ---- goals ------------------------------------------------------------------
function saveGoals() {
    const goals = {
        carbs: num(el('goalCarbs').value),
        protein: num(el('goalProtein').value),
        fat: num(el('goalFat').value),
        calories: num(el('goalCalories').value),
    };
    const state = loadCache();
    state.goals = goals;
    saveCache(state);
    pushItem({ type: 'goals', goals });
    setText('goalsStatus', 'Goals saved.');
    render();
}

// ---- rendering (all textContent/createElement — never innerHTML) ------------
function render() {
    const state = loadCache();
    const entries = (state.days[selectedDate] || {}).entries || [];
    renderEntries(entries);
    renderProgress(sumMacros(entries), state.goals);
    renderWeek(state.days, state.goals);
    renderFavorites(state.meals || []);
    renderGoalInputs(state.goals);
}

function renderEntries(entries) {
    const tbody = el('entries');
    tbody.replaceChildren();
    entries.forEach((entry, index) => {
        const m = entry.macros || {};
        const row = document.createElement('tr');
        cell(row, entry.food);
        cell(row, `${num(m.carbs)}g`);
        cell(row, `${num(m.protein)}g`);
        cell(row, `${num(m.fat)}g`);
        cell(row, `${num(m.calories)}`);
        const rm = document.createElement('td');
        const btn = document.createElement('button');
        btn.className = 'remove-btn';
        btn.textContent = '✕';
        btn.setAttribute('aria-label', `Remove ${entry.food}`);
        btn.addEventListener('click', () => removeEntry(index));
        rm.appendChild(btn);
        row.appendChild(rm);
        tbody.appendChild(row);
    });
}

function renderProgress(totals, goals) {
    const container = el('progressBars');
    container.replaceChildren();
    [['Carbs', 'carbs', 'g'], ['Protein', 'protein', 'g'], ['Fat', 'fat', 'g'], ['Calories', 'calories', '']]
        .forEach(([label, key, unit]) => {
            const goal = (goals || {})[key] || 0;
            container.appendChild(bar(label, totals[key], goal, unit));
        });
}

function renderWeek(days, goals) {
    const container = el('weekBars');
    container.replaceChildren();
    const wk = sumWeek(days || {}, selectedDate);
    [['Carbs', 'carbs', 'g'], ['Protein', 'protein', 'g'], ['Fat', 'fat', 'g'], ['Calories', 'calories', '']]
        .forEach(([label, key, unit]) => {
            const weekGoal = ((goals || {})[key] || 0) * 7; // week target = daily goal x7
            container.appendChild(bar(label, wk[key], weekGoal, unit));
        });
}

// One labelled progress bar built entirely with DOM nodes.
function bar(label, value, goal, unit) {
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
    if (goal > 0 && num(value) > goal) fill.classList.add('over');
    track.appendChild(fill);
    wrap.append(head, track);
    return wrap;
}

function renderFavorites(meals) {
    const container = el('favoriteChips');
    container.replaceChildren();
    if (!meals.length) {
        const p = document.createElement('p');
        p.className = 'muted';
        p.textContent = 'Foods you add show up here for one-tap re-adding.';
        container.appendChild(p);
        return;
    }
    meals.forEach((meal) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip';
        chip.textContent = meal.name;
        chip.title = `Add ${meal.name}`;
        chip.addEventListener('click', () => addEntry({ food: meal.name, macros: meal.macros }));
        container.appendChild(chip);
    });
}

function renderGoalInputs(goals) {
    goals = goals || {};
    el('goalCarbs').value = goals.carbs || '';
    el('goalProtein').value = goals.protein || '';
    el('goalFat').value = goals.fat || '';
    el('goalCalories').value = goals.calories || '';
}

// ---- helpers ----------------------------------------------------------------
function cell(row, text) {
    const td = document.createElement('td');
    td.textContent = text;
    row.appendChild(td);
}

function setText(id, message, isError) {
    const node = el(id);
    node.textContent = message || '';
    node.className = isError ? 'status error' : 'status';
}

initLogin();
