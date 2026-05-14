/**
 * Tests for the Catalog API methods — covers 5 spec-delta scenarios.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CatalogApi } from './catalog.js';
import { GitLabApiClient } from './gitlab.js';
import type { CatalogComponent, CatalogComponentDetail } from '../types/catalog.js';

// ──────────────────────────────────────────────
// Mock data
// ──────────────────────────────────────────────

const MOCK_COMPONENTS: CatalogComponent[] = [
  {
    id: 1,
    name: 'docker-build',
    full_path: 'to-be-continuous/docker-build',
    version: '1.2.0',
    description: 'Docker build and push component',
    latest_tag: 'v1.2.0',
  },
  {
    id: 2,
    name: 'deploy-aws',
    full_path: 'to-be-continuous/deploy-aws',
    version: '2.0.0',
    description: 'AWS deployment component',
    latest_tag: 'v2.0.0',
  },
];

const MOCK_DETAIL: CatalogComponentDetail = {
  ...MOCK_COMPONENTS[0],
  inputs: [
    {
      name: 'image_name',
      type: 'string',
      required: true,
      description: 'Docker image name',
    },
  ],
  jobs: [
    {
      name: 'build',
      stage: 'build',
      script: ['docker build -t $IMAGE_NAME .'],
    },
  ],
};

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function createMockClient() {
  return new GitLabApiClient({ token: 'glpat-test' });
}

function mockFetchResponse(body: unknown, status = 200) {
  return vi.mocked(global.fetch).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
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

describe('CatalogApi', () => {
  describe('Scenario: List components for a namespace', () => {
    it('should resolve namespace and fetch catalog components', async () => {
      // First call: resolve namespace (groups search)
      mockFetchResponse([{ id: 42, path: 'to-be-continuous', name: 'To Be Continuous' }]);
      // Second call: list components
      mockFetchResponse(MOCK_COMPONENTS);

      const api = new CatalogApi(createMockClient());
      const result = await api.listComponents('to-be-continuous');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('docker-build');

      // First request was to /groups?search=to-be-continuous
      const [firstUrl] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(firstUrl).toContain('/groups?search=to-be-continuous');

      // Second request was to /projects/42/ci/catalog/components
      const [secondUrl] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[1];
      expect(secondUrl).toContain('/projects/42/ci/catalog/components');
    });

    it('should pass pagination params', async () => {
      mockFetchResponse([{ id: 42, path: 'to-be-continuous', name: 'To Be Continuous' }]);
      mockFetchResponse(MOCK_COMPONENTS);

      const api = new CatalogApi(createMockClient());
      await api.listComponents('to-be-continuous', { page: 2, perPage: 10 });

      const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[1];
      expect(url).toContain('page=2');
      expect(url).toContain('per_page=10');
    });
  });

  describe('Scenario: Search components by keyword', () => {
    it('should search with query parameter', async () => {
      mockFetchResponse(MOCK_COMPONENTS);

      const api = new CatalogApi(createMockClient());
      const result = await api.searchComponents('docker');

      expect(result).toHaveLength(2);

      const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('/ci/catalog/components');
      expect(url).toContain('search=docker');
    });
  });

  describe('Scenario: Get component info', () => {
    it('should fetch component detail', async () => {
      mockFetchResponse(MOCK_DETAIL);

      const api = new CatalogApi(createMockClient());
      const result = await api.getComponentInfo('to-be-continuous/docker-build');

      expect(result.name).toBe('docker-build');
      expect(result.inputs).toHaveLength(1);
      expect(result.jobs).toHaveLength(1);

      const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('/ci/catalog/components/to-be-continuous/docker-build');
    });
  });

  describe('Scenario: List components with empty namespace', () => {
    it('should throw error for unknown namespace', async () => {
      // Return empty groups search
      mockFetchResponse([]);

      const api = new CatalogApi(createMockClient());
      await expect(api.listComponents('empty-org')).rejects.toThrow(
        'Namespace not found: empty-org'
      );
    });
  });

  describe('Scenario: Get info for nonexistent component', () => {
    it('should propagate NotFoundError from base client', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'Not found' }),
      } as Response);

      const api = new CatalogApi(createMockClient());
      await expect(
        api.getComponentInfo('nonexistent/component')
      ).rejects.toThrow();
    });
  });
});
