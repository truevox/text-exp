/**
 * Store Permissions Manager
 * Handles read-only vs read-write snippet store permissions
 * Supports copy-to-writable workflow for read-only stores
 */

import type { TextSnippet } from "../shared/types.js";
import type {
  EnhancedSnippet,
  PriorityTier,
  TierStorageSchema,
} from "../types/snippet-formats.js";

export type StorePermission = "read-only" | "read-write";

export interface StorePermissionInfo {
  storeId: string;
  storeName: string;
  displayName: string;
  tierName: PriorityTier;
  permission: StorePermission;
  isDriveFile: boolean;
  fileId?: string;
  reason?: string; // Why it's read-only
  lastPermissionCheck?: Date;
  canCopyTo?: boolean; // Whether snippets can be copied from this store
  canEditCopies?: boolean; // Whether copies can be edited
}

export interface PermissionCheckResult {
  allowed: boolean;
  permission: StorePermission;
  reason?: string;
  suggestedAction?: "copy-to-writable" | "request-permission" | "view-only";
  alternativeStores?: StorePermissionInfo[];
}

export interface CopyToWritableOptions {
  sourceStoreId: string;
  targetStoreId: string;
  snippet: TextSnippet | EnhancedSnippet;
  overwriteExisting?: boolean;
  preserveMetadata?: boolean;
  updateDependencies?: boolean;
}

export interface CopyToWritableResult {
  success: boolean;
  newSnippetId?: string;
  targetStoreId: string;
  originalSnippet: TextSnippet | EnhancedSnippet;
  copiedSnippet?: TextSnippet | EnhancedSnippet;
  errors?: string[];
  warnings?: string[];
}

export interface StorePermissionValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  readOnlyStores: StorePermissionInfo[];
  writableStores: StorePermissionInfo[];
}

/**
 * Manages store permissions and read-only/read-write access control
 */
export class StorePermissionsManager {
  private stores: Map<string, StorePermissionInfo> = new Map();
  private permissionCache: Map<string, PermissionCheckResult> = new Map();
  private cacheExpirationTime = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Register a store with its permission information
   */
  registerStore(storeInfo: StorePermissionInfo): void {
    this.stores.set(storeInfo.storeId, {
      ...storeInfo,
      lastPermissionCheck: new Date(),
      canCopyTo: storeInfo.canCopyTo ?? true, // Default to allowing copies
      canEditCopies: storeInfo.permission === "read-write",
    });

    // Clear cache for this store
    this.clearStoreCache(storeInfo.storeId);
  }

  /**
   * Update store permissions
   */
  updateStorePermissions(
    storeId: string,
    permission: StorePermission,
    reason?: string,
  ): void {
    const store = this.stores.get(storeId);
    if (store) {
      store.permission = permission;
      store.reason = reason;
      store.lastPermissionCheck = new Date();
      store.canEditCopies = permission === "read-write";

      this.clearStoreCache(storeId);
    }
  }

  /**
   * Check if an operation is allowed on a store
   */
  checkPermission(
    storeId: string,
    operation: "read" | "write" | "delete" | "copy",
  ): PermissionCheckResult {
    const cacheKey = `${storeId}:${operation}`;
    const cached = this.permissionCache.get(cacheKey);

    if (cached && this.isCacheValid(cacheKey)) {
      return cached;
    }

    const store = this.stores.get(storeId);
    if (!store) {
      const result: PermissionCheckResult = {
        allowed: false,
        permission: "read-only",
        reason: "Store not found or not registered",
        suggestedAction: "view-only",
      };
      // Add timestamp for cache validation
      (result as any).__timestamp = Date.now();
      this.permissionCache.set(cacheKey, result);
      return result;
    }

    const result = this.evaluatePermission(store, operation);
    // Add timestamp for cache validation
    (result as any).__timestamp = Date.now();
    this.permissionCache.set(cacheKey, result);
    return result;
  }

