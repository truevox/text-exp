# Fix: Multi-Store Snippet Creation Interface

## Issue

The blue field in "Create New Snippet" dialog currently shows "PRIORITY-0 TIER" instead of a proper store selector with checkboxes for all available stores.

## Expected Behavior

The blue box should show:

- **All user's stores** (including default `/appdata` store)
- **Checkbox next to each** store name
- **For NEW snippets**: Only default appdata store checked
- **For EDITING snippets**: Shows which stores currently contain the snippet
- **Read-only stores**: Checkboxes disabled but still show status

## Files to Modify

### 1. `/src/popup/popup.ts`

- **Line ~400**: Update `initializeSnippetEditor()` to gather all available stores
- Add method to get all user's configured stores
- Pass store information to `ComprehensiveSnippetEditor`

### 2. `/src/ui/components/comprehensive-snippet-editor.ts`

- **Line ~160**: Update header to show multi-store selector instead of single tier
- Replace `editor-tier-info` section with multi-store checkbox interface
- Add store selection handling logic

### 3. `/src/ui/components/multi-store-selector.ts` (NEW)

- Create dedicated component for store selection UI
- Handle checkbox state management
- Support read-only stores

## Implementation Plan

1. **Detect all available stores** from user's configured sources
2. **Replace tier badge** with store selector checkboxes
3. **Default behavior**: Check only appdata store for new snippets
4. **Save behavior**: Save to all checked stores
5. **Edit mode**: Show current snippet locations

## Quick Fix Location

The main change is in popup.ts `initializeSnippetEditor()` where it creates a single `TierStorageSchema`. Instead, it needs to:

- Query all configured stores
- Create multi-store selection interface
- Pass available stores to the comprehensive editor
