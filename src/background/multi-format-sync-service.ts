/**
 * Multi-Format Sync Service
 * Enhances cloud adapters to discover and parse multiple file formats
 */

import { multiFormatParser } from "../parsers/index.js";
import type { CloudAdapter, TextSnippet } from "../shared/types.js";
import type { SnippetDoc } from "../types/snippet-formats.js";

/**
 * OAuth-compliant cloud adapter interface - REMOVED file discovery to prevent unauthorized access
 * Extension can only access files explicitly granted through drive.file and drive.appdata scopes
 */

/**
 * Service that handles multi-format snippet synchronization
 */
export class MultiFormatSyncService {
  // Common text-based file extensions (for informational purposes)
  private commonTextExtensions = [
    ".json",
    ".txt",
    ".md",
    ".html",
    ".tex",
    ".js",
    ".ts",
    ".css",
    ".xml",
    ".yaml",
    ".yml",
    ".ini",
    ".cfg",
    ".conf",
  ];

  /**
   * OAuth-compliant snippet download - ONLY accesses explicitly selected files
   */
  async downloadSnippetsWithFormats(
    adapter: CloudAdapter,
    folderId?: string,
  ): Promise<TextSnippet[]> {
    // CRITICAL: Only use single-file approach to maintain OAuth compliance
    // File discovery functionality removed to prevent access to unauthorized files
    console.log("🔒 Using OAuth-compliant single-file download approach");
    return adapter.downloadSnippets(folderId || "");
  }

  /**
   * REMOVED: File discovery methods violate OAuth compliance
   * Extension should only access explicitly authorized files
   */

  /**
   * Check if a file is a snippet file based on blacklist approach
   */
  private isSnippetFile(fileName: string): boolean {
    const lowerName = fileName.toLowerCase();
    console.log(`🔍 [FILE-CHECK] Checking file: ${fileName}`);

    // Blacklist system and temporary files
    const blacklistedFiles = [
      ".ds_store",
      "thumbs.db",
      "desktop.ini",
      ".git",
      ".gitignore",
      ".tmp",
      ".temp",
      ".log",
      ".cache",
      ".lock",
      ".pid",
      ".swp",
      ".swo",
      "~$", // Office temp files
      ".crdownload", // Chrome download temp files
      ".part", // Partial downloads
    ];

    // Blacklist certain extensions
    const blacklistedExtensions = [
      ".exe",
      ".dll",
      ".so",
      ".dylib", // Executables
      ".zip",
      ".rar",
      ".7z",
      ".gz",
      ".tar", // Archives
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".bmp",
      ".svg",
      ".ico", // Images
      ".mp3",
      ".wav",
      ".mp4",
      ".avi",
      ".mov",
      ".mkv", // Media
      ".pdf",
      ".doc",
      ".docx",
      ".xls",
      ".xlsx",
      ".ppt",
      ".pptx", // Documents
      ".db",
      ".sqlite",
      ".mdb", // Databases
      ".bin",
      ".dat",
      ".dump",
      ".img",
      ".iso", // Binary files
    ];

    // Check if file matches blacklisted patterns
    for (const pattern of blacklistedFiles) {
      if (lowerName.includes(pattern)) {
        console.log(
          `❌ [FILE-CHECK] ${fileName} rejected - matches blacklisted pattern: ${pattern}`,
        );
        return false;
      }
    }

    // Check if file has blacklisted extension
    for (const ext of blacklistedExtensions) {
      if (lowerName.endsWith(ext)) {
        console.log(
          `❌ [FILE-CHECK] ${fileName} rejected - has blacklisted extension: ${ext}`,
        );
        return false;
      }
    }

    // If not blacklisted, consider it a potential snippet file
    console.log(`✅ [FILE-CHECK] ${fileName} accepted - not blacklisted`);
    return true;
  }

  /**
   * Convert parsed SnippetDocs to TextSnippets
   */
  private convertDocsToSnippets(
    docs: SnippetDoc[],
    sourceFile: string,
  ): TextSnippet[] {
    return docs.map((doc) => ({
      id: doc.meta.id,
      trigger: doc.meta.trigger,
      content: doc.body,
      description: doc.meta.description,
      tags: doc.meta.tags,
      createdAt: new Date(doc.meta.createdAt),
      updatedAt: new Date(doc.meta.updatedAt),
      // Add source file information for debugging
      source: sourceFile,
    }));
  }

  /**
   * Enhanced snippet upload that preserves format when possible
   */
  async uploadSnippetsWithFormats(
    adapter: CloudAdapter,
    snippets: TextSnippet[],
    folderId?: string,
    _preferredFormat: "json" | "txt" | "md" | "html" | "tex" = "json",
  ): Promise<void> {
    // For now, use the existing upload method
    // Future enhancement: support uploading in different formats
    return adapter.uploadSnippets(snippets);
  }

  /**
   * Get common text-based file formats (for informational purposes)
   * Note: With blacklist approach, we accept most text files
   */
  getCommonTextFormats(): string[] {
    return [...this.commonTextExtensions];
  }

  /**
   * Check if adapter supports file discovery (currently disabled for OAuth compliance)
   */
  supportsFileDiscovery(adapter: CloudAdapter): boolean {
    // File discovery removed for OAuth compliance - only use explicit file access
    return false;
  }

  /**
   * Check if adapter supports multi-format sync
   */
  supportsMultiFormat(adapter: CloudAdapter): boolean {
    return this.supportsFileDiscovery(adapter);
  }
}

// Export singleton instance
export const multiFormatSyncService = new MultiFormatSyncService();
