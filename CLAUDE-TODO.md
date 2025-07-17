# CLAUDE-TODO.md

## 📋 Remaining Tasks - PuffPuffPaste Chrome Extension

### 🔄 **PERMANENT HIGH-PRIORITY TASK**

- [ ] **📝 ALWAYS move completed tasks to CLAUDE-TODONE.md!**
  - **Status**: Ongoing organizational requirement
  - **Priority**: HIGH - Essential for project documentation hygiene
  - **Action**: When any task is completed, immediately move it from this file to CLAUDE-TODONE.md
  - **Note**: This task should NEVER be marked as completed - it's a permanent process reminder

---

## 🚨 **CRITICAL DRIVE SCOPE & SNIPPET SYSTEM REQUIREMENTS** - **HIGH PRIORITY**

### 📦 **Appdata Usage Restrictions** - **HIGH PRIORITY**

- [ ] **Implement drive.appdata ONLY for user config and Priority #0 snippet store**
  - **Action**: Confirm with the developer what is currently being stored in drive.appdata. The dev may then direct you whether or not to add to it appdata usage to persistent configuration and a highest priority snippet store
  - **Requirements**: User config storage, Priority #0 (highest priority) snippet store only
  - **File**: `src/background/cloud-adapters/google-drive-appdata-manager.ts` (new)
  - **Priority**: HIGH - Drive scope compliance
  - **Time**: 45 minutes
  - **Sub-TODO**: [ ] **Build tests for appdata restrictions**
    - **File**: `tests/unit/appdata-manager.test.ts` (new)
    - **Time**: 30 minutes

### 🎯 **Enhanced Snippet Editor Requirements** - **HIGH PRIORITY**

- [ ] **Implement comprehensive snippet editor with all JSON fields support**
  - **Action**: Support ALL fields in larger JSON config with sane defaults
  - **Requirements**: Rich text WYSIWYG via TinyMCE, single snippet editing from multi-snippet JSON
  - **Features**: Hash-based ID generation on edit, metadata support, HTML storage format
  - **File**: `src/ui/components/comprehensive-snippet-editor.ts` (new)
  - **Priority**: HIGH - Core editing functionality
  - **Time**: 90 minutes
  - **Sub-TODO**: [ ] **Build comprehensive snippet editor tests**
    - **File**: `tests/unit/comprehensive-snippet-editor.test.ts` (new)
    - **Time**: 60 minutes


### 📂 **Multi-Store Selection & Duplicate Management** - **HIGH PRIORITY**

- [ ] **Implement same-screen store selection with duplicate detection**
  - **Action**: Show current stores, allow selection of target stores, detect duplicates via ID
  - **Requirements**: Edit duplicates across multiple stores simultaneously
  - **Features**: Visual representation of current stores, multi-store editing
  - **File**: `src/ui/components/multi-store-editor.ts` (new)
  - **Priority**: HIGH - Multi-store workflow
  - **Time**: 75 minutes
  - **Sub-TODO**: [ ] **Build multi-store editor tests**
    - **File**: `tests/unit/multi-store-editor.test.ts` (new)
    - **Time**: 45 minutes

### 🔒 **Read-Only Store Support** - **HIGH PRIORITY**

- [ ] **Implement read-only vs read-write snippet store support**
  - **Action**: Support both read-only and read-write stores throughout system
  - **Requirements**: Read-only snippets can be copied but not edited in original store
  - **Features**: Store permission detection, copy-to-writable workflow
  - **File**: `src/storage/store-permissions-manager.ts` (new)
  - **Priority**: HIGH - Store access control
  - **Time**: 50 minutes
  - **Sub-TODO**: [ ] **Build store permissions tests**
    - **File**: `tests/unit/store-permissions-manager.test.ts` (new)
    - **Time**: 35 minutes

### 🔍 **Duplicate Management & Expansion Logic** - **HIGH PRIORITY**

- [ ] **Implement duplicate snippet deduplication in expansion UI**
  - **Action**: Show duplicate snippets only once when showing multiple expansions
  - **Requirements**: Deduplicate by ID, show duplicates by trigger with priority ordering
  - **Features**: Priority-first then alphabetical sorting, usage tracking infrastructure
  - **File**: `src/content/expansion-deduplicator.ts` (new)
  - **Priority**: HIGH - User experience
  - **Time**: 40 minutes
  - **Sub-TODO**: [ ] **Build expansion deduplication tests**
    - **File**: `tests/unit/expansion-deduplicator.test.ts` (new)
    - **Time**: 30 minutes

