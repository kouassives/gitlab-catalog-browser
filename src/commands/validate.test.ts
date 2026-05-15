/**
 * Tests for validate command handlers — hybrid local + API validation.
 *
 * Scenarios covered:
 *   1. Valid pipeline — local + API
 *   2. Invalid pipeline — local + API
 *   3. Pipeline with warnings — local + API
 *   4. File not found
 *   5. Dry-run with rules evaluation — local + API
 *   6. Dry-run with simulated variables — local + API
 *   7. Validate with project context — local + API
 *   8. Validate with project includes — local + API
 *   9. Insufficient permissions — local + API fallback
 *  10. Validate piped content (stdin) — local + API
 *  11. Validate piped invalid content (stdin) — local + API
 *  12. Validate with --json output — local + API
 *  13. Local-only validation (no token) — local check only
 *  14. Local-only validation (no project) — local check only
 *  15. Invalid YAML syntax — local check catches it
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleValidate } from './validate.js';
import { PermissionError, ConfigurationError } from '../types/api.js';

// ──────────────────────────────────────────────
// Hoisted mocks
// ──────────────────────────────────────────────

const mockValidateFn = vi.hoisted(() => vi.fn());

const mockReadFileSync = vi.hoisted(() =>
  vi.fn().mockImplementation((_path: string) => {
    return `stages: [build, test]
build:
  script: echo hello
`;
  })
);

vi.mock('node:fs', () => ({
  readFileSync: mockReadFileSync,
}));

vi.mock('../api/lint.js', () => ({
  LintApi: vi.fn().mockImplementation(() => ({
    validate: mockValidateFn,
  })),
}));

// ──────────────────────────────────────────────
// Mock data
// ──────────────────────────────────────────────

const MOCK_VALID_RESULT = {
  valid: true,
  errors: [],
  warnings: [],
};

const MOCK_INVALID_RESULT = {
  valid: false,
  errors: [
    'jobs config should contain at least one job',
    'unknown key: blah',
  ],
  warnings: [],
};

const MOCK_WARNINGS_RESULT = {
  valid: true,
  errors: [],
  warnings: [
    'job: build may be interrupted by a shutdown',
  ],
};

const MOCK_DRY_RUN_RESULT = {
  valid: true,
  errors: [],
  warnings: [],
  jobs: [
    { name: 'build', stage: 'build', when: 'always', except_reason: null },
    { name: 'test', stage: 'test', when: 'never', except_reason: 'rules:except' },
    { name: 'deploy', stage: 'deploy', when: 'manual', except_reason: null },
  ],
};

// ──────────────────────────────────────────────
// Setup
// ──────────────────────────────────────────────

/** Config with token — enables API validation when project is also provided */
const configWithToken = { gitlabUrl: 'https://gitlab.com', token: 'glpat-test' };

/** Config without token — local-only validation */
const configNoToken = { gitlabUrl: 'https://gitlab.com' };

beforeEach(() => {
  mockValidateFn.mockReset();
  mockReadFileSync.mockReset();
  mockReadFileSync.mockImplementation((_path: string) => {
    return `stages: [build, test]
build:
  script: echo hello
`;
  });
});

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function mockStdin(content: string) {
  const chunks = [Buffer.from(content)];
  let i = 0;
  const iterator = {
    next: async (): Promise<IteratorResult<Buffer>> => {
      if (i >= chunks.length) return { done: true as const, value: undefined as unknown as Buffer };
      return { done: false as const, value: chunks[i++] };
    },
  };
  const mockStdinStream = {
    [Symbol.asyncIterator]: () => iterator,
  };
  return vi.spyOn(process, 'stdin', 'get').mockReturnValue(
    mockStdinStream as unknown as typeof process.stdin
  );
}

// ──────────────────────────────────────────────
// Scenario 1: Valid pipeline — local + API
// ──────────────────────────────────────────────

