/**
 * IndexedDB utility for caching snippets
 */

import type { TextSnippet } from "./types";

const DB_NAME = "TextExpanderDB";
const DB_VERSION = 1;
const SNIPPET_STORE_NAME = "snippets";
const IMAGE_STORE_NAME = "images";

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
          db.createObjectStore(SNIPPET_STORE_NAME, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(IMAGE_STORE_NAME)) {
          db.createObjectStore(IMAGE_STORE_NAME, { keyPath: "id" });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        reject("IndexedDB error: " + (event.target as IDBOpenDBRequest).error);
      };
    });
  }

  private async getObjectStore(
    mode: IDBTransactionMode,
  ): Promise<IDBObjectStore> {
    const db = await this.openDB();
    const transaction = db.transaction(SNIPPET_STORE_NAME, mode);
    return transaction.objectStore(SNIPPET_STORE_NAME);
  }

  public async saveSnippets(snippets: TextSnippet[]): Promise<void> {
    console.log(
      `🔍 [INDEXEDDB-DEBUG] saveSnippets called with ${snippets.length} snippets`,
    );
    snippets.forEach((snippet, index) => {
      console.log(`  📋 Snippet ${index + 1} to save:`, {
        id: snippet.id,
        trigger: snippet.trigger,
        content: snippet.content?.substring(0, 50) + "...",
        source: (snippet as any).source,
        hasRequiredFields: !!(snippet.id && snippet.trigger && snippet.content),
      });
    });

    const store = await this.getObjectStore("readwrite");
    console.log(
      `🔍 [INDEXEDDB-DEBUG] Got object store, clearing existing data`,
    );
    const clearRequest = store.clear();

    return new Promise((resolve, reject) => {
      clearRequest.onsuccess = () => {
        console.log(
          `🔍 [INDEXEDDB-DEBUG] Store cleared successfully, adding ${snippets.length} snippets`,
        );
        let count = snippets.length;
        if (count === 0) {
          console.log(`🔍 [INDEXEDDB-DEBUG] No snippets to save, resolving`);
          resolve();
          return;
        }

        let successCount = 0;
        let errorCount = 0;

        for (const snippet of snippets) {
          console.log(
            `🔍 [INDEXEDDB-DEBUG] Adding snippet with ID: ${snippet.id}, trigger: ${snippet.trigger}`,
          );
          const addRequest = store.add(snippet);
          addRequest.onsuccess = () => {
            successCount++;
            console.log(
              `✅ [INDEXEDDB-DEBUG] Successfully added snippet ${successCount}/${snippets.length}: ${snippet.trigger}`,
            );
            count--;
            if (count === 0) {
              console.log(
                `🔍 [INDEXEDDB-DEBUG] All snippets processed. Success: ${successCount}, Errors: ${errorCount}`,
              );
              resolve();
            }
          };
          addRequest.onerror = (event) => {
            errorCount++;
            const error = (event.target as IDBRequest).error;
            console.error(
              `❌ [INDEXEDDB-DEBUG] Error adding snippet ${snippet.trigger}:`,
              error,
            );
            console.error(`❌ [INDEXEDDB-DEBUG] Failed snippet data:`, {
              id: snippet.id,
              trigger: snippet.trigger,
              content: snippet.content?.substring(0, 100),
              source: (snippet as any).source,
            });
            reject("Error adding snippet: " + error);
          };
        }
      };
      clearRequest.onerror = (event) => {
        console.error(
          `❌ [INDEXEDDB-DEBUG] Error clearing store:`,
          (event.target as IDBRequest).error,
        );
        reject("Error clearing store: " + (event.target as IDBRequest).error);
      };
    });
  }

  public async getSnippets(): Promise<TextSnippet[]> {
    console.log(`🔍 [INDEXEDDB-DEBUG] getSnippets called`);
    const store = await this.getObjectStore("readonly");
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const result = request.result as TextSnippet[];
        console.log(
          `🔍 [INDEXEDDB-DEBUG] getSnippets returning ${result.length} snippets`,
        );
        result.forEach((snippet, index) => {
          console.log(`  📋 Retrieved snippet ${index + 1}:`, {
            id: snippet.id,
            trigger: snippet.trigger,
            content: snippet.content?.substring(0, 30) + "...",
            source: (snippet as any).source,
          });
        });
        resolve(result);
      };
      request.onerror = (event) => {
        console.error(
          `❌ [INDEXEDDB-DEBUG] Error getting snippets:`,
          (event.target as IDBRequest).error,
        );
        reject("Error getting snippets: " + (event.target as IDBRequest).error);
      };
    });
  }

  public async clearSnippets(): Promise<void> {
    const store = await this.getObjectStore("readwrite");
    const request = store.clear();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve();
      };
      request.onerror = (event) => {
        reject(
          "Error clearing snippets: " + (event.target as IDBRequest).error,
        );
      };
    });
  }

  public async saveImage(id: string, data: Blob): Promise<void> {
    const store = await this.getObjectStore("readwrite");
    const request = store.put({ id, data });

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve();
      };
      request.onerror = (event) => {
        reject("Error saving image: " + (event.target as IDBRequest).error);
      };
    });
  }

  public async getImage(id: string): Promise<Blob | undefined> {
    const store = await this.getObjectStore("readonly");
    const request = store.get(id);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve(request.result?.data);
      };
      request.onerror = (event) => {
        reject("Error getting image: " + (event.target as IDBRequest).error);
      };
    });
  }
}
