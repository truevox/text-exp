# PuffPuffPaste - A Chrome Extension for Text Expansion

## Scope and Goals

**Blow up your words!** PuffPuffPaste is a powerful text expansion Chrome extension that streamlines repetitive typing for individuals and teams. This extension will allow users to define shorthand **snippets** that expand into longer text or images, with support for dynamic placeholders and shared snippet libraries synced from the cloud.

Key objectives include:

- **Time Savings & Consistency:** Automate insertion of frequently used text (emails, greetings, signatures) to save time and maintain consistency.
- **Collaboration:** Enable teams to share common snippet libraries via cloud storage so everyone uses up-to-date templates.
- **Personalization:** Allow user-specific expansions and overrides for shared snippets.
- **Dynamic Content:** Support placeholders that prompt the user for input at expansion time.
- **Rich Text & Images:** Allow snippets to include formatted text and inline images.
- **Seamless Sync & Offline Use:** Snippet data is synced from cloud providers but cached locally for instant, offline access.
- **Maintainability & Flexibility:** The provider-agnostic **CloudAdapter** architecture makes it easy to support new cloud services.
- **Non-intrusive UX:** The extension should feel lightweight and "just work" without interfering with normal typing.

## Technical Architecture

![Architecture Diagram - High-level architecture of the Chrome extension, showing how snippet data flows from multiple cloud providers through the unified CloudAdapter interface to the extension and into web pages.](https://user-images.githubusercontent.com/12345/67890.png)

At a high level, the extension consists of a **background script (service worker)**, one or more **content scripts**, and a **popup/options page** for settings. The entire architecture is built around a unified **CloudAdapter** interface that abstracts cloud provider interactions and supports multi-scope synchronization ("Org Mode").

### The CloudAdapter Pattern: A Unified Cloud Interface

The **`CloudAdapter`** is a foundational JavaScript interface that abstracts away individual cloud provider SDKs. This pattern is the core of the extension's sync engine.

It enables:

- **Provider Isolation:** Keeps provider-specific code (e.g., Google Drive, Dropbox) in separate, pluggable modules.
- **A Unified Sync Engine:** A single, robust sync mechanism can support dozens of cloud services.
- **Easy Extensibility:** New cloud providers can be added without rewriting the core sync logic.
- **Serverless Operation:** The entire sync process runs **entirely inside the browser**—no server, no proxy, no middleman.
- **Maintainability & Testability:** The clean separation of concerns makes the codebase easy to maintain and test.

### Store Priority System (FILO - First In, Last Out)

The extension supports multiple snippet stores with a simple priority-based conflict resolution system. When the same trigger exists in multiple stores, the highest priority store wins.

**Priority System**:

- **Default Store**: Located at `/drive.appdata` - Always priority 0 (highest priority)
- **Additional Stores**: User-added stores get descending priority (1, 2, 3...)
- **FILO Ordering**: First store added = highest priority, most recent = lowest priority
- **Drag-and-Drop**: All store priorities are adjustable via the options screen
- **Deletion**: All stores except the default `/drive.appdata` store can be deleted

**Priority Only Affects**: Snippet selection when the recently typed text:

1. Completes one or more triggers, AND
2. Could be the first part of completing other triggers

In this scenario, the hovering snippet picker shows snippets ordered by store priority. Priority does nothing else - it's solely for disambiguation in the picker interface.

### The `CloudAdapter` Interface

Every adapter must implement the following interface to be compatible with the sync engine.

```typescript
interface CloudAdapter {
  // --- Authentication ---
  signIn(): Promise<void>;
  isSignedIn(): boolean;
  getUserInfo(): Promise<UserInfo>;

  // --- Folder Selection ---
  selectFolder(): Promise<void>;
  getSelectedFolderInfo(): Promise<FolderInfo>;

  // --- Change Tracking ---
  listFiles(): Promise<CloudFile[]>;
  listChanges(sinceCursor: string): Promise<CloudChange[]>;
  getDeltaCursor(): Promise<string>;

  // --- File Access ---
  downloadFile(fileId: string): Promise<Blob>;
  getFileMetadata(fileId: string): Promise<FileMetadata>;

  // --- (Optional) Upload Support ---
  uploadFile?(path: string, blob: Blob): Promise<void>;
}
```

#### Responsibilities:

- **Authentication:** `signIn()`, `isSignedIn()`, `getUserInfo()` handle the OAuth flow (using `chrome.identity.launchWebAuthFlow`) and credential storage.
- **Folder Selection:** `selectFolder()` and `getSelectedFolderInfo()` allow users to pick a folder to sync from.
- **Change Tracking:** `listFiles()`, `listChanges()`, and `getDeltaCursor()` power the efficient, delta-based sync, ensuring only new or modified files are downloaded.
- **File Access:** `downloadFile()` and `getFileMetadata()` retrieve snippet file content and metadata.
- **Upload Support (Optional):** `uploadFile()` is an optional method for future features that might allow editing snippets directly from the extension.

### `SyncedSource` Objects

Every folder connected to the extension is represented by a `SyncedSource` object, which pairs an adapter with a specific folder and scope.

```ts
interface SyncedSource {
  name: "personal" | "department" | "org";
  adapter: CloudAdapter;
  folderId: string;
  displayName: string;
}
```

All `SyncedSource`s are merged non-destructively into the active snippet set. In the future, this model will support conflict resolution and folder-level overrides (e.g., a `personal` snippet can override an `org` snippet with the same trigger).

### State and Data Storage

The extension stores all data locally and privately on the user's machine. **No servers, no telemetry.**

| Data                 | Storage Location           | Description                                                   |
| :------------------- | :------------------------- | :------------------------------------------------------------ |
| **Auth Tokens**      | `chrome.storage.local`     | Securely stored OAuth tokens, namespaced per provider.        |
| **Selected Folders** | `chrome.storage.sync`      | The IDs of the user's chosen folders, synced across browsers. |
| **Snippet Data**     | IndexedDB / FileSystem API | The downloaded snippet content, cached for offline access.    |
| **Sync Cursors**     | `localStorage`             | The last sync checkpoint, namespaced per adapter and folder.  |

### Implementation Roadmap

The `CloudAdapter` architecture makes it straightforward to add support for new cloud providers.

- [x] **Google Drive**
- [x] **Dropbox**
- [x] **OneDrive**
- [x] **Local File System** (via File System Access API)

A guide for "How to Add a New Adapter" will be added to the developer documentation.

### Offline and Privacy Guarantees

- **Offline-First:** The extension is designed to work **100% offline** after the initial sync. Snippet expansion is instantaneous and does not rely on a network connection.
- **Privacy by Design:** Snippet content **never leaves the user's device**. OAuth credentials are sent _only_ to the official cloud provider endpoints for authentication and are never exposed to any third-party server.

## ASCII Sync Flow Diagram

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Personal      │    │   Department    │    │   Organization  │
│   Snippets      │    │   Snippets      │    │   Snippets      │
│ (Google Drive)  │    │   (Dropbox)     │    │   (OneDrive)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                  CloudAdapter Interface                     │
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐       │
│ │ GoogleDrive   │ │    Dropbox    │ │   OneDrive    │ (etc) │
│ │    Adapter    │ │    Adapter    │ │    Adapter    │       │
│ └───────────────┘ └───────────────┘ └───────────────┘       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         SyncManager                         │
│  • Merges snippets from all sources                         │
│  • Resolves conflicts (personal > department > org)         │
│  • Caches the unified snippet database locally              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Content Script                        │
│  • Monitors keystrokes for snippet triggers                 │
│  • Expands snippets instantly from the local cache          │
│  • Handles dynamic placeholders and rich content            │
└─────────────────────────────────────────────────────────────┘
```

## 📄 Multi-Format Snippet Support

PuffPuffPaste supports multiple file formats for storing and organizing your snippets, giving you the flexibility to choose the format that best suits your workflow:

### Supported Formats

| Format         | Extension | Use Case                         | Example         |
| -------------- | --------- | -------------------------------- | --------------- |
| **JSON**       | `.json`   | API integration, bulk imports    | `snippets.json` |
| **Plain Text** | `.txt`    | Simple snippets, easy editing    | `greetings.txt` |
| **Markdown**   | `.md`     | Documentation, formatted content | `templates.md`  |
| **HTML**       | `.html`   | Email templates, rich content    | `emails.html`   |
| **LaTeX**      | `.tex`    | Academic writing, formulas       | `formulas.tex`  |

### Key Features

- **🔄 Automatic Format Detection** - Detects format based on file extension and content
- **📋 YAML Frontmatter** - Metadata support for all non-JSON formats
- **🔀 Dynamic Variables** - Placeholder support: `{name}`, `{company:Default Inc}`
- **🌐 Cloud Agnostic** - All formats work with any cloud provider
- **⚡ Performance Optimized** - Efficient parsing and caching

### Example: Markdown Snippet

```markdown
---
id: "meeting-template"
trigger: ";meeting"
description: "Meeting invitation template"
tags: ["email", "meetings"]
variables: ["attendee", "date", "time"]
---

## Meeting Invitation

Dear {attendee},

You're invited to our meeting on **{date}** at **{time}**.

Please confirm your attendance.

Best regards,
The Team
```

📖 **[View Complete Format Guide →](./FORMAT_GUIDE.md)**
