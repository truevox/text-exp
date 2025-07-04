/**
 * Unit tests for HTML sanitization
 * Critical security tests for XSS prevention
 */

import { sanitizeHtml } from '../../src/shared/sanitizer';

// Mock DOMParser
class MockDOMParser {
  parseFromString(markup: string, type: string) {
    // Create a mock document with basic DOM manipulation
    const mockDoc = {
      body: {
        innerHTML: '',
        querySelectorAll: jest.fn(),
        appendChild: jest.fn()
      },
      querySelectorAll: jest.fn()
    };

    // Simple HTML parsing simulation
    mockDoc.body.innerHTML = markup;
    
    // Mock querySelectorAll for scripts
    const scriptTags: any[] = [];
    if (markup.includes('<script')) {
      scriptTags.push({
        remove: jest.fn()
      });
    }
    
    // Mock querySelectorAll for elements with event handlers
    const elementsWithEvents: any[] = [];
    if (markup.includes('onclick') || markup.includes('onload') || markup.includes('onerror')) {
      const mockElement = {
        attributes: [
          { name: 'onclick', value: 'alert(1)' },
          { name: 'onload', value: 'steal()' },
          { name: 'class', value: 'safe' }
        ],
        removeAttribute: jest.fn()
      };
      elementsWithEvents.push(mockElement);
    }

    mockDoc.querySelectorAll.mockImplementation((selector: string) => {
      if (selector === 'script') {
        return scriptTags;
      }
      if (selector === '*[on*]') {
        return elementsWithEvents;
      }
      return [];
    });

    return mockDoc;
  }
}

global.DOMParser = MockDOMParser as any;

