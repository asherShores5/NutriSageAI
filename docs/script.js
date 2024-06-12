document.getElementById('addButton').addEventListener('click', addFood);
document.getElementById('clearButton').addEventListener('click', clearDay);

async function getMacroData(foodItem) {
    const requestOptions = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ foodItem })
    };

    try {
        const response = await fetch('https://yb4t4lfr5a.execute-api.us-east-1.amazonaws.com/dev/getMacroData', requestOptions);

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        const macroData = await response.json();
        return macroData;
    } catch (error) {
        console.error('Error fetching macro data:', error);
        throw error;
    }
}

async function addFood() {
    let foodItem = document.getElementById('foodInput').value;
    document.getElementById('foodInput').value = '';
    if (foodItem) {
        try {
            const macroData = await getMacroData(foodItem);
            saveFoodData(foodItem, macroData);
            displayEntries();
        } catch (error) {
            console.error('Error fetching macro data:', error);
        }
    }
}

function displayEntries() {
    let entries = JSON.parse(localStorage.getItem('foodEntries')) || [];
    let entriesTable = document.getElementById('entries');
    entriesTable.innerHTML = entries.map((entry, index) => 
        `<tr>
            <td>${entry.food.substring(0, 25)}${entry.food.length > 25 ? '...' : ''}</td>
            <td>${entry.macros.carbs}g</td>
            <td>${entry.macros.protein}g</td>
            <td>${entry.macros.fat}g</td>
            <td>${entry.macros.calories}</td>
            <td><button class="remove-btn" onclick="removeEntry(${index})">X</button></td>
        </tr>`
    ).join('');
    calculateTotalMacros();
}

function removeEntry(index) {
    let entries = JSON.parse(localStorage.getItem('foodEntries')) || [];
    entries.splice(index, 1);
    localStorage.setItem('foodEntries', JSON.stringify(entries));
    displayEntries();
    calculateTotalMacros();
}

function calculateTotalMacros() {
    let entries = JSON.parse(localStorage.getItem('foodEntries')) || [];
    let totalCarbs = 0, totalProtein = 0, totalFats = 0, totalCalories = 0;

    entries.forEach(entry => {
        totalCarbs += entry.macros.carbs;
        totalProtein += entry.macros.protein;
        totalFats += entry.macros.fat;
        totalCalories += entry.macros.calories;
    });

    document.getElementById('totalCarbs').textContent = totalCarbs + 'g';
    document.getElementById('totalProtein').textContent = totalProtein + 'g';
    document.getElementById('totalFats').textContent = totalFats + 'g';
    document.getElementById('totalCalories').textContent = totalCalories;
}

function saveFoodData(food, macros) {
    let entries = JSON.parse(localStorage.getItem('foodEntries')) || [];
    entries.push({ food, macros });
    localStorage.setItem('foodEntries', JSON.stringify(entries));
}

function clearDay() {
    localStorage.removeItem('foodEntries');
    displayEntries();
}

// Initial display
displayEntries();
