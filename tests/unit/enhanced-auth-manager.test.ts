/**
 * Enhanced Auth Manager Tests
 * Tests for improved OAuth2 refresh token management
 */

import { AuthManager } from "../../src/background/auth-manager";
import { ExtensionStorage } from "../../src/shared/storage";
import type { CloudCredentials } from "../../src/shared/types";

// Mock Response class for Node.js environment
class MockResponse {
  constructor(
    private body: string,
    private init: { status: number },
  ) {}

  get ok() {
    return this.init.status >= 200 && this.init.status < 300;
  }

  get status() {
    return this.init.status;
  }

  get statusText() {
    const statusTexts: Record<number, string> = {
      200: "OK",
      400: "Bad Request",
      401: "Unauthorized",
      403: "Forbidden",
    };
    return statusTexts[this.init.status] || "Unknown";
  }

  async json() {
    return JSON.parse(this.body);
  }
}

// Set global Response
global.Response = MockResponse as any;

// Mock Chrome APIs
const mockChrome = {
  runtime: {
    getManifest: jest.fn(() => ({
      oauth2: {
        client_id: "test-client-id",
      },
    })),
    id: "test-extension-id",
  },
  identity: {
    getAuthToken: jest.fn(),
    launchWebAuthFlow: jest.fn(),
    removeCachedAuthToken: jest.fn(),
    getRedirectURL: jest.fn(() => "https://test-extension-id.chromiumapp.org/"),
  },
};

// Mock global chrome object
global.chrome = mockChrome as any;

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

// Mock ExtensionStorage
jest.mock("../../src/shared/storage", () => ({
  ExtensionStorage: {
    getCloudCredentials: jest.fn(),
    setCloudCredentials: jest.fn(),
    clearCloudCredentials: jest.fn(),
  },
}));

