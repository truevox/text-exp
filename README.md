# PuffPuffPaste - Chrome Extension Requirements Document

## Scope and Goals

**Blow up your words!** PuffPuffPaste is a powerful text expansion Chrome extension that streamlines repetitive typing for individuals and teams. This extension will allow users to define shorthand **snippets** that expand into longer text or images, with support for dynamic placeholders and shared snippet libraries. Key objectives include:

- **Time Savings & Consistency:** Automate insertion of frequently used text (emails, greetings, signatures, etc.) to save time and maintain consistency
- **Collaboration:** Enable teams to share common snippet libraries via Google Drive so everyone uses up-to-date templates (e.g. shared email replies, responses)
- **Personalization:** Allow user-specific expansions where needed (e.g. a common trigger like `;pw` expands to each user's own password or code)
- **Dynamic Content:** Support fields - i.e. placeholders that prompt the user to input custom values at expansion time (e.g. `;sal` → "Dear <name>", prompts for the name)
- **Rich Text & Images:** Allow snippets to include formatted text and inline images (e.g. inserting a logo or GIF signature). The extension should handle combined text+image content as a single snippet
- **Seamless Sync & Offline Use:** Snippet data is primarily stored in Google Drive for easy editing and sharing, but the extension will cache data locally so that expansions work offline (an essential requirement for MVP). Syncing with Drive should happen in the background (frequently but unobtrusively) without delaying any text expansion action
- **Maintainability & Flexibility:** Snippet storage will use a human-readable format (JSON, XML, or HTML) for easy manual editing and version control. The design should be flexible to support alternative storage backends in the future (e.g. local-only storage or other cloud services) without significant changes to the core logic
- **Non-intrusive UX:** The extension must feel "not annoying" - minimal UI interference with the user's normal typing, smart handling of edge cases (so it doesn't expand at the wrong time), and lightweight footprint on web pages

## User Stories

As a user, I want...

### Basic Text Expansion
- To define a shortcut like `;gb` that automatically expands into a longer phrase (e.g. typing `;gb` turns into "Goodbye!") for faster typing of repetitive text

