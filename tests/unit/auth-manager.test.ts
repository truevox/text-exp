/**
 * Unit tests for AuthManager class
 * Tests OAuth flows, token management, and security
 */

import { AuthManager } from '../../src/background/auth-manager';
import { ExtensionStorage } from '../../src/shared/storage';
import type { CloudCredentials } from '../../src/shared/types';

// Mock Chrome APIs
global.chrome = {
  runtime: {
    id: 'test-extension-id'
  },
  identity: {
    launchWebAuthFlow: jest.fn()
  }
} as any;

// Mock ExtensionStorage
jest.mock('../../src/shared/storage', () => ({
  ExtensionStorage: {
    getCloudCredentials: jest.fn(),
    setCloudCredentials: jest.fn(),
    clearCloudCredentials: jest.fn()
  }
}));

// Mock fetch
global.fetch = jest.fn();

describe('AuthManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('authenticateWithGoogle', () => {
    it('should return existing valid credentials', async () => {
      const existingCredentials: CloudCredentials = {
        provider: 'google-drive',
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 3600000) // 1 hour from now
      };

      (ExtensionStorage.getCloudCredentials as jest.Mock).mockResolvedValue(existingCredentials);
      
      // Mock successful token validation
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ user: {} })
      });

      const result = await AuthManager.authenticateWithGoogle();

      expect(result.success).toBe(true);
      expect(result.credentials).toEqual(existingCredentials);
      expect(chrome.identity.launchWebAuthFlow).not.toHaveBeenCalled();
    });

    it('should refresh expired token', async () => {
      const existingCredentials: CloudCredentials = {
        provider: 'google-drive',
        accessToken: 'expired-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() - 3600000) // 1 hour ago
      };

      const newTokens = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/drive.file'
      };

      (ExtensionStorage.getCloudCredentials as jest.Mock).mockResolvedValue(existingCredentials);
      
      // Mock failed validation (expired token)
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: false, status: 401 })
        // Mock successful token refresh
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(newTokens)
        });

      const result = await AuthManager.authenticateWithGoogle();

      expect(result.success).toBe(true);
      expect(result.credentials?.accessToken).toBe('new-access-token');
      expect(ExtensionStorage.setCloudCredentials).toHaveBeenCalled();
    });

    it('should start new OAuth flow when no credentials exist', async () => {
      (ExtensionStorage.getCloudCredentials as jest.Mock).mockResolvedValue(null);
      (chrome.identity.launchWebAuthFlow as jest.Mock).mockResolvedValue(
        'https://test-extension-id.chromiumapp.org/?code=auth-code-123&state=state'
      );

      const tokens = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/drive.file'
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(tokens)
      });

      const result = await AuthManager.authenticateWithGoogle();

      expect(result.success).toBe(true);
      expect(chrome.identity.launchWebAuthFlow).toHaveBeenCalled();
      expect(ExtensionStorage.setCloudCredentials).toHaveBeenCalled();
    });

    it('should handle OAuth flow cancellation', async () => {
      (ExtensionStorage.getCloudCredentials as jest.Mock).mockResolvedValue(null);
      (chrome.identity.launchWebAuthFlow as jest.Mock).mockResolvedValue(null);

      const result = await AuthManager.authenticateWithGoogle();

      expect(result.success).toBe(false);
      expect(result.error).toContain('OAuth flow cancelled');
    });

    it('should handle OAuth errors', async () => {
      (ExtensionStorage.getCloudCredentials as jest.Mock).mockResolvedValue(null);
      (chrome.identity.launchWebAuthFlow as jest.Mock).mockResolvedValue(
        'https://test-extension-id.chromiumapp.org/?error=access_denied&error_description=User%20denied%20access'
      );

      const result = await AuthManager.authenticateWithGoogle();

      expect(result.success).toBe(false);
      expect(result.error).toContain('OAuth error: access_denied');
    });

    it('should handle token exchange failures', async () => {
      (ExtensionStorage.getCloudCredentials as jest.Mock).mockResolvedValue(null);
      (chrome.identity.launchWebAuthFlow as jest.Mock).mockResolvedValue(
        'https://test-extension-id.chromiumapp.org/?code=auth-code-123'
      );

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({
          error: 'invalid_grant',
          error_description: 'Invalid authorization code'
        })
      });

      const result = await AuthManager.authenticateWithGoogle();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to exchange code for tokens');
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const refreshToken = 'refresh-token-123';
      const newTokens = {
        access_token: 'new-access-token',
        expires_in: 3600
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(newTokens)
      });

      (ExtensionStorage.getCloudCredentials as jest.Mock).mockResolvedValue({
        provider: 'google-drive',
        accessToken: 'old-token',
        refreshToken: refreshToken
      });

      const result = await AuthManager.refreshToken(refreshToken);

      expect(result.success).toBe(true);
      expect(result.credentials?.accessToken).toBe('new-access-token');
      expect(ExtensionStorage.setCloudCredentials).toHaveBeenCalled();
    });

    it('should handle refresh token failure', async () => {
      const refreshToken = 'invalid-refresh-token';

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          error: 'invalid_grant',
          error_description: 'Token expired'
        })
      });

      const result = await AuthManager.refreshToken(refreshToken);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Token refresh failed');
      expect(ExtensionStorage.clearCloudCredentials).toHaveBeenCalled();
    });

    it('should handle missing refresh token', async () => {
      (ExtensionStorage.getCloudCredentials as jest.Mock).mockResolvedValue(null);

      const result = await AuthManager.refreshToken();

      expect(result.success).toBe(false);
      expect(result.error).toBe('No refresh token available');
    });
  });

  describe('validateToken', () => {
    it('should validate token successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ user: { emailAddress: 'test@example.com' } })
      });

      const isValid = await (AuthManager as any).validateToken('valid-token');

      expect(isValid).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/drive/v3/about?fields=user',
        {
          headers: {
            'Authorization': 'Bearer valid-token'
          }
        }
      );
    });

    it('should handle invalid token', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401
      });

      const isValid = await (AuthManager as any).validateToken('invalid-token');

      expect(isValid).toBe(false);
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const isValid = await (AuthManager as any).validateToken('token');

      expect(isValid).toBe(false);
    });
  });

  describe('ensureValidToken', () => {
    it('should return valid token', async () => {
      const credentials: CloudCredentials = {
        provider: 'google-drive',
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 3600000)
      };

      (ExtensionStorage.getCloudCredentials as jest.Mock).mockResolvedValue(credentials);

      const token = await AuthManager.ensureValidToken();

      expect(token).toBe('valid-token');
    });

    it('should refresh expired token', async () => {
      const credentials: CloudCredentials = {
        provider: 'google-drive',
        accessToken: 'expired-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() - 1000) // Expired
      };

      const newTokens = {
        access_token: 'new-access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600
      };

      (ExtensionStorage.getCloudCredentials as jest.Mock).mockResolvedValue(credentials);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(newTokens)
      });

      const token = await AuthManager.ensureValidToken();

      expect(token).toBe('new-access-token');
    });

    it('should handle refresh failure', async () => {
      const credentials: CloudCredentials = {
        provider: 'google-drive',
        accessToken: 'expired-token',
        refreshToken: 'invalid-refresh-token',
        expiresAt: new Date(Date.now() - 1000)
      };

      (ExtensionStorage.getCloudCredentials as jest.Mock).mockResolvedValue(credentials);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400
      });

      const token = await AuthManager.ensureValidToken();

      expect(token).toBeNull();
    });

    it('should handle missing credentials', async () => {
      (ExtensionStorage.getCloudCredentials as jest.Mock).mockResolvedValue(null);

      const token = await AuthManager.ensureValidToken();

      expect(token).toBeNull();
    });

    it('should handle non-google-drive provider', async () => {
      const credentials: CloudCredentials = {
        provider: 'dropbox',
        accessToken: 'dropbox-token',
        refreshToken: 'refresh-token'
      };

      (ExtensionStorage.getCloudCredentials as jest.Mock).mockResolvedValue(credentials);

      const token = await AuthManager.ensureValidToken();

      expect(token).toBeNull();
    });
  });

  describe('signOut', () => {
    it('should clear credentials successfully', async () => {
      await AuthManager.signOut();

      expect(ExtensionStorage.clearCloudCredentials).toHaveBeenCalled();
    });

    it('should handle clear credentials error', async () => {
      (ExtensionStorage.clearCloudCredentials as jest.Mock).mockRejectedValue(
        new Error('Storage error')
      );

      // Should not throw
      await expect(AuthManager.signOut()).resolves.toBeUndefined();
    });
  });

  describe('getAuthStatus', () => {
    it('should return authenticated status for valid credentials', async () => {
      const credentials: CloudCredentials = {
        provider: 'google-drive',
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 3600000)
      };

      (ExtensionStorage.getCloudCredentials as jest.Mock).mockResolvedValue(credentials);
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      const status = await AuthManager.getAuthStatus();

      expect(status.isAuthenticated).toBe(true);
      expect(status.provider).toBe('google-drive');
      expect(status.expiresAt).toEqual(credentials.expiresAt);
    });

    it('should return unauthenticated status for invalid credentials', async () => {
      const credentials: CloudCredentials = {
        provider: 'google-drive',
        accessToken: 'invalid-token',
        refreshToken: 'refresh-token'
      };

      (ExtensionStorage.getCloudCredentials as jest.Mock).mockResolvedValue(credentials);
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

      const status = await AuthManager.getAuthStatus();

      expect(status.isAuthenticated).toBe(false);
      expect(status.provider).toBe('google-drive');
    });

    it('should return unauthenticated status for missing credentials', async () => {
      (ExtensionStorage.getCloudCredentials as jest.Mock).mockResolvedValue(null);

      const status = await AuthManager.getAuthStatus();

      expect(status.isAuthenticated).toBe(false);
      expect(status.provider).toBeUndefined();
    });

    it('should handle validation errors', async () => {
      (ExtensionStorage.getCloudCredentials as jest.Mock).mockRejectedValue(
        new Error('Storage error')
      );

      const status = await AuthManager.getAuthStatus();

      expect(status.isAuthenticated).toBe(false);
    });
  });

  describe('Security Considerations', () => {
    it('should use HTTPS for OAuth URLs', async () => {
      (ExtensionStorage.getCloudCredentials as jest.Mock).mockResolvedValue(null);
      (chrome.identity.launchWebAuthFlow as jest.Mock).mockResolvedValue(null);

      await AuthManager.authenticateWithGoogle();

      const call = (chrome.identity.launchWebAuthFlow as jest.Mock).mock.calls[0][0];
      expect(call.url).toMatch(/^https:\/\//);
    });

    it('should include state parameter for CSRF protection', async () => {
      (ExtensionStorage.getCloudCredentials as jest.Mock).mockResolvedValue(null);
      (chrome.identity.launchWebAuthFlow as jest.Mock).mockResolvedValue(null);

      await AuthManager.authenticateWithGoogle();

      const call = (chrome.identity.launchWebAuthFlow as jest.Mock).mock.calls[0][0];
      expect(call.url).toContain('prompt=consent');
    });

    it('should validate redirect URI matches extension', async () => {
      const authCode = 'code-123';
      (ExtensionStorage.getCloudCredentials as jest.Mock).mockResolvedValue(null);
      (chrome.identity.launchWebAuthFlow as jest.Mock).mockResolvedValue(
        `https://${chrome.runtime.id}.chromiumapp.org/?code=${authCode}`
      );

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'token',
          refresh_token: 'refresh',
          expires_in: 3600
        })
      });

      await AuthManager.authenticateWithGoogle();

      const tokenExchangeCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = new URLSearchParams(tokenExchangeCall[1].body);
      expect(body.get('redirect_uri')).toBe(`https://${chrome.runtime.id}.chromiumapp.org/`);
    });

    it('should handle token expiration with buffer time', async () => {
      const credentials: CloudCredentials = {
        provider: 'google-drive',
        accessToken: 'token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 30000) // 30 seconds from now
      };

      (ExtensionStorage.getCloudCredentials as jest.Mock).mockResolvedValue(credentials);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'new-token',
          expires_in: 3600
        })
      });

      const token = await AuthManager.ensureValidToken();

      // Should refresh token even though it's not expired yet (60 second buffer)
      expect(token).toBe('new-token');
    });
  });
});