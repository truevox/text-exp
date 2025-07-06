# 🔧 Comprehensive Refactoring Plan for PuffPuffPaste Chrome Extension

## Overview

Refactor 10 large files (300+ lines) to improve maintainability and follow Single Responsibility Principle. **Goal: No internal logic changes - only reorganization.**

## 📊 Priority Matrix (by file size and complexity)

### Phase 1: Critical Files (>600 lines)

1. **options.ts** (1708 lines) - CRITICAL
2. **content-script.ts** (897 lines) - CRITICAL
3. **sync-manager.ts** (666 lines) - HIGH
4. **popup.ts** (620 lines) - HIGH

### Phase 2: Large Files (400-600 lines)

5. **html.ts** (532 lines) - MEDIUM
6. **text-replacer.ts** (503 lines) - MEDIUM
7. **tex.ts** (476 lines) - MEDIUM
8. **md.ts** (442 lines) - MEDIUM
9. **placeholder-handler.ts** (432 lines) - MEDIUM
10. **enhanced-trigger-detector.ts** (414 lines) - MEDIUM

---

## 🎯 PHASE 1: Critical File Refactoring

### Step 1: Refactor options.ts (1708 lines → ~200 lines)

**Goal:** Split into 8 focused files following single responsibility principle

#### Step 1.1: Create Services Directory Structure

```bash
mkdir -p src/options/services
mkdir -p src/options/components
mkdir -p src/options/utils
```

#### Step 1.2: Extract DOM Elements Map

**New file:** `src/options/utils/dom-elements.ts`

- Move all `elements` object properties from options.ts
- Export as typed interface and element getter functions
- Test: Create unit test to verify all elements exist in DOM

```typescript
// Example structure:
export interface OptionsElements {
  enabledCheckbox: HTMLInputElement;
  caseSensitiveCheckbox: HTMLInputElement;
  // ... all other elements
}

export function getDOMElements(): OptionsElements {
  return {
    enabledCheckbox: document.getElementById(
      "enabledCheckbox",
    ) as HTMLInputElement,
    caseSensitiveCheckbox: document.getElementById(
      "caseSensitiveCheckbox",
    ) as HTMLInputElement,
    // ... rest of elements
  };
}
```

#### Step 1.3: Extract Settings Service

**New file:** `src/options/services/settings-service.ts`

- Move: `loadSettings()`, `saveSettings()`, `handleSettingsChange()`
- Move: All settings-related business logic
- Test: Unit tests for settings load/save operations

```typescript
export class SettingsService {
  async loadSettings(): Promise<ExtensionSettings> {
    /* ... */
  }
  async saveSettings(settings: ExtensionSettings): Promise<void> {
    /* ... */
  }
  handleSettingsChange(changes: Partial<ExtensionSettings>): void {
    /* ... */
  }
}
```

#### Step 1.4: Extract Sync Service

**New file:** `src/options/services/sync-service.ts`

- Move: `syncNow()`, `connectToCloudProvider()`, `disconnectFromCloudProvider()`
- Move: All sync-related business logic
- Test: Unit tests for sync operations (mocked)

#### Step 1.5: Extract Data Management Service

**New file:** `src/options/services/data-management-service.ts`

- Move: `exportData()`, `importData()`, `clearAllData()`, `getStorageStats()`
- Test: Unit tests for import/export functionality

#### Step 1.6: Extract Folder Picker Component

**New file:** `src/options/components/folder-picker.ts`

- Move: All folder picker modal logic, `folderPickerModal` state
- Move: `selectFolder()`, `navigateToFolder()`, `showFolderPicker()`
- Test: Component integration tests for folder selection

#### Step 1.7: Extract UI Manager

**New file:** `src/options/options-ui.ts`

- Move: All DOM manipulation, event listeners, status updates
- Move: `updateUI()`, `showStatus()`, `hideStatus()`, `populateCloudProviderOptions()`
- Test: UI interaction tests

#### Step 1.8: Extract Global Toggle Component

**New file:** `src/options/components/global-toggle.ts`

- Move: Global toggle shortcut logic, keyboard event handling
- Test: Unit tests for keyboard shortcut functionality

#### Step 1.9: Refactor Main Options File

**Updated file:** `src/options/options.ts` (~200 lines)

- Keep only: Main OptionsApp class as orchestrator
- Inject services and UI manager as dependencies
- Test: Integration tests for complete workflows

### Step 2: Refactor content-script.ts (897 lines → ~250 lines)

#### Step 2.1: Extract Event Handler

**New file:** `src/content/event-handler.ts`

- Move: All DOM event listeners (`input`, `keydown`, `focusin`, `focusout`)
- Move: Event delegation and cleanup logic
- Test: Event handling unit tests