### 📊 **Store Duplicate Prevention** - **HIGH PRIORITY**

- [ ] **Implement single-store duplicate ID prevention**
  - **Action**: Prevent duplicate snippet IDs within single store
  - **Requirements**: Allow duplicates between stores, prevent within store
  - **Features**: ID collision detection, store-level validation
  - **File**: `src/storage/store-duplicate-validator.ts` (new)
  - **Priority**: HIGH - Data integrity
  - **Time**: 30 minutes
  - **Sub-TODO**: [ ] **Build store duplicate validation tests**
    - **File**: `tests/unit/store-duplicate-validator.test.ts` (new)
    - **Time**: 25 minutes

### 📝 **HTML Storage Format Enforcement** - **HIGH PRIORITY**

- [ ] **Ensure all snippets stored as HTML in JSON files**
  - **Action**: Enforce HTML storage format for all snippets in JSON files
  - **Requirements**: Convert plaintext to HTML on save, maintain HTML format
  - **Features**: Format conversion, HTML validation, backwards compatibility
  - **File**: `src/storage/html-format-enforcer.ts` (new)
  - **Priority**: HIGH - Format consistency
  - **Time**: 35 minutes
  - **Sub-TODO**: [ ] **Build HTML format enforcement tests**
    - **File**: `tests/unit/html-format-enforcer.test.ts` (new)
    - **Time**: 25 minutes

### 🔗 **Unified Snippet Dependency System** - **HIGH PRIORITY**

- [ ] **Implement unified cross-store snippet dependency format**
  - **Action**: Enforce consistent "store-name:trigger:id" format for ALL dependencies
  - **Requirements**: Every dependency must specify store name, even same-store references
  - **Features**: Unified parsing, cross-store resolution, consistent validation
  - **File**: `src/storage/snippet-dependency-resolver.ts` (new)
  - **Priority**: HIGH - Dependency resolution foundation
  - **Time**: 50 minutes
  - **Format Specification**:
    - **Required format**: `"store-name:trigger:id"` for ALL dependencies
    - **Example**: `["appdata-store:;greeting:abc123", "team-store:;signature:def456"]`
    - **Consistency**: No conditional logic - same format regardless of store location
  - **Sub-TODO**: [ ] **Build comprehensive dependency resolution tests**
    - **File**: `tests/unit/snippet-dependency-resolver.test.ts` (new)
    - **Time**: 60 minutes
    - **Test Coverage**:
      - **Unit Tests**: Dependency parsing, format validation, edge cases
      - **Integration Tests**: Cross-store resolution, missing dependencies, circular detection
      - **Error Handling**: Invalid stores, malformed format, permission issues

- [ ] **Implement dependency validation and circular detection**
  - **Action**: Validate all dependency references and prevent circular dependencies
  - **Requirements**: Check store existence, verify snippet existence, detect cycles
  - **Features**: Comprehensive validation, circular dependency prevention, error reporting
  - **File**: `src/storage/dependency-validator.ts` (new)
  - **Priority**: HIGH - Data integrity and system stability
  - **Dependencies**: Dependency resolver implemented
  - **Time**: 40 minutes
  - **Sub-TODO**: [ ] **Build dependency validation tests**
    - **File**: `tests/unit/dependency-validator.test.ts` (new)
    - **Time**: 35 minutes

- [ ] **Integrate dependency resolution into expansion logic**
  - **Action**: Resolve and expand snippet dependencies during trigger expansion
  - **Requirements**: Fetch dependencies from correct stores, handle missing dependencies gracefully
  - **Features**: Recursive dependency resolution, performance optimization, error handling
  - **File**: `src/content/expansion-dependency-manager.ts` (new)
  - **Priority**: HIGH - Core expansion functionality
  - **Dependencies**: Dependency resolver and validator complete
  - **Time**: 55 minutes
  - **Sub-TODO**: [ ] **Build expansion dependency tests**
    - **File**: `tests/unit/expansion-dependency-manager.test.ts` (new)
    - **Time**: 45 minutes
    - **End-to-End Tests**:
      - **Multi-store expansion**: Test dependency chains across multiple stores
      - **Nested dependencies**: Test A→B→C dependency chains
      - **Error scenarios**: Missing dependencies, permission failures, network issues

