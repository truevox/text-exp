/**
 * Multi-Format Sync Service
 * Enhances cloud adapters to discover and parse multiple file formats
 */

import { multiFormatParser } from "../parsers/index.js";
import type { CloudAdapter, TextSnippet } from "../shared/types.js";
import type { SnippetDoc } from "../types/snippet-formats.js";

/**
 * Interface for cloud adapters that support file discovery
 */
interface FileDiscoveryAdapter extends CloudAdapter {
  /**
   * List all files in a folder with their metadata
   */
  listFiles?(folderId?: string): Promise<
    Array<{
      id: string;
      name: string;
      mimeType?: string;
      modifiedTime?: string;
    }>
  >;

  /**
   * Download raw file content by ID
   */
  downloadFileContent?(fileId: string): Promise<string>;
}

/**
 * Service that handles multi-format snippet synchronization
 */
export class MultiFormatSyncService {
  private supportedExtensions = [".json", ".txt", ".md", ".html", ".tex"];

  /**
   * Enhanced snippet download that supports multiple formats
   */
  async downloadSnippetsWithFormats(
    adapter: CloudAdapter,
    folderId?: string,
  ): Promise<TextSnippet[]> {
    // Check if adapter supports file discovery
    if (this.supportsFileDiscovery(adapter)) {
      return this.downloadFromMultipleFiles(adapter, folderId || "");
    } else {
      // Fallback to original single-file approach
      return adapter.downloadSnippets(folderId || "");
    }
  }

  /**
   * Check if adapter supports file discovery
   */
  private supportsFileDiscovery(
    adapter: CloudAdapter,
  ): adapter is FileDiscoveryAdapter {
    return (
      typeof (adapter as FileDiscoveryAdapter).listFiles === "function" &&
      typeof (adapter as FileDiscoveryAdapter).downloadFileContent ===
        "function"
    );
  }

  /**
   * Download snippets from multiple files in different formats
   */
  private async downloadFromMultipleFiles(
    adapter: FileDiscoveryAdapter,
    folderId?: string,
  ): Promise<TextSnippet[]> {
    try {
      console.log(
        `🔍 Discovering snippet files in folder: ${folderId || "root"}`,
      );

      // List all files in the folder
      const files = await adapter.listFiles!(folderId);
      console.log(`📁 Found ${files.length} total files`);

      // Filter for supported snippet files
      const snippetFiles = files.filter((file) =>
        this.isSnippetFile(file.name),
      );
      console.log(
        `📋 Found ${snippetFiles.length} snippet files:`,
        snippetFiles.map((f) => f.name),
      );

      if (snippetFiles.length === 0) {
        console.log("⚠️ No snippet files found");
        return [];
      }

      // Download and parse each file
      const allSnippets: TextSnippet[] = [];

      for (const file of snippetFiles) {
        let content: string | undefined;
        try {
          console.log(`📥 Downloading file: ${file.name}`);
          content = await adapter.downloadFileContent!(file.id);

          console.log(
            `🔄 Parsing file: ${file.name} (${content.length} chars)`,
          );
          const parsedDocs = multiFormatParser.parse(content, file.name);
          const docsArray = Array.isArray(parsedDocs)
            ? parsedDocs
            : [parsedDocs];

          // Convert parsed docs to TextSnippets
          const snippets = this.convertDocsToSnippets(docsArray, file.name);
          allSnippets.push(...snippets);

          console.log(
            `✅ Parsed ${snippets.length} snippets from ${file.name}`,
          );
        } catch (error) {
          console.warn(`⚠️ Failed to parse file ${file.name}:`, error);
          console.warn(`📄 File content was:`, content?.substring(0, 200));
          // Continue with other files
        }
      }

      console.log(
        `🎉 Successfully loaded ${allSnippets.length} snippets from ${snippetFiles.length} files`,
      );
      return allSnippets;
    } catch (error) {
      console.error("❌ Failed to download multi-format snippets:", error);
      // Fallback to original method
      try {
        return await adapter.downloadSnippets(folderId || "");
      } catch (fallbackError) {
        console.error("❌ Fallback download also failed:", fallbackError);
        return [];
      }
    }
  }

  /**
   * Check if a file is a supported snippet file
   */
  private isSnippetFile(fileName: string): boolean {
    const lowerName = fileName.toLowerCase();

    // Support files with supported extensions
    const hasValidExtension = this.supportedExtensions.some((ext) =>
      lowerName.endsWith(ext),
    );

    // Also support files with snippet-related names
    const hasSnippetName =
      lowerName.includes("snippet") ||
      lowerName.includes("expand") ||
      lowerName.includes("template") ||
      lowerName === "snippets.json"; // Legacy support

    return hasValidExtension || hasSnippetName;
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
   * Get supported file formats
   */
  getSupportedFormats(): string[] {
    return [...this.supportedExtensions];
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
