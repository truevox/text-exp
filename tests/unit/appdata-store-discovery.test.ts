/**
 * Tests for appdata-based store discovery functionality
 */

import { GoogleDriveAdapter } from "../../src/background/cloud-adapters/google-drive-adapter";
import { GoogleDriveAppDataManager } from "../../src/background/cloud-adapters/google-drive-appdata-manager";
import { GoogleDriveAuthService } from "../../src/background/cloud-adapters/google-drive/auth-service";
import type { CloudCredentials } from "../../src/shared/types";
import type { TierStorageSchema } from "../../src/types/snippet-formats";

// Mock the dependencies
jest.mock("../../src/background/cloud-adapters/google-drive-appdata-manager");
jest.mock(
  "../../src/background/cloud-adapters/google-drive/auth-service",
  () => ({
    GoogleDriveAuthService: {
      validateCredentials: jest.fn().mockResolvedValue({ isValid: true }),
    },
  }),
);

describe("Appdata Store Discovery", () => {
  let adapter: GoogleDriveAdapter;
  let mockCredentials: CloudCredentials;

  beforeEach(async () => {
    jest.clearAllMocks();

    adapter = new GoogleDriveAdapter();
    mockCredentials = {
      provider: "google-drive",
      accessToken: "mock_access_token",
      refreshToken: "mock_refresh_token",
      expiresAt: new Date(Date.now() + 3600000),
    };

    await adapter.initialize(mockCredentials);
  });

  describe("discoverAppDataStore", () => {
    it("should discover existing Priority #0 store", async () => {
      const mockPriorityStore: TierStorageSchema = {
        schema: "priority-tier-v1",
        tier: "personal",
        snippets: [
          {
            id: "priority-snippet-1",
            trigger: "hp",
            content: "High Priority Snippet",
            contentType: "plaintext" as const,
            snipDependencies: [],
            description: "High priority snippet for testing",
            scope: "personal" as const,
            variables: [],
            images: [],
            tags: [],
            createdAt: new Date().toISOString(),
            createdBy: "test-user",
            updatedAt: new Date().toISOString(),
            updatedBy: "test-user",
          },
        ],
        metadata: {
          version: "1.0.0",
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
          owner: "test-user",
          description: "Priority store for testing",
        },
      };

      (
        GoogleDriveAppDataManager.getPriorityZeroSnippets as jest.Mock
      ).mockResolvedValue(mockPriorityStore);

      const result = await adapter.discoverAppDataStore();

      expect(result.hasStore).toBe(true);
      expect(result.snippets).toHaveLength(1);
      expect(result.snippets[0].trigger).toBe("hp");
      expect(result.storeInfo).toEqual({
        name: "Priority #0 Store",
        tier: "personal",
        lastModified: mockPriorityStore.metadata.modified,
      });
    });

    it("should handle case where no Priority #0 store exists", async () => {
      (
        GoogleDriveAppDataManager.getPriorityZeroSnippets as jest.Mock
      ).mockResolvedValue(null);

      const result = await adapter.discoverAppDataStore();

      expect(result.hasStore).toBe(false);
      expect(result.snippets).toHaveLength(0);
      expect(result.storeInfo).toBeUndefined();
    });

    it("should handle errors gracefully", async () => {
      (
        GoogleDriveAppDataManager.getPriorityZeroSnippets as jest.Mock
      ).mockRejectedValue(new Error("Network error"));

      const result = await adapter.discoverAppDataStore();

      expect(result.hasStore).toBe(false);
      expect(result.snippets).toHaveLength(0);
      expect(result.storeInfo).toBeUndefined();
    });

    it("should throw error if not authenticated", async () => {
      const unauthenticatedAdapter = new GoogleDriveAdapter();

      await expect(
        unauthenticatedAdapter.discoverAppDataStore(),
      ).rejects.toThrow("Not authenticated");
    });
  });

  describe("Priority #0 Store Integration", () => {
    it("should return store with correct tier information", async () => {
      const mockPriorityStore: TierStorageSchema = {
        schema: "priority-tier-v1",
        tier: "personal",
        snippets: [
          {
            id: "priority-snippet-1",
            trigger: "urgent",
            content: "Urgent message template",
            contentType: "plaintext" as const,
            snipDependencies: [],
            description: "Urgent message template",
            scope: "personal" as const,
            variables: [],
            images: [],
            tags: [],
            createdAt: new Date().toISOString(),
            createdBy: "test-user",
            updatedAt: new Date().toISOString(),
            updatedBy: "test-user",
          },
          {
            id: "priority-snippet-2",
            trigger: "crit",
            content: "Critical issue template",
            contentType: "plaintext" as const,
            snipDependencies: [],
            description: "Critical issue template",
            scope: "personal" as const,
            variables: [],
            images: [],
            tags: [],
            createdAt: new Date().toISOString(),
            createdBy: "test-user",
            updatedAt: new Date().toISOString(),
            updatedBy: "test-user",
          },
        ],
        metadata: {
          version: "1.0.0",
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
          owner: "test-user",
          description: "Priority store for testing",
        },
      };

      (
        GoogleDriveAppDataManager.getPriorityZeroSnippets as jest.Mock
      ).mockResolvedValue(mockPriorityStore);

      const result = await adapter.discoverAppDataStore();

      expect(result.hasStore).toBe(true);
      expect(result.snippets).toHaveLength(2);
      expect(result.storeInfo?.tier).toBe("priority-0");
      expect(result.storeInfo?.name).toBe("Priority #0 Store");

      // Verify snippets have correct content
      expect(result.snippets[0].trigger).toBe("urgent");
      expect(result.snippets[1].trigger).toBe("crit");
    });

    it("should preserve snippet metadata from appdata store", async () => {
      const mockDate = new Date("2023-01-01T00:00:00Z");
      const mockPriorityStore: TierStorageSchema = {
        schema: "priority-tier-v1",
        tier: "personal",
        snippets: [
          {
            id: "priority-snippet-1",
            trigger: "test",
            content: "Test content",
            contentType: "plaintext" as const,
            snipDependencies: [],
            description: "Test content snippet",
            scope: "personal" as const,
            variables: [],
            images: [],
            tags: [],
            createdAt: mockDate.toISOString(),
            createdBy: "test-user",
            updatedAt: mockDate.toISOString(),
            updatedBy: "test-user",
          },
        ],
        metadata: {
          version: "1.0.0",
          created: "2023-01-01T00:00:00Z",
          modified: "2023-01-01T00:00:00Z",
          owner: "test-user",
          description: "Test priority store",
        },
      };

      (
        GoogleDriveAppDataManager.getPriorityZeroSnippets as jest.Mock
      ).mockResolvedValue(mockPriorityStore);

      const result = await adapter.discoverAppDataStore();

      expect(result.hasStore).toBe(true);
      expect(result.snippets[0].createdAt).toEqual(mockDate);
      expect(result.snippets[0].updatedAt).toEqual(mockDate);
      expect(result.storeInfo?.lastModified).toBe("2023-01-01T00:00:00Z");
    });
  });
});
