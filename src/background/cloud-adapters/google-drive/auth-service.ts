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
  // Store code verifier for PKCE flow
  private static currentCodeVerifier: string | null = null;

  /**
   * Authenticate with Google Drive using Chrome identity API
   */
  static async authenticate(): Promise<CloudCredentials> {
    return new Promise((resolve, reject) => {
      const scopes = CLOUD_PROVIDERS["google-drive"].scopes;

      console.log(
        "🔐 Starting Google Drive authentication with Chrome identity API...",
      );
      console.log("🔍 Scopes:", scopes);

      // Clear any cached tokens first to ensure fresh authentication
      chrome.identity.clearAllCachedAuthTokens(() => {
        console.log("🗑️ Cleared all cached tokens, requesting fresh token...");

        chrome.identity.getAuthToken(
          {
            interactive: true,
            scopes: [...scopes],
          },
          async (token) => {
            if (chrome.runtime.lastError) {
              console.error(
                "🚫 Chrome identity authentication failed:",
                chrome.runtime.lastError.message,
              );
              reject(
                new Error(
                  `Authentication failed: ${chrome.runtime.lastError.message}`,
                ),
              );
              return;
            }

            if (!token) {
              console.error("🚫 No token received from Chrome identity");
              reject(new Error("Authentication failed - no token received"));
              return;
            }

            console.log("✅ Chrome identity token received");
            console.log("🔍 Token type:", typeof token);
            console.log("🔍 Token length:", token.length);
            console.log("🔍 Token preview:", token.substring(0, 20) + "...");

            // Create credentials object
            const credentials: CloudCredentials = {
              provider: "google-drive",
              accessToken: token,
              tokenType: "bearer",
              expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour default
              issuedAt: new Date(),
              refreshAttempts: 0,
            };

            // Validate the token before completing authentication
            console.log("🔍 Validating token with Google APIs...");
            try {
              const validationResult =
                await this.validateCredentials(credentials);

              if (validationResult && validationResult.isValid) {
                console.log("✅ Token validation successful");
                resolve(credentials);
              } else {
                console.error(
                  "🚫 Token validation failed:",
                  validationResult?.error || "Unknown error",
                );
                reject(
                  new Error(
                    validationResult?.error || "Token validation failed",
                  ),
                );
              }
            } catch (error) {
              console.error("🚫 Token validation error:", error);
              reject(error);
            }
          },
        );
      });
    });
  }

  /**
   * Enhanced manual OAuth authentication with refresh token support
   */
  private static async authenticateManuallyWithRefreshToken(
    resolve: (value: CloudCredentials) => void,
    reject: (reason?: any) => void,
  ): Promise<void> {
    const authUrl = await this.buildEnhancedAuthUrl();
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
          code_verifier: this.currentCodeVerifier || "", // PKCE code verifier
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
   * Build enhanced OAuth URL for manual authentication with PKCE support
   */
  private static async buildEnhancedAuthUrl(): Promise<string> {
    const manifest = chrome.runtime.getManifest();
    const clientId = manifest.oauth2?.client_id || "";
    const redirectUri = chrome.identity.getRedirectURL();
    const extensionId = chrome.runtime.id;

    // Generate PKCE code verifier and challenge for secure OAuth flow
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);

    // Store code verifier for later use in token exchange
    this.currentCodeVerifier = codeVerifier;

    console.log("🔧 Enhanced OAuth configuration with PKCE:", {
      clientId,
      redirectUri,
      extensionId,
      authUrl: CLOUD_PROVIDERS["google-drive"].authUrl,
      scopes: CLOUD_PROVIDERS["google-drive"].scopes,
      codeChallenge,
      codeVerifier: codeVerifier.substring(0, 10) + "...", // Only show first 10 chars for security
    });

    console.log("🚨 EXTENSION ID MISMATCH CHECK:");
    console.log("  Current extension ID:", extensionId);
    console.log(
      "  Expected extension ID (from GOOGLE-OAUTH-SETUP.md): hlhpgfjffmigppdbhopljldjplpffhmb",
    );
    console.log("  Current redirect URI:", redirectUri);
    console.log(
      "  Expected redirect URI: https://hlhpgfjffmigppdbhopljldjplpffhmb.chromiumapp.org/",
    );

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code", // Use code instead of token for refresh token support
      scope: CLOUD_PROVIDERS["google-drive"].scopes.join(" "),
      access_type: "offline", // Request offline access for refresh token
      prompt: "consent", // Force consent to ensure refresh token
      include_granted_scopes: "true",
      // PKCE parameters for secure OAuth flow
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state: this.generateStateToken(), // CSRF protection
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

    // Check if token is expired
    if (credentials.expiresAt) {
      const now = new Date();
      const expiresAt = new Date(credentials.expiresAt);
      if (now >= expiresAt) {
        console.warn("⚠️ Access token has expired, authentication needed");
        throw new Error("Access token expired - re-authentication required");
      }
    }

    // Always use "Bearer" (capital B) as Google APIs are case-sensitive
    const tokenType = "Bearer";

    return {
      Authorization: `${tokenType} ${credentials.accessToken}`,
      "Content-Type": "application/json",
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

      const headers = this.getAuthHeaders(credentials);
      console.log("🔍 Making validation request with headers:", {
        Authorization: headers.Authorization.substring(0, 20) + "...",
        "Content-Type": headers["Content-Type"],
      });

      const response = await fetch(
        "https://www.googleapis.com/drive/v3/about?fields=user(emailAddress,displayName)",
        {
          headers,
        },
      );

      console.log("🔍 Validation response status:", response.status);
      console.log(
        "🔍 Validation response headers:",
        Object.fromEntries(response.headers.entries()),
      );

      if (response.ok) {
        const data = await response.json();
        console.log(
          "✅ Credentials validated for user:",
          data.user?.emailAddress,
          "| displayName:",
          data.user?.displayName,
        );
        return { isValid: true };
      } else {
        console.warn(
          "⚠️ Credential validation failed:",
          response.status,
          response.statusText,
          "| URL:",
          response.url,
        );

        // Enhanced error handling
        if (response.status === 401) {
          console.log(
            "🔄 401 Unauthorized - Token needs refresh or re-authentication",
          );

          // Get detailed error information
          try {
            const errorText = await response.text();
            console.log("🔍 401 Error details:", errorText);
          } catch (e) {
            console.log("🔍 Could not read 401 error details");
          }

          return {
            isValid: false,
            needsRefresh: true,
            error: "Unauthorized - token expired or invalid",
          };
        } else if (response.status === 403) {
          const errorData = await response.json().catch(() => null);
          if (errorData?.error?.message?.includes("rate")) {
            console.log("⏱️ Rate limited but token is valid");
            return { isValid: true, error: "Rate limited but token is valid" };
          }
          console.log("🚫 403 Forbidden - Check API permissions and scopes");
          return {
            isValid: false,
            error: "Forbidden - insufficient permissions or API not enabled",
          };
        } else if (response.status === 404) {
          console.log("🔍 404 Not Found - Check API endpoint availability");
          return {
            isValid: false,
            error:
              "API endpoint not found - Google Drive API may not be enabled",
          };
        } else {
          console.log(
            `🚫 API Error ${response.status} - ${response.statusText}`,
          );
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
        chrome.identity.getAuthToken(
          { interactive: false },
          (tokenResponse) => {
            // Extract token from response object or use as string for backward compatibility
            const token =
              typeof tokenResponse === "string"
                ? tokenResponse
                : (tokenResponse as any)?.token;

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
              this.authenticateWithEnhancedLogging()
                .then(resolve)
                .catch(reject);
            }
          },
        );
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
        (tokenResponse) => {
          // Extract token from response object or use as string for backward compatibility
          const token =
            typeof tokenResponse === "string"
              ? tokenResponse
              : (tokenResponse as any)?.token;

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

  /**
   * Clear cached token and retry authentication with validation
   */
  private static clearTokenAndRetryAuthentication(
    resolve: (value: CloudCredentials) => void,
    reject: (reason?: any) => void,
  ): void {
    console.log("🔄 Clearing cached token and retrying authentication...");

    // Get the cached token first so we can remove it
    chrome.identity.getAuthToken(
      { interactive: false },
      (cachedTokenResponse) => {
        // Extract token from response object or use as string for backward compatibility
        const cachedToken =
          typeof cachedTokenResponse === "string"
            ? cachedTokenResponse
            : (cachedTokenResponse as any)?.token;

        if (cachedToken) {
          console.log("🗑️ Found cached token, removing it...");
          chrome.identity.removeCachedAuthToken({ token: cachedToken }, () => {
            console.log("🗑️ Cleared cached token successfully");

            // Also try to clear any other cached tokens
            chrome.identity.getAuthToken(
              { interactive: false },
              (stillCachedTokenResponse) => {
                // Extract token from response object or use as string for backward compatibility
                const stillCachedToken =
                  typeof stillCachedTokenResponse === "string"
                    ? stillCachedTokenResponse
                    : (stillCachedTokenResponse as any)?.token;

                if (stillCachedToken) {
                  console.log(
                    "🗑️ Found another cached token, removing it too...",
                  );
                  chrome.identity.removeCachedAuthToken(
                    { token: stillCachedToken },
                    () => {
                      console.log(
                        "🗑️ Cleared all cached tokens, forcing interactive authentication",
                      );
                      this.authenticateWithValidation(resolve, reject);
                    },
                  );
                } else {
                  console.log(
                    "🗑️ No more cached tokens found, forcing interactive authentication",
                  );
                  this.authenticateWithValidation(resolve, reject);
                }
              },
            );
          });
        } else {
          console.log(
            "🗑️ No cached token found, proceeding with fresh authentication",
          );
          this.authenticateWithValidation(resolve, reject);
        }
      },
    );
  }

  /**
   * Authenticate with forced interactive prompt and validation
   */
  private static authenticateWithValidation(
    resolve: (value: CloudCredentials) => void,
    reject: (reason?: any) => void,
  ): void {
    const scopes = CLOUD_PROVIDERS["google-drive"].scopes;
    console.log(
      "🔐 Forcing Chrome identity authentication with scopes:",
      scopes,
    );

    // Use Chrome identity API directly instead of manual web auth flow
    // Chrome extension OAuth clients don't support redirect URIs for manual flows
    chrome.identity.getAuthToken(
      {
        interactive: true,
        scopes: [...scopes],
      },
      async (tokenResponse) => {
        // Extract token from response object or use as string for backward compatibility
        const token =
          typeof tokenResponse === "string"
            ? tokenResponse
            : (tokenResponse as any)?.token;

        if (chrome.runtime.lastError) {
          console.error(
            "🔐 Interactive Chrome identity failed:",
            chrome.runtime.lastError.message,
          );
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!token) {
          console.error("🚫 No token received from Chrome identity");
          reject(new Error("Authentication failed - no token"));
          return;
        }

        console.log("✅ New token received from Chrome identity");
        console.log("🔍 Token details:", {
          tokenLength: token.length,
          tokenStart: token.substring(0, 20),
          tokenEnd: token.substring(token.length - 10),
        });

        // Test the token with a simpler API call first
        console.log("🧪 Testing token with Google userinfo API...");
        try {
          const userinfoResponse = await fetch(
            "https://www.googleapis.com/oauth2/v1/userinfo",
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );
          console.log(
            "🧪 Userinfo API response:",
            userinfoResponse.status,
            userinfoResponse.statusText,
          );
          if (userinfoResponse.ok) {
            const userinfo = await userinfoResponse.json();
            console.log("✅ Userinfo API success:", userinfo.email);
          } else {
            console.error(
              "❌ Userinfo API failed:",
              await userinfoResponse.text(),
            );
          }
        } catch (userinfoError) {
          console.error("❌ Userinfo API error:", userinfoError);
        }

        // Create credentials object
        const credentials: CloudCredentials = {
          provider: "google-drive",
          accessToken: token,
          tokenType: "bearer",
          expiresAt: new Date(Date.now() + 3600 * 1000), // Assume 1 hour
          issuedAt: new Date(),
          refreshAttempts: 0,
        };

        // Validate the new token
        try {
          const validationResult = await this.validateCredentials(credentials);

          if (validationResult && validationResult.isValid) {
            console.log("✅ New Chrome identity token validation successful");
            resolve(credentials);
          } else {
            console.error(
              "🚫 New Chrome identity token validation failed:",
              validationResult?.error || "Unknown validation error",
            );
            reject(
              new Error(
                validationResult?.error ||
                  "Token validation failed after Chrome identity retry",
              ),
            );
          }
        } catch (error) {
          console.error(
            "🚫 New Chrome identity token validation error:",
            error,
          );
          reject(
            new Error("Token validation failed after Chrome identity retry"),
          );
        }
      },
    );
  }

  /**
   * Authenticate with forced Chrome identity (last resort)
   */
  private static authenticateWithChromeIdentityForced(
    resolve: (value: CloudCredentials) => void,
    reject: (reason?: any) => void,
  ): void {
    const scopes = CLOUD_PROVIDERS["google-drive"].scopes;
    console.log(
      "🔐 Forcing Chrome identity authentication with scopes:",
      scopes,
    );

    chrome.identity.getAuthToken(
      {
        interactive: true,
        scopes: [...scopes],
      },
      async (tokenResponse) => {
        // Extract token from response object or use as string for backward compatibility
        const token =
          typeof tokenResponse === "string"
            ? tokenResponse
            : (tokenResponse as any)?.token;

        if (chrome.runtime.lastError) {
          console.error(
            "🔐 Interactive authentication failed:",
            chrome.runtime.lastError.message,
          );
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!token) {
          console.error("🚫 No token received from interactive authentication");
          reject(new Error("Authentication failed - no token"));
          return;
        }

        console.log("✅ New token received from interactive authentication");

        // Create credentials object
        const credentials: CloudCredentials = {
          provider: "google-drive",
          accessToken: token,
          tokenType: "bearer",
          expiresAt: new Date(Date.now() + 3600 * 1000), // Assume 1 hour
          issuedAt: new Date(),
          refreshAttempts: 0,
        };

        // Validate the new token
        try {
          const validationResult = await this.validateCredentials(credentials);

          if (validationResult && validationResult.isValid) {
            console.log("✅ New token validation successful");
            resolve(credentials);
          } else {
            console.error(
              "🚫 New token validation failed:",
              validationResult?.error || "Unknown validation error",
            );
            reject(
              new Error(
                validationResult?.error ||
                  "Token validation failed after retry",
              ),
            );
          }
        } catch (error) {
          console.error("🚫 New token validation error:", error);
          reject(new Error("Token validation failed after retry"));
        }
      },
    );
  }

  /**
   * Generate a cryptographically secure code verifier for PKCE
   */
  private static generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.base64URLEncode(array);
  }

  /**
   * Generate code challenge from code verifier using SHA256
   */
  private static async generateCodeChallenge(
    codeVerifier: string,
  ): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return this.base64URLEncode(new Uint8Array(digest));
  }

  /**
   * Generate a random state token for CSRF protection
   */
  private static generateStateToken(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return this.base64URLEncode(array);
  }

  /**
   * Base64URL encode without padding
   */
  private static base64URLEncode(array: Uint8Array): string {
    const base64 = btoa(String.fromCharCode(...array));
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }
}
