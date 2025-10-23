from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()
    page.goto("http://localhost:5173/login")
    page.screenshot(path="jules-scratch/verification/login_page_debug.png") # Debug screenshot
    page.get_by_label("ایمیل").fill("admin@example.com")
    page.get_by_label("رمز عبور").fill("password")
    page.get_by_role("button", name="ورود").click()
    page.wait_for_url("http://localhost:5173/")
    page.get_by_role("button", name="افزودن ولی").click()
    page.screenshot(path="jules-scratch/verification/verification.png")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
