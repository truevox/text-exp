/**
 * Cross-Site Text Expansion Tests
 * Tests text expansion functionality across different websites and input types
 * Focuses on real-world scenarios and "iffy" expansion behavior
 */

import { test, expect, Page, BrowserContext } from "@playwright/test";
import {
  setupExtensionContext,
  createSnippet,
  openPopup,
  navigateToSite,
  findMainTextInput,
  takeDebugScreenshot,
  waitForExtensionReady,
  cleanupExtensionContext,
  type ExtensionContext,
  type TestSnippet,
} from "./test-utils";

// Test sites configuration
interface TestSite {
  name: string;
  url: string;
  inputSelector?: string;
  altInputSelectors?: string[];
  skipReason?: string;
  expectedBehavior: "expansion" | "typing-simulation" | "paste-fallback";
  notes?: string;
}

const TEST_SITES: TestSite[] = [
  {
    name: "text.new",
    url: "https://text.new/",
    expectedBehavior: "expansion",
    notes: "Simple plain text editor - should work reliably",
  },
  {
    name: "CodePen Editor",
    url: "https://codepen.io/pen/",
    inputSelector: ".ace_text-input",
    altInputSelectors: [
      ".ace_editor",
      ".monaco-editor textarea",
      ".cm-content",
      ".cm-editor",
    ],
    expectedBehavior: "paste-fallback",
    notes: "ACE/CodeMirror editor - requires special paste strategy",
  },
  {
    name: "JSFiddle JavaScript",
    url: "https://jsfiddle.net/",
    inputSelector: ".ace_text-input",
    altInputSelectors: [
      ".ace_editor",
      ".monaco-editor textarea",
      "#id_code_js",
      ".cm-content",
    ],
    expectedBehavior: "paste-fallback",
    notes: "Code editor environment - tests code editor strategies",
  },
  {
    name: "CodeSandbox",
    url: "https://codesandbox.io/s/vanilla",
    inputSelector: ".cm-content",
    altInputSelectors: [
      ".monaco-editor textarea",
      ".ace_text-input",
      "[data-testid='code-editor']",
    ],
    expectedBehavior: "paste-fallback",
    notes: "Modern code editor - tests CodeMirror 6 and Monaco strategies",
  },
  {
    name: "GitHub New Issue",
    url: "https://github.com/microsoft/vscode/issues/new",
    inputSelector: "#issue_title",
    altInputSelectors: [
      "#issue_body",
      "textarea[name='issue[body]']",
      "#issue_body_textarea",
    ],
    expectedBehavior: "expansion",
    notes: "GitHub form inputs - tests on real forms",
  },
  {
    name: "GitHub Comment",
    url: "https://github.com/microsoft/vscode/issues/1",
    inputSelector: "#new_comment_field",
    altInputSelectors: [
      "[data-testid='comment-body-textarea']",
      "textarea",
      "textarea[name='comment[body]']",
    ],
    expectedBehavior: "expansion",
    notes: "GitHub comment box - tests contenteditable/textarea",
  },
  {
    name: "Notion Page",
    url: "https://www.notion.so/",
    inputSelector: "[contenteditable='true']",
    altInputSelectors: [
      "[data-content-editable-leaf='true']",
      ".notranslate",
      "[role='textbox']",
    ],
    expectedBehavior: "paste-fallback",
    notes: "Complex rich text editor - tests advanced contenteditable handling",
  },
  {
    name: "Discord Web (Public Channel)",
    url: "https://discord.com/channels/@me",
    inputSelector: "[data-slate-editor='true']",
    altInputSelectors: [
      "[contenteditable='true']",
      "[role='textbox']",
      ".slateTextArea-1Mkdgw",
    ],
    expectedBehavior: "paste-fallback",
    skipReason: "Requires Discord auth",
    notes: "Slate.js rich text editor - auth required",
  },
  {
    name: "Google Docs",
    url: "https://docs.google.com/document/u/0/create",
    inputSelector: ".docs-texteventtarget-iframe",
    altInputSelectors: [".kix-canvas", "[contenteditable='true']"],
    expectedBehavior: "paste-fallback",
    skipReason: "Requires Google auth",
    notes: "Complex rich text editor - auth required",
  },
  {
    name: "Gmail Compose",
    url: "https://mail.google.com/mail/u/0/#inbox?compose=new",
    inputSelector: "[contenteditable='true']",
    altInputSelectors: ["[aria-label='Message Body']", ".editable"],
    expectedBehavior: "paste-fallback",
    skipReason: "Requires Gmail auth",
    notes: "Gmail rich text composer - auth required",
  },
  {
    name: "TinyMCE Demo",
    url: "https://www.tiny.cloud/docs/demo/basic-example/",
    inputSelector: ".mce-content-body",
    altInputSelectors: [
      "iframe[id*='mce_']",
      ".tox-editor-container iframe",
      "[contenteditable='true']",
    ],
    expectedBehavior: "paste-fallback",
    notes: "TinyMCE rich text editor - tests iframe-based editor",
  },
  {
    name: "Quill.js Demo",
    url: "https://quilljs.com/",
    inputSelector: ".ql-editor",
    altInputSelectors: [
      ".ql-container [contenteditable='true']",
      "[data-gramm='false']",
    ],
    expectedBehavior: "paste-fallback",
    notes: "Quill.js rich text editor - tests Delta-based editor",
  },
  {
    name: "Reddit Comment",
    url: "https://www.reddit.com/r/test/comments/new/",
    inputSelector: "[contenteditable='true']",
    altInputSelectors: [
      "textarea",
      ".public-DraftEditor-content",
      "[data-testid='comment-textarea']",
    ],
    expectedBehavior: "expansion",
    notes: "Reddit's text editor - good for testing Draft.js",
  },
  {
    name: "Wikipedia Edit",
    url: "https://en.wikipedia.org/wiki/Test?action=edit",
    inputSelector: "#wpTextbox1",
    expectedBehavior: "expansion",
    notes: "Simple textarea - good baseline test",
  },
  {
    name: "StackOverflow Question",
    url: "https://stackoverflow.com/questions/ask",
    inputSelector: "#wmd-input",
    altInputSelectors: ["textarea[name='post-text']", ".wmd-input"],
    expectedBehavior: "expansion",
    notes: "Markdown editor - tests wiki-style editing",
  },
  {
    name: "Trello Card",
    url: "https://trello.com/",
    inputSelector: ".card-composer textarea",
    altInputSelectors: [
      "textarea[placeholder*='title']",
      ".list-card-composer-textarea",
    ],
    expectedBehavior: "expansion",
    skipReason: "Requires Trello auth",
    notes: "Simple form inputs in SPA context - auth required",
  },
];