#### Step 2.2: Extract DOM Utilities

**New file:** `src/content/utils/dom-utils.ts`

- Move: `isTextInput()`, `getElementText()`, `getCursorPosition()`, `isContentEditable()`
- Test: DOM utility function tests

#### Step 2.3: Extract Test Snippet Modal

**New file:** `src/content/ui/test-snippet-modal.ts`

- Move: Test snippet customization modal logic
- Move: Modal state management and DOM manipulation
- Test: Modal component tests

#### Step 2.4: Refactor Main Content Script

**Updated file:** `src/content/content-script.ts` (~250 lines)

- Keep only: Main ContentScript class as orchestrator
- Delegate to extracted modules
- Test: End-to-end content script integration tests

### Step 3: Refactor sync-manager.ts (666 lines → ~400 lines)

#### Step 3.1: Extract Authentication Service

**New file:** `src/background/services/auth-service.ts`

- Move: All authentication flows for cloud providers
- Move: Token management and validation
- Test: Authentication unit tests with mocked OAuth

#### Step 3.2: Extract Sync State Manager

**New file:** `src/background/sync-state.ts`

- Move: `syncInProgress`, `syncInterval` state management
- Move: Auto-sync scheduling logic
- Test: State management unit tests

#### Step 3.3: Extract Notification Service

**New file:** `src/background/services/notification-service.ts`

- Move: `showNotification()` and related notification logic
- Test: Notification service unit tests

#### Step 3.4: Move Provider-Specific Logic

**Update:** `src/background/cloud-adapters/google-drive-adapter.ts`

- Move: `getGoogleDriveFolders()`, `createGoogleDriveFolder()` from sync-manager
- Test: Update cloud adapter tests

### Step 4: Refactor popup.ts (620 lines → ~200 lines)

#### Step 4.1: Extract Snippet Service

**New file:** `src/popup/services/snippet-service.ts`

- Move: All background script communication for snippets
- Move: `getSnippets()`, `addSnippet()`, `updateSnippet()`, `deleteSnippet()`
- Test: Service communication unit tests

#### Step 4.2: Extract Snippet Modal Component

**New file:** `src/popup/components/snippet-modal.ts`

- Move: Add/edit snippet modal logic and DOM manipulation
- Test: Modal component tests

#### Step 4.3: Extract UI Manager

**New file:** `src/popup/popup-ui.ts`

- Move: All DOM rendering, search functionality, list updates
- Move: `renderSnippetList()`, `handleSearch()`, UI state management
- Test: UI rendering and interaction tests

#### Step 4.4: Refactor Main Popup

**Updated file:** `src/popup/popup.ts` (~200 lines)

- Keep only: Main PopupApp class as orchestrator
- Implement simple state management pattern
- Test: Complete popup workflow integration tests

---

## 🎯 PHASE 2: Parser and Content File Refactoring

### Step 5: Consolidate Parsers (html.ts, tex.ts, md.ts)

#### Step 5.1: Create Base Parser Infrastructure

**New file:** `src/parsers/base-parser.ts`

- Create abstract BaseParser class with common methods
- Move: `normalizeContentType()`, `normalizeScope()`, `normalizeVariables()`
- Move: Main `serialize()` method template

```typescript
export abstract class BaseParser {
  abstract getFormat(): string;
  abstract parse(content: string, fileName?: string, options?: any): any;

  protected normalizeContentType(contentType?: string): string {
    /* common logic */
  }
  protected normalizeScope(scope?: string): string {
    /* common logic */
  }
  protected normalizeVariables(variables?: any[]): any[] {
    /* common logic */
  }
}
```

#### Step 5.2: Extract Parser Utils

**New file:** `src/parsers/utils/parser-utils.ts`

- Move: `extractYAMLFrontmatter()`, `hasYAMLFrontmatter()`
- Move: Common validation and normalization functions
- Test: Parser utility unit tests

#### Step 5.3: Refactor Individual Parsers

**Update files:** `src/parsers/html-parser.ts`, `src/parsers/md-parser.ts`, `src/parsers/tex-parser.ts`

- Extend BaseParser, implement format-specific logic only
- Remove duplicated code, delegate to base class
- Test: Parser-specific unit tests

#### Step 5.4: Create Parser Factory

**Update file:** `src/parsers/index.ts`

- Implement ParserFactory pattern for parser instantiation
- Test: Factory pattern unit tests

### Step 6: Refactor text-replacer.ts (503 lines → ~200 lines)

#### Step 6.1: Implement Strategy Pattern

**New files:**

- `src/content/replacement-strategies/form-input-strategy.ts`
- `src/content/replacement-strategies/content-editable-strategy.ts`
- Abstract interface for replacement strategies

