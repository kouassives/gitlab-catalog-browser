/**
 * GraphQL API client for GitLab.
 *
 * Provides unauthenticated (or optionally authenticated) access to GitLab's
 * GraphQL API. Used primarily for CI/CD Catalog queries which do not require
 * a token for public resources.
 *
 * Token is optional — when provided, it's sent as a Bearer token for queries
 * that need authentication (e.g., private resources, mutations).
 */

import {
  NetworkError,
  NotFoundError,
  ServerError,
  AuthenticationError,
  PermissionError,
  RateLimitError,
} from '../types/api.js';
import type { GitLabCIConfig } from '../config/types.js';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: (string | number)[];
    extensions?: Record<string, unknown>;
  }>;
}

export interface GraphQLQueryOptions {
  /** Optional auth token */
  token?: string;
  /** Request timeout in ms */
  timeout?: number;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

// ──────────────────────────────────────────────
// GraphQLApiClient
// ──────────────────────────────────────────────

export class GraphQLApiClient {
  private readonly baseUrl: string;
  private readonly token: string | undefined;
  private readonly defaultTimeout: number;

  constructor(config: Partial<GitLabCIConfig> & { debug?: boolean } = {}) {
    this.baseUrl = (config.gitlabUrl ?? 'https://gitlab.com').replace(/\/+$/, '');
    this.token = config.token;
    this.defaultTimeout = config.timeout ?? 30000;
  }

  /**
   * Execute a GraphQL query against the GitLab API.
   *
   * @param query - The GraphQL query string
   * @param variables - Optional query variables
   * @param options - Optional overrides (token, timeout, signal)
   * @returns The `data` field from the GraphQL response
   * @throws NetworkError on connectivity issues
   * @throws NotFoundError if resource not found
   */
  async query<T>(
    queryStr: string,
    variables?: Record<string, unknown>,
    options: GraphQLQueryOptions = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/api/graphql`;
    const token = options.token ?? this.token;
    const timeout = options.timeout ?? this.defaultTimeout;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const signal = options.signal
      ? composeAbortSignals(options.signal, controller.signal)
      : controller.signal;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: queryStr,
          variables: variables ?? undefined,
        }),
        signal,
      });

      clearTimeout(timeoutId);

      // Handle HTTP-level errors
      if (!response.ok) {
        this.throwHttpError(response.status, response.statusText, url);
      }

      const json = (await response.json()) as GraphQLResponse<T>;

      // Handle GraphQL-level errors
      if (json.errors && json.errors.length > 0) {
        const isNotFound = json.errors.some(
          (e) =>
            e.message.includes('does not exist') ||
            e.message.includes("don't have permission")
        );

        if (isNotFound) {
          throw new NotFoundError(url);
        }

        // For other GraphQL errors, log but return partial data if available
        // This matches GitLab's behavior of returning both errors and partial data
        if (json.data === undefined) {
          throw new Error(
            `GraphQL error: ${json.errors.map((e) => e.message).join('; ')}`
          );
        }
      }

      if (json.data === undefined) {
        throw new Error('GraphQL response contained no data');
      }

      return json.data as T;
    } catch (err) {
      clearTimeout(timeoutId);

      if (
        err instanceof NotFoundError ||
        err instanceof AuthenticationError ||
        err instanceof PermissionError ||
        err instanceof NetworkError ||
        err instanceof ServerError ||
        err instanceof RateLimitError
      ) {
        throw err;
      }

      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new NetworkError(
          this.baseUrl,
          `GraphQL request timed out after ${timeout}ms`
        );
      }

      throw new NetworkError(
        this.baseUrl,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  private throwHttpError(status: number, statusText: string, url: string): never {
    switch (status) {
      case 401:
        throw new AuthenticationError();
      case 403:
        throw new PermissionError(`Forbidden: ${statusText}`);
      case 404:
        throw new NotFoundError(url);
      case 429:
        throw new RateLimitError(`Rate limited: ${statusText}`);
      default:
        if (status >= 500) {
          throw new ServerError(status, statusText);
        }
        throw new Error(`GitLab API error (${status}): ${statusText}`);
    }
  }
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function composeAbortSignals(s1: AbortSignal, s2: AbortSignal): AbortSignal {
  const controller = new AbortController();

  const onAbort = () => controller.abort();
  s1.addEventListener('abort', onAbort);
  s2.addEventListener('abort', onAbort);

  if (!s1.aborted && !s2.aborted) {
    controller.signal.addEventListener('abort', () => {
      s1.removeEventListener('abort', onAbort);
      s2.removeEventListener('abort', onAbort);
    });
  }

  return controller.signal;
}
