from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    page.on('console', lambda msg: print(f'Console: {msg.text}'))
    page.on('pageerror', lambda err: print(f'JS Error: {err}'))
    
    print('Testing GitHub Pages...')
    page.goto('https://franzenjb.github.io/choropleth-mapper/')
    page.wait_for_selector('#uploadArea', timeout=10000)
    
    # Check version
    version = page.query_selector('#versionInfo')
    if version:
        text = version.inner_text()
        print(f'Version: {text if text else "[EMPTY]"}')
    else:
        print('Version element not found')
    
    # Check upload
    upload_area = page.query_selector('#uploadArea')
    if upload_area:
        print('Upload area: ✅ FOUND')
        upload_area.click()
        time.sleep(0.5)
        file_input = page.query_selector('#csvInput')
        print(f'File input clickable: {"✅ YES" if file_input else "❌ NO"}')
    
    browser.close()
    print('Test complete!')