/**
 * Tests for init command handler.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { handleInit, type InitOptions } from './setup.js';

const TEST_CONFIG_PATH = '/tmp/gitlab-ci-cli-init-test.json';

describe('handleInit', () => {
  beforeEach(() => {
    // Clean up any leftover test files
    try { unlinkSync(TEST_CONFIG_PATH); } catch { /* ok */ }
    try { unlinkSync(TEST_CONFIG_PATH + '.bak'); } catch { /* ok */ }
  });

  afterEach(() => {
    try { unlinkSync(TEST_CONFIG_PATH); } catch { /* ok */ }
    try { unlinkSync(TEST_CONFIG_PATH + '.bak'); } catch { /* ok */ }
  });

  it('should succeed with a valid Node.js version', () => {
    const result = handleInit();
    expect(result.exitCode).toBe(0);
    expect(result.messages.length).toBeGreaterThanOrEqual(2);
    expect(result.messages[0]).toContain('Node.js');
  });

  it('should fail when Node.js version is too old', () => {
    // Temporarily override process.version for this test
    const origVersion = Object.getOwnPropertyDescriptor(process, 'version');
    Object.defineProperty(process, 'version', { value: 'v16.0.0' });

    const result = handleInit();
    expect(result.exitCode).toBe(1);
    expect(result.messages[0]).toContain('18.0.0');

    // Restore
    if (origVersion) {
      Object.defineProperty(process, 'version', origVersion);
    }
  });

  it('should warn when config already exists without force', () => {
    // Create a pre-existing config at the default location
    const configPath = join(process.cwd(), '.gitlab-ci-cli.json');
    const existed = existsSync(configPath);

    if (!existed) {
      writeFileSync(configPath, '{"test": true}', 'utf-8');
    }

    const result = handleInit();
    expect(result.exitCode).toBe(0);
    expect(result.messages.some((m) => m.includes('already exists'))).toBe(true);

    if (!existed) {
      unlinkSync(configPath);
    }
  });

  it('should generate shell completion when requested', () => {
    const result = handleInit({ completion: 'bash' });
    expect(result.exitCode).toBe(0);
    expect(result.messages.some((m) => m.includes('completion'))).toBe(true);
  });

  it('should accept --force flag', () => {
    // Create a file first
    writeFileSync(TEST_CONFIG_PATH, '{"old": true}', 'utf-8');

    // We can't inject TEST_CONFIG_PATH into handleInit since it always uses CWD,
    // but we can verify the force path doesn't crash
    const result = handleInit({ force: true });
    expect(result.exitCode).toBe(0);
  });
});
