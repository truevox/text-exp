/**
 * Jest test setup file
 * Global configuration and mocks for Chrome extension testing
 */

// Mock Chrome APIs
global.chrome = {
  storage: {
    local: {
      get: jest.fn((keys) => {
        // Return empty object structure that matches expected format
        if (typeof keys === 'string') {
          return Promise.resolve({ [keys]: undefined });
        }
        if (Array.isArray(keys)) {
          const result = {};
          keys.forEach(key => result[key] = undefined);
          return Promise.resolve(result);
        }
        return Promise.resolve({});
      }),
      set: jest.fn(() => Promise.resolve()),
      remove: jest.fn(() => Promise.resolve()),
      clear: jest.fn(() => Promise.resolve())
    },
    sync: {
      get: jest.fn((keys) => {
        // Return empty object structure that matches expected format
        if (typeof keys === 'string') {
          // For settings key, return undefined (which will be handled by DEFAULT_SETTINGS fallback)
          return Promise.resolve({ [keys]: undefined });
        }
        if (Array.isArray(keys)) {
          const result = {};
          keys.forEach(key => result[key] = undefined);
          return Promise.resolve(result);
        }
        return Promise.resolve({});
      }),
      set: jest.fn(() => Promise.resolve()),
      remove: jest.fn(() => Promise.resolve()),
      clear: jest.fn(() => Promise.resolve())
    }
  },
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    onInstalled: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },
  identity: {
    getAuthToken: jest.fn(),
    launchWebAuthFlow: jest.fn()
  },
  tabs: {
    sendMessage: jest.fn(),
    query: jest.fn()
  },
  notifications: {
    create: jest.fn(),
    clear: jest.fn(),
    getAll: jest.fn()
  }
} as any;

// Mock window.location for tests (if available)
if (typeof window !== 'undefined' && !window.location) {
  Object.defineProperty(window, 'location', {
    value: {
      href: 'https://example.com',
      hostname: 'example.com'
    },
    configurable: true
  });
}

// Mock console methods for cleaner test output (but allow real console.log for debugging)
global.console = {
  ...console,
  log: console.log, // Keep real console.log for debugging
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};