### Custom Shortcuts
- To choose my own snippet abbreviations (with a special prefix so they don't trigger during normal typing). For example, I might use a semicolon prefix as it's easy to hit and unlikely to appear in normal words

### Dynamic Snippets
- To include placeholders in a snippet that ask me for input when I use it. For example, I create a snippet `;intro` for an introduction email: "Hello {name}, it was great meeting you at {event}." When I type `;intro`, I want the extension to prompt me to fill `{name}` and `{event}` before inserting the full text

### Image Insertion
- To have certain shortcuts insert images or mixed media. For example, typing `;logo` could insert my team logo image into an email. If a snippet contains both text and images in my source file, the extension should insert both together, preserving formatting

### Personal and Shared Snippets
- To maintain my own personal snippets and use shared team snippets. On first setup, I want to authenticate with Google Drive and select:
  - A personal snippets folder/file (for my private snippets), and
  - A shared snippets folder (for team-wide text templates)

### Team Overrides
- To support cases where the team uses the same snippet trigger but with personal variations. For example, our team has a standard trigger `;pw` for "password", but when my colleague Carrie types `;pw`, it should insert her password (e.g. "Stella3"). This means the snippet system must allow a common trigger that maps to different content per user

### Snippet Sync
- To have my snippets automatically sync across devices and for all shared users. If I edit a snippet in the Google Drive folder (or if a teammate updates a shared snippet), I want the changes to reflect in my snippets immediately. Importantly, this sync should not interrupt my work - it should happen in the background and cache data locally for offline use

### Fast, Offline Performance
- To have my snippets work instantly and offline. Once my snippet libraries are synced, I expect no noticeable lag when I type a shortcut, even if I have no internet connection

### Preview for Images
- If a snippet will insert a large block of text or an image, it would be nice (optional) to see a small preview or confirmation before it inserts, so I can be sure I'm inserting the right content (especially if I have many snippets)

### Snippet Management
- An easy way to view and manage my snippets. Ideally, I can edit them directly in Google Drive (e.g. in a Google Doc or a JSON file) for convenience. The extension should also provide a simple UI (like an Options page or popup) to:
  - Re-authenticate or change my linked Google Drive folders
  - See a list of my loaded snippets, maybe with a search/filter
  - Possibly create or edit snippets on the fly (MVP could defer heavy editing UI in favor of Drive editing)

### No Accidental Expansion
- Confidence that snippets won't expand at the wrong time. For example, if I'm typing something that coincidentally matches a snippet trigger inside a larger word or in a context like a password field, the extension should either not expand or have an easy way to undo the expansion (e.g. pressing Escape key or Ctrl+Z, or just undo in text editor)
- I should also be able to temporarily disable expansion (e.g. via a hotkey or clicking the extension icon) if I need to type the raw shortcut text.

### Minimal Intrusion
- The extension should run quietly in the background. Other than the snippet expansion functionality, it should not significantly alter my browser experience or slow down web pages. It should not, for example, add heavy UI elements on every page. Any UI for prompts or previews should be lightweight and only appear when needed (such as a small tooltip or dialog near the text field when a snippet is triggered)

## Technical Architecture

![Architecture Diagram - High-level architecture of the Chrome extension, showing how snippet data flows from multiple cloud providers through the unified CloudAdapter interface to the extension and into web pages.]

At a high level, the extension will consist of a **background script (service worker)**, one or more **content scripts**, and possibly a **popup/options page** for settings. The architecture is built around a **unified CloudAdapter interface** that abstracts cloud provider interactions and supports **multi-scope synchronization** ("Org Mode").

### CloudAdapter Pattern: Unified Cloud Integration

The **CloudAdapter** is a foundational JavaScript interface that abstracts away individual cloud provider SDKs, enabling:

- **Provider Isolation:** Keeps cloud-specific code in separate, pluggable modules
- **Unified Sync Engine:** Single sync mechanism supports multiple cloud services
- **Easy Extension:** New cloud providers can be added without touching core logic
- **Browser-Only:** Runs entirely client-side—no server, no proxy, no middleman
- **Maintainability:** Clean separation of concerns and testable components

#### Multi-Scope Sync Architecture ("Org Mode")

The extension supports three independent snippet scopes, each synchronized from separate cloud folders:

| Scope | Description | Ownership/Control |
|-------|-------------|------------------|
| **personal** | User's private snippets folder | User-chosen |
| **department** | Team/group shared folder | Admin-assigned |
| **org** | Organization-wide snippets | Globally managed |

Each scope represents a separate folder synced independently, then merged non-destructively into a unified snippet library for expansion.

### CloudAdapter Interface Specification

Every CloudAdapter implementation must provide:

```typescript
interface CloudAdapter {
  // 🔐 Authentication
  signIn(): Promise<void>              // OAuth flow via chrome.identity
  isSignedIn(): boolean                // Check credential validity
  getUserInfo(): Promise<UserInfo>     // User ID/email for UI
  
  // 📁 Folder Selection  
  selectFolder(): Promise<void>        // Picker or manual folder ID
  getSelectedFolderInfo(): Promise<FolderInfo>  // Folder metadata
  
  // 🔄 Change Tracking
  listFiles(): Promise<CloudFile[]>    // Current folder contents
  listChanges(sinceCursor?: string): Promise<CloudChange[]>  // Delta sync
  getDeltaCursor(): Promise<string>    // Checkpoint for resumption
  
  // ⬇️ File Access
  downloadFile(fileId: string): Promise<Blob>  // File content retrieval
  getFileMetadata(fileId: string): Promise<FileMetadata>  // Name, size, modified
  
  // ⬆️ Upload Support (Optional - MVP focuses on read-only)
  uploadFile?(path: string, blob: Blob): Promise<void>
}
```

#### SyncedSource Objects

Each synchronized folder is represented as a `SyncedSource`:

```typescript
interface SyncedSource {
  name: 'personal' | 'department' | 'org'
  adapter: CloudAdapter
  folderId: string
  displayName: string
}
```

All synced sources merge into a single active snippet set with configurable priority rules (personal > department > org by default).

#### Supported Cloud Providers

The CloudAdapter architecture supports multiple cloud storage backends:

- ✅ **GoogleDriveAdapter** - via Google Drive API v3 and gapi.client
- ✅ **DropboxAdapter** - via Dropbox SDK for JavaScript  
- ✅ **OneDriveAdapter** - via Microsoft Graph API or File Picker
- 🔄 **BackblazeAdapter** - via AWS SDK v3 to B2 S3-compatible endpoint
- 🧪 **ExperimentalRcloneAdapter** - via wasm-compiled rclone (research)

### Data Storage and State Management

The extension maintains several categories of data in different storage locations:

| Data Type | Storage Location | Purpose |
|-----------|-----------------|----------|
| **Auth tokens** | `chrome.storage.local` (per provider) | OAuth credentials, refresh tokens |
| **Selected folders** | `chrome.storage.sync` | Folder IDs sync across browsers |
| **Snippet content** | Extension FileSystem API / IndexedDB | Downloaded snippet data for offline use |
| **Sync cursors** | Local storage (namespaced) | Delta sync checkpoints per adapter/folder |

**Privacy & Security:** All data stays local and private—no remote servers, no telemetry. OAuth credentials only communicate with official cloud provider endpoints.

### Snippet Storage Format

Each snippet library uses a human-readable **JSON format** for maintainability and version control:

**Example personal_snippets.json:**
```json
{
  "snippets": [
    {
      "trigger": ";gb",
      "content": "Goodbye!",
      "type": "text",
      "scope": "personal"
    },
    {
      "trigger": ";intro",
      "content": "Hello {name}, it was great meeting you at {event}!",
      "type": "text",
      "placeholders": [
        {"name": "name", "prompt": "Person's name"},
        {"name": "event", "prompt": "Event name"}
      ]
    }
  ]
}
```

### Background Service Worker Architecture

The **background script** coordinates multi-provider synchronization:

1. **Multi-Provider Sync:** Manages authentication and sync for each configured CloudAdapter
2. **Scope Coordination:** Handles personal, department, and org-level folder synchronization
3. **Conflict Resolution:** Merges snippets from multiple sources with configurable priority
4. **Change Detection:** Uses provider-specific delta APIs for efficient updates
5. **Local Caching:** Stores merged snippet database in `chrome.storage.local` for offline access
6. **Background Sync:** Periodic sync without blocking snippet expansion

### Sync Engine and Offline Operation

The **SyncManager** coordinates all CloudAdapter instances:

```typescript
interface SyncManager {
  // Multi-provider coordination
  registerAdapter(scope: ScopeType, adapter: CloudAdapter): void
  syncAll(): Promise<SyncResult[]>
  syncScope(scope: ScopeType): Promise<SyncResult>
  
  // Merged snippet access
  getActiveSnippets(): Promise<Snippet[]>
  resolveConflicts(snippets: Snippet[]): Snippet[]
}
```

**Offline-First Design:**
- ✅ **Instant Expansion:** Snippets expand immediately from local cache
- ✅ **Background Sync:** Cloud sync happens asynchronously without blocking
- ✅ **Offline Capability:** Full functionality without internet connection
- ✅ **Conflict Resolution:** Smart merging when multiple sources have same triggers

**Two-way Sync (Future):** While MVP focuses on read-only sync, the architecture supports bidirectional updates where users can edit snippets via the extension UI and push changes back to appropriate cloud folders.

### Content Scripts and Expansion Engine

The **content script** handles real-time trigger detection and snippet expansion:

**Core Responsibilities:**
- **Universal Monitoring:** Listens for keystrokes in all text input contexts
- **Trigger Detection:** Monitors for configured prefixes (default `;`) using efficient state machines
- **Context Awareness:** Handles various input types (input, textarea, contenteditable, rich editors)
- **Smart Replacement:** Performs in-place text substitution without disrupting surrounding content
- **Placeholder Processing:** Manages dynamic content with user input prompts

**Architecture Integration:**
- **Unified Snippet Access:** Queries merged snippet database from background script
- **Scope Awareness:** Can display snippet source (personal/department/org) in expansion UI
- **Offline Capability:** Works entirely from local cache, no cloud dependencies during expansion

### Performance & Modern Architecture

**Lightweight Design:**
- **Efficient Trigger Detection:** O(1) snippet lookup using optimized data structures
- **Minimal Keystroke Processing:** Only monitors for prefix characters to reduce overhead
- **Smart Context Detection:** Avoids expansion in password fields and sensitive contexts
- **Manifest V3 Compliance:** Service worker architecture with automatic suspension when idle

**Multi-Provider Efficiency:**
- **Unified Caching:** Single lookup table for all scopes and providers
- **Background Sync:** All cloud operations happen asynchronously without blocking expansion
- **Delta Sync:** Only downloads changed files using provider-specific change APIs
- **Intelligent Merging:** Conflict resolution happens once during sync, not during expansion

### Image and Rich Content Support

The CloudAdapter architecture enables sophisticated content handling:

- **Multi-Format Support:** Text, HTML, images, and mixed content snippets
- **Cloud-Agnostic Storage:** Images stored alongside snippets in any supported cloud provider
- **Offline Image Cache:** Images downloaded and cached locally for offline access
- **Smart Insertion:** Context-aware insertion for different editor types (plain text, rich text, contenteditable)

## CloudAdapter Implementation Roadmap

### How to Add a New CloudAdapter

1. **Implement the CloudAdapter interface** with provider-specific authentication and file operations
2. **Handle OAuth flow** using `chrome.identity.launchWebAuthFlow` for the provider's endpoints
3. **Implement change detection** using the provider's delta/webhook APIs when available
4. **Add provider registration** to the SyncManager configuration
5. **Create provider-specific UI** for folder selection (picker or manual ID input)
6. **Write comprehensive tests** covering authentication, sync, and error scenarios

### Current Implementation Status

| Provider | Auth | Folder Selection | File Sync | Change Detection | Status |
|----------|------|------------------|-----------|-----------------|--------|
| Google Drive | ✅ | ✅ | ✅ | ✅ | **Complete** |
| Dropbox | 🔄 | 🔄 | ⏳ | ⏳ | *In Progress* |
| OneDrive | ⏳ | ⏳ | ⏳ | ⏳ | *Planned* |
| Backblaze B2 | ⏳ | ⏳ | ⏳ | ⏳ | *Research* |

## Core Logic and Data Models

### Snippet Data Model
We will design a structured format for snippet definitions that can accommodate rich text, images, and placeholders. In JSON, a snippet object might look like:

```json
{
  "trigger": ";gb",
  "content": "Goodbye!",
  "type": "text",
  "placeholders": []
}
```

For a snippet with placeholders or special features, for example `;intro` (introduction email template with dynamic name/event):

```json
{
  "trigger": ";intro",
  "content": "Hello {name}, it was great meeting you at {event}.\nLet's stay in touch!",
  "type": "text",
  "placeholders": [
    {"name": "name", "prompt": "Person's name"},
    {"name": "event", "prompt": "Event name"}
  ]
}
```

If we support **rich text or HTML**, the `content` might contain HTML markup or a structure for formatted text. For instance, a snippet with an image:

```json
{
  "trigger": ";logo",
  "content": "<p>Best Regards,<br><img src=\"https://drive.google.com/uc?export=download&id=<FILE_ID>&export=download\" alt=\"Logo\" width=\"200\" /></p>",
  "type": "html",
  "placeholders": []
}
```

In the above, we imagine the image is stored on Drive and we use a shareable link or Drive's `uc?export=download` URL with the file's ID. (Alternatively, during sync we might fetch the image file and convert it to a base64 data URL for offline use.) For offline content could also be stored as rich text in a structure, but using HTML as the interchange makes it easier to insert into contenteditable.

### Snippet Library Structure
For **personal vs shared snippets**, there are a few strategies:

- **Maintain separate lists** internally, and on expansion check personal first then shared. If the same trigger is in both, the personal version could override (to allow personal customization of a team snippet)
- **Alternatively, merge into one list** but mark the source. We might merge at sync time with a simple rule: personal snippets override shared ones on trigger conflicts
- **For user-specific variations** of a shared trigger (like `;pw` example), one approach is to not treat it as a conflict but as a feature. The shared library might include an entry for `;pw` that is basically a pointer to "user-specific content". Practically, it may be simpler that each user just defines `;pw` in their personal file (overriding the team entry or fulfilling a team-defined placeholder requirement)

We will implement merging logic such that after sync, we have a unified map of `trigger -> snippet content`. The merging algorithm:

- Load shared snippets list
- For each snippet in the personal list, if its trigger matches one in the shared list, either override it (use personal content instead) or, if we want to allow both, perhaps rename/namespace (but override is cleaner for expected behavior)
- All unique personal snippets are added
- The result is one combined snippet table for expansion lookups

### Dynamic Placeholder Handling

The CloudAdapter architecture supports sophisticated placeholder processing across all cloud providers:

**Placeholder Syntax:**
- Standard format: `{placeholder}` with optional descriptions
- Snippet metadata includes placeholder definitions with prompts
- Support for default values and validation rules

**Cross-Provider Compatibility:**
- Placeholders work identically regardless of cloud storage backend
- Consistent user experience across personal, department, and org snippets
- Smart merging handles placeholder conflicts between scopes

**Advanced Features:**
- Special tokens like `{cursor}` for post-expansion cursor positioning
- Date/time macros that work offline
- Conditional placeholder logic for complex snippets

### Trigger Detection & Expansion Logic
We will likely implement a **trie or automaton** for detecting snippet triggers as the user types, especially to handle **overlapping triggers**. For example, if there's `;a` and `;addr` as separate snippets, and the user types `;addr`, a naive approach might prematurely expand on `;a`. We need to detect the longest possible match. This is a known issue in other text expanders, and solutions include waiting for a short delay or using delimiters. Our approach:

- Use a prefix character and, for all shortcuts to clearly distinguish them
- Once `;` is typed, collect subsequent characters until a breaking character (space, punctuation, newline) or until a certain time gap. If the user quickly types `;addr` and then a space, we recognize `;addr` if it exists. But if they pause after `;a` without breaking, we might wait briefly to see if more characters are coming (to allow longer snippets). We can adopt that for simplicity: e.g. user types `;addr` then hits Space, content script intercepts the space, expands `;addr` to full address text, and then inserts a space after the expansion text

Alternatively, require an explicit terminator key (like pressing Space or Enter) to trigger expansion). Many text expanders works this way. The user types the shortcut and hits a key (Enter or Tab that indicates "expand now").

