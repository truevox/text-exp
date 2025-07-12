/**
 * Google Drive Authentication Service
 * Handles all Google Drive OAuth and authentication flows
 */

import type { CloudCredentials } from "../../../shared/types.js";
import { CLOUD_PROVIDERS } from "../../../shared/constants.js";

export class GoogleDriveAuthService {
  /**
   * Authenticate with Google Drive using Chrome Identity API
   */
  static async authenticate(): Promise<CloudCredentials> {
    return new Promise((resolve, reject) => {
      // Try Chrome's built-in OAuth first
      const scopes = CLOUD_PROVIDERS["google-drive"].scopes;

      console.log("🔐 Attempting Chrome identity.getAuthToken...");

      chrome.identity.getAuthToken(
        {
          interactive: true,
          scopes: [...scopes], // Convert readonly array to mutable
        },
        (token) => {
          if (chrome.runtime.lastError) {
            console.log(
              "🔐 Chrome identity failed, falling back to manual OAuth:",
              chrome.runtime.lastError.message,
            );
            // Fallback to manual OAuth flow
            this.authenticateManually(resolve, reject);
            return;
          }

          if (!token) {
            console.error("🚫 No token received from Chrome identity");
            reject(new Error("Authentication failed - no token"));
            return;
          }

          console.log("✅ Chrome identity token received");

          // Create credentials object
          const credentials: CloudCredentials = {
            provider: "google-drive",
            accessToken: token,
            // Chrome handles token expiration automatically
            expiresAt: undefined,
          };

          resolve(credentials);
        },
      );
    });
  }

  /**
   * Fallback manual OAuth authentication
   */
  private static authenticateManually(
    resolve: (value: CloudCredentials) => void,
    reject: (reason?: any) => void,
  ): void {
    const authUrl = this.buildAuthUrl();
    console.log("🔐 Google Drive manual auth URL:", authUrl);

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

        console.log("✅ OAuth redirect URL received:", redirectUrl);

        try {
          const credentials = this.parseAuthResponse(redirectUrl);
          console.log("✅ OAuth credentials parsed successfully");
          resolve(credentials);
        } catch (error) {
          console.error("🚫 Failed to parse OAuth response:", error);
          reject(error);
        }
      },
    );
  }

  /**
   * Build OAuth URL for manual authentication
   */
  private static buildAuthUrl(): string {
    // Get client ID from manifest.json oauth2 configuration
    const manifest = chrome.runtime.getManifest();
    const clientId = manifest.oauth2?.client_id || "";
    const redirectUri = chrome.identity.getRedirectURL();

    console.log("🔧 OAuth configuration:", {
      clientId,
      redirectUri,
      authUrl: CLOUD_PROVIDERS["google-drive"].authUrl,
      scopes: CLOUD_PROVIDERS["google-drive"].scopes,
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "token",
      scope: CLOUD_PROVIDERS["google-drive"].scopes.join(" "),
    });

    return `${CLOUD_PROVIDERS["google-drive"].authUrl}?${params.toString()}`;
  }

  /**
   * Parse authentication response from OAuth redirect
   */
  private static parseAuthResponse(redirectUrl: string): CloudCredentials {
    const url = new URL(redirectUrl);
    const fragment = url.hash.substring(1);
    const params = new URLSearchParams(fragment);

    const accessToken = params.get("access_token");
    const expiresIn = params.get("expires_in");

    if (!accessToken) {
      throw new Error("No access token received");
    }

    return {
      provider: "google-drive",
      accessToken,
      expiresAt: expiresIn
        ? new Date(Date.now() + parseInt(expiresIn) * 1000)
        : undefined,
    };
  }

  /**
   * Get authorization headers for API requests
   */
  static getAuthHeaders(credentials: CloudCredentials): Record<string, string> {
    return {
      Authorization: `Bearer ${credentials.accessToken}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Check if credentials are valid by testing API access
   */
  static async validateCredentials(
    credentials: CloudCredentials,
  ): Promise<boolean> {
    try {
      const response = await fetch(
        "https://www.googleapis.com/drive/v3/about?fields=user",
        {
          headers: this.getAuthHeaders(credentials),
        },
      );
      return response.ok;
    } catch (error) {
      console.error("Failed to validate credentials:", error);
      return false;
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
