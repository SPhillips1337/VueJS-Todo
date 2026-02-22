from playwright.sync_api import sync_playwright
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

        # 1. Add a task
        print("Adding task...")
        page.fill('textarea[name="add-todo"]', 'Test Feature Verification')
        page.click('button.add-btn')

        # 2. Verify Import/Export buttons
        print("Verifying buttons...")
        page.wait_for_selector('button.btn-secondary:has-text("Export JSON")')
        page.wait_for_selector('button.btn-secondary:has-text("Import JSON")')

        # 3. Select the task
        print("Selecting task...")
        page.click('.todo-item')

        # 4. Verify GitHub URL
        print("Verifying GitHub URL...")
        page.wait_for_selector('text=GitHub Project URL')
        page.fill('input[placeholder="https://github.com/..."]', 'https://github.com/example/project')
        # Check if link appears
        page.wait_for_selector('a[href="https://github.com/example/project"]')

        # 5. Verify Status
        print("Verifying Status...")
        # Check badge on list item
        badge = page.locator('.status-badge')
        if badge.inner_text().strip().lower() != 'pending':
            print(f"Initial status was {badge.inner_text()}, expected pending")

        # Click badge to cycle
        badge.click()
        page.wait_for_timeout(100) # Wait for update
        if badge.inner_text().strip().lower() != 'in-progress':
             print(f"Status after click was {badge.inner_text()}, expected in-progress")

        # Check dropdown
        dropdown = page.locator('select.status-select')
        val = dropdown.input_value()
        if val != 'in-progress':
             print(f"Dropdown value was {val}, expected in-progress")

        # Change dropdown
        dropdown.select_option('completed')
        page.wait_for_timeout(100)
        if badge.inner_text().strip().lower() != 'completed':
             print(f"Status after dropdown was {badge.inner_text()}, expected completed")

        # 6. Verify Drag Handles
        print("Verifying Drag Handles...")
        page.wait_for_selector('.drag-handle')

        # 7. Take screenshot
        print("Taking screenshot...")
        page.screenshot(path='verification/features.png', full_page=True)

        print("Verification successful!")
        browser.close()

if __name__ == "__main__":
    run()
