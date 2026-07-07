const API_URL = 'https://q8f8dfzb0j.execute-api.us-east-1.amazonaws.com/';

const foodForm = document.getElementById('foodForm');
const foodInput = document.getElementById('foodInput');
const addButton = document.getElementById('addButton');
const statusEl = document.getElementById('status');

foodForm.addEventListener('submit', (e) => {
    e.preventDefault();
    addFood();
});
document.getElementById('clearButton').addEventListener('click', clearDay);

function loadEntries() {
    try {
        return JSON.parse(localStorage.getItem('foodEntries')) || [];
    } catch {
        return [];
    }
}

function setStatus(message, isError) {
    statusEl.textContent = message || '';
    statusEl.className = isError ? 'status error' : 'status';
}

async function getMacroData(foodItem) {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foodItem })
    });
    if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
    }
    return response.json();
}

async function addFood() {
    const foodItem = foodInput.value.trim();
    if (!foodItem) {
        return;
    }

    addButton.disabled = true;
    setStatus('Fetching macros…', false);
    try {
        const macros = await getMacroData(foodItem);
        saveFoodData(foodItem, macros);
        foodInput.value = ''; // clear only on success so failed input isn't lost
        setStatus('', false);
        displayEntries();
    } catch (error) {
        console.error('Error fetching macro data:', error);
        setStatus('Could not fetch macros. Check your connection and try again.', true);
    } finally {
        addButton.disabled = false;
    }
}

function displayEntries() {
    const entries = loadEntries();
    const tbody = document.getElementById('entries');
    tbody.replaceChildren();

    entries.forEach((entry, index) => {
        const macros = entry.macros || {};
        const row = document.createElement('tr');

        // textContent, not innerHTML — user/API strings are never parsed as HTML
        appendCell(row, entry.food);
        appendCell(row, `${num(macros.carbs)}g`);
        appendCell(row, `${num(macros.protein)}g`);
        appendCell(row, `${num(macros.fat)}g`);
        appendCell(row, `${num(macros.calories)}`);

        const removeCell = document.createElement('td');
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.textContent = 'X';
        removeBtn.setAttribute('aria-label', `Remove ${entry.food}`);
        removeBtn.addEventListener('click', () => removeEntry(index));
        removeCell.appendChild(removeBtn);
        row.appendChild(removeCell);

        tbody.appendChild(row);
    });

    calculateTotalMacros(entries);
}

function appendCell(row, text) {
    const cell = document.createElement('td');
    cell.textContent = text;
    row.appendChild(cell);
}

function removeEntry(index) {
    const entries = loadEntries();
    entries.splice(index, 1);
    localStorage.setItem('foodEntries', JSON.stringify(entries));
    displayEntries();
}

function calculateTotalMacros(entries) {
    const totals = sumMacros(entries || loadEntries());
    document.getElementById('totalCarbs').textContent = Math.round(totals.carbs) + 'g';
    document.getElementById('totalProtein').textContent = Math.round(totals.protein) + 'g';
    document.getElementById('totalFats').textContent = Math.round(totals.fat) + 'g';
    document.getElementById('totalCalories').textContent = Math.round(totals.calories);
}

function saveFoodData(food, macros) {
    const entries = loadEntries();
    entries.push({ food, macros });
    localStorage.setItem('foodEntries', JSON.stringify(entries));
}

function clearDay() {
    localStorage.removeItem('foodEntries');
    displayEntries();
}

// Initial display
displayEntries();