describe('Scenario: Valid pipeline file', () => {
  it('should report valid local + API and exit 0', async () => {
    mockValidateFn.mockResolvedValue(MOCK_VALID_RESULT);

    const result = await handleValidate('.gitlab-ci.yml', configWithToken, {
      project: 'my-group/my-project',
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('✓ YAML syntax: valid');
    expect(result.output).toContain('✓ Pipeline configuration is valid');
    expect(result.output).toContain('Project context: my-group/my-project');
    expect(mockValidateFn).toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────
// Scenario 2: Invalid pipeline — local + API
// ──────────────────────────────────────────────

describe('Scenario: Invalid pipeline file', () => {
  it('should show API errors with location and exit non-zero', async () => {
    mockValidateFn.mockResolvedValue(MOCK_INVALID_RESULT);

    const result = await handleValidate('.gitlab-ci.yml', configWithToken, {
      project: 'my-group/my-project',
    });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('✓ YAML syntax: valid');
    expect(result.output).toContain('✗ Pipeline configuration is invalid');
    expect(result.output).toContain('jobs config should contain at least one job');
    expect(result.output).toContain('unknown key: blah');
  });
});

// ──────────────────────────────────────────────
// Scenario 3: Pipeline with warnings
// ──────────────────────────────────────────────

describe('Scenario: Pipeline with warnings', () => {
  it('should report valid and list warnings separately', async () => {
    mockValidateFn.mockResolvedValue(MOCK_WARNINGS_RESULT);

    const result = await handleValidate('.gitlab-ci.yml', configWithToken, {
      project: 'my-group/my-project',
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('✓ YAML syntax: valid');
    expect(result.output).toContain('✓ Pipeline configuration is valid');
    expect(result.output).toContain('job: build may be interrupted by a shutdown');
  });
});

// ──────────────────────────────────────────────
// Scenario 4: File not found
// ──────────────────────────────────────────────

describe('Scenario: File not found', () => {
  it('should display error message and exit non-zero', async () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory');
    });

    const result = await handleValidate('nonexistent.yml', configWithToken);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("File 'nonexistent.yml' not found");
    expect(mockValidateFn).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────
// Scenario 5: Dry-run with rules evaluation
// ──────────────────────────────────────────────

describe('Scenario: Dry-run with rules evaluation', () => {
  it('should show which jobs would execute and why', async () => {
    mockValidateFn.mockResolvedValue(MOCK_DRY_RUN_RESULT);

    const result = await handleValidate('.gitlab-ci.yml', configWithToken, {
      project: 'my-group/my-project',
      dryRun: true,
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('✓ YAML syntax: valid');
    expect(result.output).toContain('✓ Pipeline configuration is valid');
    expect(result.output).toContain('Dry-run mode: rules evaluated');
    expect(result.output).toContain('Jobs:');
    expect(result.output).toContain('build');
    expect(result.output).toContain('test');
    expect(result.output).toContain('deploy');
    expect(result.output).toContain('rules:except');

    // Verify dryRun was passed to API
    expect(mockValidateFn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ dryRun: true })
    );
  });
});

// ──────────────────────────────────────────────
// Scenario 6: Dry-run with simulated variables
// ──────────────────────────────────────────────

describe('Scenario: Dry-run with simulated variables', () => {
  it('should pass variables to the API and show them in output', async () => {
    mockValidateFn.mockResolvedValue(MOCK_VALID_RESULT);

    const result = await handleValidate('.gitlab-ci.yml', configWithToken, {
      project: 'my-group/my-project',
      dryRun: true,
      vars: ['CI_PIPELINE_SOURCE=merge_request_event', 'CI_MERGE_REQUEST_ID=42'],
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('✓ YAML syntax: valid');
    expect(result.output).toContain('✓ Pipeline configuration is valid');

    // Verify variables were passed to the API
    expect(mockValidateFn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        variables: {
          CI_PIPELINE_SOURCE: 'merge_request_event',
          CI_MERGE_REQUEST_ID: '42',
        },
      })
    );
  });
});

// ──────────────────────────────────────────────
// Scenario 7: Validate with project context
// ──────────────────────────────────────────────

describe('Scenario: Validate with project context', () => {
  it('should pass project to API and show project context', async () => {
    mockValidateFn.mockResolvedValue(MOCK_VALID_RESULT);

    const result = await handleValidate('.gitlab-ci.yml', configWithToken, {
      project: 'my-group/my-project',
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Project context: my-group/my-project');

    expect(mockValidateFn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ project: 'my-group/my-project' })
    );
  });
});

// ──────────────────────────────────────────────
// Scenario 8: Validate with project includes
// ──────────────────────────────────────────────

describe('Scenario: Validate with project includes', () => {
  it('should resolve includes via project context', async () => {
    mockValidateFn.mockResolvedValue(MOCK_VALID_RESULT);

    await handleValidate('.gitlab-ci.yml', configWithToken, {
      project: 'my-group/my-project',
    });

    expect(mockValidateFn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ project: 'my-group/my-project' })
    );
  });
});

// ──────────────────────────────────────────────
// Scenario 9: Insufficient permissions
// ──────────────────────────────────────────────

describe('Scenario: Insufficient permissions', () => {
  it('should show local results + API auth error and exit 0 (local valid)', async () => {
    mockValidateFn.mockRejectedValue(
      new PermissionError('Insufficient permissions to access project private-group/private-project')
    );

    const result = await handleValidate('.gitlab-ci.yml', configWithToken, {
      project: 'private-group/private-project',
    });

    // Local check passes, so exit 0
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('✓ YAML syntax: valid');
    expect(result.output).toContain('Authentication failed');
  });
});

// ──────────────────────────────────────────────
// Scenario 10: Validate piped content (stdin)
// ──────────────────────────────────────────────

describe('Scenario: Validate piped content', () => {
  it('should read from stdin and validate content', async () => {
    mockValidateFn.mockResolvedValue(MOCK_VALID_RESULT);

    const stdinSpy = mockStdin(`stages: [build, test]
build:
  script: echo hello
`);
    const result = await handleValidate(undefined, configWithToken, {
      stdin: true,
      project: 'my-group/my-project',
    });
    stdinSpy.mockRestore();

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('✓ YAML syntax: valid');
    expect(result.output).toContain('✓ Pipeline configuration is valid');

    expect(mockValidateFn).toHaveBeenCalledWith(
      expect.stringContaining('stages: [build, test]'),
      expect.any(Object)
    );
  });
});

// ──────────────────────────────────────────────
// Scenario 11: Validate piped invalid content
// ──────────────────────────────────────────────

describe('Scenario: Validate piped invalid content via stdin', () => {
  it('should report invalid piped content', async () => {
    mockValidateFn.mockResolvedValue(MOCK_INVALID_RESULT);

    const stdinSpy = mockStdin(`stages: [build]
blah: true
`);
    const result = await handleValidate(undefined, configWithToken, {
      stdin: true,
      project: 'my-group/my-project',
    });
    stdinSpy.mockRestore();

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('✗ Pipeline configuration is invalid');
    expect(result.output).toContain('Errors:');
  });
});

// ──────────────────────────────────────────────
// Scenario 12: Validate with --json output
// ──────────────────────────────────────────────

describe('Scenario: Validate with --json output', () => {
  it('should return JSON for valid pipeline', async () => {
    mockValidateFn.mockResolvedValue(MOCK_VALID_RESULT);

    const result = await handleValidate('.gitlab-ci.yml', configWithToken, {
      project: 'my-group/my-project',
      json: true,
    });

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.output);
    expect(parsed.success).toBe(true);
    expect(parsed.local.status).toBe('valid');
    expect(parsed.api.status).toBe('valid');
    expect(parsed.api.errors).toEqual([]);
  });

  it('should return JSON for invalid pipeline', async () => {
    mockValidateFn.mockResolvedValue(MOCK_INVALID_RESULT);

    const result = await handleValidate('.gitlab-ci.yml', configWithToken, {
      project: 'my-group/my-project',
      json: true,
    });

    expect(result.exitCode).toBe(1);
    const parsed = JSON.parse(result.output);
    expect(parsed.success).toBe(false);
    expect(parsed.api.status).toBe('invalid');
    expect(parsed.api.errors).toHaveLength(2);
  });

  it('should return JSON when file not found', async () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory');
    });

    const result = await handleValidate('nonexistent.yml', configWithToken, { json: true });

    expect(result.exitCode).toBe(1);
    const parsed = JSON.parse(result.output);
    expect(parsed.success).toBe(false);
    expect(parsed.error.message).toContain("File 'nonexistent.yml' not found");
  });

  it('should return JSON with dry-run data', async () => {
    mockValidateFn.mockResolvedValue(MOCK_DRY_RUN_RESULT);

    const result = await handleValidate('.gitlab-ci.yml', configWithToken, {
      json: true,
      dryRun: true,
      project: 'my-group/my-project',
    });

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.output);
    expect(parsed.success).toBe(true);
    expect(parsed.api.jobs).toHaveLength(3);
    expect(parsed.api.context.dryRun).toBe(true);
    expect(parsed.api.context.project).toBe('my-group/my-project');
  });
});

// ──────────────────────────────────────────────
// Scenario 13: Local-only validation (no token)
// ──────────────────────────────────────────────

describe('Scenario: Local-only validation (no token)', () => {
  it('should validate locally and show setup hints', async () => {
    const result = await handleValidate('.gitlab-ci.yml', configNoToken, {
      project: 'my-group/my-project',
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('✓ YAML syntax: valid');
    expect(result.output).toContain('API validation not configured');
    expect(result.output).toContain('GITLAB_CI_CLI_TOKEN');
    expect(mockValidateFn).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────
// Scenario 14: Local-only validation (no project)
// ──────────────────────────────────────────────

describe('Scenario: Local-only validation (no project)', () => {
  it('should validate locally and show setup hints including --project', async () => {
    const result = await handleValidate('.gitlab-ci.yml', configWithToken);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('✓ YAML syntax: valid');
    expect(result.output).toContain('API validation not configured');
    expect(result.output).toContain('--project');
    expect(mockValidateFn).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────
// Scenario 15: Invalid YAML syntax
// ──────────────────────────────────────────────

describe('Scenario: Invalid YAML syntax', () => {
  it('should catch YAML parse errors locally', async () => {
    mockReadFileSync.mockReturnValue('stages: [build\n  script: echo'); // broken YAML

    const result = await handleValidate('.gitlab-ci.yml', configNoToken);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('✗ YAML syntax: invalid');
    expect(mockValidateFn).not.toHaveBeenCalled();
  });
});
