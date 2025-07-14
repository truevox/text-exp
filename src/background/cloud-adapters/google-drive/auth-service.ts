/**
 * Google Drive Authentication Service
 * Handles all Google Drive OAuth and authentication flows
 */

import type { CloudCredentials } from "../../../shared/types.js";
import { CLOUD_PROVIDERS } from "../../../shared/constants.js";

// Enhanced refresh token management
interface RefreshTokenResult {
  success: boolean;
  credentials?: CloudCredentials;
  error?: string;
}

// Token refresh configuration
const REFRESH_TOKEN_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  timeoutMs: 10000, // 10 seconds
};

export class GoogleDriveAuthService {
  /**
   * Authenticate with Google Drive using enhanced OAuth flow
   */
  static async authenticate(): Promise<CloudCredentials> {
    return new Promise((resolve, reject) => {
      // Try Chrome's built-in OAuth first
      const scopes = CLOUD_PROVIDERS["google-drive"].scopes;

      console.log(
        "🔐 Attempting Chrome identity.getAuthToken with enhanced configuration...",
      );

      chrome.identity.getAuthToken(
        {
          interactive: true,
          scopes: [...scopes], // Convert readonly array to mutable
        },
        (token) => {
          if (chrome.runtime.lastError) {
            console.log(
              "🔐 Chrome identity failed, falling back to manual OAuth with refresh token support:",
              chrome.runtime.lastError.message,
            );
            // Enhanced fallback with refresh token support
            this.authenticateManuallyWithRefreshToken(resolve, reject);
            return;
          }

          if (!token) {
            console.error("🚫 No token received from Chrome identity");
            reject(new Error("Authentication failed - no token"));
            return;
          }

          console.log("✅ Chrome identity token received");

          // Enhanced credentials object
          const credentials: CloudCredentials = {
            provider: "google-drive",
            accessToken: token,
            tokenType: "bearer",
            expiresAt: new Date(Date.now() + 3600 * 1000), // Assume 1 hour
            issuedAt: new Date(),
            refreshAttempts: 0,
          };

          resolve(credentials);
        },
      );
    });
  }

  /**
   * Enhanced manual OAuth authentication with refresh token support
   */
  private static authenticateManuallyWithRefreshToken(
    resolve: (value: CloudCredentials) => void,
    reject: (reason?: any) => void,
  ): void {
    const authUrl = this.buildEnhancedAuthUrl();
    console.log("🔐 Google Drive enhanced manual auth URL:", authUrl);

    chrome.identity.launchWebAuthFlow(
      {
        url: authUrl,
        interactive: true,
      },
      (redirectUrl) => {
        if (chrome.runtime.lastError) {
          console.error(
            "🚫 Manual OAuth error:",
            chrome.runtime.lastError.message,
          );
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!redirectUrl) {
          console.error("🚫 No redirect URL received");
          reject(new Error("Authentication cancelled"));
          return;
        }

        console.log("✅ Enhanced OAuth redirect URL received:", redirectUrl);

        try {
          // Check if we got an authorization code (for refresh token flow)
          const url = new URL(redirectUrl);
          const code = url.searchParams.get("code");

          if (code) {
            console.log(
              "🔄 Authorization code received, exchanging for tokens...",
            );
            this.exchangeCodeForTokens(code, resolve, reject);
          } else {
            // Fallback to token-based flow
            const credentials = this.parseAuthResponse(redirectUrl);
            console.log(
              "✅ OAuth credentials parsed successfully (token flow)",
            );
            resolve(credentials);
          }
        } catch (error) {
          console.error("🚫 Failed to parse OAuth response:", error);
          reject(error);
        }
      },
    );
  }