---

## 📊 **PRIORITY SYSTEM & USAGE TRACKING ARCHITECTURE** - **MEDIUM-HIGH PRIORITY**

**Goal**: Implement store-based priority system with SQLite usage tracking for future usage-based priority evolution.

### 🏗️ **Store-Based Priority System Design** - **MEDIUM-HIGH PRIORITY**

- [ ] **Document and implement store-based priority hierarchy**
  - **Action**: Priority determined by store order, not individual snippet fields
  - **Requirements**: Priority #0 = appdata store, Priority #1+ = secondary stores in selection order
  - **Features**: Display ordering for multiple matching snippets, alphabetical fallback
  - **File**: `src/types/priority-system.ts` (new)
  - **Priority**: MEDIUM-HIGH - Core expansion logic
  - **Time**: 30 minutes
  - **Sub-TODO**: [ ] **Update expansion logic for store-based priority**
    - **File**: `src/content/expansion-priority-manager.ts` (new)
    - **Time**: 45 minutes

### 🗄️ **SQLite Usage Tracking Infrastructure** - **MEDIUM-HIGH PRIORITY**

- [ ] **Design SQLite usage tracking database schemas**
  - **Action**: Define schemas for global and per-store usage tracking
  - **Requirements**: Separate from snippet JSON data, track usage patterns
  - **Features**: Single-user and team tracking support, historical data preservation
  - **File**: `src/storage/usage-tracking-schema.sql` (new)
  - **Priority**: MEDIUM-HIGH - Analytics foundation
  - **Time**: 40 minutes
  - **Schema Fields**:
    - **Appdata tracking**: `id`, `trigger`, `preview_40`, `usage_count`, `first_used`, `last_used`, `source_stores` (JSON array)
    - **Secondary store tracking**: Same fields but `user_names` (JSON array) instead of `source_stores`

- [ ] **Implement global usage tracking database (appdata)**
  - **Action**: SQLite DB in appdata tracking ALL snippets across ALL stores
  - **Requirements**: Tracks every snippet available to user, past and present, even unused ones
  - **Features**: Global analytics, cross-store usage patterns, historical preservation
  - **File**: `src/storage/global-usage-tracker.ts` (new)
  - **Priority**: MEDIUM-HIGH - Global usage analytics
  - **Time**: 60 minutes
  - **Sub-TODO**: [ ] **Build global usage tracking tests**
    - **File**: `tests/unit/global-usage-tracker.test.ts` (new)
    - **Time**: 35 minutes

- [ ] **Implement per-store usage tracking databases for secondary stores**
  - **Action**: SQLite DB alongside each secondary snippet store
  - **Requirements**: Tracks ONLY snippets from that specific secondary store, past and present
  - **Features**: Store-specific analytics, multi-user support for shared stores
  - **File**: `src/storage/secondary-store-usage-tracker.ts` (new)
  - **Priority**: MEDIUM-HIGH - Store-specific analytics
  - **Time**: 55 minutes
  - **Sub-TODO**: [ ] **Build secondary store usage tracking tests**
    - **File**: `tests/unit/secondary-store-usage-tracker.test.ts` (new)
    - **Time**: 40 minutes

### 🔄 **Usage Tracking Integration** - **MEDIUM-HIGH PRIORITY**

- [ ] **Integrate usage tracking hooks into expansion logic**
  - **Action**: Track snippet usage during expansion process
  - **Requirements**: Update both global (appdata) and secondary store tracking on each use
  - **Features**: Dual-tracking system, performance optimization, error handling
  - **File**: `src/content/expansion-usage-logger.ts` (new)
  - **Priority**: MEDIUM-HIGH - Usage data collection
  - **Dependencies**: Usage tracking databases implemented
  - **Time**: 45 minutes

- [ ] **Implement usage data synchronization for secondary stores**
  - **Action**: Sync usage data alongside secondary stores for multi-user scenarios
  - **Requirements**: Merge usage data from multiple users, conflict resolution
  - **Features**: Multi-user analytics, usage pattern aggregation, privacy considerations
  - **File**: `src/storage/secondary-store-usage-sync.ts` (new)
  - **Priority**: MEDIUM-HIGH - Multi-user collaboration
  - **Dependencies**: Secondary store tracking complete
  - **Time**: 50 minutes

