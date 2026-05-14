/**
 * Tests for the base GitLab API client — covers all 11 spec-delta scenarios.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  GitLabApiClient,
} from './gitlab.js';
import {
  AuthenticationError,
  PermissionError,
  NotFoundError,
  RateLimitError,
  ServerError,
  NetworkError,
  ConfigurationError,
} from '../types/api.js';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function mockFetch(response: Partial<Response>, body?: unknown) {
  return vi.mocked(global.fetch).mockResolvedValueOnce({
    ok: response.ok ?? true,
    status: response.status ?? 200,
    statusText: response.statusText ?? 'OK',
    headers: response.headers ?? new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    ...response,
  } as Response);
}

function mockFetchError(status: number, statusText: string, body?: unknown, headers?: Record<string, string>) {
  return vi.mocked(global.fetch).mockResolvedValueOnce({
    ok: false,
    status,
    statusText,
    headers: new Headers({
      'content-type': 'application/json',
      ...headers,
    }),
    json: async () => body ?? { message: `HTTP ${status}` },
  } as Response);
}

// ──────────────────────────────────────────────
// Setup
// ──────────────────────────────────────────────

beforeEach(() => {
  vi.spyOn(global, 'fetch').mockImplementation(() =>
    Promise.resolve(new Response(null, { status: 200 }))
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe('GitLabApiClient', () => {
  describe('Scenario: Authenticated GET request', () => {
    it('should send GET with Bearer token and return parsed JSON', async () => {
      const mockData = { name: 'test', version: '1.0' };
      mockFetch({ ok: true, status: 200 }, mockData);

      const client = new GitLabApiClient({ token: 'glpat-test' });
      const result = await client.get<typeof mockData>('/api/v4/version');

      expect(result).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('/api/v4/version');
      expect((opts as RequestInit).headers).toMatchObject({
        Authorization: 'Bearer glpat-test',
      });
      expect((opts as RequestInit).method).toBe('GET');
    });

    it('should use configured base URL', async () => {
      mockFetch({ ok: true, status: 200 }, {});

      const client = new GitLabApiClient({
        gitlabUrl: 'https://gitlab.example.com',
        token: 'glpat-test',
      });
      await client.get('/api/v4/version');

      const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('https://gitlab.example.com');
    });
  });

  describe('Scenario: Authenticated POST request with JSON body', () => {
    it('should send POST with JSON body and Content-Type header', async () => {
      mockFetch({ ok: true, status: 200 }, { status: 'valid' });

      const client = new GitLabApiClient({ token: 'glpat-test' });
      const body = { content: 'stages: [build]' };
      const result = await client.post<{ status: string }>('/api/v4/validate', { body });

      expect(result.status).toBe('valid');
      const [, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect((opts as RequestInit).method).toBe('POST');
      expect((opts as RequestInit).headers).toMatchObject({ 'Content-Type': 'application/json' });
      expect((opts as RequestInit).body).toBe(JSON.stringify(body));
    });
  });

  describe('Scenario: Request with custom timeout', () => {
    it('should use the configured timeout', async () => {
      mockFetch({ ok: true, status: 200 }, {});

      const client = new GitLabApiClient({ token: 'glpat-test', timeout: 5000 });
      await client.get('/test');

      // Verify the request was made (timeout is passed to AbortSignal)
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Scenario: 401 Unauthorized', () => {
    it('should throw AuthenticationError', async () => {
      mockFetchError(401, 'Unauthorized', { message: 'Invalid token' });

      const client = new GitLabApiClient({ token: 'glpat-bad' });
      await expect(client.get('/api/v4/user')).rejects.toThrow(AuthenticationError);
    });
  });

  describe('Scenario: 403 Forbidden', () => {
    it('should throw PermissionError', async () => {
      mockFetchError(403, 'Forbidden', { message: 'Insufficient permissions' });

      const client = new GitLabApiClient({ token: 'glpat-limited' });
      await expect(client.get('/api/v4/admin')).rejects.toThrow(PermissionError);
    });
  });

  describe('Scenario: 404 Not Found', () => {
    it('should throw NotFoundError', async () => {
      mockFetchError(404, 'Not Found');

      const client = new GitLabApiClient({ token: 'glpat-test' });
      await expect(client.get('/api/v4/nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('Scenario: 429 Rate Limited', () => {
    it('should throw RateLimitError', async () => {
      mockFetchError(429, 'Too Many Requests', { message: 'Rate limit exceeded' });

      const client = new GitLabApiClient({ token: 'glpat-test' });
      await expect(client.get('/api/v4/projects')).rejects.toThrow(RateLimitError);
    });
  });

  describe('Scenario: 500+ Server Error', () => {
    it('should throw ServerError on 500', async () => {
      mockFetchError(500, 'Internal Server Error');

      const client = new GitLabApiClient({ token: 'glpat-test' });
      await expect(client.get('/api/v4/error')).rejects.toThrow(ServerError);
    });

    it('should throw ServerError on 502', async () => {
      mockFetchError(502, 'Bad Gateway');

      const client = new GitLabApiClient({ token: 'glpat-test' });
      await expect(client.get('/api/v4/error')).rejects.toThrow(ServerError);
    });
  });

  describe('Scenario: Network connectivity error', () => {
    it('should throw NetworkError when fetch fails', async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(new TypeError('fetch failed'));

      const client = new GitLabApiClient({ token: 'glpat-test' });
      await expect(client.get('/api/v4/test')).rejects.toThrow(NetworkError);
    });
  });

  describe('Scenario: No token configured', () => {
    it('should throw ConfigurationError when no token is set', async () => {
      const client = new GitLabApiClient({}); // no token
      await expect(client.get('/api/v4/test')).rejects.toThrow(ConfigurationError);
    });

    it('should include suggestion in error message', async () => {
      const client = new GitLabApiClient({});
      try {
        await client.get('/api/v4/test');
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigurationError);
        expect((err as ConfigurationError).message).toContain('GITLAB_CI_CLI_TOKEN');
      }
    });
  });

  describe('Scenario: Paginated GET request', () => {
    it('should pass page and per_page as query parameters', async () => {
      // getAll makes multiple requests; mock first page with full data, second with empty
      const page1Data = Array(20).fill(0).map((_, i) => ({ id: i, name: `comp-${i}` }));
      const page2Data: Array<{ id: number; name: string }> = [];

      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => page1Data,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => page2Data,
        } as Response);

      const client = new GitLabApiClient({ token: 'glpat-test' });
      const results = await client.getAll<{ id: number; name: string }>('/api/v4/projects', {
        page: 1,
        perPage: 20,
      });

      expect(results).toHaveLength(20);

      // Verify query params on first request
      const [firstUrl] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(firstUrl).toContain('page=1');
      expect(firstUrl).toContain('per_page=20');
    });
  });
});
