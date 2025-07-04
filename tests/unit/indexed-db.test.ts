/**
 * Unit tests for IndexedDB class
 * Tests async operations, error handling, and storage consistency
 */

import { IndexedDB } from '../../src/shared/indexed-db';
import type { TextSnippet } from '../../src/shared/types';

// Mock IndexedDB
global.indexedDB = {
  open: jest.fn(),
  deleteDatabase: jest.fn(),
  databases: jest.fn()
} as any;

describe('IndexedDB', () => {
  let indexedDB: IndexedDB;
  let mockDB: any;
  let mockTransaction: any;
  let mockStore: any;
  let mockRequest: any;

  beforeEach(() => {
    indexedDB = new IndexedDB();
    
    // Create mock objects
    mockRequest = {
      result: null,
      error: null,
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null
    };
    
    mockStore = {
      add: jest.fn(() => mockRequest),
      getAll: jest.fn(() => mockRequest),
      clear: jest.fn(() => mockRequest),
      put: jest.fn(() => mockRequest),
      get: jest.fn(() => mockRequest)
    };
    
    mockTransaction = {
      objectStore: jest.fn(() => mockStore),
      abort: jest.fn(),
      oncomplete: null,
      onerror: null
    };
    
    mockDB = {
      transaction: jest.fn(() => mockTransaction),
      createObjectStore: jest.fn(() => mockStore),
      objectStoreNames: {
        contains: jest.fn(() => false)
      },
      close: jest.fn()
    };
    
    // Mock indexedDB.open
    (global.indexedDB.open as jest.Mock).mockReturnValue(mockRequest);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Database Connection', () => {
    it('should open database successfully', async () => {
      // Setup successful connection
      setTimeout(() => {
        mockRequest.result = mockDB;
        mockRequest.onsuccess?.(new Event('success'));
      }, 0);

      const db = await (indexedDB as any).openDB();
      expect(db).toBe(mockDB);
      expect(global.indexedDB.open).toHaveBeenCalledWith('TextExpanderDB', 1);
    });

    it('should handle database upgrade needed', async () => {
      setTimeout(() => {
        mockRequest.result = mockDB;
        mockRequest.onupgradeneeded?.(new Event('upgradeneeded'));
        mockRequest.onsuccess?.(new Event('success'));
      }, 0);

      await (indexedDB as any).openDB();
      
      expect(mockDB.createObjectStore).toHaveBeenCalledWith('snippets', { keyPath: 'id' });
      expect(mockDB.createObjectStore).toHaveBeenCalledWith('images', { keyPath: 'id' });
    });

    it('should handle database connection errors', async () => {
      setTimeout(() => {
        mockRequest.error = new Error('Connection failed');
        mockRequest.onerror?.(new Event('error'));
      }, 0);

      await expect((indexedDB as any).openDB()).rejects.toMatch(/IndexedDB error/);
    });

    it('should reuse existing connection', async () => {
      // First connection
      setTimeout(() => {
        mockRequest.result = mockDB;
        mockRequest.onsuccess?.(new Event('success'));
      }, 0);

      const db1 = await (indexedDB as any).openDB();
      
      // Second call should reuse connection
      const db2 = await (indexedDB as any).openDB();
      
      expect(db1).toBe(db2);
      expect(global.indexedDB.open).toHaveBeenCalledTimes(1);
    });
  });

  describe('Snippet Operations', () => {
    const mockSnippets: TextSnippet[] = [
      {
        id: '1',
        trigger: 'test1',
        content: 'Test content 1',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '2',
        trigger: 'test2',
        content: 'Test content 2',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    beforeEach(() => {
      // Setup successful database connection
      setTimeout(() => {
        mockRequest.result = mockDB;
        mockRequest.onsuccess?.(new Event('success'));
      }, 0);
    });

    it('should save snippets successfully', async () => {
      // Mock clear operation
      const clearRequest = { ...mockRequest };
      mockStore.clear.mockReturnValue(clearRequest);
      
      // Mock add operations
      const addRequests = mockSnippets.map(() => ({ ...mockRequest }));
      mockStore.add.mockImplementation(() => addRequests.shift());

      setTimeout(() => {
        clearRequest.onsuccess?.(new Event('success'));
        addRequests.forEach(req => req.onsuccess?.(new Event('success')));
      }, 0);

      await indexedDB.saveSnippets(mockSnippets);
      
      expect(mockStore.clear).toHaveBeenCalled();
      expect(mockStore.add).toHaveBeenCalledTimes(2);
      expect(mockStore.add).toHaveBeenCalledWith(mockSnippets[0]);
      expect(mockStore.add).toHaveBeenCalledWith(mockSnippets[1]);
    });

    it('should handle empty snippets array', async () => {
      const clearRequest = { ...mockRequest };
      mockStore.clear.mockReturnValue(clearRequest);

      setTimeout(() => {
        clearRequest.onsuccess?.(new Event('success'));
      }, 0);

      await indexedDB.saveSnippets([]);
      
      expect(mockStore.clear).toHaveBeenCalled();
      expect(mockStore.add).not.toHaveBeenCalled();
    });

    it('should handle save errors', async () => {
      const clearRequest = { ...mockRequest };
      mockStore.clear.mockReturnValue(clearRequest);

      setTimeout(() => {
        clearRequest.error = new Error('Clear failed');
        clearRequest.onerror?.(new Event('error'));
      }, 0);

      await expect(indexedDB.saveSnippets(mockSnippets)).rejects.toMatch(/Error clearing store/);
    });

    it('should handle add errors', async () => {
      const clearRequest = { ...mockRequest };
      const addRequest = { ...mockRequest };
      
      mockStore.clear.mockReturnValue(clearRequest);
      mockStore.add.mockReturnValue(addRequest);

      setTimeout(() => {
        clearRequest.onsuccess?.(new Event('success'));
        addRequest.error = new Error('Add failed');
        addRequest.onerror?.(new Event('error'));
      }, 0);

      await expect(indexedDB.saveSnippets([mockSnippets[0]])).rejects.toMatch(/Error adding snippet/);
    });

    it('should get snippets successfully', async () => {
      const getRequest = { ...mockRequest };
      mockStore.getAll.mockReturnValue(getRequest);

      setTimeout(() => {
        getRequest.result = mockSnippets;
        getRequest.onsuccess?.(new Event('success'));
      }, 0);

      const result = await indexedDB.getSnippets();
      
      expect(result).toEqual(mockSnippets);
      expect(mockStore.getAll).toHaveBeenCalled();
    });

    it('should handle get snippets errors', async () => {
      const getRequest = { ...mockRequest };
      mockStore.getAll.mockReturnValue(getRequest);

      setTimeout(() => {
        getRequest.error = new Error('Get failed');
        getRequest.onerror?.(new Event('error'));
      }, 0);

      await expect(indexedDB.getSnippets()).rejects.toMatch(/Error getting snippets/);
    });

    it('should clear snippets successfully', async () => {
      const clearRequest = { ...mockRequest };
      mockStore.clear.mockReturnValue(clearRequest);

      setTimeout(() => {
        clearRequest.onsuccess?.(new Event('success'));
      }, 0);

      await indexedDB.clearSnippets();
      
      expect(mockStore.clear).toHaveBeenCalled();
    });

    it('should handle clear snippets errors', async () => {
      const clearRequest = { ...mockRequest };
      mockStore.clear.mockReturnValue(clearRequest);

      setTimeout(() => {
        clearRequest.error = new Error('Clear failed');
        clearRequest.onerror?.(new Event('error'));
      }, 0);

      await expect(indexedDB.clearSnippets()).rejects.toMatch(/Error clearing snippets/);
    });
  });

  describe('Image Operations', () => {
    const mockImageId = 'test-image-123';
    const mockImageBlob = new Blob(['image data'], { type: 'image/png' });

    beforeEach(() => {
      setTimeout(() => {
        mockRequest.result = mockDB;
        mockRequest.onsuccess?.(new Event('success'));
      }, 0);
    });

    it('should save image successfully', async () => {
      const putRequest = { ...mockRequest };
      mockStore.put.mockReturnValue(putRequest);

      setTimeout(() => {
        putRequest.onsuccess?.(new Event('success'));
      }, 0);

      await indexedDB.saveImage(mockImageId, mockImageBlob);
      
      expect(mockStore.put).toHaveBeenCalledWith({
        id: mockImageId,
        data: mockImageBlob
      });
    });

    it('should handle save image errors', async () => {
      const putRequest = { ...mockRequest };
      mockStore.put.mockReturnValue(putRequest);

      setTimeout(() => {
        putRequest.error = new Error('Put failed');
        putRequest.onerror?.(new Event('error'));
      }, 0);

      await expect(indexedDB.saveImage(mockImageId, mockImageBlob)).rejects.toMatch(/Error saving image/);
    });

    it('should get image successfully', async () => {
      const getRequest = { ...mockRequest };
      mockStore.get.mockReturnValue(getRequest);

      setTimeout(() => {
        getRequest.result = { id: mockImageId, data: mockImageBlob };
        getRequest.onsuccess?.(new Event('success'));
      }, 0);

      const result = await indexedDB.getImage(mockImageId);
      
      expect(result).toBe(mockImageBlob);
      expect(mockStore.get).toHaveBeenCalledWith(mockImageId);
    });

    it('should handle missing image', async () => {
      const getRequest = { ...mockRequest };
      mockStore.get.mockReturnValue(getRequest);

      setTimeout(() => {
        getRequest.result = undefined;
        getRequest.onsuccess?.(new Event('success'));
      }, 0);

      const result = await indexedDB.getImage(mockImageId);
      
      expect(result).toBeUndefined();
    });

    it('should handle get image errors', async () => {
      const getRequest = { ...mockRequest };
      mockStore.get.mockReturnValue(getRequest);

      setTimeout(() => {
        getRequest.error = new Error('Get failed');
        getRequest.onerror?.(new Event('error'));
      }, 0);

      await expect(indexedDB.getImage(mockImageId)).rejects.toMatch(/Error getting image/);
    });
  });

  describe('Transaction Management', () => {
    beforeEach(() => {
      setTimeout(() => {
        mockRequest.result = mockDB;
        mockRequest.onsuccess?.(new Event('success'));
      }, 0);
    });

    it('should create read-only transactions', async () => {
      await (indexedDB as any).getObjectStore('readonly');
      
      expect(mockDB.transaction).toHaveBeenCalledWith('snippets', 'readonly');
      expect(mockTransaction.objectStore).toHaveBeenCalledWith('snippets');
    });

    it('should create read-write transactions', async () => {
      await (indexedDB as any).getObjectStore('readwrite');
      
      expect(mockDB.transaction).toHaveBeenCalledWith('snippets', 'readwrite');
      expect(mockTransaction.objectStore).toHaveBeenCalledWith('snippets');
    });
  });
});