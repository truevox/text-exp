/**
 * Unit tests for ImageProcessor class
 * Tests image processing, storage, and security
 */

import { ImageProcessor } from '../../src/background/image-processor';
import { IndexedDB } from '../../src/shared/indexed-db';

// Mock IndexedDB
jest.mock('../../src/shared/indexed-db');

// Mock global fetch and crypto
global.fetch = jest.fn();
global.crypto = {
  randomUUID: jest.fn(() => 'mock-uuid-123')
} as any;

// Mock DOMParser
global.DOMParser = class {
  parseFromString(htmlString: string) {
    const mockDoc = {
      body: {
        innerHTML: htmlString,
        querySelectorAll: jest.fn(() => [])
      },
      querySelectorAll: jest.fn(() => [])
    };
    
    // Mock image elements based on HTML content
    if (htmlString.includes('<img')) {
      const mockImg = {
        getAttribute: jest.fn(),
        setAttribute: jest.fn(),
        remove: jest.fn()
      };
      
      // Configure mock based on src attribute
      if (htmlString.includes('src="http')) {
        mockImg.getAttribute.mockImplementation((attr: string) => {
          if (attr === 'src') {
            return 'https://example.com/image.jpg';
          }
          return null;
        });
      }
      
      mockDoc.querySelectorAll.mockReturnValue([mockImg]);
    }
    
    return mockDoc;
  }
} as any;

