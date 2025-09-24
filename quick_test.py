from playwright.sync_api import sync_playwright
import time
import sys

def test_level(page, csv_file, geo_level, join_col, data_col, test_name):
    """Test a specific geography level"""
    print(f"\nTesting {test_name}...")
    
    # Reload page for clean state
    page.reload()
    page.wait_for_selector('#uploadArea', timeout=5000)
    
    # Upload CSV
    page.set_input_files('#csvInput', csv_file)
    time.sleep(2)
    
    # Configure settings
    page.select_option('#geoLevel', geo_level)
    time.sleep(0.5)
    page.select_option('#joinColumn', join_col)
    time.sleep(0.5)
    page.select_option('#dataColumn', data_col)
    time.sleep(0.5)
    
    # Process
    page.click('#processBtn')
    
    # Wait for results
    time.sleep(5)
    
    # Check for errors
    error_element = page.query_selector('#error:not(.hidden)')
    if error_element:
        error_text = error_element.inner_text()
        print(f"  ❌ ERROR: {error_text[:100]}")
        return False
    
    # Check if preview is visible
    preview = page.query_selector('#previewPanel:not(.hidden)')
    if preview:
        print(f"  ✅ SUCCESS - Map displayed")
        return True
    else:
        print(f"  ❌ FAILED - No preview")
        return False

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    # Enable minimal console logging
    page.on("console", lambda msg: None)
    
    # Go to GitHub Pages version
    page.goto("https://franzenjb.github.io/choropleth-mapper/", timeout=30000)
    page.wait_for_selector('#uploadArea', timeout=10000)
    
    print("="*60)
    print("CHOROPLETH MAPPER TEST")
    print("="*60)
    
    # Test each level
    zip_result = test_level(page, 'test_zip.csv', 'zip', 'ZIP', 'TestValue', 'ZIP CODES')
    county_result = test_level(page, 'test_county.csv', 'county', 'County_FIPS', 'TestValue', 'COUNTIES') 
    state_result = test_level(page, 'test_state.csv', 'state', 'State', 'Population', 'STATES')
    
    print("\n" + "="*60)
    print("SUMMARY:")
    print(f"  ZIP Codes: {'✅ PASSED' if zip_result else '❌ FAILED'}")
    print(f"  Counties:  {'✅ PASSED' if county_result else '❌ FAILED'}")
    print(f"  States:    {'✅ PASSED' if state_result else '❌ FAILED'}")
    print("="*60)
    
    if zip_result and county_result and state_result:
        print("\n🎉 SUCCESS: All geographic levels working!")
    else:
        print("\n⚠️  Some tests failed. Check implementation.")
    
    browser.close()