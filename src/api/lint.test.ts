/**
 * Tests for the CI Lint API methods — covers 4 spec-delta scenarios.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LintApi } from './lint.js';
import { GitLabApiClient } from './gitlab.js';

// ──────────────────────────────────────────────
// Mock data
// ──────────────────────────────────────────────

const VALID_RESULT = {
  status: 'valid' as const,
  errors: [],
  warnings: [],
};

const INVALID_RESULT = {
  status: 'invalid' as const,
  errors: [
    { line: 3, column: 1, message: 'jobs config should contain at least one job' },
  ],
  warnings: [],
};

const WARNINGS_RESULT = {
  status: 'valid' as const,
  errors: [],
  warnings: [
    { line: 10, column: 5, message: 'job: build may be interrupted by a shutdown' },
  ],
};

const DRY_RUN_RESULT = {
  status: 'valid' as const,
  errors: [],
  warnings: [],
  jobs: [
    { name: 'build', stage: 'build', when: 'always', except_reason: null },
    { name: 'test', stage: 'test', when: 'never', except_reason: 'rules:except' },
  ],
  valid: true,
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

describe('LintApi', () => {
  describe('Scenario: Validate YAML content', () => {
    it('should send valid YAML to CI Lint API and get valid result', async () => {
      mockFetchResponse(VALID_RESULT);

      const api = new LintApi(createMockClient());
      const result = await api.validate('stages: [build]\nbuild:\n  script: echo hello');

      expect(result.status).toBe('valid');
      expect(result.errors).toHaveLength(0);

      // Verify POST request
      const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('/ci/lint');
      expect((opts as RequestInit).method).toBe('POST');

      const body = JSON.parse((opts as RequestInit).body as string);
      expect(body.content).toContain('stages: [build]');
    });
  });

  describe('Scenario: Validate invalid YAML', () => {
    it('should return errors for invalid YAML', async () => {
      mockFetchResponse(INVALID_RESULT);

      const api = new LintApi(createMockClient());
      const result = await api.validate('stages: [build]');

      expect(result.status).toBe('invalid');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toHaveProperty('line');
      expect(result.errors[0]).toHaveProperty('message');
    });
  });

  describe('Scenario: Validate with project context', () => {
    it('should use project-specific endpoint when project is specified', async () => {
      mockFetchResponse(VALID_RESULT);

      const api = new LintApi(createMockClient());
      await api.validate('stages: [build]', { project: 'my-group/my-project' });

      const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('/projects/my-group%2Fmy-project/ci/lint');
    });

    it('should include include_jobs when requested', async () => {
      mockFetchResponse(VALID_RESULT);

      const api = new LintApi(createMockClient());
      await api.validate('stages: [build]', { includeJobs: true });

      const [, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse((opts as RequestInit).body as string);
      expect(body.include_jobs).toBe(true);
    });
  });

  describe('Scenario: Validate with dry-run rules evaluation', () => {
    it('should send dry: true and return job execution info', async () => {
      mockFetchResponse(DRY_RUN_RESULT);

      const api = new LintApi(createMockClient());
      const result = await api.validate('stages: [build, test]\nbuild:\n  script: echo', {
        dryRun: true,
      });

      expect(result.valid).toBe(true);
      expect(result.jobs).toBeDefined();
      expect(result.jobs).toHaveLength(2);

      // Verify dry: true in request body
      const [, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse((opts as RequestInit).body as string);
      expect(body.dry).toBe(true);
    });
  });
});