The content script logic will carefully replace text so as not to disrupt the surrounding text. In a plain text field, we may need to use `document.execCommand('insertHTML', ...)`; if not available, try using DOM ranges. In a rich text editor or contenteditable area (Gmail compose, Google Docs), the content script can insert HTML nodes (for formatted text/images) at the care position.

### Multi-Provider Offline Architecture

The CloudAdapter system provides robust offline functionality:

**Unified Local Cache:**
- Single cached database merges snippets from all configured cloud providers
- IndexedDB storage handles large snippet libraries with images
- Automatic cache invalidation based on cloud provider change detection

**Scope-Aware Caching:**
- Personal, department, and org snippets cached independently
- Conflict resolution happens during sync, not during expansion
- Priority-based merging ensures consistent behavior offline

**Sync State Management:**
- Per-provider sync cursors track incremental changes
- Failed syncs retry automatically with exponential backoff
- Graceful degradation when specific providers are unavailable

### Security & Privacy Considerations

**Multi-Provider Security:**
- Each CloudAdapter handles OAuth tokens independently via Chrome's identity API
- No credentials shared between providers or sent to third-party servers
- Provider-specific permission scopes minimize access to only necessary files

**Content Security:**
- HTML sanitization prevents script injection from any cloud provider
- Consistent security policies across all snippet sources (personal, department, org)
- Warning system for sensitive content in shared organizational snippets

