# README - NutriSageAI Project
## Project Overview
NutriSageAI is a web-based AI-enabled fitness and nutrition service. It helps users track their nutrition information, discover meal ideas, and receive personalized workout plans. NutriSageAI integrates with the GPT API to interpret unformatted natural language inputs from users, then retrieves and displays corresponding nutritional information.

[Test Site](ashershores5.github.io/NutriSageAI/) Currently requires an OpenAPI Key to use since this is just a demo

![image](https://github.com/asherShores5/NutriSageAI/assets/71547146/393c3c4b-3d75-4f83-a535-4306ecbe26bf)


### Key Features
Nutrition Tracker: Users can input their meals in unformatted natural language. The AI will process this input and return estimated nutrition information.
Workout Planner: The AI can suggest workout ideas and plans tailored to each user's specific needs and goals.
User Accounts: Users can register for an account to unlock additional features.
Ad-Free Subscription: Registered users have the option to pay a small monthly fee for an ad-free experience.

## Tech Stack
This project is built with the following technologies:

1. Frontend: HTML, CSS, JavaScript
2. Backend: Django
3. Database: SQLite
4. API: ChatGPT

## Setup
Here are the steps to set up the project locally:

### lone the repository:
```
git clone https://github.com/asherShores5/NutriSageAI.git
```

### Navigate to the project directory:
```
cd NutriSageAI
```

### Create a Python virtual environment:
```
python3 -m venv venv
```

### Activate the virtual environment:
- On Windows:
```
.\venv\Scripts\activate
```
- On Unix or MacOS:
```
source venv/bin/activate
```
Install the required dependencies:
```
pip install -r requirements.txt
```

Run the migrations:
```
python manage.py makemigrations
python manage.py migrate
```

Run the development server:
```
python manage.py runserver
```

Open a web browser and visit http://localhost:8000.

## Contribute
Contributions to NutriSageAI are always welcome! Here's how you can help:

Report bugs
Suggest new features
Write or update documentation
Suggest bug fixes or identify potential issues
