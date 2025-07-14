/**
 * Authentication Manager for Google Drive OAuth2
 * Handles OAuth flow, token management, and refresh logic
 */

import { ExtensionStorage } from "../shared/storage.js";
import { CLOUD_PROVIDERS } from "../shared/constants.js";
import type { CloudCredentials } from "../shared/types.js";

export interface AuthResult {
  success: boolean;
  credentials?: CloudCredentials;
  error?: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface RefreshTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

// Constants for token management
const TOKEN_REFRESH_THRESHOLD_MINUTES = 10; // Refresh if token expires within 10 minutes
const MAX_REFRESH_ATTEMPTS = 3;
const REFRESH_COOLDOWN_MINUTES = 5;

/**
 * Manages OAuth2 authentication for cloud providers
 * Note: OAuth2 configuration is handled via manifest.json and Chrome's identity API
 */
export class AuthManager {
  // OAuth2 configuration is handled via manifest.json for Chrome extensions
  // No need for hardcoded client IDs - Chrome identity API manages this
  private static get REDIRECT_URI(): string {
    return `https://${chrome.runtime.id}.chromiumapp.org/`;
  }

  /**
   * Authenticate with Google Drive using enhanced OAuth2 flow
   */
  static async authenticateWithGoogle(): Promise<AuthResult> {
    try {
      console.log("🔐 Starting Google Drive authentication...");

      // Check if already authenticated and proactively refresh if needed
      const existingCredentials = await ExtensionStorage.getCloudCredentials();
      if (
        existingCredentials &&
        existingCredentials.provider === "google-drive"
      ) {
        // Check if token needs proactive refresh
        const needsRefresh = this.shouldRefreshToken(existingCredentials);

        if (!needsRefresh) {
          const isValid = await this.validateToken(
            existingCredentials.accessToken,
          );
          if (isValid) {
            console.log("✅ Using existing valid credentials");
            return { success: true, credentials: existingCredentials };
          }
        }

        // Try to refresh token using stored refresh token or Chrome identity
        console.log("🔄 Proactively refreshing token...");
        const refreshed = await this.refreshToken(
          existingCredentials.refreshToken,
        );
        if (refreshed.success) {
          console.log("✅ Token refreshed successfully");
          return refreshed;
        }
      }

      // Try Chrome identity API first
      const chromeResult = await this.authenticateWithChromeIdentity();
      if (chromeResult.success) {
        return chromeResult;
      }

      // Fallback to manual OAuth flow for better token management
      console.log(
        "🔄 Falling back to manual OAuth flow for refresh token support...",
      );
      const manualResult = await this.authenticateWithManualOAuth();
      return manualResult;
    } catch (error) {
      console.error("❌ Google Drive authentication failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Authentication failed",
      };
    }
  }

  /**
   * Authenticate using Chrome's identity API
   */
  private static async authenticateWithChromeIdentity(): Promise<AuthResult> {
    try {
      const provider = CLOUD_PROVIDERS["google-drive"];

      const accessToken = await new Promise<string | null>((resolve) => {
        chrome.identity.getAuthToken(
          {
            interactive: true,
            scopes: [...provider.scopes],
          },
          (token) => {
            if (chrome.runtime.lastError) {
              console.log(
                "Chrome identity limitation:",
                chrome.runtime.lastError.message,
              );
              resolve(null);
            } else {
              resolve(token || null);
            }
          },
        );
      });

      if (!accessToken) {
        return {
          success: false,
          error: "Chrome identity API failed - will try manual OAuth",
        };
      }

      // Create credentials with Chrome identity token
      const credentials: CloudCredentials = {
        provider: "google-drive",
        accessToken: accessToken,
        tokenType: "bearer",
        expiresAt: new Date(Date.now() + 3600 * 1000), // Assume 1 hour expiry
        issuedAt: new Date(),
        refreshAttempts: 0,
      };

      await ExtensionStorage.setCloudCredentials(credentials);
      console.log("✅ Chrome identity authentication successful");
      return { success: true, credentials };
    } catch (error) {
      console.error("Chrome identity authentication error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Chrome identity failed",
      };
    }
  }

