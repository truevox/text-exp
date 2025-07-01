# Collaborative Text Expansion Chrome Extension - Requirements Document

## Scope and Goals

The goal is to develop a **collaborative text expansion Chrome extension** that streamlines repetitive typing for individuals and teams. This extension will allow users to define shorthand **snippets** that expand into longer text or images, with support for dynamic placeholders and shared snippet libraries. Key objectives include:

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

![Architecture Diagram - High-level architecture of the Chrome extension, showing how snippet data flows from Google Drive to the extension and into web pages.]

At a high level, the extension will consist of a **background script (service worker)**, one or more **content scripts**, and possibly a **popup/options page** for settings. Key architectural components and data flow:

### Google Drive Integration
- The extension uses Google Drive as the primary cloud storage for snippet libraries. On first setup, the extension requests authentication via Google OAuth (using Chrome's `identity` API for a seamless OAuth2 flow). The user then selects (or provides IDs for) two locations in Drive:
  - **Personal Snippets Folder/File:** Only accessible by the user containing their private snippets
  - **Shared Snippets Folder/File:** A shared Drive location (e.g. a folder shared with a team) containing team snippets

### Snippet Storage Format
- Each snippet library (personal or shared) will be stored in a human-readable format on Drive. For maintainability, **JSON** is a strong candidate (e.g. a `snippets.json` file per user or group). JSON is easy to parse for the extension and easy to edit for users with technical skill. Alternatively, a Google Doc or Sheet could be used to allow non-technical editing:
  - **Option 1:** JSON files - e.g. `personal_snippets.json` and `team_snippets.json`. Each contains an array or object mapping triggers to snippet content and metadata
  - **Option 2:** Google Doc - e.g. a structured document where each snippet is listed (the extension would use Drive APIs to read and parse the document content)
  - **Option 3:** Google Sheet - with columns like "Trigger" and "Content" (and perhaps columns for dynamic fields and snippet-specific variations). The extension reads the sheet via the Sheets API

For MVP, JSON is likely simplest (structured, and can be cached for offline use easily). We will define a clear JSON schema for snippets (see **Data Models** below). The Google Drive API allows us to fetch file content as JSON; using Drive also means users can leverage Google Drive's sharing and versioning. **Background Script Service Worker:** This is the Chrome extension coordinator that handles data syncing and global events. On extension load (and periodically thereafter), the background script will connect to Google Drive (using stored OAuth credentials to fetch snippet data from Drive). It will retrieve both the personal and shared snippet files (or all files in designated snippet folders). Changes on Drive (e.g. if the user or a collaborator updated a snippet) will be detected by comparing timestamps or using the Drive Changes API. When changes are found, the background script pulls the latest data. The background script merges the personal and shared snippets into a unified in-memory **snippet database** (with logic to handle conflicts or user-specific overrides, see **Core Logic** below). It then stores this data in local storage (e.g. Chrome's `storage.local` or IndexedDB for persistence without requiring the background script to always be running).

### Local Snippet Cache and Two-way Sync
- The background script serves as the **local snippet cache**. The background script should also handle **two-way sync** if editing from the extension is allowed: e.g. if the user adds/edits a snippet via a popup UI (future feature), the background script would update the local cache and push changes to the appropriate Google Drive file. All Drive sync operations will be done in the background, asynchronously. Critically, **snippet expansion should never wait on a Drive request**. The extension will always use the local cached snippet data for expansions, while sync runs on a timed interval or Drive change notifications. This ensures a seamless, offline-capable user experience.

### Content Scripts
- The extension will inject a **content script** into pages, ideally all pages or specific domains as needed) that listens for user keystrokes in text input fields and editable areas. Responsibilities: **Trigger Detection:** As the user types, the content script monitors the text. It checks for snippet trigger patterns (e.g. a word starting with `;` or a predefined prefix followed by a termination character like space, Enter, or punctuation - this behavior can be configurable). For efficiency, it might track recently typed characters rather than scanning all text. **Verification & Expansion:** When a potential snippet trigger is detected, the content script verifies it against the snippet list (which it can get from the background script or have preloaded). This could be done via a quick message to the background (`is `;gb` a snippet?`) or by having the snippet list directly in content script memory. **In-place Replacement:** The content script will **replace the shorthand with the full expansion**. The replacement method depends on the context. In a plain `<input>` or `<textarea>`, the content script can simulate a series of backspaces to remove the trigger text, then insert the snippet text. In a rich text editor or contenteditable area (Gmail compose, Google Docs), the content script can insert HTML nodes (for formatted text/images) at the care position. **Dynamic Placeholder Prompts:** If the snippet requires user input (placeholders), the expansion will **pause** and request input. Implementation-wise, this could mean the content script sends a message to background or directly triggers a prompt UI component (either built-in with the extension bundle).