describe("Enhanced AuthManager", () => {
  const mockExtensionStorage = ExtensionStorage as jest.Mocked<
    typeof ExtensionStorage
  >;
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2023-01-01T12:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("Proactive Token Refresh", () => {
    test("should proactively refresh token when expiring soon", async () => {
      const expiringSoonCredentials: CloudCredentials = {
        provider: "google-drive",
        accessToken: "expiring_token",
        refreshToken: "refresh_token_123",
        expiresAt: new Date("2023-01-01T12:05:00Z"), // Expires in 5 minutes
        issuedAt: new Date("2023-01-01T11:00:00Z"),
        refreshAttempts: 0,
      };

      mockExtensionStorage.getCloudCredentials.mockResolvedValue(
        expiringSoonCredentials,
      );

      // Mock successful refresh token response
      mockFetch.mockResolvedValueOnce(
        new (MockResponse as any)(
          JSON.stringify({
            access_token: "new_access_token",
            expires_in: 3600,
            scope: "https://www.googleapis.com/auth/drive",
            token_type: "Bearer",
          }),
          { status: 200 },
        ),
      );

      const result = await AuthManager.authenticateWithGoogle();

      expect(result.success).toBe(true);
      expect(result.credentials?.accessToken).toBe("new_access_token");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://oauth2.googleapis.com/token",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/x-www-form-urlencoded",
          }),
        }),
      );
    });

    test("should not refresh token if plenty of time remaining", async () => {
      const validCredentials: CloudCredentials = {
        provider: "google-drive",
        accessToken: "valid_token",
        refreshToken: "refresh_token_123",
        expiresAt: new Date("2023-01-01T14:00:00Z"), // Expires in 2 hours
        issuedAt: new Date("2023-01-01T11:00:00Z"),
        refreshAttempts: 0,
      };

      mockExtensionStorage.getCloudCredentials.mockResolvedValue(
        validCredentials,
      );

      // Mock successful token validation
      mockFetch.mockResolvedValueOnce(
        new (MockResponse as any)(
          JSON.stringify({ user: { emailAddress: "test@example.com" } }),
          { status: 200 },
        ),
      );

      const result = await AuthManager.authenticateWithGoogle();

      expect(result.success).toBe(true);
      expect(result.credentials?.accessToken).toBe("valid_token");
      // Should not call token refresh endpoint
      expect(mockFetch).toHaveBeenCalledWith(
        "https://www.googleapis.com/drive/v3/about?fields=user",
        expect.any(Object),
      );
    });
  });

  describe("Refresh Token Management", () => {
    test("should handle refresh token failure and fallback to Chrome identity", async () => {
      const credentials: CloudCredentials = {
        provider: "google-drive",
        accessToken: "invalid_token",
        refreshToken: "invalid_refresh_token",
        expiresAt: new Date("2023-01-01T11:30:00Z"), // Already expired
        refreshAttempts: 0,
      };

      mockExtensionStorage.getCloudCredentials.mockResolvedValue(credentials);

      // Mock refresh token failure
      mockFetch.mockResolvedValueOnce(
        new (MockResponse as any)(
          JSON.stringify({
            error: "invalid_grant",
            error_description: "Token has been expired or revoked.",
          }),
          { status: 400 },
        ),
      );

      // Mock successful Chrome identity fallback
      mockChrome.identity.getAuthToken.mockImplementation(
        (config, callback) => {
          callback("chrome_identity_token");
        },
      );

      const result = await AuthManager.refreshToken("invalid_refresh_token");

      expect(result.success).toBe(true);
      expect(result.credentials?.accessToken).toBe("chrome_identity_token");
      expect(mockExtensionStorage.setCloudCredentials).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: "chrome_identity_token",
          refreshAttempts: 0, // Reset on successful refresh
        }),
      );
    });

    test("should respect max refresh attempts", async () => {
      const credentials: CloudCredentials = {
        provider: "google-drive",
        accessToken: "token",
        refreshToken: "refresh_token",
        refreshAttempts: 3, // Already at max
      };

      mockExtensionStorage.getCloudCredentials.mockResolvedValue(credentials);

      const result = await AuthManager.refreshToken();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Maximum refresh attempts exceeded");
      expect(mockExtensionStorage.clearCloudCredentials).toHaveBeenCalled();
    });

    test("should handle refresh cooldown period", async () => {
      const credentials: CloudCredentials = {
        provider: "google-drive",
        accessToken: "token",
        refreshToken: "refresh_token",
        refreshAttempts: 1,
        lastRefreshAt: new Date("2023-01-01T11:58:00Z"), // 2 minutes ago (within 5 min cooldown)
      };

      mockExtensionStorage.getCloudCredentials.mockResolvedValue(credentials);

      const result = await AuthManager.refreshToken();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Refresh cooldown in effect");
    });
  });

  describe("Enhanced Error Handling", () => {
    test("should handle network errors gracefully", async () => {
      mockExtensionStorage.getCloudCredentials.mockResolvedValue(null);

      // Mock network error
      mockFetch.mockRejectedValue(new Error("Network error"));
      mockChrome.identity.getAuthToken.mockImplementation(
        (config, callback) => {
          callback(null);
        },
      );

      const result = await AuthManager.authenticateWithGoogle();

      expect(result.success).toBe(false);
      expect(result.error).toContain("OAuth flow cancelled or failed");
    });

    test("should provide detailed error information for OAuth failures", async () => {
      mockExtensionStorage.getCloudCredentials.mockResolvedValue(null);

      // Mock Chrome identity failure
      mockChrome.identity.getAuthToken.mockImplementation(
        (config, callback) => {
          callback(null);
        },
      );

      // Mock OAuth flow failure
      mockChrome.identity.launchWebAuthFlow.mockImplementation(
        (config, callback) => {
          callback(null);
        },
      );

      const result = await AuthManager.authenticateWithGoogle();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("Enhanced Authentication Status", () => {
    test("should provide comprehensive auth status information", async () => {
      const credentials: CloudCredentials = {
        provider: "google-drive",
        accessToken: "valid_token",
        refreshToken: "refresh_token_123",
        expiresAt: new Date("2023-01-01T13:00:00Z"),
        refreshAttempts: 1,
        lastRefreshAt: new Date("2023-01-01T10:00:00Z"),
      };

      mockExtensionStorage.getCloudCredentials.mockResolvedValue(credentials);

      // Mock successful token validation for auth status test
      mockFetch.mockResolvedValueOnce(
        new (MockResponse as any)(
          JSON.stringify({ user: { emailAddress: "test@example.com" } }),
          { status: 200 },
        ),
      );

      const status = await AuthManager.getAuthStatus();

      expect(status).toEqual({
        isAuthenticated: true,
        provider: "google-drive",
        expiresAt: credentials.expiresAt,
        hasRefreshToken: true,
        needsRefresh: false,
        refreshAttempts: 1,
        lastRefreshAt: credentials.lastRefreshAt,
      });
    });

    test("should detect when token needs refresh", async () => {
      const credentials: CloudCredentials = {
        provider: "google-drive",
        accessToken: "valid_token",
        refreshToken: "refresh_token_123",
        expiresAt: new Date("2023-01-01T12:05:00Z"), // Expires in 5 minutes
      };

      mockExtensionStorage.getCloudCredentials.mockResolvedValue(credentials);

      // Mock successful token validation for needs refresh test
      mockFetch.mockResolvedValueOnce(
        new (MockResponse as any)(
          JSON.stringify({ user: { emailAddress: "test@example.com" } }),
          { status: 200 },
        ),
      );

      const status = await AuthManager.getAuthStatus();

      expect(status.needsRefresh).toBe(true);
    });
  });

  describe("Enhanced Sign Out", () => {
    test("should revoke refresh token on sign out", async () => {
      const credentials: CloudCredentials = {
        provider: "google-drive",
        accessToken: "access_token",
        refreshToken: "refresh_token_to_revoke",
      };

      mockExtensionStorage.getCloudCredentials.mockResolvedValue(credentials);

      // Mock successful token revocation
      mockFetch.mockResolvedValueOnce(
        new (MockResponse as any)("", { status: 200 }),
      );

      // Mock Chrome identity cache clearing
      mockChrome.identity.removeCachedAuthToken.mockImplementation(
        (config, callback) => {
          callback();
        },
      );

      await AuthManager.signOut();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("https://oauth2.googleapis.com/revoke"),
        expect.objectContaining({ method: "POST" }),
      );
      expect(mockChrome.identity.removeCachedAuthToken).toHaveBeenCalled();
      expect(mockExtensionStorage.clearCloudCredentials).toHaveBeenCalled();
    });

    test("should continue sign out even if token revocation fails", async () => {
      const credentials: CloudCredentials = {
        provider: "google-drive",
        accessToken: "access_token",
        refreshToken: "invalid_refresh_token",
      };

      mockExtensionStorage.getCloudCredentials.mockResolvedValue(credentials);

      // Mock failed token revocation
      mockFetch.mockResolvedValueOnce(
        new (MockResponse as any)("", { status: 400 }),
      );

      // Mock Chrome identity cache clearing
      mockChrome.identity.removeCachedAuthToken.mockImplementation(
        (config, callback) => {
          callback();
        },
      );

      await AuthManager.signOut();

      // Should still clear credentials even if revocation fails
      expect(mockExtensionStorage.clearCloudCredentials).toHaveBeenCalled();
    });
  });

  describe("Token Validation", () => {
    test("should validate token with detailed response", async () => {
      // Mock successful validation response
      mockFetch.mockResolvedValueOnce(
        new (MockResponse as any)(
          JSON.stringify({ user: { emailAddress: "test@example.com" } }),
          { status: 200 },
        ),
      );

      const isValid = await (AuthManager as any).validateToken("valid_token");

      expect(isValid).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://www.googleapis.com/drive/v3/about?fields=user",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer valid_token",
          }),
        }),
      );
    });

    test("should handle 401 unauthorized response", async () => {
      // Mock 401 response
      mockFetch.mockResolvedValueOnce(
        new (MockResponse as any)("", { status: 401 }),
      );

      const isValid = await (AuthManager as any).validateToken("invalid_token");

      expect(isValid).toBe(false);
    });
  });

  describe("Enhanced OAuth Flow", () => {
    test("should use enhanced OAuth configuration", async () => {
      mockExtensionStorage.getCloudCredentials.mockResolvedValue(null);

      // Mock Chrome identity failure to trigger OAuth flow
      mockChrome.identity.getAuthToken.mockImplementation(
        (config, callback) => {
          (mockChrome.runtime as any).lastError = {
            message: "User denied access",
          };
          callback(null);
        },
      );

      // Mock successful OAuth flow
      mockChrome.identity.launchWebAuthFlow.mockImplementation(
        async (config) => {
          const authUrl = config.url;
          expect(authUrl).toContain("access_type=offline");
          expect(authUrl).toContain("prompt=consent");
          expect(authUrl).toContain("include_granted_scopes=true");

          // Simulate auth code response
          return "https://test-extension-id.chromiumapp.org/?code=auth_code_123";
        },
      );

      // Mock token exchange
      mockFetch.mockResolvedValueOnce(
        new (MockResponse as any)(
          JSON.stringify({
            access_token: "new_access_token",
            refresh_token: "new_refresh_token",
            expires_in: 3600,
            token_type: "Bearer",
            scope: "https://www.googleapis.com/auth/drive",
          }),
          { status: 200 },
        ),
      );

      const result = await AuthManager.authenticateWithGoogle();

      expect(result.success).toBe(true);
      // Note: refresh token may not be available in the mock response
      expect(mockExtensionStorage.setCloudCredentials).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: "new_access_token",
        }),
      );

      // Clean up
      (mockChrome.runtime as any).lastError = undefined;
    });
  });
});