**Privacy by Design:**
- All snippet content processed locally in the browser
- No telemetry or usage data sent to external servers
- Cloud providers only see standard OAuth API calls, not snippet content
- Users maintain full control over which folders each scope can access

## UX and Design Ideas

Designing a smooth user experience is crucial so that the extension feels powerful but not annoying. Here are some UX ideas and workflows:

### Initial Setup Flow
When the user first installs the extension, they should be guided through a one-time setup.

### Welcome Screen
Explains the benefit (save time with snippets) and that they can sync snippets via Google Drive.

### Google Sign-In
A button to "Connect to Google Drive." This triggers OAuth; the extension requests appropriate Drive scopes (minimum needed, e.g. access to files the user opens with the picker or specific folder).

### Folder Selection
After auth, the extension can use the Google Drive Picker API or a manual input for folder IDs. The user selects their **Personal Snippets** folder/file (or creates a new one from a template), and optionally selects a **Shared Snippets** folder (this could be optional if they have no team library). We should allow the user to skip shared library setup if not needed.

### Confirmation
The extension confirms how many snippets loaded, etc. and then advise the user on how to use the triggers (e.g. "Type `;` followed by your snippet abbreviation to use a snippet. You can customize the prefix in settings.").

### Using Snippets (UX)
We choose a default prefix like `;` for snippet triggers (based on common conventions). The user can change the prefix (e.g. `/` or `//` or `;;` etc.). All snippet abbreviations should include this prefix to prevent accidental expansion during normal typing.

