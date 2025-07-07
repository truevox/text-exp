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
  static async validateCredentials(credentials: CloudCredentials): Promise<boolean> {
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
}