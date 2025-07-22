/**
 * Manual Cross-Site Text Expansion Tests
 * Tests text expansion across different websites using your existing browser
 * Run with: npx playwright test cross-site-expansion-manual.spec.ts --headed --project manual
 */

import { test, expect, Page } from "@playwright/test";

// Test sites configuration for manual testing
interface ManualTestSite {
  name: string;
  url: string;
  instructions: string;
  expectedBehavior: string;
}

const MANUAL_TEST_SITES: ManualTestSite[] = [
  {
    name: "Text.new",
    url: "https://text.new/",
    instructions: "Click in the editor and type 'hello' - should expand to 'Hello, World!'",
    expectedBehavior: "Automatic expansion",
  },
  {
    name: "CodePen Editor",
    url: "https://codepen.io/pen/",
    instructions: "Click in the JavaScript panel and type 'hello' - may require paste fallback",
    expectedBehavior: "Paste strategy fallback",
  },
  {
    name: "GitHub New Issue",
    url: "https://github.com/microsoft/vscode/issues/new",
    instructions: "Click in the title field and type 'hello' - should expand normally",
    expectedBehavior: "Standard expansion",
  },
  {
    name: "Local Test Page",
    url: "data:text/html,<!DOCTYPE html><html><body><h1>Test Page</h1><input type='text' placeholder='Type hello here' style='width:300px;padding:10px;font-size:16px;'><br><br><textarea placeholder='Or type here' style='width:300px;height:100px;padding:10px;font-size:16px;'></textarea></body></html>",
    instructions: "Type 'hello' in either input - should expand to 'Hello, World!'",
    expectedBehavior: "Perfect expansion",
  },
];

// Test snippets that should be available
const EXPECTED_SNIPPETS = [
  { trigger: "hello", content: "Hello, World!" },
  { trigger: "signature", content: "Best regards,\nJohn Doe\nSoftware Engineer" },
  { trigger: "html-test", content: "<strong>Bold text</strong> and <em>italic text</em>" },
];

