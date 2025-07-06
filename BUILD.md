# Build System Documentation

This document describes the Vite-based build system for the Collaborative Text Expander Chrome Extension.

## Overview

The build system uses **Vite 4** with TypeScript to create a robust, development-friendly environment for Chrome Extension Manifest V3 development.

## Quick Start

```bash
# Install dependencies
npm install

# Development build with instructions
npm run dev:extension

# Watch mode for automatic rebuilds
npm run dev

# Production build
npm run build
```

## Architecture

### Build Configuration

- **Vite Config**: `vite.config.ts` - Main build configuration
- **TypeScript Config**: `tsconfig.json` - TypeScript compilation settings
- **Environment**: `.env.development` and `.env.production` - Environment-specific settings

### Entry Points

The build system handles multiple entry points for different parts of the extension:

1. **Background Service Worker**: `src/background/service-worker.ts`
2. **Content Script**: `src/content/content-script.ts`
3. **Popup**: `src/popup/popup.ts`
4. **Options Page**: `src/options/options.ts`

### Output Structure

```
build/
├── manifest.json           # Processed manifest
├── background/
│   └── service-worker.js   # Background script
├── content/
│   └── content-script.js   # Content script
├── popup/
│   ├── popup.html          # Popup page
│   ├── popup.js            # Popup script
│   └── popup.css           # Popup styles
├── options/
│   ├── options.html        # Options page
│   ├── options.js          # Options script
│   └── options.css         # Options styles
├── icons/                  # Extension icons
└── assets/                 # Static assets
```

## Development Workflow

### 1. Development Mode

```bash
# One-time setup build with Chrome extension loading instructions
npm run dev:extension

# Watch mode for continuous development
npm run dev
```

### 2. Chrome Extension Loading

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `build/` directory

### 3. Hot Reload

The build system includes hot reload support for development:

- File changes trigger automatic rebuilds
- WebSocket connection notifies Chrome extension to reload
- Available in development mode only

### 4. Testing

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run E2E tests
npm run test:e2e

# Run all validation (type-check, lint, format, test)
npm run validate
```

## Build Scripts

### Core Scripts

- `npm run dev` - Watch mode with automatic rebuilds
- `npm run dev:extension` - Development build with setup instructions
- `npm run build` - Production build
- `npm run build:dev` - Development build (no watch)

### Quality Assurance

- `npm run lint` - ESLint check
- `npm run lint:fix` - ESLint with auto-fix
- `npm run format` - Prettier formatting
- `npm run format:check` - Check formatting
- `npm run type-check` - TypeScript type checking
- `npm run type-check:watch` - Type checking in watch mode

### Version Management

- `npm run version:feature` - Bump minor version and build
- `npm run version:fix` - Bump patch version and build
- `npm run version:bump` - Bump version (defaults to feature)

### Utilities

- `npm run clean` - Remove build artifacts
- `npm run clean:all` - Full clean and reinstall
- `npm run validate` - Full validation pipeline

## TypeScript Configuration

### Path Mapping

The build system includes convenient path aliases:

```typescript
import { SomeType } from "@/shared/types";
import { StorageService } from "@/shared/storage";
import { BackgroundService } from "@/background/service-worker";
import { ContentScript } from "@/content/content-script";
```

### Available Aliases

- `@/*` - src/
- `@/shared/*` - src/shared/
- `@/utils/*` - src/utils/
- `@/background/*` - src/background/
- `@/content/*` - src/content/
- `@/popup/*` - src/popup/
- `@/options/*` - src/options/
- `@/assets/*` - src/assets/

## Environment Variables

### Development (.env.development)

```bash
VITE_APP_ENV=development
VITE_DEBUG=true
VITE_HOT_RELOAD=true
VITE_SOURCEMAP=true
VITE_MINIFY=false
```

### Production (.env.production)

```bash
VITE_APP_ENV=production
VITE_DEBUG=false
VITE_HOT_RELOAD=false
VITE_SOURCEMAP=false
VITE_MINIFY=true
```

## VS Code Integration

### Tasks

Use Ctrl+Shift+P → "Tasks: Run Task" to access:

- **Dev: Build Extension** - Development build with instructions
- **Dev: Watch Mode** - Continuous development
- **Build: Production** - Production build
- **Test: All** - Run all tests
- **Lint: Check/Fix** - Code quality checks
- **Type Check** - TypeScript validation

### Debugging

1. Build in development mode: `npm run dev:extension`
2. Load extension in Chrome
3. Use Chrome DevTools for debugging
4. Console logs are available with source maps

## Chrome Extension Specifics

### Manifest V3 Compatibility

- ES modules support
- Service worker background script
- Content scripts with module imports
- Static asset handling
- Proper CSP compliance

### Hot Reload Implementation

- WebSocket server on port 8080
- Automatic extension reload on file changes
- Development mode only
- No impact on production builds

### Asset Management

- Icons copied from `public/icons/`
- Static assets from `src/assets/`
- CSS bundled with components
- HTML templates processed for Vite compatibility

## Troubleshooting

### Common Issues

1. **Extension not loading**: Check `build/manifest.json` exists and is valid
2. **Hot reload not working**: Ensure WebSocket port 8080 is available
3. **TypeScript errors**: Run `npm run type-check` for detailed errors
4. **Build failures**: Check console output and try `npm run clean`

### Debug Mode

Enable debug mode by setting `VITE_DEBUG=true` in your environment or `.env.development` file.

### Clean Build

If you encounter issues, try a clean build:

```bash
npm run clean
npm run build:dev
```

## Performance Optimization

### Development

- Source maps enabled for debugging
- Hot reload for faster iteration
- Incremental TypeScript compilation
- Fast refresh without page reload

### Production

- Code minification with Terser
- Tree shaking for smaller bundles
- Asset optimization
- Manifest optimization

## Contributing

When adding new features to the build system:

1. Update this documentation
2. Add appropriate npm scripts
3. Update VS Code tasks if needed
4. Test both development and production builds
5. Ensure version management integration

## Version Management Integration

The build system integrates with the existing version management:

- Version bumps automatically trigger builds
- Manifest.json and package.json stay in sync
- Git workflow remains unchanged
- TDD workflow fully supported

## Support

For build system issues:

1. Check this documentation
2. Run `npm run validate` to identify issues
3. Check the console output for specific errors
4. Ensure all dependencies are up to date

The build system is designed to be robust and developer-friendly while maintaining the disciplined TDD workflow outlined in CLAUDE.md.
