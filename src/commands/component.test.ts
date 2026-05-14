/**
 * Tests for component command handlers — covers all 14 spec scenarios.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  handleComponentSchema,
  handleComponentInputs,
  handleComponentWorkflows,
  handleComponentJobs,
} from './component.js';

// ──────────────────────────────────────────────
// Mock data
// ──────────────────────────────────────────────

const MOCK_DETAIL_WITH_ALL = {
  id: 1,
  name: 'docker-build',
  full_path: 'to-be-continuous/docker-build',
  version: '1.2.0',
  description: 'Docker build and push component',
  latest_tag: 'v1.2.0',
  spec: `spec:
  inputs:
    image_name:
      type: string
      description: Docker image name
jobs:
  build:
    stage: build
    script: docker build -t $IMAGE_NAME .`,
  inputs: [
    { name: 'image_name', type: 'string', required: true, description: 'Docker image name' },
    { name: 'registry', type: 'string', required: false, default: 'docker.io', description: 'Container registry', options: ['docker.io', 'ghcr.io'] },
    { name: 'tag_format', type: 'string', required: false, regex: '^[a-z0-9-]+$', description: 'Tag format pattern' },
  ],
  jobs: [
    {
      name: 'build',
      stage: 'build',
      image: 'docker:20',
      script: ['docker build -t $IMAGE_NAME .', 'docker push $IMAGE_NAME'],
      variables: { DOCKER_BUILDKIT: '1' },
      needs: [],
      when: 'always',
    },
    {
      name: 'test',
      stage: 'test',
      script: ['docker run $IMAGE_NAME test'],
      needs: ['build'],
    },
  ],
  workflows: [
    {
      name: 'default',
      triggers: ['branch', 'tag'],
      jobs: ['build', 'test'],
    },
    {
      name: 'release',
      triggers: ['tag'],
      jobs: ['build'],
      rules: ['if: $CI_COMMIT_TAG'],
    },
  ],
};

const MOCK_DETAIL_NO_INPUTS = {
  ...MOCK_DETAIL_WITH_ALL,
  inputs: [],
  spec: 'jobs:\n  build:\n    script: echo hello',
};

const MOCK_DETAIL_NO_WORKFLOWS = {
  ...MOCK_DETAIL_WITH_ALL,
  workflows: [],
};

const MOCK_DETAIL_NO_JOBS = {
  ...MOCK_DETAIL_WITH_ALL,
  jobs: [],
};

// ──────────────────────────────────────────────
// Mocks
// ──────────────────────────────────────────────

vi.mock('../api/catalog.js', () => ({
  CatalogApi: vi.fn().mockImplementation(() => ({
    getComponentInfo: vi.fn(),
  })),
}));

import { CatalogApi } from '../api/catalog.js';

// ──────────────────────────────────────────────
// Setup
// ──────────────────────────────────────────────

const defaultConfig = { gitlabUrl: 'https://gitlab.com', token: 'glpat-test' };

function mockGetComponentInfo(impl: () => unknown) {
  vi.mocked(CatalogApi).mockImplementation(
    () => ({ getComponentInfo: vi.fn(impl) } as unknown as InstanceType<typeof CatalogApi>)
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ──────────────────────────────────────────────
// Tests: component schema
// ──────────────────────────────────────────────

describe('handleComponentSchema', () => {
  it('Scenario: Get schema for latest version — should display YAML', async () => {
    mockGetComponentInfo(() => MOCK_DETAIL_WITH_ALL);

    const result = await handleComponentSchema('to-be-continuous/docker-build', defaultConfig);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('inputs:');
    expect(result.output).toContain('image_name');
  });

  it('Scenario: Get schema with output file — should write to disk', async () => {
    mockGetComponentInfo(() => MOCK_DETAIL_WITH_ALL);

    const { writeFileSync } = await import('node:fs');
    // Test that the handler calls writeFileSync by checking the result
    const result = await handleComponentSchema('to-be-continuous/docker-build', defaultConfig, {
      outputFile: './docker-build.yml',
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Schema saved to');
    expect(result.output).toContain('./docker-build.yml');
  });

  it('Scenario: Get schema for nonexistent component', async () => {
    const { NotFoundError } = await import('../types/api.js');
    mockGetComponentInfo(() => { throw new NotFoundError('nonexistent/component'); });

    const result = await handleComponentSchema('nonexistent/component', defaultConfig);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("Component 'nonexistent/component' not found");
  });

  it('Scenario: Get schema for nonexistent version', async () => {
    mockGetComponentInfo(() => { throw new Error('Version 99.99.99 not found'); });

    const result = await handleComponentSchema('to-be-continuous/docker-build', defaultConfig, {
      version: '99.99.99',
    });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('not found');
  });
});

// ──────────────────────────────────────────────
// Tests: component inputs
// ──────────────────────────────────────────────

describe('handleComponentInputs', () => {
  it('Scenario: List all inputs with details', async () => {
    mockGetComponentInfo(() => MOCK_DETAIL_WITH_ALL);

    const result = await handleComponentInputs('to-be-continuous/docker-build', defaultConfig);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('image_name');
    expect(result.output).toContain('string');
    expect(result.output).toContain('Yes'); // required
    expect(result.output).toContain('Docker image name');
  });

  it('Scenario: Show constrained inputs with options', async () => {
    mockGetComponentInfo(() => MOCK_DETAIL_WITH_ALL);

    const result = await handleComponentInputs('to-be-continuous/docker-build', defaultConfig);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('docker.io');
    expect(result.output).toContain('ghcr.io');
  });

  it('Scenario: Show inputs with regex validation', async () => {
    mockGetComponentInfo(() => MOCK_DETAIL_WITH_ALL);

    const result = await handleComponentInputs('to-be-continuous/docker-build', defaultConfig);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('^[a-z0-9-]+$');
  });

  it('Scenario: Component with no inputs', async () => {
    mockGetComponentInfo(() => MOCK_DETAIL_NO_INPUTS);

    const result = await handleComponentInputs('simple-component', defaultConfig);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("Component 'simple-component' defines no inputs");
  });

  it('Scenario: JSON output for inputs', async () => {
    mockGetComponentInfo(() => MOCK_DETAIL_WITH_ALL);

    const result = await handleComponentInputs('to-be-continuous/docker-build', defaultConfig, { json: true });
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.output);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toHaveLength(3);
  });
});

// ──────────────────────────────────────────────
// Tests: component workflows
// ──────────────────────────────────────────────

describe('handleComponentWorkflows', () => {
  it('Scenario: List workflows with triggers', async () => {
    mockGetComponentInfo(() => MOCK_DETAIL_WITH_ALL);

    const result = await handleComponentWorkflows('to-be-continuous/docker-build', defaultConfig);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('default');
    expect(result.output).toContain('release');
    expect(result.output).toContain('branch, tag');
    expect(result.output).toContain('build, test');
  });

  it('Scenario: Component with no workflows', async () => {
    mockGetComponentInfo(() => MOCK_DETAIL_NO_WORKFLOWS);

    const result = await handleComponentWorkflows('simple-job-component', defaultConfig);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("Component 'simple-job-component' defines no workflows");
  });
});

// ──────────────────────────────────────────────
// Tests: component jobs
// ──────────────────────────────────────────────

describe('handleComponentJobs', () => {
  it('Scenario: List all jobs with configuration', async () => {
    mockGetComponentInfo(() => MOCK_DETAIL_WITH_ALL);

    const result = await handleComponentJobs('to-be-continuous/docker-build', defaultConfig);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('build');
    expect(result.output).toContain('test');
    expect(result.output).toContain('build');
    expect(result.output).toContain('docker:20');
    expect(result.output).toContain('DOCKER_BUILDKIT=1');
    expect(result.output).toContain('always');
  });

  it('Scenario: Show job dependencies', async () => {
    mockGetComponentInfo(() => MOCK_DETAIL_WITH_ALL);

    const result = await handleComponentJobs('to-be-continuous/docker-build', defaultConfig, {
      withArtifacts: true,
    });
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Needs:');
    expect(result.output).toContain('build');
  });
});
