# CLAUDE-TODO.md

## 📋 Collaborative Text Expander Chrome Extension - Implementation Roadmap

### 🎯 Project Overview
Building a collaborative text expansion Chrome extension that streamlines repetitive typing for individuals and teams. The extension uses a **unified CloudAdapter architecture** to support multiple cloud providers (Google Drive, Dropbox, OneDrive, etc.) with **multi-scope synchronization** (personal, department, org-level snippets). Features include dynamic placeholders, rich content support, and enterprise-grade collaboration.

---

## 🚀 Phase 1: Foundation & Core Setup

### ✅ Project Infrastructure
- [ ] **Set up Chrome extension project structure with Manifest V3**
  - Create manifest.json with proper permissions
  - Set up directory structure (background/, content/, popup/, options/)
  - Configure Chrome extension APIs and scopes

- [ ] **Configure Vite build system for Chrome extension**
  - Install and configure Vite for Chrome extension bundling
  - Set up build scripts for development and production
  - Configure asset handling for images and other resources

- [ ] **Set up testing framework (unit, integration, e2e with Playwright)**
  - Configure Jest for unit tests
  - Set up Playwright for e2e testing in Chrome extension context
  - Create test utilities and helpers

### ✅ Authentication & Data Models
- [ ] **Implement CloudAdapter interface and multi-provider authentication**
  - Design unified CloudAdapter interface with TypeScript definitions
  - Implement GoogleDriveAdapter with OAuth2 via chrome.identity API
  - Create authentication state management for multiple providers
  - Set up provider registration system

- [ ] **Design and implement JSON schema for snippet data model**
  - Define snippet structure (trigger, content, type, placeholders)
  - Create validation for snippet data
  - Design personal vs shared snippet differentiation

---

## 🔧 Phase 2: Core Functionality

### ✅ Background Processing
- [ ] **Create background service worker with SyncManager for multi-provider sync**
  - Implement SyncManager to coordinate multiple CloudAdapter instances
  - Handle multi-scope sync (personal, department, org) with priority rules
  - Manage conflict resolution and snippet library merging
  - Implement delta sync using provider-specific change APIs

- [ ] **Implement local snippet cache using chrome.storage.local**
  - Design cache structure for offline access
  - Implement cache invalidation and updates
  - Handle storage limits and optimization

### ✅ Content Script Core
- [ ] **Implement basic content script for trigger detection and text expansion**
  - Create keystroke monitoring system
  - Implement basic text replacement logic
  - Handle various input field types (input, textarea, contenteditable)

- [ ] **Build trigger detection system with prefix handling (default ';')**
  - Implement prefix-based trigger detection
  - Handle delimiter-based expansion (space, punctuation)
  - Create trie/automaton for efficient trigger matching

- [ ] **Implement text replacement logic for various input types**
  - Handle plain text inputs and textareas
  - Support rich text/contenteditable areas
  - Manage cursor positioning after expansion

---

## 🎨 Phase 3: Advanced Features

### ✅ Dynamic Content
- [ ] **Create dynamic placeholder system with user input prompts**
  - Implement placeholder parsing ({name}, {event}, etc.)
  - Create input prompt UI (inline or popover)
  - Handle multi-field placeholder forms

- [ ] **Add support for image snippets and mixed text/image content**
  - Implement image insertion in various contexts
  - Handle image caching for offline use
  - Support mixed text/image snippet content

### ✅ Collaboration Features
- [ ] **Implement multi-provider two-way sync system**
  - Handle file operations across different CloudAdapter providers
  - Implement provider-agnostic change detection and conflict resolution
  - Support background sync without blocking expansion
  - Create scope-aware sync coordination (personal > department > org priority)

- [ ] **Build multi-scope merging logic for CloudAdapter architecture**
  - Implement three-tier priority system (personal > department > org)
  - Handle cross-provider snippet conflicts and user-specific variations
  - Create unified snippet lookup table from multiple CloudAdapter sources
  - Design SyncedSource object management

---

## 🖥️ Phase 4: User Interface

### ✅ Extension UI
- [ ] **Create extension options page for snippet management and settings**
  - Build snippet listing and search interface with scope indicators
  - Implement settings for trigger prefix, behavior, and provider selection
  - Add multi-provider folder management (Google Drive, Dropbox, OneDrive)
  - Create CloudAdapter status dashboard and provider switching

- [ ] **Create multi-provider onboarding flow ("Org Mode" setup)**
  - Design onboarding wizard for CloudAdapter selection
  - Implement provider-specific folder selection (Google Picker, Dropbox, OneDrive)
  - Handle three-scope setup (personal, department, org)
  - Create CloudAdapter configuration management

- [ ] **Build popup UI for quick snippet search and management**
  - Create snippet search and preview
  - Add quick actions for common tasks
  - Implement status indicators

---

## 🛡️ Phase 5: Polish & Hardening

