/**
 * Tests for the GraphQL API client — covers spec-delta scenarios.
 *
 * Scenarios:
 * - Query public catalog resource without token
 * - Query with authentication (optional token)
 * - GraphQL response with errors
 * - GraphQL resource not found (null data)
 * - GraphQL network error
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GraphQLApiClient } from './graphql.js';
import { NotFoundError, NetworkError } from '../types/api.js';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function mockGraphQLResponse(data: unknown, errors?: unknown[]) {
  const body: Record<string, unknown> = {};
  if (data !== undefined) body.data = data;
  if (errors !== undefined) body.errors = errors;

  return vi.mocked(global.fetch).mockResolvedValueOnce({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
  } as Response);
}

function mockHttpError(status: number, statusText: string) {
  return vi.mocked(global.fetch).mockResolvedValueOnce({
    ok: false,
    status,
    statusText,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ message: statusText }),
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

describe('GraphQLApiClient', () => {
  describe('Scenario: Query public catalog resource without token', () => {
    it('should send a GraphQL POST request without Authorization header', async () => {
      mockGraphQLResponse({
        ciCatalogResource: { id: 'gid://gitlab/Ci::Catalog::Resource/1', name: 'test' },
      });

      const client = new GraphQLApiClient({}); // no token
      const result = await client.query<{ ciCatalogResource: { id: string; name: string } }>(
        'query { ciCatalogResource(fullPath: "org/component") { id name } }'
      );

      expect(result.ciCatalogResource.name).toBe('test');

      const [request] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(request).toContain('/api/graphql');

      const [, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(options.headers).not.toHaveProperty('Authorization');
    });

    it('should not throw ConfigurationError when no token is set', async () => {
      mockGraphQLResponse({
        ciCatalogResources: { nodes: [{ id: '1', name: 'comp' }] },
      });

      const client = new GraphQLApiClient({});
      const result = await client.query<{ ciCatalogResources: { nodes: Array<{ id: string; name: string }> } }>(
        'query { ciCatalogResources(first: 5) { nodes { id name } } }'
      );

      expect(result.ciCatalogResources.nodes).toHaveLength(1);
    });
  });

  describe('Scenario: Query with authentication (optional token)', () => {
    it('should include Authorization header when token is provided', async () => {
      mockGraphQLResponse({ currentUser: { name: 'Test User' } });

      const client = new GraphQLApiClient({ token: 'glpat-secret' });
      await client.query('query { currentUser { name } }');

      const [, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(options.headers['Authorization']).toBe('Bearer glpat-secret');
    });

    it('should use per-request token override', async () => {
      mockGraphQLResponse({ currentUser: { name: 'Override User' } });

      const client = new GraphQLApiClient({}); // no default token
      await client.query(
        'query { currentUser { name } }',
        undefined,
        { token: 'override-token' }
      );

      const [, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(options.headers['Authorization']).toBe('Bearer override-token');
    });
  });

  describe('Scenario: GraphQL response with errors', () => {
    it('should throw for GraphQL errors when data is absent', async () => {
      mockGraphQLResponse(undefined, [
        { message: 'Field "foo" doesn\'t exist on type "Query"' },
      ]);

      const client = new GraphQLApiClient({});
      await expect(
        client.query('query { foo }')
      ).rejects.toThrow('GraphQL error');
    });

    it('should return partial data when both data and errors are present', async () => {
      mockGraphQLResponse(
        { ciCatalogResource: { id: '1', name: 'partial' } },
        [{ message: 'Some field failed', path: ['ciCatalogResource', 'badField'] }]
      );

      const client = new GraphQLApiClient({});
      const result = await client.query<{ ciCatalogResource: { id: string; name: string } }>(
        'query { ciCatalogResource(fullPath: "org/comp") { id name badField } }'
      );

      // Should return partial data without throwing
      expect(result.ciCatalogResource.name).toBe('partial');
    });
  });

  describe('Scenario: GraphQL resource not found (null data)', () => {
    it('should throw NotFoundError when ciCatalogResource returns null with error', async () => {
      // Real GitLab API returns both errors and data:null for nonexistent resources
      mockGraphQLResponse(
        { ciCatalogResource: null },
        [{ message: 'The resource that you are attempting to access does not exist or you don\'t have permission to perform this action', path: ['ciCatalogResource'] }]
      );

      const client = new GraphQLApiClient({});
      await expect(
        client.query('query { ciCatalogResource(fullPath: "nonexistent/comp") { id name } }')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('Scenario: GraphQL network error', () => {
    it('should throw NetworkError on fetch failure', async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

      const client = new GraphQLApiClient({});
      await expect(
        client.query('query { test }')
      ).rejects.toThrow(NetworkError);
    });

    it('should throw NetworkError on timeout', async () => {
      // Simulate a timeout via AbortError
      const abortError = new DOMException('The operation was aborted', 'AbortError');
      vi.mocked(global.fetch).mockRejectedValueOnce(abortError);

      const client = new GraphQLApiClient({ timeout: 100 });
      await expect(
        client.query('query { test }')
      ).rejects.toThrow(NetworkError);
    });
  });

  describe('HTTP error handling', () => {
    it('should throw AuthenticationError on 401', async () => {
      mockHttpError(401, 'Unauthorized');
      const client = new GraphQLApiClient({ token: 'bad-token' });
      await expect(
        client.query('query { test }')
      ).rejects.toThrow(/Authentication/);
    });

    it('should throw NotFoundError on 404', async () => {
      mockHttpError(404, 'Not Found');
      const client = new GraphQLApiClient({});
      await expect(
        client.query('query { test }')
      ).rejects.toThrow(NotFoundError);
    });
  });
});