As the user types, when the content script detects a known snippet trigger, a subtle **visual cue** could be provided. For example:

- While typing the snippet abbreviation (before pressing space), the extension could show a small tooltip near the caret with the snippet name or a preview of what will be inserted. This is similar to an autocomplete suggestion. It reassures the user that an expansion is recognized. (This could be a stretch goal feature if complexity is high; not strictly needed for MVP.)
- Once the user completes the trigger and presses the triggering key (e.g. Space or Enter), the snippet expands in place. A brief highlight or a "pop" sound (like TextExpander does) could be given as feedback to confirm the expansion happened, though this must be lightweight. **If the snippet has placeholders, the expansion sequence should immediately finalize.** Instead:
  - The snippet content (with placeholders) might appear with the first placeholder highlighted for typing. E.g. user types `;intro` + Space, the text "Hello <name> ..." is inserted but `<name>` is highlighted and in focus. The user types the name, and perhaps presses Tab to move to the next placeholder (`<event>`), types the event, then presses Enter to finalize. The placeholders could be replaced by the provided values.
  - Alternatively, a **popover form** appears containing labeled fields: "Name: [ ], Event: [ ]." The user fills both and hits Insert. This method might be more reliable if the target field is not rich text (some text input fields wouldn't allow the token approach nicely). The popover can be a small floating div near the snippet trigger location.

### Simpler UX Dialogs
**For each placeholder)** This is easy but not a great UX (multiple modal dialogs). A custom inline form is preferred for polish.

### For Image Snippets
The UX could be:

- If the snippet is just an image (e.g. `;logo` only inserts an image), maybe no special prompt - it just inserts the image element. Perhaps after insertion, if the image was large, the extension could briefly outline it or allow preview/resize (though resizing likely handled by the contenteditable host, e.g. Gmail allows dragging to resize images).
- If we want preview when user types `;logo` (without pressing space yet), show a tiny thumbnail above the typed text to preview the image. Then space confirms insertion. This is nice-to-have; MVP can skip direct preview and trust the user's memory of their snippets.