  /**
   * Evaluate permission for a specific operation
   */
  private evaluatePermission(
    store: StorePermissionInfo,
    operation: string,
  ): PermissionCheckResult {
    const baseResult: PermissionCheckResult = {
      allowed: false,
      permission: store.permission,
      reason: store.reason,
    };

    switch (operation) {
      case "read":
        return {
          ...baseResult,
          allowed: true, // Reading is always allowed
        };

      case "copy":
        return {
          ...baseResult,
          allowed: store.canCopyTo !== false,
          suggestedAction: store.canCopyTo !== false ? undefined : "view-only",
        };

      case "write":
      case "delete":
        if (store.permission === "read-write") {
          return {
            ...baseResult,
            allowed: true,
          };
        } else {
          return {
            ...baseResult,
            allowed: false,
            reason: store.reason || "Store is read-only",
            suggestedAction: "copy-to-writable",
            alternativeStores: this.getWritableStores(store.tierName),
          };
        }

      default:
        return {
          ...baseResult,
          allowed: false,
          reason: `Unknown operation: ${operation}`,
          suggestedAction: "view-only",
        };
    }
  }

  /**
   * Get all writable stores for a tier
   */
  getWritableStores(tierName?: PriorityTier): StorePermissionInfo[] {
    const allStores = Array.from(this.stores.values());

    return allStores.filter(
      (store) =>
        store.permission === "read-write" &&
        (!tierName || store.tierName === tierName),
    );
  }

  /**
   * Get all read-only stores
   */
  getReadOnlyStores(): StorePermissionInfo[] {
    return Array.from(this.stores.values()).filter(
      (store) => store.permission === "read-only",
    );
  }

  /**
   * Copy a snippet from read-only store to writable store
   */
  async copyToWritable(
    options: CopyToWritableOptions,
  ): Promise<CopyToWritableResult> {
    const {
      sourceStoreId,
      targetStoreId,
      snippet,
      overwriteExisting,
      preserveMetadata,
      updateDependencies,
    } = options;

    // Validate source store (should be read-only)
    const sourcePermission = this.checkPermission(sourceStoreId, "copy");
    if (!sourcePermission.allowed) {
      return {
        success: false,
        targetStoreId,
        originalSnippet: snippet,
        errors: [`Cannot copy from source store: ${sourcePermission.reason}`],
      };
    }

    // Validate target store (should be writable)
    const targetPermission = this.checkPermission(targetStoreId, "write");
    if (!targetPermission.allowed) {
      return {
        success: false,
        targetStoreId,
        originalSnippet: snippet,
        errors: [`Cannot write to target store: ${targetPermission.reason}`],
      };
    }

    try {
      // Create a copy of the snippet
      const copiedSnippet = await this.createSnippetCopy(snippet, {
        preserveMetadata,
        updateDependencies,
        sourceStoreId,
        targetStoreId,
      });

      // Generate new ID for the copy
      copiedSnippet.id = this.generateCopyId(
        snippet.id,
        sourceStoreId,
        targetStoreId,
      );

      // Update metadata
      if ("updatedAt" in copiedSnippet) {
        copiedSnippet.updatedAt = new Date();
      }
      if ("createdAt" in copiedSnippet) {
        copiedSnippet.createdAt = new Date();
      }

      // Add copy metadata
      if ("description" in copiedSnippet) {
        const sourceStore = this.stores.get(sourceStoreId);
        const copyNote = `\n\n[Copied from ${sourceStore?.displayName || sourceStoreId}]`;
        copiedSnippet.description =
          (copiedSnippet.description || "") + copyNote;
      }

      return {
        success: true,
        newSnippetId: copiedSnippet.id,
        targetStoreId,
        originalSnippet: snippet,
        copiedSnippet,
        warnings: this.generateCopyWarnings(snippet, copiedSnippet),
      };
    } catch (error) {
      return {
        success: false,
        targetStoreId,
        originalSnippet: snippet,
        errors: [
          `Failed to copy snippet: ${error instanceof Error ? error.message : "Unknown error"}`,
        ],
      };
    }
  }

