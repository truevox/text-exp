/**
 * FileHasher utility for generating simple, fast hash prefixes
 * Used to prevent file name collisions when downloading from multiple sources
 */

export interface HashMapping {
  fileName: string;
  folderId: string;
  createdAt: Date;
}

export class FileHasher {
  private hashMappings: Map<string, HashMapping> = new Map();

  /**
   * Generate a simple, fast hash for file collision detection
   * Uses a simple string hash algorithm (not cryptographic)
   */
  generateHash(fileName: string, folderId: string, length: number = 8): string {
    // Combine fileName and folderId for uniqueness
    const input = `${fileName}:${folderId}`;

    // Simple hash function (djb2 algorithm - fast and good distribution)
    let hash = 5381;
    for (let i = 0; i < input.length; i++) {
      hash = (hash << 5) + hash + input.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Convert to positive number and then to base36 for compact representation
    const hashStr = Math.abs(hash).toString(36);

    // Return specified length, pad with zeros if needed
    return hashStr.length >= length
      ? hashStr.substring(0, length)
      : hashStr.padStart(length, "0");
  }

  /**
   * Create a prefixed file name with hash
   */
  createPrefixedFileName(originalName: string, hash: string): string {
    return `${hash}_${originalName}`;
  }

  /**
   * Extract original file name from prefixed name
   */
  extractOriginalFileName(prefixedName: string): string {
    const underscoreIndex = prefixedName.indexOf("_");
    if (underscoreIndex === -1) {
      return prefixedName;
    }
    return prefixedName.substring(underscoreIndex + 1);
  }

  /**
   * Extract hash from prefixed file name
   */
  extractHashFromFileName(prefixedName: string): string {
    const underscoreIndex = prefixedName.indexOf("_");
    if (underscoreIndex === -1) {
      return "";
    }
    return prefixedName.substring(0, underscoreIndex);
  }

  /**
   * Store hash mapping for later retrieval
   */
  storeHashMapping(hash: string, fileName: string, folderId: string): void {
    this.hashMappings.set(hash, {
      fileName,
      folderId,
      createdAt: new Date(),
    });
  }

  /**
   * Retrieve hash mapping
   */
  getHashMapping(hash: string): HashMapping | undefined {
    return this.hashMappings.get(hash);
  }

  /**
   * Get all hash mappings
   */
  getAllHashMappings(): Map<string, HashMapping> {
    return new Map(this.hashMappings);
  }

  /**
   * Clear all hash mappings
   */
  clearHashMappings(): void {
    this.hashMappings.clear();
  }

  /**
   * Detect potential collisions for a given file name
   */
  detectCollisions(fileName: string): string[] {
    const collisions: string[] = [];

    for (const [hash, mapping] of this.hashMappings) {
      if (mapping.fileName === fileName) {
        collisions.push(hash);
      }
    }

    return collisions;
  }

  /**
   * Generate hash and create prefixed file name in one step
   */
  hashAndPrefix(
    fileName: string,
    folderId: string,
    length: number = 8,
  ): string {
    const hash = this.generateHash(fileName, folderId, length);
    this.storeHashMapping(hash, fileName, folderId);
    return this.createPrefixedFileName(fileName, hash);
  }

  /**
   * Process a file for download with collision prevention
   */
  processFileForDownload(
    fileName: string,
    folderId: string,
    folderName?: string,
  ): {
    originalName: string;
    prefixedName: string;
    hash: string;
    hasCollision: boolean;
  } {
    const hash = this.generateHash(fileName, folderId);
    const prefixedName = this.createPrefixedFileName(fileName, hash);
    const existingCollisions = this.detectCollisions(fileName);

    // Store the mapping
    this.storeHashMapping(hash, fileName, folderId);

    return {
      originalName: fileName,
      prefixedName,
      hash,
      hasCollision: existingCollisions.length > 0,
    };
  }

  /**
   * Get statistics about current hash mappings
   */
  getStatistics(): {
    totalMappings: number;
    uniqueFileNames: number;
    uniqueFolders: number;
    collisionCount: number;
  } {
    const fileNames = new Set<string>();
    const folders = new Set<string>();
    const fileNameCounts = new Map<string, number>();

    for (const mapping of this.hashMappings.values()) {
      fileNames.add(mapping.fileName);
      folders.add(mapping.folderId);

      const count = fileNameCounts.get(mapping.fileName) || 0;
      fileNameCounts.set(mapping.fileName, count + 1);
    }

    let collisionCount = 0;
    for (const count of fileNameCounts.values()) {
      if (count > 1) {
        collisionCount++;
      }
    }

    return {
      totalMappings: this.hashMappings.size,
      uniqueFileNames: fileNames.size,
      uniqueFolders: folders.size,
      collisionCount,
    };
  }
}
