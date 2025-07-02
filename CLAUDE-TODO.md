# CLAUDE-TODO.md

## 📋 Collaborative Text Expander - Implementation Roadmap

### 🎯 Project Overview
This document outlines the implementation plan for a powerful, collaborative text expansion Chrome extension. The project's foundation is the **`CloudAdapter` architecture**, a unified interface for syncing snippets from multiple cloud providers (Google Drive, Dropbox, etc.). It supports **multi-scope synchronization** ("Org Mode") for personal, department, and organization-level snippet libraries, with a focus on offline-first performance, security, and extensibility.

---

## 🚀 Phase 1: Foundation & Core Architecture

### ✅ Project Infrastructure
- [ ] **Set up Chrome extension project with Manifest V3**
  - Create `manifest.json` with necessary permissions (`identity`, `storage`).
  - Establish directory structure: `background/`, `content/`, `ui/`, `shared/`.
- [ ] **Configure Vite build system for the extension**
  - Set up build scripts for development (with hot-reloading) and production.
  - Configure asset handling for icons and other resources.
- [ ] **Set up comprehensive testing framework**
  - Configure Jest for unit tests (e.g., trigger logic, data transformation).
  - Configure Playwright for end-to-end testing of the extension UI and content scripts.

### ✅ CloudAdapter & Data Models
- [ ] **Define the core `CloudAdapter` TypeScript interface**
  - Specify methods for `signIn`, `getUserInfo`, `selectFolder`, `listFiles`, `listChanges`, `downloadFile`, etc.
- [ ] **Implement the data storage architecture**
  - Use `chrome.storage.local` for provider-specific auth tokens.
  - Use `chrome.storage.sync` for selected folder IDs (to sync across user's browsers).
  - Use `IndexedDB` for caching snippet content for offline access.
  - Use `localStorage` for namespaced sync cursors.
- [ ] **Design and implement the `SyncedSource` object model**
  - Define the structure: `{ name, adapter, folderId, displayName }`.
  - This object will represent each folder being synced.
- [ ] **Implement the first `CloudAdapter`: Google Drive**
  - Handle the OAuth2 flow using `chrome.identity.launchWebAuthFlow`.
  - Integrate with the Google Drive API v3 for file and change listing.
  - Use the Google Picker API for user-friendly folder selection.

---

## 🔧 Phase 2: Sync Engine & Expansion Core

### ✅ Background Sync Engine
- [ ] **Build the `SyncManager` to orchestrate adapters**
  - Implement logic to register and coordinate multiple `CloudAdapter` instances.
  - Create `syncAll()` and `syncScope()` methods to manage updates.
- [ ] **Implement multi-scope merging logic ("Org Mode")**
  - Merge snippets from all `SyncedSource` objects.
  - Implement the three-tier priority system: `personal` > `department` > `org`.
  - Handle conflicts and create a unified, in-memory snippet library.
- [ ] **Implement the local snippet cache**
  - Store the merged snippet library in IndexedDB for offline use.
  - Implement cache invalidation logic based on sync results.

### ✅ Content Script & Expansion
- [ ] **Develop the core content script for trigger detection**
  - Monitor keystrokes efficiently in various input contexts (`input`, `textarea`, `contenteditable`).
  - Implement prefix-based trigger detection (e.g., `;gb`).
- [ ] **Build the text expansion engine**
  - Perform in-place replacement of the trigger with the snippet content.
  - Ensure correct cursor positioning after expansion.
  - Handle plain text, HTML, and rich content insertion.

---

## 🎨 Phase 3: Advanced Features & UI

### ✅ Dynamic & Rich Content
- [ ] **Implement the dynamic placeholder system**
  - Parse snippet content for placeholders (e.g., `{name}`).
  - Create a UI (popover or inline form) to prompt the user for input.
- [ ] **Add support for image and mixed-media snippets**
  - Handle the insertion of images into content-editable fields.
  - Ensure images are cached in IndexedDB for offline access.

### ✅ User Interface
- [ ] **Create the multi-provider onboarding flow**
  - Build a setup wizard to guide users through selecting a cloud provider.
  - Implement the UI for setting up `personal`, `department`, and `org` scopes.
  - Prompt users to rename sync sources if default names (e.g., "Personal", "Team") are not ideal (e.g., "My Computer," "Family Snippets").
- [ ] **Develop the extension Options page**
  - Display a list of all synced snippets with scope indicators.
  - Allow users to manage `CloudAdapter` settings and re-authenticate.
  - Provide a status dashboard for the sync engine.
- [ ] **Build the extension Popup UI**
  - Implement a quick search/preview for available snippets.
  - Provide quick actions (e.g., trigger a manual sync).

---

## 🛡️ Phase 4: Hardening & Testing

### ✅ Edge Cases & Security
- [ ] **Handle expansion edge cases**
  - Implement longest-match logic for overlapping triggers (e.g., `;a` vs. `;addr`).
  - Add an "undo" or "escape" mechanism to revert accidental expansions.
- [ ] **Implement critical security measures**
  - Prevent expansion in password fields and other sensitive inputs.
  - Sanitize all HTML snippet content to prevent XSS attacks.
- [ ] **Ensure robust offline functionality**
  - Thoroughly test all features without a network connection.
  - Implement graceful error handling for sync failures.

### ✅ Test Coverage
- [ ] **Write unit tests** for the trigger parser, merge logic, and placeholder processing.
- [ ] **Write integration tests** for each `CloudAdapter` implementation.
- [ ] **Write E2E tests** for the full user journey: onboarding, snippet expansion, and offline usage.
- [ ] **Test multi-provider sync scenarios**, including conflicts and error states.

---

## 📚 Future Enhancements (Post-MVP)

### ✅ Additional CloudAdapters
- [ ] **Implement `DropboxAdapter`** with OAuth2 and file operations.
- [ ] **Implement `OneDriveAdapter`** via the Microsoft Graph API.
- [ ] **Implement `LocalFilesystemAdapter`** using the File System Access API.
- [ ] **Research `GitAdapter`** for syncing snippets from Git repositories.

### ✅ Feature Enhancements
- [ ] **Two-way sync** to allow editing snippets from within the extension.
- [ ] **Snippet versioning and history.**
- [ ] **Advanced placeholder logic** (e.g., dropdowns, conditional sections).
- [ ] **Import/export functionality.**

---

*Last updated: 2025-07-02*
*Project: PuffPuffPaste - Collaborative Text Expander*
*TDD Approach: Write failing tests first, implement just enough to pass, refactor.*
