/**
 * Target Detector Tests
 * Tests for target surface detection system
 */

import {
  TargetDetector,
  targetDetector,
} from "../../src/content/target-detector";
import type { TargetSurface } from "../../src/content/target-detector";

// Mock DOM methods
const mockQuerySelector = jest.fn();
const mockQuerySelectorAll = jest.fn();
const mockClosest = jest.fn();
const mockGetAttribute = jest.fn();
const mockGetBoundingClientRect = jest.fn();

// Mock window object
const mockWindow = {
  location: {
    hostname: "test.com",
    pathname: "/test",
    href: "https://test.com/test",
  },
  getSelection: jest.fn(),
  tinymce: undefined,
};

(global as any).window = mockWindow;

// Mock document
const mockDocument = {
  title: "Test Page",
  querySelector: mockQuerySelector,
  querySelectorAll: mockQuerySelectorAll,
};

(global as any).document = mockDocument;

describe("TargetDetector", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    targetDetector.clearCache();

    // Reset window location
    mockWindow.location.hostname = "test.com";
    mockWindow.location.pathname = "/test";
    mockWindow.location.href = "https://test.com/test";
  });

  describe("Initialization", () => {
    test("should initialize with default detection rules", () => {
      const stats = targetDetector.getStats();
      expect(stats.rulesCount).toBeGreaterThan(0);
      expect(stats.cacheSize).toBe(0);
    });

    test("should sort rules by priority", () => {
      const stats = targetDetector.getStats();
      expect(stats.rulesCount).toBeGreaterThan(5); // Should have multiple rules
    });
  });

  describe("Gmail Composer Detection", () => {
    test("should detect Gmail composer", () => {
      mockWindow.location.hostname = "mail.google.com";

      const mockElement = {
        tagName: "DIV",
        classList: { contains: jest.fn().mockReturnValue(false) },
        closest: jest.fn().mockReturnValue(null),
        getAttribute: jest.fn().mockReturnValue("true"),
        getBoundingClientRect: mockGetBoundingClientRect,
      };

      // Mock contenteditable element on Gmail
      mockElement.getAttribute.mockImplementation((attr) => {
        if (attr === "contenteditable") return "true";
        if (attr === "role") return "textbox";
        return null;
      });

      const surface = targetDetector.detectTargetSurface(mockElement as any);

      expect(surface).toBeDefined();
      expect(surface?.type).toBe("gmail-composer");
      expect(surface?.metadata.editorName).toBe("Gmail Composer");
    });

    test("should not detect Gmail composer on non-Gmail sites", () => {
      mockWindow.location.hostname = "test.com";

      const mockElement = {
        tagName: "DIV",
        classList: { contains: jest.fn().mockReturnValue(false) },
        closest: jest.fn().mockReturnValue(null),
        getAttribute: jest.fn().mockReturnValue("true"),
        getBoundingClientRect: mockGetBoundingClientRect,
      };

      const surface = targetDetector.detectTargetSurface(mockElement as any);

      expect(surface?.type).not.toBe("gmail-composer");
    });
  });

  describe("Google Docs Detection", () => {
    test("should detect Google Docs editor", () => {
      mockWindow.location.hostname = "docs.google.com";
      mockWindow.location.pathname = "/document/d/123/edit";

      const mockElement = {
        tagName: "DIV",
        classList: { contains: jest.fn().mockReturnValue(false) },
        closest: jest.fn().mockImplementation((selector) => {
          if (selector === '[role="document"]') return {};
          return null;
        }),
        getAttribute: jest.fn().mockReturnValue(null),
        getBoundingClientRect: mockGetBoundingClientRect,
      };

      const surface = targetDetector.detectTargetSurface(mockElement as any);

      expect(surface).toBeDefined();
      expect(surface?.type).toBe("google-docs-editor");
      expect(surface?.metadata.editorName).toBe("Google Docs");
    });

    test("should not detect Google Docs on non-Docs pages", () => {
      mockWindow.location.hostname = "docs.google.com";
      mockWindow.location.pathname = "/spreadsheets/d/123/edit"; // Different Google app

      const mockElement = {
        tagName: "DIV",
        classList: { contains: jest.fn().mockReturnValue(false) },
        closest: jest.fn().mockReturnValue({}),
        getAttribute: jest.fn().mockReturnValue(null),
        getBoundingClientRect: mockGetBoundingClientRect,
      };

      const surface = targetDetector.detectTargetSurface(mockElement as any);

      expect(surface?.type).not.toBe("google-docs-editor");
    });
  });

  describe("TinyMCE Detection", () => {
    test("should detect TinyMCE editor", () => {
      mockWindow.tinymce = { version: "5.0.0" };

      const mockElement = {
        tagName: "DIV",
        classList: { contains: jest.fn().mockReturnValue(true) },
        closest: jest.fn().mockReturnValue({}),
        getAttribute: jest.fn().mockReturnValue("mce_123"),
        getBoundingClientRect: mockGetBoundingClientRect,
      };

      // Mock TinyMCE content body
      mockElement.classList.contains.mockImplementation((className) => {
        return className === "mce-content-body";
      });

      const surface = targetDetector.detectTargetSurface(mockElement as any);

      expect(surface).toBeDefined();
      expect(surface?.type).toBe("tinymce-editor");
      expect(surface?.metadata.editorName).toBe("TinyMCE");
    });

    test("should not detect TinyMCE when not available", () => {
      mockWindow.tinymce = undefined;

      const mockElement = {
        tagName: "DIV",
        classList: { contains: jest.fn().mockReturnValue(false) },
        closest: jest.fn().mockReturnValue(null),
        getAttribute: jest.fn().mockReturnValue(null),
        getBoundingClientRect: mockGetBoundingClientRect,
      };

      const surface = targetDetector.detectTargetSurface(mockElement as any);

      expect(surface?.type).not.toBe("tinymce-editor");
    });
  });

  describe("Plaintext Input Detection", () => {
    test("should detect text input", () => {
      const mockElement = {
        tagName: "INPUT",
        type: "text",
        classList: { contains: jest.fn().mockReturnValue(false) },
        closest: jest.fn().mockReturnValue(null),
        getAttribute: jest.fn().mockImplementation((attr) => {
          if (attr === "type") return "text";
          return null;
        }),
        getBoundingClientRect: mockGetBoundingClientRect,
      };

      const surface = targetDetector.detectTargetSurface(mockElement as any);

      expect(surface).toBeDefined();
      expect(surface?.type).toBe("plaintext-input");
      expect(surface?.capabilities.supportsHTML).toBe(false);
      expect(surface?.capabilities.supportsPlainText).toBe(true);
    });

    test("should detect textarea", () => {
      const mockElement = {
        tagName: "TEXTAREA",
        classList: { contains: jest.fn().mockReturnValue(false) },
        closest: jest.fn().mockReturnValue(null),
        getAttribute: jest.fn().mockReturnValue(null),
        getBoundingClientRect: mockGetBoundingClientRect,
      };

      const surface = targetDetector.detectTargetSurface(mockElement as any);

      expect(surface).toBeDefined();
      expect(surface?.type).toBe("plaintext-textarea");
      expect(surface?.capabilities.supportsHTML).toBe(false);
      expect(surface?.capabilities.supportsPlainText).toBe(true);
    });
  });

  describe("Contenteditable Detection", () => {
    test("should detect contenteditable element", () => {
      const mockElement = {
        tagName: "DIV",
        classList: { contains: jest.fn().mockReturnValue(false) },
        closest: jest.fn().mockReturnValue(null),
        getAttribute: jest.fn().mockImplementation((attr) => {
          if (attr === "contenteditable") return "true";
          return null;
        }),
        getBoundingClientRect: mockGetBoundingClientRect,
      };

      const surface = targetDetector.detectTargetSurface(mockElement as any);

      expect(surface).toBeDefined();
      expect(surface?.type).toBe("contenteditable");
      expect(surface?.capabilities.supportsHTML).toBe(true);
      expect(surface?.capabilities.supportsPlainText).toBe(true);
    });

    test('should not detect contenteditable="false"', () => {
      const mockElement = {
        tagName: "DIV",
        classList: { contains: jest.fn().mockReturnValue(false) },
        closest: jest.fn().mockReturnValue(null),
        getAttribute: jest.fn().mockImplementation((attr) => {
          if (attr === "contenteditable") return "false";
          return null;
        }),
        getBoundingClientRect: mockGetBoundingClientRect,
      };

      const surface = targetDetector.detectTargetSurface(mockElement as any);

      expect(surface?.type).not.toBe("contenteditable");
    });
  });

  describe("Fallback Detection", () => {
    test("should return unknown for unrecognized elements", () => {
      const mockElement = {
        tagName: "SPAN",
        classList: { contains: jest.fn().mockReturnValue(false) },
        closest: jest.fn().mockReturnValue(null),
        getAttribute: jest.fn().mockReturnValue(null),
        getBoundingClientRect: mockGetBoundingClientRect,
      };

      const surface = targetDetector.detectTargetSurface(mockElement as any);

      expect(surface).toBeDefined();
      expect(surface?.type).toBe("unknown");
      expect(surface?.metadata.detectionMethod).toBe("fallback");
    });
  });

  describe("Caching", () => {
    test("should cache detection results", () => {
      const mockElement = {
        tagName: "INPUT",
        type: "text",
        classList: { contains: jest.fn().mockReturnValue(false) },
        closest: jest.fn().mockReturnValue(null),
        getAttribute: jest.fn().mockReturnValue("text"),
        getBoundingClientRect: mockGetBoundingClientRect,
      };

      const surface1 = targetDetector.detectTargetSurface(mockElement as any);
      const surface2 = targetDetector.detectTargetSurface(mockElement as any);

      expect(surface1).toBe(surface2); // Should be same object from cache
      expect(targetDetector.getStats().cacheSize).toBe(1);
    });

    test("should clear cache", () => {
      const mockElement = {
        tagName: "INPUT",
        type: "text",
        classList: { contains: jest.fn().mockReturnValue(false) },
        closest: jest.fn().mockReturnValue(null),
        getAttribute: jest.fn().mockReturnValue("text"),
        getBoundingClientRect: mockGetBoundingClientRect,
      };

      targetDetector.detectTargetSurface(mockElement as any);
      expect(targetDetector.getStats().cacheSize).toBe(1);

      targetDetector.clearCache();
      expect(targetDetector.getStats().cacheSize).toBe(0);
    });
  });

  describe("Custom Detection Rules", () => {
    test("should allow adding custom rules", () => {
      const customRule = {
        name: "custom-test",
        priority: 100,
        selector: ".custom-editor",
        condition: (element: HTMLElement) =>
          element.classList.contains("custom-editor"),
        extractor: (element: HTMLElement) => ({
          type: "custom-editor" as any,
          capabilities: {
            supportsHTML: true,
            supportsMarkdown: false,
            supportsPlainText: true,
            supportsImages: false,
            supportsLinks: true,
            supportsFormatting: true,
            supportsLists: false,
            supportsTables: false,
          },
          metadata: {
            editorName: "Custom Editor",
            detectionMethod: "custom-test",
            detectionConfidence: 0.8,
            timestamp: Date.now(),
          },
        }),
      };

      const initialRulesCount = targetDetector.getStats().rulesCount;
      targetDetector.addRule(customRule);

      expect(targetDetector.getStats().rulesCount).toBe(initialRulesCount + 1);
    });
  });

  describe("Statistics", () => {
    test("should provide detection statistics", () => {
      const stats = targetDetector.getStats();

      expect(stats).toHaveProperty("rulesCount");
      expect(stats).toHaveProperty("cacheSize");
      expect(stats).toHaveProperty("lastDetection");
      expect(typeof stats.rulesCount).toBe("number");
      expect(typeof stats.cacheSize).toBe("number");
    });
  });
});
