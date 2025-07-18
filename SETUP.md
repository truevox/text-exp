# Chrome Extension Setup Guide

Complete setup guide for the Collaborative Text Expander Chrome Extension with Vite build system.

## Prerequisites

- Node.js 18+ installed
- Chrome/Chromium browser for testing
- Git for version control

## Initial Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Validate Configuration

```bash
node scripts/validate-config.js
```

This will verify all build system components are properly configured.

### 3. First Build

```bash
npm run dev:extension
```

This creates a development build and provides Chrome extension loading instructions.

## Development Workflow

### Daily Development

1. **Start development mode:**

   ```bash
   npm run dev
   ```

   This watches for file changes and rebuilds automatically.

2. **Load extension in Chrome:**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `build/` directory

3. **Test your changes:**
   - Extension reloads automatically with hot reload
   - Check browser console for any errors
   - Test functionality in web pages

### Code Quality

Run before committing:

```bash
npm run validate
```

This runs type checking, linting, formatting checks, and tests.

### Version Management

Following the TDD workflow from CLAUDE.md:

```bash
# For new features
npm run version:feature

# For bug fixes
npm run version:fix
```

This bumps the version, updates manifest.json, and builds the extension.

## File Structure

```
src/
├── background/         # Service worker and background logic
│   ├── service-worker.ts
│   ├── sync-manager.ts
│   └── cloud-adapters/
├── content/           # Content scripts for web pages
│   ├── content-script.ts
│   └── ...
├── popup/             # Extension popup UI
│   ├── popup.html
│   ├── popup.ts
│   └── popup.css
├── options/           # Extension options page
│   ├── options.html
│   ├── options.ts
│   └── options.css
├── shared/            # Shared utilities and types
│   ├── types.ts
│   ├── constants.ts
│   ├── storage.ts
│   └── messaging.ts
└── utils/             # Utility functions
    └── version.ts
```

## Build Outputs

```
build/                 # Generated by Vite
├── manifest.json      # Chrome extension manifest
├── background/
│   └── service-worker.js
├── content/
│   └── content-script.js
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── options/
│   ├── options.html
│   ├── options.js
│   └── options.css
├── icons/             # Extension icons
└── assets/            # Static assets
```

## TypeScript Path Aliases

Use these convenient imports in your code:

```typescript
// Instead of: import { SomeType } from '../../../shared/types'
import { SomeType } from "@/shared/types";

// Instead of: import { StorageService } from '../shared/storage'
import { StorageService } from "@/shared/storage";

// Other available aliases:
import { BackgroundService } from "@/background/service-worker";
import { ContentScript } from "@/content/content-script";
import { PopupComponent } from "@/popup/popup";
import { OptionsPage } from "@/options/options";
import { SomeUtil } from "@/utils/version";
```

## Environment Configuration

### Development (.env.development)

- Debug mode enabled
- Source maps included
- Hot reload active
- Development API endpoints

### Production (.env.production)

- Optimized builds
- Minified code
- Production API endpoints
- No debug information

## VS Code Integration

### Recommended Tasks

Use `Ctrl+Shift+P` → "Tasks: Run Task":

- **Dev: Build Extension** - Initial development build
- **Dev: Watch Mode** - Continuous development
- **Test: All** - Run all tests
- **Lint: Fix** - Auto-fix code issues
- **Type Check** - Validate TypeScript

### Debugging

1. Build in development mode
2. Load extension in Chrome
3. Use Chrome DevTools for debugging
4. Source maps provide proper file/line mapping

## Testing Strategy

Following the TDD approach from CLAUDE.md:

### Unit Tests

```bash
npm run test
npm run test:watch  # Watch mode
```

### E2E Tests

```bash
npm run test:e2e
```

### Integration Tests

Tests for cloud adapters, sync manager, etc.

## Troubleshooting

### Common Issues

1. **Extension won't load**
   - Check `build/manifest.json` exists
   - Verify no syntax errors in console
   - Try `npm run clean && npm run build:dev`

2. **Hot reload not working**
   - Ensure port 8080 is available
   - Check WebSocket connection in DevTools
   - Restart development server

3. **TypeScript errors**
   - Run `npm run type-check` for details
   - Check path aliases are correct
   - Verify imports use proper extensions

4. **Build failures**
   - Check console output for specific errors
   - Try `npm run clean` then rebuild
   - Ensure all dependencies are installed

### Debug Commands

```bash
# Full validation
npm run validate

# Clean build
npm run clean && npm run build:dev

# Check configuration
node scripts/validate-config.js

# View installed packages
npm list --depth=0
```

## Advanced Configuration

### Custom Environment Variables

Add to `.env.development` or `.env.production`:

```bash
VITE_CUSTOM_SETTING=value
```

Access in code:

```typescript
const setting = import.meta.env.VITE_CUSTOM_SETTING;
```

### Extending the Build

To add new entry points or modify the build:

1. Update `vite.config.ts`
2. Add new TypeScript paths if needed
3. Update VS Code tasks
4. Test both development and production builds

## Performance Optimization

### Development

- Source maps for debugging
- Hot reload for fast iteration
- Incremental compilation
- Fast dependency pre-bundling

### Production

- Code minification
- Tree shaking
- Asset optimization
- Bundle analysis available

## Chrome Extension Specifics

### Manifest V3 Features

- ES modules support
- Service worker background scripts
- Content scripts with proper loading
- CSP-compliant builds

### Extension APIs

All Chrome extension APIs are available:

- `chrome.storage`
- `chrome.runtime`
- `chrome.tabs`
- `chrome.identity`
- etc.

### Permissions

Configure in `manifest.json`:

- Required permissions
- Optional permissions
- Host permissions

## Deployment

### Development Distribution

```bash
npm run build:dev
# Share the build/ directory
```

### Production Release

```bash
npm run build
# Upload build/ to Chrome Web Store
```

### Version Management

Integrated with existing workflow:

- Automatic version bumping
- Manifest and package.json sync
- Git-friendly commits

## Support and Contributing

### Getting Help

1. Check this guide
2. Run validation script
3. Check BUILD.md for detailed configuration
4. Review console errors
5. Check VS Code problems panel

### Contributing

1. Follow TDD workflow from CLAUDE.md
2. Use the build system consistently
3. Update documentation for changes
4. Test both development and production builds

## Next Steps

After setup is complete:

1. **Install dependencies**: `npm install`
2. **Build extension**: `npm run dev:extension`
3. **Load in Chrome** using provided instructions
4. **Start coding** with `npm run dev` for watch mode
5. **Follow TDD workflow** from CLAUDE.md

The build system is now ready to support the disciplined development workflow outlined in the project documentation. Happy coding! 🚀
