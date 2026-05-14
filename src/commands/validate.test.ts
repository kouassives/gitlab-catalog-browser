/**
 * Tests for validate command handlers — covers all 12 spec scenarios.
 *
 * Scenarios covered:
 *   1. Valid pipeline file
 *   2. Invalid pipeline file
 *   3. Pipeline with warnings
 *   4. File not found
 *   5. Dry-run with rules evaluation
 *   6. Dry-run with simulated variables
 *   7. Validate with project variables
 *   8. Validate with project includes
 *   9. Insufficient permissions
 *  10. Validate piped content (stdin)
 *  11. Validate piped invalid content (stdin)
 *  12. Validate with --json output
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleValidate } from './validate.js';
import { PermissionError } from '../types/api.js';

// ──────────────────────────────────────────────
// Hoisted mocks — these are available at module
// import time because vi.mock is hoisted.
// ──────────────────────────────────────────────

const mockValidateFn = vi.hoisted(() => vi.fn());

const mockReadFileSync = vi.hoisted(() =>
  vi.fn().mockImplementation((_path: string) => {
    // Default: return valid YAML for any path
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
  status: 'valid' as const,
  errors: [],
  warnings: [],
};

const MOCK_INVALID_RESULT = {
  status: 'invalid' as const,
  errors: [
    { line: 3, column: 1, message: 'jobs config should contain at least one job' },
    { line: 5, column: 3, message: 'unknown key: blah' },
  ],
  warnings: [],
};

const MOCK_WARNINGS_RESULT = {
  status: 'valid' as const,
  errors: [],
  warnings: [
    { line: 10, column: 5, message: 'job: build may be interrupted by a shutdown' },
  ],
};

const MOCK_DRY_RUN_RESULT = {
  status: 'valid' as const,
  errors: [],
  warnings: [],
  jobs: [
    { name: 'build', stage: 'build', when: 'always', except_reason: null },
    { name: 'test', stage: 'test', when: 'never', except_reason: 'rules:except' },
    { name: 'deploy', stage: 'deploy', when: 'manual', except_reason: null },
  ],
  valid: true,
};

// ──────────────────────────────────────────────
// Setup
// ──────────────────────────────────────────────

const defaultConfig = { gitlabUrl: 'https://gitlab.com', token: 'glpat-test' };

beforeEach(() => {
  mockValidateFn.mockReset();
  mockReadFileSync.mockReset();
  // Default readFileSync: return valid YAML for any path
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

/**
 * Mock process.stdin for stdin tests.
 */
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
// Scenario 1: Valid pipeline file
// ──────────────────────────────────────────────

