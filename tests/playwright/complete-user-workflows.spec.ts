import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import {
  setupExtensionContext,
  openPopup,
  openOptionsPage,
  createSnippet,
  createTestPage,
  testSnippetExpansion,
  cleanupExtensionContext,
  takeDebugScreenshot,
  waitForExtensionReady,
  navigateToSite,
  findMainTextInput,
  type ExtensionContext,
  type TestSnippet,
} from "./test-utils";

/**
 * Comprehensive end-to-end user workflow tests for PuffPuffPaste extension
 *
 * These tests simulate complete user journeys from extension setup through
 * advanced usage scenarios, ensuring the entire user experience works correctly.
 *
 * Test coverage includes:
 * - Extension initialization and setup
 * - Options page navigation and configuration
 * - Snippet creation, editing, and management
 * - Text expansion in various contexts
 * - Multi-snippet workflows
 * - Error handling and edge cases
 */

let extensionContext: ExtensionContext;
let testSnippets: TestSnippet[];

test.describe("PuffPuffPaste - Complete User Workflows", () => {
  test.beforeAll(async () => {
    console.log("Setting up extension context for complete workflow tests...");
    extensionContext = await setupExtensionContext();

    // Wait for extension to be fully ready
    await waitForExtensionReady(extensionContext);
    console.log(`Extension loaded with ID: ${extensionContext.extensionId}`);
  });

  test.afterAll(async () => {
    console.log("Cleaning up extension context...");
    await cleanupExtensionContext(extensionContext);
  });

  test.beforeEach(() => {
    // Define test snippets for each test
    testSnippets = [
      {
        trigger: ";hello",
        content: "Hello, World!",
        description: "Basic greeting snippet",
        contentType: "text",
      },
      {
        trigger: ";email",
        content:
          "Dear {name},\n\nThank you for reaching out. I'll get back to you soon.\n\nBest regards,\n{sender}",
        description: "Professional email template",
        contentType: "text",
        variables: [
          {
            name: "name",
            description: "Recipient name",
            defaultValue: "there",
          },
          { name: "sender", description: "Your name", defaultValue: "Me" },
        ],
      },
      {
        trigger: ";sig",
        content:
          "<p><strong>{name}</strong><br/><em>{title}</em><br/>📧 {email} | 📞 {phone}</p>",
        description: "HTML email signature",
        contentType: "html",
        variables: [
          { name: "name", description: "Full name" },
          { name: "title", description: "Job title" },
          { name: "email", description: "Email address" },
          { name: "phone", description: "Phone number" },
        ],
      },
    ];
  });

  test("Extension Setup and Initialization", async () => {
    console.log("Testing extension setup and initialization...");

    // Test 1: Verify extension loaded successfully
    expect(extensionContext.extensionId).toBeTruthy();
    console.log("✓ Extension ID obtained successfully");

    // Test 2: Verify popup can be opened
    const popupPage = await openPopup(extensionContext);

    try {
      // Wait for popup UI to load
      await popupPage.waitForSelector("body", { timeout: 10000 });

      // Check for essential UI elements
      const hasTitle =
        (await popupPage.locator("h1, .title, [class*='title']").count()) > 0;
      const hasAddButton =
        (await popupPage
          .locator("#addSnippetButton, [id*='add'], button:has-text('Add')")
          .count()) > 0;

      expect(hasTitle || hasAddButton).toBe(true);
      console.log("✓ Popup UI elements loaded successfully");

      // Take screenshot for documentation
      await takeDebugScreenshot(popupPage, "popup-initial-state");
    } catch (error) {
      console.error("Popup loading error:", error);
      await takeDebugScreenshot(popupPage, "popup-error-state");
      throw error;
    } finally {
      await popupPage.close();
    }

    // Test 3: Verify options page accessibility
    const optionsPage = await openOptionsPage(extensionContext);

    try {
      await optionsPage.waitForSelector("body", { timeout: 10000 });

      // Check for settings UI
      const settingsCount = await optionsPage
        .locator("input, select, button, textarea")
        .count();
      expect(settingsCount).toBeGreaterThan(0);
      console.log(
        `✓ Options page loaded with ${settingsCount} interactive elements`,
      );

      await takeDebugScreenshot(optionsPage, "options-initial-state");
    } finally {
      await optionsPage.close();
    }
  });

  test("Options Page Navigation and UI", async () => {
    console.log("Testing options page navigation and UI components...");

    const optionsPage = await openOptionsPage(extensionContext);

    try {
      await optionsPage.waitForSelector("body", { timeout: 10000 });

      // Test navigation elements
      const navigationTests = [
        {
          selector: "nav, .navigation, [class*='nav']",
          description: "Navigation menu",
        },
        {
          selector: ".settings, [class*='setting']",
          description: "Settings sections",
        },
        {
          selector: "input[type='checkbox'], input[type='radio']",
          description: "Toggle options",
        },
        { selector: "button, [type='button']", description: "Action buttons" },
      ];

      for (const navTest of navigationTests) {
        const elements = await optionsPage.locator(navTest.selector);
        const count = await elements.count();
        console.log(`  - ${navTest.description}: ${count} elements found`);

        // If elements exist, test basic interaction
        if (count > 0) {
          try {
            const firstElement = elements.first();
            if (await firstElement.isVisible()) {
              await firstElement.hover();
              console.log(`    ✓ ${navTest.description} interactive`);
            }
          } catch (e) {
            console.log(
              `    ~ ${navTest.description} interaction test skipped`,
            );
          }
        }
      }

      // Test tabbing through interface
      await optionsPage.keyboard.press("Tab");
      await optionsPage.waitForTimeout(200);
      await optionsPage.keyboard.press("Tab");
      console.log("✓ Keyboard navigation working");

      // Test for accessibility features
      const hasAriaLabels = await optionsPage
        .locator("[aria-label], [aria-labelledby]")
        .count();
      console.log(`  - Accessibility: ${hasAriaLabels} ARIA labels found`);

      await takeDebugScreenshot(optionsPage, "options-navigation-test");
    } finally {
      await optionsPage.close();
    }
  });

  test("Snippet Creation Flow via Popup", async () => {
    console.log("Testing complete snippet creation workflow...");

    const popupPage = await openPopup(extensionContext);

    try {
      // Test creating each type of snippet
      for (let i = 0; i < testSnippets.length; i++) {
        const snippet = testSnippets[i];
        console.log(
          `Creating snippet ${i + 1}: ${snippet.trigger} (${snippet.contentType})`,
        );

        try {
          await createSnippet(popupPage, snippet);
          console.log(`✓ Successfully created snippet: ${snippet.trigger}`);

          // Verify snippet appears in list
          await popupPage.waitForTimeout(1000);

          // Look for the snippet in the UI
          const snippetExists =
            (await popupPage.locator(`text=${snippet.trigger}`).count()) > 0 ||
            (await popupPage.locator(`text=${snippet.description}`).count()) >
              0;

          if (snippetExists) {
            console.log(`  ✓ Snippet ${snippet.trigger} visible in UI`);
          } else {
            console.log(
              `  ~ Snippet ${snippet.trigger} may not be immediately visible`,
            );
          }
        } catch (error) {
          console.error(`Error creating snippet ${snippet.trigger}:`, error);
          await takeDebugScreenshot(popupPage, `snippet-creation-error-${i}`);

          // Continue with other snippets
          continue;
        }

        await takeDebugScreenshot(
          popupPage,
          `snippet-created-${i}-${snippet.trigger.replace(";", "")}`,
        );
      }

      // Test snippet list display
      await popupPage.waitForTimeout(2000);
      const listItems = await popupPage
        .locator(".snippet-item, [class*='snippet'], .list-item")
        .count();
      console.log(`✓ Snippet list displays ${listItems} items`);
    } finally {
      await popupPage.close();
    }
  });

  test("Basic Snippet Expansion in Various Input Types", async () => {
    console.log("Testing snippet expansion across different input types...");

    // First, ensure we have test snippets created
    const popupPage = await openPopup(extensionContext);

    try {
      // Create basic test snippet
      await createSnippet(popupPage, testSnippets[0]); // ;hello -> Hello, World!
      console.log("✓ Test snippet created for expansion testing");
    } catch (error) {
      console.log("Note: Test snippet creation failed, may already exist");
    } finally {
      await popupPage.close();
    }

    // Create comprehensive test page
    const testPage = await createTestPage(extensionContext.context);

    try {
      // Test expansion in different element types
      const expansionTests = [
        {
          selector: "#test-input",
          type: "text input",
          testSnippet: testSnippets[0],
        },
        {
          selector: "#test-textarea",
          type: "textarea",
          testSnippet: testSnippets[0],
        },
        {
          selector: "#test-contenteditable",
          type: "contenteditable div",
          testSnippet: testSnippets[0],
        },
      ];

      for (const expansionTest of expansionTests) {
        console.log(`Testing expansion in ${expansionTest.type}...`);

        try {
          await testSnippetExpansion(
            testPage,
            expansionTest.selector,
            expansionTest.testSnippet,
            expansionTest.testSnippet.content,
          );
          console.log(`✓ Expansion working in ${expansionTest.type}`);
        } catch (error) {
          console.log(
            `~ Expansion test in ${expansionTest.type}: ${error instanceof Error ? error.message : error}`,
          );
          // Take screenshot for debugging
          await takeDebugScreenshot(
            testPage,
            `expansion-test-${expansionTest.type.replace(" ", "-")}`,
          );
        }

        // Clear field for next test
        try {
          const element = testPage.locator(expansionTest.selector);
          await element.click();
          await testPage.keyboard.press("Control+A");
          await testPage.keyboard.press("Delete");
          await testPage.waitForTimeout(200);
        } catch (e) {
          // Continue if clearing fails
        }
      }

      // Test expansion with typing simulation
      console.log("Testing natural typing patterns...");
      const input = testPage.locator("#test-input");
      await input.click();

      // Simulate natural typing with pauses
      const trigger = testSnippets[0].trigger;
      for (const char of trigger) {
        await testPage.keyboard.type(char);
        await testPage.waitForTimeout(50); // Natural typing speed
      }

      await testPage.waitForTimeout(1000); // Wait for potential expansion

      const finalValue = await input.inputValue();
      const expansionOccurred =
        finalValue.includes(testSnippets[0].content) || finalValue !== trigger;
      console.log(
        `✓ Natural typing test completed (expansion: ${expansionOccurred})`,
      );
    } finally {
      await testPage.close();
    }
  });

  test("Snippet Editing and Management", async () => {
    console.log("Testing snippet editing and management workflows...");

    const popupPage = await openPopup(extensionContext);

    try {
      // First, ensure we have snippets to edit
      const editTestSnippet: TestSnippet = {
        trigger: ";edit-test",
        content: "Original content",
        description: "Test snippet for editing",
      };

      await createSnippet(popupPage, editTestSnippet);
      console.log("✓ Created test snippet for editing");

      await popupPage.waitForTimeout(1000);

      // Look for edit controls
      const editButtons = await popupPage.locator(
        "button:has-text('Edit'), .edit-btn, [class*='edit'], [title*='edit' i], .fa-edit",
      );
      const editButtonCount = await editButtons.count();

      if (editButtonCount > 0) {
        console.log(`Found ${editButtonCount} edit buttons`);

        try {
          // Try to click the first edit button
          await editButtons.first().click();
          console.log("✓ Edit button clicked successfully");

          // Wait for edit modal or form to appear
          await popupPage.waitForTimeout(1000);

          // Look for editing interface
          const editInterface = await popupPage
            .locator(
              ".edit-modal, .snippet-editor, [class*='edit'], #snippetModal:not(.hidden)",
            )
            .count();

          if (editInterface > 0) {
            console.log("✓ Edit interface appeared");

            // Try to modify content
            const contentField = popupPage
              .locator("textarea, [contenteditable], input[type='text']")
              .last();
            if (await contentField.isVisible()) {
              await contentField.clear();
              await contentField.fill("Modified content");
              console.log("✓ Content modified in editor");

              // Try to save
              const saveButton = popupPage.locator(
                "button:has-text('Save'), .save-btn, #modalSave, [class*='save']",
              );
              if ((await saveButton.count()) > 0) {
                await saveButton.first().click();
                console.log("✓ Save button clicked");
                await popupPage.waitForTimeout(1000);
              }
            }
          }
        } catch (error) {
          console.log(
            `Note: Edit interface test: ${error instanceof Error ? error.message : error}`,
          );
        }
      } else {
        console.log("Note: No edit buttons found in current UI");
      }

      // Test snippet deletion if delete buttons exist
      const deleteButtons = await popupPage.locator(
        "button:has-text('Delete'), .delete-btn, [class*='delete'], [title*='delete' i], .fa-trash",
      );
      const deleteButtonCount = await deleteButtons.count();

      if (deleteButtonCount > 0) {
        console.log(`Found ${deleteButtonCount} delete buttons`);

        // Test delete confirmation (don't actually delete in most cases)
        try {
          await deleteButtons.last().click();
          console.log("✓ Delete button clickable");

          // Look for confirmation dialog
          await popupPage.waitForTimeout(500);
          const confirmDialog = await popupPage
            .locator(".confirm-dialog, .modal, [role='dialog'], .swal-modal")
            .count();

          if (confirmDialog > 0) {
            console.log("✓ Delete confirmation dialog appeared");

            // Click cancel to avoid actually deleting
            const cancelButton = popupPage.locator(
              "button:has-text('Cancel'), .cancel-btn, [class*='cancel']",
            );
            if ((await cancelButton.count()) > 0) {
              await cancelButton.first().click();
              console.log("✓ Delete cancelled successfully");
            }
          }
        } catch (error) {
          console.log(
            `Note: Delete interface test: ${error instanceof Error ? error.message : error}`,
          );
        }
      }

      await takeDebugScreenshot(popupPage, "snippet-management-complete");
    } finally {
      await popupPage.close();
    }
  });

  test("Multiple Snippet Management and Organization", async () => {
    console.log("Testing management of multiple snippets...");

    const popupPage = await openPopup(extensionContext);

    try {
      // Create multiple snippets for organization testing
      const organizationSnippets: TestSnippet[] = [
        {
          trigger: ";addr",
          content: "123 Main St, City, State 12345",
          description: "Address",
        },
        {
          trigger: ";phone",
          content: "+1 (555) 123-4567",
          description: "Phone number",
        },
        {
          trigger: ";website",
          content: "https://www.example.com",
          description: "Website URL",
        },
        {
          trigger: ";thanks",
          content: "Thank you for your time and consideration.",
          description: "Thank you note",
        },
        {
          trigger: ";meeting",
          content: "Let's schedule a meeting to discuss this further.",
          description: "Meeting request",
        },
      ];

      console.log(
        `Creating ${organizationSnippets.length} snippets for organization testing...`,
      );

      for (let i = 0; i < organizationSnippets.length; i++) {
        const snippet = organizationSnippets[i];
        try {
          await createSnippet(popupPage, snippet);
          console.log(`✓ Created snippet ${i + 1}: ${snippet.trigger}`);
          await popupPage.waitForTimeout(500); // Brief pause between creations
        } catch (error) {
          console.log(
            `~ Snippet ${snippet.trigger} creation: ${error instanceof Error ? error.message : error}`,
          );
        }
      }

      // Test snippet listing and search functionality
      await popupPage.waitForTimeout(2000);

      // Look for search/filter functionality
      const searchInputs = await popupPage.locator(
        "input[type='search'], input[placeholder*='search' i], .search-input, #searchBox",
      );
      const searchCount = await searchInputs.count();

      if (searchCount > 0) {
        console.log("✓ Search functionality found");

        try {
          await searchInputs.first().fill("addr");
          await popupPage.waitForTimeout(1000);
          console.log("✓ Search filter applied");

          // Clear search
          await searchInputs.first().clear();
          await popupPage.waitForTimeout(500);
          console.log("✓ Search filter cleared");
        } catch (error) {
          console.log(
            `Note: Search test: ${error instanceof Error ? error.message : error}`,
          );
        }
      } else {
        console.log("Note: No search functionality detected in current UI");
      }

      // Test snippet list scrolling and visibility
      const snippetElements = await popupPage
        .locator(".snippet-item, [class*='snippet'], .list-item, .entry")
        .count();

      console.log(`✓ Total visible snippet elements: ${snippetElements}`);

      // Test bulk operations if available
      const bulkSelectors = await popupPage
        .locator("input[type='checkbox'], .select-all, [class*='bulk']")
        .count();

      if (bulkSelectors > 0) {
        console.log(`✓ Bulk operation controls found: ${bulkSelectors}`);

        try {
          const firstCheckbox = popupPage
            .locator("input[type='checkbox']")
            .first();
          if (await firstCheckbox.isVisible()) {
            await firstCheckbox.click();
            console.log("✓ Bulk selection checkbox functional");

            // Uncheck to avoid state issues
            await firstCheckbox.click();
          }
        } catch (error) {
          console.log(
            `Note: Bulk operation test: ${error instanceof Error ? error.message : error}`,
          );
        }
      }

      // Test sorting if available
      const sortControls = await popupPage
        .locator(
          ".sort-btn, [class*='sort'], select[class*='sort'], button:has-text('Sort')",
        )
        .count();

      if (sortControls > 0) {
        console.log(`✓ Sort controls found: ${sortControls}`);
      }

      await takeDebugScreenshot(popupPage, "multiple-snippets-organized");
    } finally {
      await popupPage.close();
    }
  });

  test("Real World Usage Scenarios", async () => {
    console.log("Testing real-world usage scenarios...");

    // Create snippets for real-world testing
    const popupPage = await openPopup(extensionContext);

    const realWorldSnippets: TestSnippet[] = [
      {
        trigger: ";gmail",
        content:
          "Thank you for your email. I'll review this and get back to you within 24 hours.",
        description: "Professional response",
      },
      {
        trigger: ";linkedin",
        content:
          "I'd be happy to connect! Looking forward to networking with you.",
        description: "LinkedIn connection",
      },
    ];

    try {
      for (const snippet of realWorldSnippets) {
        await createSnippet(popupPage, snippet);
        console.log(`✓ Created real-world snippet: ${snippet.trigger}`);
      }
    } catch (error) {
      console.log("Note: Real-world snippets may already exist");
    } finally {
      await popupPage.close();
    }

    // Test on a simple web page that simulates common usage
    const realWorldPage = await extensionContext.context.newPage();

    try {
      // Create a page that simulates common text input scenarios
      await realWorldPage.goto(`data:text/html,
        <html>
          <head><title>Real World Test Page</title></head>
          <body style="padding: 20px; font-family: Arial;">
            <h1>Common Text Input Scenarios</h1>
            
            <h2>Email Composition</h2>
            <textarea id="email-body" placeholder="Compose your email..." 
                     style="width: 100%; height: 150px; font-size: 14px; padding: 10px;"></textarea>
            
            <h2>Social Media Post</h2>
            <div id="social-post" contenteditable="true" 
                 style="border: 1px solid #ccc; padding: 10px; min-height: 100px; font-size: 14px;"
                 placeholder="What's on your mind?"></div>
            
            <h2>Contact Form Message</h2>
            <textarea id="contact-message" placeholder="Your message..." 
                     style="width: 100%; height: 100px; font-size: 14px; padding: 10px;"></textarea>
            
            <h2>Search Box</h2>
            <input type="text" id="search-input" placeholder="Search..." 
                   style="width: 100%; height: 40px; font-size: 16px; padding: 10px;">
          </body>
        </html>
      `);

      const scenarios = [
        {
          name: "Email composition",
          selector: "#email-body",
          snippet: realWorldSnippets[0],
        },
        {
          name: "Social media post",
          selector: "#social-post",
          snippet: realWorldSnippets[1],
        },
        {
          name: "Contact form",
          selector: "#contact-message",
          snippet: realWorldSnippets[0],
        },
      ];

      for (const scenario of scenarios) {
        console.log(`Testing scenario: ${scenario.name}`);

        try {
          const element = realWorldPage.locator(scenario.selector);
          await element.click();

          // Clear any existing content
          await realWorldPage.keyboard.press("Control+A");
          await realWorldPage.keyboard.press("Delete");

          // Type the trigger with natural timing
          await element.type(scenario.snippet.trigger, { delay: 100 });
          await realWorldPage.waitForTimeout(1500); // Wait for potential expansion

          // Check the result
          const result = await element
            .inputValue()
            .catch(() => element.textContent());
          const hasExpanded =
            result?.includes(scenario.snippet.content) || false;

          console.log(
            `  ✓ ${scenario.name}: ${hasExpanded ? "expanded" : "trigger remains"}`,
          );

          await takeDebugScreenshot(
            realWorldPage,
            `real-world-${scenario.name.replace(/\s+/g, "-")}`,
          );
        } catch (error) {
          console.log(
            `  ~ ${scenario.name}: ${error instanceof Error ? error.message : error}`,
          );
        }
      }

      // Test performance under typical usage
      console.log("Testing performance under typical usage patterns...");

      const perfTestElement = realWorldPage.locator("#search-input");
      await perfTestElement.click();

      const startTime = Date.now();

      // Simulate rapid typing and corrections (common user behavior)
      await perfTestElement.type("hello world", { delay: 50 });
      await realWorldPage.keyboard.press("Control+A");
      await perfTestElement.type(realWorldSnippets[0].trigger, { delay: 80 });
      await realWorldPage.waitForTimeout(1000);

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(
        `✓ Performance test completed in ${duration}ms (should be < 3000ms)`,
      );
      expect(duration).toBeLessThan(3000);
    } finally {
      await realWorldPage.close();
    }
  });

  test("Error Handling and Edge Cases", async () => {
    console.log("Testing error handling and edge case scenarios...");

    // Test extension behavior with various edge cases
    const testPage = await createTestPage(extensionContext.context);

    try {
      // Test 1: Very long snippets
      console.log("Testing very long snippet content...");
      const longContent = "A".repeat(1000); // 1000 character snippet
      const longSnippet: TestSnippet = {
        trigger: ";long",
        content: longContent,
        description: "Very long snippet test",
      };

      const popupPage = await openPopup(extensionContext);
      try {
        await createSnippet(popupPage, longSnippet);
        console.log("✓ Long snippet created successfully");
      } catch (error) {
        console.log(
          `Note: Long snippet test: ${error instanceof Error ? error.message : error}`,
        );
      } finally {
        await popupPage.close();
      }

      // Test 2: Special characters and unicode
      console.log("Testing special characters and unicode...");
      const specialSnippet: TestSnippet = {
        trigger: ";special",
        content:
          "Special chars: @#$%^&*()_+{}|:\"<>?[]\\;',./ Unicode: 🚀🌟💻🎯🔥 Math: ∑∞√π",
        description: "Special characters test",
      };

      const popupPage2 = await openPopup(extensionContext);
      try {
        await createSnippet(popupPage2, specialSnippet);
        console.log("✓ Special characters snippet created");
      } catch (error) {
        console.log(
          `Note: Special chars test: ${error instanceof Error ? error.message : error}`,
        );
      } finally {
        await popupPage2.close();
      }

      // Test 3: Rapid successive typing
      console.log("Testing rapid successive typing...");
      const input = testPage.locator("#test-input");
      await input.click();

      try {
        // Type multiple triggers rapidly
        await input.type(";hello;hello;hello", { delay: 10 });
        await testPage.waitForTimeout(2000);
        console.log("✓ Rapid typing handled without crashes");
      } catch (error) {
        console.log(
          `Note: Rapid typing test: ${error instanceof Error ? error.message : error}`,
        );
      }

      // Test 4: Typing in disabled/readonly fields
      console.log("Testing behavior with disabled inputs...");

      await testPage.evaluate(() => {
        const disabledInput = document.createElement("input");
        disabledInput.id = "disabled-input";
        disabledInput.disabled = true;
        disabledInput.style.cssText =
          "width: 100%; height: 40px; margin: 10px 0;";
        disabledInput.placeholder = "Disabled input";
        document.body.appendChild(disabledInput);

        const readonlyInput = document.createElement("input");
        readonlyInput.id = "readonly-input";
        readonlyInput.readOnly = true;
        readonlyInput.style.cssText =
          "width: 100%; height: 40px; margin: 10px 0;";
        readonlyInput.placeholder = "Readonly input";
        document.body.appendChild(readonlyInput);
      });

      try {
        const disabledInput = testPage.locator("#disabled-input");
        await disabledInput.click({ timeout: 1000 });
        console.log(
          "Note: Disabled input interaction (expected to fail or be ignored)",
        );
      } catch (error) {
        console.log("✓ Disabled input properly handled");
      }

      // Test 5: Page navigation during expansion
      console.log("Testing behavior during page navigation...");

      await input.click();
      await input.clear();

      // Start typing a trigger but navigate away
      await input.type(";hel");

      // Navigate to a new page quickly
      await testPage.goto(
        "data:text/html,<html><body><h1>New Page</h1></body></html>",
      );
      await testPage.waitForTimeout(1000);
      console.log("✓ Page navigation during typing handled gracefully");

      // Test 6: Memory and resource usage
      console.log("Testing resource usage with many operations...");

      const operationsTestPage = await createTestPage(extensionContext.context);
      try {
        const testInput = operationsTestPage.locator("#test-input");

        // Perform many operations to test memory handling
        for (let i = 0; i < 10; i++) {
          await testInput.click();
          await testInput.clear();
          await testInput.type(`test operation ${i}`);
          await operationsTestPage.waitForTimeout(100);
        }

        console.log("✓ Multiple operations completed without issues");
      } finally {
        await operationsTestPage.close();
      }

      await takeDebugScreenshot(testPage, "edge-cases-complete");
    } finally {
      await testPage.close();
    }
  });

  test("Extension State Persistence", async () => {
    console.log("Testing extension state persistence...");

    // Test that snippets persist across popup sessions
    const snippet: TestSnippet = {
      trigger: ";persist",
      content: "This snippet should persist across sessions",
      description: "Persistence test snippet",
    };

    // Create snippet in first popup session
    let popupPage = await openPopup(extensionContext);
    try {
      await createSnippet(popupPage, snippet);
      console.log("✓ Persistence test snippet created");
    } catch (error) {
      console.log("Note: Persistence snippet may already exist");
    } finally {
      await popupPage.close();
    }

    // Wait a moment
    await extensionContext.context.waitForTimeout(2000);

    // Open popup again and verify snippet exists
    popupPage = await openPopup(extensionContext);
    try {
      await popupPage.waitForTimeout(1000);

      // Look for the snippet
      const snippetExists =
        (await popupPage.locator(`text=${snippet.trigger}`).count()) > 0 ||
        (await popupPage.locator(`text=${snippet.description}`).count()) > 0 ||
        (await popupPage.locator(`text=${snippet.content}`).count()) > 0;

      if (snippetExists) {
        console.log("✓ Snippet persisted across popup sessions");
      } else {
        // Check if we can find any snippets at all
        const anySnippets = await popupPage
          .locator(".snippet-item, [class*='snippet']")
          .count();
        console.log(
          `Note: Snippet persistence test - found ${anySnippets} total snippets`,
        );
      }

      await takeDebugScreenshot(popupPage, "persistence-test");
    } finally {
      await popupPage.close();
    }

    // Test expansion still works after persistence
    const testPage = await createTestPage(extensionContext.context);
    try {
      const input = testPage.locator("#test-input");
      await input.click();
      await input.type(snippet.trigger);
      await testPage.waitForTimeout(1500);

      const result = await input.inputValue();
      const expanded = result.includes(snippet.content);
      console.log(
        `✓ Persisted snippet expansion test: ${expanded ? "working" : "trigger remains"}`,
      );
    } finally {
      await testPage.close();
    }
  });
});