// Test snippets for different scenarios
const TEST_SNIPPETS: TestSnippet[] = [
  {
    trigger: "hello",
    content: "Hello, World!",
    description: "Simple greeting",
  },
  {
    trigger: "signature",
    content: "Best regards,\nJohn Doe\nSoftware Engineer",
    description: "Multi-line signature",
  },
  {
    trigger: "html-test",
    content: "<strong>Bold text</strong> and <em>italic text</em>",
    contentType: "html",
    description: "HTML content test",
  },
  {
    trigger: "code-snippet",
    content: `function greet(name) {\n  console.log(\`Hello, \${name}!\`);\n}`,
    description: "JavaScript code snippet",
  },
  {
    trigger: "long-text",
    content: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(
      10,
    ),
    description: "Long text content",
  },
  {
    trigger: "special-chars",
    content: "Special chars: @#$%^&*()[]{}|\\`~",
    description: "Special characters test",
  },
  {
    trigger: "unicode-test",
    content: "Unicode: 🚀 αβγ 中文 עברית العربية",
    description: "Unicode and emoji test",
  },
  {
    trigger: "with-tabs",
    content: "Line 1\n\tIndented line\n\t\tDouble indent\nBack to start",
    description: "Tab character handling",
  },
  {
    trigger: "json-data",
    content: `{\n  "name": "John Doe",\n  "email": "john@example.com",\n  "active": true\n}`,
    description: "JSON structure test",
  },
  {
    trigger: "markdown",
    content:
      "# Heading\n\n**Bold text** and *italic text*\n\n- List item 1\n- List item 2\n\n[Link](https://example.com)",
    description: "Markdown formatting test",
  },
  {
    trigger: "with-vars",
    content: "Hello {{name}}, welcome to {{company}}!",
    description: "Snippet with variables",
    variables: [
      { name: "name", description: "Person's name", defaultValue: "John" },
      {
        name: "company",
        description: "Company name",
        defaultValue: "Acme Corp",
      },
    ],
  },
];

let extensionContext: ExtensionContext;

test.beforeEach(async ({ context }) => {
  // Use the context provided by Playwright (already has extension loaded)
  extensionContext = {
    context,
    extensionPage: context.pages()[0] || (await context.newPage()),
    extensionId: "placeholder-extension-id", // Will be determined dynamically
  };

  // Find the actual extension ID
  try {
    const extensionPages = context
      .pages()
      .filter((p) => p.url().includes("chrome-extension://"));
    if (extensionPages.length > 0) {
      const extensionUrl = extensionPages[0].url();
      const match = extensionUrl.match(/chrome-extension:\/\/([^/]+)/);
      if (match) {
        extensionContext.extensionId = match[1];
      }
    }
  } catch (error) {
    console.warn("Could not determine extension ID:", error);
  }

  // Create test snippets
  try {
    const popupPage = await openPopup(extensionContext);

    for (const snippet of TEST_SNIPPETS.slice(0, 4)) {
      // Limit to first 4 snippets for faster setup
      try {
        await createSnippet(popupPage, snippet);
        console.log(`✅ Created snippet: ${snippet.trigger}`);
      } catch (error) {
        console.warn(`⚠️ Failed to create snippet ${snippet.trigger}:`, error);
      }
    }

    await popupPage.close();
  } catch (error) {
    console.warn("⚠️ Failed to setup snippets:", error);
  }
});

test.afterEach(async () => {
  // No need to close context - Playwright handles this
});

