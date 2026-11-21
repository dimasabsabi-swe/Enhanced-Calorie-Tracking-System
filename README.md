# Enhanced Calorie Tracking System (ECTS)

> SWE 401 — Software Engineering · Phase 5 Implementation Prototype

## Team Members

|Name|Student ID|Role|
|-|-|-|
|*Member 1*|*ID*|*e.g. Front-end / UI*|
|*Member 2*|*ID*|*e.g. Business logic*|
|*Member 3*|*ID*|*e.g. Testing \& documentation*|

## Problem

Many people want to manage their diet but find calorie tracking tedious. Most tools make it slow to log a meal, they hide nutrition details, and they rarely show progress over time. ECTS is a fast, mobile-first web app. Users can search a food database, log meals in a few taps, see calories and macronutrients update right away, and review their nutrition history against a personal daily goal.

## Key Features

* **Simulated authentication:** login with validation, a password show/hide toggle, a simulated "forgot password" flow, and route guarding (logged-out users are always sent to Login).
* **Dashboard:** calories consumed, remaining calories, a goal-progress ring and bar, a macronutrient donut chart with protein/carbs/fat progress bars, a weekly overview, and today's meals (with remove).
* **Food search:** live search by name, a Search button, category filters, a results count, and a nutrition preview (macro bar + grams) for each result.
* **Food details:** serving size, calories, protein, carbohydrates, fat, fiber and sugar; a servings stepper (0.5 steps) that recalculates values instantly; a meal-type selector; and **Add To Meal**.
* **Nutrition history:** a week-by-week navigator, weekly totals, daily average, days on target, a daily calorie bar chart with a goal line, average macro tracking, and a per-day meal accordion.
* **User profile:** edit name, email, daily calorie goal (1,000–5,000 kcal, presets, ± buttons, live macro targets) and user type. Also includes **Save Profile**, logout and reset demo data.
* **Persistence:** all data is stored in the browser's `localStorage` and survives page reloads.
* **Responsive:** mobile-first layout with a bottom navigation bar. It becomes two columns on desktop.

## Technologies

|Layer|Technology|
|-|-|
|Markup|HTML5 (semantic sections, ARIA labels)|
|Styling|CSS3 (custom properties, Grid/Flexbox, media queries)|
|Logic|Vanilla JavaScript (ES2020, no frameworks)|
|Storage|Web Storage API (`localStorage`)|
|Font|Josefin Sans (Google Fonts)|
|Testing|Browser unit-test runner (JS) + Playwright end-to-end tests (Python)|

No backend, build step or external API is required.

### Design system

|Token|Value|Usage|
|-|-|-|
|Primary background|`#12392C`|App background|
|Text / cards|`#F3EFE6`|Text on dark, card surfaces|
|Accent|`#B6F23A`|Buttons, progress bars, highlights|
|Headings|Josefin Sans Bold|Page titles|
|Section titles|Josefin Sans Medium|Card titles|
|Body|Josefin Sans Light|Body text|

## Project Structure

```
ects/
├── index.html            # App shell + all 6 screens (Login, Dashboard, Search, Food Details, History, Profile)
├── styles.css            # Design tokens, components, screens, responsive rules
├── app.js                # Layered app logic: data → services → views → router
├── README.md
└── tests/
    ├── test-runner.html  # 50 automated unit tests (open in a browser)
    ├── e2e\\\_test.py       # 22 end-to-end UI test cases with screenshots
    ├── TEST\\\_CASES.md     # Test case table: expected vs. actual
    └── evidence/         # Screenshots + test-log.txt from the latest run
```

### Architecture (`app.js`)

|Layer|Modules|Responsibility|
|-|-|-|
|Data|`Storage`, `UserRepository`, `MealRepository`|Persist users, session and meal entries in `localStorage`|
|Service|`Auth`, `FoodService`, `Nutrition`, `MealService`, `Validator`|Business rules: login, search, calorie/macro calculations, meal logging|
|UI|`LoginView`, `DashboardView`, `SearchView`, `FoodView`, `HistoryView`, `ProfileView`|Render each screen and handle user events|
|Routing|`Router`|Hash routes (`#/dashboard`, `#/food/<id>`, …) with an authentication guard|

## Prerequisites

* Any modern browser (Chrome, Edge, Firefox or Safari)
* *(Optional, to serve over HTTP)* Python 3 **or** Node.js
* *(Optional, for end-to-end tests)* Python 3.9+ and Playwright

## Installation

```bash
git clone <your-repository-url>
cd ects
```

There are no dependencies to install for the app itself.

## Configuration

No configuration is needed. You can change these optional settings in the `CONFIG` object at the top of `app.js`:

|Setting|Default|Description|
|-|-|-|
|`DEFAULT\\\_GOAL`|`2000`|Starting daily calorie goal|
|`MIN\\\_GOAL` / `MAX\\\_GOAL`|`1000` / `5000`|Allowed goal range|
|`MACRO\\\_SPLIT`|25% / 50% / 25%|Protein / carbs / fat targets|
|`USER\\\_TYPES`|Standard, Premium, Athlete, Dietitian|Profile user-type options|
|`DEMO\\\_ACCOUNT`|`demo@ects.app` / `demo123`|Seeded demo login|

## How to Run

**Option A: open directly.** Double-click `index.html`.

**Option B: local server (recommended).**

```bash
# Python
python -m http.server 8000
# or Node
npx serve .
```

Then open [http://localhost:8000](http://localhost:8000).

Log in with **demo@ects.app / demo123**, or click **Use demo account**. On first launch, the demo account is seeded with two weeks of meal history. Use **Profile → Reset demo data** to restore it at any time.

## How to Test

**Unit tests (50 cases).** Open `tests/test-runner.html` in a browser, or go to [http://localhost:8000/tests/test-runner.html](http://localhost:8000/tests/test-runner.html). The page shows each test's expected value, actual value and a PASS/FAIL result. Tests use an isolated storage prefix, so they never change app data.

**End-to-end tests (22 UI test cases + responsive screenshots).**

```bash
pip install playwright
python -m playwright install chromium
python tests/e2e\\\_test.py
```

The script starts a local server, runs the unit suite and every UI scenario in headless Chromium, and saves screenshots and `test-log.txt` to `tests/evidence/`.

See `tests/TEST\\\_CASES.md` for the full test-case table.

## Limitations (prototype scope)

* Authentication is simulated on the client. Passwords are stored in plain text in `localStorage`, so this is not suitable for production.
* The food database is a static list of 41 foods. Nutrition values are approximate reference data.
* Data is stored per browser and is not synced between devices.



