/**
 * Tests for batch command handler — covers 3 spec scenarios.
 *
 * Scenarios covered:
 *   1. Execute multiple commands in batch
 *   2. Batch with bail on first error
 *   3. Batch from stdin JSON
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleBatch } from './batch.js';

// ──────────────────────────────────────────────
// Hoisted mocks
// ──────────────────────────────────────────────

const mockExecSync = vi.hoisted(() => vi.fn());
const mockExistsSync = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', () => ({
  execSync: mockExecSync,
}));

vi.mock('node:fs', () => ({
  existsSync: mockExistsSync,
}));

// ──────────────────────────────────────────────
// Setup
// ──────────────────────────────────────────────

const defaultConfig = { gitlabUrl: 'https://gitlab.com', token: 'glpat-test' };

beforeEach(() => {
  vi.clearAllMocks();
  // By default, the CLI binary "exists"
  mockExistsSync.mockReturnValue(true);
  // By default, execSync succeeds
  mockExecSync.mockImplementation((_cmd: string) => {
    return 'Pipeline configuration is valid\n';
  });
});

// ──────────────────────────────────────────────
// Scenario 1: Execute multiple commands in batch
// ──────────────────────────────────────────────

describe('Scenario: Execute multiple commands in batch', () => {
  it('should execute each command in sequence and return combined results', async () => {
    const result = await handleBatch(
      ['validate .gitlab-ci.yml', 'catalog list --org test --json'],
      defaultConfig
    );

    expect(result.exitCode).toBe(0);
    expect(mockExecSync).toHaveBeenCalledTimes(2);
    expect(result.output).toContain('validate .gitlab-ci.yml');
    expect(result.output).toContain('catalog list --org test --json');
    expect(result.output).toContain('Total: 2');
    expect(result.output).toContain('Succeeded: 2');
    expect(result.output).toContain('Failed: 0');
  });

  it('should continue on failure when --bail is not set', async () => {
    // First command fails, second succeeds
    mockExecSync
      .mockImplementationOnce(() => {
        const err = new Error('Command failed') as Error & { status?: number; stdout?: string; stderr?: string };
        err.status = 1;
        err.stderr = 'Something went wrong';
        throw err;
      })
      .mockImplementationOnce(() => 'Success output');

    const result = await handleBatch(
      ['invalid-command', 'valid-command'],
      defaultConfig
    );

    expect(result.exitCode).toBe(1);
    expect(mockExecSync).toHaveBeenCalledTimes(2);
    expect(result.output).toContain('✗');
    expect(result.output).toContain('✓');
    expect(result.output).toContain('Failed: 1');
  });
});

// ──────────────────────────────────────────────
// Scenario 2: Batch with bail on first error
// ──────────────────────────────────────────────

describe('Scenario: Batch with bail on first error', () => {
  it('should stop at first failure when --bail is set', async () => {
    mockExecSync.mockImplementationOnce(() => {
      const err = new Error('First command failed') as Error & { status?: number; stdout?: string; stderr?: string };
      err.status = 1;
      err.stderr = 'Something went wrong';
      throw err;
    });

    const result = await handleBatch(
      ['failing-command', 'second-command'],
      defaultConfig,
      { bail: true }
    );

    expect(mockExecSync).toHaveBeenCalledTimes(1); // Only first command attempted
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('stopped early');
    expect(result.output).toContain('bail');
  });
});

// ──────────────────────────────────────────────
// Scenario 3: Batch from stdin JSON
// ──────────────────────────────────────────────

describe('Scenario: Batch from stdin JSON', () => {
  it('should read commands from stdin and execute them', async () => {
    // Mock stdin
    const stdinContent = JSON.stringify(['validate test.yml', 'catalog list --org test']);
    const chunks = [Buffer.from(stdinContent)];
    let i = 0;
    const stdinMock = {
      [Symbol.asyncIterator]: () => ({
        next: async (): Promise<IteratorResult<Buffer>> => {
          if (i >= chunks.length) return { done: true as const, value: undefined as unknown as Buffer };
          return { done: false as const, value: chunks[i++] };
        },
      }),
    };
    const stdinSpy = vi.spyOn(process, 'stdin', 'get').mockReturnValue(
      stdinMock as unknown as typeof process.stdin
    );

    const result = await handleBatch(undefined, defaultConfig, { json: true });
    stdinSpy.mockRestore();

    expect(result.exitCode).toBe(0);
    expect(mockExecSync).toHaveBeenCalledTimes(2);
    expect(result.output).toContain('validate test.yml');
    expect(result.output).toContain('catalog list --org test');
  });

  it('should handle empty stdin JSON array', async () => {
    const stdinContent = '[]';
    const stdinMock = {
      [Symbol.asyncIterator]: () => {
        let done = false;
        return {
          next: async () => {
            if (done) return { done: true as const, value: undefined as unknown as Buffer };
            done = true;
            return { done: false as const, value: Buffer.from(stdinContent) };
          },
        };
      },
    };
    const stdinSpy = vi.spyOn(process, 'stdin', 'get').mockReturnValue(
      stdinMock as unknown as typeof process.stdin
    );

    const result = await handleBatch(undefined, defaultConfig, { json: true });
    stdinSpy.mockRestore();

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.output);
    expect(parsed.summary.total).toBe(0);
  });
});

// ──────────────────────────────────────────────
// Edge cases
// ──────────────────────────────────────────────

describe('Edge cases', () => {
  it('should error when no commands provided (no stdin, no args)', async () => {
    const result = await handleBatch([], defaultConfig);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('No commands provided');
  });

  it('should wrap JSON output for errors', async () => {
    const result = await handleBatch([], defaultConfig, { json: true });

    expect(result.exitCode).toBe(1);
    const parsed = JSON.parse(result.output);
    expect(parsed.success).toBe(false);
  });
});