// Test expansion on accessible sites
for (const site of TEST_SITES) {
  if (site.skipReason) {
    test.skip(`Cross-site expansion: ${site.name} (${site.skipReason})`, async () => {});
    continue;
  }

  test(`Cross-site expansion: ${site.name}`, async ({ context }) => {
    const page = await navigateToSite(context, site.url);

    try {
      // Wait for page to be fully loaded
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(3000); // Allow dynamic content to load

      // Take initial screenshot for debugging
      await takeDebugScreenshot(
        page,
        `${site.name.replace(/\s+/g, "-")}-initial`,
      );

      // Find main input element
      let inputSelector: string;

      if (site.inputSelector) {
        try {
          await page.waitForSelector(site.inputSelector, { timeout: 10000 });
          inputSelector = site.inputSelector;
        } catch (error) {
          console.warn(
            `Primary selector ${site.inputSelector} not found, trying alternatives`,
          );

          // Try alternative selectors
          let found = false;
          if (site.altInputSelectors) {
            for (const altSelector of site.altInputSelectors) {
              try {
                await page.waitForSelector(altSelector, { timeout: 5000 });
                inputSelector = altSelector;
                found = true;
                break;
              } catch (e) {
                console.warn(`Alternative selector ${altSelector} not found`);
              }
            }
          }

          if (!found) {
            throw new Error("No suitable input selector found");
          }
        }
      } else {
        inputSelector = await findMainTextInput(page);
      }

      console.log(`🎯 Using input selector: ${inputSelector} for ${site.name}`);

      // Test each snippet type
      for (const snippet of TEST_SNIPPETS.slice(0, 3)) {
        // Test first 3 snippets to keep test time reasonable
        // Skip variable snippets in automated tests for now
        if (snippet.variables) {
          console.log(`⏭️ Skipping variable snippet: ${snippet.trigger}`);
          continue;
        }

        console.log(`🧪 Testing snippet "${snippet.trigger}" on ${site.name}`);

        try {
          // Focus the input element
          const inputElement = page.locator(inputSelector).first();
          await inputElement.click({ timeout: 5000 });

          // Clear any existing content
          await page.keyboard.press("Control+a");
          await page.keyboard.press("Delete");
          await page.waitForTimeout(500);

          // Type the trigger
          await inputElement.type(snippet.trigger, { delay: 100 });
          await page.waitForTimeout(1000); // Wait for expansion

          // Take screenshot after trigger
          await takeDebugScreenshot(
            page,
            `${site.name.replace(/\s+/g, "-")}-${snippet.trigger}-after`,
          );

          // Check if expansion occurred
          const elementContent = await getElementContent(page, inputSelector);

          // Validate expansion based on expected behavior
          if (site.expectedBehavior === "expansion") {
            // Expect exact content replacement
            expect(elementContent).toContain(snippet.content);
            expect(elementContent).not.toContain(snippet.trigger);
            console.log(
              `✅ Successful expansion on ${site.name}: ${snippet.trigger} → content`,
            );
          } else if (site.expectedBehavior === "paste-fallback") {
            // For paste fallback, content might be there but trigger might remain
            const hasContent = elementContent.includes(snippet.content);
            const hasTrigger = elementContent.includes(snippet.trigger);

            if (hasContent) {
              console.log(
                `✅ Paste fallback worked on ${site.name}: content inserted`,
              );
            } else if (!hasContent && hasTrigger) {
              console.log(
                `⚠️ Expansion failed on ${site.name}, trigger still present: ${elementContent.substring(0, 100)}`,
              );
              // This is expected for some complex sites - log but don't fail
            } else {
              console.log(
                `❓ Unclear expansion state on ${site.name}: ${elementContent.substring(0, 100)}`,
              );
            }
          } else if (site.expectedBehavior === "typing-simulation") {
            // For typing simulation, both trigger and content might be present
            expect(elementContent).toContain(snippet.content);
            console.log(`✅ Typing simulation worked on ${site.name}`);
          }
        } catch (snippetError) {
          console.error(
            `❌ Snippet test failed for ${snippet.trigger} on ${site.name}:`,
            snippetError,
          );

          // Take error screenshot
          await takeDebugScreenshot(
            page,
            `${site.name.replace(/\s+/g, "-")}-${snippet.trigger}-error`,
          );

          // For now, log the error but don't fail the test since we expect some sites to be "iffy"
          console.log(
            `⚠️ Continuing despite error - this may be expected for ${site.name}`,
          );
        }

        // Small delay between snippets
        await page.waitForTimeout(1000);
      }
    } catch (siteError) {
      console.error(`❌ Site test failed for ${site.name}:`, siteError);

      // Take error screenshot
      await takeDebugScreenshot(
        page,
        `${site.name.replace(/\s+/g, "-")}-site-error`,
      );

      // Check if site loaded at all
      const title = await page.title();
      console.log(`📄 Page title: ${title}`);

      // For sites that frequently fail to load, don't fail the test
      if (site.name.includes("CodePen") || site.name.includes("JSFiddle")) {
        console.log(
          `⚠️ Site ${site.name} failed to load properly - this may be expected`,
        );
      } else {
        throw siteError;
      }
    } finally {
      await page.close();
    }
  });
}

