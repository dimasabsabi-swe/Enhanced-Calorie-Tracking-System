# ECTS — Test Cases & Results

**Environment:** Headless Chromium (Playwright), mobile viewport 390×844. Tablet (820×1180) and desktop (1366×900) were used for the responsive checks.
**Latest run:** 50/50 unit tests passed · 22/22 system test cases passed (log: `evidence/test-log.txt`).

## System (end-to-end) test cases

| ID | Requirement | Test case / steps | Expected result | Actual result | Status | Evidence |
|----|-------------|-------------------|-----------------|---------------|--------|----------|
| TC-01 | Login | Open `#/dashboard` while logged out | Redirected to `#/login` | Redirected to `#/login` | PASS | 01-login-screen.png |
| TC-02 | Login | Click **Login** with empty fields | "Please enter your email and password." | Same message shown | PASS | — |
| TC-03 | Login | Email `demo`, any password | "Please enter a valid email address." | Same message shown | PASS | — |
| TC-04 | Login | `demo@ects.app` + wrong password | "Incorrect email or password." | Same message shown | PASS | 02-login-error.png |
| TC-05 | Forgot password | Open modal, enter email, **Send link** | Simulated confirmation shown | Confirmation shown | PASS | 03-forgot-password.png |
| TC-06 | Login | `demo@ects.app` / `demo123` | Dashboard opens | Dashboard opens | PASS | 04-dashboard.png |
| TC-07 | Dashboard | Read consumed, remaining, goal | consumed + remaining = goal | 255 + 1,745 = 2,000 | PASS | 04-dashboard.png |
| TC-08 | Search | Search "chicken" → **Search** | 4 results | 4 results | PASS | 05-search-results.png |
| TC-09 | Search filter | Tap **Fruits** category | 6 results | 6 results | PASS | — |
| TC-10 | Search | Search "xyz123" | "No foods match" empty state | Empty state shown | PASS | 06-search-empty.png |
| TC-11 | Food details | Open **Banana** | 1 medium (118 g), 105 kcal, P 1.3 g, C 27 g, F 0.4 g | Same values shown | PASS | 07-food-details.png |
| TC-12 | Food details | Servings + twice (= 2) | Calories update to 210 | 210 | PASS | 08-food-details-2-servings.png |
| TC-13 | Add meal | **Add To Meal** (Snack) | Consumed increases by 210 | Increased by 210 | PASS | 09-dashboard-after-add.png |
| TC-14 | Update stats | After TC-13 | Remaining decreases by 210 | Decreased by 210 | PASS | 09-dashboard-after-add.png |
| TC-15 | Dashboard | Remove the added meal (×) | Consumed returns to previous value | Returned to previous value | PASS | — |
| TC-16 | History | Open **History** | Shows "This week" | "This week" shown | PASS | 10-history-this-week.png |
| TC-17 | History | Tap ‹ previous week | 7 days of meal history listed | 7 days listed | PASS | 11-history-last-week.png |
| TC-18 | Edit goal | Goal = 500 → **Save** | Validation error (1,000–5,000) | Error shown | PASS | 12-profile-validation.png |
| TC-19 | Edit goal | Goal = 2,500, type Athlete → **Save** → Dashboard | Dashboard goal = 2,500 | 2,500 | PASS | 13-profile-saved.png |
| TC-20 | Update stats | After TC-19 | Remaining = 2,500 − consumed | Correct | PASS | — |
| TC-21 | Persistence | Reload the page | Goal still 2,500 | 2,500 | PASS | — |
| TC-22 | Logout | Profile → **Log out** | Back to `#/login` | `#/login` | PASS | — |
| TC-23 | Responsive | Dashboard at tablet & desktop widths | Layout adapts (two columns on desktop) | Layout adapts | PASS | 14-dashboard-tablet.png, 14-dashboard-desktop.png |

> Numbers in TC-07 and TC-13 depend on the seeded demo data for the day the test is run. The test asserts the relationship between the numbers, not fixed values.

## Unit test coverage (tests/test-runner.html)

| Module | Tests | What is covered |
|--------|-------|-----------------|
| Validator | 8 | Email format, goal range and integer check, servings |
| Auth | 9 | Valid/invalid login, case-insensitive email, empty fields, logout, password reset |
| FoodService | 7 | Name search, case-insensitivity, ranking, category filter, combined filter, no results, lookup by id |
| Nutrition | 12 | Serving scaling, totals, macro targets, remaining/negative, percent, macro split, day status |
| MealService | 8 | Add meal, total update, invalid food/servings/meal type, remove meal, meal-type suggestion |
| DateUtil / History | 4 | Monday week start, 7-day weeks, seeded history, weekly summaries |
| Profile | 1 | Goal persistence |
| Security | 1 | HTML escaping of user input (XSS) |
| **Total** | **50** | **50 passed, 0 failed** |