### Image Handling
- If a snippet includes an image, the content script might include a reference (like an image URL or a base64 string). The content script requires smart insertion. Since images will likely be stored as separate files (or embedded data) in the snippet, the content might include a reference to an image blob) is inserted. A preview step could be implemented: e.g. when the trigger is recognized, show a small thumbnail in the prompt UI, and only insert on confirmation. For MVP, images can insert directly to keep it simple, assuming the snippet content is trusted. **Context Awareness:** The content script should be smart about where it expands. It will not operate in sensitive fields like password inputs (to avoid security issues or unwanted expansions). It may also avoid expanding inside certain sites (if needed) or allow the user to blacklist certain sites. **Options/Settings Page:** The extension will include an Options page (or a popup) for configuration: Google Drive authentication status and an option to re-authenticate or switch accounts. Seeing (but likely limited snippets (possibly using the Google Picker API to let the user select a file/folder visually). Preferences such as the snippet trigger prefix character (default `;`), whether expansion occurs on space or immediately (some expansions might require a delimiter to avoid conflicts). A simple snippet management list - showing all snippet triggers and their content (read-only or with edit capabilities). For MVP, full editing might not be implemented (since users can edit the Drive files directly), but at least viewing or searching snippets would help usability. **Performance & Footprint:** The architecture is designed to minimize impact. Content scripts should be lightweight and avoid heavy work on every keystroke beyond checking a buffer of the last few characters against known triggers. We can optimize by only looking for the prefix character and, only if detected, accumulate the potential trigger text. The snippet list can be stored in a JavaScript object/dictionary for O(1) lookup by trigger. If many snippets are present, we might implement a trie or prefix match structure for efficiency, especially to handle overlapping triggers (see **Edge Cases**). All network calls (Drive sync) happen in the background and are infrequent (e.g. on startup, then maybe every X minutes or upon specific user actions). This avoids slowing down content script execution. The extension should be built on **Chrome Manifest V3** for modern standards (service worker based), which suspends when idle. We avoid persistent background pages for efficiency. The data can be persisted in `chrome.storage.local` or IndexedDB for persistence without requiring the background script to always be running.

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
The core logic for expansion will need to handle placeholders:

- We can identify placeholders in content by a syntax like `{placeholder}` or maybe `${placeholder}` syntax). The snippet data might include a list of placeholder definitions (with optional default values or descriptions as prompts)
- When the expansion is triggered, if placeholders exist, the expansion routine will **pause** and request input. Implementation-wise, this could mean the content script sends a message to background or directly triggers a prompt UI component (for simpler cases the content script bundle)
- After the user fills the values, the snippet content string is populated (simple find-and-replace of placeholders), and then the final string is inserted. Then the script inserts the snippet text with those placeholders replaced by the provided values

For a simple case of a single `{name}` placeholder, the UI could be inline like the extension could show a highlighted blank or `<name>` text selected, so the user can directly type the value in place. However, a more robust approach is an overlay form if multiple fields are needed. **Image Handling:** If a snippet includes an image, the snippet content might include a reference (like an image URL or embedded data). Since images will likely be stored as separate files (or embedded data) in the snippet, the content might include a reference like an image blob) is inserted. A preview step could be implemented: e.g. when the trigger is recognized, show a small thumbnail in the prompt UI, and only insert on confirmation. For MVP images can insert directly to keep it simple, assuming the snippet content is trusted.

We must also consider special placeholders like `{cursor}` (common in TextExpander) which indicate where the cursor should end up after expansion, or date/time macros, etc. These are advanced features and might be beyond MVP, but our data model could reserve some token for cursor placement if needed in future.

### Trigger Detection & Expansion Logic
We will likely implement a **trie or automaton** for detecting snippet triggers as the user types, especially to handle **overlapping triggers**. For example, if there's `;a` and `;addr` as separate snippets, and the user types `;addr`, a naive approach might prematurely expand on `;a`. We need to detect the longest possible match. This is a known issue in other text expanders, and solutions include waiting for a short delay or using delimiters. Our approach:

- Use a prefix character and, for all shortcuts to clearly distinguish them
- Once `;` is typed, collect subsequent characters until a breaking character (space, punctuation, newline) or until a certain time gap. If the user quickly types `;addr` and then a space, we recognize `;addr` if it exists. But if they pause after `;a` without breaking, we might wait briefly to see if more characters are coming (to allow longer snippets). We can adopt that for simplicity: e.g. user types `;addr` then hits Space, content script intercepts the space, expands `;addr` to full address text, and then inserts a space after the expansion text

Alternatively, require an explicit terminator key (like pressing Space or Enter) to trigger expansion). Many text expanders works this way. The user types the shortcut and hits a key (Enter or Tab that indicates "expand now").

The content script logic will carefully replace text so as not to disrupt the surrounding text. In a plain text field, we may need to use `document.execCommand('insertHTML', ...)`; if not available, try using DOM ranges. In a rich text editor or contenteditable area (Gmail compose, Google Docs), the content script can insert HTML nodes (for formatted text/images) at the care position.

### Local Cache & Offline
The snippet data (post-merge) will be stored in `chrome.storage.local` or an IndexedDB database) this serves as the **local snippet cache**. The background script should also handle **two-way sync** if editing from the extension is allowed: e.g. if the user adds/edits a snippet via a popup UI (future feature), the background script would update the local cache and push changes to the appropriate Google Drive file. All Drive sync operations will be done in the background, asynchronously.

This cache allows the extension to function offline indefinitely with the last known snippet data. If the user creates a new snippet on another device or edits a Drive file, merges might be needed at next sync for MVP we might assume low chance of complex conflicts (since typically one user or one location will update at a time).

### Security Considerations
- The extension will not expose Google credentials directly; it uses OAuth tokens managed by Chrome's APIs. Snippet content itself is not highly sensitive (except perhaps if users store things like passwords - we might warn against expanding sensitive info in the clear). Google Drive handles the storage security, and we respect the user's access only (only files the user selects)
- Expanding content from shared libraries means one user could put malicious content in a snippet that expands for others (e.g. a script tag or huge text). We should sanitize or plain-text any snippet content that will be inserted into a contenteditable to avoid injecting unwanted scripts. Likely, we treat snippet content as literal text/HTML to insert; if we allow HTML, we will strip `<script>` or other dangerous tags to avoid text expanders.
- The extension should also be careful not to expand inside `<input type="password">` or similar fields to avoid both security issues and useless behavior.

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

### Google Drive API
Utilizing the Google Drive REST API is essential for accessing snippet files. Specifically:

- Use the `files.get` endpoint to fetch the snippet file contents (as JSON or exported format). We might use the `alt=media` query to directly download the file content.
- Use the `changes.list` or simply poll file `modifiedTime` periodically to detect updates.
- Use Drive's file IDs (which we store after user selects) to reference the files. The extension will need the Drive scope (`drive.file` creates files, or `...auth/drive.readonly` if just reading existing files. Possibly `drive.appdata` if we choose to store in a hidden appdata file, but since we want user-accessible files, normal Drive scope is better.

### Google Picker API
For a nice file/folder selection, the Google Picker SDK can be used. This provides a UI to choose a file/folder from the user's Drive. It requires including the Google API script and some setup, Alternatively, we can let advanced users paste a folder ID to avoid adding this dependency for MVP.

### Chrome Extensions APIs
- `chrome.identity` for OAuth2 flow (Chrome will handle token retrieval and refresh, simplifying auth).
- `chrome.storage.local` for storing snippet data and user settings (unlimited-ish storage).
- `chrome.runtime.sendMessage` or `chrome.tabs.sendMessage` for communication between content scripts and background.
- `chrome.commands` if we add keyboard shortcuts (like a hotkey to open snippet search).

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

Overall, this requirements document outlines a feature-complete MVP that focuses on **core text expansion functionality**, collaborative sharing, and an intuitive user experience. With these specifications, we can move into design and implementation confident that the major use cases and challenges are well-understood. Let's build something flexible, powerful, and unobtrusive - a text expander that feels like a natural extension of the user's typing flow, whether they're online or offline, alone or collaborating with a team.

## Sources

1. Will Fanguy, "Text Expanders - Gist"
   - General overview of text expansion benefits, sharing via cloud, and advanced features

2. Reddit discussion on text expander extensions - Mention of Snippet Buddy features (placeholders, rich text) and handling overlapping shortcuts

3. Text Expander - Texpand - Apps on Google Play

4. How to access Google Drive API from Chrome extension running on non-Chrome browsers

5. Best Text Expander Chrome Extension: r/chrome_extensions
