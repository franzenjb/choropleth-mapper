from playwright.sync_api import sync_playwright
import time

def check_version():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        
        # Check GitHub Pages version
        print("Checking GitHub Pages version...")
        page_gh = browser.new_page()
        page_gh.goto("https://franzenjb.github.io/choropleth-mapper/")
        time.sleep(2)
        
        # Get version text from GitHub Pages
        version_gh = page_gh.query_selector('#versionInfo')
        if version_gh:
            gh_text = version_gh.inner_text()
            print(f"GitHub Pages version: {gh_text}")
        else:
            print("Version info not found on GitHub Pages")
        
        # Take screenshot
        page_gh.screenshot(path="github_pages_version.png")
        
        # Check local version
        print("\nChecking local version...")
        page_local = browser.new_page()
        page_local.goto("http://localhost:3000")
        time.sleep(2)
        
        # Get version text from local
        version_local = page_local.query_selector('#versionInfo')
        if version_local:
            local_text = version_local.inner_text()
            print(f"Local version: {local_text}")
        else:
            print("Version info not found locally")
        
        # Take screenshot
        page_local.screenshot(path="local_version.png")
        
        print("\nBrowser will stay open for 10 seconds...")
        time.sleep(10)
        
        browser.close()

if __name__ == "__main__":
    check_version()