  /**
   * Create a copy of a snippet with appropriate transformations
   */
  private async createSnippetCopy(
    snippet: TextSnippet | EnhancedSnippet,
    options: {
      preserveMetadata?: boolean;
      updateDependencies?: boolean;
      sourceStoreId: string;
      targetStoreId: string;
    },
  ): Promise<TextSnippet | EnhancedSnippet> {
    const {
      preserveMetadata,
      updateDependencies,
      sourceStoreId,
      targetStoreId,
    } = options;

    // Deep clone the snippet
    const copy = JSON.parse(JSON.stringify(snippet));

    // Handle dependencies if this is an EnhancedSnippet
    if (updateDependencies && "snipDependencies" in copy) {
      copy.snipDependencies = await this.updateSnippetDependencies(
        copy.snipDependencies,
        sourceStoreId,
        targetStoreId,
      );
    }

    // Handle metadata preservation
    if (!preserveMetadata) {
      // Remove source-specific metadata
      delete copy.usageCount;
      delete copy.lastUsed;
      delete copy.fileHash;
      delete copy.sourceFolder;

      // Reset Enhanced snippet metadata
      if ("createdBy" in copy) {
        copy.createdBy = "system";
      }
      if ("updatedBy" in copy) {
        copy.updatedBy = "system";
      }
    }

    return copy;
  }

  /**
   * Update snippet dependencies when copying across stores
   */
  private async updateSnippetDependencies(
    dependencies: string[],
    sourceStoreId: string,
    targetStoreId: string,
  ): Promise<string[]> {
    return dependencies.map((dep) => {
      // Parse dependency format: "store-name:trigger:id"
      const parts = dep.split(":");
      if (parts.length === 3) {
        const [storeRef, trigger, id] = parts;

        // If dependency refers to source store, update to target store
        if (storeRef === sourceStoreId) {
          return `${targetStoreId}:${trigger}:${id}`;
        }
      }

      // Return unchanged if format is invalid or doesn't need updating
      return dep;
    });
  }

  /**
   * Generate copy warnings
   */
  private generateCopyWarnings(
    original: TextSnippet | EnhancedSnippet,
    copy: TextSnippet | EnhancedSnippet,
  ): string[] {
    const warnings: string[] = [];

    // Check for dependency issues
    if (
      "snipDependencies" in original &&
      original.snipDependencies.length > 0
    ) {
      warnings.push(
        "Snippet dependencies may need manual verification after copying",
      );
    }

    // Check for images
    if ("images" in original && original.images && original.images.length > 0) {
      warnings.push(
        "Image references may not be accessible from the target store",
      );
    }

    // Check for variables
    if (original.variables && original.variables.length > 0) {
      warnings.push(
        "Variable definitions have been copied - verify prompts are appropriate",
      );
    }

    return warnings;
  }

  /**
   * Generate a unique ID for a copied snippet
   */
  private generateCopyId(
    originalId: string,
    sourceStoreId: string,
    targetStoreId: string,
  ): string {
    const timestamp = Date.now();
    const short = originalId.substring(0, 8);
    return `${short}_copy_${timestamp}`;
  }

  /**
   * Find suitable writable stores for copying
   */
  findWritableStoresForCopy(
    sourceStoreId: string,
    preferredTier?: PriorityTier,
  ): StorePermissionInfo[] {
    const sourceStore = this.stores.get(sourceStoreId);
    const tierToSearch = preferredTier || sourceStore?.tierName;

    let writableStores = this.getWritableStores(tierToSearch);

    // If no preferred tier was specified and no writable stores in the same tier, expand search
    if (writableStores.length === 0 && !preferredTier) {
      writableStores = this.getWritableStores();
    }

    // Filter out the source store
    return writableStores.filter((store) => store.storeId !== sourceStoreId);
  }

  /**
   * Validate store permissions across multiple stores
   */
  validateStorePermissions(
    storeIds: string[],
  ): StorePermissionValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const readOnlyStores: StorePermissionInfo[] = [];
    const writableStores: StorePermissionInfo[] = [];

    storeIds.forEach((storeId) => {
      const store = this.stores.get(storeId);
      if (!store) {
        errors.push(`Store not found: ${storeId}`);
        return;
      }

      if (store.permission === "read-only") {
        readOnlyStores.push(store);
        if (store.canCopyTo === false) {
          warnings.push(
            `Read-only store ${store.displayName} does not allow copying`,
          );
        }
      } else {
        writableStores.push(store);
      }
    });

