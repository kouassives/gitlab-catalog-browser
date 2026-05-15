/**
 * Tests for config loader — covers all 9 config specification scenarios.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';

// Mock fs and os modules before importing the loader
vi.mock('node:fs');
vi.mock('node:os');

import fs from 'node:fs';
import os from 'node:os';
import {
  readConfigFile,
  loadProjectConfig,
  loadUserConfig,
  loadConfigFiles,
  mergeConfigs,
  readEnvOverrides,
  getConfig,
  loadConfig,
} from './loader.js';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const VALID_CONFIG = JSON.stringify({
  gitlabUrl: 'https://gitlab.example.com',
  token: 'glpat-test123',
  timeout: 15000,
  output: 'json',
});

const USER_CONFIG = JSON.stringify({
  gitlabUrl: 'https://gitlab.com',
  timeout: 30000,
});

const PROJECT_CONFIG = JSON.stringify({
  gitlabUrl: 'https://gitlab.example.com',
  timeout: 15000,
  output: 'json',
});

function mockExists(val: boolean) {
  vi.mocked(fs.existsSync).mockReturnValue(val);
}

function mockReadFile(content: string) {
  vi.mocked(fs.readFileSync).mockReturnValue(content);
}

function mockHomedir(dir: string = '/home/testuser') {
  vi.mocked(os.homedir).mockReturnValue(dir);
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();
  mockHomedir();
  // Default: no env vars set
  vi.stubEnv('GITLAB_CI_CLI_URL', '');
  vi.stubEnv('GITLAB_CI_CLI_TOKEN', '');
  vi.stubEnv('GITLAB_CI_CLI_PROJECT', '');
  vi.stubEnv('GITLAB_CI_CLI_TIMEOUT', '');
  vi.stubEnv('GITLAB_CI_CLI_OUTPUT', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ── readConfigFile ────────────────────────────

describe('readConfigFile', () => {
  it('should return null if file does not exist', () => {
    mockExists(false);
    expect(readConfigFile('/nonexistent/config.json')).toBeNull();
  });

  it('should parse and return config, stripping $schema', () => {
    mockExists(true);
    mockReadFile(JSON.stringify({ $schema: 'schema.json', gitlabUrl: 'https://gitlab.com' }));
    const result = readConfigFile('/some/config.json');
    expect(result).toEqual({ gitlabUrl: 'https://gitlab.com' });
    expect(result).not.toHaveProperty('$schema');
  });

  it('should return error string on invalid JSON', () => {
    mockExists(true);
    mockReadFile('{ invalid json }');
    const result = readConfigFile('/bad/config.json');
    expect(typeof result).toBe('string');
    expect(result as string).toContain('ERROR:');
    expect(result as string).toContain('Invalid JSON');
  });
});

// ── loadProjectConfig / loadUserConfig ───────

describe('loadProjectConfig', () => {
  it('should load config from project directory', () => {
    mockExists(true);
    mockReadFile(VALID_CONFIG);
    const result = loadProjectConfig('/some/project');
    expect(result).toBeTruthy();
    expect(result?.gitlabUrl).toBe('https://gitlab.example.com');
    // Verify the correct path was checked
    expect(fs.existsSync).toHaveBeenCalledWith('/some/project/.gitlab-catalog-browser.json');
  });

  it('should return null if project config does not exist', () => {
    mockExists(false);
    expect(loadProjectConfig('/empty/project')).toBeNull();
  });
});

describe('loadUserConfig', () => {
  it('should load config from home directory', () => {
    mockHomedir('/home/testuser');
    mockExists(true);
    mockReadFile(VALID_CONFIG);
    const result = loadUserConfig();
    expect(result).toBeTruthy();
    expect(fs.existsSync).toHaveBeenCalledWith('/home/testuser/.gitlab-catalog-browser.json');
  });

  it('should return null if user config does not exist', () => {
    mockExists(false);
    expect(loadUserConfig()).toBeNull();
  });
});

// ── loadConfigFiles ──────────────────────────

describe('loadConfigFiles', () => {
  it('should load both user and project configs', () => {
    // First call (user): exists
    // Second call (project): exists
    vi.mocked(fs.existsSync)
      .mockReturnValueOnce(true)  // user
      .mockReturnValueOnce(true); // project
    vi.mocked(fs.readFileSync)
      .mockReturnValueOnce(USER_CONFIG)
      .mockReturnValueOnce(PROJECT_CONFIG);

    const result = loadConfigFiles();
    expect(result.user?.gitlabUrl).toBe('https://gitlab.com');
    expect(result.project?.gitlabUrl).toBe('https://gitlab.example.com');
  });

  it('should return nulls when no configs exist', () => {
    mockExists(false);
    const result = loadConfigFiles();
    expect(result.user).toBeNull();
    expect(result.project).toBeNull();
  });

  it('should handle user config existing without project config', () => {
    vi.mocked(fs.existsSync)
      .mockReturnValueOnce(true)   // user exists
      .mockReturnValueOnce(false); // project does not
    vi.mocked(fs.readFileSync).mockReturnValueOnce(USER_CONFIG);

    const result = loadConfigFiles();
    expect(result.user).toBeTruthy();
    expect(result.project).toBeNull();
  });
});

// ── mergeConfigs ─────────────────────────────

describe('mergeConfigs', () => {
  it('should overlay project config on top of user config', () => {
    const user = { gitlabUrl: 'https://gitlab.com', output: 'table' as const };
    const project = { gitlabUrl: 'https://gitlab.example.com' };
    const merged = mergeConfigs(user, project);
    expect(merged).toEqual({
      gitlabUrl: 'https://gitlab.example.com',
      output: 'table',
    });
  });

  it('should handle empty overrides', () => {
    const base = { gitlabUrl: 'https://gitlab.com', timeout: 30000 };
    const merged = mergeConfigs(base, {});
    expect(merged).toEqual(base);
  });
});

// ── readEnvOverrides ─────────────────────────

describe('readEnvOverrides', () => {
  it('should read GITLAB_CI_CLI_URL and GITLAB_CI_CLI_TOKEN', () => {
    vi.stubEnv('GITLAB_CI_CLI_URL', 'https://gitlab.example.com');
    vi.stubEnv('GITLAB_CI_CLI_TOKEN', 'glpat-env-token');

    const { overrides, warnings } = readEnvOverrides();
    expect(overrides.gitlabUrl).toBe('https://gitlab.example.com');
    expect(overrides.token).toBe('glpat-env-token');
    expect(warnings).toHaveLength(0);
  });

  it('should parse timeout as number', () => {
    vi.stubEnv('GITLAB_CI_CLI_TIMEOUT', '5000');
    const { overrides, warnings } = readEnvOverrides();
    expect(overrides.timeout).toBe(5000);
    expect(warnings).toHaveLength(0);
  });

  it('should warn on invalid timeout value', () => {
    vi.stubEnv('GITLAB_CI_CLI_TIMEOUT', 'not-a-number');
    const { overrides, warnings } = readEnvOverrides();
    expect(overrides.timeout).toBeUndefined();
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain('GITLAB_CI_CLI_TIMEOUT');
  });

  it('should validate output format', () => {
    vi.stubEnv('GITLAB_CI_CLI_OUTPUT', 'invalid');
    const { warnings } = readEnvOverrides();
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain('GITLAB_CI_CLI_OUTPUT');
  });

  it('should skip unset environment variables', () => {
    const { overrides, warnings } = readEnvOverrides();
    expect(Object.keys(overrides)).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });
});

// ── getConfig (full chain) ───────────────────

describe('getConfig - full precedence chain', () => {
  it('Scenario: No configuration files exist — should use defaults', () => {
    mockExists(false); // neither user nor project config
    const result = getConfig();
    expect(result.config.gitlabUrl).toBe('https://gitlab.com');
    expect(result.config.timeout).toBe(30000);
    expect(result.config.output).toBe('table');
    expect(result.config.token).toBeUndefined();
  });

  it('Scenario: Load project configuration', () => {
    // Only project config exists
    vi.mocked(fs.existsSync)
      .mockReturnValueOnce(false) // user
      .mockReturnValueOnce(true); // project
    vi.mocked(fs.readFileSync).mockReturnValueOnce(PROJECT_CONFIG);

    const result = getConfig();
    expect(result.config.gitlabUrl).toBe('https://gitlab.example.com');
    expect(result.config.timeout).toBe(15000);
    expect(result.config.output).toBe('json');
    expect(result.sources.gitlabUrl).toBe('project-file');
  });

  it('Scenario: Load user configuration', () => {
    // Only user config exists
    vi.mocked(fs.existsSync)
      .mockReturnValueOnce(true)  // user
      .mockReturnValueOnce(false); // project
    vi.mocked(fs.readFileSync).mockReturnValueOnce(USER_CONFIG);

    const result = getConfig();
    expect(result.config.gitlabUrl).toBe('https://gitlab.com');
    expect(result.config.timeout).toBe(30000);
    expect(result.sources.gitlabUrl).toBe('user-file');
  });

  it('Scenario: Merge user and project configuration', () => {
    vi.mocked(fs.existsSync)
      .mockReturnValueOnce(true)  // user
      .mockReturnValueOnce(true); // project
    vi.mocked(fs.readFileSync)
      .mockReturnValueOnce(JSON.stringify({ gitlabUrl: 'https://old.instance.com', timeout: 10000 }))
      .mockReturnValueOnce(JSON.stringify({ gitlabUrl: 'https://new.instance.com' }));

    const result = getConfig();
    expect(result.config.gitlabUrl).toBe('https://new.instance.com'); // project wins
    expect(result.config.timeout).toBe(10000); // unchanged from user
    expect(result.sources.gitlabUrl).toBe('project-file');
    expect(result.sources.timeout).toBe('user-file');
  });

  it('Scenario: Config file with invalid JSON — should warn and continue with defaults', () => {
    vi.mocked(fs.existsSync)
      .mockReturnValueOnce(true)  // user exists but invalid
      .mockReturnValueOnce(false);
    vi.mocked(fs.readFileSync).mockReturnValue('{ invalid json }');

    const result = getConfig();
    expect(result.config.gitlabUrl).toBe('https://gitlab.com'); // default
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('Invalid JSON');
  });

  it('Scenario: All supported keys', () => {
    const fullConfig = JSON.stringify({
      gitlabUrl: 'https://gitlab.custom.com',
      token: 'glpat-custom',
      project: 'my-group/my-project',
      timeout: 5000,
      output: 'json',
    });

    vi.mocked(fs.existsSync)
      .mockReturnValueOnce(false) // user
      .mockReturnValueOnce(true); // project
    vi.mocked(fs.readFileSync).mockReturnValueOnce(fullConfig);

    const result = getConfig();
    expect(result.config.gitlabUrl).toBe('https://gitlab.custom.com');
    expect(result.config.token).toBe('glpat-custom');
    expect(result.config.project).toBe('my-group/my-project');
    expect(result.config.timeout).toBe(5000);
    expect(result.config.output).toBe('json');
  });

  it('Scenario: Unrecognized keys silently ignored', () => {
    const configWithExtra = JSON.stringify({
      gitlabUrl: 'https://gitlab.com',
      unknownKey: 'should-be-ignored',
      anotherOne: true,
    });

    vi.mocked(fs.existsSync)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    vi.mocked(fs.readFileSync).mockReturnValueOnce(configWithExtra);

    const result = getConfig();
    expect(result.config.gitlabUrl).toBe('https://gitlab.com');
    expect((result.config as Record<string, unknown>).unknownKey).toBeUndefined();
    expect((result.config as Record<string, unknown>).anotherOne).toBeUndefined();
  });

  it('Scenario: Environment variable overrides file config', () => {
    vi.stubEnv('GITLAB_CI_CLI_URL', 'https://env-override.com');
    vi.stubEnv('GITLAB_CI_CLI_TOKEN', 'glpat-env');

    vi.mocked(fs.existsSync)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    vi.mocked(fs.readFileSync).mockReturnValueOnce(
      JSON.stringify({ gitlabUrl: 'https://file-config.com' })
    );

    const result = getConfig();
    expect(result.config.gitlabUrl).toBe('https://env-override.com'); // env wins
    expect(result.config.token).toBe('glpat-env');
    expect(result.sources.gitlabUrl).toBe('env-var');
    expect(result.sources.token).toBe('env-var');
  });

  it('Scenario: Falls back to GITLAB_TOKEN when no GITLAB_CI_CLI_TOKEN', () => {
    vi.stubEnv('GITLAB_CI_CLI_TOKEN', '');  // unset
    vi.stubEnv('GITLAB_TOKEN', 'glpat-fallback');

    mockExists(false);
    const result = getConfig();

    expect(result.config.token).toBe('glpat-fallback');
    expect(result.sources.token).toBe('env-var');
  });

  it('Scenario: GITLAB_CI_CLI_TOKEN takes priority over GITLAB_TOKEN', () => {
    vi.stubEnv('GITLAB_CI_CLI_TOKEN', 'glpat-primary');
    vi.stubEnv('GITLAB_TOKEN', 'glpat-fallback');

    mockExists(false);
    const result = getConfig();

    expect(result.config.token).toBe('glpat-primary'); // primary wins
  });

  it('Scenario: Full precedence chain — CLI flags win', () => {
    vi.stubEnv('GITLAB_CI_CLI_URL', 'https://env-override.com');

    vi.mocked(fs.existsSync)
      .mockReturnValueOnce(true)  // user
      .mockReturnValueOnce(true); // project
    vi.mocked(fs.readFileSync)
      .mockReturnValueOnce(JSON.stringify({ gitlabUrl: 'https://user-config.com' }))
      .mockReturnValueOnce(JSON.stringify({ gitlabUrl: 'https://project-config.com' }));

    const result = getConfig({ gitlabUrl: 'https://cli-flag.com' });
    expect(result.config.gitlabUrl).toBe('https://cli-flag.com'); // CLI flag wins
    expect(result.sources.gitlabUrl).toBe('cli-flag');
  });

  it('Scenario: CLI flags without file configs', () => {
    mockExists(false);
    const result = getConfig({ gitlabUrl: 'https://cli-only.com', token: 'glpat-cli' });
    expect(result.config.gitlabUrl).toBe('https://cli-only.com');
    expect(result.config.token).toBe('glpat-cli');
    expect(result.sources.gitlabUrl).toBe('cli-flag');
    expect(result.sources.token).toBe('cli-flag');
  });
});

// ── loadConfig convenience wrapper ───────────

describe('loadConfig', () => {
  it('should return plain config without source tracking', () => {
    mockExists(false);
    const config = loadConfig();
    expect(config).toEqual({
      gitlabUrl: 'https://gitlab.com',
      timeout: 30000,
      output: 'table',
    });
    expect(config).not.toHaveProperty('sources');
    expect(config).not.toHaveProperty('warnings');
  });
});
