/**
 * Base GitLab API client.
 *
 * Provides authenticated HTTP access to GitLab REST APIs with:
 * - Bearer token authentication
 * - Configurable base URL and timeout
 * - Structured error handling for all HTTP error codes
 * - Pagination support
 */

import {
  type PaginationParams,
  GitLabApiError,
  AuthenticationError,
  PermissionError,
  NotFoundError,
  RateLimitError,
  ServerError,
  NetworkError,
  ConfigurationError,
} from '../types/api.js';
import type { GitLabCIConfig } from '../config/types.js';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface RequestOptions {
  /** Query parameters */
  params?: Record<string, string | number | boolean | undefined>;
  /** Request body (will be JSON-serialized) */
  body?: unknown;
  /** Additional headers */
  headers?: Record<string, string>;
  /** Override timeout in ms */
  timeout?: number;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

export interface RequestContext {
  method: string;
  url: string;
  statusCode: number;
  durationMs: number;
}

// ──────────────────────────────────────────────
// GitLabApiClient
// ──────────────────────────────────────────────

export class GitLabApiClient {
  private readonly baseUrl: string;
  private readonly token: string | undefined;
  private readonly defaultTimeout: number;
  private readonly debug: boolean;

  constructor(config: Partial<GitLabCIConfig> & { debug?: boolean } = {}) {
    this.baseUrl = (config.gitlabUrl ?? 'https://gitlab.com').replace(/\/+$/, '');
    this.token = config.token;
    this.defaultTimeout = config.timeout ?? 30000;
    this.debug = config.debug ?? false;
  }

  // ────────────────────────────────────────────
  // Public HTTP methods
  // ────────────────────────────────────────────

  /**
   * Send an authenticated GET request.
   */
  async get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('GET', path, options);
  }

  /**
   * Send an authenticated POST request with JSON body.
   */
  async post<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('POST', path, options);
  }

  /**
   * Send an authenticated PUT request with JSON body.
   */
  async put<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('PUT', path, options);
  }

  /**
   * Send an authenticated DELETE request.
   */
  async delete<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('DELETE', path, options);
  }

  // ────────────────────────────────────────────
  // Pagination
  // ────────────────────────────────────────────

  /**
   * Fetch a paginated list, returning all pages.
   * Uses GitLab's standard `page`/`per_page` query parameter convention.
   */
  async getAll<T>(path: string, options: RequestOptions & PaginationParams = {}): Promise<T[]> {
    const { page = 1, perPage = 20, ...rest } = options;
    const results: T[] = [];

    let currentPage = page;
    let hasMore = true;

    while (hasMore) {
      const data = await this.get<T[]>(path, {
        ...rest,
        params: { ...rest.params, page: currentPage, per_page: perPage },
      });
      results.push(...data);

      // If we got fewer items than perPage, we're on the last page
      if (data.length < perPage) {
        hasMore = false;
      } else {
        currentPage++;
      }
    }

    return results;
  }

  // ────────────────────────────────────────────
  // Core request method
  // ────────────────────────────────────────────

  private async request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const startTime = Date.now();

    // Validate token
    if (!this.token) {
      throw new ConfigurationError(
        'No GitLab token configured. Set GITLAB_CI_CLI_TOKEN or add "token" to your config file.'
      );
    }

    // Build URL
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${this.baseUrl}${cleanPath}`);

    // Add query parameters
    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    // Build headers
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/json',
      ...options.headers,
    };

    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    // Abort controller for timeout
    const timeoutMs = options.timeout ?? this.defaultTimeout;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Combine signals if both provided
    const signal = options.signal
      ? composeAbortSignals(options.signal, controller.signal)
      : controller.signal;

    try {
      if (this.debug) {
        console.error(`[GitLab API] ${method} ${url.toString()}`);
      }

      const response = await fetch(url.toString(), {
        method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal,
      });

      const duration = Date.now() - startTime;

      if (this.debug) {
        console.error(`[GitLab API] → ${response.status} (${duration}ms)`);
      }

      // Handle errors
      if (!response.ok) {
        const errorBody = await this.parseErrorBody(response);
        this.throwHttpError(response.status, response.statusText, url.toString(), errorBody);
      }

      // Parse response body
      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        return (await response.json()) as T;
      }

      // For non-JSON responses, return the status as unknown
      return { status: response.status } as unknown as T;
    } catch (err) {
      // Typed API errors (including GitLabApiError from throwHttpError) — re-throw
      if (err instanceof GitLabApiError) {
        throw err;
      }

      // Check for abort (timeout)
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new NetworkError(
          this.baseUrl,
          `Request timed out after ${timeoutMs}ms`
        );
      }

      // Network errors (fetch TypeError, DNS failures, etc.) — wrap with context
      throw new NetworkError(
        this.baseUrl,
        err instanceof Error ? err.message : String(err)
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ────────────────────────────────────────────
  // Error handling
  // ────────────────────────────────────────────

  /**
   * Try to parse the error body from an unsuccessful response.
   */
  private async parseErrorBody(response: Response): Promise<string> {
    try {
      const body = (await response.json()) as { message?: string | Record<string, string[]>; error?: string };
      if (typeof body.message === 'string') return body.message;
      if (body.error) return body.error;
    } catch {
      // Ignore parse errors
    }
    return `HTTP ${response.status} ${response.statusText}`;
  }

  /**
   * Throw the appropriate error type based on HTTP status code.
   */
  private throwHttpError(status: number, statusText: string, url: string, message: string): never {
    switch (status) {
      case 401:
        throw new AuthenticationError();
      case 403:
        throw new PermissionError(message);
      case 404:
        throw new NotFoundError(url);
      case 429:
        throw new RateLimitError(`Rate limited: ${message}`);
      default:
        if (status >= 500) {
          throw new ServerError(status, statusText);
        }
        // Other HTTP errors (e.g. 422 Unprocessable Entity)
        // Use GitLabApiError so it propagates as a typed API error, not a network error
        throw new GitLabApiError(`GitLab API error (${status}): ${message}`, status);
    }
  }
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/**
 * Compose two AbortSignals into one that aborts if either aborts.
 */
function composeAbortSignals(s1: AbortSignal, s2: AbortSignal): AbortSignal {
  const controller = new AbortController();

  const onAbort = () => controller.abort();
  s1.addEventListener('abort', onAbort);
  s2.addEventListener('abort', onAbort);

  // Clean up listeners if neither aborts
  if (!s1.aborted && !s2.aborted) {
    controller.signal.addEventListener('abort', () => {
      s1.removeEventListener('abort', onAbort);
      s2.removeEventListener('abort', onAbort);
    });
  }

  return controller.signal;
}
