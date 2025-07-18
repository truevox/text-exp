/**
 * Comprehensive Snippet Editor Example
 * Demonstrates the enhanced snippet editor with all JSON fields support
 */

import { SnippetEditor } from "./snippet-editor.js";
import type { EnhancedSnippet } from "../../types/snippet-formats.js";

/**
 * Create a comprehensive snippet editor with all fields enabled
 */
export function createComprehensiveSnippetEditor(
  container: HTMLElement,
  existingSnippet?: EnhancedSnippet,
): SnippetEditor {
  // Example enhanced snippet with all fields
  const exampleSnippet: EnhancedSnippet = {
    id: "example_snippet_123",
    trigger: ";hello",
    content:
      "<p>Hello <strong>${name}</strong>!</p><p>Welcome to ${company}.</p>",
    contentType: "html",
    snipDependencies: [
      "appdata-store:;signature:sig123",
      "team-store:;footer:foot456",
    ],
    description:
      "A comprehensive greeting snippet with variables and dependencies",
    scope: "personal",
    variables: [
      { name: "name", prompt: "What's your name?" },
      { name: "company", prompt: "What's your company name?" },
    ],
    images: [
      "https://example.com/logo.png",
      "1ABC2DEF3GHI4JKL5MNO6PQR7STU8VWX9YZ0", // Example Drive file ID
    ],
    tags: ["greeting", "personal", "welcome"],
    createdAt: "2024-01-15T10:30:00Z",
    createdBy: "user@example.com",
    updatedAt: "2024-01-20T14:45:00Z",
    updatedBy: "editor@example.com",
  };

  // Create editor with comprehensive field support
  const editor = new SnippetEditor({
    snippet: existingSnippet || exampleSnippet,
    mode: existingSnippet ? "edit" : "create",
    supportAllFields: true, // Enable all JSON fields
    compact: false,
    allowedTiers: ["personal", "team", "org"],
    availableStores: {
      personal: [
        {
          fileName: "personal.json",
          displayName: "Personal Snippets",
          snippetCount: 25,
          lastModified: "2024-01-20T14:45:00Z",
          isDefault: true,
          isLocal: false,
          isDriveFile: true,
          fileId: "personal123",
        },
      ],
      team: [
        {
          fileName: "team.json",
          displayName: "Team Snippets",
          snippetCount: 50,
          lastModified: "2024-01-19T09:30:00Z",
          isDefault: false,
          isLocal: false,
          isDriveFile: true,
          fileId: "team456",
        },
      ],
      org: [
        {
          fileName: "org.json",
          displayName: "Organization Snippets",
          snippetCount: 100,
          lastModified: "2024-01-18T16:20:00Z",
          isDefault: false,
          isLocal: false,
          isDriveFile: true,
          fileId: "org789",
        },
      ],
    },
    onSave: async (snippet, targetStores) => {
      console.log("💾 Saving comprehensive snippet:", snippet);
      if (targetStores) {
        console.log("📂 Target stores:", targetStores);
      }

      // Validate all fields are present for EnhancedSnippet
      const enhanced = snippet as EnhancedSnippet;
      const validationResults = validateEnhancedSnippet(enhanced);

      if (validationResults.isValid) {
        console.log("✅ All fields validated successfully!");
        alert("Snippet saved successfully with all fields!");
      } else {
        console.error("❌ Validation failed:", validationResults.errors);
        alert("Validation failed: " + validationResults.errors.join(", "));
      }
    },
    onCancel: () => {
      console.log("🚫 Edit cancelled");
    },
    onValidationError: (errors) => {
      console.error("🔴 Validation errors:", errors);
    },
  });

  return editor;
}

/**
 * Validate that an EnhancedSnippet has all required fields
 */
function validateEnhancedSnippet(snippet: EnhancedSnippet): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Required fields
  if (!snippet.id) errors.push("ID is required");
  if (!snippet.trigger) errors.push("Trigger is required");
  if (!snippet.content) errors.push("Content is required");
  if (!snippet.contentType) errors.push("Content type is required");
  if (!snippet.description) errors.push("Description is required");
  if (!snippet.scope) errors.push("Scope is required");
  if (!snippet.createdAt) errors.push("Created at is required");
  if (!snippet.createdBy) errors.push("Created by is required");
  if (!snippet.updatedAt) errors.push("Updated at is required");
  if (!snippet.updatedBy) errors.push("Updated by is required");

  // Array fields (should be arrays, not undefined)
  if (!Array.isArray(snippet.snipDependencies)) {
    errors.push("Snippet dependencies must be an array");
  }
  if (!Array.isArray(snippet.variables)) {
    errors.push("Variables must be an array");
  }
  if (!Array.isArray(snippet.images)) {
    errors.push("Images must be an array");
  }
  if (!Array.isArray(snippet.tags)) {
    errors.push("Tags must be an array");
  }

  // Content type validation
  const validContentTypes = [
    "html",
    "plaintext",
    "markdown",
    "latex",
    "html+KaTeX",
  ];
  if (!validContentTypes.includes(snippet.contentType)) {
    errors.push(`Content type must be one of: ${validContentTypes.join(", ")}`);
  }

  // Scope validation
  const validScopes = ["personal", "team", "org"];
  if (!validScopes.includes(snippet.scope)) {
    errors.push(`Scope must be one of: ${validScopes.join(", ")}`);
  }

  // Variables validation
  if (snippet.variables.length > 0) {
    snippet.variables.forEach((variable, index) => {
      if (!variable.name) errors.push(`Variable ${index + 1} is missing name`);
      if (!variable.prompt)
        errors.push(`Variable ${index + 1} is missing prompt`);
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Example usage function
 */
export async function demonstrateComprehensiveEditor(): Promise<void> {
  // Create container
  const container = document.createElement("div");
  container.id = "comprehensive-editor-demo";
  document.body.appendChild(container);

  // Create editor
  const editor = createComprehensiveSnippetEditor(container);

  // Initialize editor
  await editor.init(container);

  console.log("🎉 Comprehensive snippet editor initialized!");
  console.log("📋 Features enabled:");
  console.log("  - All JSON fields support");
  console.log("  - TinyMCE WYSIWYG editor");
  console.log("  - Image references management");
  console.log("  - Dependencies tracking");
  console.log("  - Tags and metadata");
  console.log("  - Content type selection");
  console.log("  - Variable detection and documentation");

  // Return the editor for further testing
  return Promise.resolve();
}
