const { chromium } = require('@playwright/test');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500 
  });
  
  const page = await browser.newPage();
  
  console.log('1. Navigating to bivariate-mode.html...');
  await page.goto('https://franzenjb.github.io/choropleth-mapper/bivariate-mode.html');
  
  // Wait for page to load
  await page.waitForLoadState('networkidle');
  
  console.log('2. Checking if page loaded...');
  const title = await page.title();
  console.log('   Page title:', title);
  
  // Check if map is visible
  const mapVisible = await page.isVisible('#map');
  console.log('3. Map element visible:', mapVisible);
  
  // Get map dimensions
  const mapBox = await page.locator('#map').boundingBox();
  console.log('   Map dimensions:', mapBox);
  
  // Check for any console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('   Console error:', msg.text());
    }
  });
  
  console.log('4. Uploading Georgia counties CSV...');
  
  // Upload the file
  const fileInput = await page.locator('#csvFile');
  await fileInput.setInputFiles('/Users/jefffranzen/Desktop/georgia_counties_voting.csv');
  
  // Wait for processing
  await page.waitForTimeout(2000);
  
  console.log('5. Checking if variable selectors appeared...');
  const variableSectionVisible = await page.isVisible('#variableSection');
  console.log('   Variable section visible:', variableSectionVisible);
  
  if (variableSectionVisible) {
    // Get available variables
    const xOptions = await page.locator('#xVariable option').allTextContents();
    console.log('   X-axis variables:', xOptions);
    
    const yOptions = await page.locator('#yVariable option').allTextContents();
    console.log('   Y-axis variables:', yOptions);
    
    // Select variables
    console.log('6. Selecting variables...');
    await page.selectOption('#xVariable', { index: 0 });
    await page.selectOption('#yVariable', { index: 1 });
    
    // Click generate map
    console.log('7. Generating bivariate map...');
    await page.click('button:has-text("Generate Bivariate Map")');
    
    await page.waitForTimeout(2000);
    
    // Check if legend appeared
    const legendVisible = await page.isVisible('#legendContainer');
    console.log('8. Legend visible:', legendVisible);
    
    // Check quadrant analysis
    const quadrantVisible = await page.isVisible('#quadrantSection');
    console.log('9. Quadrant analysis visible:', quadrantVisible);
    
    if (quadrantVisible) {
      const highHigh = await page.textContent('#highHighCounties');
      const lowLow = await page.textContent('#lowLowCounties');
      console.log('   High-High counties:', highHigh);
      console.log('   Low-Low counties:', lowLow);
    }
    
    // Check correlation
    const correlationValue = await page.textContent('#correlationValue');
    console.log('10. Correlation value:', correlationValue);
    
    // Check map tiles
    const tiles = await page.locator('.leaflet-tile').count();
    console.log('11. Leaflet tiles loaded:', tiles);
    
    // Check for county boundaries
    const paths = await page.locator('#map path').count();
    console.log('12. SVG paths (county boundaries):', paths);
    
    // Take screenshot
    await page.screenshot({ path: 'bivariate-test.png', fullPage: true });
    console.log('13. Screenshot saved as bivariate-test.png');
  }
  
  await page.waitForTimeout(5000); // Keep browser open to see result
  
  await browser.close();
  console.log('Test complete!');
})();