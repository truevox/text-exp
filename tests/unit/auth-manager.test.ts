/**
 * Unit tests for AuthManager class
 * Tests OAuth flows, token management, and security
 */

import { AuthManager } from "../../src/background/auth-manager";
import { ExtensionStorage } from "../../src/shared/storage";
import type { CloudCredentials } from "../../src/shared/types";

// Mock Chrome APIs
global.chrome = {
  runtime: {
    id: "test-extension-id",
    getManifest: jest.fn(() => ({
      oauth2: {
        client_id: "test-client-id.apps.googleusercontent.com",
      },
    })),
    lastError: undefined,
  },
  identity: {
    getAuthToken: jest.fn(),
    launchWebAuthFlow: jest.fn(),
  },
} as any;

// Mock ExtensionStorage
jest.mock("../../src/shared/storage", () => ({
  ExtensionStorage: {
    getCloudCredentials: jest.fn(),
    setCloudCredentials: jest.fn(),
    clearCloudCredentials: jest.fn(),
  },
}));

// Mock fetch
global.fetch = jest.fn();

describe("AuthManager", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("authenticateWithGoogle", () => {
    it("should return existing valid credentials", async () => {
      const existingCredentials: CloudCredentials = {
        provider: "google-drive",
        accessToken: "valid-token",
        refreshToken: "refresh-token",
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
      };

      (ExtensionStorage.getCloudCredentials as jest.Mock).mockResolvedValue(
        existingCredentials,
      );

      // Mock successful token validation
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ user: {} }),
      });

      const result = await AuthManager.authenticateWithGoogle();

      expect(result.success).toBe(true);
      expect(result.credentials).toEqual(existingCredentials);
      expect(chrome.identity.launchWebAuthFlow).not.toHaveBeenCalled();
    });

    it("should refresh expired token using Chrome identity API", async () => {
      const existingCredentials: CloudCredentials = {
        provider: "google-drive",
        accessToken: "expired-token",
      };

      (ExtensionStorage.getCloudCredentials as jest.Mock).mockResolvedValue(
        existingCredentials,
      );

      // Mock failed validation (expired token)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      // Mock Chrome identity API returning new token
      (chrome.identity.getAuthToken as jest.Mock).mockImplementation(
        (options, callback) => {
          callback("new-access-token");
        },
      );

      const result = await AuthManager.authenticateWithGoogle();

      expect(result.success).toBe(true);
      expect(result.credentials?.accessToken).toBe("new-access-token");
      expect(ExtensionStorage.setCloudCredentials).toHaveBeenCalled();
    });

    it("should get new token using Chrome identity API when no credentials exist", async () => {
      (ExtensionStorage.getCloudCredentials as jest.Mock).mockResolvedValue(
        null,
      );

      // Mock Chrome identity API success
      (chrome.identity.getAuthToken as jest.Mock).mockImplementation(
        (options, callback) => {
          callback("new-access-token");
        },
      );

      const result = await AuthManager.authenticateWithGoogle();

      expect(result.success).toBe(true);
      expect(result.credentials?.accessToken).toBe("new-access-token");
      expect(chrome.identity.getAuthToken).toHaveBeenCalledWith(
        {
          interactive: true,
          scopes: ["https://www.googleapis.com/auth/drive"],
        },
        expect.any(Function),
      );
      expect(ExtensionStorage.setCloudCredentials).toHaveBeenCalled();
    });

    it("should handle Chrome identity API failure", async () => {
      (ExtensionStorage.getCloudCredentials as jest.Mock).mockResolvedValue(
        null,
      );

      // Mock Chrome identity API failure
      (chrome.identity.getAuthToken as jest.Mock).mockImplementation(
        (options, callback) => {
          chrome.runtime.lastError = { message: "User cancelled" };
          callback(null);
        },
      );

      const result = await AuthManager.authenticateWithGoogle();

      expect(result.success).toBe(false);
      expect(result.error).toContain(
        "Failed to get access token from Chrome identity API",
      );

      // Clean up
      chrome.runtime.lastError = undefined;
    });

    it("should handle Chrome identity API timeout", async () => {
      (ExtensionStorage.getCloudCredentials as jest.Mock).mockResolvedValue(
        null,
      );

      // Mock Chrome identity API returning null (no token)
      (chrome.identity.getAuthToken as jest.Mock).mockImplementation(
        (options, callback) => {
          callback(null);
        },
      );

      const result = await AuthManager.authenticateWithGoogle();

      expect(result.success).toBe(false);
      expect(result.error).toContain(
        "Failed to get access token from Chrome identity API",
      );
    });
  });

  describe("refreshToken", () => {
    it("should refresh token successfully using Chrome identity API", async () => {
      // Mock Chrome identity API returning new token
      (chrome.identity.getAuthToken as jest.Mock).mockImplementation(
        (options, callback) => {
          callback("new-access-token");
        },
      );

      const result = await AuthManager.refreshToken();

      expect(result.success).toBe(true);
      expect(result.credentials?.accessToken).toBe("new-access-token");
      expect(ExtensionStorage.setCloudCredentials).toHaveBeenCalled();
    });

    it("should handle refresh token failure", async () => {
      // Mock Chrome identity API failure
      (chrome.identity.getAuthToken as jest.Mock).mockImplementation(
        (options, callback) => {
          chrome.runtime.lastError = { message: "Token expired" };
          callback(null);
        },
      );

      const result = await AuthManager.refreshToken();

      expect(result.success).toBe(false);
      expect(result.error).toContain(
        "Failed to refresh token via Chrome identity API",
      );
      expect(ExtensionStorage.clearCloudCredentials).toHaveBeenCalled();

      // Clean up
      chrome.runtime.lastError = undefined;
    });
  });

  describe("validateToken", () => {
    it("should validate token successfully", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ user: { emailAddress: "test@example.com" } }),
      });

      const isValid = await (AuthManager as any).validateToken("valid-token");

      expect(isValid).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://www.googleapis.com/drive/v3/about?fields=user",
        {
          headers: {
            Authorization: "Bearer valid-token",
          },
        },
      );
    });

    it("should handle invalid token", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
      });

      const isValid = await (AuthManager as any).validateToken("invalid-token");

      expect(isValid).toBe(false);
    });

    it("should handle network errors", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      const isValid = await (AuthManager as any).validateToken("token");

      expect(isValid).toBe(false);
    });
  });

  describe("ensureValidToken", () => {
    it("should return valid token", async () => {
      const credentials: CloudCredentials = {
        provider: "google-drive",
        accessToken: "valid-token",
      };

      (ExtensionStorage.getCloudCredentials as jest.Mock).mockResolvedValue(
        credentials,
      );

      // Mock token validation success
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ user: {} }),
      });

      const token = await AuthManager.ensureValidToken();

      expect(token).toBe("valid-token");
    });

    it("should refresh invalid token", async () => {
      const credentials: CloudCredentials = {
        provider: "google-drive",
        accessToken: "invalid-token",
      };

      (ExtensionStorage.getCloudCredentials as jest.Mock).mockResolvedValue(
        credentials,
      );

      // Mock token validation failure
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
      });

      // Mock Chrome identity API returning new token
      (chrome.identity.getAuthToken as jest.Mock).mockImplementation(
        (options, callback) => {
          callback("new-access-token");
        },
      );

      const token = await AuthManager.ensureValidToken();

      expect(token).toBe("new-access-token");
    });

    it("should handle refresh failure", async () => {
      const credentials: CloudCredentials = {
        provider: "google-drive",
        accessToken: "invalid-token",
      };

      (ExtensionStorage.getCloudCredentials as jest.Mock).mockResolvedValue(
        credentials,
      );

      // Mock token validation failure
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
      });

      // Mock Chrome identity API failure
      (chrome.identity.getAuthToken as jest.Mock).mockImplementation(
        (options, callback) => {
          chrome.runtime.lastError = { message: "Auth failed" };
          callback(null);
        },
      );

      const token = await AuthManager.ensureValidToken();

      expect(token).toBeNull();

      // Clean up
      chrome.runtime.lastError = undefined;
    });

    it("should get token when no credentials exist", async () => {
      (ExtensionStorage.getCloudCredentials as jest.Mock).mockResolvedValue(
        null,
      );

      // Mock Chrome identity API returning new token
      (chrome.identity.getAuthToken as jest.Mock).mockImplementation(
        (options, callback) => {
          callback("new-token");
        },
      );

      const token = await AuthManager.ensureValidToken();

      expect(token).toBe("new-token");
    });

    it("should handle non-google-drive provider", async () => {
      const credentials: CloudCredentials = {
        provider: "dropbox",
        accessToken: "dropbox-token",
      };

      (ExtensionStorage.getCloudCredentials as jest.Mock).mockResolvedValue(
        credentials,
      );

      // Mock Chrome identity API returning token for Google
      (chrome.identity.getAuthToken as jest.Mock).mockImplementation(
        (options, callback) => {
          callback("google-token");
        },
      );

      const token = await AuthManager.ensureValidToken();

      expect(token).toBe("google-token");
    });
  });

  describe("signOut", () => {
    it("should clear credentials successfully", async () => {
      await AuthManager.signOut();

      expect(ExtensionStorage.clearCloudCredentials).toHaveBeenCalled();
    });

    it("should handle clear credentials error", async () => {
      (ExtensionStorage.clearCloudCredentials as jest.Mock).mockRejectedValue(
        new Error("Storage error"),
      );

      // Should not throw
      await expect(AuthManager.signOut()).resolves.toBeUndefined();
    });
  });

  describe("getAuthStatus", () => {
    it("should return authenticated status for valid credentials", async () => {
      const credentials: CloudCredentials = {
        provider: "google-drive",
        accessToken: "valid-token",
        refreshToken: "refresh-token",
        expiresAt: new Date(Date.now() + 3600000),
      };

      (ExtensionStorage.getCloudCredentials as jest.Mock).mockResolvedValue(
        credentials,
      );
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      const status = await AuthManager.getAuthStatus();

      expect(status.isAuthenticated).toBe(true);
      expect(status.provider).toBe("google-drive");
      expect(status.expiresAt).toEqual(credentials.expiresAt);
    });

    it("should return unauthenticated status for invalid credentials", async () => {
      const credentials: CloudCredentials = {
        provider: "google-drive",
        accessToken: "invalid-token",
        refreshToken: "refresh-token",
      };

      (ExtensionStorage.getCloudCredentials as jest.Mock).mockResolvedValue(
        credentials,
      );
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

      const status = await AuthManager.getAuthStatus();

      expect(status.isAuthenticated).toBe(false);
      expect(status.provider).toBe("google-drive");
    });

    it("should return unauthenticated status for missing credentials", async () => {
      (ExtensionStorage.getCloudCredentials as jest.Mock).mockResolvedValue(
        null,
      );

      const status = await AuthManager.getAuthStatus();

      expect(status.isAuthenticated).toBe(false);
      expect(status.provider).toBeUndefined();
    });

    it("should handle validation errors", async () => {
      (ExtensionStorage.getCloudCredentials as jest.Mock).mockRejectedValue(
        new Error("Storage error"),
      );

      const status = await AuthManager.getAuthStatus();

      expect(status.isAuthenticated).toBe(false);
    });
  });

  describe("Security Considerations", () => {
    it("should use Chrome identity API for secure authentication", async () => {
      (ExtensionStorage.getCloudCredentials as jest.Mock).mockResolvedValue(
        null,
      );

      (chrome.identity.getAuthToken as jest.Mock).mockImplementation(
        (options, callback) => {
          callback("secure-token");
        },
      );

      await AuthManager.authenticateWithGoogle();

      expect(chrome.identity.getAuthToken).toHaveBeenCalledWith(
        {
          interactive: true,
          scopes: ["https://www.googleapis.com/auth/drive"],
        },
        expect.any(Function),
      );
    });

    it("should validate tokens before use", async () => {
      const credentials: CloudCredentials = {
        provider: "google-drive",
        accessToken: "token-to-validate",
      };

      (ExtensionStorage.getCloudCredentials as jest.Mock).mockResolvedValue(
        credentials,
      );

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ user: {} }),
      });

      const token = await AuthManager.ensureValidToken();

      expect(global.fetch).toHaveBeenCalledWith(
        "https://www.googleapis.com/drive/v3/about?fields=user",
        {
          headers: {
            Authorization: "Bearer token-to-validate",
          },
        },
      );
      expect(token).toBe("token-to-validate");
    });
  });
});