    // Check if we have at least one writable store
    if (writableStores.length === 0 && readOnlyStores.length > 0) {
      errors.push(
        "At least one writable store is required for editing operations",
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      readOnlyStores,
      writableStores,
    };
  }

  /**
   * Get store permission info
   */
  getStoreInfo(storeId: string): StorePermissionInfo | null {
    return this.stores.get(storeId) || null;
  }

  /**
   * Get all registered stores
   */
  getAllStores(): StorePermissionInfo[] {
    return Array.from(this.stores.values());
  }

  /**
   * Check if a store exists and is registered
   */
  hasStore(storeId: string): boolean {
    return this.stores.has(storeId);
  }

  /**
   * Remove a store from the registry
   */
  unregisterStore(storeId: string): void {
    this.stores.delete(storeId);
    this.clearStoreCache(storeId);
  }

  /**
   * Clear cache for a specific store
   */
  private clearStoreCache(storeId: string): void {
    const keysToDelete = Array.from(this.permissionCache.keys()).filter((key) =>
      key.startsWith(storeId + ":"),
    );
    keysToDelete.forEach((key) => this.permissionCache.delete(key));
  }

  /**
   * Check if cache entry is valid
   */
  private isCacheValid(cacheKey: string): boolean {
    const entry = this.permissionCache.get(cacheKey);
    if (!entry) return false;

    // Cache expires after a certain time
    const now = Date.now();
    const entryTime = (entry as any).__timestamp || 0;
    return now - entryTime < this.cacheExpirationTime;
  }

  /**
   * Setup event listeners for permission changes
   */
  private setupEventListeners(): void {
    // Listen for Drive API permission changes
    if (typeof window !== "undefined" && window.addEventListener) {
      window.addEventListener("drive-permission-changed", (event) => {
        const { storeId, permission, reason } = (event as CustomEvent).detail;
        this.updateStorePermissions(storeId, permission, reason);
      });
    }
  }

  /**
   * Refresh permissions for all stores
   */
  async refreshAllPermissions(): Promise<void> {
    const stores = Array.from(this.stores.values());

    for (const store of stores) {
      try {
        // Check permissions for Drive files
        if (store.isDriveFile && store.fileId) {
          const permission = await this.checkDriveFilePermission(store.fileId);
          this.updateStorePermissions(store.storeId, permission);
        }
      } catch (error) {
        console.warn(
          `Failed to refresh permissions for store ${store.storeId}:`,
          error,
        );
      }
    }
  }

  /**
   * Check Google Drive file permissions
   */
  private async checkDriveFilePermission(
    fileId: string,
  ): Promise<StorePermission> {
    // This would integrate with Google Drive API
    // For now, return a default permission
    return "read-write";
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.permissionCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; stores: number } {
    return {
      size: this.permissionCache.size,
      stores: this.stores.size,
    };
  }
}

/**
 * Global instance of the store permissions manager
 */
let globalPermissionsManager: StorePermissionsManager | null = null;

/**
 * Get the global permissions manager instance
 */
export function getStorePermissionsManager(): StorePermissionsManager {
  if (!globalPermissionsManager) {
    globalPermissionsManager = new StorePermissionsManager();
  }
  return globalPermissionsManager;
}

/**
 * Initialize store permissions for a set of stores
 */
export function initializeStorePermissions(
  stores: StorePermissionInfo[],
): void {
  const manager = getStorePermissionsManager();
  stores.forEach((store) => manager.registerStore(store));
}

/**
 * Quick permission check utility
 */
export function checkStorePermission(
  storeId: string,
  operation: "read" | "write" | "delete" | "copy",
): PermissionCheckResult {
  const manager = getStorePermissionsManager();
  return manager.checkPermission(storeId, operation);
}

/**
 * Quick copy-to-writable utility
 */
export async function copySnippetToWritable(
  snippet: TextSnippet | EnhancedSnippet,
  sourceStoreId: string,
  targetStoreId: string,
  options?: Partial<CopyToWritableOptions>,
): Promise<CopyToWritableResult> {
  const manager = getStorePermissionsManager();
  return manager.copyToWritable({
    sourceStoreId,
    targetStoreId,
    snippet,
    ...options,
  });
}
