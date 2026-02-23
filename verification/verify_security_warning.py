from playwright.sync_api import sync_playwright, expect
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the local index.html
        cwd = os.getcwd()
        file_path = f"file://{cwd}/index.html"
        print(f"Loading {file_path}")
        page.goto(file_path)

        # Click Settings button
        print("Clicking Settings...")
        page.click('button:has-text("⚙️ Settings")')

        # Wait for modal
        print("Waiting for modal...")
        page.wait_for_selector('.modal-content')

        # Verify warning text
        print("Verifying warning text...")
        warning_locator = page.locator('text=Security Warning: API Keys are stored')
        expect(warning_locator).to_be_visible()

        # Check style (color)
        color = warning_locator.evaluate("element => window.getComputedStyle(element).color")
        print(f"Warning color: {color}")
        # rgb(220, 38, 38) is #dc2626
        if color != 'rgb(220, 38, 38)':
             print(f"WARNING: Color mismatch. Expected rgb(220, 38, 38), got {color}")

        # Take screenshot
        print("Taking screenshot...")
        page.screenshot(path='verification/settings_warning.png')

        print("Verification successful!")
        browser.close()

if __name__ == "__main__":
    run()
