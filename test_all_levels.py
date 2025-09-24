from playwright.sync_api import sync_playwright
import time

def test_level(page, csv_file, geo_level, join_col, data_col, test_name):
    """Test a specific geography level"""
    print(f"\n{'='*60}")
    print(f"Testing {test_name}")
    print('='*60)
    
    # Reload page for clean state
    page.reload()
    page.wait_for_selector('#uploadArea')
    
    # Upload CSV
    print(f"Uploading {csv_file}...")
    page.set_input_files('#csvInput', csv_file)
    time.sleep(2)
    
    # Configure settings
    print(f"Configuring: Level={geo_level}, Join={join_col}, Data={data_col}")
    page.select_option('#geoLevel', geo_level)
    time.sleep(1)
    page.select_option('#joinColumn', join_col)
    time.sleep(1)
    page.select_option('#dataColumn', data_col)
    time.sleep(1)
    
    # Process
    print("Processing...")
    page.click('#processBtn')
    
    # Wait for results
    time.sleep(8)
    
    # Check for errors
    error_element = page.query_selector('#error:not(.hidden)')
    if error_element:
        error_text = error_element.inner_text()
        print(f"❌ ERROR: {error_text}")
        return False
    else:
        print("✅ No errors")
    
    # Check if preview is visible
    preview = page.query_selector('#previewPanel:not(.hidden)')
    if preview:
        print("✅ Preview panel is visible")
        
        # Check if map has content
        map_element = page.query_selector('#map')
        if map_element:
            # Check map dimensions
            box = map_element.bounding_box()
            if box and box['height'] > 100:
                print(f"✅ Map is rendered (height: {box['height']}px)")
            else:
                print("❌ Map element exists but appears empty")
        
        # Take screenshot
        screenshot_name = f"test_{geo_level}_result.png"
        page.screenshot(path=screenshot_name)
        print(f"📸 Screenshot saved: {screenshot_name}")
        return True
    else:
        print("❌ Preview panel is NOT visible")
        return False

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        
        # Enable console logging
        page.on("console", lambda msg: print(f"Console: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Error: {err}"))
        
        # Go to GitHub Pages version
        print("Loading GitHub Pages version...")
        page.goto("https://franzenjb.github.io/choropleth-mapper/")
        page.wait_for_selector('#uploadArea')
        
        # Wait for new deployment
        print("Waiting for deployment to propagate...")
        time.sleep(5)
        
        results = []
        
        # Test ZIP codes
        results.append(test_level(
            page, 
            'test_zip.csv',
            'zip',
            'ZIP',
            'TestValue',
            'ZIP CODES (New England)'
        ))
        
        # Test Counties
        results.append(test_level(
            page,
            'test_county.csv', 
            'county',
            'County_FIPS',
            'TestValue',
            'COUNTIES (ME, NH, VT)'
        ))
        
        # Test States
        results.append(test_level(
            page,
            'test_state.csv',
            'state',
            'State',
            'Population',
            'STATES (New England)'
        ))
        
        # Summary
        print(f"\n{'='*60}")
        print("TEST SUMMARY")
        print('='*60)
        test_names = ['ZIP Codes', 'Counties', 'States']
        for i, (name, result) in enumerate(zip(test_names, results)):
            status = "✅ PASSED" if result else "❌ FAILED"
            print(f"{name}: {status}")
        
        all_passed = all(results)
        print(f"\nOVERALL: {'✅ ALL TESTS PASSED' if all_passed else '❌ SOME TESTS FAILED'}")
        
        if all_passed:
            print("\n🎉 The choropleth mapper is working excellently for ZIP, County, and State levels!")
        
        print("\nKeeping browser open for inspection...")
        input("Press Enter to close...")
        browser.close()

if __name__ == "__main__":
    main()