test.describe("Manual Cross-Site Expansion Tests", () => {
  test("Extension availability check", async ({ page }) => {
    console.log("🔍 Checking if PuffPuffPaste extension is available...");
    
    // Navigate to a simple page and check if extension is loaded
    await page.goto("data:text/html,<input type='text' id='test-input' placeholder='Type hello to test extension'>");
    
    await page.waitForTimeout(2000); // Allow extension to load
    
    // Try typing a trigger
    const input = page.locator("#test-input");
    await input.click();
    await input.type("hello");
    
    await page.waitForTimeout(1500); // Wait for expansion
    
    const value = await input.inputValue();
    
    if (value.includes("Hello, World!")) {
      console.log("✅ Extension is working! Found expansion.");
    } else if (value === "hello") {
      console.log("❌ Extension may not be loaded. Trigger text remains unchanged.");
      console.log("💡 Make sure PuffPuffPaste extension is installed and enabled.");
    } else {
      console.log(`❓ Unexpected result: "${value}"`);
    }
    
    // Take screenshot for manual verification
    await page.screenshot({ 
      path: `test-results/extension-check-${Date.now()}.png`,
      fullPage: true 
    });
  });

  // Test each site manually
  for (const site of MANUAL_TEST_SITES) {
    test(`Manual test: ${site.name}`, async ({ page }) => {
      console.log(`\n🧪 Testing: ${site.name}`);
      console.log(`📋 Instructions: ${site.instructions}`);
      console.log(`🎯 Expected: ${site.expectedBehavior}`);
      
      try {
        await page.goto(site.url);
        await page.waitForLoadState("domcontentloaded");
        await page.waitForTimeout(3000); // Allow dynamic content to load
        
        // Take initial screenshot
        await page.screenshot({ 
          path: `test-results/${site.name.replace(/\s+/g, '-')}-initial.png`,
          fullPage: true 
        });
        
        console.log(`📄 Page loaded: ${site.name}`);
        console.log(`🔗 URL: ${page.url()}`);
        console.log(`📝 Title: ${await page.title()}`);
        
        // Check for common input elements
        const inputs = await page.locator('input[type="text"], textarea, [contenteditable="true"]').count();
        console.log(`🎯 Found ${inputs} potential input element(s)`);
        
        // Wait for manual interaction
        console.log("⏱️ Waiting 10 seconds for manual testing...");
        console.log("👆 Please manually test text expansion on this page");
        
        await page.waitForTimeout(10000);
        
        // Take final screenshot
        await page.screenshot({ 
          path: `test-results/${site.name.replace(/\s+/g, '-')}-after-manual-test.png`,
          fullPage: true 
        });
        
        console.log(`✅ Manual test completed for ${site.name}`);
        
      } catch (error) {
        console.error(`❌ Error testing ${site.name}:`, error);
        
        await page.screenshot({ 
          path: `test-results/${site.name.replace(/\s+/g, '-')}-error.png`,
          fullPage: true 
        });
      }
    });
  }

  test("Automated input detection test", async ({ page }) => {
    console.log("🤖 Running automated input detection test...");
    
    // Create a comprehensive test page
    const testHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>PuffPuffPaste Input Detection Test</title>
        <style>
          .test-section { margin: 20px; padding: 15px; border: 2px solid #ddd; border-radius: 8px; }
          .test-section h3 { margin-top: 0; color: #333; }
          input, textarea { margin: 5px; padding: 8px; width: 300px; }
          [contenteditable] { border: 1px solid #ccc; padding: 10px; min-height: 40px; background: #f9f9f9; }
          .result { color: #0066cc; font-weight: bold; margin: 5px 0; }
        </style>
      </head>
      <body>
        <h1>🧪 PuffPuffPaste Cross-Site Test Suite</h1>
        
        <div class="test-section">
          <h3>📝 Standard HTML Inputs</h3>
          <div>
            <label>Text Input:</label><br>
            <input type="text" id="text-input" placeholder="Type 'hello' here">
            <div class="result" id="text-result">Waiting for input...</div>
          </div>
          <br>
          <div>
            <label>Textarea:</label><br>
            <textarea id="textarea" placeholder="Type 'hello' here"></textarea>
            <div class="result" id="textarea-result">Waiting for input...</div>
          </div>
        </div>
        
        <div class="test-section">
          <h3>🎨 ContentEditable Elements</h3>
          <div>
            <label>ContentEditable Div:</label><br>
            <div id="contenteditable" contenteditable="true">Click here and type 'hello'</div>
            <div class="result" id="contenteditable-result">Waiting for input...</div>
          </div>
        </div>
        
        <div class="test-section">
          <h3>📊 Test Results</h3>
          <div id="overall-results">
            <p>🎯 <strong>Instructions:</strong></p>
            <ol>
              <li>Type "hello" in each input field above</li>
              <li>Watch for automatic expansion to "Hello, World!"</li>
              <li>Note any failures or unusual behavior</li>
            </ol>
            <p><strong>Expected behavior:</strong> Each "hello" should expand to "Hello, World!" automatically</p>
          </div>
        </div>
        
        <script>
          // Monitor input changes
          function setupMonitoring(elementId, resultId) {
            const element = document.getElementById(elementId);
            const result = document.getElementById(resultId);
            
            let lastValue = '';
            
            function checkValue() {
              const currentValue = element.value || element.textContent || '';
              
              if (currentValue !== lastValue) {
                lastValue = currentValue;
                
                if (currentValue.includes('Hello, World!')) {
                  result.textContent = '✅ PASS: Expansion worked!';
                  result.style.color = 'green';
                } else if (currentValue.includes('hello') && currentValue.length > 5) {
                  result.textContent = '🔄 PARTIAL: Text changed but no expansion';
                  result.style.color = 'orange';
                } else if (currentValue.includes('hello')) {
                  result.textContent = '⏱️ WAITING: Trigger detected, waiting for expansion...';
                  result.style.color = 'blue';
                } else if (currentValue.length > 0) {
                  result.textContent = '📝 INPUT: ' + currentValue.substring(0, 50);
                  result.style.color = 'gray';
                } else {
                  result.textContent = 'Waiting for input...';
                  result.style.color = 'gray';
                }
              }
            }
            
            // Set up event listeners
            element.addEventListener('input', checkValue);
            element.addEventListener('keyup', checkValue);
            element.addEventListener('change', checkValue);
            
            // Poll for changes (in case events don't fire)
            setInterval(checkValue, 500);
          }
          
          // Setup monitoring for all test inputs
          setupMonitoring('text-input', 'text-result');
          setupMonitoring('textarea', 'textarea-result');
          setupMonitoring('contenteditable', 'contenteditable-result');
          
          console.log('🚀 PuffPuffPaste test page loaded and ready!');
        </script>
      </body>
      </html>
    `;
    
    await page.goto(`data:text/html,${encodeURIComponent(testHtml)}`);
    
    console.log("📄 Test page loaded");
    console.log("🎯 Testing automatic input detection and expansion...");
    
    // Test each input type
    const testInputs = [
      { selector: "#text-input", name: "Text Input" },
      { selector: "#textarea", name: "Textarea" },
      { selector: "#contenteditable", name: "ContentEditable" },
    ];
    
    for (const input of testInputs) {
      console.log(`\n🧪 Testing: ${input.name}`);
      
      try {
        const element = page.locator(input.selector);
        
        // Clear any existing content
        await element.click();
        await page.keyboard.press("Control+a");
        await page.keyboard.press("Delete");
        
        // Type the trigger
        await element.type("hello", { delay: 100 });
        
        // Wait for potential expansion
        await page.waitForTimeout(2000);
        
        // Check the result
        const value = input.selector === "#contenteditable" 
          ? await element.textContent() 
          : await element.inputValue();
        
        console.log(`📝 Result for ${input.name}: "${value}"`);
        
        if (value && value.includes("Hello, World!")) {
          console.log(`✅ ${input.name}: Expansion successful!`);
        } else if (value === "hello") {
          console.log(`❌ ${input.name}: No expansion - trigger remains`);
        } else {
          console.log(`❓ ${input.name}: Unexpected result`);
        }
        
      } catch (error) {
        console.error(`❌ Error testing ${input.name}:`, error);
      }
    }
    
    // Take final screenshot
    await page.screenshot({ 
      path: `test-results/automated-detection-test-final.png`,
      fullPage: true 
    });
    
    console.log("\n📊 Automated test completed!");
    console.log("📸 Screenshots saved to test-results/");
  });

  test("Cross-site compatibility report", async ({ page }) => {
    console.log("📋 Generating cross-site compatibility report...");
    
    const compatibilityTests = [
      { site: "Simple HTML", url: "data:text/html,<input type='text'>" },
      { site: "Gmail-style", url: "data:text/html,<div contenteditable='true' style='border:1px solid #ccc; padding:10px;'>Type here</div>" },
      { site: "Code editor-style", url: "data:text/html,<textarea style='font-family:monospace; background:#1e1e1e; color:#d4d4d4; padding:10px;'></textarea>" },
    ];
    
    const report = {
      testDate: new Date().toISOString(),
      browser: "Chrome (Playwright controlled)",
      extension: "PuffPuffPaste",
      results: [] as any[],
    };
    
    for (const testCase of compatibilityTests) {
      console.log(`🧪 Testing compatibility: ${testCase.site}`);
      
      try {
        await page.goto(testCase.url);
        await page.waitForTimeout(1000);
        
        const input = page.locator("input, textarea, [contenteditable='true']").first();
        await input.click();
        await input.type("hello");
        await page.waitForTimeout(1500);
        
        const value = await input.evaluate(el => 
          (el as HTMLInputElement).value || el.textContent || ''
        );
        
        const testResult = {
          site: testCase.site,
          url: testCase.url,
          triggerText: "hello",
          resultText: value,
          expansionWorked: value.includes("Hello, World!"),
          timestamp: new Date().toISOString(),
        };
        
        report.results.push(testResult);
        
        console.log(`📊 ${testCase.site}: ${testResult.expansionWorked ? '✅ PASS' : '❌ FAIL'}`);
        
      } catch (error) {
        console.error(`❌ Error testing ${testCase.site}:`, error);
        
        report.results.push({
          site: testCase.site,
          url: testCase.url,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    }
    
    // Output report
    console.log("\n📋 COMPATIBILITY REPORT");
    console.log("========================");
    console.log(`Test Date: ${report.testDate}`);
    console.log(`Browser: ${report.browser}`);
    console.log(`Extension: ${report.extension}`);
    console.log("\nResults:");
    
    report.results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.site}:`);
      if (result.error) {
        console.log(`   ❌ ERROR: ${result.error}`);
      } else {
        console.log(`   Status: ${result.expansionWorked ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`   Input: "${result.triggerText}"`);
        console.log(`   Output: "${result.resultText}"`);
      }
      console.log("");
    });
    
    const passCount = report.results.filter(r => r.expansionWorked).length;
    const totalCount = report.results.length;
    
    console.log(`📊 Summary: ${passCount}/${totalCount} tests passed (${Math.round(passCount/totalCount*100)}%)`);
    
    // Save report to file (in test results)
    await page.evaluate((reportData) => {
      console.log("📄 Full report:", JSON.stringify(reportData, null, 2));
    }, report);
  });
});