document.getElementById('addButton').addEventListener('click', addFood);
document.getElementById('clearButton').addEventListener('click', clearDay);

let apiKey = localStorage.getItem('openaiApiKey');

if (!apiKey) {
    apiKey = prompt('Please enter your OpenAI API key:');
    localStorage.setItem('openaiApiKey', apiKey);
}

async function getMacroData(foodItem) {
    const openaiApiKey = localStorage.getItem('openaiApiKey');
    const requestOptions = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [
                {"role": "system", "content": "You are a helpful assistant, who responds in as few words as possible."},
                {"role": "user", "content": `Give the estimated macros for ${foodItem} in JSON format: {carbs: <amount>, protein: <amount>, fat: <amount>, calories: <amount>}. Replace <amount> with the estimatd integer. Use only JSON, don't add any other text.`}
            ]
        })        
    };

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', requestOptions);

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();
        const responseContent = data.choices[0].message.content.trim();
        console.log(responseContent);
        
        // Assuming the response is in the format: "{carbs: 22, protein: 1, fat: 0, calories: 96}"
        // Convert response string to JSON object
        const macroData = JSON.parse(responseContent.replace(/(\w+):/g, '"$1":'));
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
            const macroDataResponse = await getMacroData(foodItem);

            // Check the type of macroDataResponse
            let macroData;
            if (typeof macroDataResponse === 'string') {
                macroData = JSON.parse(macroDataResponse); // Parse if it's a string
            } else {
                macroData = macroDataResponse; // Use directly if it's already an object
            }

            saveFoodData(foodItem, macroData);
            displayEntries();
        } catch (error) {
            console.error('Error fetching macro data:', error);
            // Handle the error appropriately
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
