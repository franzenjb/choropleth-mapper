from playwright.sync_api import sync_playwright
import time

def debug_test():
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
        
        # Take screenshot
        page.screenshot(path="step1_loaded.png")
        
        # Upload the New England ZIP test file
        print("Uploading test_new_england_zips.csv...")
        page.set_input_files('#csvInput', 'test_new_england_zips.csv')
        
        # Wait for file to be processed
        time.sleep(2)
        page.screenshot(path="step2_file_uploaded.png")
        
        # Select ZIP Code geography
        print("Selecting ZIP geography...")
        page.select_option('#geoLevel', 'zip')
        time.sleep(1)
        
        # Select the ZIP column
        print("Selecting ZIP column...")
        page.select_option('#joinColumn', 'ZIP')
        time.sleep(1)
        
        # Select Name as data column (will be aggregated as count)
        print("Selecting Name column...")
        page.select_option('#dataColumn', 'Name')
        time.sleep(1)
        
        page.screenshot(path="step3_configured.png")
        
        # Click Process button
        print("Clicking process button...")
        page.click('#processBtn')
        
        # Wait a bit for processing
        print("Waiting for processing...")
        time.sleep(5)
        
        # Take screenshot of whatever state we're in
        page.screenshot(path="step4_after_process.png")
        
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
            
        print("Browser will stay open for 30 seconds for manual inspection...")
        time.sleep(30)
        
        browser.close()

if __name__ == "__main__":
    debug_test()