  /**
   * Exchange authorization code for tokens with refresh token
   */
  private static async exchangeCodeForTokens(
    code: string,
    resolve: (value: CloudCredentials) => void,
    reject: (reason?: any) => void,
  ): Promise<void> {
    try {
      const manifest = chrome.runtime.getManifest();
      const clientId = manifest.oauth2?.client_id;
      const redirectUri = chrome.identity.getRedirectURL();

      if (!clientId) {
        reject(new Error("OAuth2 client_id not configured in manifest.json"));
        return;
      }

      console.log("🔄 Exchanging authorization code for tokens...");
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          code: code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Token exchange failed:", errorData);
        reject(
          new Error(
            `Token exchange failed: ${errorData.error_description || response.statusText}`,
          ),
        );
        return;
      }

      const tokenData = await response.json();
      console.log(
        "✅ Token exchange successful, received refresh token:",
        !!tokenData.refresh_token,
      );

      const credentials: CloudCredentials = {
        provider: "google-drive",
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenType: tokenData.token_type as "bearer",
        scope: tokenData.scope,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        issuedAt: new Date(),
        refreshAttempts: 0,
      };

      resolve(credentials);
    } catch (error) {
      console.error("❌ Token exchange error:", error);
      reject(error);
    }
  }

  /**
   * Build enhanced OAuth URL for manual authentication with refresh token support
   */
  private static buildEnhancedAuthUrl(): string {
    const manifest = chrome.runtime.getManifest();
    const clientId = manifest.oauth2?.client_id || "";
    const redirectUri = chrome.identity.getRedirectURL();

    console.log("🔧 Enhanced OAuth configuration:", {
      clientId,
      redirectUri,
      authUrl: CLOUD_PROVIDERS["google-drive"].authUrl,
      scopes: CLOUD_PROVIDERS["google-drive"].scopes,
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code", // Use code instead of token for refresh token support
      scope: CLOUD_PROVIDERS["google-drive"].scopes.join(" "),
      access_type: "offline", // Request offline access for refresh token
      prompt: "consent", // Force consent to ensure refresh token
      include_granted_scopes: "true",
    });

    return `${CLOUD_PROVIDERS["google-drive"].authUrl}?${params.toString()}`;
  }

  /**
   * Parse authentication response from OAuth redirect (fallback for token flow)
   */
  private static parseAuthResponse(redirectUrl: string): CloudCredentials {
    const url = new URL(redirectUrl);
    const fragment = url.hash.substring(1);
    const params = new URLSearchParams(fragment);

    const accessToken = params.get("access_token");
    const expiresIn = params.get("expires_in");
    const tokenType = params.get("token_type");
    const scope = params.get("scope");

    if (!accessToken) {
      throw new Error("No access token received");
    }

    console.log(
      "✅ Parsed access token from fragment (no refresh token available)",
    );

    return {
      provider: "google-drive",
      accessToken,
      tokenType: (tokenType as "bearer") || "bearer",
      scope: scope || undefined,
      expiresAt: expiresIn
        ? new Date(Date.now() + parseInt(expiresIn) * 1000)
        : new Date(Date.now() + 3600 * 1000), // Default 1 hour
      issuedAt: new Date(),
      refreshAttempts: 0,
    };
  }

  /**
   * Get authorization headers for API requests with enhanced error context
   */
  static getAuthHeaders(credentials: CloudCredentials): Record<string, string> {
    if (!credentials.accessToken) {
      throw new Error("No access token available in credentials");
    }

    const tokenType = credentials.tokenType || "Bearer";

    return {
      Authorization: `${tokenType} ${credentials.accessToken}`,
      "Content-Type": "application/json",
      // Add useful debugging headers
      "X-Goog-Auth-User": "0",
    };
  }

  /**
   * Check if credentials are valid by testing API access with enhanced validation
   */
  static async validateCredentials(
    credentials: CloudCredentials,
  ): Promise<{ isValid: boolean; needsRefresh?: boolean; error?: string }> {
    try {
      // Check if token is expired before making API call
      if (credentials.expiresAt) {
        const now = new Date();
        const expiresAt = new Date(credentials.expiresAt);
        if (now >= expiresAt) {
          console.log("⏰ Token has expired based on expiry time");
          return { isValid: false, needsRefresh: true, error: "Token expired" };
        }
      }

      const response = await fetch(
        "https://www.googleapis.com/drive/v3/about?fields=user(emailAddress,displayName)",
        {
          headers: this.getAuthHeaders(credentials),
        },
      );

      if (response.ok) {
        const data = await response.json();
        console.log(
          "✅ Credentials validated for user:",
          data.user?.emailAddress,
        );
        return { isValid: true };
      } else {
        console.warn(
          "⚠️ Credential validation failed:",
          response.status,
          response.statusText,
        );

        // Enhanced error handling
        if (response.status === 401) {
          return {
            isValid: false,
            needsRefresh: true,
            error: "Unauthorized - token expired or invalid",
          };
        } else if (response.status === 403) {
          const errorData = await response.json().catch(() => null);
          if (errorData?.error?.message?.includes("rate")) {
            return { isValid: true, error: "Rate limited but token is valid" };
          }
          return {
            isValid: false,
            error: "Forbidden - insufficient permissions",
          };
        } else {
          return {
            isValid: false,
            error: `API error: ${response.status} ${response.statusText}`,
          };
        }
      }
    } catch (error) {
      console.error("Failed to validate credentials:", error);
      return {
        isValid: false,
        error: error instanceof Error ? error.message : "Network error",
      };
    }
  }

  /**
   * Clear cached tokens and force re-authentication
   */
  static async clearTokenAndReAuthenticate(): Promise<CloudCredentials> {
    console.log("🔄 Clearing cached tokens and forcing re-authentication...");

    return new Promise((resolve, reject) => {
      // First, try to remove the cached token
      chrome.identity.removeCachedAuthToken({ token: "" }, () => {
        console.log("🗑️ Attempted to clear cached token");

        // Clear all cached tokens for this extension
        chrome.identity.getAuthToken({ interactive: false }, (token) => {
          if (token) {
            chrome.identity.removeCachedAuthToken({ token }, () => {
              console.log("🗑️ Cleared specific cached token");
              this.authenticateWithEnhancedLogging()
                .then(resolve)
                .catch(reject);
            });
          } else {
            console.log(
              "🗑️ No cached token found, proceeding with authentication",
            );
            this.authenticateWithEnhancedLogging().then(resolve).catch(reject);
          }
        });
      });
    });
  }

  /**
   * Authenticate with enhanced logging to verify scope
   */
  private static async authenticateWithEnhancedLogging(): Promise<CloudCredentials> {
    const scopes = CLOUD_PROVIDERS["google-drive"].scopes;
    console.log("🔐 Authenticating with scopes:", scopes);

    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken(
        {
          interactive: true,
          scopes: [...scopes],
        },
        (token) => {
          if (chrome.runtime.lastError) {
            console.error(
              "🔐 Authentication failed:",
              chrome.runtime.lastError.message,
            );
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (!token) {
            console.error("🚫 No token received");
            reject(new Error("Authentication failed - no token"));
            return;
          }

          console.log("✅ New token received with updated scopes");
          console.log("🔍 Token starts with:", token.substring(0, 20) + "...");

          // Test the token to verify it has the correct scopes
          this.testTokenScopes(token)
            .then((hasCorrectScopes) => {
              if (hasCorrectScopes) {
                console.log("✅ Token has correct scopes");
              } else {
                console.warn("⚠️ Token may not have correct scopes");
              }

              const credentials: CloudCredentials = {
                provider: "google-drive",
                accessToken: token,
                expiresAt: undefined,
              };

              resolve(credentials);
            })
            .catch((error) => {
              console.warn("⚠️ Could not verify token scopes:", error);
              // Still proceed with authentication
              const credentials: CloudCredentials = {
                provider: "google-drive",
                accessToken: token,
                expiresAt: undefined,
              };
              resolve(credentials);
            });
        },
      );
    });
  }

  /**
   * Test if token has correct scopes by making a test API call
   */
  private static async testTokenScopes(token: string): Promise<boolean> {
    try {
      // Test if we can access Drive files (requires full drive scope)
      const response = await fetch(
        "https://www.googleapis.com/drive/v3/files?pageSize=1&fields=files(id,name)",
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      console.log("🔍 Scope test response status:", response.status);

      if (response.ok) {
        const data = await response.json();
        console.log("🔍 Scope test successful, can access drive files");
        return true;
      } else {
        console.warn(
          "⚠️ Scope test failed:",
          response.status,
          response.statusText,
        );
        return false;
      }
    } catch (error) {
      console.error("❌ Error testing token scopes:", error);
      return false;
    }
  }
}
