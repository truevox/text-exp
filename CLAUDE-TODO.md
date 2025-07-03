# CLAUDE-TODO.md

## 📋 Collaborative Text Expander - Implementation Roadmap

### 🎯 Project Overview
This document outlines the implementation plan for a powerful, collaborative text expansion Chrome extension. The project's foundation is the **`CloudAdapter` architecture**, a unified interface for syncing snippets from multiple cloud providers (Google Drive, Dropbox, etc.). It supports **multi-scope synchronization** ("Org Mode") for personal, department, and organization-level snippet libraries, with a focus on offline-first performance, security, and extensibility.

## 🚨 CRITICAL ISSUES REQUIRING IMMEDIATE ATTENTION

**Status**: Several items marked as "complete" have significant implementation gaps or bugs that need urgent fixes:

1. **🔴 SECURITY BUG**: Password field exclusion is broken - text expansion can occur in password fields
2. **🔴 BUILD BLOCKER**: Compilation errors in options.ts preventing successful builds  
3. **🔴 MISSING FEATURE**: Google Picker API not implemented despite being marked complete
4. **🔴 INTERFACE MISMATCH**: CloudAdapter method signatures don't match implementations
5. **🟡 E2E TESTING**: Playwright configuration missing, E2E tests are placeholders only
6. **🟡 SECURITY**: HTML sanitization is basic and may not prevent sophisticated XSS attacks

---

## 🚀 Phase 1: Foundation & Core Architecture

### ✅ Project Infrastructure
- [x] **Set up Chrome extension project with Manifest V3**
  - [x] Create `manifest.json` with necessary permissions (`identity`, `storage`).
  - [x] Establish directory structure: `background/`, `content/`, `ui/`, `shared/`.
- [x] **Configure Vite build system for the extension**
  - [x] Set up build scripts for development (with hot-reloading) and production.
  - [x] Configure asset handling for icons and other resources.
- [x] **Set up comprehensive testing framework**
  - [x] Configure Jest for unit tests (e.g., trigger logic, data transformation).
  - [ ] **BROKEN: Configure Playwright for end-to-end testing of the extension UI and content scripts.**
    - **Issue**: No Playwright configuration exists, E2E tests are placeholders only
    - **Status**: Unit tests pass (168/193), but E2E testing is non-functional

### ✅ CloudAdapter & Data Models
- [x] **Define the core `CloudAdapter` TypeScript interface**
  - [x] Specify methods for `signIn`, `getUserInfo`, `selectFolder`, `listFiles`, `listChanges`, `downloadFile`, etc.