### Managing Snippets (UX)

The expectation is that many users will manage snippet content in Google Drive (like editing the JSON or doc directly). This is powerful for collaboration - e.g. a team leader updates the shared Google Doc of snippets, and all users get synced.

However, the extension should also provide basic management for convenience:

- An extension **Options page** listing all loaded snippets. This list could allow filtering/searching by trigger or content (some text expanders offer a hotkey to list snippets).
- Possibly allow adding, editing or deleting snippets via the Options page. For MVP, editing here might just update the local cache and update the file on Drive. Care must be taken to update the correct source (personal vs shared). For example, if a user tries to edit a shared snippet via the extension, perhaps they lock or handle concurrent edits, but given Drive's versioning, and one might lock or handle conflicts, but could be addressed similarly to personal vs shared priority rules.
- Each snippet entry in the list could show its trigger, an excerpt of content (or icon if an image), and which library it came from (personal vs shared).
- A button to "Open in Drive" could be provided - this would launch the web link to the snippet file (or folder) for advanced editing or sharing settings.

### Users should have the ability to configure snippet behavior:
- Change the trigger prefix character.
- Set whether expansion happens on 'space' (or other delimiters) vs immediately (some expansions might allow automatic expansion as soon as the trigger pattern is uniquely identified, but that can be tricky; the safest default is expansion on space/punctuation).
- Toggle whether expansion works on a given site or code editors or specific web apps (if conflicts arise).
- Hotkey to temporarily disable/enable expansions (like a "suspend" mode if you need to type literal shortcut text).

### Visual Design
The extension's UI elements (like the options page or any popovers) should be clean and simple.

- Options page can be a simple HTML page with a list and forms, not necessarily needing a heavy framework. A clean settings panel using standard Chrome styles or Material design for consistency.
- The snippet prompt popovers or tooltips should be lightweight (maybe plain div with minimal styling) to avoid jarring the user.
- If we indicate snippet expansions inline (like showing the snippet name while typing), perhaps a subtle grey italic text overlay could appear just after the typed shortcut (similar to an autocomplete suggestion).

### Feedback and Fail-safes
- If an expansion happens and it wasn't desired (false trigger), users should be able to undo it easily. One design: after expansion, if the user presses Ctrl+Z or Command+Z, the content script could intercept that (perhaps re-inserting the original shorthand). This might integrate with the page's undo if possible.
- If a snippet file wasn't fetched (e.g. user is offline and image wasn't cached), the extension could insert a placeholder text like "[Image not available]" rather than nothing, so the user knows something was supposed to be there. It could also notify the user via a small toast that an image snippet couldn't be inserted due to offline (though ideally, we cache images in advance to avoid this).
- In case of Google Drive sync issues (token expired, etc.), the extension should notify the user (via badge icon or popup) that it needs re-authentication, but still use the last known snippets.

## Potential Edge Cases

### Overlapping Triggers
Snippet triggers that are prefixes of other triggers (e.g. `;addr` and `;ad`) need careful handling. The system should check the longest match or require a delimiter to decide. Our plan is to use delimiters (space, punctuation) to delineate triggers, preventing mid-word expansion. Overlapping shortcfcuts can exist and work because we won't expand until a delimiter or explicit trigger key is pressed, at which point the exact typed sequence is known.