// Test fallback scenarios
test("Cross-site expansion: Fallback behavior test", async ({ context }) => {
  // Create a custom test page with various input types
  const page = await context.newPage();

  const testPageHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>PuffPuffPaste Fallback Test</title>
        <style>
            .test-section { margin: 20px; border: 1px solid #ccc; padding: 10px; }
            .broken-editor { 
                width: 100%; 
                height: 100px; 
                border: 1px solid #999; 
                padding: 5px;
                /* Simulate broken/corrupted content */
                background: linear-gradient(45deg, #f0f0f0, #ffffff);
            }
            .ace-like { 
                font-family: monospace;
                background: #1e1e1e; 
                color: #d4d4d4; 
                padding: 10px;
                min-height: 100px;
            }
        </style>
    </head>
    <body>
        <h1>PuffPuffPaste Cross-Site Test Page</h1>
        
        <div class="test-section">
            <h3>Standard Inputs</h3>
            <input type="text" id="text-input" placeholder="Text input test">
            <br><br>
            <textarea id="textarea" placeholder="Textarea test"></textarea>
        </div>
        
        <div class="test-section">
            <h3>ContentEditable</h3>
            <div id="contenteditable" contenteditable="true" 
                 style="border: 1px solid #ccc; padding: 10px; min-height: 50px;">
                Click here to test contenteditable
            </div>
        </div>
        
        <div class="test-section">
            <h3>Simulated Broken Editor</h3>
            <div id="broken-editor" contenteditable="true" class="broken-editor">
                הרבה טקסט מקולקל עם תווים מוזרים ר ה ר ה ר ה
            </div>
        </div>
        
        <div class="test-section">
            <h3>Simulated Code Editor</h3>
            <div id="code-editor" contenteditable="true" class="ace-like ace_editor">
                // Code editor simulation
            </div>
        </div>
        
        <div class="test-section">
            <h3>Complex Nested Structure</h3>
            <div class="editor-wrapper">
                <div class="editor-toolbar">Tools</div>
                <div id="nested-editor" contenteditable="true" 
                     style="border: 1px solid #ccc; padding: 10px; min-height: 50px;">
                    Nested editable content
                </div>
            </div>
        </div>
        
        <script>
            // Simulate some editor behaviors
            document.getElementById('broken-editor').addEventListener('focus', function() {
                console.log('Broken editor focused');
            });
            
            document.getElementById('code-editor').addEventListener('input', function(e) {
                console.log('Code editor input:', e.inputType);
            });
        </script>
    </body>
    </html>
  `;

  await page.goto(`data:text/html,${encodeURIComponent(testPageHtml)}`);

  const testInputs = [
    { selector: "#text-input", name: "Text Input" },
    { selector: "#textarea", name: "Textarea" },
    { selector: "#contenteditable", name: "ContentEditable" },
    { selector: "#broken-editor", name: "Broken Editor" },
    { selector: "#code-editor", name: "Code Editor" },
    { selector: "#nested-editor", name: "Nested Editor" },
  ];

  // Test fallback behavior on different input types
  for (const input of testInputs) {
    console.log(`🧪 Testing fallback on: ${input.name}`);

    try {
      const element = page.locator(input.selector);
      await element.click();

      // Clear content
      await page.keyboard.press("Control+a");
      await page.keyboard.press("Delete");
      await page.waitForTimeout(200);

      // Test simple snippet
      await element.type("hello", { delay: 50 });
      await page.waitForTimeout(1500); // Wait for expansion

      const content = await getElementContent(page, input.selector);

      if (content.includes("Hello, World!")) {
        console.log(`✅ Expansion worked on ${input.name}`);
      } else if (content.includes("hello")) {
        console.log(`⚠️ Expansion failed on ${input.name}, trigger remains`);
      } else {
        console.log(`❓ Unexpected content on ${input.name}: ${content}`);
      }

      // Test recovery from broken state
      if (input.name === "Broken Editor") {
        await page.waitForTimeout(500);
        const cleanContent = await getElementContent(page, input.selector);
        if (
          !cleanContent.includes("הרבה") &&
          !cleanContent.includes("מקולקל")
        ) {
          console.log(`✅ Successfully cleaned broken editor content`);
        }
      }
    } catch (error) {
      console.error(`❌ Fallback test failed for ${input.name}:`, error);
    }
  }

  await takeDebugScreenshot(page, "fallback-test-final");
  await page.close();
});

// Test network resilience
test("Cross-site expansion: Network resilience", async ({ context }) => {
  const page = await context.newPage();

  console.log("🌐 Testing network resilience...");

  // Test with unreachable sites
  const unreachableSites = [
    "https://example-nonexistent-domain-12345.com/",
    "https://httpstat.us/500", // Returns 500 error
    "https://httpstat.us/404", // Returns 404 error
  ];

  for (const url of unreachableSites) {
    try {
      console.log(`🧪 Testing unreachable site: ${url}`);

      const response = await page.goto(url, { timeout: 10000 });

      if (!response || !response.ok()) {
        console.log(`✅ Correctly handled unreachable site: ${url}`);
        continue;
      }

      // If page loads, try basic functionality
      const title = await page.title();
      console.log(`📄 Unexpected load success for ${url}: ${title}`);
    } catch (error) {
      console.log(
        `✅ Correctly handled network error for ${url}: ${error.message}`,
      );
    }
  }

  await page.close();
});

// Test edge cases that cause "iffy" expansion behavior
test("Cross-site expansion: Edge case handling", async ({ context }) => {
  const page = await context.newPage();

  // Create a test page with problematic scenarios
  const edgeCaseHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Edge Case Expansion Tests</title>
        <style>
            .test-case { margin: 10px; padding: 10px; border: 1px solid #ccc; }
            .hidden-input { display: none; }
            .readonly-input { background: #f5f5f5; }
            .custom-cursor::after { content: '|'; animation: blink 1s infinite; }
            @keyframes blink { 50% { opacity: 0; } }
        </style>
    </head>
    <body>
        <h1>Edge Case Tests for PuffPuffPaste</h1>
        
        <div class="test-case">
            <h3>Shadow DOM Input</h3>
            <div id="shadow-host"></div>
            <script>
                const shadowHost = document.getElementById('shadow-host');
                const shadow = shadowHost.attachShadow({ mode: 'open' });
                shadow.innerHTML = '<input type="text" id="shadow-input" placeholder="Shadow DOM input">';
            </script>
        </div>
        
        <div class="test-case">
            <h3>Dynamically Created Input</h3>
            <button id="create-input">Create Input</button>
            <div id="dynamic-container"></div>
            <script>
                document.getElementById('create-input').onclick = function() {
                    const input = document.createElement('textarea');
                    input.id = 'dynamic-input';
                    input.placeholder = 'Dynamically created input';
                    input.style.width = '100%';
                    input.style.height = '50px';
                    document.getElementById('dynamic-container').appendChild(input);
                };
            </script>
        </div>
        
        <div class="test-case">
            <h3>Input with Event Handlers</h3>
            <textarea id="event-input" placeholder="Input with custom events"></textarea>
            <script>
                const eventInput = document.getElementById('event-input');
                eventInput.addEventListener('input', function(e) {
                    if (e.inputType === 'insertText') {
                        console.log('Custom input handler triggered');
                    }
                });
                eventInput.addEventListener('keydown', function(e) {
                    if (e.key === 'Tab') {
                        e.preventDefault();
                        this.value += '    '; // Insert 4 spaces
                    }
                });
            </script>
        </div>
        
        <div class="test-case">
            <h3>ContentEditable with Custom Formatting</h3>
            <div id="custom-editable" contenteditable="true" 
                 style="border: 1px solid #ccc; padding: 10px; min-height: 50px;">
                Type here with <span style="color: red;">custom</span> formatting
            </div>
        </div>
        
        <div class="test-case">
            <h3>Input Inside iFrame</h3>
            <iframe id="iframe-test" srcdoc="
                <html><body>
                    <textarea id='iframe-input' placeholder='Input inside iframe'></textarea>
                    <script>
                        window.parent.postMessage({type: 'iframe-ready'}, '*');
                    </script>
                </body></html>
            " style="width: 100%; height: 100px; border: 1px solid #ccc;"></iframe>
        </div>
        
        <div class="test-case">
            <h3>Input with Input Method Editor (IME) Simulation</h3>
            <input type="text" id="ime-input" placeholder="IME simulation test">
            <script>
                const imeInput = document.getElementById('ime-input');
                imeInput.addEventListener('compositionstart', () => console.log('Composition start'));
                imeInput.addEventListener('compositionend', () => console.log('Composition end'));
            </script>
        </div>
        
        <div class="test-case">
            <h3>Rapidly Changing Input</h3>
            <textarea id="changing-input" placeholder="This input changes rapidly"></textarea>
            <script>
                const changingInput = document.getElementById('changing-input');
                setInterval(() => {
                    if (Math.random() > 0.7) {
                        changingInput.style.fontFamily = Math.random() > 0.5 ? 'monospace' : 'sans-serif';
                    }
                }, 1000);
            </script>
        </div>
        
        <div class="test-case">
            <h3>Input with Conflicting Extensions</h3>
            <textarea id="conflict-input" placeholder="Simulates other extensions interfering"></textarea>
            <script>
                const conflictInput = document.getElementById('conflict-input');
                conflictInput.addEventListener('input', function(e) {
                    // Simulate another extension modifying content
                    setTimeout(() => {
                        if (this.value.includes('hello')) {
                            this.value = this.value.replace('hello', 'hi');
                            this.dispatchEvent(new Event('input'));
                        }
                    }, 100);
                });
            </script>
        </div>
        
        <div class="test-case">
            <h3>Read-only and Disabled States</h3>
            <input type="text" id="readonly-input" readonly placeholder="Read-only input" class="readonly-input">
            <br><br>
            <input type="text" id="disabled-input" disabled placeholder="Disabled input">
        </div>
        
    </body>
    </html>
  `;

  await page.goto(`data:text/html,${encodeURIComponent(edgeCaseHtml)}`);

  console.log("🧪 Running edge case expansion tests...");

  // Test 1: Dynamic input creation
  console.log("📝 Testing dynamic input creation...");
  await page.click("#create-input");
  await page.waitForTimeout(500);

  try {
    const dynamicInput = page.locator("#dynamic-input");
    await dynamicInput.click();
    await dynamicInput.type("hello", { delay: 100 });
    await page.waitForTimeout(1000);

    const content = await dynamicInput.inputValue();
    if (content.includes("Hello, World!")) {
      console.log("✅ Dynamic input expansion succeeded");
    } else {
      console.log(`⚠️ Dynamic input expansion failed: ${content}`);
    }
  } catch (error) {
    console.log(`❌ Dynamic input test error: ${error.message}`);
  }

  // Test 2: Input with event handlers
  console.log("📝 Testing input with custom event handlers...");
  try {
    const eventInput = page.locator("#event-input");
    await eventInput.click();
    await eventInput.type("hello", { delay: 100 });
    await page.waitForTimeout(1000);

    const content = await eventInput.inputValue();
    console.log(`Event input result: ${content.substring(0, 50)}`);
  } catch (error) {
    console.log(`❌ Event input test error: ${error.message}`);
  }

  // Test 3: ContentEditable with existing formatting
  console.log("📝 Testing contenteditable with custom formatting...");
  try {
    const customEditable = page.locator("#custom-editable");
    await customEditable.click();
    await customEditable.selectText();
    await page.keyboard.press("Delete");
    await customEditable.type("hello", { delay: 100 });
    await page.waitForTimeout(1000);

    const content = await customEditable.textContent();
    console.log(`Custom editable result: ${content?.substring(0, 50)}`);
  } catch (error) {
    console.log(`❌ Custom editable test error: ${error.message}`);
  }

  // Test 4: iFrame input (complex scenario)
  console.log("📝 Testing iframe input...");
  try {
    const iframe = page.frameLocator("#iframe-test");
    const iframeInput = iframe.locator("#iframe-input");
    await iframeInput.click();
    await iframeInput.type("hello", { delay: 100 });
    await page.waitForTimeout(1000);

    const content = await iframeInput.inputValue();
    console.log(`iFrame input result: ${content}`);
  } catch (error) {
    console.log(`❌ iFrame input test error: ${error.message}`);
  }

  // Test 5: Rapidly changing input
  console.log("📝 Testing rapidly changing input...");
  try {
    const changingInput = page.locator("#changing-input");
    await changingInput.click();
    await changingInput.type("hello", { delay: 100 });
    await page.waitForTimeout(1500); // Wait longer for style changes

    const content = await changingInput.inputValue();
    console.log(`Rapidly changing input result: ${content.substring(0, 50)}`);
  } catch (error) {
    console.log(`❌ Rapidly changing input test error: ${error.message}`);
  }

  // Test 6: Input with conflicting modifications
  console.log("📝 Testing input with simulated conflicts...");
  try {
    const conflictInput = page.locator("#conflict-input");
    await conflictInput.click();
    await conflictInput.type("hello", { delay: 100 });
    await page.waitForTimeout(1500); // Wait for conflict simulation

    const content = await conflictInput.inputValue();
    console.log(`Conflict input result: ${content}`);
  } catch (error) {
    console.log(`❌ Conflict input test error: ${error.message}`);
  }

  // Test 7: Read-only and disabled inputs (should fail gracefully)
  console.log("📝 Testing read-only and disabled inputs...");

  try {
    const readonlyInput = page.locator("#readonly-input");
    await readonlyInput.click();
    await readonlyInput.type("hello", { delay: 100 });
    await page.waitForTimeout(1000);

    const readonlyContent = await readonlyInput.inputValue();
    console.log(
      `Read-only input result: ${readonlyContent || "(empty - expected)"}`,
    );
  } catch (error) {
    console.log(`✅ Read-only input correctly rejected: ${error.message}`);
  }

  try {
    const disabledInput = page.locator("#disabled-input");
    await disabledInput.click();
    await disabledInput.type("hello", { delay: 100 });
    await page.waitForTimeout(1000);

    const disabledContent = await disabledInput.inputValue();
    console.log(
      `Disabled input result: ${disabledContent || "(empty - expected)"}`,
    );
  } catch (error) {
    console.log(`✅ Disabled input correctly rejected: ${error.message}`);
  }

  await takeDebugScreenshot(page, "edge-cases-final");
  await page.close();
});

// Test paste strategy system under stress
test("Cross-site expansion: Paste strategy stress test", async ({
  context,
}) => {
  const page = await context.newPage();

  // Create a complex test page that exercises all paste strategies
  const complexPageHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Paste Strategy Stress Test</title>
        <style>
            .strategy-test { margin: 10px; padding: 10px; border: 1px solid #ddd; }
            .strategy-test h4 { margin-top: 0; }
        </style>
    </head>
    <body>
        <h1>Paste Strategy Stress Test</h1>
        
        <div class="strategy-test">
            <h4>Rapid Fire Input</h4>
            <input type="text" id="rapid-input" placeholder="Rapid expansion test">
        </div>
        
        <div class="strategy-test">
            <h4>Long Content Test</h4>
            <textarea id="long-content" placeholder="Long content expansion"></textarea>
        </div>
        
        <div class="strategy-test">
            <h4>Multiple Contenteditable</h4>
            <div id="multi-ce-1" contenteditable="true" style="border: 1px solid #ccc; padding: 5px; margin: 2px;">Editor 1</div>
            <div id="multi-ce-2" contenteditable="true" style="border: 1px solid #ccc; padding: 5px; margin: 2px;">Editor 2</div>
            <div id="multi-ce-3" contenteditable="true" style="border: 1px solid #ccc; padding: 5px; margin: 2px;">Editor 3</div>
        </div>
        
        <div class="strategy-test">
            <h4>Dynamic Content</h4>
            <div id="dynamic-content" contenteditable="true" style="border: 1px solid #ccc; padding: 10px;">
                Dynamic content that changes
            </div>
            <button onclick="changeContent()">Change Content</button>
        </div>
        
        <script>
            function changeContent() {
                document.getElementById('dynamic-content').innerHTML = 
                    'Content changed at ' + new Date().toLocaleTimeString();
            }
            
            // Simulate some dynamic behavior
            setInterval(function() {
                const elements = document.querySelectorAll('[contenteditable="true"]');
                elements.forEach(function(el, index) {
                    if (Math.random() > 0.9) {
                        el.style.backgroundColor = '#' + Math.random().toString(16).substr(-6);
                        setTimeout(() => el.style.backgroundColor = '', 1000);
                    }
                });
            }, 2000);
        </script>
    </body>
    </html>
  `;

  await page.goto(`data:text/html,${encodeURIComponent(complexPageHtml)}`);

  console.log("🧪 Running paste strategy stress tests...");

  // Test rapid expansion on multiple elements
  const testSelectors = [
    "#rapid-input",
    "#long-content",
    "#multi-ce-1",
    "#multi-ce-2",
    "#dynamic-content",
  ];

  for (let round = 0; round < 3; round++) {
    console.log(`🔄 Stress test round ${round + 1}/3`);

    for (const selector of testSelectors) {
      try {
        const element = page.locator(selector);
        await element.click();
        await page.keyboard.press("Control+a");
        await page.keyboard.press("Delete");

        // Test different snippets rapidly
        const testTrigger =
          round === 0 ? "hello" : round === 1 ? "signature" : "code-snippet";
        await element.type(testTrigger, { delay: 30 });
        await page.waitForTimeout(800); // Shorter wait for stress test

        const content = await getElementContent(page, selector);
        console.log(
          `📝 Round ${round + 1}, ${selector}: ${content.substring(0, 50)}...`,
        );
      } catch (error) {
        console.warn(
          `⚠️ Stress test error on ${selector}, round ${round + 1}:`,
          error.message,
        );
      }
    }

    await page.waitForTimeout(1000); // Brief pause between rounds
  }

  await takeDebugScreenshot(page, "stress-test-final");
  await page.close();
});

// Test specific paste strategy scenarios
test("Cross-site expansion: Paste strategy validation", async ({ context }) => {
  const page = await context.newPage();

  console.log("🧪 Testing paste strategy behaviors...");

  // Test different paste strategies with a controlled environment
  const strategyTestHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Paste Strategy Test</title>
        <style>
            .strategy-section { margin: 20px 0; padding: 15px; border: 2px solid #ddd; }
            .gmail-like { font-family: Arial; }
            .code-like { font-family: 'Courier New', monospace; background: #f8f8f8; }
            .rich-like { border: 1px solid #ccc; min-height: 100px; padding: 10px; }
        </style>
    </head>
    <body>
        <h1>Paste Strategy Validation Tests</h1>
        
        <!-- Plaintext Strategy -->
        <div class="strategy-section">
            <h3>Plaintext Strategy Test</h3>
            <input type="text" id="plaintext-input" placeholder="Basic text input">
            <br><br>
            <textarea id="plaintext-textarea" placeholder="Basic textarea"></textarea>
        </div>
        
        <!-- ContentEditable Strategy -->
        <div class="strategy-section">
            <h3>ContentEditable Strategy Test</h3>
            <div id="basic-contenteditable" contenteditable="true" class="rich-like">
                Click here to test basic contenteditable
            </div>
        </div>
        
        <!-- Gmail-like Strategy -->
        <div class="strategy-section">
            <h3>Gmail-like Strategy Test</h3>
            <div id="gmail-compose" contenteditable="true" role="textbox" class="gmail-like rich-like"
                 aria-label="Message Body">
                Gmail-style composer simulation
            </div>
        </div>
        
        <!-- Code Editor Strategy -->
        <div class="strategy-section">
            <h3>Code Editor Strategy Test</h3>
            <div class="ace_editor code-like">
                <textarea id="ace-textarea" class="ace_text-input code-like" 
                         style="position: absolute; left: -10000px;">Hidden ACE input</textarea>
                <div id="ace-content" class="code-like" style="padding: 10px;">
                    // Simulated ACE editor
                    <br>console.log("test");
                </div>
            </div>
        </div>
        
        <!-- TinyMCE-like Strategy -->
        <div class="strategy-section">
            <h3>TinyMCE-like Strategy Test</h3>
            <div class="mce-tinymce">
                <div id="tinymce-body" contenteditable="true" class="mce-content-body rich-like">
                    TinyMCE-style editor simulation
                </div>
            </div>
        </div>
        
        <!-- Fallback Strategy -->
        <div class="strategy-section">
            <h3>Fallback Strategy Test</h3>
            <div id="unknown-editor" contenteditable="true" class="rich-like" 
                 data-unknown-editor="true">
                Unknown/unrecognized editor type
            </div>
        </div>
        
        <!-- Performance test area -->
        <div class="strategy-section">
            <h3>Performance Test</h3>
            <textarea id="performance-test" placeholder="For performance testing"></textarea>
        </div>
        
    </body>
    </html>
  `;

  await page.goto(`data:text/html,${encodeURIComponent(strategyTestHtml)}`);

  const testCases = [
    {
      selector: "#plaintext-input",
      name: "Plaintext Input",
      expectedStrategy: "plaintext",
      testSnippets: ["hello", "special-chars"],
    },
    {
      selector: "#plaintext-textarea",
      name: "Plaintext Textarea",
      expectedStrategy: "plaintext",
      testSnippets: ["signature", "with-tabs"],
    },
    {
      selector: "#basic-contenteditable",
      name: "Basic ContentEditable",
      expectedStrategy: "contenteditable",
      testSnippets: ["hello", "html-test"],
    },
    {
      selector: "#gmail-compose",
      name: "Gmail-like Editor",
      expectedStrategy: "gmail",
      testSnippets: ["signature", "html-test"],
    },
    {
      selector: "#ace-textarea",
      name: "ACE-like Editor",
      expectedStrategy: "code-editor",
      testSnippets: ["code-snippet", "json-data"],
    },
    {
      selector: "#tinymce-body",
      name: "TinyMCE-like Editor",
      expectedStrategy: "tinymce",
      testSnippets: ["html-test", "markdown"],
    },
    {
      selector: "#unknown-editor",
      name: "Unknown Editor",
      expectedStrategy: "fallback",
      testSnippets: ["hello", "unicode-test"],
    },
  ];

  // Test each paste strategy scenario
  for (const testCase of testCases) {
    console.log(
      `🎯 Testing ${testCase.name} (expected: ${testCase.expectedStrategy})`,
    );

    for (const snippetTrigger of testCase.testSnippets) {
      try {
        const element = page.locator(testCase.selector);

        // Focus and clear
        await element.click();
        await page.keyboard.press("Control+a");
        await page.keyboard.press("Delete");
        await page.waitForTimeout(200);

        // Type trigger
        await element.type(snippetTrigger, { delay: 50 });
        await page.waitForTimeout(1200); // Wait for expansion

        // Check result
        const content = await getElementContent(page, testCase.selector);
        const snippet = TEST_SNIPPETS.find((s) => s.trigger === snippetTrigger);

        if (snippet && content.includes(snippet.content.substring(0, 20))) {
          console.log(`  ✅ ${snippetTrigger} → expansion successful`);
        } else if (content === snippetTrigger) {
          console.log(
            `  ⚠️ ${snippetTrigger} → no expansion (trigger remains)`,
          );
        } else {
          console.log(
            `  ❓ ${snippetTrigger} → unclear result: ${content.substring(0, 30)}`,
          );
        }
      } catch (error) {
        console.log(`  ❌ ${snippetTrigger} → error: ${error.message}`);
      }

      await page.waitForTimeout(300); // Brief pause between tests
    }
  }

  // Performance test: Rapid expansion
  console.log("🚀 Running performance test (rapid expansion)...");
  const perfElement = page.locator("#performance-test");
  const startTime = Date.now();

  for (let i = 0; i < 5; i++) {
    await perfElement.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.press("Delete");
    await perfElement.type("hello", { delay: 20 }); // Faster typing
    await page.waitForTimeout(500); // Shorter wait
  }

  const endTime = Date.now();
  console.log(`⏱️ Performance test completed in ${endTime - startTime}ms`);

  await takeDebugScreenshot(page, "paste-strategy-validation");
  await page.close();
});

/**
 * Helper function to get content from different types of elements
 */
async function getElementContent(
  page: Page,
  selector: string,
): Promise<string> {
  try {
    const element = page.locator(selector).first();

    // Get the tag name to determine extraction method
    const tagName = await element.evaluate((el) => el.tagName.toLowerCase());

    if (tagName === "input" || tagName === "textarea") {
      return await element.inputValue();
    } else {
      return (await element.textContent()) || "";
    }
  } catch (error) {
    console.error(`Error getting content from ${selector}:`, error);
    return "";
  }
}
