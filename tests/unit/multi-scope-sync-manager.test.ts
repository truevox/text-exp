/**
 * @file Unit tests for the future MultiScopeSyncManager.
 * @description These tests follow a TDD approach to define the expected behavior
 * for the multi-scope snippet merging logic ("Org Mode"). This manager will
 * handle merging snippets from personal, department, and organization sources
 * with the correct priority rules.
 */

import { jest } from '@jest/globals';
import { MultiScopeSyncManager } from '../../src/background/multi-scope-sync-manager';
import { BaseCloudAdapter } from '../../src/background/cloud-adapters/base-adapter';
import type { Snippet, SyncedSource, SnippetScope } from '../../src/shared/types';

// A mock adapter to simulate fetching snippets from a cloud provider.
class MockCloudAdapter extends BaseCloudAdapter {
  private snippets: Snippet[];

  constructor(providerName: string, snippets: Snippet[] = []) {
    super(providerName);
    this.snippets = snippets.map(s => ({ ...s, provider: providerName }));
  }

  async downloadSnippets(folderId: string): Promise<Snippet[]> {
    console.log(`MockAdapter (${this.provider}) fetching files for folder: ${folderId}`);
    return Promise.resolve(this.snippets);
  }

  // --- Mock other required methods from BaseCloudAdapter ---
  signIn = jest.fn().mockResolvedValue(undefined);
  signOut = jest.fn().mockResolvedValue(undefined);
  isAuthenticated = jest.fn().mockResolvedValue(true);
  getUserInfo = jest.fn().mockResolvedValue({ id: 'mock-user', email: 'user@example.com', name: 'Mock User' });
  selectFolder = jest.fn().mockResolvedValue({ id: 'mock-folder-id', name: 'Mock Folder' });
  uploadFile = jest.fn().mockResolvedValue(undefined);
  deleteFile = jest.fn().mockResolvedValue(undefined);
  syncSnippets = jest.fn().mockImplementation(async (local: Snippet[]) => local);
}

// --- Test Data ---

const personalSnippets: Snippet[] = [
  { id: 'p1', trigger: ';personal', content: 'My personal snippet' },
  { id: 'common1', trigger: ';common', content: 'Personal version' },
  { id: 'p2', trigger: ';another', content: 'Another personal one' },
];

const departmentSnippets: Snippet[] = [
  { id: 'd1', trigger: ';dept', content: 'A department snippet' },
  { id: 'common1', trigger: ';common', content: 'Department version' },
  { id: 'common2', trigger: ';shared', content: 'Department shared' },
];

const orgSnippets: Snippet[] = [
  { id: 'o1', trigger: ';org', content: 'An organization-wide snippet' },
  { id: 'common1', trigger: ';common', content: 'Org version' },
  { id: 'common2', trigger: ';shared', content: 'Org shared' },
];

// --- Helper Function ---

const createSource = (name: SnippetScope, adapter: BaseCloudAdapter, folderId: string): SyncedSource => ({
  name,
  adapter,
  folderId,
  displayName: `${name} Snippets`,
});

describe('MultiScopeSyncManager: Snippet Merging Logic', () => {
  let syncManager: MultiScopeSyncManager;
  let personalAdapter: MockCloudAdapter;
  let departmentAdapter: MockCloudAdapter;
  let orgAdapter: MockCloudAdapter;

  beforeEach(() => {
    personalAdapter = new MockCloudAdapter('google-drive', personalSnippets);
    departmentAdapter = new MockCloudAdapter('dropbox', departmentSnippets);
    orgAdapter = new MockCloudAdapter('onedrive', orgSnippets);
    syncManager = new MultiScopeSyncManager();
  });

  test('should merge snippets from three scopes with correct priority (personal > dept > org)', async () => {
    const sources = [
      createSource('personal', personalAdapter, 'p-1'),
      createSource('department', departmentAdapter, 'd-1'),
      createSource('org', orgAdapter, 'o-1'),
    ];

    const merged = await syncManager.syncAndMerge(sources);
    const snippetMap = new Map(merged.map(s => [s.trigger, s]));

    expect(merged).toHaveLength(6);
    expect(snippetMap.get(';common')).toEqual(expect.objectContaining({ content: 'Personal version', provider: 'google-drive' }));
    expect(snippetMap.get(';shared')).toEqual(expect.objectContaining({ content: 'Department shared', provider: 'dropbox' }));
    expect(snippetMap.has(';personal')).toBe(true);
    expect(snippetMap.has(';dept')).toBe(true);
    expect(snippetMap.has(';org')).toBe(true);
  });

  test('should correctly merge when a scope is missing', async () => {
    const sources = [
      createSource('personal', personalAdapter, 'p-1'),
      createSource('org', orgAdapter, 'o-1'),
    ];

    const merged = await syncManager.syncAndMerge(sources);
    const snippetMap = new Map(merged.map(s => [s.trigger, s]));

    expect(merged).toHaveLength(5);
    expect(snippetMap.get(';common')?.content).toBe('Personal version');
    expect(snippetMap.get(';shared')?.content).toBe('Org shared');
  });

  test('should handle a single scope gracefully', async () => {
    const sources = [createSource('org', orgAdapter, 'o-1')];
    const merged = await syncManager.syncAndMerge(sources);
    expect(merged).toHaveLength(orgSnippets.length);
  });

  test('should return an empty array for no sources', async () => {
    const merged = await syncManager.syncAndMerge([]);
    expect(merged).toEqual([]);
  });

  test('should handle sources with no snippets', async () => {
    const emptyAdapter = new MockCloudAdapter('empty-provider', []);
    const sources = [
      createSource('personal', personalAdapter, 'p-1'),
      createSource('department', emptyAdapter, 'e-1'),
    ];
    const merged = await syncManager.syncAndMerge(sources);
    expect(merged).toHaveLength(personalSnippets.length);
  });

  test('should continue merging if one adapter fails', async () => {
    jest.spyOn(departmentAdapter, 'downloadSnippets').mockRejectedValue(new Error('Sync failed!'));
    const sources = [
      createSource('personal', personalAdapter, 'p-1'),
      createSource('department', departmentAdapter, 'd-1'),
      createSource('org', orgAdapter, 'o-1'),
    ];

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const merged = await syncManager.syncAndMerge(sources);
    const snippetMap = new Map(merged.map(s => [s.trigger, s]));

    expect(merged.length).toBe(5);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to fetch snippets'), expect.any(Error));
    expect(snippetMap.get(';shared')?.content).toBe('Org shared');
    consoleSpy.mockRestore();
  });
});