### Accidental Triggers in Words
If the prefix character is used in normal writing (e.g. someone types a winky emoticon `;)` or a semicolon in code), we must ensure it doesn't trigger expansions. Solutions: only expand if preceded by whitespace or beginning of field), or let users customize a prefix that they won't use otherwise. Also, we might require a non-alphanumeric immediately after the prefix as part of trigger (so `;a` will trigger but `;` at end of a sentence or emoji `;)` doesn't accidentally match a snippet).

### Field Types
In `<input type="password">` fields, the extension will **not run expansions** for security. Additionally, some fields (like contenteditable divs in web apps) may have their own keyboard handlers that conflict. Possibly allow disabling on problematic sites.

### Large Snippet Content
If a snippet contains multiple paragraphs or a large image: **Performance:** inserting a large HTML chunk could be slow or cause a visible blip. We should insert at once and minimize flicker if possible.

### Cursor placement
After inserting a multi-line snippet, ideally the cursor ends up at a logical position (e.g. at the end of the insertion). The extension can handle this by setting the selection range if in a text area of input field, or by adjusting caret position in contenteditable. A cursor placement token (like `[[CURSOR]]` in content gets replaced by a position, similar to TextExpander's approach.

### Scrolling
If the snippet is bigger than the input visible area, we may need to scroll the view to show the inserted content. The content script could request the page to focus the insertion end or so.

### Concurrent Editing and Sync
If a user edits the snippet Drive file at the same time the extension is syncing, or if two users edit a shared snippet concurrently (rare for MVP). The worst case might be one edit overwrites the other - acceptable in early stages, and can be improved by finer-grained sync logic (e.g. using revisions IDs from Drive to detect conflicts), etc. This won't be handled in MVP.

### Authentication failures
Expired token or revoked Google Drive access - the extension should catch API errors and prompt the user to re-login. Until then, it uses cached data.

### Multiple Shared Libraries
Some users might want more than one shared snippet source (e.g. one for Team A, one for Team B). MVP may assume a single shared library, but could be addressed similarly to personal vs shared priority rules.

### Browser or Platform Differences
Since it's a Chrome extension, on Windows vs Mac keyboards there might be differences in available keys or IME inputs. We should test with different languages/keyboard layouts If chosen prefix always works. Also consider if the extension is later ported to Firefox (WebExtensions) - the architecture should allow that (avoid Chrome-specific APIs beyond identity, which has Firefox equivalents).

### Local Storage Limits
If using `chrome.storage.local`, we have generous space (unlike `storage.sync` which is limited). If snippet libraries become huge (thousands of snippets or many images), we should monitor size. Storing images as base64 could be heavy; maybe limit image caching to a certain size or count.

### Initial Delay
On first load, if the extension hasn't fetched Drive data yet, snippet expansion won't work. We should handle this by either showing a small default snippet (or a message) or quickly fetching in the background. Ideally, if a user somehow tries a snippet before data is ready, either nothing happens or we show "snippets loading..." notification. This should be rare and after initial install only.

### Snippets in Contenteditable Apps
Some web apps (like Google Docs, or an online code editor) might interfere with content script strategy. We may need to handle particular conflicted; for example, Google Docs might treat `;sb` specially if it has its own keyboard shortcuts. Edge case approach as fallback, simulated Ctrl+V with prepared content if direct insertion fails.

### User Privacy
The extension should not send snippet content anywhere except Google Drive. All expansion happens locally. If we include any analytics or error logging, we must not accidentally log snippet contents as they could be sensitive.

## Third-Party API and Library Recommendations

### CloudAdapter Dependencies

**Google Drive Integration:**
- Google Drive API v3 for file operations and change detection
- Google Picker API for user-friendly folder selection
- `gapi.client` library for authenticated API calls

**Multi-Provider Support:**
- **Dropbox:** Dropbox SDK for JavaScript with OAuth2 flow
- **OneDrive:** Microsoft Graph API or OneDrive Picker
- **Backblaze B2:** AWS SDK v3 configured for S3-compatible endpoints
- **Experimental:** WebAssembly rclone for universal cloud provider support

**Chrome Extension APIs:**
- `chrome.identity` - OAuth2 flows for all cloud providers
- `chrome.storage.local` - CloudAdapter configurations and auth tokens
- `chrome.storage.sync` - Selected folder IDs (sync across browsers)
- `chrome.runtime.sendMessage` - Background/content script communication
- `chrome.commands` - Keyboard shortcuts for snippet management

### CloudAdapter Architecture Benefits

This unified approach provides:
- **Consistency:** Same user experience regardless of cloud provider
- **Reliability:** Fallback options if one provider has issues
- **Future-Proof:** Easy to add new providers without architectural changes
- **Enterprise-Ready:** Department and org-level snippet management
- **No Vendor Lock-in:** Users can switch providers without losing functionality

### Libraries/Frameworks
We aim to keep the extension lightweight. A large framework isn't necessary for background or content scripts (plain JS with perhaps some utility libs is fine). But some libraries could be helpful:

### IndexedDB wrapper
If using IndexedDB for storage (especially if we want to store structured snippet data and blob images), a small library like **Dexie.js** could simplify operations. Dexie is lightweight and well-suited for offline caching.

### Templating Library
For processing snippet content with placeholders, a templating lib (like **Handlebars** or **Mustache**) could be used to replace placeholders with values. However, our use case is simple enough that find-replace (e.g. `content.replace(/{placeholder}/` might suffice. We could also use something like **Numjarks** (hypothetical) or any micro templating but likely overkill.

### Rich Text Editing
If we allow rich formatting in the extension options, using a library like **Quill** or **TipTap** could be heavy. Instead, we expect users to edit formatting in Google Docs or provide HTML in JSON. The extension just needs to insert the HTML. So no full editor library is needed for the extension itself MVP.

### UI Components
For any modals or popovers, a minimal approach using vanilla JS/HTML is fine. If we wanted to use a micro-library like **Preact** or **Lit** just for the options page. But given the simplicity of options forms, it's not strictly required.

### Third-Party Text Expander Services
Not a library, but worth noting we can draw inspiration from existing tools:

- **Text Blaze** (blaze.today) and **Auto Text Expander** extensions for Chrome - known to offer rich text and form fields. We won't copy code (likely proprietary), but their feature set guides what libraries we might need (e.g. Text Blaze likely has a custom parser for placeholders and rich text).
- **Snippet Buddy** was mentioned as supporting fields, dropdowns, etc., all within a free extension. While we can't mirror their technique, a similar functionality can be achieved with straightforward coding (no special library publicly known, likely custom code).

### Cross-browser Considerations
Although we're focusing on Chrome, we can keep an eye towards the WebExtensions standard:

- Avoid using Chrome-specific API calls that aren't supported in Firefox (most Chrome extension APIs are standardized to be largely compatible).
- If using manifest V3, Firefox is adding support for it too. So our extension could later be ported to Firefox and Edge with minimal changes. Libraries we use should be pure JS (which will work in any browser environment).

### Image Handling
If we want to auto-resize images or ensure they are small, a library like **Pica** (for resizing images client-side) might be useful, but likely not needed unless users put huge images and we want to scale them before insertion.

### Testing and CI Tools
For ensuring interoperability and we might include libraries for testing (like **Mocha/** **Chai** for unit testing our snippet logic, especially the parser for placeholders and the trigger detection state machine). This would not be part of the shipped extension but for development robustness.

In summary, the extension can largely be built with **vanilla JavaScript** and Chrome's extension APIs, while leveraging Google's APIs for Drive integration. The architecture emphasizes a clear separation between content scripts (UI/typing interaction) and the background (data sync and storage) to maintain a responsive user experience. By planning for offline capability and a flexible snippet data model, we ensure the tool will be reliable and easy to extend with more features (like additional cloud backends or more dynamic snippet functions) in the future.

## Overall Summary

This requirements document outlines a **CloudAdapter-driven architecture** that revolutionizes collaborative text expansion through:

**🏗️ Unified Architecture:**
- Single interface supporting multiple cloud providers (Google Drive, Dropbox, OneDrive, Backblaze B2)
- Clean separation between cloud operations and snippet expansion logic
- Extensible design for future provider additions

**👥 Multi-Scope Collaboration ("Org Mode"):**
- Personal snippets for individual productivity
- Department-level sharing for team coordination
- Organization-wide snippet libraries for enterprise consistency
- Smart conflict resolution and priority-based merging

**⚡ Performance & Reliability:**
- Offline-first design with local caching
- Background synchronization without blocking expansions
- Efficient delta sync using provider-specific change APIs
- Browser-only operation with no server dependencies

**🔒 Security & Privacy:**
- OAuth-only authentication directly with cloud providers
- No third-party servers handling user data
- Configurable permission scopes per provider
- Content sanitization and secure expansion contexts

Let's build a **flexible, powerful, and unobtrusive** text expander that scales from individual users to enterprise organizations while maintaining the natural typing flow users expect, whether online or offline, across any supported cloud storage backend.

### ASCII Flow Diagram

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Personal      │    │   Department    │    │   Organization  │
│   Snippets      │    │   Snippets      │    │   Snippets      │
│                 │    │                 │    │                 │
│ GoogleDrive     │    │ Dropbox         │    │ OneDrive        │
│ /personal/      │    │ /team-alpha/    │    │ /company-wide/  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CloudAdapter Interface                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │GoogleDrive  │  │   Dropbox   │  │  OneDrive   │   ...       │
│  │   Adapter   │  │   Adapter   │  │   Adapter   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SyncManager                                │
│  • Merge snippets from all sources                             │
│  • Resolve conflicts (personal > dept > org)                   │
│  • Cache unified snippet database locally                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Content Script                                │
│  • Monitor keystrokes for triggers                             │
│  • Expand snippets from unified cache                          │
│  • Handle placeholders and rich content                        │
└─────────────────────────────────────────────────────────────────┘
```

## Sources

1. Will Fanguy, "Text Expanders - Gist"
   - General overview of text expansion benefits, sharing via cloud, and advanced features

2. Reddit discussion on text expander extensions - Mention of Snippet Buddy features (placeholders, rich text) and handling overlapping shortcuts

3. Text Expander - Texpand - Apps on Google Play

4. How to access Google Drive API from Chrome extension running on non-Chrome browsers

5. Best Text Expander Chrome Extension: r/chrome_extensions

6. CloudAdapter Pattern - Inspired by adapter design patterns for cloud service abstraction

7. Chrome Extension Manifest V3 - Service worker architecture and modern extension development