describe('Scenario: Valid pipeline file', () => {
  it('should report valid configuration and exit 0', async () => {
    mockValidateFn.mockResolvedValue(MOCK_VALID_RESULT);

    const result = await handleValidate('.gitlab-ci.yml', defaultConfig);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Pipeline configuration is valid');
    expect(mockValidateFn).toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────
// Scenario 2: Invalid pipeline file
// ──────────────────────────────────────────────

describe('Scenario: Invalid pipeline file', () => {
  it('should show errors with location and exit non-zero', async () => {
    mockValidateFn.mockResolvedValue(MOCK_INVALID_RESULT);

    const result = await handleValidate('.gitlab-ci.yml', defaultConfig);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Pipeline configuration is invalid');
    expect(result.output).toContain('Errors:');
    expect(result.output).toContain('Line 3, col 1');
    expect(result.output).toContain('jobs config should contain at least one job');
    expect(result.output).toContain('Line 5, col 3');
    expect(result.output).toContain('unknown key: blah');
  });
});

// ──────────────────────────────────────────────
// Scenario 3: Pipeline with warnings
// ──────────────────────────────────────────────

describe('Scenario: Pipeline with warnings', () => {
  it('should report valid and list warnings separately', async () => {
    mockValidateFn.mockResolvedValue(MOCK_WARNINGS_RESULT);

    const result = await handleValidate('.gitlab-ci.yml', defaultConfig);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Pipeline configuration is valid');
    expect(result.output).toContain('Warnings:');
    expect(result.output).toContain('Line 10, col 5');
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

    const result = await handleValidate('nonexistent.yml', defaultConfig);

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

    const result = await handleValidate('.gitlab-ci.yml', defaultConfig, {
      dryRun: true,
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Pipeline configuration is valid');
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

    const result = await handleValidate('.gitlab-ci.yml', defaultConfig, {
      dryRun: true,
      vars: ['CI_PIPELINE_SOURCE=merge_request_event', 'CI_MERGE_REQUEST_ID=42'],
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Simulated variables');
    expect(result.output).toContain('CI_PIPELINE_SOURCE=merge_request_event');
    expect(result.output).toContain('CI_MERGE_REQUEST_ID=42');

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
// Scenario 7: Validate with project variables
// ──────────────────────────────────────────────

describe('Scenario: Validate with project context', () => {
  it('should pass project to API and show project context', async () => {
    mockValidateFn.mockResolvedValue(MOCK_VALID_RESULT);

    const result = await handleValidate('.gitlab-ci.yml', defaultConfig, {
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

    await handleValidate('.gitlab-ci.yml', defaultConfig, {
      project: 'my-group/my-project',
    });

    // Verify the API call includes the project context
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
  it('should display permission error and exit non-zero', async () => {
    mockValidateFn.mockRejectedValue(
      new PermissionError('Insufficient permissions to access project private-group/private-project')
    );

    const result = await handleValidate('.gitlab-ci.yml', defaultConfig, {
      project: 'private-group/private-project',
    });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("Insufficient permissions to access project 'private-group/private-project'");
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
    const result = await handleValidate(undefined, defaultConfig, { stdin: true });
    stdinSpy.mockRestore();

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Pipeline configuration is valid');
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
    const result = await handleValidate(undefined, defaultConfig, { stdin: true });
    stdinSpy.mockRestore();

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Pipeline configuration is invalid');
    expect(result.output).toContain('Errors:');
  });
});

// ──────────────────────────────────────────────
// Scenario 12: Validate with --json output
// ──────────────────────────────────────────────

describe('Scenario: Validate with --json output', () => {
  it('should return JSON for valid pipeline', async () => {
    mockValidateFn.mockResolvedValue(MOCK_VALID_RESULT);

    const result = await handleValidate('.gitlab-ci.yml', defaultConfig, { json: true });

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.output);
    expect(parsed.success).toBe(true);
    expect(parsed.status).toBe('valid');
    expect(parsed.errors).toEqual([]);
  });

  it('should return JSON for invalid pipeline', async () => {
    mockValidateFn.mockResolvedValue(MOCK_INVALID_RESULT);

    const result = await handleValidate('.gitlab-ci.yml', defaultConfig, { json: true });

    expect(result.exitCode).toBe(1);
    const parsed = JSON.parse(result.output);
    expect(parsed.success).toBe(false);
    expect(parsed.status).toBe('invalid');
    expect(parsed.errors).toHaveLength(2);
  });

  it('should return JSON when file not found', async () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory');
    });

    const result = await handleValidate('nonexistent.yml', defaultConfig, { json: true });

    expect(result.exitCode).toBe(1);
    const parsed = JSON.parse(result.output);
    expect(parsed.success).toBe(false);
    expect(parsed.error.message).toContain("File 'nonexistent.yml' not found");
  });

  it('should return JSON with dry-run data', async () => {
    mockValidateFn.mockResolvedValue(MOCK_DRY_RUN_RESULT);

    const result = await handleValidate('.gitlab-ci.yml', defaultConfig, {
      json: true,
      dryRun: true,
      project: 'my-group/my-project',
    });

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.output);
    expect(parsed.success).toBe(true);
    expect(parsed.jobs).toHaveLength(3);
    expect(parsed.context.dryRun).toBe(true);
    expect(parsed.context.project).toBe('my-group/my-project');
  });
});
