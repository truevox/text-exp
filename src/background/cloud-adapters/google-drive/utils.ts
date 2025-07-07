/**
 * Google Drive Utilities
 * Common utilities and helper functions for Google Drive operations
 */

import type { CloudCredentials } from "../../../shared/types.js";
import { GoogleDriveAuthService } from "./auth-service.js";

export class GoogleDriveUtils {
  private static readonly API_BASE = "https://www.googleapis.com";
  private static readonly DRIVE_API = `${GoogleDriveUtils.API_BASE}/drive/v3`;

  /**
   * Check network connectivity to Google Drive
   */
  static async checkConnectivity(
    credentials: CloudCredentials,
  ): Promise<boolean> {
    try {
      const response = await fetch(`${this.DRIVE_API}/about?fields=user`, {
        headers: GoogleDriveAuthService.getAuthHeaders(credentials),
      });
      return response.ok;
    } catch (error) {
      console.error("Google Drive connectivity check failed:", error);
      return false;
    }
  }

  /**
   * Get user information from Google Drive
   */
  static async getUserInfo(credentials: CloudCredentials): Promise<{
    email?: string;
    name?: string;
    picture?: string;
  }> {
    try {
      const response = await fetch(`${this.DRIVE_API}/about?fields=user`, {
        headers: GoogleDriveAuthService.getAuthHeaders(credentials),
      });

      if (!response.ok) {
        throw new Error(`Failed to get user info: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        email: data.user?.emailAddress,
        name: data.user?.displayName,
        picture: data.user?.photoLink,
      };
    } catch (error) {
      console.error("Failed to get user info:", error);
      return {};
    }
  }

  /**
   * Get storage quota information
   */
  static async getStorageQuota(credentials: CloudCredentials): Promise<{
    limit?: number;
    usage?: number;
    usageInDrive?: number;
  }> {
    try {
      const response = await fetch(
        `${this.DRIVE_API}/about?fields=storageQuota`,
        {
          headers: GoogleDriveAuthService.getAuthHeaders(credentials),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to get storage quota: ${response.statusText}`);
      }

      const data = await response.json();
      const quota = data.storageQuota || {};

      return {
        limit: quota.limit ? parseInt(quota.limit) : undefined,
        usage: quota.usage ? parseInt(quota.usage) : undefined,
        usageInDrive: quota.usageInDrive
          ? parseInt(quota.usageInDrive)
          : undefined,
      };
    } catch (error) {
      console.error("Failed to get storage quota:", error);
      return {};
    }
  }

  /**
   * Retry operation with exponential backoff
   */
  static async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000,
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === maxRetries) {
          throw lastError;
        }

        // Check if error is retryable
        if (!this.isRetryableError(lastError)) {
          throw lastError;
        }

        const delay = baseDelay * Math.pow(2, attempt);
        console.log(
          `🔄 Retrying operation after ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`,
        );
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Check if an error is retryable
   */
  private static isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Rate limiting errors
    if (message.includes("429") || message.includes("quota")) {
      return true;
    }

    // Network errors
    if (message.includes("network") || message.includes("timeout")) {
      return true;
    }

    // Temporary server errors
    if (
      message.includes("500") ||
      message.includes("502") ||
      message.includes("503")
    ) {
      return true;
    }

    return false;
  }

  /**
   * Sleep for specified milliseconds
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Sanitize snippets by removing sensitive data
   */
  static sanitizeSnippets<T extends Record<string, any>>(snippets: T[]): T[] {
    return snippets.map((snippet) => {
      const sanitized = { ...snippet };

      // Remove potential sensitive fields
      delete sanitized.password;
      delete sanitized.secret;
      delete sanitized.token;
      delete sanitized.key;
      delete sanitized.auth;
      delete sanitized.credential;

      return sanitized;
    });
  }

  /**
   * Format file size in human readable format
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  /**
   * Parse Google Drive file metadata
   */
  static parseFileMetadata(file: any): {
    id: string;
    name: string;
    size?: number;
    modifiedTime?: Date;
    mimeType?: string;
  } {
    return {
      id: file.id,
      name: file.name,
      size: file.size ? parseInt(file.size) : undefined,
      modifiedTime: file.modifiedTime ? new Date(file.modifiedTime) : undefined,
      mimeType: file.mimeType,
    };
  }
}
