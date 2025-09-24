from playwright.sync_api import sync_playwright
import time

def test_upload():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        
        # Enable console logging
        page.on("console", lambda msg: print(f"Console: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Error: {err}"))
        
        print("Loading GitHub Pages version...")
        page.goto("https://franzenjb.github.io/choropleth-mapper/")
        
        # Wait for page load
        page.wait_for_selector('#uploadArea', timeout=10000)
        
        # Check version info
        print("\n=== VERSION INFO ===")
        version_element = page.query_selector('#versionInfo')
        if version_element:
            version_text = version_element.inner_text()
            print(f"Version text: '{version_text}'")
        else:
            print("❌ No version element found")
        
        # Check upload area
        print("\n=== UPLOAD AREA ===")
        upload_area = page.query_selector('#uploadArea')
        if upload_area:
            print("✅ Upload area found")
            
            # Try clicking it
            print("Clicking upload area...")
            upload_area.click()
            time.sleep(1)
            
            # Check if file input is present
            file_input = page.query_selector('#csvInput')
            if file_input:
                print("✅ File input found")
            else:
                print("❌ File input NOT found")
        else:
            print("❌ Upload area NOT found")
        
        # Check page source for our recent changes
        print("\n=== CHECKING FOR RECENT CHANGES ===")
        page_content = page.content()
        
        if "Initializing event listeners" in page_content:
            print("✅ Found new console log message in code")
        else:
            print("❌ New console log NOT found - may be using old version")
        
        # Take screenshot
        page.screenshot(path="test_current_state.png")
        print("\n📸 Screenshot saved: test_current_state.png")
        
        print("\nKeeping browser open for inspection...")
        input("Press Enter to close...")
        browser.close()

if __name__ == "__main__":
    test_upload()