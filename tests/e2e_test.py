"""
ECTS — End-to-end (system) tests with Playwright.

Runs the real UI in headless Chromium, executes each functional test case,
saves a screenshot per step to tests/evidence/, and writes a log file
(tests/evidence/test-log.txt) with expected vs. actual results.

Usage (from the project root):
    pip install playwright && python -m playwright install chromium
    python tests/e2e_test.py
"""
import http.server
import socketserver
import threading
import functools
import os
import sys
from datetime import datetime
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EVIDENCE = os.path.join(ROOT, "tests", "evidence")
PORT = int(os.environ.get("ECTS_TEST_PORT", "0"))  # 0 = pick a free port
BASE = ""
os.makedirs(EVIDENCE, exist_ok=True)

log_lines = []
results = []


def log(msg):
    print(msg)
    log_lines.append(msg)


def check(tc_id, name, expected, actual):
    ok = str(expected) == str(actual)
    results.append(ok)
    log(f"[{'PASS' if ok else 'FAIL'}] {tc_id} {name}\n        expected: {expected}\n        actual:   {actual}")


def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    global BASE
    BASE = f"http://127.0.0.1:{httpd.server_address[1]}"
    return httpd


def shot(page, name, full=False):
    page.wait_for_timeout(700)  # let transitions finish
    page.screenshot(path=os.path.join(EVIDENCE, f"{name}.png"), full_page=full)


def num(text):
    return int("".join(c for c in text if c.isdigit()) or 0)


