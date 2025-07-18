/**
 * Multi-Store Editor Example
 * Demonstrates comprehensive multi-store editing with duplicate detection
 */

import {
  MultiStoreEditor,
  type StoreSnippetInfo,
  type MultiStoreEditorOptions,
} from "./multi-store-editor.js";
import type { TextSnippet } from "../../shared/types.js";
import type { EnhancedSnippet } from "../../types/snippet-formats.js";

/**
 * Create a comprehensive multi-store editor example
 */
export function createMultiStoreEditorExample(
  container: HTMLElement,
  currentSnippet?: TextSnippet | EnhancedSnippet,
): MultiStoreEditor {
  // Example stores with various configurations
  const exampleStores: StoreSnippetInfo[] = [
    {
      storeId: "personal_store",
      storeName: "personal.json",
      displayName: "Personal Snippets",
      tierName: "personal",
      snippetCount: 15,
      isReadOnly: false,
      isDriveFile: true,
      fileId: "personal_drive_file_123",
      lastModified: "2024-01-20T14:30:00Z",
      snippets: [
        {
          id: "p1",
          trigger: ";hello",
          content: "Hello from personal store!",
          description: "Personal greeting",
          createdAt: new Date("2024-01-15T10:00:00Z"),
          updatedAt: new Date("2024-01-20T14:30:00Z"),
        },
        {
          id: "p2",
          trigger: ";sig",
          content: "Best regards,\nJohn Doe\nSoftware Engineer",
          description: "Personal signature",
          createdAt: new Date("2024-01-10T09:00:00Z"),
          updatedAt: new Date("2024-01-15T11:00:00Z"),
        },
        {
          id: "p3",
          trigger: ";meeting",
          content:
            "Thanks for the meeting today. Here are the key points we discussed:\n\n- ${point1}\n- ${point2}\n- ${point3}",
          description: "Meeting follow-up template",
          createdAt: new Date("2024-01-12T16:00:00Z"),
          updatedAt: new Date("2024-01-18T10:00:00Z"),
        },
      ],
    },
    {
      storeId: "team_store",
      storeName: "team.json",
      displayName: "Team Snippets",
      tierName: "team",
      snippetCount: 8,
      isReadOnly: false,
      isDriveFile: true,
      fileId: "team_drive_file_456",
      lastModified: "2024-01-19T09:15:00Z",
      snippets: [
        {
          id: "t1",
          trigger: ";hello",
          content: "Hello team member!",
          description: "Team greeting",
          createdAt: new Date("2024-01-05T14:00:00Z"),
          updatedAt: new Date("2024-01-19T09:15:00Z"),
        },
        {
          id: "t2",
          trigger: ";standup",
          content:
            "Daily Standup Update:\n\n**Yesterday:** ${yesterday}\n\n**Today:** ${today}\n\n**Blockers:** ${blockers}",
          description: "Daily standup template",
          createdAt: new Date("2024-01-08T08:30:00Z"),
          updatedAt: new Date("2024-01-16T08:30:00Z"),
        },
        {
          id: "t3",
          trigger: ";deploy",
          content:
            "Deployment notification: ${feature} has been deployed to ${environment}. Please test and report any issues.",
          description: "Deployment notification",
          createdAt: new Date("2024-01-14T15:45:00Z"),
          updatedAt: new Date("2024-01-17T12:00:00Z"),
        },
      ],
    },
    {
      storeId: "org_store",
      storeName: "organization.json",
      displayName: "Organization Snippets",
      tierName: "org",
      snippetCount: 20,
      isReadOnly: true,
      isDriveFile: true,
      fileId: "org_drive_file_789",
      lastModified: "2024-01-18T16:00:00Z",
      snippets: [
        {
          id: "o1",
          trigger: ";hello",
          content: "Hello and welcome to our organization!",
          description: "Organization welcome message",
          createdAt: new Date("2024-01-01T10:00:00Z"),
          updatedAt: new Date("2024-01-18T16:00:00Z"),
        },
        {
          id: "o2",
          trigger: ";policy",
          content:
            "Please review our company policy regarding ${policy_topic}. You can find the full document at ${policy_url}.",
          description: "Policy reference template",
          createdAt: new Date("2024-01-03T11:00:00Z"),
          updatedAt: new Date("2024-01-15T14:00:00Z"),
        },
        {
          id: "o3",
          trigger: ";legal",
          content:
            "This communication contains confidential information. Please do not share without proper authorization.",
          description: "Legal disclaimer",
          createdAt: new Date("2024-01-02T13:00:00Z"),
          updatedAt: new Date("2024-01-10T09:00:00Z"),
        },
      ],
    },
    {
      storeId: "local_store",
      storeName: "local-backup.json",
      displayName: "Local Backup",
      tierName: "personal",
      snippetCount: 5,
      isReadOnly: false,
      isDriveFile: false,
      lastModified: "2024-01-21T08:00:00Z",
      snippets: [
        {
          id: "l1",
          trigger: ";backup",
          content: "This is a backup snippet stored locally.",
          description: "Local backup snippet",
          createdAt: new Date("2024-01-20T20:00:00Z"),
          updatedAt: new Date("2024-01-21T08:00:00Z"),
        },
        {
          id: "l2",
          trigger: ";temp",
          content: "Temporary content for testing purposes.",
          description: "Temporary snippet",
          createdAt: new Date("2024-01-21T07:30:00Z"),
          updatedAt: new Date("2024-01-21T08:00:00Z"),
        },
      ],
    },
  ];

  // Enhanced snippet example
  const enhancedCurrentSnippet: EnhancedSnippet = {
    id: "enhanced_example",
    trigger: ";enhanced",
    content:
      "<p>This is an <strong>enhanced snippet</strong> with <em>rich formatting</em>.</p><p>Variables: ${name}, ${company}</p>",
    contentType: "html",
    snipDependencies: ["personal_store:;sig:p2"],
    description: "Enhanced snippet with dependencies and metadata",
    scope: "personal",
    variables: [
      { name: "name", prompt: "Enter your name" },
      { name: "company", prompt: "Enter your company name" },
    ],
    images: ["https://example.com/logo.png"],
    tags: ["enhanced", "example", "demo"],
    createdAt: "2024-01-22T10:00:00Z",
    createdBy: "demo@example.com",
    updatedAt: "2024-01-22T10:30:00Z",
    updatedBy: "demo@example.com",
  };

  // Create comprehensive options
  const options: MultiStoreEditorOptions = {
    stores: exampleStores,
    currentSnippet: currentSnippet || enhancedCurrentSnippet,
    enableDuplicateDetection: true,
    enableCrossStoreEditing: true,
    showReadOnlyStores: true,

    onStoreSelectionChange: (selectedStores: string[]) => {
      console.log("🔄 Store selection changed:", selectedStores);

      // Update UI to show selected stores
      const selectedCount = selectedStores.length;
      const storeNames = selectedStores.map((storeId) => {
        const store = exampleStores.find((s) => s.storeId === storeId);
        return store ? store.displayName : storeId;
      });

      console.log(
        `📊 ${selectedCount} stores selected: ${storeNames.join(", ")}`,
      );
    },

    onDuplicateResolution: (duplicates) => {
      console.log("🔍 Duplicate resolution updated:", duplicates);

      duplicates.forEach((group) => {
        console.log(`🔄 Duplicate group for trigger "${group.trigger}":`);
        group.duplicates.forEach((duplicate) => {
          console.log(
            `  - ${duplicate.displayName}: ${duplicate.conflictResolution}`,
          );
        });
      });
    },

    onSnippetUpdate: (
      storeId: string,
      snippet: TextSnippet | EnhancedSnippet,
    ) => {
      console.log("💾 Snippet update requested:", { storeId, snippet });

      const store = exampleStores.find((s) => s.storeId === storeId);
      if (store) {
        console.log(`🔄 Updating "${snippet.trigger}" in ${store.displayName}`);

        // Simulate update
        const existingIndex = store.snippets.findIndex(
          (s) => s.trigger === snippet.trigger,
        );
        if (existingIndex >= 0) {
          store.snippets[existingIndex] = snippet;
          console.log("✅ Snippet updated successfully");
        } else {
          store.snippets.push(snippet);
          store.snippetCount++;
          console.log("✅ New snippet added successfully");
        }
      }
    },

    onValidationError: (errors: string[]) => {
      console.error("❌ Validation errors:", errors);

      // Show validation errors to user
      errors.forEach((error) => {
        console.error(`  - ${error}`);
      });
    },
  };

  // Create and initialize the editor
  const editor = new MultiStoreEditor(options);

  // Initialize the editor
  editor.init(container).then(() => {
    console.log("🎉 Multi-store editor initialized successfully!");
    console.log("📋 Available features:");
    console.log("  - Store selection across multiple tiers");
    console.log("  - Duplicate detection and resolution");
    console.log("  - Cross-store snippet editing");
    console.log("  - Read-only store support");
    console.log("  - Visual duplicate management");
    console.log("  - Comprehensive validation");

    // Show initial statistics
    const totalSnippets = exampleStores.reduce(
      (sum, store) => sum + store.snippetCount,
      0,
    );
    const readOnlyStores = exampleStores.filter(
      (store) => store.isReadOnly,
    ).length;
    const driveStores = exampleStores.filter(
      (store) => store.isDriveFile,
    ).length;

    console.log("📊 Store statistics:");
    console.log(`  - Total stores: ${exampleStores.length}`);
    console.log(`  - Total snippets: ${totalSnippets}`);
    console.log(`  - Read-only stores: ${readOnlyStores}`);
    console.log(`  - Google Drive stores: ${driveStores}`);
    console.log(`  - Local stores: ${exampleStores.length - driveStores}`);

    // Demonstrate duplicate detection
    console.log("🔍 Demonstrating duplicate detection...");
    setTimeout(() => {
      // Select stores with duplicates
      editor["selectAllStores"]();

      const duplicates = editor.getDuplicateGroups();
      if (duplicates.length > 0) {
        console.log(`⚠️  Found ${duplicates.length} duplicate group(s):`);
        duplicates.forEach((group) => {
          console.log(
            `  - Trigger "${group.trigger}" appears in ${group.duplicates.length} stores`,
          );
        });
      } else {
        console.log("✅ No duplicates found");
      }
    }, 1000);
  });

  return editor;
}