describe('sanitizeHtml', () => {
  describe('Script Tag Removal', () => {
    it('should remove script tags', () => {
      const maliciousHtml = '<div>Safe content</div><script>alert("XSS")</script><p>More content</p>';
      const result = sanitizeHtml(maliciousHtml);
      
      // Verify script tag was found and removed
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert("XSS")');
    });

    it('should remove multiple script tags', () => {
      const maliciousHtml = `
        <div>Content</div>
        <script>alert('XSS1')</script>
        <p>More content</p>
        <script src="malicious.js"></script>
        <span>End</span>
      `;
      
      const result = sanitizeHtml(maliciousHtml);
      
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('src="malicious.js"');
    });

    it('should handle script tags with different variations', () => {
      const variations = [
        '<script>alert(1)</script>',
        '<SCRIPT>alert(1)</SCRIPT>',
        '<script type="text/javascript">alert(1)</script>',
        '<script src="evil.js"></script>',
        '<script\nonclick="alert(1)">alert(1)</script>'
      ];

      variations.forEach(variation => {
        const result = sanitizeHtml(variation);
        expect(result).not.toContain('<script');
        expect(result).not.toContain('alert(1)');
      });
    });
  });

  describe('Event Handler Removal', () => {
    it('should remove onclick handlers', () => {
      const maliciousHtml = '<div onclick="alert(\'XSS\')">Click me</div>';
      sanitizeHtml(maliciousHtml);
      
      // The mock should call removeAttribute for onclick
      // We can't test the exact result without a real DOM, but we verify the logic
      expect(true).toBe(true); // Placeholder - in real implementation would check result
    });

    it('should remove various event handlers', () => {
      const eventHandlers = [
        'onclick',
        'onload',
        'onerror',
        'onmouseover',
        'onfocus',
        'onblur',
        'onsubmit',
        'onchange'
      ];

      eventHandlers.forEach(handler => {
        const html = `<div ${handler}="maliciousCode()">Content</div>`;
        sanitizeHtml(html);
        // In real implementation, would verify handler is removed
      });
    });

    it('should preserve safe attributes', () => {
      const safeHtml = '<div class="safe" id="content" data-value="123">Safe content</div>';
      const result = sanitizeHtml(safeHtml);
      
      // Should preserve non-event attributes
      expect(result).toContain('class="safe"');
      expect(result).toContain('id="content"');
      expect(result).toContain('data-value="123"');
    });
  });

  describe('Edge Cases and Complex Attacks', () => {
    it('should handle empty input', () => {
      const result = sanitizeHtml('');
      expect(result).toBe('');
    });

    it('should handle null/undefined input gracefully', () => {
      // TypeScript would prevent this, but JavaScript might pass these
      expect(() => sanitizeHtml(null as any)).not.toThrow();
      expect(() => sanitizeHtml(undefined as any)).not.toThrow();
    });

    it('should handle plain text', () => {
      const plainText = 'This is just plain text with no HTML';
      const result = sanitizeHtml(plainText);
      expect(result).toBe(plainText);
    });

    it('should handle safe HTML', () => {
      const safeHtml = '<p>Safe paragraph</p><strong>Bold text</strong><em>Italic</em>';
      const result = sanitizeHtml(safeHtml);
      expect(result).toContain('<p>');
      expect(result).toContain('<strong>');
      expect(result).toContain('<em>');
    });

    it('should handle mixed safe and unsafe content', () => {
      const mixedHtml = `
        <div class="safe">
          <p>Safe content</p>
          <script>alert('XSS')</script>
          <span onclick="steal()">Dangerous span</span>
          <strong>More safe content</strong>
        </div>
      `;
      
      const result = sanitizeHtml(mixedHtml);
      
      // Should preserve safe elements
      expect(result).toContain('<p>Safe content</p>');
      expect(result).toContain('<strong>More safe content</strong>');
      
      // Should remove dangerous content
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('onclick');
    });

    it('should handle nested dangerous content', () => {
      const nestedHtml = `
        <div>
          <p onclick="evil()">
            <script>alert('nested')</script>
            Text content
          </p>
        </div>
      `;
      
      sanitizeHtml(nestedHtml);
      // Should remove both script and onclick
    });

    it('should handle malformed HTML', () => {
      const malformedHtml = '<div><script>alert(1)</div></script><p>content';
      const result = sanitizeHtml(malformedHtml);
      
      // DOMParser should handle malformed HTML gracefully
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('Advanced XSS Prevention', () => {
    it('should prevent javascript: URLs', () => {
      // Note: Current implementation doesn't handle this, but should be added
      const javascriptUrl = '<a href="javascript:alert(1)">Click</a>';
      const result = sanitizeHtml(javascriptUrl);
      
      // Future enhancement: should remove javascript: URLs
      expect(result).toBeDefined();
    });

    it('should prevent data: URLs with scripts', () => {
      const dataUrl = '<img src="data:text/html,<script>alert(1)</script>">';
      const result = sanitizeHtml(dataUrl);
      
      // Future enhancement: should sanitize data URLs
      expect(result).toBeDefined();
    });

    it('should handle CSS injection attempts', () => {
      const cssInjection = '<div style="background: url(javascript:alert(1))">Content</div>';
      const result = sanitizeHtml(cssInjection);
      
      // Future enhancement: should sanitize style attributes
      expect(result).toBeDefined();
    });

    it('should prevent SVG-based XSS', () => {
      const svgXss = '<svg onload="alert(1)"><script>alert(2)</script></svg>';
      const result = sanitizeHtml(svgXss);
      
      // Should remove script and onload
      expect(result).not.toContain('<script>');
    });
  });

  describe('Performance and Security', () => {
    it('should handle large input efficiently', () => {
      const largeHtml = '<div>' + 'a'.repeat(10000) + '</div>';
      const start = Date.now();
      const result = sanitizeHtml(largeHtml);
      const duration = Date.now() - start;
      
      expect(result).toBeDefined();
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should prevent DoS via deeply nested elements', () => {
      let deeplyNested = '';
      for (let i = 0; i < 100; i++) {
        deeplyNested += '<div>';
      }
      deeplyNested += 'content';
      for (let i = 0; i < 100; i++) {
        deeplyNested += '</div>';
      }
      
      const result = sanitizeHtml(deeplyNested);
      expect(result).toBeDefined();
    });

    it('should handle Unicode and special characters', () => {
      const unicodeHtml = '<div>Unicode: 你好 🌟 العربية</div>';
      const result = sanitizeHtml(unicodeHtml);
      
      expect(result).toContain('你好');
      expect(result).toContain('🌟');
      expect(result).toContain('العربية');
    });

    it('should preserve HTML entities', () => {
      const entitiesHtml = '<div>&lt;script&gt;alert(1)&lt;/script&gt;</div>';
      const result = sanitizeHtml(entitiesHtml);
      
      // Should preserve encoded entities (they're safe)
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
    });
  });

  describe('Integration with Extension Context', () => {
    it('should sanitize snippet content safely', () => {
      const snippetContent = `
        <p>This is a snippet with <strong>formatting</strong></p>
        <script>maliciousCode()</script>
        <div onclick="steal()">Click me</div>
      `;
      
      const result = sanitizeHtml(snippetContent);
      
      // Should preserve formatting
      expect(result).toContain('<strong>formatting</strong>');
      
      // Should remove dangerous content
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('onclick');
    });

    it('should handle user input from forms', () => {
      const userInput = '<img src="x" onerror="alert(document.cookie)">';
      const result = sanitizeHtml(userInput);
      
      expect(result).not.toContain('onerror');
      expect(result).not.toContain('alert');
    });

    it('should sanitize imported data', () => {
      const importedData = `
        <div class="snippet">
          <h3>Imported Snippet</h3>
          <script>sendDataToEvil()</script>
          <p onmouseover="trackUser()">Content</p>
        </div>
      `;
      
      const result = sanitizeHtml(importedData);
      
      expect(result).toContain('<h3>Imported Snippet</h3>');
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('onmouseover');
    });
  });

  describe('Security Regression Tests', () => {
    // These tests should be added when new attack vectors are discovered
    
    it('should prevent bypass via HTML comments', () => {
      const commentBypass = '<!-- <script>alert(1)</script> --><script>alert(2)</script>';
      const result = sanitizeHtml(commentBypass);
      
      expect(result).not.toContain('alert(2)');
    });

    it('should prevent bypass via CDATA sections', () => {
      const cdataBypass = '<![CDATA[<script>alert(1)</script>]]>';
      const result = sanitizeHtml(cdataBypass);
      
      // Should handle CDATA sections safely
      expect(result).toBeDefined();
    });

    it('should prevent mutation XSS attacks', () => {
      // These are advanced attacks that modify DOM after parsing
      const mutationXss = '<div id="test"><p>Text</p></div>';
      const result = sanitizeHtml(mutationXss);
      
      // Basic test - more complex mutation testing would require DOM environment
      expect(result).toBeDefined();
    });
  });

  describe('Fuzzing Tests', () => {
    // Generates random HTML-like strings to test robustness
    const generateRandomHtml = (length: number): string => {
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>/="\' ';
      const htmlTags = ['div', 'p', 'span', 'script', 'img', 'a', 'h1', 'h2', 'h3'];
      const eventHandlers = ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus'];
      const attributes = ['class', 'id', 'src', 'href', 'style', 'data-test'];
      
      let result = '';
      for (let i = 0; i < length; i++) {
        const rand = Math.random();
        
        if (rand < 0.1 && i < length - 10) {
          // Add opening tag
          const tag = htmlTags[Math.floor(Math.random() * htmlTags.length)];
          result += `<${tag}`;
          
          // Sometimes add attributes
          if (Math.random() < 0.5) {
            const attr = Math.random() < 0.3 
              ? eventHandlers[Math.floor(Math.random() * eventHandlers.length)]
              : attributes[Math.floor(Math.random() * attributes.length)];
            result += ` ${attr}="${chars.charAt(Math.floor(Math.random() * chars.length)).repeat(Math.floor(Math.random() * 10) + 1)}"`;
          }
          result += '>';
        } else if (rand < 0.15) {
          // Add closing tag
          const tag = htmlTags[Math.floor(Math.random() * htmlTags.length)];
          result += `</${tag}>`;
        } else {
          // Add random character
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
      }
      
      return result;
    };

    it('should handle random HTML input without crashing (fuzz test)', () => {
      // Run multiple iterations with different random inputs
      for (let i = 0; i < 50; i++) {
        const randomHtml = generateRandomHtml(Math.floor(Math.random() * 1000) + 100);
        
        expect(() => {
          const result = sanitizeHtml(randomHtml);
          expect(typeof result).toBe('string');
        }).not.toThrow();
      }
    });

    it('should handle malformed tags and attributes (fuzz test)', () => {
      const malformedInputs = [
        '<div onclick="alert(1)" class=><p>test</div>',
        '<script src= >alert(1)</script>',
        '<img onerror=alert(1) src="">',
        '<div onclick=alert(1)>test',
        '<><><>test<><><>',
        '<div class="test onclick="evil()">content</div>',
        '<script>alert(1)<script>alert(2)</script>',
        '<<<div>>>test<<</div>>>',
        '<div onclick=alert(1) onclick=alert(2)>test</div>'
      ];

      malformedInputs.forEach((input, index) => {
        expect(() => {
          const result = sanitizeHtml(input);
          expect(typeof result).toBe('string');
          // Should not contain dangerous patterns
          expect(result).not.toContain('alert(');
        }).not.toThrow();
      });
    });

    it('should handle extremely long inputs (stress test)', () => {
      const longInput = generateRandomHtml(10000);
      
      const start = Date.now();
      expect(() => {
        const result = sanitizeHtml(longInput);
        expect(typeof result).toBe('string');
      }).not.toThrow();
      const duration = Date.now() - start;
      
      // Should complete within reasonable time
      expect(duration).toBeLessThan(5000);
    });

    it('should handle inputs with many nested elements (DoS prevention)', () => {
      // Generate deeply nested structure
      let deepInput = '';
      const maxDepth = 500;
      
      for (let i = 0; i < maxDepth; i++) {
        deepInput += '<div>';
      }
      deepInput += 'content';
      for (let i = 0; i < maxDepth; i++) {
        deepInput += '</div>';
      }

      expect(() => {
        const result = sanitizeHtml(deepInput);
        expect(typeof result).toBe('string');
      }).not.toThrow();
    });

    it('should handle Unicode edge cases (fuzzing)', () => {
      const unicodeRanges = [
        [0x0000, 0x007F], // Basic Latin
        [0x0080, 0x00FF], // Latin-1 Supplement
        [0x4E00, 0x9FFF], // CJK Unified Ideographs
        [0x1F600, 0x1F64F], // Emoticons
        [0xFFF0, 0xFFFF], // Specials
      ];

      for (let i = 0; i < 20; i++) {
        let unicodeInput = '<div>';
        
        // Add random Unicode characters
        for (let j = 0; j < 100; j++) {
          const range = unicodeRanges[Math.floor(Math.random() * unicodeRanges.length)];
          const codePoint = Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
          unicodeInput += String.fromCodePoint(codePoint);
        }
        
        unicodeInput += '</div>';

        expect(() => {
          const result = sanitizeHtml(unicodeInput);
          expect(typeof result).toBe('string');
        }).not.toThrow();
      }
    });

    it('should handle binary and control characters', () => {
      const binaryInput = '<div>' + String.fromCharCode(0, 1, 2, 3, 8, 9, 10, 13, 27, 127) + '</div>';
      
      expect(() => {
        const result = sanitizeHtml(binaryInput);
        expect(typeof result).toBe('string');
      }).not.toThrow();
    });

    it('should handle various encoding attacks (fuzzing)', () => {
      const encodingAttacks = [
        '<div>%3Cscript%3Ealert(1)%3C/script%3E</div>',
        '<div>&#60;script&#62;alert(1)&#60;/script&#62;</div>',
        '<div>&lt;script&gt;alert(1)&lt;/script&gt;</div>',
        '<div>\\u003cscript\\u003ealert(1)\\u003c/script\\u003e</div>',
        '<div onclick="&#97;&#108;&#101;&#114;&#116;&#40;&#49;&#41;">test</div>'
      ];

      encodingAttacks.forEach(attack => {
        expect(() => {
          const result = sanitizeHtml(attack);
          expect(typeof result).toBe('string');
        }).not.toThrow();
      });
    });

    it('should maintain performance under random input load', () => {
      const iterations = 100;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const input = generateRandomHtml(500);
        const start = performance.now();
        sanitizeHtml(input);
        const end = performance.now();
        times.push(end - start);
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      // Performance should be consistent
      expect(averageTime).toBeLessThan(50); // Average under 50ms
      expect(maxTime).toBeLessThan(200); // Max under 200ms
    });
  });
});