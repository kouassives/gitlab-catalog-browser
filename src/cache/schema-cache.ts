/**
 * Schema Cache — file-based JSON cache with TTL for component schema data.
 *
 * Cache entries are persisted in `.gitlab-catalog-browser-cache.json` in the
 * configured cache directory (default: current working directory).
 * Supports configurable TTL via `GITLAB_CI_CLI_CACHE_TTL` env var (ms).
 * Cache directory can be overridden via `GITLAB_CI_CLI_CACHE_DIR` env var.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
const CACHE_FILENAME = '.gitlab-catalog-browser-cache.json';

interface CacheEntry {
  data: unknown;
  timestamp: number;
  ttl: number;
}

interface CacheStore {
  [key: string]: CacheEntry;
}

// ──────────────────────────────────────────────
// SchemaCache
// ──────────────────────────────────────────────

export class SchemaCache {
  private store: CacheStore = {};
  private cacheDir: string;
  private cachePath: string;

  constructor(cacheDir?: string) {
    this.cacheDir = cacheDir ?? process.env.GITLAB_CI_CLI_CACHE_DIR ?? process.cwd();
    this.cachePath = join(this.cacheDir, CACHE_FILENAME);
    this.load();
  }

  /**
   * Get a value from cache. Returns null if not found or expired.
   */
  get<T>(key: string): { data: T; age: number } | null {
    const entry = this.store[key];
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      // Expired — remove it
      delete this.store[key];
      this.save();
      return null;
    }

    return { data: entry.data as T, age };
  }

  /**
   * Set a value in cache with optional custom TTL.
   */
  set(key: string, data: unknown, ttl?: number): void {
    this.store[key] = {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? this.resolveTtl(),
    };
    this.save();
  }

  /**
   * Clear all cached entries.
   */
  clear(): void {
    this.store = {};
    this.save();
  }

  /**
   * Remove a single entry from cache.
   */
  remove(key: string): void {
    delete this.store[key];
    this.save();
  }

  /**
   * Get the number of cached entries.
   */
  get size(): number {
    return Object.keys(this.store).length;
  }

  /**
   * Load cache from disk.
   */
  private load(): void {
    try {
      const content = readFileSync(this.cachePath, 'utf-8');
      this.store = JSON.parse(content) as CacheStore;
    } catch {
      this.store = {};
    }
  }

  /**
   * Save cache to disk.
   */
  private save(): void {
    try {
      const dir = this.cacheDir;
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(this.cachePath, JSON.stringify(this.store, null, 2), 'utf-8');
    } catch {
      // Silently fail — cache is a performance optimization, not critical
    }
  }

  /**
   * Resolve TTL from env var or default.
   */
  private resolveTtl(): number {
    const envTtl = process.env.GITLAB_CI_CLI_CACHE_TTL;
    if (envTtl) {
      const parsed = parseInt(envTtl, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return DEFAULT_TTL;
  }
}

/**
 * Build a cache key for component schema requests.
 */
export function buildComponentCacheKey(
  fullPath: string,
  version?: string
): string {
  const parts = ['component', fullPath];
  if (version) parts.push(version);
  return parts.join(':');
}
