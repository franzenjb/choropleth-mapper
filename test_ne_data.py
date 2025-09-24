from playwright.sync_api import sync_playwright
import time

def test_ne_data():
    with sync_playwright() as p:
        # Launch browser with visible UI
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        
        # Enable console logging
        page.on("console", lambda msg: print(f"Browser console: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Page error: {err}"))
        
        # Navigate to the application
        print("Navigating to http://localhost:3000...")
        page.goto("http://localhost:3000")
        
        # Wait for page to load
        page.wait_for_selector('#uploadArea')
        print("Page loaded.")
        
        # Upload the real New England data file
        print("Uploading ne_test_data.csv...")
        page.set_input_files('#csvInput', 'ne_test_data.csv')
        
        # Wait for file to be processed
        time.sleep(2)
        
        # Select ZIP Code geography
        print("Selecting ZIP geography...")
        page.select_option('#geoLevel', 'zip')
        time.sleep(1)
        
        # Select the Zip column
        print("Selecting Zip column...")
        page.select_option('#joinColumn', 'Zip')
        time.sleep(1)
        
        # Select Full Name as data column (will be aggregated as count)
        print("Selecting Full Name column...")
        page.select_option('#dataColumn', 'Full Name')
        time.sleep(1)
        
        # Take screenshot before processing
        page.screenshot(path="before_process.png")
        
        # Click Process button
        print("Clicking process button...")
        page.click('#processBtn')
        
        # Wait for processing
        print("Waiting for processing...")
        time.sleep(10)
        
        # Take screenshot after processing
        page.screenshot(path="after_process.png")
        
        # Check if error panel is visible
        error_element = page.query_selector('#error:not(.hidden)')
        if error_element:
            error_text = error_element.inner_text()
            print(f"ERROR FOUND: {error_text}")
        
        # Check if preview panel is visible
        preview_element = page.query_selector('#previewPanel:not(.hidden)')
        if preview_element:
            print("SUCCESS: Preview panel is visible!")
        else:
            print("Preview panel is not visible")
            
        print("Browser will stay open for manual inspection...")
        print("Press Enter to close...")
        input()
        
        browser.close()

if __name__ == "__main__":
    test_ne_data()