  /**
   * Authenticate using manual OAuth flow with refresh token support
   */
  private static async authenticateWithManualOAuth(): Promise<AuthResult> {
    try {
      const oauthResult = await this.launchOAuthFlow();
      if (!oauthResult.success) {
        return {
          success: false,
          error: oauthResult.error,
        };
      }

      const tokens = await this.exchangeCodeForTokens(oauthResult.authCode);
      if (!tokens) {
        return {
          success: false,
          error: "Failed to exchange authorization code for tokens",
        };
      }

      // Create enhanced credentials with refresh token
      const credentials: CloudCredentials = {
        provider: "google-drive",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenType: tokens.token_type as "bearer",
        scope: tokens.scope,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        issuedAt: new Date(),
        refreshAttempts: 0,
      };

      await ExtensionStorage.setCloudCredentials(credentials);
      console.log(
        "✅ Manual OAuth authentication successful with refresh token",
      );
      return { success: true, credentials };
    } catch (error) {
      console.error("Manual OAuth authentication error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Manual OAuth failed",
      };
    }
  }

  /**
   * Check if token should be proactively refreshed
   */
  private static shouldRefreshToken(credentials: CloudCredentials): boolean {
    if (!credentials.expiresAt) {
      return false; // Chrome identity tokens don't have expiry info
    }

    const now = new Date();
    const expiresAt = new Date(credentials.expiresAt);
    const thresholdTime = new Date(
      now.getTime() + TOKEN_REFRESH_THRESHOLD_MINUTES * 60 * 1000,
    );

    // Refresh if token expires within threshold
    if (expiresAt <= thresholdTime) {
      console.log(
        `🔄 Token expires at ${expiresAt.toISOString()}, refreshing proactively`,
      );
      return true;
    }

    return false;
  }

  /**
   * Launch OAuth2 web flow with enhanced configuration
   */
  private static async launchOAuthFlow(): Promise<
    { success: true; authCode: string } | { success: false; error: string }
  > {
    const provider = CLOUD_PROVIDERS["google-drive"];

    const manifest = chrome.runtime.getManifest();
    const clientId = manifest.oauth2?.client_id;

    if (!clientId) {
      return {
        success: false,
        error: "OAuth2 client_id not configured in manifest.json",
      };
    }

    // Enhanced OAuth URL with proper refresh token configuration
    const authUrl =
      `${provider.authUrl}?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(this.REDIRECT_URI)}&` +
      `scope=${encodeURIComponent(provider.scopes.join(" "))}&` +
      `access_type=offline&` +
      `prompt=consent&` +
      `include_granted_scopes=true`; // Include previously granted scopes

    try {
      console.log("🔐 Launching OAuth flow with enhanced configuration...");
      const responseUrl = await chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true,
      });

      if (!responseUrl) {
        return { success: false, error: "OAuth flow cancelled or failed" };
      }

      console.log("✅ OAuth flow completed, extracting authorization code...");

      // Extract authorization code from response URL
      const url = new URL(responseUrl);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");
      const errorDescription = url.searchParams.get("error_description");

      if (error) {
        const errorMsg = errorDescription || error;
        console.error("OAuth error:", errorMsg);
        return { success: false, error: `OAuth error: ${errorMsg}` };
      }

      if (!code) {
        return { success: false, error: "No authorization code received" };
      }