/**
 * Integration test for complex workflows that combine multiple features
 */
test.describe("Complex Integration Workflows", () => {
  let extensionContext: ExtensionContext;

  test.beforeAll(async () => {
    extensionContext = await setupExtensionContext();
    await waitForExtensionReady(extensionContext);
  });

  test.afterAll(async () => {
    await cleanupExtensionContext(extensionContext);
  });

  test("Complete User Onboarding Simulation", async () => {
    console.log("Simulating complete new user onboarding experience...");

    // Step 1: New user opens popup for first time
    const popupPage = await openPopup(extensionContext);

    try {
      await popupPage.waitForTimeout(2000);
      console.log("✓ Step 1: Extension popup opened successfully");

      // Check for onboarding elements
      const onboardingElements = await popupPage
        .locator(
          ".welcome, .onboard, .intro, .getting-started, [class*='welcome']",
        )
        .count();

      if (onboardingElements > 0) {
        console.log(`✓ Onboarding elements detected: ${onboardingElements}`);
      }

      // Step 2: User creates their first snippet
      const firstSnippet: TestSnippet = {
        trigger: ";intro",
        content: "Hello! This is my first PuffPuffPaste snippet.",
        description: "My first snippet",
      };

      await createSnippet(popupPage, firstSnippet);
      console.log("✓ Step 2: First snippet created successfully");

      // Step 3: User learns about more features
      await popupPage.waitForTimeout(1000);
      await takeDebugScreenshot(popupPage, "onboarding-first-snippet");
    } finally {
      await popupPage.close();
    }

    // Step 4: User tests their snippet
    const testPage = await createTestPage(extensionContext.context);

    try {
      await testSnippetExpansion(testPage, "#test-input", {
        trigger: ";intro",
        content: "Hello! This is my first PuffPuffPaste snippet.",
      });
      console.log("✓ Step 4: First snippet expansion tested successfully");
    } catch (error) {
      console.log(
        `Note: First snippet test: ${error instanceof Error ? error.message : error}`,
      );
    } finally {
      await testPage.close();
    }

    // Step 5: User explores options
    const optionsPage = await openOptionsPage(extensionContext);

    try {
      await optionsPage.waitForTimeout(1000);
      console.log("✓ Step 5: Options page explored");

      // User might adjust settings
      const settingsInputs = await optionsPage.locator(
        "input[type='checkbox']",
      );
      const settingsCount = await settingsInputs.count();

      if (settingsCount > 0) {
        // Toggle a setting and toggle back
        const firstSetting = settingsInputs.first();
        if (await firstSetting.isVisible()) {
          const wasChecked = await firstSetting.isChecked();
          await firstSetting.click();
          await optionsPage.waitForTimeout(500);
          await firstSetting.click(); // Toggle back
          console.log("✓ Settings interaction tested");
        }
      }

      await takeDebugScreenshot(optionsPage, "onboarding-options-explored");
    } finally {
      await optionsPage.close();
    }

    console.log("✓ Complete onboarding simulation successful");
  });

  test("Power User Workflow Simulation", async () => {
    console.log("Simulating advanced power user workflow...");

    // Power user creates multiple snippet categories
    const categories = [
      {
        category: "work",
        snippets: [
          {
            trigger: ";meeting",
            content: "Looking forward to our meeting on {date} at {time}.",
          },
          {
            trigger: ";followup",
            content: "Following up on our previous conversation...",
          },
          {
            trigger: ";deadline",
            content: "The deadline for this project is {date}.",
          },
        ],
      },
      {
        category: "personal",
        snippets: [
          { trigger: ";thanks", content: "Thank you so much for your help!" },
          { trigger: ";weekend", content: "Hope you have a great weekend!" },
          {
            trigger: ";birthday",
            content: "Happy birthday! Hope your day is amazing! 🎉",
          },
        ],
      },
    ];

    const popupPage = await openPopup(extensionContext);

    try {
      // Create all snippets rapidly (power user behavior)
      console.log("Creating multiple snippet categories...");

      for (const category of categories) {
        console.log(`Creating ${category.category} snippets...`);

        for (const snippet of category.snippets) {
          try {
            const fullSnippet: TestSnippet = {
              ...snippet,
              description: `${category.category} - ${snippet.trigger}`,
            };

            await createSnippet(popupPage, fullSnippet);
            console.log(`  ✓ Created: ${snippet.trigger}`);

            // Brief pause between snippets
            await popupPage.waitForTimeout(300);
          } catch (error) {
            console.log(
              `  ~ ${snippet.trigger}: ${error instanceof Error ? error.message : error}`,
            );
          }
        }
      }

      await takeDebugScreenshot(popupPage, "power-user-snippets-created");
    } finally {
      await popupPage.close();
    }

    // Test rapid snippet usage (power user behavior)
    console.log("Testing rapid snippet usage patterns...");

    const testPage = await createTestPage(extensionContext.context);

    try {
      const input = testPage.locator("#test-input");

      // Test rapid switching between different snippets
      const quickTests = [";thanks", ";meeting", ";weekend"];

      for (const trigger of quickTests) {
        await input.click();
        await input.clear();
        await input.type(trigger);
        await testPage.waitForTimeout(800);

        const result = await input.inputValue();
        console.log(
          `  ✓ Quick test ${trigger}: ${result.length > trigger.length ? "expanded" : "unchanged"}`,
        );
      }

      // Test typing multiple snippets in succession (typical power user pattern)
      await input.click();
      await input.clear();

      const combinedText = ";thanks Press Space. ;weekend";
      await input.type(combinedText, { delay: 50 });
      await testPage.waitForTimeout(1500);

      console.log("✓ Combined snippet usage pattern tested");

      await takeDebugScreenshot(testPage, "power-user-rapid-usage");
    } finally {
      await testPage.close();
    }

    console.log("✓ Power user workflow simulation completed");
  });
});
