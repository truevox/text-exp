# 🧪 Testing Guide - PuffPuffPaste

## ✅ Current Testing Status

The extension now has all core components working:

- ✅ Content script with trigger detection
- ✅ Text replacement system
- ✅ Local storage with sample snippets
- ✅ Comprehensive unit tests (passing)

## 🚀 How to Test the Extension

### 1. Build the Extension

```bash
npm run build
```

### 2. Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `build/` folder from this project

### 3. Setup Test Data

1. Open the extension's service worker console:
   - Go to `chrome://extensions/`
   - Click "Inspect views: service worker" under our extension
2. In the console, copy and paste this setup code:

   ```javascript
   // Setup test data directly in service worker
   const SAMPLE_SNIPPETS = [
     {
       id: "greeting-hello",
       trigger: ";hello",
       content: "Hello! How are you doing today?",
       createdAt: new Date("2024-01-01"),
       updatedAt: new Date("2024-01-01"),
       variables: [],
       tags: ["greeting", "casual"],
     },
     {
       id: "greeting-goodbye",
       trigger: ";gb",
       content: "Goodbye! Have a great day!",
       createdAt: new Date("2024-01-01"),
       updatedAt: new Date("2024-01-01"),
       variables: [],
       tags: ["greeting", "farewell"],
     },
     {
       id: "date-today",
       trigger: ";today",
       content: new Date().toLocaleDateString(),
       createdAt: new Date("2024-01-01"),
       updatedAt: new Date("2024-01-01"),
       variables: [],
       tags: ["date", "utility"],
     },
     {
       id: "email-signature",
       trigger: ";sig",
       content: "Best regards,\n{name}\n{title}\n{company}",
       createdAt: new Date("2024-01-01"),
       updatedAt: new Date("2024-01-01"),
       variables: [
         {
           name: "name",
           placeholder: "Your name",
           required: true,
           type: "text",
         },
         {
           name: "title",
           placeholder: "Your job title",
           required: true,
           type: "text",
         },
         {
           name: "company",
           placeholder: "Company name",
           required: true,
           type: "text",
         },
       ],
       tags: ["email", "signature", "professional"],
     },
   ];

   const TEST_SETTINGS = {
     enabled: true,
     cloudProvider: "local",
     autoSync: false,
     syncInterval: 30,
     showNotifications: true,
     triggerDelay: 100,
     caseSensitive: false,
     enableSharedSnippets: true,
     triggerPrefix: ";",
     excludePasswords: true,
   };

   // Setup function
   async function setupTestData() {
     try {
       console.log("🚀 Setting up test data for PuffPuffPaste...");
       await chrome.storage.local.set({ snippets: SAMPLE_SNIPPETS });
       await chrome.storage.sync.set({ settings: TEST_SETTINGS });
       await chrome.storage.local.set({
         syncStatus: {
           lastSync: new Date().toISOString(),
           status: "idle",
           error: null,
           snippetCount: SAMPLE_SNIPPETS.length,
         },
       });
       console.log(`✅ Added ${SAMPLE_SNIPPETS.length} test snippets`);
       console.log("🎉 Test data setup complete!");
       SAMPLE_SNIPPETS.forEach((snippet) =>
         console.log(
           `  ${snippet.trigger} - ${snippet.content.substring(0, 50)}...`,
         ),
       );
     } catch (error) {
       console.error("❌ Failed to setup test data:", error);
     }
   }

   // Run setup
   setupTestData();
   ```

### 4. Test Text Expansion

Navigate to any website with text inputs and try these triggers:

#### Basic Snippets (no variables)

- `;hello` + Tab/Space → "Hello! How are you doing today?"
- `;gb` + Tab/Space → "Goodbye! Have a great day!"
- `;today` + Tab/Space → Current date

#### Variable Snippets (will prompt for input)

- `;sig` + Tab/Space → Email signature with name/title/company prompts
- `;meeting` + Tab/Space → Meeting invitation template
- `;email` + Tab/Space → Email template
- `;log` + Tab/Space → JavaScript console.log statement

### 5. Good Test Sites

Try these sites for testing:

- **Gmail** (compose email)
- **Google Docs**
- **GitHub** (issue comments, PRs)
- **Any form with text inputs**

## 🔧 Debugging

### Check Extension Status

```javascript
// In extension console
showStorageContents(); // See all snippets
```

### Console Logs

- Open DevTools on any page to see content script logs
- Look for "✅ PuffPuffPaste content script initialized"
- Expansion logs: "Expanded ';hello' → 'Hello!...'"

### Common Issues

1. **No expansion happening**: Check if extension is enabled and loaded
2. **Variables not prompting**: Check browser popup blockers
3. **Not working on specific sites**: Some sites block content scripts

## 🎯 Test Scenarios

### ✅ Basic Functionality

- [ ] Type `;hello` and press Tab - should expand
- [ ] Type `;gb` and press Space - should expand
- [ ] Try typing partial trigger like `;hel` - should not expand yet

### ✅ Variable Prompts

- [ ] Type `;sig` and Tab - should show variable prompts
- [ ] Fill in prompts and confirm - should expand with your values
- [ ] Cancel variable prompt - should not expand

### ✅ Edge Cases

- [ ] Try triggers in password fields - should be blocked
- [ ] Try in different input types (textarea, contenteditable)
- [ ] Test with case sensitivity

## 📊 Performance Testing

- Test with 50+ snippets loaded
- Check memory usage in Chrome Task Manager
- Test on slow networks/devices

## 🐛 Known Issues

- Variable modal styling needs improvement
- Some sites may have CSP restrictions
- Password field detection needs refinement

## 🚀 Next Steps for Full Testing

1. **Cloud Sync Testing** (after OAuth implementation)
2. **Multi-user Collaboration**
3. **Import/Export functionality**
4. **Options page UI testing**
5. **Popup interface testing**
