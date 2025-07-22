/**
 * Simple Cross-Site Text Expansion Test
 * Basic test to verify extension functionality across different input types
 * Run with: npx playwright test simple-cross-site-test.spec.ts --project manual --headed
 */

import { test, expect } from "@playwright/test";

test.describe("Simple Cross-Site Extension Tests", () => {
  test("Basic functionality test", async ({ page }) => {
    console.log("🚀 Starting basic functionality test...");

    // Create a simple test page with multiple input types
    const testPage = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Extension Test</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .test-item { margin: 20px 0; padding: 15px; border: 1px solid #ddd; }
          input, textarea { width: 300px; padding: 8px; font-size: 14px; }
          .contenteditable { border: 1px solid #ccc; padding: 10px; min-height: 50px; background: #f9f9f9; }
          .status { font-weight: bold; margin-top: 10px; }
          .pass { color: green; }
          .fail { color: red; }
          .pending { color: orange; }
        </style>
      </head>
      <body>
        <h1>🧪 PuffPuffPaste Extension Test</h1>
        <p><strong>Instructions:</strong> Type "hello" in each field below. It should expand to "Hello, World!"</p>
        
        <div class="test-item">
          <h3>Text Input</h3>
          <input type="text" id="test-input" placeholder="Type 'hello' here">
          <div class="status pending" id="input-status">Waiting for test...</div>
        </div>
        
        <div class="test-item">
          <h3>Textarea</h3>
          <textarea id="test-textarea" placeholder="Type 'hello' here"></textarea>
          <div class="status pending" id="textarea-status">Waiting for test...</div>
        </div>
        
        <div class="test-item">
          <h3>ContentEditable</h3>
          <div id="test-contenteditable" class="contenteditable" contenteditable="true">Click here and type 'hello'</div>
          <div class="status pending" id="contenteditable-status">Waiting for test...</div>
        </div>
        
        <div class="test-item">
          <h3>Test Summary</h3>
          <div id="summary">Tests not started</div>
        </div>
        
        <script>
          let testResults = {
            input: null,
            textarea: null,
            contenteditable: null
          };
          
          function updateStatus(elementId, statusId, value) {
            const status = document.getElementById(statusId);
            
            if (value.includes('Hello, World!')) {
              status.textContent = '✅ PASS: Expansion worked!';
              status.className = 'status pass';
              testResults[elementId.replace('test-', '')] = true;
            } else if (value === 'hello') {
              status.textContent = '❌ FAIL: No expansion detected';
              status.className = 'status fail';
              testResults[elementId.replace('test-', '')] = false;
            } else if (value.includes('hello')) {
              status.textContent = '⏳ PARTIAL: Text changed, waiting for expansion...';
              status.className = 'status pending';
            } else if (value.length > 0) {
              status.textContent = '📝 INPUT: ' + value;
              status.className = 'status pending';
            }
            
            updateSummary();
          }
          
          function updateSummary() {
            const summary = document.getElementById('summary');
            const results = Object.values(testResults).filter(r => r !== null);
            const passes = results.filter(r => r === true).length;
            const fails = results.filter(r => r === false).length;
            const total = Object.keys(testResults).length;
            
            if (results.length === 0) {
              summary.textContent = 'Tests not started';
            } else if (results.length < total) {
              summary.textContent = \`Testing in progress... (\${results.length}/\${total} completed)\`;
            } else {
              summary.textContent = \`Tests completed: \${passes} passed, \${fails} failed\`;
              summary.className = passes === total ? 'pass' : 'fail';
            }
          }
          
          // Monitor input changes
          document.getElementById('test-input').addEventListener('input', function() {
            updateStatus('test-input', 'input-status', this.value);
          });
          
          document.getElementById('test-textarea').addEventListener('input', function() {
            updateStatus('test-textarea', 'textarea-status', this.value);
          });
          
          document.getElementById('test-contenteditable').addEventListener('input', function() {
            updateStatus('test-contenteditable', 'contenteditable-status', this.textContent || '');
          });
          
          // Also monitor with polling for extra reliability
          setInterval(function() {
            const input = document.getElementById('test-input');
            const textarea = document.getElementById('test-textarea');
            const contenteditable = document.getElementById('test-contenteditable');
            
            updateStatus('test-input', 'input-status', input.value);
            updateStatus('test-textarea', 'textarea-status', textarea.value);
            updateStatus('test-contenteditable', 'contenteditable-status', contenteditable.textContent || '');
          }, 1000);
          
          console.log('📋 Test page loaded and monitoring started');
        </script>
      </body>
      </html>
    `;

    // Navigate to the test page
    await page.goto(`data:text/html,${encodeURIComponent(testPage)}`);

    console.log("📄 Test page loaded");

    // Wait a moment for any extension initialization
    await page.waitForTimeout(2000);

    // Test each input type
    const inputs = [
      { selector: "#test-input", name: "Text Input" },
      { selector: "#test-textarea", name: "Textarea" },
      { selector: "#test-contenteditable", name: "ContentEditable" },
    ];

    console.log("🧪 Starting automated tests...");

    for (const input of inputs) {
      console.log(`\n📝 Testing: ${input.name}`);

      try {
        const element = page.locator(input.selector);

        // Focus the element
        await element.click();
        await page.waitForTimeout(500);

        // Clear any existing content
        if (input.selector === "#test-contenteditable") {
          // For contenteditable, select all and delete
          await page.keyboard.press("Control+a");
          await page.keyboard.press("Delete");
        } else {
          // For input/textarea, clear the value
          await element.clear();
        }

        await page.waitForTimeout(200);

        // Type the trigger slowly
        await element.type("hello", { delay: 150 });

        console.log(`⌨️ Typed "hello" in ${input.name}`);

        // Wait for potential expansion
        await page.waitForTimeout(2000);

        // Get the current value
        let value;
        if (input.selector === "#test-contenteditable") {
          value = await element.textContent();
        } else {
          value = await element.inputValue();
        }

        console.log(`📊 Result: "${value}"`);

        if (value && value.includes("Hello, World!")) {
          console.log(`✅ ${input.name}: PASS - Expansion worked!`);
        } else if (value === "hello") {
          console.log(
            `❌ ${input.name}: FAIL - No expansion (extension may not be loaded)`,
          );
        } else {
          console.log(`❓ ${input.name}: UNCLEAR - Unexpected result`);
        }
      } catch (error) {
        console.error(`❌ Error testing ${input.name}:`, error);
      }

      // Small delay between tests
      await page.waitForTimeout(1000);
    }

    // Take a final screenshot
    await page.screenshot({
      path: "test-results/simple-cross-site-test-final.png",
      fullPage: true,
    });

    console.log("\n📊 Test completed!");
    console.log(
      "📸 Screenshot saved to test-results/simple-cross-site-test-final.png",
    );
    console.log("\n💡 If tests failed:");
    console.log(
      "   1. Make sure the PuffPuffPaste extension is installed and enabled",
    );
    console.log(
      "   2. Create a snippet with trigger 'hello' and content 'Hello, World!'",
    );
    console.log("   3. Enable the extension on all sites");

    // Keep the browser open for manual verification
    console.log(
      "\n⏸️ Keeping browser open for 30 seconds for manual verification...",
    );
    await page.waitForTimeout(30000);
  });

  test("Real site test", async ({ page }) => {
    console.log("🌐 Testing on a real website...");

    try {
      // Test on text.new - a simple text editor
      await page.goto("https://text.new/");
      console.log("📄 Navigated to text.new");

      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(3000);

      // Try to find the main text area
      const textArea = page
        .locator("textarea, [contenteditable='true']")
        .first();

      if ((await textArea.count()) > 0) {
        console.log("🎯 Found text input area");

        await textArea.click();
        await page.waitForTimeout(500);

        // Clear any existing content
        await page.keyboard.press("Control+a");
        await page.keyboard.press("Delete");
        await page.waitForTimeout(200);

        // Type the trigger
        await textArea.type("hello", { delay: 150 });
        console.log("⌨️ Typed 'hello'");

        // Wait for expansion
        await page.waitForTimeout(2500);

        // Get the content
        const content = await textArea
          .inputValue()
          .catch(() => textArea.textContent());
        console.log(`📊 Result: "${content}"`);

        if (content && content.includes("Hello, World!")) {
          console.log("✅ SUCCESS: Expansion worked on real website!");
        } else if (content === "hello") {
          console.log("❌ FAIL: No expansion on real website");
        } else {
          console.log(`❓ UNCLEAR: Unexpected content "${content}"`);
        }

        // Screenshot the result
        await page.screenshot({
          path: "test-results/real-site-test-text-new.png",
          fullPage: true,
        });
      } else {
        console.log("❌ Could not find text input area on text.new");
      }
    } catch (error) {
      console.error("❌ Error testing real site:", error);

      await page.screenshot({
        path: "test-results/real-site-test-error.png",
        fullPage: true,
      });
    }

    console.log("🌐 Real site test completed");
  });
});
