from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("file:///app/index.html")

        # 1. Add a task
        page.fill("textarea[name='add-todo']", "Test Task 1")
        page.click("button.add-btn")

        # 2. Add another task
        page.fill("textarea[name='add-todo']", "Test Task 2")
        page.click("button.add-btn")

        # 3. Verify Filter Controls
        page.wait_for_selector(".filter-controls")
        print("Filter controls found.")

        # 4. Verify Sort Controls
        page.wait_for_selector(".sort-controls")
        print("Sort controls found.")

        # 5. Verify Edit Button on List Item
        # Hover over first item to see actions? Or just check existence.
        # Actions are always visible in my implementation (display: flex).
        page.wait_for_selector(".todo-actions .remove-btn[title='Edit Title']")
        print("Edit Title button found.")

        # 6. Click Edit Button and check input
        buttons = page.query_selector_all(".todo-actions .remove-btn[title='Edit Title']")
        if len(buttons) > 1:
            buttons[1].click() # Edit the second task (which is first in list if pushed? No, push appends. So second task is index 1.)
            # Wait, index 1 is second task. lists.push appends.
            # But draggable iterates lists.
            # So last added is at bottom.
            # Let's edit the last one.
            page.wait_for_selector(".edit-todo-input")
            print("Edit input appeared.")

            # 7. Take screenshot of Edit Mode
            page.screenshot(path="verification/edit_mode.png")
            print("Screenshot taken: edit_mode.png")

            # Cancel edit (blur)
            page.evaluate("document.querySelector('.edit-todo-input').blur()")

        # 8. Select a task to see details
        page.click(".todo-item:nth-child(1)")
        page.wait_for_selector(".detail-section.show")

        # 9. Verify Maximize Button
        maximize_btn = page.wait_for_selector(".detail-header .remove-btn[title='Maximize']")
        if maximize_btn:
            print("Maximize button found.")
            maximize_btn.click()
            page.wait_for_selector(".main-layout.maximized")
            print("Layout maximized.")
            page.screenshot(path="verification/maximized.png")
            print("Screenshot taken: maximized.png")

            # Minimize
            page.click(".detail-header .remove-btn[title='Minimize']")
            print("Layout minimized.")

        # 10. Verify Subtask Modal
        # Add subtask first
        page.click("button.add-sub-btn")
        # Edit subtask
        sub_edit_btn = page.wait_for_selector(".subtask-item .remove-btn[title='Edit Sub-task']")
        if sub_edit_btn:
            sub_edit_btn.click()
            page.wait_for_selector(".modal-backdrop", state="visible")
            print("Subtask modal opened.")
            page.screenshot(path="verification/subtask_modal.png")
            print("Screenshot taken: subtask_modal.png")

            # Close modal
            page.click(".modal-footer .btn-secondary")


        # 11. Verify Tabs and Goals
        tabs = page.wait_for_selector(".tabs")
        if tabs:
            print("Tabs found.")
            # Switch to Goals
            page.click("button.tab-btn:has-text('Goals')")
            page.wait_for_selector(".goals-view")
            print("Switched to Goals view.")

            # Add a Goal
            page.fill("input[placeholder*='Goal Title']", "Test Goal 1")
            page.fill("input[placeholder='Label']", "TG1")

            # Use specific selector for goal form button inside goals-view
            page.click(".goals-view .add-goal-form button.add-btn")

            # Verify Goal Added
            page.wait_for_selector(".goal-item", state="visible")
            content = page.text_content(".goal-list")
            if "Test Goal 1" in content:
                print("Goal added successfully.")
            else:
                print(f"Goal text not found. Content: {content}")

            # Switch back to Tasks
            page.click("button.tab-btn:has-text('Tasks')")
            page.wait_for_selector(".todo-container")
            print("Switched back to Tasks view.")

        browser.close()

if __name__ == "__main__":
    run()
