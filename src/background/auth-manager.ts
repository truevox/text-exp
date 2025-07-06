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
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

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
   * Authenticate with Google Drive
   */
  static async authenticateWithGoogle(): Promise<AuthResult> {
    try {
      console.log("🔐 Starting Google Drive authentication...");

      // Check if already authenticated
      const existingCredentials = await ExtensionStorage.getCloudCredentials();
      if (
        existingCredentials &&
        existingCredentials.provider === "google-drive"
      ) {
        const isValid = await this.validateToken(
          existingCredentials.accessToken,
        );
        if (isValid) {
          console.log("✅ Using existing valid credentials");
          return { success: true, credentials: existingCredentials };
        } else {
          // Try to refresh token
          const refreshed = await this.refreshToken(
            existingCredentials.refreshToken,
          );
          if (refreshed.success) {
            console.log("✅ Token refreshed successfully");
            return refreshed;
          }
        }
      }

      // Use Chrome's built-in identity API for Google OAuth
      const accessToken = await this.getChromeIdentityToken();
      if (!accessToken) {
        return {
          success: false,
          error: "Failed to get access token from Chrome identity API",
        };
      }

      // Create and store credentials
      const credentials: CloudCredentials = {
        provider: "google-drive",
        accessToken: accessToken,
        // Chrome identity API manages refresh automatically
        expiresAt: new Date(Date.now() + 3600 * 1000), // Assume 1 hour expiry
      };

      await ExtensionStorage.setCloudCredentials(credentials);

      console.log("✅ Google Drive authentication successful");
      return { success: true, credentials };
    } catch (error) {
      console.error("❌ Google Drive authentication failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Authentication failed",
      };
    }
  }

  /**
   * Get access token using Chrome's identity API
   */
  private static async getChromeIdentityToken(): Promise<string | null> {
    try {
      const provider = CLOUD_PROVIDERS["google-drive"];

      return new Promise((resolve) => {
        chrome.identity.getAuthToken(
          {
            interactive: true,
            scopes: [...provider.scopes],
          },
          (token) => {
            if (chrome.runtime.lastError) {
              console.error("Chrome identity error:", chrome.runtime.lastError);
              resolve(null);
            } else {
              resolve(token || null);
            }
          },
        );
      });
    } catch (error) {
      console.error("Error getting Chrome identity token:", error);
      return null;
    }
  }

  /**
   * Launch OAuth2 web flow (fallback for Chrome identity API)
   */
  private static async launchOAuthFlow(): Promise<
    { success: true; authCode: string } | { success: false; error: string }
  > {
    const provider = CLOUD_PROVIDERS["google-drive"];

    // Chrome extensions should use Chrome's identity API instead of manual OAuth
    // The client_id is configured in manifest.json
    const manifest = chrome.runtime.getManifest();
    const clientId = manifest.oauth2?.client_id;

    if (!clientId) {
      return {
        success: false,
        error: "OAuth2 client_id not configured in manifest.json",
      };
    }

    const authUrl =
      `${provider.authUrl}?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(this.REDIRECT_URI)}&` +
      `scope=${encodeURIComponent(provider.scopes.join(" "))}&` +
      `access_type=offline&` +
      `prompt=consent`;

    try {
      const responseUrl = await chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true,
      });

      if (!responseUrl) {
        return { success: false, error: "OAuth flow cancelled or failed" };
      }

      // Extract authorization code from response URL
      const url = new URL(responseUrl);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        return { success: false, error: `OAuth error: ${error}` };
      }

      if (!code) {
        return { success: false, error: "No authorization code received" };
      }

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
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `Token exchange failed: ${errorData.error_description || response.statusText}`,
        );
      }

      const tokens: TokenResponse = await response.json();
      return tokens;
    } catch (error) {
      console.error("Token exchange error:", error);
      return null;
    }
  }

  /**
   * Refresh expired access token using Chrome's identity API
   */
  static async refreshToken(_refreshToken?: string): Promise<AuthResult> {
    try {
      console.log("🔄 Refreshing token using Chrome identity API...");

      // Chrome identity API handles token refresh automatically
      // We just need to get a fresh token
      const newToken = await this.getChromeIdentityToken();

      if (!newToken) {
        // Clear invalid credentials and require re-authentication
        await ExtensionStorage.clearCloudCredentials();
        return {
          success: false,
          error: "Failed to refresh token via Chrome identity API",
        };
      }

      // Update stored credentials with new token
      const updatedCredentials: CloudCredentials = {
        provider: "google-drive",
        accessToken: newToken,
        // Chrome identity API manages refresh automatically, no refresh token needed
        expiresAt: new Date(Date.now() + 3600 * 1000), // Assume 1 hour expiry
      };

      await ExtensionStorage.setCloudCredentials(updatedCredentials);

      console.log("✅ Token refreshed successfully via Chrome identity API");
      return { success: true, credentials: updatedCredentials };
    } catch (error) {
      console.error("❌ Token refresh failed:", error);

      // Clear invalid credentials
      await ExtensionStorage.clearCloudCredentials();

      return {
        success: false,
        error: error instanceof Error ? error.message : "Token refresh failed",
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
   * Ensure we have a valid access token
   */
  static async ensureValidToken(): Promise<string | null> {
    try {
      const credentials = await ExtensionStorage.getCloudCredentials();

      if (!credentials || credentials.provider !== "google-drive") {
        console.log("🔐 No Google Drive credentials, getting new token...");
        return await this.getChromeIdentityToken();
      }

      // Validate current token
      const isValid = await this.validateToken(credentials.accessToken);

      if (isValid) {
        return credentials.accessToken;
      }

      // Token invalid, get a fresh one using Chrome identity API
      console.log("🔄 Token invalid, getting fresh token...");
      const refreshResult = await this.refreshToken();

      if (refreshResult.success && refreshResult.credentials) {
        return refreshResult.credentials.accessToken;
      } else {
        return null;
      }
    } catch (error) {
      console.error("Error ensuring valid token:", error);
      return null;
    }
  }

  /**
   * Sign out and clear credentials
   */
  static async signOut(): Promise<void> {
    try {
      console.log("🔓 Signing out...");
      await ExtensionStorage.clearCloudCredentials();
      console.log("✅ Signed out successfully");
    } catch (error) {
      console.error("❌ Sign out failed:", error);
    }
  }

  /**
   * Get current authentication status
   */
  static async getAuthStatus(): Promise<{
    isAuthenticated: boolean;
    provider?: string;
    expiresAt?: Date;
  }> {
    try {
      const credentials = await ExtensionStorage.getCloudCredentials();

      if (!credentials) {
        return { isAuthenticated: false };
      }

      const isValid = await this.validateToken(credentials.accessToken);

      return {
        isAuthenticated: isValid,
        provider: credentials.provider,
        expiresAt: credentials.expiresAt,
      };
    } catch (error) {
      console.error("Error checking auth status:", error);
      return { isAuthenticated: false };
    }
  }
}