      console.log("✅ Authorization code received successfully");
      return { success: true, authCode: code };
    } catch (error) {
      console.error("OAuth flow error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "OAuth flow failed",
      };
    }
  }

  /**
   * Exchange authorization code for access and refresh tokens
   */
  private static async exchangeCodeForTokens(
    authCode: string,
  ): Promise<TokenResponse | null> {
    try {
      const manifest = chrome.runtime.getManifest();
      const clientId = manifest.oauth2?.client_id;

      if (!clientId) {
        console.error("OAuth2 client_id not configured in manifest.json");
        return null;
      }

      console.log("🔄 Exchanging authorization code for tokens...");
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          code: authCode,
          grant_type: "authorization_code",
          redirect_uri: this.REDIRECT_URI,
          // Request offline access to get refresh token
          access_type: "offline",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Token exchange failed:", errorData);
        throw new Error(
          `Token exchange failed: ${errorData.error_description || response.statusText}`,
        );
      }

      const tokens: TokenResponse = await response.json();
      console.log(
        "✅ Token exchange successful, received refresh token:",
        !!tokens.refresh_token,
      );
      return tokens;
    } catch (error) {
      console.error("Token exchange error:", error);
      return null;
    }
  }

  /**
   * Refresh expired access token using stored refresh token or Chrome identity API
   */
  static async refreshToken(refreshToken?: string): Promise<AuthResult> {
    try {
      console.log("🔄 Refreshing access token...");

      const credentials = await ExtensionStorage.getCloudCredentials();
      if (!credentials) {
        return {
          success: false,
          error: "No credentials found for refresh",
        };
      }

      // Check refresh attempt limits and cooldown
      const refreshAttempts = credentials.refreshAttempts || 0;
      if (refreshAttempts >= MAX_REFRESH_ATTEMPTS) {
        console.log("🚫 Max refresh attempts reached, clearing credentials");
        await ExtensionStorage.clearCloudCredentials();
        return {
          success: false,
          error: "Maximum refresh attempts exceeded",
        };
      }

      // Check cooldown period
      if (credentials.lastRefreshAt) {
        const cooldownEnd = new Date(
          credentials.lastRefreshAt.getTime() +
            REFRESH_COOLDOWN_MINUTES * 60 * 1000,
        );
        if (new Date() < cooldownEnd) {
          console.log("⏳ In refresh cooldown period");
          return {
            success: false,
            error: "Refresh cooldown in effect",
          };
        }
      }

      // Update refresh attempt counter
      const updatedCredentials = {
        ...credentials,
        refreshAttempts: refreshAttempts + 1,
        lastRefreshAt: new Date(),
      };
      await ExtensionStorage.setCloudCredentials(updatedCredentials);

      // Try refresh token first if available
      const tokenToUse = refreshToken || credentials.refreshToken;
      if (tokenToUse) {
        console.log("🔄 Using refresh token for token refresh...");
        const refreshResult =
          await this.refreshTokenWithRefreshToken(tokenToUse);
        if (refreshResult.success) {
          return refreshResult;
        }
        console.log(
          "⚠️ Refresh token failed, falling back to Chrome identity...",
        );
      }

      // Fallback to Chrome identity API
      console.log("🔄 Using Chrome identity API for token refresh...");
      const chromeResult = await this.authenticateWithChromeIdentity();
      if (chromeResult.success && chromeResult.credentials) {
        // Reset refresh attempts on successful refresh
        const finalCredentials = {
          ...chromeResult.credentials,
          refreshAttempts: 0,
          lastRefreshAt: new Date(),
        };
        await ExtensionStorage.setCloudCredentials(finalCredentials);
        return { success: true, credentials: finalCredentials };
      }

      // All refresh methods failed
      console.log("❌ All token refresh methods failed, clearing credentials");
      await ExtensionStorage.clearCloudCredentials();
      return {
        success: false,
        error: "All token refresh methods failed",
      };
    } catch (error) {
      console.error("❌ Token refresh error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Token refresh failed",
      };
    }
  }

  /**
   * Refresh access token using stored refresh token
   */
  private static async refreshTokenWithRefreshToken(
    refreshToken: string,
  ): Promise<AuthResult> {
    try {
      const manifest = chrome.runtime.getManifest();
      const clientId = manifest.oauth2?.client_id;

      if (!clientId) {
        return {
          success: false,
          error: "OAuth2 client_id not configured in manifest.json",
        };
      }

      console.log("🔄 Making refresh token request...");
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Refresh token request failed:", errorData);

        // If refresh token is invalid, clear it
        if (errorData.error === "invalid_grant") {
          console.log("🗑️ Refresh token is invalid, clearing credentials");
          await ExtensionStorage.clearCloudCredentials();
        }

        return {
          success: false,
          error: `Refresh failed: ${errorData.error_description || response.statusText}`,
        };
      }

      const tokenData: RefreshTokenResponse = await response.json();

      // Get existing credentials to preserve refresh token
      const existingCredentials = await ExtensionStorage.getCloudCredentials();

      const updatedCredentials: CloudCredentials = {
        provider: "google-drive",
        accessToken: tokenData.access_token,
        refreshToken: refreshToken, // Keep the same refresh token
        tokenType: tokenData.token_type as "bearer",
        scope: tokenData.scope,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        issuedAt: new Date(),
        refreshAttempts: 0, // Reset on successful refresh
        lastRefreshAt: new Date(),
        // Preserve other fields
        email: existingCredentials?.email,
      };

      await ExtensionStorage.setCloudCredentials(updatedCredentials);
      console.log("✅ Token refreshed successfully using refresh token");
      return { success: true, credentials: updatedCredentials };
    } catch (error) {
      console.error("❌ Refresh token request error:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Refresh token request failed",
      };
    }
  }

  /**
   * Validate access token by making a test API call
   */
  private static async validateToken(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch(
        "https://www.googleapis.com/drive/v3/about?fields=user",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      return response.ok;
    } catch (error) {
      console.error("Token validation error:", error);
      return false;
    }
  }

  /**
   * Ensure we have a valid access token with proactive refresh
   */
  static async ensureValidToken(): Promise<string | null> {
    try {
      const credentials = await ExtensionStorage.getCloudCredentials();

      if (!credentials || credentials.provider !== "google-drive") {
        console.log("🔐 No Google Drive credentials, authenticating...");
        const authResult = await this.authenticateWithGoogle();
        return authResult.success && authResult.credentials
          ? authResult.credentials.accessToken
          : null;
      }

      // Check if proactive refresh is needed
      if (this.shouldRefreshToken(credentials)) {
        console.log("🔄 Proactively refreshing token before expiration...");
        const refreshResult = await this.refreshToken(credentials.refreshToken);
        if (refreshResult.success && refreshResult.credentials) {
          return refreshResult.credentials.accessToken;
        }
      }

      // Validate current token
      const isValid = await this.validateToken(credentials.accessToken);
      if (isValid) {
        return credentials.accessToken;
      }

      // Token invalid, try to refresh
      console.log("🔄 Token invalid, attempting refresh...");
      const refreshResult = await this.refreshToken(credentials.refreshToken);
      if (refreshResult.success && refreshResult.credentials) {
        return refreshResult.credentials.accessToken;
      }

      // All methods failed, re-authenticate
      console.log("🔐 All refresh methods failed, re-authenticating...");
      const authResult = await this.authenticateWithGoogle();
      return authResult.success && authResult.credentials
        ? authResult.credentials.accessToken
        : null;
    } catch (error) {
      console.error("Error ensuring valid token:", error);
      return null;
    }
  }

  /**
   * Sign out and clear credentials with enhanced cleanup
   */
  static async signOut(): Promise<void> {
    try {
      console.log("🔓 Signing out and cleaning up credentials...");

      // Get credentials before clearing to revoke tokens if needed
      const credentials = await ExtensionStorage.getCloudCredentials();

      if (credentials && credentials.refreshToken) {
        // Revoke refresh token for better security
        try {
          await this.revokeRefreshToken(credentials.refreshToken);
          console.log("✅ Refresh token revoked");
        } catch (error) {
          console.warn("⚠️ Failed to revoke refresh token:", error);
        }
      }

      // Clear Chrome identity cache
      if (credentials && credentials.accessToken) {
        chrome.identity.removeCachedAuthToken(
          { token: credentials.accessToken },
          () => {
            console.log("🗑️ Chrome identity token cache cleared");
          },
        );
      }

      // Clear stored credentials
      await ExtensionStorage.clearCloudCredentials();
      console.log("✅ Signed out successfully");
    } catch (error) {
      console.error("❌ Sign out failed:", error);
    }
  }

  /**
   * Revoke refresh token for security
   */
  private static async revokeRefreshToken(refreshToken: string): Promise<void> {
    try {
      const response = await fetch(
        `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Revoke failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error("Error revoking refresh token:", error);
      throw error;
    }
  }

  /**
   * Get current authentication status with enhanced information
   */
  static async getAuthStatus(): Promise<{
    isAuthenticated: boolean;
    provider?: string;
    expiresAt?: Date;
    hasRefreshToken?: boolean;
    needsRefresh?: boolean;
    refreshAttempts?: number;
    lastRefreshAt?: Date;
  }> {
    try {
      const credentials = await ExtensionStorage.getCloudCredentials();

      if (!credentials) {
        return { isAuthenticated: false };
      }

      const isValid = await this.validateToken(credentials.accessToken);
      const needsRefresh = this.shouldRefreshToken(credentials);

      return {
        isAuthenticated: isValid,
        provider: credentials.provider,
        expiresAt: credentials.expiresAt,
        hasRefreshToken: !!credentials.refreshToken,
        needsRefresh,
        refreshAttempts: credentials.refreshAttempts || 0,
        lastRefreshAt: credentials.lastRefreshAt,
      };
    } catch (error) {
      console.error("Error checking auth status:", error);
      return { isAuthenticated: false };
    }
  }
}
