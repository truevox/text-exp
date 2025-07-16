# CLAUDE-TODO.md

## 📋 Remaining Tasks - PuffPuffPaste Chrome Extension

### 🔄 **PERMANENT HIGH-PRIORITY TASK**

- [ ] **📝 ALWAYS move completed tasks to CLAUDE-TODONE.md!**
  - **Status**: Ongoing organizational requirement
  - **Priority**: HIGH - Essential for project documentation hygiene
  - **Action**: When any task is completed, immediately move it from this file to CLAUDE-TODONE.md
  - **Note**: This task should NEVER be marked as completed - it's a permanent process reminder

---

## 🚀 **MAJOR ARCHITECTURE MIGRATION: Priority-Tier Snippet System** - **IN PROGRESS**

**Goal**: Transform from multi-file-per-snippet to priority-tier JSON architecture with TinyMCE WYSIWYG editing and advanced paste strategies.

### 📋 **Phase 1: Data Architecture Refactor** - **HIGH PRIORITY - STARTED**

**Status**: Implementing new data structures and storage system

#### 🏗️ **Schema & Type Updates** - **IMMEDIATE**

- [ ] **Update SnippetMeta interface with new required fields** - **CURRENT TASK**
  - **Action**: Add `snipDependencies: string[]` field to SnippetMeta
  - **Action**: Update `contentType` to focus on HTML: `'html' | 'plaintext' | 'latex'`
  - **File**: `src/types/snippet-formats.ts`
  - **Priority**: HIGH - Foundation for entire migration
  - **Dependencies**: None
  - **Time**: 15 minutes

- [ ] **Create PriorityTierStore type definitions**
  - **Action**: Define `PriorityTierStore`, `EnhancedSnippet` interfaces
  - **Features**: tierName, fileName, ordered snippets array, lastModified
  - **File**: `src/types/snippet-formats.ts`
  - **Priority**: HIGH - Core data structure
  - **Dependencies**: Updated SnippetMeta
  - **Time**: 20 minutes

- [ ] **Implement array-based snippet storage schema**
  - **Action**: Define storage format for priority-ordered snippet arrays
  - **Features**: Descending priority order, metadata preservation
  - **File**: `src/types/snippet-formats.ts`
  - **Priority**: HIGH - Storage foundation
  - **Dependencies**: PriorityTierStore types
  - **Time**: 15 minutes

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

### 🎯 Current Project Status - v0.73.1

**🚀 MAJOR MIGRATION**: Architecture transformation to priority-tier system with TinyMCE integration

- **Version**: v0.73.1
- **Test Success**: High coverage maintained
- **Architecture**: Transforming to tier-based snippet management
- **Next Phase**: Phase 1 - Data Architecture Refactor
- **Current Focus**: Updating SnippetMeta interface and creating priority types

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