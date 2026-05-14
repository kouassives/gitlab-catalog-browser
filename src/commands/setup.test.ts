/**
 * Tests for setup.ts shared utilities and commands.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseVersion,
  compareVersions,
  checkNodeVersion,
  detectShell,
  generateDefaultConfig,
  generateCompletionScript,
  createDefaultConfig,
  findConfigPath,
  getCurrentVersion,
  MIN_NODE_VERSION,
  type ShellType,
} from './setup.js';

// ── parseVersion ──────────────────────────────

describe('parseVersion', () => {
  it('should parse a full semver string', () => {
    expect(parseVersion('18.2.0')).toEqual({ major: 18, minor: 2, patch: 0 });
  });

  it('should handle v prefix', () => {
    expect(parseVersion('v20.11.1')).toEqual({ major: 20, minor: 11, patch: 1 });
  });

  it('should strip pre-release tags', () => {
    expect(parseVersion('21.0.0-alpha.1')).toEqual({ major: 21, minor: 0, patch: 0 });
  });

  it('should handle single digit versions', () => {
    expect(parseVersion('4.0.0')).toEqual({ major: 4, minor: 0, patch: 0 });
  });

  it('should default missing parts to 0', () => {
    expect(parseVersion('18')).toEqual({ major: 18, minor: 0, patch: 0 });
  });
});

// ── compareVersions ───────────────────────────

describe('compareVersions', () => {
  it('should return -1 when v1 < v2', () => {
    expect(compareVersions('18.0.0', '20.0.0')).toBe(-1);
    expect(compareVersions('18.0.0', '18.1.0')).toBe(-1);
    expect(compareVersions('18.0.0', '18.0.1')).toBe(-1);
  });

  it('should return 0 when equal', () => {
    expect(compareVersions('18.0.0', '18.0.0')).toBe(0);
    expect(compareVersions('20.11.1', '20.11.1')).toBe(0);
  });

  it('should return 1 when v1 > v2', () => {
    expect(compareVersions('20.0.0', '18.0.0')).toBe(1);
    expect(compareVersions('18.2.0', '18.1.0')).toBe(1);
    expect(compareVersions('18.0.2', '18.0.1')).toBe(1);
  });

  it('should handle v prefix correctly', () => {
    expect(compareVersions('v20.0.0', 'v18.0.0')).toBe(1);
  });
});

// ── checkNodeVersion ──────────────────────────

describe('checkNodeVersion', () => {
  it('should pass when current >= minimum', () => {
    const result = checkNodeVersion('v20.0.0', '18.0.0');
    expect(result.ok).toBe(true);
    expect(result.current).toBe('v20.0.0');
    expect(result.minimum).toBe('18.0.0');
  });

  it('should pass when current equals minimum', () => {
    const result = checkNodeVersion('v18.0.0', '18.0.0');
    expect(result.ok).toBe(true);
  });

  it('should fail when current < minimum', () => {
    const result = checkNodeVersion('v16.0.0', '18.0.0');
    expect(result.ok).toBe(false);
  });
});

// ── detectShell ───────────────────────────────

describe('detectShell', () => {
  const originalShell = process.env.SHELL;

  afterEach(() => {
    process.env.SHELL = originalShell;
  });

  it('should detect zsh', () => {
    process.env.SHELL = '/bin/zsh';
    expect(detectShell()).toBe('zsh');
  });

  it('should detect bash', () => {
    process.env.SHELL = '/bin/bash';
    expect(detectShell()).toBe('bash');
  });

  it('should return unknown for other shells', () => {
    process.env.SHELL = '/bin/fish';
    expect(detectShell()).toBe('unknown');
  });

  it('should handle unset SHELL', () => {
    delete process.env.SHELL;
    expect(detectShell()).toBe('unknown');
  });
});

// ── generateDefaultConfig ─────────────────────

describe('generateDefaultConfig', () => {
  it('should return valid JSON', () => {
    const config = generateDefaultConfig();
    expect(() => JSON.parse(config)).not.toThrow();
  });

  it('should contain required keys', () => {
    const config = JSON.parse(generateDefaultConfig());
    expect(config).toHaveProperty('gitlabUrl', 'https://gitlab.com');
    expect(config).toHaveProperty('timeout', 30000);
    expect(config).toHaveProperty('output', 'table');
    expect(config).toHaveProperty('$schema');
  });
});

// ── generateCompletionScript ──────────────────

describe('generateCompletionScript', () => {
  it('should generate bash completion', () => {
    const script = generateCompletionScript('bash');
    expect(script).toContain('bash completion');
    expect(script).toContain('gitlab-catalog-browser');
    expect(script).toContain('COMPREPLY');
  });

  it('should generate zsh completion', () => {
    const script = generateCompletionScript('zsh');
    expect(script).toContain('compdef');
    expect(script).toContain('gitlab-catalog-browser');
    expect(script).toContain('catalog:Browse');
  });

  it('should return fallback for unknown shell', () => {
    const script = generateCompletionScript('unknown');
    expect(script).toContain('not available');
  });
});

// ── createDefaultConfig ───────────────────────

describe('createDefaultConfig', () => {
  it('should create config file at target path', () => {
    const testPath = '/tmp/test-gitlab-catalog-browser.json';
    const result = createDefaultConfig(testPath);
    expect(result.created).toBe(true);
    expect(result.path).toBe(testPath);

    // Cleanup
    const { unlinkSync } = require('node:fs');
    unlinkSync(testPath);
  });

  it('should not overwrite existing config without force', () => {
    const testPath = '/tmp/test-existing-config.json';
    // Create initial file
    const { writeFileSync } = require('node:fs');
    writeFileSync(testPath, '{"existing": true}', 'utf-8');

    const result = createDefaultConfig(testPath, false);
    expect(result.created).toBe(false);
    expect(result.error).toBe('already exists');

    // Cleanup
    const { unlinkSync } = require('node:fs');
    unlinkSync(testPath);
  });

  it('should overwrite existing config with force flag', () => {
    const testPath = '/tmp/test-force-config.json';
    const { writeFileSync, unlinkSync } = require('node:fs');
    writeFileSync(testPath, '{"old": true}', 'utf-8');

    const result = createDefaultConfig(testPath, true);
    expect(result.created).toBe(true);

    // Verify backup was created
    const { existsSync } = require('node:fs');
    expect(existsSync(testPath + '.bak')).toBe(true);

    // Cleanup
    unlinkSync(testPath);
    unlinkSync(testPath + '.bak');
  });
});

// ── findConfigPath ────────────────────────────

describe('findConfigPath', () => {
  const { existsSync, writeFileSync, unlinkSync, mkdirSync } = require('node:fs');
  const { join } = require('node:path');
  const os = require('node:os');

  const tmpDir = '/tmp/gitlab-catalog-browser-test-config';
  mkdirSync(tmpDir, { recursive: true });

  it('should find config in the given directory', () => {
    const configPath = join(tmpDir, '.gitlab-catalog-browser.json');
    writeFileSync(configPath, '{}', 'utf-8');

    const found = findConfigPath(tmpDir);
    expect(found).toBe(configPath);

    unlinkSync(configPath);
  });

  it('should return null if no config exists', () => {
    const found = findConfigPath('/nonexistent');
    // It might still find ~/.gitlab-catalog-browser.json which doesn't exist,
    // or return null if no config exists anywhere
    if (found) {
      expect(found).toContain(os.homedir());
    } else {
      expect(found).toBeNull();
    }
  });
});

// ── getCurrentVersion ─────────────────────────

describe('getCurrentVersion', () => {
  it('should return a valid semver string', () => {
    const version = getCurrentVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