### 🚀 **Future Usage-Based Priority Preparation** - **MEDIUM PRIORITY**

- [ ] **Design usage-based priority calculation system**
  - **Action**: Plan transition from store-based to usage-based priority
  - **Requirements**: Maintain store-based as fallback for zero/tied usage
  - **Features**: Configurable priority weighting, gradual rollout capability
  - **File**: `src/storage/usage-priority-calculator.ts` (new)
  - **Priority**: MEDIUM - Future enhancement preparation
  - **Dependencies**: Usage tracking infrastructure complete
  - **Time**: 35 minutes

- [ ] **Implement priority override system**
  - **Action**: Allow manual priority adjustments while maintaining usage tracking
  - **Requirements**: User control over snippet ordering, usage data preservation
  - **Features**: Manual overrides, priority pinning, usage-based suggestions
  - **File**: `src/storage/priority-override-manager.ts` (new)
  - **Priority**: MEDIUM - User control features
  - **Dependencies**: Usage-based priority design complete
  - **Time**: 40 minutes

### 📋 **Data Architecture Examples**

**Example Store Configuration:**

- **Appdata Store** (Priority #0): Personal snippets + global usage tracking DB
- **Secondary Store #1** (Priority #1): Team snippets + secondary store usage tracking DB
- **Secondary Store #2** (Priority #2): Company snippets + secondary store usage tracking DB

**Store Type Clarification:**

- **Appdata Store**: Always personal, stored in user's Drive appdata folder
- **Secondary Stores**: Any user-selected stores (team folders, personal folders, org folders, etc.)
- All secondary stores use the same tracking schema with `user_names` array for multi-user support

**Usage Tracking Data Flow:**
When user expands snippet from Secondary Store #1:

- ✅ **Global tracking DB** (appdata): Records usage (user's complete usage history)
- ✅ **Secondary Store #1 tracking DB**: Records usage (store-specific analytics)
- ❌ **Secondary Store #2 tracking DB**: No update (snippet not from this store)

---

## 🚀 **MAJOR ARCHITECTURE MIGRATION: Priority-Tier Snippet System** - **IN PROGRESS**

**Goal**: Transform from multi-file-per-snippet to priority-tier JSON architecture with TinyMCE WYSIWYG editing and advanced paste strategies.

### 📋 **Phase 1: Data Architecture Refactor** - **HIGH PRIORITY - STARTED**

**Status**: Implementing new data structures and storage system

#### 🏗️ **Schema & Type Updates** - **IMMEDIATE**




#### 🔧 **Storage System Implementation** - **HIGH PRIORITY**

- [ ] **Create PriorityTierManager class for tier-based storage**
  - **Action**: Build new storage manager for priority tiers (personal.json, team.json, org.json)
  - **Features**: Load/save tier files, priority management, tier-specific operations
  - **File**: `src/storage/priority-tier-manager.ts` (new)
  - **Priority**: HIGH - Core storage logic
  - **Dependencies**: Priority types defined
  - **Time**: 45 minutes

- [ ] **Build JSON file loader/serializer with field order preservation**
  - **Action**: Create utilities for reading/writing JSON with preserved field order
  - **Features**: Array ordering preservation, metadata handling, atomic operations
  - **File**: `src/storage/json-serializer.ts` (new)
  - **Priority**: HIGH - Data integrity critical
  - **Dependencies**: PriorityTierManager interface
  - **Time**: 30 minutes

- [ ] **Implement merge helper for upsert operations by ID**
  - **Action**: Build merge logic for updating snippets by ID across tiers
  - **Features**: Conflict resolution, priority handling, deduplication
  - **File**: `src/storage/merge-helper.ts` (new)
  - **Priority**: HIGH - Data consistency
  - **Dependencies**: JSON serializer complete
  - **Time**: 25 minutes

#### 🔄 **Migration Infrastructure** - **HIGH PRIORITY**

- [ ] **Build migration routine from file-per-snippet to tier-based files**
  - **Action**: Create converter from current storage to new tier system
  - **Features**: Scope detection, tier assignment, data backup, rollback capability
  - **File**: `src/migration/legacy-migrator.ts` (new)
  - **Priority**: HIGH - User data preservation
  - **Dependencies**: All Phase 1 storage components
  - **Time**: 60 minutes

### 📋 **Phase 2: Editor Integration** - **MEDIUM PRIORITY**

**Status**: Pending Phase 1 completion

#### 🎨 **TinyMCE Integration** - **MEDIUM PRIORITY**

- [ ] **Integrate TinyMCE Community Edition (LGPL 2.1)**
  - **Action**: Add TinyMCE as dependency, ensure LGPL compliance
  - **Legal**: Unmodified distribution, proper licensing attribution
  - **File**: `package.json`, licensing documentation
  - **Priority**: MEDIUM - Editor foundation
  - **Dependencies**: Phase 1 complete
  - **Time**: 30 minutes

- [ ] **Create extension-specific TinyMCE wrapper components**
  - **Action**: Build React-like wrapper for extension integration
  - **Features**: Extension context integration, event handling, data binding
  - **File**: `src/editor/tinymce-wrapper.ts` (new)
  - **Priority**: MEDIUM - Editor abstraction
  - **Dependencies**: TinyMCE integrated
  - **Time**: 45 minutes

- [ ] **Implement CSS-based TinyMCE branding customization**
  - **Action**: Hide TinyMCE branding, customize appearance for extension
  - **Features**: Custom styling, extension-specific UI elements
  - **File**: `src/editor/tinymce-styles.css` (new)
  - **Priority**: MEDIUM - User experience
  - **Dependencies**: TinyMCE wrapper complete
  - **Time**: 20 minutes

- [ ] **Design snippet editing interface with TinyMCE**
  - **Action**: Create snippet editor UI incorporating TinyMCE
  - **Features**: Variable handling, preview mode, validation
  - **File**: `src/ui/components/snippet-editor.ts` (new)
  - **Priority**: MEDIUM - Core editing experience
  - **Dependencies**: All TinyMCE components ready
  - **Time**: 50 minutes

#### 🔧 **Multi-Content Type Support** - **MEDIUM PRIORITY**

- [ ] **Enhance editor for HTML, plaintext, and LaTeX content types**
  - **Action**: Add content type switcher and format-specific editing
  - **Features**: Type detection, conversion utilities, preview modes
  - **File**: `src/editor/content-type-manager.ts` (new)
  - **Priority**: MEDIUM - Content flexibility
  - **Dependencies**: Snippet editor complete
  - **Time**: 40 minutes

### 📋 **Phase 3: Paste Engine Refactor** - **MEDIUM PRIORITY**

**Status**: Pending Phase 2 completion

#### 🎯 **Target Detection System** - **MEDIUM PRIORITY**

- [ ] **Build advanced target surface detection system**
  - **Action**: Create detection for plain-text fields, Gmail, TinyMCE instances, etc.
  - **Features**: Context-aware detection, fallback mechanisms
  - **File**: `src/content/target-detector.ts` (new)
  - **Priority**: MEDIUM - Paste strategy foundation
  - **Dependencies**: Phase 2 editor work
  - **Time**: 35 minutes

#### 🔄 **Transformation Pipeline** - **MEDIUM PRIORITY**

- [ ] **Implement plain-text field transformation (strip markup or HTML→AsciiDoc)**
  - **Action**: Create transformation for plain-text target surfaces
  - **Features**: HTML stripping, AsciiDoc conversion option, user preference
  - **File**: `src/content/paste-strategies/plaintext-strategy.ts` (new)
  - **Priority**: MEDIUM - Core paste functionality
  - **Dependencies**: Target detection complete
  - **Time**: 25 minutes

- [ ] **Implement Gmail composer transformation (HTML→Gmail-tuned)**
  - **Action**: Create Gmail-specific HTML transformation
  - **Features**: Inline styles, <br> optimization, Gmail CSS compatibility
  - **File**: `src/content/paste-strategies/gmail-strategy.ts` (new)
  - **Priority**: MEDIUM - Gmail integration
  - **Dependencies**: Target detection complete
  - **Time**: 30 minutes

- [ ] **Implement TinyMCE instance transformation (schema-valid markup)**
  - **Action**: Create TinyMCE-compatible HTML injection
  - **Features**: mceInsertContent integration, schema validation
  - **File**: `src/content/paste-strategies/tinymce-strategy.ts` (new)
  - **Priority**: MEDIUM - Editor integration
  - **Dependencies**: Target detection complete
  - **Time**: 25 minutes

- [ ] **Implement fallback clipboard strategy (dual text/html write)**
  - **Action**: Create fallback for unrecognized target surfaces
  - **Features**: Dual clipboard write, browser selection optimization
  - **File**: `src/content/paste-strategies/fallback-strategy.ts` (new)
  - **Priority**: MEDIUM - Compatibility safety net
  - **Dependencies**: All other strategies complete
  - **Time**: 20 minutes

### 📋 **Phase 4: Google Drive Permissions Refactor** - **HIGH PRIORITY**

**Status**: Pending Phase 3 completion

#### 🔐 **Scope Reduction** - **HIGH PRIORITY**

- [ ] **Update manifest.json for drive.file + drive.appdata scopes only**
  - **Action**: Remove broad `drive` scope, request only specific scopes
  - **Security**: Reduce permissions to minimum required
  - **File**: `manifest.json`
  - **Priority**: HIGH - Security and user trust
  - **Dependencies**: Phase 3 complete
  - **Time**: 10 minutes

- [ ] **Modify Google Drive adapter for reduced scope limitations**
  - **Action**: Update adapter to work within new scope constraints
  - **Features**: File-specific access, appdata handling
  - **File**: `src/background/cloud-adapters/google-drive-adapter.ts`
  - **Priority**: HIGH - Core functionality preservation
  - **Dependencies**: Manifest updated
  - **Time**: 40 minutes

- [ ] **Implement user file selection workflow for snippet stores**
  - **Action**: Create UI for users to select which files to use as snippet stores
  - **Features**: File picker, permission management, user choice preservation
  - **File**: `src/ui/components/file-selector.ts` (new)
  - **Priority**: HIGH - User control over data
  - **Dependencies**: Drive adapter updated
  - **Time**: 45 minutes

### 📋 **Phase 5: UI/UX Enhancements** - **LOW PRIORITY**

**Status**: Pending Phase 4 completion

#### 🎨 **Priority Management Interface** - **LOW PRIORITY**

- [ ] **Create priority picker UI for JSON stores in snippet editor**
  - **Action**: Build interface for selecting priority tiers when editing snippets
  - **Features**: Visual priority indicators, tier selection, preview
  - **File**: `src/ui/components/priority-picker.ts` (new)
  - **Priority**: LOW - UX enhancement
  - **Dependencies**: Phase 4 complete
  - **Time**: 35 minutes

- [ ] **Design multi-file selection interface for snippet creation**
  - **Action**: Create interface for selecting multiple tiers when creating snippets
  - **Features**: Checkbox interface, tier visualization, bulk operations
  - **File**: `src/ui/components/multi-tier-selector.ts` (new)
  - **Priority**: LOW - Advanced feature
  - **Dependencies**: Priority picker complete
  - **Time**: 30 minutes

#### 🔄 **Mirroring Workflow** - **LOW PRIORITY**

- [ ] **Create mirroring checkboxes in snippet editor**
  - **Action**: Add checkboxes for mirroring snippets across multiple tiers
  - **Features**: Visual feedback, dependency tracking, conflict warnings
  - **File**: `src/ui/components/mirror-selector.ts` (new)
  - **Priority**: LOW - Advanced collaboration feature
  - **Dependencies**: Multi-file interface complete
  - **Time**: 25 minutes

- [ ] **Implement batch update system for mirrored snippets**
  - **Action**: Create system for updating snippets across multiple tier files
  - **Features**: Atomic updates, conflict resolution, timestamp management
  - **File**: `src/storage/batch-updater.ts` (new)
  - **Priority**: LOW - Advanced data management
  - **Dependencies**: Mirror selector complete
  - **Time**: 40 minutes

### 📋 **Phase 6: Migration & Testing** - **MEDIUM PRIORITY**

**Status**: Pending Phase 5 completion

#### 🔄 **Data Migration** - **MEDIUM PRIORITY**

- [ ] **Run migration routine on first launch after update**
  - **Action**: Implement automatic migration trigger and progress indication
  - **Features**: Version detection, user notification, progress tracking
  - **File**: `src/background/service-worker.ts` (update)
  - **Priority**: MEDIUM - User experience
  - **Dependencies**: All migration components ready
  - **Time**: 30 minutes

#### 🧪 **Testing & Validation** - **MEDIUM PRIORITY**

- [ ] **Test paste behavior across different target surfaces**
  - **Action**: Comprehensive testing of paste strategies
  - **Features**: Automated testing, manual validation, edge case coverage
  - **File**: `tests/integration/paste-strategies.test.ts` (new)
  - **Priority**: MEDIUM - Quality assurance
  - **Dependencies**: All paste strategies implemented
  - **Time**: 45 minutes

- [ ] **Validate priority ordering and merging logic**
  - **Action**: Test priority-based snippet ordering and conflict resolution
  - **Features**: Edge case testing, performance validation
  - **File**: `tests/unit/priority-tier-manager.test.ts` (new)
  - **Priority**: MEDIUM - Data integrity
  - **Dependencies**: Priority system complete
  - **Time**: 35 minutes

- [ ] **Test TinyMCE integration in various contexts**
  - **Action**: Test editor integration across different websites and contexts
  - **Features**: Cross-site testing, performance validation
  - **File**: `tests/e2e/tinymce-integration.test.ts` (new)
  - **Priority**: MEDIUM - Editor reliability
  - **Dependencies**: TinyMCE integration complete
  - **Time**: 40 minutes

- [ ] **Verify Google Drive scope limitations work correctly**
  - **Action**: Test reduced permissions work as expected
  - **Features**: Permission validation, scope testing, error handling
  - **File**: `tests/integration/drive-scope-limits.test.ts` (new)
  - **Priority**: MEDIUM - Security validation
  - **Dependencies**: Drive scope refactor complete
  - **Time**: 25 minutes

---

### 🎯 Current Project Status - v0.81.0

**🚀 MAJOR MIGRATION**: Architecture transformation to priority-tier system with TinyMCE integration

- **Version**: v0.81.0  
- **Test Success**: High coverage maintained
- **Architecture**: Transforming to tier-based snippet management
- **Phase 1 Progress**: ✅ Schema & Hash System Complete, ⏳ Storage Implementation Needed
- **Current Focus**: Implementing PriorityTierManager and JSON serializer for tier-based storage

**📖 See [CLAUDE-TODONE.md](./CLAUDE-TODONE.md) for complete list of all accomplished work.**

---

## 📊 **Implementation Timeline**

### **Phase 1**: ~3 hours (Data Architecture)

- Schema updates: 50 minutes
- Storage system: 100 minutes
- Migration routine: 60 minutes

### **Phase 2**: ~3 hours (Editor Integration)

- TinyMCE integration: 95 minutes
- Multi-content support: 40 minutes
- UI components: 50 minutes

### **Phase 3**: ~2.5 hours (Paste Engine)

- Target detection: 35 minutes
- Transformation strategies: 100 minutes

### **Phase 4**: ~1.5 hours (Permissions)

- Scope reduction: 50 minutes
- File selection: 45 minutes

### **Phase 5**: ~2 hours (UI/UX)

- Priority interface: 65 minutes
- Mirroring workflow: 65 minutes

### **Phase 6**: ~2.5 hours (Migration & Testing)

- Migration implementation: 30 minutes
- Testing and validation: 145 minutes

**Total Estimated Time**: ~14.5 hours

---

## 🎯 **Success Criteria**

- [ ] All existing snippets migrated to tier-based JSON files without data loss
- [ ] TinyMCE editor integrated and functional across different contexts
- [ ] Paste behavior works correctly across all target surfaces (plain-text, Gmail, TinyMCE, fallback)
- [ ] Google Drive integration works with reduced permissions (drive.file + drive.appdata only)
- [ ] Mirroring workflow allows multi-file snippet management
- [ ] Priority ordering functions correctly with descending priority
- [ ] Migration routine preserves all existing data with rollback capability
- [ ] Performance maintained or improved vs current system
- [ ] All existing tests continue to pass (no regressions)

---

_Last updated: 2025-07-16_  
_Project: PuffPuffPaste - Collaborative Text Expander_  
_Current Version: 0.73.1_  
_Status: Major Architecture Migration - Priority-Tier System Implementation_