def main():
    httpd = serve()
    log(f"ECTS end-to-end test run — {datetime.now():%Y-%m-%d %H:%M}")
    log("=" * 64)

    with sync_playwright() as p:
        browser = p.chromium.launch()

        # ---------- Unit tests (browser runner) ----------
        page = browser.new_page(viewport={"width": 1100, "height": 900})
        page.goto(f"{BASE}/tests/test-runner.html")
        page.wait_for_function("window.__ECTS_TEST_RESULTS__")
        unit = page.evaluate("window.__ECTS_TEST_RESULTS__")
        log(f"Unit tests: {unit['passed']} passed, {unit['failed']} failed, {unit['total']} total")
        for r in unit["results"]:
            if not r["pass"]:
                log(f"   FAILED {r['id']} {r['name']}: expected {r['expected']} got {r['actual']}")
        results.append(unit["failed"] == 0)
        shot(page, "00-unit-test-results", full=True)
        page.close()

        # ---------- System tests (mobile viewport) ----------
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        page = ctx.new_page()
        page.on("dialog", lambda d: d.accept())
        page.goto(BASE + "/index.html")
        page.evaluate("localStorage.clear()")
        page.reload()

        # TC-01 auth guard
        page.goto(BASE + "/index.html#/dashboard")
        page.wait_for_timeout(300)
        check("TC-01", "Unauthenticated user is redirected to login", "#/login", page.evaluate("location.hash"))
        shot(page, "01-login-screen")

        # TC-02 empty fields
        page.click("#login-submit")
        check("TC-02", "Empty login shows validation error", "Please enter your email and password.", page.inner_text("#login-error"))

        # TC-03 invalid email format
        page.fill("#login-email", "demo")
        page.fill("#login-password", "demo123")
        page.click("#login-submit")
        check("TC-03", "Malformed email is rejected", "Please enter a valid email address.", page.inner_text("#login-error"))

        # TC-04 wrong password
        page.fill("#login-email", "demo@ects.app")
        page.fill("#login-password", "wrongpass")
        page.click("#login-submit")
        check("TC-04", "Wrong password is rejected", "Incorrect email or password.", page.inner_text("#login-error"))
        shot(page, "02-login-error")

        # TC-05 forgot password
        page.click("[data-action=open-forgot]")
        page.fill("#forgot-email", "demo@ects.app")
        page.click("#forgot-form button[type=submit]")
        check("TC-05", "Forgot password shows simulated confirmation", True, page.is_visible("#forgot-success"))
        shot(page, "03-forgot-password")
        page.click("#forgot-form [data-action=close-forgot]")

        # TC-06 successful login
        page.fill("#login-password", "demo123")
        page.click("#login-submit")
        page.wait_for_timeout(300)
        check("TC-06", "Valid login opens the dashboard", "#/dashboard", page.evaluate("location.hash"))
        shot(page, "04-dashboard")

        consumed_before = num(page.inner_text("[data-testid=calories-consumed]"))
        remaining_before = num(page.inner_text("[data-testid=calories-remaining]"))
        goal = num(page.inner_text("[data-testid=calorie-goal]"))
        check("TC-07", "Dashboard: consumed + remaining = goal", goal, consumed_before + remaining_before)

        # TC-08 search filter
        page.click("[data-nav=search]")
        page.fill("#search-input", "chicken")
        page.click("#search-submit")
        count = page.locator("#search-results .food-card").count()
        check("TC-08", "Search 'chicken' returns 4 results", 4, count)
        shot(page, "05-search-results")

        # TC-09 category filter
        page.fill("#search-input", "")
        page.click("[data-category=Fruits]")
        check("TC-09", "Category 'Fruits' shows 6 results", 6, page.locator("#search-results .food-card").count())

        # TC-10 no results
        page.fill("#search-input", "xyz123")
        page.dispatch_event("#search-input", "input")
        check("TC-10", "Unknown food shows empty state", True, "No foods match" in page.inner_text("#search-results"))
        shot(page, "06-search-empty")

        # TC-11 food details
        page.click("[data-category=All]")
        page.fill("#search-input", "banana")
        page.click("#search-submit")
        page.click("[data-food-id=banana]")
        page.wait_for_timeout(300)
        details = {
            "name": page.inner_text("[data-testid=food-name]"),
            "serving": page.inner_text("[data-testid=serving-size]"),
            "kcal": page.inner_text("[data-testid=food-calories]"),
            "protein": page.inner_text("[data-testid=food-protein]"),
            "carbs": page.inner_text("[data-testid=food-carbs]"),
            "fat": page.inner_text("[data-testid=food-fat]"),
        }
        check("TC-11", "Food details show name, serving, kcal and macros",
              {"name": "Banana", "serving": "1 medium (118 g)", "kcal": "105", "protein": "1.3g", "carbs": "27g", "fat": "0.4g"},
              details)
        shot(page, "07-food-details")

        # TC-12 servings stepper recalculates
        page.click("[data-action=servings-inc]")
        page.click("[data-action=servings-inc]")
        check("TC-12", "2 servings recalculates calories to 210", "210", page.inner_text("[data-testid=food-calories]"))
        page.click("[data-meal-type=Snack]")
        shot(page, "08-food-details-2-servings")

        # TC-13 add meal updates dashboard
        page.click("[data-testid=add-to-meal]")
        page.wait_for_timeout(300)
        consumed_after = num(page.inner_text("[data-testid=calories-consumed]"))
        remaining_after = num(page.inner_text("[data-testid=calories-remaining]"))
        check("TC-13", "Adding meal increases consumed by 210", consumed_before + 210, consumed_after)
        check("TC-14", "Remaining calories decrease by 210", remaining_before - 210, remaining_after)
        shot(page, "09-dashboard-after-add")

        # TC-15 remove meal
        page.locator("[data-action=remove-meal]").last.click()
        page.wait_for_timeout(300)
        check("TC-15", "Removing the meal restores consumed calories", consumed_before,
              num(page.inner_text("[data-testid=calories-consumed]")))

        # TC-16 history
        page.click("[data-nav=history]")
        page.wait_for_timeout(300)
        check("TC-16", "History opens on current week", True, page.inner_text("[data-testid=week-label]").startswith("This week"))
        shot(page, "10-history-this-week")
        page.click("[data-action=prev-week]")
        page.wait_for_timeout(300)
        logged = page.locator(".day-entry").count()
        check("TC-17", "Previous week shows 7 days of meal history", 7, logged)
        page.locator(".day-entry summary").first.click()
        shot(page, "11-history-last-week")

        # TC-18 profile validation
        page.click("[data-nav=profile]")
        page.fill("#profile-goal", "500")
        page.click("[data-testid=save-profile]")
        check("TC-18", "Goal below 1000 is rejected", True, "between 1000 and 5000" in page.inner_text("#profile-error"))
        shot(page, "12-profile-validation")

        # TC-19 edit goal updates dashboard
        page.fill("#profile-name", "Dima Test")
        page.fill("#profile-goal", "2500")
        page.select_option("#profile-type", "Athlete")
        page.click("[data-testid=save-profile]")
        page.wait_for_timeout(300)
        shot(page, "13-profile-saved")
        page.click("[data-nav=dashboard]")
        page.wait_for_timeout(300)
        check("TC-19", "New goal (2,500) appears on dashboard", 2500, num(page.inner_text("[data-testid=calorie-goal]")))
        check("TC-20", "Remaining recalculates against new goal", 2500 - consumed_before,
              num(page.inner_text("[data-testid=calories-remaining]")))

        # TC-21 persistence across reload
        page.reload()
        page.wait_for_timeout(300)
        check("TC-21", "Data persists after page reload (localStorage)", 2500,
              num(page.inner_text("[data-testid=calorie-goal]")))

        # TC-22 logout
        page.click("[data-nav=profile]")
        page.click("[data-action=logout]")
        page.wait_for_timeout(300)
        check("TC-22", "Logout returns to login screen", "#/login", page.evaluate("location.hash"))
        ctx.close()

        # ---------- Responsive screenshots ----------
        for label, vp in [("tablet", {"width": 820, "height": 1180}), ("desktop", {"width": 1366, "height": 900})]:
            c = browser.new_context(viewport=vp)
            pg = c.new_page()
            pg.goto(BASE + "/index.html")
            pg.evaluate("localStorage.clear()")
            pg.reload()
            pg.fill("#login-email", "demo@ects.app")
            pg.fill("#login-password", "demo123")
            pg.click("#login-submit")
            pg.wait_for_timeout(500)
            shot(pg, f"14-dashboard-{label}")
            c.close()

        browser.close()
    httpd.shutdown()

    passed = sum(results)
    log("=" * 64)
    log(f"System tests: {passed}/{len(results)} checks passed")
    with open(os.path.join(EVIDENCE, "test-log.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(log_lines) + "\n")
    sys.exit(0 if passed == len(results) else 1)


if __name__ == "__main__":
    main()
