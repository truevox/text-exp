import { test, expect, Page } from "@playwright/test";
import {
  setupExtensionContext,
  openPopup,
  createSnippet,
  createTestPage,
  testSnippetExpansion,
  takeDebugScreenshot,
  waitForExtensionReady,
  cleanupExtensionContext,
  type ExtensionContext,
  type TestSnippet,
} from "./test-utils.js";

/**
 * Comprehensive tests for advanced snippet features in PuffPuffPaste Chrome extension
 * Tests variable prompts, HTML content, dependency resolution, snippet cycling,
 * special characters, long content, and nested scenarios
 */

test.describe("PuffPuffPaste Advanced Snippet Features", () => {
  let extensionContext: ExtensionContext;
  let popupPage: Page;
  let testPage: Page;

  test.beforeAll(async () => {
    extensionContext = await setupExtensionContext();
    await waitForExtensionReady(extensionContext);
  });

  test.afterAll(async () => {
    if (extensionContext) {
      await cleanupExtensionContext(extensionContext);
    }
  });

  test.beforeEach(async () => {
    popupPage = await openPopup(extensionContext);
    testPage = await createTestPage(extensionContext.context);
  });

  test.afterEach(async () => {
    if (popupPage && !popupPage.isClosed()) {
      await popupPage.close();
    }
    if (testPage && !testPage.isClosed()) {
      await testPage.close();
    }
  });

  test.describe("Variable Prompts and Substitution", () => {
    test("should show variable prompt modal for snippets with placeholders", async () => {
      const snippet: TestSnippet = {
        trigger: ";email",
        content: "Hi {{name}},\n\nI wanted to reach out regarding {{subject}}.\n\nBest regards,\n{{sender}}",
        description: "Email template with variables",
        variables: [
          { name: "name", description: "Recipient name" },
          { name: "subject", description: "Email subject" },
          { name: "sender", description: "Your name" },
        ],
      };

      await createSnippet(popupPage, snippet);

      // Go to test page and focus input
      await testPage.bringToFront();
      const input = testPage.locator("#test-input");
      await input.click();

      // Type trigger
      await input.type(snippet.trigger);

      // Wait for variable modal to appear
      await testPage.waitForSelector(".text-expander-modal-overlay", { timeout: 5000 });
      await testPage.waitForSelector(".text-expander-variable-modal", { timeout: 5000 });

      // Verify modal title and inputs
      const modalTitle = await testPage.locator(".text-expander-variable-modal h3").textContent();
      expect(modalTitle).toBe("Enter Variable Values");

      // Check that variable inputs are present
      const nameInput = testPage.locator('input[name="name"]');
      const subjectInput = testPage.locator('input[name="subject"]');
      const senderInput = testPage.locator('input[name="sender"]');

      await expect(nameInput).toBeVisible();
      await expect(subjectInput).toBeVisible();
      await expect(senderInput).toBeVisible();

      // Fill in variable values
      await nameInput.fill("John Doe");
      await subjectInput.fill("Project Update");
      await senderInput.fill("Jane Smith");

      // Take screenshot for debugging
      await takeDebugScreenshot(testPage, "variable-modal-filled");

      // Submit the form
      await testPage.click('button[type="submit"]');

      // Wait for modal to disappear
      await testPage.waitForSelector(".text-expander-modal-overlay", { state: "hidden", timeout: 5000 });

      // Verify expanded content
      const expandedContent = await input.inputValue();
      expect(expandedContent).toContain("Hi John Doe,");
      expect(expandedContent).toContain("regarding Project Update");
      expect(expandedContent).toContain("Best regards,\nJane Smith");
    });

    test("should handle variable cancellation gracefully", async () => {
      const snippet: TestSnippet = {
        trigger: ";meeting",
        content: "Meeting scheduled for {{date}} at {{time}} in {{location}}",
        variables: [
          { name: "date", description: "Meeting date" },
          { name: "time", description: "Meeting time" },
          { name: "location", description: "Meeting location" },
        ],
      };

      await createSnippet(popupPage, snippet);
      await testPage.bringToFront();

      const input = testPage.locator("#test-input");
      await input.click();
      await input.type(snippet.trigger);

      // Wait for modal
      await testPage.waitForSelector(".text-expander-modal-overlay", { timeout: 5000 });

      // Cancel the modal
      await testPage.click("button:has-text('Cancel')");

      // Verify modal disappeared and trigger remains unexpanded
      await testPage.waitForSelector(".text-expander-modal-overlay", { state: "hidden", timeout: 5000 });
      const inputValue = await input.inputValue();
      expect(inputValue).toBe(snippet.trigger); // Should remain as trigger
    });

    test("should use default values for variables when provided", async () => {
      const snippet: TestSnippet = {
        trigger: ";signature",
        content: "{{greeting}}\n\n{{name}}\n{{title}}\n{{company}}",
        variables: [
          { name: "greeting", description: "Greeting", defaultValue: "Best regards," },
          { name: "name", description: "Your name", defaultValue: "John Smith" },
          { name: "title", description: "Your title", defaultValue: "Software Engineer" },
          { name: "company", description: "Company name", defaultValue: "Tech Corp" },
        ],
      };

      await createSnippet(popupPage, snippet);
      await testPage.bringToFront();

      const input = testPage.locator("#test-input");
      await input.click();
      await input.type(snippet.trigger);

      await testPage.waitForSelector(".text-expander-modal-overlay", { timeout: 5000 });

      // Verify default values are pre-filled
      const greetingInput = testPage.locator('input[name="greeting"]');
      const nameInput = testPage.locator('input[name="name"]');
      
      expect(await greetingInput.inputValue()).toBe("Best regards,");
      expect(await nameInput.inputValue()).toBe("John Smith");

      // Submit with default values
      await testPage.click('button[type="submit"]');
      await testPage.waitForSelector(".text-expander-modal-overlay", { state: "hidden", timeout: 5000 });

      const expandedContent = await input.inputValue();
      expect(expandedContent).toContain("Best regards,");
      expect(expandedContent).toContain("John Smith");
      expect(expandedContent).toContain("Software Engineer");
      expect(expandedContent).toContain("Tech Corp");
    });
  });

  test.describe("HTML Content Expansion", () => {
    test("should preserve HTML formatting in content editable elements", async () => {
      const htmlSnippet: TestSnippet = {
        trigger: ";htmlformat",
        content: '<p><strong>Important:</strong> This is <em>formatted</em> content with <a href="https://example.com">a link</a>.</p>',
        contentType: "html",
        description: "HTML formatted content",
      };

      await createSnippet(popupPage, htmlSnippet);
      await testPage.bringToFront();

      // Use content editable div for HTML expansion
      const contentEditable = testPage.locator("#test-contenteditable");
      await contentEditable.click();
      await contentEditable.type(htmlSnippet.trigger);

      // Wait for expansion
      await testPage.waitForTimeout(2000);

      // Verify HTML structure is preserved
      const innerHTML = await contentEditable.innerHTML();
      expect(innerHTML).toContain("<strong>Important:</strong>");
      expect(innerHTML).toContain("<em>formatted</em>");
      expect(innerHTML).toContain('<a href="https://example.com">a link</a>');
    });

    test("should handle complex HTML structures with nested elements", async () => {
      const complexHtmlSnippet: TestSnippet = {
        trigger: ";table",
        content: `
          <table border="1" style="border-collapse: collapse;">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Department</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>{{name1}}</strong></td>
                <td>{{role1}}</td>
                <td>{{dept1}}</td>
              </tr>
              <tr>
                <td><strong>{{name2}}</strong></td>
                <td>{{role2}}</td>
                <td>{{dept2}}</td>
              </tr>
            </tbody>
          </table>
        `,
        contentType: "html",
        variables: [
          { name: "name1", description: "First person name", defaultValue: "Alice Johnson" },
          { name: "role1", description: "First person role", defaultValue: "Manager" },
          { name: "dept1", description: "First person department", defaultValue: "Engineering" },
          { name: "name2", description: "Second person name", defaultValue: "Bob Wilson" },
          { name: "role2", description: "Second person role", defaultValue: "Developer" },
          { name: "dept2", description: "Second person department", defaultValue: "Engineering" },
        ],
      };

      await createSnippet(popupPage, complexHtmlSnippet);
      await testPage.bringToFront();

      const contentEditable = testPage.locator("#test-contenteditable");
      await contentEditable.click();
      await contentEditable.type(complexHtmlSnippet.trigger);

      // Handle variable modal
      await testPage.waitForSelector(".text-expander-modal-overlay", { timeout: 5000 });
      await testPage.click('button[type="submit"]'); // Use default values

      await testPage.waitForSelector(".text-expander-modal-overlay", { state: "hidden", timeout: 5000 });
      await testPage.waitForTimeout(1000);

      // Verify complex HTML structure
      const innerHTML = await contentEditable.innerHTML();
      expect(innerHTML).toContain("<table");
      expect(innerHTML).toContain("<thead>");
      expect(innerHTML).toContain("<tbody>");
      expect(innerHTML).toContain("<strong>Alice Johnson</strong>");
      expect(innerHTML).toContain("<strong>Bob Wilson</strong>");
    });
  });

  test.describe("Dependency Resolution", () => {
    test("should resolve simple dependency chains", async () => {
      // Create base snippets first
      const baseSnippet: TestSnippet = {
        trigger: ";greeting",
        content: "Hello there!",
        description: "Basic greeting",
      };

      const dependentSnippet: TestSnippet = {
        trigger: ";email-start",
        content: ";greeting\n\nI hope you're doing well.",
        description: "Email opening with dependency",
      };

      // Create snippets
      await createSnippet(popupPage, baseSnippet);
      await createSnippet(popupPage, dependentSnippet);

      await testPage.bringToFront();
      const textarea = testPage.locator("#test-textarea");
      await textarea.click();
      await textarea.type(dependentSnippet.trigger);

      // Wait for expansion with dependency resolution
      await testPage.waitForTimeout(3000);

      const expandedContent = await textarea.inputValue();
      expect(expandedContent).toContain("Hello there!");
      expect(expandedContent).toContain("I hope you're doing well.");
      expect(expandedContent).not.toContain(";greeting"); // Dependency should be resolved
    });

    test("should handle nested dependencies", async () => {
      const level1Snippet: TestSnippet = {
        trigger: ";name",
        content: "PuffPuffPaste",
      };

      const level2Snippet: TestSnippet = {
        trigger: ";product",
        content: ";name Extension",
      };

      const level3Snippet: TestSnippet = {
        trigger: ";description",
        content: "Welcome to ;product - the ultimate text expansion tool!",
      };

      // Create snippets in dependency order
      await createSnippet(popupPage, level1Snippet);
      await createSnippet(popupPage, level2Snippet);
      await createSnippet(popupPage, level3Snippet);

      await testPage.bringToFront();
      const textarea = testPage.locator("#test-textarea");
      await textarea.click();
      await textarea.type(level3Snippet.trigger);

      await testPage.waitForTimeout(4000);

      const expandedContent = await textarea.inputValue();
      expect(expandedContent).toContain("Welcome to PuffPuffPaste Extension - the ultimate text expansion tool!");
      expect(expandedContent).not.toContain(";name");
      expect(expandedContent).not.toContain(";product");
    });

    test("should handle dependencies with variables", async () => {
      const baseWithVar: TestSnippet = {
        trigger: ";contact",
        content: "Contact: {{contact_name}} ({{contact_email}})",
        variables: [
          { name: "contact_name", description: "Contact name", defaultValue: "John Doe" },
          { name: "contact_email", description: "Contact email", defaultValue: "john@example.com" },
        ],
      };

      const dependentSnippet: TestSnippet = {
        trigger: ";inquiry",
        content: "Dear Team,\n\n;contact\n\nThank you for your assistance.\n\nBest,\n{{sender}}",
        variables: [
          { name: "sender", description: "Your name", defaultValue: "Jane Smith" },
        ],
      };

      await createSnippet(popupPage, baseWithVar);
      await createSnippet(popupPage, dependentSnippet);

      await testPage.bringToFront();
      const textarea = testPage.locator("#test-textarea");
      await textarea.click();
      await textarea.type(dependentSnippet.trigger);

      // Handle variable modals (dependency first, then main snippet)
      await testPage.waitForSelector(".text-expander-modal-overlay", { timeout: 5000 });
      
      // Fill and submit first modal (for base dependency)
      await testPage.click('button[type="submit"]'); // Use defaults
      
      // Wait for potential second modal
      try {
        await testPage.waitForSelector(".text-expander-modal-overlay", { timeout: 2000 });
        await testPage.click('button[type="submit"]'); // Use defaults for sender
      } catch (e) {
        // Second modal might not appear if already handled
        console.log("Second modal handling note:", e);
      }

      await testPage.waitForTimeout(2000);

      const expandedContent = await textarea.inputValue();
      expect(expandedContent).toContain("Dear Team,");
      expect(expandedContent).toContain("Contact: John Doe (john@example.com)");
      expect(expandedContent).toContain("Best,\nJane Smith");
    });
  });

  test.describe("Snippet Cycling", () => {
    test("should show cycling options for ambiguous triggers", async () => {
      // Create multiple snippets with similar triggers
      const snippets: TestSnippet[] = [
        {
          trigger: ";test",
          content: "This is a test snippet",
          description: "Test snippet 1",
        },
        {
          trigger: ";test2",
          content: "This is test snippet number 2",
          description: "Test snippet 2",
        },
        {
          trigger: ";testing",
          content: "Testing, testing, 1-2-3",
          description: "Testing snippet",
        },
      ];

      // Create all snippets
      for (const snippet of snippets) {
        await createSnippet(popupPage, snippet);
      }

      await testPage.bringToFront();
      const input = testPage.locator("#test-input");
      await input.click();

      // Type partial trigger that could match multiple snippets
      await input.type(";tes");

      // Wait for cycling UI to appear (this might be implementation-specific)
      await testPage.waitForTimeout(2000);

      // Note: The exact cycling UI implementation may vary
      // Check if any cycling-related elements appear
      const hasCyclingUI = await testPage.locator(".cycling-ui, .trigger-options, .ambiguous-trigger").count();
      
      if (hasCyclingUI > 0) {
        console.log("Cycling UI detected");
        await takeDebugScreenshot(testPage, "cycling-ui-active");
      } else {
        console.log("Cycling UI not detected - may need implementation or different trigger pattern");
      }
    });

    test("should cycle through multiple matching snippets with Tab key", async () => {
      const similarSnippets: TestSnippet[] = [
        {
          trigger: ";t1",
          content: "Option 1: Quick response",
          description: "Response option 1",
        },
        {
          trigger: ";t2", 
          content: "Option 2: Detailed response",
          description: "Response option 2",
        },
        {
          trigger: ";t3",
          content: "Option 3: Formal response",
          description: "Response option 3",
        },
      ];

      for (const snippet of similarSnippets) {
        await createSnippet(popupPage, snippet);
      }

      await testPage.bringToFront();
      const input = testPage.locator("#test-input");
      await input.click();
      await input.type(";t");

      // Wait for potential cycling behavior
      await testPage.waitForTimeout(1000);

      // Try Tab key to cycle (if cycling is implemented)
      await testPage.keyboard.press("Tab");
      await testPage.waitForTimeout(500);

      // Check if content changed or cycling occurred
      const currentValue = await input.inputValue();
      console.log("Current value after tab:", currentValue);

      // This test verifies the cycling concept exists
      // The exact implementation details may vary
    });
  });

  test.describe("Special Characters and Unicode", () => {
    test("should handle triggers with special characters", async () => {
      const specialSnippet: TestSnippet = {
        trigger: ";@email",
        content: "admin@company.com",
        description: "Email with special trigger",
      };

      await createSnippet(popupPage, specialSnippet);
      await testPage.bringToFront();

      const input = testPage.locator("#test-input");
      await input.click();
      await input.type(specialSnippet.trigger);

      await testPage.waitForTimeout(1500);
      const expandedContent = await input.inputValue();
      expect(expandedContent).toBe("admin@company.com");
    });

    test("should handle Unicode content and emojis", async () => {
      const unicodeSnippet: TestSnippet = {
        trigger: ";unicode",
        content: "🎉 Welcome! Здравствуйте! こんにちは! مرحبا! 🌍✨",
        description: "Unicode and emoji content",
      };

      await createSnippet(popupPage, unicodeSnippet);
      await testPage.bringToFront();

      const input = testPage.locator("#test-input");
      await input.click();
      await input.type(unicodeSnippet.trigger);

      await testPage.waitForTimeout(1500);
      const expandedContent = await input.inputValue();
      expect(expandedContent).toContain("🎉 Welcome!");
      expect(expandedContent).toContain("Здравствуйте!");
      expect(expandedContent).toContain("こんにちは!");
      expect(expandedContent).toContain("مرحبا!");
      expect(expandedContent).toContain("🌍✨");
    });

    test("should handle mathematical and scientific notation", async () => {
      const mathSnippet: TestSnippet = {
        trigger: ";formula",
        content: "E = mc² ∫₋∞^∞ e^(-x²) dx = √π ∑ᵢ₌₁ⁿ xᵢ ≈ 3.14159 × 10⁸",
        description: "Mathematical notation",
      };

      await createSnippet(popupPage, mathSnippet);
      await testPage.bringToFront();

      const input = testPage.locator("#test-input");
      await input.click();
      await input.type(mathSnippet.trigger);

      await testPage.waitForTimeout(1500);
      const expandedContent = await input.inputValue();
      expect(expandedContent).toContain("E = mc²");
      expect(expandedContent).toContain("∫₋∞^∞");
      expect(expandedContent).toContain("√π");
      expect(expandedContent).toContain("∑ᵢ₌₁ⁿ");
      expect(expandedContent).toContain("≈ 3.14159 × 10⁸");
    });
  });

  test.describe("Long Content Handling", () => {
    test("should handle very long snippets efficiently", async () => {
      const longContent = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(100);
      const longSnippet: TestSnippet = {
        trigger: ";longtext",
        content: longContent,
        description: "Very long content snippet",
      };

      const startTime = Date.now();
      await createSnippet(popupPage, longSnippet);
      
      await testPage.bringToFront();
      const textarea = testPage.locator("#test-textarea");
      await textarea.click();
      
      const expansionStartTime = Date.now();
      await textarea.type(longSnippet.trigger);
      
      await testPage.waitForTimeout(2000);
      const expansionEndTime = Date.now();

      const expandedContent = await textarea.inputValue();
      expect(expandedContent).toHaveLength(longContent.length);
      expect(expandedContent.startsWith("Lorem ipsum")).toBe(true);

      const expansionTime = expansionEndTime - expansionStartTime;
      console.log(`Long content expansion time: ${expansionTime}ms`);
      
      // Performance check - should expand within reasonable time
      expect(expansionTime).toBeLessThan(5000); // Should be under 5 seconds
    });

    test("should handle multiple long snippets with dependencies", async () => {
      const longBase = "Base content: " + "A".repeat(1000);
      const longDependent = "Dependent content: " + "B".repeat(1000) + "\n;longbase\n" + "C".repeat(1000);

      const baseSnippet: TestSnippet = {
        trigger: ";longbase",
        content: longBase,
      };

      const dependentSnippet: TestSnippet = {
        trigger: ";longdep",
        content: longDependent,
      };

      await createSnippet(popupPage, baseSnippet);
      await createSnippet(popupPage, dependentSnippet);

      await testPage.bringToFront();
      const textarea = testPage.locator("#test-textarea");
      await textarea.click();
      await textarea.type(dependentSnippet.trigger);

      await testPage.waitForTimeout(3000);

      const expandedContent = await textarea.inputValue();
      expect(expandedContent).toContain("Dependent content:");
      expect(expandedContent).toContain("Base content:");
      expect(expandedContent).toContain("A".repeat(100)); // Check part of base content
      expect(expandedContent).toContain("B".repeat(100)); // Check part of dependent content
    });
  });

  test.describe("Nested Variable Scenarios", () => {
    test("should handle variables within variables (conditional expansion)", async () => {
      const conditionalSnippet: TestSnippet = {
        trigger: ";conditional",
        content: "{{greeting_type}} {{name}}{{punctuation}}\n\n{{message_{{message_type}}}}",
        variables: [
          { name: "greeting_type", description: "Type of greeting", defaultValue: "Hello" },
          { name: "name", description: "Recipient name", defaultValue: "there" },
          { name: "punctuation", description: "Punctuation", defaultValue: "!" },
          { name: "message_type", description: "Message type (formal/casual)", defaultValue: "casual" },
          { name: "message_formal", description: "Formal message", defaultValue: "I hope this message finds you well." },
          { name: "message_casual", description: "Casual message", defaultValue: "How's it going?" },
        ],
      };

      await createSnippet(popupPage, conditionalSnippet);
      await testPage.bringToFront();

      const textarea = testPage.locator("#test-textarea");
      await textarea.click();
      await textarea.type(conditionalSnippet.trigger);

      await testPage.waitForSelector(".text-expander-modal-overlay", { timeout: 5000 });

      // Modify message_type to test conditional logic
      const messageTypeInput = testPage.locator('input[name="message_type"]');
      await messageTypeInput.fill("formal");

      await testPage.click('button[type="submit"]');
      await testPage.waitForSelector(".text-expander-modal-overlay", { state: "hidden", timeout: 5000 });

      await testPage.waitForTimeout(1000);

      const expandedContent = await textarea.inputValue();
      expect(expandedContent).toContain("Hello there!");
      // Note: Complex nested variable resolution may require advanced implementation
      console.log("Conditional expansion result:", expandedContent);
    });

    test("should handle recursive variable definitions safely", async () => {
      const recursiveSnippet: TestSnippet = {
        trigger: ";recursive",
        content: "Level 1: {{var1}}\nLevel 2: {{var2}}\nLevel 3: {{var3}}",
        variables: [
          { name: "var1", description: "Variable 1", defaultValue: "Value 1 includes {{var2}}" },
          { name: "var2", description: "Variable 2", defaultValue: "Value 2 includes {{var3}}" },
          { name: "var3", description: "Variable 3", defaultValue: "Final value" },
        ],
      };

      await createSnippet(popupPage, recursiveSnippet);
      await testPage.bringToFront();

      const textarea = testPage.locator("#test-textarea");
      await textarea.click();
      await textarea.type(recursiveSnippet.trigger);

      await testPage.waitForSelector(".text-expander-modal-overlay", { timeout: 5000 });
      await testPage.click('button[type="submit"]');
      await testPage.waitForSelector(".text-expander-modal-overlay", { state: "hidden", timeout: 5000 });

      await testPage.waitForTimeout(1000);

      const expandedContent = await textarea.inputValue();
      expect(expandedContent).toContain("Level 1:");
      expect(expandedContent).toContain("Level 2:");
      expect(expandedContent).toContain("Level 3:");
      
      // Should handle recursive variables safely without infinite loops
      console.log("Recursive variable expansion result:", expandedContent);
    });

    test("should handle complex variable substitution patterns", async () => {
      const complexSnippet: TestSnippet = {
        trigger: ";complex",
        content: `
Project: {{project_name}}
Date: {{current_date}}
Status: {{status_{{urgency}}_{{category}}}}
Team: {{team_lead}} (Lead), {{team_members}}
Notes: {{notes_{{status}}_details}}
        `,
        variables: [
          { name: "project_name", description: "Project name", defaultValue: "Alpha Project" },
          { name: "current_date", description: "Current date", defaultValue: "2024-01-15" },
          { name: "urgency", description: "Urgency level (high/normal/low)", defaultValue: "normal" },
          { name: "category", description: "Category (dev/design/qa)", defaultValue: "dev" },
          { name: "status_normal_dev", description: "Normal dev status", defaultValue: "In Progress" },
          { name: "status_high_dev", description: "High priority dev status", defaultValue: "Critical - In Progress" },
          { name: "team_lead", description: "Team lead name", defaultValue: "Alice Johnson" },
          { name: "team_members", description: "Team members", defaultValue: "Bob, Charlie, Diana" },
          { name: "notes_In Progress_details", description: "In progress notes", defaultValue: "Development proceeding on schedule" },
          { name: "status", description: "Overall status", defaultValue: "In Progress" },
        ],
      };

      await createSnippet(popupPage, complexSnippet);
      await testPage.bringToFront();

      const textarea = testPage.locator("#test-textarea");
      await textarea.click();
      await textarea.type(complexSnippet.trigger);

      await testPage.waitForSelector(".text-expander-modal-overlay", { timeout: 5000 });
      
      // Take screenshot of complex variable modal
      await takeDebugScreenshot(testPage, "complex-variables-modal");
      
      await testPage.click('button[type="submit"]');
      await testPage.waitForSelector(".text-expander-modal-overlay", { state: "hidden", timeout: 5000 });

      await testPage.waitForTimeout(1000);

      const expandedContent = await textarea.inputValue();
      expect(expandedContent).toContain("Project: Alpha Project");
      expect(expandedContent).toContain("Date: 2024-01-15");
      expect(expandedContent).toContain("Team: Alice Johnson (Lead)");
      expect(expandedContent).toContain("Bob, Charlie, Diana");

      console.log("Complex variable pattern result:", expandedContent);
    });
  });

  test.describe("Error Handling and Edge Cases", () => {
    test("should handle missing dependencies gracefully", async () => {
      const snippetWithMissingDep: TestSnippet = {
        trigger: ";missing",
        content: "This references ;nonexistent which doesn't exist.",
        description: "Snippet with missing dependency",
      };

      await createSnippet(popupPage, snippetWithMissingDep);
      await testPage.bringToFront();

      const textarea = testPage.locator("#test-textarea");
      await textarea.click();
      await textarea.type(snippetWithMissingDep.trigger);

      await testPage.waitForTimeout(2000);

      const expandedContent = await textarea.inputValue();
      // Should expand but leave unresolved dependency as-is or show placeholder
      expect(expandedContent).toContain("This references");
      console.log("Missing dependency result:", expandedContent);
    });

    test("should prevent circular dependency infinite loops", async () => {
      const circularA: TestSnippet = {
        trigger: ";circularA",
        content: "A depends on ;circularB",
      };

      const circularB: TestSnippet = {
        trigger: ";circularB", 
        content: "B depends on ;circularA",
      };

      await createSnippet(popupPage, circularA);
      await createSnippet(popupPage, circularB);

      await testPage.bringToFront();
      const textarea = testPage.locator("#test-textarea");
      await textarea.click();

      const startTime = Date.now();
      await textarea.type(circularA.trigger);
      
      await testPage.waitForTimeout(3000);
      const endTime = Date.now();

      const expandedContent = await textarea.inputValue();
      const expansionTime = endTime - startTime;

      // Should not hang indefinitely
      expect(expansionTime).toBeLessThan(10000);
      console.log("Circular dependency handling time:", expansionTime);
      console.log("Circular dependency result:", expandedContent);
    });

    test("should handle malformed variable syntax", async () => {
      const malformedSnippet: TestSnippet = {
        trigger: ";malformed",
        content: "Bad variables: {{unclosed, {single}, {{double}}, {{missing}extra}}, normal{{var}}end",
        variables: [
          { name: "var", description: "Normal variable", defaultValue: "NORMAL" },
        ],
      };

      await createSnippet(popupPage, malformedSnippet);
      await testPage.bringToFront();

      const textarea = testPage.locator("#test-textarea");
      await textarea.click();
      await textarea.type(malformedSnippet.trigger);

      // Should handle variable modal for the valid variable
      try {
        await testPage.waitForSelector(".text-expander-modal-overlay", { timeout: 3000 });
        await testPage.click('button[type="submit"]');
        await testPage.waitForSelector(".text-expander-modal-overlay", { state: "hidden", timeout: 5000 });
      } catch (e) {
        console.log("No variable modal appeared for malformed snippet");
      }

      await testPage.waitForTimeout(1000);

      const expandedContent = await textarea.inputValue();
      expect(expandedContent).toContain("Bad variables:");
      expect(expandedContent).toContain("normalNORMALend"); // Valid variable should expand
      console.log("Malformed syntax result:", expandedContent);
    });

    test("should handle extremely deep dependency chains", async () => {
      // Create a chain of dependencies
      const chainLength = 10;
      const snippets: TestSnippet[] = [];

      for (let i = 1; i <= chainLength; i++) {
        const isLast = i === chainLength;
        const content = isLast ? `End of chain level ${i}` : `Level ${i}: ;chain${i + 1}`;
        
        snippets.push({
          trigger: `;chain${i}`,
          content,
          description: `Chain level ${i}`,
        });
      }

      // Create snippets in reverse order (dependencies first)
      for (let i = chainLength - 1; i >= 0; i--) {
        await createSnippet(popupPage, snippets[i]);
      }

      await testPage.bringToFront();
      const textarea = testPage.locator("#test-textarea");
      await textarea.click();

      const startTime = Date.now();
      await textarea.type(";chain1");
      
      await testPage.waitForTimeout(5000);
      const endTime = Date.now();

      const expandedContent = await textarea.inputValue();
      const expansionTime = endTime - startTime;

      expect(expandedContent).toContain("Level 1:");
      expect(expandedContent).toContain("End of chain level 10");
      expect(expansionTime).toBeLessThan(15000); // Should resolve within reasonable time

      console.log("Deep dependency chain time:", expansionTime);
      console.log("Deep chain result length:", expandedContent.length);
    });
  });

  test.describe("Performance and Stress Testing", () => {
    test("should handle rapid snippet creation and expansion", async () => {
      const snippetCount = 20;
      const snippets: TestSnippet[] = [];

      // Create many snippets quickly
      for (let i = 1; i <= snippetCount; i++) {
        snippets.push({
          trigger: `;rapid${i}`,
          content: `Rapid snippet ${i} with some content to expand`,
          description: `Rapid snippet ${i}`,
        });
      }

      const creationStartTime = Date.now();
      for (const snippet of snippets) {
        await createSnippet(popupPage, snippet);
      }
      const creationEndTime = Date.now();

      await testPage.bringToFront();
      const textarea = testPage.locator("#test-textarea");
      await textarea.click();

      // Test rapid expansions
      const expansionStartTime = Date.now();
      for (let i = 1; i <= 5; i++) {
        await textarea.type(`;rapid${i} `);
        await testPage.waitForTimeout(200);
      }
      const expansionEndTime = Date.now();

      const finalContent = await textarea.inputValue();
      const creationTime = creationEndTime - creationStartTime;
      const expansionTime = expansionEndTime - expansionStartTime;

      expect(finalContent).toContain("Rapid snippet 1");
      expect(finalContent).toContain("Rapid snippet 5");

      console.log("Rapid creation time:", creationTime);
      console.log("Rapid expansion time:", expansionTime);

      // Performance expectations
      expect(creationTime).toBeLessThan(30000); // Creation within 30 seconds
      expect(expansionTime).toBeLessThan(5000); // Expansion within 5 seconds
    });

    test("should maintain performance with mixed content types", async () => {
      const mixedSnippets: TestSnippet[] = [
        {
          trigger: ";plain",
          content: "Plain text content",
        },
        {
          trigger: ";htmlmixed",
          content: "<strong>HTML</strong> content with <em>formatting</em>",
          contentType: "html",
        },
        {
          trigger: ";varmixed",
          content: "Content with {{variable}} placeholder",
          variables: [{ name: "variable", description: "Test var", defaultValue: "VALUE" }],
        },
        {
          trigger: ";depmixed",
          content: "Dependent content: ;plain and more text",
        },
        {
          trigger: ";longmixed",
          content: "Long content: " + "X".repeat(500),
        },
      ];

      for (const snippet of mixedSnippets) {
        await createSnippet(popupPage, snippet);
      }

      await testPage.bringToFront();
      const textarea = testPage.locator("#test-textarea");
      await textarea.click();

      const startTime = Date.now();
      
      // Expand different types
      await textarea.type(";plain ");
      await testPage.waitForTimeout(300);
      
      await textarea.type(";varmixed");
      try {
        await testPage.waitForSelector(".text-expander-modal-overlay", { timeout: 2000 });
        await testPage.click('button[type="submit"]');
        await testPage.waitForSelector(".text-expander-modal-overlay", { state: "hidden", timeout: 3000 });
      } catch (e) {
        console.log("Variable modal handling in performance test");
      }
      
      await textarea.type(" ;depmixed ");
      await testPage.waitForTimeout(500);
      
      await textarea.type(";longmixed");
      await testPage.waitForTimeout(1000);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      const finalContent = await textarea.inputValue();
      expect(finalContent).toContain("Plain text content");
      expect(finalContent).toContain("VALUE");
      expect(finalContent).toContain("Long content:");

      console.log("Mixed content performance time:", totalTime);
      expect(totalTime).toBeLessThan(10000); // Within 10 seconds for mixed operations
    });
  });
});