/**
 * Example usage function
 */
export function demonstrateMultiStoreEditor(): void {
  // Create container
  const container = document.createElement("div");
  container.id = "multi-store-editor-demo";
  container.style.padding = "20px";
  container.style.maxWidth = "1200px";
  container.style.margin = "0 auto";

  // Add title
  const title = document.createElement("h2");
  title.textContent = "Multi-Store Editor Demo";
  title.style.marginBottom = "20px";
  container.appendChild(title);

  // Create editor container
  const editorContainer = document.createElement("div");
  container.appendChild(editorContainer);

  // Add to page
  document.body.appendChild(container);

  // Create editor
  const editor = createMultiStoreEditorExample(editorContainer);

  // Add demo controls
  const controls = document.createElement("div");
  controls.style.marginTop = "20px";
  controls.style.padding = "16px";
  controls.style.background = "#f9fafb";
  controls.style.borderRadius = "8px";
  controls.innerHTML = `
    <h3>Demo Controls</h3>
    <div style="display: flex; gap: 8px; margin-top: 12px;">
      <button id="select-all-btn" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Select All Stores
      </button>
      <button id="select-writable-btn" style="padding: 8px 16px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Select Writable Only
      </button>
      <button id="scan-duplicates-btn" style="padding: 8px 16px; background: #f59e0b; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Scan for Duplicates
      </button>
      <button id="validate-btn" style="padding: 8px 16px; background: #8b5cf6; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Validate
      </button>
    </div>
  `;

  container.appendChild(controls);

  // Add event listeners for demo controls
  const selectAllBtn = controls.querySelector("#select-all-btn");
  const selectWritableBtn = controls.querySelector("#select-writable-btn");
  const scanDuplicatesBtn = controls.querySelector("#scan-duplicates-btn");
  const validateBtn = controls.querySelector("#validate-btn");

  selectAllBtn?.addEventListener("click", () => {
    editor["selectAllStores"]();
    console.log("📋 Selected all stores");
  });

  selectWritableBtn?.addEventListener("click", () => {
    editor["selectWritableStores"]();
    console.log("📋 Selected writable stores only");
  });

  scanDuplicatesBtn?.addEventListener("click", () => {
    editor["detectDuplicates"]();
    const duplicates = editor.getDuplicateGroups();
    console.log(
      `🔍 Scan complete: Found ${duplicates.length} duplicate group(s)`,
    );
  });

  validateBtn?.addEventListener("click", () => {
    const result = editor.validate();
    console.log("✅ Validation result:", result);

    if (result.isValid) {
      console.log("✅ All validations passed!");
    } else {
      console.log("❌ Validation failed:", result.errors);
    }

    if (result.warnings.length > 0) {
      console.log("⚠️  Warnings:", result.warnings);
    }
  });

  console.log("🎉 Multi-store editor demo loaded!");
  console.log(
    "Open the browser console to see detailed logs and use the demo controls above.",
  );
}

/**
 * Create a simple multi-store editor for basic usage
 */
export function createSimpleMultiStoreEditor(
  container: HTMLElement,
  stores: StoreSnippetInfo[],
): MultiStoreEditor {
  const editor = new MultiStoreEditor({
    stores,
    enableDuplicateDetection: true,
    enableCrossStoreEditing: false,
    showReadOnlyStores: true,
    onStoreSelectionChange: (selectedStores) => {
      console.log("Selected stores:", selectedStores);
    },
  });

  editor.init(container);
  return editor;
}
