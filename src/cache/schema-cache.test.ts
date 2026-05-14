/**
 * Tests for SchemaCache — covers cache operations, TTL, and persistence.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SchemaCache, buildComponentCacheKey } from './schema-cache.js';

// ──────────────────────────────────────────────
// Hoisted mocks for fs
// ──────────────────────────────────────────────

const mockReadFileSync = vi.hoisted(() => vi.fn());
const mockWriteFileSync = vi.hoisted(() => vi.fn());
const mockExistsSync = vi.hoisted(() => vi.fn());
const mockMkdirSync = vi.hoisted(() => vi.fn());

vi.mock('node:fs', () => ({
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
}));

// ──────────────────────────────────────────────
// Setup
// ──────────────────────────────────────────────

const TEST_DIR = '/tmp/test-cache';

beforeEach(() => {
  vi.clearAllMocks();
  // Simulate no existing cache file
  mockReadFileSync.mockImplementation(() => { throw new Error('ENOENT'); });
  mockExistsSync.mockReturnValue(true); // dir exists
});

// ──────────────────────────────────────────────
// SchemaCache tests
// ──────────────────────────────────────────────

describe('SchemaCache', () => {
  it('should return null for uncached key', () => {
    const cache = new SchemaCache(TEST_DIR);
    const result = cache.get('nonexistent');
    expect(result).toBeNull();
  });

  it('should store and retrieve values', () => {
    const cache = new SchemaCache(TEST_DIR);
    cache.set('test-key', { hello: 'world' });

    const result = cache.get<{ hello: string }>('test-key');
    expect(result).not.toBeNull();
    expect(result!.data.hello).toBe('world');
    expect(result!.age).toBeGreaterThanOrEqual(0);
  });

  it('should respect TTL and expire entries', () => {
    const cache = new SchemaCache(TEST_DIR);

    // Set with a very short TTL (1ms) that will already be expired
    cache.set('quick-expire', { data: 'test' }, -1000);

    const result = cache.get('quick-expire');
    expect(result).toBeNull();
  });

  it('should remove specific entries', () => {
    const cache = new SchemaCache(TEST_DIR);
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');

    cache.remove('key1');
    expect(cache.get('key1')).toBeNull();
    expect(cache.get('key2')).not.toBeNull();
  });

  it('should clear all entries', () => {
    const cache = new SchemaCache(TEST_DIR);
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');

    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('key1')).toBeNull();
  });

  it('should track cache size', () => {
    const cache = new SchemaCache(TEST_DIR);
    expect(cache.size).toBe(0);

    cache.set('a', 1);
    expect(cache.size).toBe(1);

    cache.set('b', 2);
    expect(cache.size).toBe(2);
  });

  it('should load existing cache from disk', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({
      'existing-key': {
        data: 'cached-value',
        timestamp: Date.now(),
        ttl: 300000,
      },
    }));

    const cache = new SchemaCache(TEST_DIR);
    const result = cache.get<string>('existing-key');
    expect(result).not.toBeNull();
    expect(result!.data).toBe('cached-value');
  });

  it('should persist cache to disk on set', () => {
    const cache = new SchemaCache(TEST_DIR);
    cache.set('persist-key', 'persist-value');

    // writeFileSync should have been called
    expect(mockWriteFileSync).toHaveBeenCalled();
    const callArg = mockWriteFileSync.mock.calls[0][1] as string;
    const parsed = JSON.parse(callArg);
    expect(parsed['persist-key'].data).toBe('persist-value');
  });
});

// ──────────────────────────────────────────────
// buildComponentCacheKey tests
// ──────────────────────────────────────────────

describe('buildComponentCacheKey', () => {
  it('should build key from full path', () => {
    const key = buildComponentCacheKey('to-be-continuous/docker-build');
    expect(key).toBe('component:to-be-continuous/docker-build');
  });

  it('should include version when specified', () => {
    const key = buildComponentCacheKey('to-be-continuous/docker-build', '1.0.0');
    expect(key).toBe('component:to-be-continuous/docker-build:1.0.0');
  });
});