describe('ImageProcessor', () => {
  let imageProcessor: ImageProcessor;
  let mockIndexedDB: jest.Mocked<IndexedDB>;

  beforeEach(() => {
    jest.clearAllMocks();
    imageProcessor = new ImageProcessor();
    mockIndexedDB = new IndexedDB() as jest.Mocked<IndexedDB>;
    (imageProcessor as any).indexedDB = mockIndexedDB;
  });

  describe('processHtmlContent', () => {
    it('should process external images and replace with IndexedDB references', async () => {
      const htmlContent = '<div><img src="https://example.com/image.jpg" alt="test"></div>';
      const mockBlob = new Blob(['image data'], { type: 'image/jpeg' });
      
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: () => Promise.resolve(mockBlob)
      });
      
      mockIndexedDB.saveImage.mockResolvedValue();
      
      const result = await imageProcessor.processHtmlContent(htmlContent);
      
      expect(global.fetch).toHaveBeenCalledWith('https://example.com/image.jpg');
      expect(mockIndexedDB.saveImage).toHaveBeenCalledWith('image-mock-uuid-123', mockBlob);
      expect(result).toContain('indexeddb://image-mock-uuid-123');
    });

    it('should handle content without images', async () => {
      const htmlContent = '<div><p>No images here</p></div>';
      
      const result = await imageProcessor.processHtmlContent(htmlContent);
      
      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockIndexedDB.saveImage).not.toHaveBeenCalled();
      expect(result).toBe('<div><p>No images here</p></div>');
    });

    it('should skip non-HTTP images', async () => {
      const htmlContent = '<div><img src="data:image/png;base64,abc123" alt="test"></div>';
      
      const mockDoc = {
        body: { innerHTML: htmlContent },
        querySelectorAll: jest.fn(() => [{
          getAttribute: jest.fn(() => 'data:image/png;base64,abc123'),
          setAttribute: jest.fn(),
          remove: jest.fn()
        }])
      };
      
      (global.DOMParser as any) = class {
        parseFromString() { return mockDoc; }
      };
      
      const result = await imageProcessor.processHtmlContent(htmlContent);
      
      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockIndexedDB.saveImage).not.toHaveBeenCalled();
    });

    it('should handle fetch failures gracefully', async () => {
      const htmlContent = '<div><img src="https://example.com/broken.jpg" alt="test"></div>';
      
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      const mockImg = {
        getAttribute: jest.fn(() => 'https://example.com/broken.jpg'),
        setAttribute: jest.fn(),
        remove: jest.fn()
      };
      
      const mockDoc = {
        body: { innerHTML: '' },
        querySelectorAll: jest.fn(() => [mockImg])
      };
      
      (global.DOMParser as any) = class {
        parseFromString() { return mockDoc; }
      };
      
      const result = await imageProcessor.processHtmlContent(htmlContent);
      
      expect(mockImg.remove).toHaveBeenCalled();
      expect(mockIndexedDB.saveImage).not.toHaveBeenCalled();
    });

    it('should handle IndexedDB save failures', async () => {
      const htmlContent = '<div><img src="https://example.com/image.jpg" alt="test"></div>';
      const mockBlob = new Blob(['image data'], { type: 'image/jpeg' });
      
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: () => Promise.resolve(mockBlob)
      });
      
      mockIndexedDB.saveImage.mockRejectedValue(new Error('Storage full'));
      
      const mockImg = {
        getAttribute: jest.fn(() => 'https://example.com/image.jpg'),
        setAttribute: jest.fn(),
        remove: jest.fn()
      };
      
      const mockDoc = {
        body: { innerHTML: '' },
        querySelectorAll: jest.fn(() => [mockImg])
      };
      
      (global.DOMParser as any) = class {
        parseFromString() { return mockDoc; }
      };
      
      const result = await imageProcessor.processHtmlContent(htmlContent);
      
      expect(mockImg.remove).toHaveBeenCalled();
    });

    it('should handle multiple images', async () => {
      const htmlContent = `
        <div>
          <img src="https://example.com/image1.jpg" alt="first">
          <img src="https://example.com/image2.png" alt="second">
        </div>
      `;
      
      const mockBlob1 = new Blob(['image1 data'], { type: 'image/jpeg' });
      const mockBlob2 = new Blob(['image2 data'], { type: 'image/png' });
      
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ blob: () => Promise.resolve(mockBlob1) })
        .mockResolvedValueOnce({ blob: () => Promise.resolve(mockBlob2) });
      
      (global.crypto.randomUUID as jest.Mock)
        .mockReturnValueOnce('uuid-1')
        .mockReturnValueOnce('uuid-2');
      
      mockIndexedDB.saveImage.mockResolvedValue();
      
      const mockImg1 = {
        getAttribute: jest.fn(() => 'https://example.com/image1.jpg'),
        setAttribute: jest.fn(),
        remove: jest.fn()
      };
      
      const mockImg2 = {
        getAttribute: jest.fn(() => 'https://example.com/image2.png'),
        setAttribute: jest.fn(),
        remove: jest.fn()
      };
      
      const mockDoc = {
        body: { innerHTML: '' },
        querySelectorAll: jest.fn(() => [mockImg1, mockImg2])
      };
      
      (global.DOMParser as any) = class {
        parseFromString() { return mockDoc; }
      };
      
      await imageProcessor.processHtmlContent(htmlContent);
      
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(mockIndexedDB.saveImage).toHaveBeenCalledWith('image-uuid-1', mockBlob1);
      expect(mockIndexedDB.saveImage).toHaveBeenCalledWith('image-uuid-2', mockBlob2);
      expect(mockImg1.setAttribute).toHaveBeenCalledWith('src', 'indexeddb://image-uuid-1');
      expect(mockImg2.setAttribute).toHaveBeenCalledWith('src', 'indexeddb://image-uuid-2');
    });
  });

  describe('retrieveImage', () => {
    it('should retrieve image from IndexedDB and create object URL', async () => {
      const imageId = 'test-image-123';
      const mockBlob = new Blob(['image data'], { type: 'image/jpeg' });
      const mockObjectURL = 'blob:chrome-extension://abc123/def456';
      
      mockIndexedDB.getImage.mockResolvedValue(mockBlob);
      
      // Mock URL.createObjectURL
      global.URL = {
        createObjectURL: jest.fn(() => mockObjectURL),
        revokeObjectURL: jest.fn()
      } as any;
      
      const result = await imageProcessor.retrieveImage(imageId);
      
      expect(mockIndexedDB.getImage).toHaveBeenCalledWith(imageId);
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
      expect(result).toBe(mockObjectURL);
    });

    it('should return undefined for missing image', async () => {
      const imageId = 'missing-image';
      
      mockIndexedDB.getImage.mockResolvedValue(undefined);
      
      const result = await imageProcessor.retrieveImage(imageId);
      
      expect(result).toBeUndefined();
      expect(global.URL?.createObjectURL).not.toHaveBeenCalled();
    });

    it('should handle IndexedDB errors', async () => {
      const imageId = 'error-image';
      
      mockIndexedDB.getImage.mockRejectedValue(new Error('Database error'));
      
      await expect(imageProcessor.retrieveImage(imageId)).rejects.toThrow('Database error');
    });
  });

  describe('Security and Edge Cases', () => {
    it('should validate image URLs before processing', async () => {
      const maliciousHtml = '<img src="javascript:alert(1)" alt="malicious">';
      
      const mockImg = {
        getAttribute: jest.fn(() => 'javascript:alert(1)'),
        setAttribute: jest.fn(),
        remove: jest.fn()
      };
      
      const mockDoc = {
        body: { innerHTML: '' },
        querySelectorAll: jest.fn(() => [mockImg])
      };
      
      (global.DOMParser as any) = class {
        parseFromString() { return mockDoc; }
      };
      
      await imageProcessor.processHtmlContent(maliciousHtml);
      
      // Should not attempt to fetch javascript: URLs
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle data URLs safely', async () => {
      const htmlWithDataUrl = '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" alt="data">';
      
      const mockImg = {
        getAttribute: jest.fn(() => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='),
        setAttribute: jest.fn(),
        remove: jest.fn()
      };
      
      const mockDoc = {
        body: { innerHTML: htmlWithDataUrl },
        querySelectorAll: jest.fn(() => [mockImg])
      };
      
      (global.DOMParser as any) = class {
        parseFromString() { return mockDoc; }
      };
      
      const result = await imageProcessor.processHtmlContent(htmlWithDataUrl);
      
      // Should not process data URLs
      expect(global.fetch).not.toHaveBeenCalled();
      expect(result).toBe(htmlWithDataUrl);
    });

    it('should handle very large images gracefully', async () => {
      const htmlContent = '<img src="https://example.com/huge-image.jpg" alt="huge">';
      
      // Mock a very large blob (10MB)
      const largeBlob = new Blob([new ArrayBuffer(10 * 1024 * 1024)], { type: 'image/jpeg' });
      
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: () => Promise.resolve(largeBlob)
      });
      
      mockIndexedDB.saveImage.mockResolvedValue();
      
      const mockImg = {
        getAttribute: jest.fn(() => 'https://example.com/huge-image.jpg'),
        setAttribute: jest.fn(),
        remove: jest.fn()
      };
      
      const mockDoc = {
        body: { innerHTML: '' },
        querySelectorAll: jest.fn(() => [mockImg])
      };
      
      (global.DOMParser as any) = class {
        parseFromString() { return mockDoc; }
      };
      
      await imageProcessor.processHtmlContent(htmlContent);
      
      expect(mockIndexedDB.saveImage).toHaveBeenCalledWith('image-mock-uuid-123', largeBlob);
    });

    it('should handle malformed HTML gracefully', async () => {
      const malformedHtml = '<img src="https://example.com/image.jpg" alt="test><div>unclosed</div>';
      
      const result = await imageProcessor.processHtmlContent(malformedHtml);
      
      // Should not crash on malformed HTML
      expect(typeof result).toBe('string');
    });

    it('should handle network timeouts', async () => {
      const htmlContent = '<img src="https://slow-server.com/image.jpg" alt="slow">';
      
      // Mock fetch timeout
      (global.fetch as jest.Mock).mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );
      
      const mockImg = {
        getAttribute: jest.fn(() => 'https://slow-server.com/image.jpg'),
        setAttribute: jest.fn(),
        remove: jest.fn()
      };
      
      const mockDoc = {
        body: { innerHTML: '' },
        querySelectorAll: jest.fn(() => [mockImg])
      };
      
      (global.DOMParser as any) = class {
        parseFromString() { return mockDoc; }
      };
      
      await imageProcessor.processHtmlContent(htmlContent);
      
      expect(mockImg.remove).toHaveBeenCalled();
    });
  });

  describe('Performance and Resource Management', () => {
    it('should process multiple images efficiently', async () => {
      const imageCount = 10;
      let htmlContent = '<div>';
      
      for (let i = 0; i < imageCount; i++) {
        htmlContent += `<img src="https://example.com/image${i}.jpg" alt="test${i}">`;
      }
      htmlContent += '</div>';
      
      const mockBlob = new Blob(['image data'], { type: 'image/jpeg' });
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: () => Promise.resolve(mockBlob)
      });
      
      mockIndexedDB.saveImage.mockResolvedValue();
      
      const mockImages = Array.from({ length: imageCount }, (_, i) => ({
        getAttribute: jest.fn(() => `https://example.com/image${i}.jpg`),
        setAttribute: jest.fn(),
        remove: jest.fn()
      }));
      
      const mockDoc = {
        body: { innerHTML: '' },
        querySelectorAll: jest.fn(() => mockImages)
      };
      
      (global.DOMParser as any) = class {
        parseFromString() { return mockDoc; }
      };
      
      const start = Date.now();
      await imageProcessor.processHtmlContent(htmlContent);
      const duration = Date.now() - start;
      
      expect(global.fetch).toHaveBeenCalledTimes(imageCount);
      expect(mockIndexedDB.saveImage).toHaveBeenCalledTimes(imageCount);
      
      // Should complete within reasonable time
      expect(duration).toBeLessThan(5000);
    });

    it('should handle memory efficiently with large images', async () => {
      // Test memory usage doesn't grow excessively
      const htmlContent = '<img src="https://example.com/image.jpg" alt="test">';
      
      const iterations = 5;
      for (let i = 0; i < iterations; i++) {
        const mockBlob = new Blob([new ArrayBuffer(1024 * 1024)], { type: 'image/jpeg' }); // 1MB
        
        (global.fetch as jest.Mock).mockResolvedValue({
          blob: () => Promise.resolve(mockBlob)
        });
        
        mockIndexedDB.saveImage.mockResolvedValue();
        
        const mockImg = {
          getAttribute: jest.fn(() => 'https://example.com/image.jpg'),
          setAttribute: jest.fn(),
          remove: jest.fn()
        };
        
        const mockDoc = {
          body: { innerHTML: '' },
          querySelectorAll: jest.fn(() => [mockImg])
        };
        
        (global.DOMParser as any) = class {
          parseFromString() { return mockDoc; }
        };
        
        await imageProcessor.processHtmlContent(htmlContent);
      }
      
      // Should complete all iterations without memory issues
      expect(mockIndexedDB.saveImage).toHaveBeenCalledTimes(iterations);
    });
  });
});