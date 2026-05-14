/**
 * Tests for catalog command handlers — covers all 10 spec scenarios.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  handleCatalogList,
  handleCatalogSearch,
  handleCatalogInfo,
} from './catalog.js';

// ──────────────────────────────────────────────
// Mock data
// ──────────────────────────────────────────────

const MOCK_COMPONENTS = [
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

const MOCK_DETAIL = {
  ...MOCK_COMPONENTS[0],
  inputs: [{ name: 'image_name', type: 'string', required: true, description: 'Docker image name' }],
  jobs: [{ name: 'build', stage: 'build', script: ['docker build -t $IMAGE_NAME .'] }],
  workflows: [{ name: 'default', triggers: ['branch'], jobs: ['build'] }],
};

// ──────────────────────────────────────────────
// Mocks
// ──────────────────────────────────────────────

vi.mock('../api/catalog.js', () => ({
  CatalogApi: vi.fn().mockImplementation(() => ({
    listComponents: vi.fn(),
    searchComponents: vi.fn(),
    getComponentInfo: vi.fn(),
  })),
}));

import { CatalogApi } from '../api/catalog.js';

// ──────────────────────────────────────────────
// Setup
// ──────────────────────────────────────────────

const defaultConfig = { gitlabUrl: 'https://gitlab.com', token: 'glpat-test' };

function mockListComponents(impl: () => unknown) {
  vi.mocked(CatalogApi).mockImplementation(
    () => ({ listComponents: vi.fn(impl) } as unknown as InstanceType<typeof CatalogApi>)
  );
}

function mockSearchComponents(impl: () => unknown) {
  vi.mocked(CatalogApi).mockImplementation(
    () => ({ searchComponents: vi.fn(impl) } as unknown as InstanceType<typeof CatalogApi>)
  );
}

function mockGetComponentInfo(impl: () => unknown) {
  vi.mocked(CatalogApi).mockImplementation(
    () => ({ getComponentInfo: vi.fn(impl) } as unknown as InstanceType<typeof CatalogApi>)
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ──────────────────────────────────────────────
// Tests: catalog list
// ──────────────────────────────────────────────

describe('handleCatalogList', () => {
  it('Scenario: List all components in a namespace — should return table output', async () => {
    mockListComponents(() => MOCK_COMPONENTS);

    const result = await handleCatalogList('to-be-continuous', defaultConfig);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('docker-build');
    expect(result.output).toContain('deploy-aws');
    expect(result.output).toContain('Name');
    expect(result.output).toContain('Version');
  });

  it('Scenario: List with JSON output', async () => {
    mockListComponents(() => MOCK_COMPONENTS);

    const result = await handleCatalogList('to-be-continuous', defaultConfig, { json: true });
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.output);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toHaveLength(2);
    expect(parsed.data[0]).toHaveProperty('name', 'docker-build');
    expect(parsed.data[0]).toHaveProperty('full_path');
    expect(parsed.data[0]).toHaveProperty('latest_tag');
  });

  it('Scenario: List with empty namespace', async () => {
    mockListComponents(() => []);

    const result = await handleCatalogList('empty-org', defaultConfig);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("No components found in namespace 'empty-org'");
  });

  it('Scenario: List with invalid namespace', async () => {
    mockListComponents(() => { throw new Error('Namespace not found: nonexistent-org'); });

    const result = await handleCatalogList('nonexistent-org', defaultConfig);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Error');
  });

  it('Scenario: List with pagination flags — should pass pagination params', async () => {
    mockListComponents(() => MOCK_COMPONENTS);

    // Verify listComponents was called with pagination
    await handleCatalogList('to-be-continuous', defaultConfig, { page: 2, perPage: 10 });

    const mockApi = vi.mocked(CatalogApi).mock.results[0].value;
    expect(mockApi.listComponents).toHaveBeenCalledWith('to-be-continuous', {
      page: 2,
      perPage: 10,
    });
  });
});

// ──────────────────────────────────────────────
// Tests: catalog search
// ──────────────────────────────────────────────

describe('handleCatalogSearch', () => {
  it('Scenario: Search by keyword — should return matching components', async () => {
    mockSearchComponents(() => MOCK_COMPONENTS);

    const result = await handleCatalogSearch('docker', defaultConfig);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('docker-build');
  });

  it('Scenario: Search with pagination', async () => {
    mockSearchComponents(() => MOCK_COMPONENTS);

    await handleCatalogSearch('test', defaultConfig, { page: 2, perPage: 10 });

    const mockApi = vi.mocked(CatalogApi).mock.results[0].value;
    expect(mockApi.searchComponents).toHaveBeenCalledWith('test', { page: 2, perPage: 10 });
  });

  it('Scenario: Search with no results', async () => {
    mockSearchComponents(() => []);

    const result = await handleCatalogSearch('zzzznonexistent', defaultConfig);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("No components matching 'zzzznonexistent'");
  });
});

// ──────────────────────────────────────────────
// Tests: catalog info
// ──────────────────────────────────────────────

describe('handleCatalogInfo', () => {
  it('Scenario: Show component info — should render detail', async () => {
    mockGetComponentInfo(() => MOCK_DETAIL);

    const result = await handleCatalogInfo('to-be-continuous/docker-build', defaultConfig);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('docker-build');
    expect(result.output).toContain('1.2.0');
    expect(result.output).toContain('Inputs');
    expect(result.output).toContain('Jobs');
  });

  it('Scenario: Show info for nonexistent component', async () => {
    const { NotFoundError } = await import('../types/api.js');
    mockGetComponentInfo(() => { throw new NotFoundError('nonexistent/component'); });

    const result = await handleCatalogInfo('nonexistent/component', defaultConfig);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("Component 'nonexistent/component' not found");
  });
});
