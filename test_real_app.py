from playwright.sync_api import sync_playwright
import time

def test_real_app():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        
        # Enable console logging
        page.on("console", lambda msg: print(f"Console: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Error: {err}"))
        
        # Go to GitHub Pages version
        print("Testing GitHub Pages version...")
        page.goto("https://franzenjb.github.io/choropleth-mapper/")
        page.wait_for_selector('#uploadArea')
        
        # Upload NE data
        print("Uploading ne_test_data.csv...")
        page.set_input_files('#csvInput', 'ne_test_data.csv')
        time.sleep(2)
        
        # Configure
        print("Configuring...")
        page.select_option('#geoLevel', 'zip')
        time.sleep(1)
        page.select_option('#joinColumn', 'Zip')
        time.sleep(1)
        page.select_option('#dataColumn', 'Full Name')
        time.sleep(1)
        
        # Process
        print("Processing...")
        page.click('#processBtn')
        
        # Wait and capture result
        time.sleep(10)
        
        # Check for errors
        error_element = page.query_selector('#error:not(.hidden)')
        if error_element:
            error_text = error_element.inner_text()
            print(f"\n❌ ERROR FOUND:\n{error_text}\n")
        else:
            print("✓ No error displayed")
        
        # Check if map is visible
        preview = page.query_selector('#previewPanel:not(.hidden)')
        if preview:
            print("✓ Preview panel is visible")
        else:
            print("❌ Preview panel is NOT visible")
        
        page.screenshot(path="test_result.png")
        
        print("\nKeeping browser open for inspection...")
        input("Press Enter to close...")
        browser.close()

if __name__ == "__main__":
    test_real_app()