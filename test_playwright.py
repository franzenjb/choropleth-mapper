from playwright.sync_api import sync_playwright
import time

def test_zip_codes():
    with sync_playwright() as p:
        # Launch browser with visible UI
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        
        # Navigate to the application
        page.goto("http://localhost:3000")
        
        # Wait for page to load
        page.wait_for_selector('#uploadArea')
        
        # Upload the New England ZIP test file
        page.set_input_files('#csvInput', 'test_new_england_zips.csv')
        
        # Wait for file to be processed
        time.sleep(1)
        
        # Select ZIP Code geography
        page.select_option('#geoLevel', 'zip')
        time.sleep(0.5)
        
        # Select the ZIP column
        page.select_option('#joinColumn', 'ZIP')
        time.sleep(0.5)
        
        # Select PersonID as data column (will be aggregated as count)
        page.select_option('#dataColumn', 'PersonID')
        time.sleep(0.5)
        
        # Click Process button
        page.click('#processBtn')
        
        # Wait for processing
        page.wait_for_selector('#previewPanel:not(.hidden)', timeout=30000)
        
        # Keep browser open for inspection
        print("Map generated. Check the browser window.")
        print("The map should show ZIP codes with aggregated counts.")
        print("Press Enter to continue...")
        input()
        
        # Test with a regular 5-digit ZIP file
        page.set_input_files('#csvInput', 'test_raw_data.csv')
        time.sleep(1)
        
        # Process again
        page.select_option('#geoLevel', 'zip')
        time.sleep(0.5)
        page.select_option('#joinColumn', 'ZIP')
        time.sleep(0.5)
        page.select_option('#dataColumn', 'PersonID')
        time.sleep(0.5)
        page.click('#processBtn')
        
        # Wait for processing
        page.wait_for_selector('#previewPanel:not(.hidden)', timeout=30000)
        
        print("Second map generated with 5-digit ZIPs.")
        print("Press Enter to close the browser...")
        input()
        
        browser.close()

if __name__ == "__main__":
    test_zip_codes()