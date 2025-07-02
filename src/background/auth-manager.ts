/**
 * Authentication Manager for Google Drive OAuth2
 * Handles OAuth flow, token management, and refresh logic
 */

import { ExtensionStorage } from '../shared/storage.js';
import { CLOUD_PROVIDERS } from '../shared/constants.js';
import type { CloudCredentials } from '../shared/types.js';

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
 */
export class AuthManager {
  private static readonly GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
  private static readonly GOOGLE_CLIENT_SECRET = 'YOUR_CLIENT_SECRET'; // Store securely
  private static readonly REDIRECT_URI = `https://${chrome.runtime.id}.chromiumapp.org/`;
  
  /**
   * Authenticate with Google Drive
   */
  static async authenticateWithGoogle(): Promise<AuthResult> {
    try {
      console.log('🔐 Starting Google Drive authentication...');
      
      // Check if already authenticated
      const existingCredentials = await ExtensionStorage.getCloudCredentials();
      if (existingCredentials && existingCredentials.provider === 'google-drive') {
        const isValid = await this.validateToken(existingCredentials.accessToken);
        if (isValid) {
          console.log('✅ Using existing valid credentials');
          return { success: true, credentials: existingCredentials };
        } else {
          // Try to refresh token
          const refreshed = await this.refreshToken(existingCredentials.refreshToken);
          if (refreshed.success) {
            console.log('✅ Token refreshed successfully');
            return refreshed;
          }
        }
      }
      
      // Start new OAuth flow
      const authCode = await this.launchOAuthFlow();
      if (!authCode) {
        return { success: false, error: 'OAuth flow cancelled or failed' };
      }
      
      // Exchange code for tokens
      const tokens = await this.exchangeCodeForTokens(authCode);
      if (!tokens) {
        return { success: false, error: 'Failed to exchange code for tokens' };
      }
      
      // Create and store credentials
      const credentials: CloudCredentials = {
        provider: 'google-drive',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + (tokens.expires_in * 1000))
      };
      
      await ExtensionStorage.setCloudCredentials(credentials);
      
      console.log('✅ Google Drive authentication successful');
      return { success: true, credentials };
      
    } catch (error) {
      console.error('❌ Google Drive authentication failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Authentication failed' 
      };
    }
  }
  
  /**
   * Launch OAuth2 web flow
   */
  private static async launchOAuthFlow(): Promise<string | null> {
    const provider = CLOUD_PROVIDERS['google-drive'];
    
    const authUrl = `${provider.authUrl}?` +
      `client_id=${encodeURIComponent(this.GOOGLE_CLIENT_ID)}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(this.REDIRECT_URI)}&` +
      `scope=${encodeURIComponent(provider.scopes.join(' '))}&` +
      `access_type=offline&` +
      `prompt=consent`;
    
    try {
      const responseUrl = await chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true
      });
      
      if (!responseUrl) {
        return null;
      }
      
      // Extract authorization code from response URL
      const url = new URL(responseUrl);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      
      if (error) {
        throw new Error(`OAuth error: ${error}`);
      }
      
      return code;
      
    } catch (error) {
      console.error('OAuth flow error:', error);
      return null;
    }
  }
  
  /**
   * Exchange authorization code for access and refresh tokens
   */
  private static async exchangeCodeForTokens(authCode: string): Promise<TokenResponse | null> {
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.GOOGLE_CLIENT_ID,
          client_secret: this.GOOGLE_CLIENT_SECRET,
          code: authCode,
          grant_type: 'authorization_code',
          redirect_uri: this.REDIRECT_URI
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Token exchange failed: ${errorData.error_description || response.statusText}`);
      }
      
      const tokens: TokenResponse = await response.json();
      return tokens;
      
    } catch (error) {
      console.error('Token exchange error:', error);
      return null;
    }
  }
  
  /**
   * Refresh expired access token
   */
  static async refreshToken(refreshToken?: string): Promise<AuthResult> {
    try {
      if (!refreshToken) {
        const credentials = await ExtensionStorage.getCloudCredentials();
        refreshToken = credentials?.refreshToken;
      }
      
      if (!refreshToken) {
        return { success: false, error: 'No refresh token available' };
      }
      
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.GOOGLE_CLIENT_ID,
          client_secret: this.GOOGLE_CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Token refresh failed: ${errorData.error_description || response.statusText}`);
      }
      
      const tokens = await response.json();
      
      // Update stored credentials
      const existingCredentials = await ExtensionStorage.getCloudCredentials();
      const updatedCredentials: CloudCredentials = {
        provider: 'google-drive',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || refreshToken, // Keep existing if not provided
        expiresAt: new Date(Date.now() + (tokens.expires_in * 1000))
      };
      
      await ExtensionStorage.setCloudCredentials(updatedCredentials);
      
      console.log('✅ Token refreshed successfully');
      return { success: true, credentials: updatedCredentials };
      
    } catch (error) {
      console.error('❌ Token refresh failed:', error);
      
      // Clear invalid credentials
      await ExtensionStorage.clearCloudCredentials();
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Token refresh failed' 
      };
    }
  }
  
  /**
   * Validate access token by making a test API call
   */
  private static async validateToken(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      return response.ok;
      
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  }
  
  /**
   * Ensure we have a valid access token
   */
  static async ensureValidToken(): Promise<string | null> {
    try {
      const credentials = await ExtensionStorage.getCloudCredentials();
      
      if (!credentials || credentials.provider !== 'google-drive') {
        return null;
      }
      
      // Check if token is expired (with 60 second buffer)
      const expiresAt = credentials.expiresAt ? new Date(credentials.expiresAt) : null;
      const now = new Date();
      const bufferTime = 60 * 1000; // 60 seconds
      
      if (!expiresAt || now.getTime() > (expiresAt.getTime() - bufferTime)) {
        console.log('🔄 Token expired, refreshing...');
        const refreshResult = await this.refreshToken(credentials.refreshToken);
        
        if (refreshResult.success && refreshResult.credentials) {
          return refreshResult.credentials.accessToken;
        } else {
          return null;
        }
      }
      
      return credentials.accessToken;
      
    } catch (error) {
      console.error('Error ensuring valid token:', error);
      return null;
    }
  }
  
  /**
   * Sign out and clear credentials
   */
  static async signOut(): Promise<void> {
    try {
      console.log('🔓 Signing out...');
      await ExtensionStorage.clearCloudCredentials();
      console.log('✅ Signed out successfully');
    } catch (error) {
      console.error('❌ Sign out failed:', error);
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
        expiresAt: credentials.expiresAt
      };
      
    } catch (error) {
      console.error('Error checking auth status:', error);
      return { isAuthenticated: false };
    }
  }
}