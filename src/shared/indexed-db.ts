/**
 * IndexedDB utility for caching snippets
 */

import type { TextSnippet } from './types';

const DB_NAME = 'TextExpanderDB';
const DB_VERSION = 1;
const SNIPPET_STORE_NAME = 'snippets';
const IMAGE_STORE_NAME = 'images';

export class IndexedDB {
  private db: IDBDatabase | null = null;

  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        resolve(this.db);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(SNIPPET_STORE_NAME)) {
          db.createObjectStore(SNIPPET_STORE_NAME, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(IMAGE_STORE_NAME)) {
          db.createObjectStore(IMAGE_STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        reject('IndexedDB error: ' + (event.target as IDBOpenDBRequest).error);
      };
    });
  }

  private async getObjectStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.openDB();
    const transaction = db.transaction(SNIPPET_STORE_NAME, mode);
    return transaction.objectStore(SNIPPET_STORE_NAME);
  }

  public async saveSnippets(snippets: TextSnippet[]): Promise<void> {
    const store = await this.getObjectStore('readwrite');
    const clearRequest = store.clear();

    return new Promise((resolve, reject) => {
      clearRequest.onsuccess = () => {
        let count = snippets.length;
        if (count === 0) {
          resolve();
          return;
        }

        for (const snippet of snippets) {
          const addRequest = store.add(snippet);
          addRequest.onsuccess = () => {
            count--;
            if (count === 0) {
              resolve();
            }
          };
          addRequest.onerror = (event) => {
            reject('Error adding snippet: ' + (event.target as IDBRequest).error);
          };
        }
      };
      clearRequest.onerror = (event) => {
        reject('Error clearing store: ' + (event.target as IDBRequest).error);
      };
    });
  }

  public async getSnippets(): Promise<TextSnippet[]> {
    const store = await this.getObjectStore('readonly');
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve(request.result as TextSnippet[]);
      };
      request.onerror = (event) => {
        reject('Error getting snippets: ' + (event.target as IDBRequest).error);
      };
    });
  }

  public async clearSnippets(): Promise<void> {
    const store = await this.getObjectStore('readwrite');
    const request = store.clear();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve();
      };
      request.onerror = (event) => {
        reject('Error clearing snippets: ' + (event.target as IDBRequest).error);
      };
    });
  }

  public async saveImage(id: string, data: Blob): Promise<void> {
    const store = await this.getObjectStore('readwrite');
    const request = store.put({ id, data });

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve();
      };
      request.onerror = (event) => {
        reject('Error saving image: ' + (event.target as IDBRequest).error);
      };
    });
  }

  public async getImage(id: string): Promise<Blob | undefined> {
    const store = await this.getObjectStore('readonly');
    const request = store.get(id);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve(request.result?.data);
      };
      request.onerror = (event) => {
        reject('Error getting image: ' + (event.target as IDBRequest).error);
      };
    });
  }
}