### ✅ Edge Cases & Security
- [ ] **Handle edge cases (overlapping triggers, accidental expansion, etc.)**
  - Implement longest-match trigger detection
  - Handle partial trigger conflicts
  - Add undo/escape functionality

- [ ] **Implement security measures (password field exclusion, content sanitization)**
  - Exclude password and sensitive input fields
  - Sanitize HTML content to prevent XSS
  - Implement content security policies

- [ ] **Ensure robust offline functionality with cached data**
  - Test offline expansion behavior
  - Handle sync failures gracefully
  - Implement cache persistence strategies

---

## 🎯 Testing & Quality Assurance

### ✅ Test Coverage
- [ ] **Unit tests for trigger parser and expansion logic**
- [ ] **Integration tests for CloudAdapter interface implementations**
- [ ] **Multi-provider sync testing with conflict scenarios**
- [ ] **E2E tests using Playwright in Chrome extension context**
- [ ] **Performance testing for large snippet libraries across providers**
- [ ] **Cross-site compatibility testing**
- [ ] **CloudAdapter authentication flow testing**
- [ ] **Offline/online sync transition testing**

### ✅ Pre-launch Checklist
- [ ] **Version management (bump on every commit)**
- [ ] **Pre-commit hooks (linter, formatter, tests)**
- [ ] **GitHub Actions CI/CD pipeline**
- [ ] **Security audit and permissions review**
- [ ] **Performance optimization and memory profiling**

---

## 📏 CloudAdapter Architecture Implementation

### ✅ Core CloudAdapter Components
- [ ] **Implement CloudAdapter TypeScript interface**
  - Define authentication methods (signIn, isSignedIn, getUserInfo)
  - Define folder selection methods (selectFolder, getSelectedFolderInfo)
  - Define change tracking methods (listFiles, listChanges, getDeltaCursor)
  - Define file access methods (downloadFile, getFileMetadata)
  - Define optional upload support (uploadFile)

- [ ] **Implement SyncedSource management system**
  - Create SyncedSource object structure (name, adapter, folderId, displayName)
  - Implement scope-based organization (personal, department, org)
  - Handle provider-to-scope mapping and configuration

- [ ] **Build SyncManager coordination layer**
  - Implement registerAdapter and multi-provider coordination
  - Create syncAll and syncScope methods
  - Build conflict resolution with priority rules (personal > dept > org)
  - Implement getActiveSnippets with unified snippet access

### ✅ Data Storage Architecture
- [ ] **Implement multi-provider data storage system**
  - Auth tokens in chrome.storage.local (per provider)
  - Selected folders in chrome.storage.sync (cross-browser)
  - Snippet content in IndexedDB (offline access)
  - Sync cursors in namespaced local storage

### ✅ Provider-Specific Implementations
- [ ] **Complete GoogleDriveAdapter implementation**
  - OAuth2 via chrome.identity.launchWebAuthFlow
  - Google Drive API v3 integration
  - Google Picker API for folder selection
  - Drive Changes API for delta sync

---

## 📚 Technical Debt & Future Enhancements

### ✅ Future Features (Post-MVP)
- [ ] **Rich text formatting in snippet editor**
- [ ] **Snippet templates and categories**
- [ ] **Usage analytics and popular snippets**
- [ ] **Keyboard shortcuts for snippet management**
- [ ] **Multiple shared library support**
- [ ] **Snippet versioning and history**
- [ ] **Import/export functionality**
- [ ] **Browser sync for settings**

### ✅ CloudAdapter Implementation
- [ ] **Implement DropboxAdapter with OAuth2 and file operations**
- [ ] **Implement OneDriveAdapter via Microsoft Graph API**
- [ ] **Implement BackblazeAdapter with S3-compatible endpoints**
- [ ] **Research ExperimentalRcloneAdapter via WebAssembly**
- [ ] **Create CloudAdapter testing framework for all providers**
- [ ] **Implement provider-specific change detection APIs**
- [ ] **Add CloudAdapter documentation and developer guide**

### ✅ Technical Improvements
- [ ] **Optimize bundle size and loading performance**
- [ ] **Implement more sophisticated conflict resolution**
- [ ] **Add comprehensive error handling and user feedback**
- [ ] **CloudAdapter provider failover and redundancy**
- [ ] **Migration to newer Chrome extension APIs**

---

## 🎉 Success Metrics

- ✅ **Functionality**: All core text expansion features working reliably
- ✅ **Performance**: <100ms expansion time, minimal memory footprint
- ✅ **Reliability**: Works offline, handles sync errors gracefully
- ✅ **Usability**: Intuitive setup flow, non-intrusive operation
- ✅ **Collaboration**: Seamless shared snippet library management
- ✅ **Security**: No data leaks, proper permission handling

---

*Last updated: 2025-07-02*
*Project: Collaborative Text Expander Chrome Extension*
*TDD Approach: Write failing tests first, implement just enough to pass, refactor*