```typescript
export interface ReplacementStrategy {
  canHandle(element: Element): boolean;
  replaceText(
    element: Element,
    oldText: string,
    newText: string,
    cursorPos: number,
  ): void;
}
```

#### Step 6.2: Extract Undo Manager

**New file:** `src/content/undo-manager.ts`

- Move: `_lastReplacement` state and `undoLastReplacement()` logic
- Test: Undo functionality unit tests

#### Step 6.3: Extract Cursor Manager

**New file:** `src/content/cursor-manager.ts`

- Move: `getCursorPosition()`, `setCursorPosition()` cursor logic
- Test: Cursor management unit tests

### Step 7: Refactor placeholder-handler.ts (432 lines → ~250 lines)

#### Step 7.1: Extract Variable Modal

**New file:** `src/content/ui/variable-modal.ts`

- Move: Variable prompt modal DOM and event logic
- Test: Variable modal component tests

#### Step 7.2: Extract Placeholder Service

**New file:** `src/content/services/placeholder-service.ts`

- Move: Variable replacement logic for built-in and custom variables
- Test: Placeholder replacement unit tests

#### Step 7.3: Extract Validation Service

**New file:** `src/content/services/validation-service.ts`

- Move: `validateVariables()` and related validation logic
- Test: Validation unit tests

### Step 8: Refactor enhanced-trigger-detector.ts (414 lines → ~250 lines)

#### Step 8.1: Extract Trie Data Structure

**New file:** `src/content/utils/trie.ts`

- Move: All trie-related logic (node creation, insertion, traversal)
- Test: Trie data structure unit tests

#### Step 8.2: Extract Performance Monitor

**New file:** `src/content/utils/performance-monitor.ts`

- Move: `getPerformanceStats()` and performance calculations
- Test: Performance monitoring unit tests

#### Step 8.3: Create Match Value Object

**New file:** `src/content/utils/match.ts`

- Create TriggerMatch value object and creation logic
- Test: Match object unit tests

---

## 🧪 Testing Strategy

### For Each Refactoring Step:

1. **Before refactoring:** Run existing tests to establish baseline
2. **During refactoring:** Write unit tests for extracted modules
3. **After refactoring:** Verify integration tests still pass
4. **Commit pattern:** Test-first commits, then implementation commits

### Test Types to Maintain:

- **Unit tests:** For each extracted service/component
- **Integration tests:** For file interactions
- **E2E tests:** Verify no behavior changes

---

## 📦 Commit Strategy

### Per Refactoring Step:

1. **Plan commit:** Add failing tests for extracted module
2. **Implementation commit:** Extract module and update imports
3. **Cleanup commit:** Remove old code and update tests
4. **Integration commit:** Verify all tests pass

### Example Commit Messages:

```
🧪 Test, TC: 47.6% - Add tests for options settings service extraction
🔧 Refactor, TC: 47.8% - Extract settings service from options.ts
✨ Feat, TC: 48.1% - Complete options.ts refactoring with new architecture
```

---

## 🔍 Verification Checklist

After each phase:

- [ ] All existing tests pass
- [ ] No behavior changes in UI
- [ ] File line counts under 300 lines
- [ ] No internal logic modifications
- [ ] Clean import/export structure
- [ ] TypeScript compilation success
- [ ] Extension functionality unchanged

---

## 📋 Implementation Notes

### Key Principles:

1. **Zero-Loss Principle:** No information lost during refactoring
2. **Single Responsibility:** Each file has one clear purpose
3. **Dependency Injection:** Use constructor injection for services
4. **Interface Segregation:** Small, focused interfaces
5. **Open/Closed:** Extensible without modification

### Tools to Use:

- **Gemini CLI:** For large-scale analysis verification
- **Jest:** For comprehensive test coverage
- **TypeScript:** For type safety during refactoring
- **Git:** For incremental, safe commits

### Recommended Implementation Order:

1. **Start with options.ts** (most complex, highest impact)
2. **Move to content-script.ts** (user-facing functionality)
3. **Refactor sync-manager.ts** (core business logic)
4. **Address popup.ts** (UI simplification)
5. **Consolidate parsers** (shared infrastructure)
6. **Finish remaining files** (specialized components)

---

## 🚀 Getting Started

### Prerequisites:

- Current test suite passes (505/505 tests)
- Development environment set up
- Gemini CLI available for analysis

### First Steps:

1. Run baseline tests: `npm test`
2. Create feature branch: `git checkout -b refactor/options-ts`
3. Begin with options.ts Step 1.1 (directory structure)
4. Follow TDD approach as outlined in CLAUDE.md

This comprehensive plan provides step-by-step instructions detailed enough for any developer to continue the refactoring process while maintaining code quality and functionality.
