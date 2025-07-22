# Cross-Site Text Expansion Testing

This document explains how to test the PuffPuffPaste extension's text expansion functionality across different websites and input types.

## Overview

The cross-site expansion tests are designed to validate that text expansion works correctly across:

- **Plain text sites** - simple HTML forms, basic textareas
- **Rich text editors** - contenteditable divs, rich text areas
- **Code editors** - sites with ACE editor, CodeMirror, or similar
- **Specialized inputs** - various input element types
- **Real websites** - GitHub, CodePen, text.new, etc.

## Prerequisites

1. **PuffPuffPaste Extension Installed**: Make sure the extension is installed and enabled in Chrome
2. **Test Snippets Created**: Create at least one snippet with trigger "hello" and content "Hello, World!"
3. **Extension Permissions**: Ensure the extension has permission to run on all sites

## Running Tests

### Quick Test (Recommended)

Run the simple cross-site test to verify basic functionality:

```bash
npm run test:cross-site
```

This will:

- Open Chrome with Playwright control
- Test text expansion on multiple input types
- Show real-time results
- Take screenshots for verification

### Manual Test Suite

For comprehensive manual testing across real websites:

```bash
npm run test:cross-site-manual
```

This includes:

- Extension availability check
- Manual testing on real sites (text.new, CodePen, GitHub, etc.)
- Automated compatibility report
- Detailed instructions for each test

## Test Files

### `/tests/playwright/simple-cross-site-test.spec.ts`

- **Purpose**: Basic functionality verification
- **Duration**: ~2 minutes
- **What it tests**: Text input, textarea, contenteditable elements
- **Output**: Console logs + screenshots

### `/tests/playwright/cross-site-expansion-manual.spec.ts`

- **Purpose**: Comprehensive manual testing
- **Duration**: ~10 minutes
- **What it tests**: Real websites, manual interaction required
- **Output**: Detailed compatibility report

### `/tests/playwright/cross-site-expansion.spec.ts`

- **Purpose**: Automated cross-site testing (currently disabled)
- **Status**: ⚠️ Has issues with extension loading
- **Note**: May need rework for proper extension integration

## Interpreting Results

### Success Indicators

- ✅ **PASS**: "hello" expands to "Hello, World!"
- 🟢 **Green status**: Extension working correctly
- 📸 **Screenshots**: Visual confirmation of expansion

### Failure Indicators

- ❌ **FAIL**: "hello" remains unchanged
- 🔴 **Red status**: Extension not working
- ⚠️ **Warning**: Partial functionality

### Common Issues

- **Extension not loaded**: Make sure PuffPuffPaste is installed and enabled
- **Missing snippets**: Create a snippet with trigger "hello"
- **Permission denied**: Enable extension on all sites
- **Timing issues**: Some complex sites may need longer delays

## Site-Specific Behavior

Different sites may exhibit different expansion behaviors:

### Expected Perfect Expansion

- Simple HTML forms
- Basic textareas
- Most contenteditable elements

### Expected Paste Fallback

- ACE Editor (CodePen, JSFiddle)
- Monaco Editor
- Complex rich text editors

### Expected Challenges

- Gmail compose (requires auth)
- Google Docs (requires auth + complex DOM)
- Sites with heavy JavaScript frameworks

## Debugging Failed Tests

1. **Check Extension Status**:

   ```bash
   # Open extension popup manually
   chrome-extension://YOUR_EXTENSION_ID/popup/popup.html
   ```

2. **Verify Snippets**:
   - Open extension popup
   - Confirm "hello" snippet exists
   - Test manually in popup

3. **Check Console Logs**:
   - Open DevTools (F12)
   - Look for PuffPuffPaste-related messages
   - Check for JavaScript errors

4. **Test Manually**:
   - Navigate to problematic site
   - Type "hello" manually
   - Observe behavior

## Adding New Test Sites

To add new sites to the test suite:

1. **Update `MANUAL_TEST_SITES`** in `cross-site-expansion-manual.spec.ts`
2. **Add site configuration**:

   ```typescript
   {
     name: "New Site",
     url: "https://example.com",
     instructions: "Click in editor and type 'hello'",
     expectedBehavior: "expansion" | "paste-fallback" | "typing-simulation"
   }
   ```

3. **Test locally** before committing

## Continuous Integration

Currently, cross-site tests are designed for manual execution due to:

- Extension loading complexity
- Authentication requirements for some sites
- Need for visual verification

For CI integration, consider:

- Mocking problematic sites
- Using test pages instead of real sites
- Focusing on core functionality tests

## Screenshots and Reports

Test results are saved to:

- `test-results/`: Screenshots and visual evidence
- Console output: Detailed test logs and status
- Playwright HTML report: Comprehensive test results

## Tips for Testing

1. **Run tests with extension enabled**: Ensure PuffPuffPaste is active
2. **Test on clean browser profile**: Avoid interference from other extensions
3. **Check network connectivity**: Some tests require internet access
4. **Allow sufficient time**: Complex sites may need longer load times
5. **Verify manually**: Automated tests may miss subtle issues

## Troubleshooting

### "No expansion detected"

- Verify snippet creation
- Check extension permissions
- Test on simpler site first

### "Browser launch failed"

- Install Playwright browsers: `npx playwright install`
- Check Chrome/Chromium installation

### "Test timeout"

- Increase timeout in test files
- Check if site is accessible
- Verify network connection

---

For more help, check:

- Extension popup for snippet management
- Browser DevTools for debugging
- Playwright documentation for test configuration
