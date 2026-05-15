/**
 * Tests for the Catalog API methods — covers cursor-based pagination scenarios.
 *
 * Scenarios:
 * - List components for a namespace (with multi-page fetch)
 * - Search components by keyword (with multi-page fetch)
 * - Get component info
 * - List components with empty namespace
 * - Get info for nonexistent component
 * - Pagination with page/perPage offset on complete set
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CatalogApi } from './catalog.js';
import { GraphQLApiClient } from './graphql.js';

// ──────────────────────────────────────────────
// Mock GraphQL response helper
// ──────────────────────────────────────────────

function mockGraphQL(data: unknown, errors?: unknown[]) {
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

// ──────────────────────────────────────────────
// Factory: builds a ciCatalogResources page response
// Used by searchComponents tests (still uses global catalog search)
// ──────────────────────────────────────────────

function makePage(
  nodes: Array<{ id: string; name: string; fullPath: string; description?: string }>,
  hasNextPage: boolean,
  endCursor: string | null
) {
  return {
    ciCatalogResources: {
      nodes: nodes.map((n) => ({
        id: n.id,
        name: n.name,
        fullPath: n.fullPath,
        description: n.description ?? null,
        webPath: `/${n.fullPath}`,
        latestReleasedAt: null,
        versions: { nodes: [{ name: '1.0.0' }] },
      })),
      pageInfo: { hasNextPage, endCursor },
    },
  };
}

// ──────────────────────────────────────────────
// Factory: builds a group(fullPath:) response
// Used by listComponents tests (fetches projects from specific namespace)
// ──────────────────────────────────────────────

function makeGroupPage(
  groupPath: string,
  projects: Array<{
    id: string;
    name: string;
    path: string;
    description?: string;
    starCount?: number;
    isCatalogResource?: boolean;
  }>,
  hasNextPage: boolean,
  endCursor: string | null
) {
  return {
    group: {
      name: groupPath.split('/').pop() ?? groupPath,
      fullPath: groupPath,
      projects: {
        pageInfo: { hasNextPage, endCursor },
        nodes: projects.map((p) => ({
          id: p.id,
          name: p.name,
          path: p.path,
          description: p.description ?? null,
          starCount: p.starCount ?? 0,
          isCatalogResource: p.isCatalogResource ?? false,
        })),
      },
    },
  };
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function createClient() {
  return new GraphQLApiClient({}); // no token needed
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

describe('CatalogApi', () => {
  describe('Scenario: List components for a namespace (multi-page)', () => {
    it('should fetch all pages from group and filter by isCatalogResource', async () => {
      // Page 1: 2 catalog resources + 1 non-catalog project, hasNextPage=true
      mockGraphQL(makeGroupPage(
        'to-be-continuous',
        [
          { id: 'gid://gitlab/Project/1', name: 'docker', path: 'docker', isCatalogResource: true },
          { id: 'gid://gitlab/Project/2', name: 'android', path: 'android', isCatalogResource: false },
          { id: 'gid://gitlab/Project/3', name: 'python', path: 'python', isCatalogResource: true },
        ],
        true,
        'cursor-1'
      ));
      // Page 2: 1 catalog resource, hasNextPage=false
      mockGraphQL(makeGroupPage(
        'to-be-continuous',
        [
          { id: 'gid://gitlab/Project/4', name: 'maven', path: 'maven', isCatalogResource: true },
        ],
        false,
        null
      ));

      const api = new CatalogApi(createClient());
      const result = await api.listComponents('to-be-continuous');

      // Should have 3 catalog resources (android filtered out)
      expect(result).toHaveLength(3);
      expect(result.map((c) => c.name)).toEqual(['docker', 'python', 'maven']);

      // Verify 2 GraphQL calls were made (2 group pages)
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should return all results when no pagination params given', async () => {
      // Single page with hasNextPage=false
      mockGraphQL(makeGroupPage(
        'my-org',
        [
          { id: 'gid://gitlab/Project/1', name: 'a', path: 'a', isCatalogResource: true },
          { id: 'gid://gitlab/Project/2', name: 'b', path: 'b', isCatalogResource: true },
        ],
        false,
        null
      ));

      const api = new CatalogApi(createClient());
      const result = await api.listComponents('my-org');

      expect(result).toHaveLength(2);
    });

    it('should stop fetching when hasNextPage is false', async () => {
      mockGraphQL(makeGroupPage(
        'my-org',
        [
          { id: 'gid://gitlab/Project/1', name: 'only', path: 'only', isCatalogResource: true },
        ],
        false,
        null
      ));

      const api = new CatalogApi(createClient());
      const result = await api.listComponents('my-org');

      expect(result).toHaveLength(1);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Scenario: Pagination with page/perPage offset', () => {
    it('should apply offset on complete set when page is specified', async () => {
      // One page with 5 items (all catalog resources)
      const items = Array.from({ length: 5 }, (_, i) => ({
        id: `gid://gitlab/Project/${i + 10}`,
        name: `comp-${i}`,
        path: `comp-${i}`,
        isCatalogResource: true,
      }));
      mockGraphQL(makeGroupPage('org', items, false, null));

      const api = new CatalogApi(createClient());
      // Page 2, perPage 2 → should return items at index 2-3
      const result = await api.listComponents('org', { page: 2, perPage: 2 });

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('comp-2');
      expect(result[1].name).toBe('comp-3');
    });

    it('should return empty array for page beyond available results', async () => {
      mockGraphQL(makeGroupPage(
        'org',
        [
          { id: 'gid://gitlab/Project/1', name: 'only', path: 'only', isCatalogResource: true },
        ],
        false,
        null
      ));

      const api = new CatalogApi(createClient());
      const result = await api.listComponents('org', { page: 10, perPage: 10 });

      expect(result).toHaveLength(0);
    });
  });

  describe('Scenario: Search components by keyword (multi-page)', () => {
    it('should fetch all search result pages', async () => {
      // Page 1: 2 items, hasNextPage=true
      mockGraphQL(makePage(
        [
          { id: 'gid://gitlab/Ci::Catalog::Resource/1', name: 'Docker', fullPath: 'org/docker' },
          { id: 'gid://gitlab/Ci::Catalog::Resource/2', name: 'Kaniko', fullPath: 'other/kaniko' },
        ],
        true,
        'cursor-d1'
      ));
      // Page 2: 1 item, hasNextPage=false
      mockGraphQL(makePage(
        [
          { id: 'gid://gitlab/Ci::Catalog::Resource/3', name: 'Docker Compose', fullPath: 'org/compose' },
        ],
        false,
        null
      ));

      const api = new CatalogApi(createClient());
      const result = await api.searchComponents('docker');

      expect(result).toHaveLength(3);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should return empty array when no results', async () => {
      mockGraphQL(makePage([], false, null));

      const api = new CatalogApi(createClient());
      const result = await api.searchComponents('zzzznonexistent');

      expect(result).toHaveLength(0);
    });
  });

  describe('Scenario: Get component info', () => {
    it('should fetch component detail with inputs via GraphQL', async () => {
      mockGraphQL({
        ciCatalogResource: {
          id: 'gid://gitlab/Ci::Catalog::Resource/1',
          name: 'docker',
          fullPath: 'to-be-continuous/docker',
          description: 'Docker component',
          webPath: '/to-be-continuous/docker',
          starCount: 42,
          topics: ['docker'],
          verificationLevel: 'VERIFIED',
          latestReleasedAt: '2025-01-15T10:00:00Z',
          versions: {
            nodes: [
              {
                name: '8.3.0',
                path: '/to-be-continuous/docker/-/tags/8.3.0',
                semver: { major: 8, minor: 3, patch: 0 },
                components: {
                  nodes: [
                    {
                      id: 'gid://gitlab/Ci::Catalog::Resources::Component/100',
                      name: 'gitlab-ci-docker',
                      includePath: '$CI_SERVER_FQDN/to-be-continuous/docker/gitlab-ci-docker@8.3.0',
                      description: null,
                      inputs: [
                        {
                          name: 'image_name',
                          type: 'STRING',
                          required: true,
                          default: null,
                          description: 'Docker image name',
                          options: null,
                          regex: null,
                        },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        },
      });

      const api = new CatalogApi(createClient());
      const result = await api.getComponentInfo('to-be-continuous/docker');

      expect(result.name).toBe('docker');
      expect(result.inputs).toHaveLength(1);
      expect(result.inputs![0].name).toBe('image_name');

      // Verify GraphQL query
      const [, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.query).toContain('ciCatalogResource');
      expect(body.variables.fullPath).toBe('to-be-continuous/docker');
    });
  });

  describe('Scenario: List components with empty namespace', () => {
    it('should return empty array when no catalog resources in group', async () => {
      mockGraphQL(makeGroupPage(
        'empty-org',
        [
          { id: 'gid://gitlab/Project/1', name: 'internal', path: 'internal', isCatalogResource: false },
          { id: 'gid://gitlab/Project/2', name: 'docs', path: 'docs', isCatalogResource: false },
        ],
        false,
        null
      ));

      const api = new CatalogApi(createClient());
      const result = await api.listComponents('empty-org');

      expect(result).toHaveLength(0);
    });

    it('should return empty array when group is not found', async () => {
      mockGraphQL({ group: null });

      const api = new CatalogApi(createClient());
      const result = await api.listComponents('nonexistent-org');

      expect(result).toHaveLength(0);
    });
  });

  describe('Scenario: Get info for nonexistent component', () => {
    it('should throw NotFoundError for missing resource', async () => {
      mockGraphQL(
        { ciCatalogResource: null },
        [{ message: 'The resource that you are attempting to access does not exist', path: ['ciCatalogResource'] }]
      );

      const api = new CatalogApi(createClient());
      await expect(
        api.getComponentInfo('nonexistent/component')
      ).rejects.toThrow(/not found/i);
    });
  });
});