- [x] **Implement the data storage architecture**
  - [x] Use `chrome.storage.local` for provider-specific auth tokens.
  - [x] Use `chrome.storage.sync` for selected folder IDs (to sync across user's browsers).
  - [x] Use `IndexedDB` for caching snippet content for offline access.
  - [x] Use `localStorage` for namespaced sync cursors.
- [x] **Design and implement the `SyncedSource` object model**
  - [x] Define the structure: `{ name, adapter, folderId, displayName }`.
  - [x] This object will represent each folder being synced.
- [x] **Implement the first `CloudAdapter`: Google Drive**
  - [x] Handle the OAuth2 flow using `chrome.identity.launchWebAuthFlow`.
  - [x] Integrate with the Google Drive API v3 for file and change listing.
  - [ ] **MISSING: Use the Google Picker API for user-friendly folder selection.**
    - **Issue**: No Google Picker API implementation found despite claim
    - **Impact**: Users cannot select folders through Google Picker UI
  - [ ] **CRITICAL FIX NEEDED: Interface signature mismatch in `downloadSnippets()` method**
  - [ ] **CRITICAL FIX NEEDED: Replace placeholder credentials with real Google OAuth values**

---

## 🔧 Phase 2: Sync Engine & Expansion Core

### ✅ Background Sync Engine
- [x] **Build the `SyncManager` to orchestrate adapters**
  - [x] Implement logic to register and coordinate multiple `CloudAdapter` instances.
  - [x] Create `syncAll()` and `syncScope()` methods to manage updates.
- [x] **Implement multi-scope merging logic ("Org Mode")**
  - [x] Merge snippets from all `SyncedSource` objects.
  - [x] Implement the three-tier priority system: `personal` > `department` > `org`.
  - [x] Handle conflicts and create a unified, in-memory snippet library.
  - [ ] **BLOCKING: Fix compilation errors in options.ts preventing build**
- [x] **Implement the local snippet cache**
  - Store the merged snippet library in IndexedDB for offline use.
  - Implement cache invalidation logic based on sync results.

### ✅ Content Script & Expansion
- [x] **Develop the core content script for trigger detection**
  - Monitor keystrokes efficiently in various input contexts (`input`, `textarea`, `contenteditable`).
  - Implement prefix-based trigger detection (e.g., `;gb`).
- [x] **Build the text expansion engine**
  - Perform in-place replacement of the trigger with the snippet content.
  - Ensure correct cursor positioning after expansion.
  - Handle plain text, HTML, and rich content insertion.

---

## 🎨 Phase 3: Advanced Features & UI

### ✅ Dynamic & Rich Content
- [x] **Implement the dynamic placeholder system**
  - Parse snippet content for placeholders (e.g., `{name}`).
  - Create a UI (popover or inline form) to prompt the user for input.
- [x] **Add support for image and mixed-media snippets**
  - Handle the insertion of images into content-editable fields.
  - Ensure images are cached in IndexedDB for offline access.

### ✅ User Interface
- [x] **Create the multi-provider onboarding flow**
  - [x] Build a setup wizard to guide users through selecting a cloud provider.
  - [x] Implement the UI for setting up `personal`, `department`, and `org` scopes.
  - [x] Prompt users to rename sync sources if default names (e.g., "Personal", "Team") are not ideal (e.g., "My Computer," "Family Snippets").
- [x] **Develop the extension Options page**
  - [x] Display a list of all synced snippets with scope indicators.
  - [x] Allow users to manage `CloudAdapter` settings and re-authenticate.
  -   - [x] Provide a status dashboard for the sync engine.
- [x] **Build the extension Popup UI**
  - [x] Implement a quick search/preview for available snippets.
  - [x] Provide quick actions (e.g., trigger a manual sync).

---

## 🛡️ Phase 4: Hardening & Testing

### ⚠️ Edge Cases & Security **ISSUES FOUND**
- [x] **Handle expansion edge cases**
  - [x] Implement longest-match logic for overlapping triggers (e.g., `;a` vs. `;addr`).
  - [x] Add an "undo" or "escape" mechanism to revert accidental expansions.
- [ ] **CRITICAL: Implement critical security measures** 
  - [ ] **BROKEN: Prevent expansion in password fields and other sensitive inputs.**
    - **Issue**: Code claims to exclude password fields but doesn't actually do it
    - **Risk**: HIGH - Password fields are still vulnerable to text expansion
  - [ ] **INADEQUATE: Sanitize all HTML snippet content to prevent XSS attacks.**
    - **Issue**: Basic sanitization only, not comprehensive XSS protection
    - **Risk**: MEDIUM - Sophisticated XSS vectors may still work
- [x] **Ensure robust offline functionality**
  - [x] Thoroughly test all features without a network connection.
  - [x] Implement graceful error handling for sync failures.

### ⚠️ Test Coverage **MIXED RESULTS**
- [x] **Write unit tests** for the trigger parser, merge logic, and placeholder processing.
  - **Status**: 168 passing tests out of 193 total - good coverage
- [ ] **Write integration tests** for each `CloudAdapter` implementation.
  - **Issue**: Integration tests exist but most are skipped or failing due to environment issues
- [ ] **BROKEN: Write E2E tests** for the full user journey: onboarding, snippet expansion, and offline usage.
  - **Issue**: Playwright not configured, E2E tests are placeholders only
- [ ] **Test multi-provider sync scenarios**, including conflicts and error states.
  - **Issue**: Multi-provider tests are mostly mocked/skipped

---

## 📚 Future Enhancements (Post-MVP)

### ⚠️ Additional CloudAdapters **MIXED STATUS**
- [x] **Implement `DropboxAdapter`** with OAuth2 and file operations.
  - **Status**: Implemented but not thoroughly tested
- [x] **Implement `OneDriveAdapter`** via the Microsoft Graph API.
  - **Status**: Implemented but not thoroughly tested  
- [x] **Implement `LocalFilesystemAdapter`** using the File System Access API.
  - **Status**: Core implementation complete but has service worker compatibility issues
  - **Issue**: File System Access API not available in service worker context
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
