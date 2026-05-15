/**
 * Configuration loader for gitlab-catalog-browser.
 *
 * Loads configuration from multiple sources with proper precedence:
 *   1. User config file  (~/.gitlab-catalog-browser.json)   — lowest priority
 *   2. Project config file (./.gitlab-catalog-browser.json)  — overrides user
 *   3. Environment variables (GITLAB_CI_CLI_*)      — overrides files
 *   4. CLI flags                                     — highest priority
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import {
  type GitLabCIConfig,
  type ResolvedConfig,
  type ConfigSource,
  type RawConfigFile,
  DEFAULT_CONFIG,
  ENV_VAR_MAP,
} from './types.js';

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const CONFIG_FILENAME = '.gitlab-catalog-browser.json';

/**
 * Known config keys (including optional ones like `token`, `project`).
 * Used to check key membership instead of `in config` since optional
 * keys may not be present in the default config object.
 */
export const CONFIG_KEYS: Array<keyof GitLabCIConfig> = [
  'gitlabUrl',
  'token',
  'project',
  'timeout',
  'output',
];

// ──────────────────────────────────────────────
// File loading
// ──────────────────────────────────────────────

/**
 * Read and parse a JSON config file.
 * Returns null if the file doesn't exist.
 * Returns a string error message prefixed with 'ERROR:' if the JSON is invalid.
 */
export function readConfigFile(filePath: string): RawConfigFile | null | string {
  if (!existsSync(filePath)) return null;
  const raw = readFileSync(filePath, 'utf-8');
  try {
    const parsed = JSON.parse(raw) as RawConfigFile;
    // Strip $schema before treating as config
    if (parsed.$schema) {
      delete parsed.$schema;
    }
    return parsed;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `ERROR: Invalid JSON in ${filePath}: ${msg}`;
  }
}

/**
 * Safely parse a config file result, returning the parsed config or null.
 * If the result is an error string, it's returned as a warning.
 */
function parseFileResult(
  result: RawConfigFile | null | string
): { config: RawConfigFile | null; warning: string | null } {
  if (result === null) return { config: null, warning: null };
  if (typeof result === 'string') {
    return { config: null, warning: result };
  }
  return { config: result, warning: null };
}

/**
 * Find and load a config file for the given directory.
 * Returns null if no config file exists.
 * Returns a warning string prefixed with 'ERROR:' if invalid JSON.
 */
export function loadProjectConfig(startDir: string = process.cwd()): RawConfigFile | null | string {
  const projectPath = join(startDir, CONFIG_FILENAME);
  return readConfigFile(projectPath);
}

/**
 * Load the user-level config file from the home directory.
 * Returns null if no config file exists.
 * Returns a warning string prefixed with 'ERROR:' if invalid JSON.
 */
export function loadUserConfig(): RawConfigFile | null | string {
  const userPath = join(homedir(), CONFIG_FILENAME);
  return readConfigFile(userPath);
}

/**
 * Load both user and project config files.
 * Returns [userConfig, projectConfig] where each may be null or an error string.
 */
export function loadConfigFiles(): { user: RawConfigFile | null | string; project: RawConfigFile | null | string } {
  return {
    user: loadUserConfig(),
    project: loadProjectConfig(),
  };
}

// ──────────────────────────────────────────────
// Merging
// ──────────────────────────────────────────────

/**
 * Merge two config objects.
 * Project-level values override user-level values.
 */
export function mergeConfigs(
  base: Partial<GitLabCIConfig>,
  override: Partial<GitLabCIConfig>
): Partial<GitLabCIConfig> {
  return { ...base, ...override };
}

// ──────────────────────────────────────────────
// Environment variable overrides
// ──────────────────────────────────────────────

/**
 * Read environment variables and apply overrides.
 * Returns a partial config with only the env-overridden keys.
 */
export function readEnvOverrides(): {
  overrides: Partial<GitLabCIConfig>;
  warnings: string[];
} {
  const overrides: Partial<GitLabCIConfig> = {};
  const warnings: string[] = [];

  for (const mapping of ENV_VAR_MAP) {
    const raw = process.env[mapping.envVar];
    if (raw === undefined || raw === '') continue;

    try {
      const value = mapping.parse ? mapping.parse(raw) : raw;
      (overrides as Record<string, unknown>)[mapping.key] = value;
    } catch (err) {
      warnings.push(
        `Warning: ${mapping.envVar}=${raw} could not be parsed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return { overrides, warnings };
}

// ──────────────────────────────────────────────
// CLI flag overrides
// ──────────────────────────────────────────────

export interface CliFlagOverrides {
  gitlabUrl?: string;
  token?: string;
  project?: string;
  timeout?: number;
  output?: 'table' | 'json';
}

// ──────────────────────────────────────────────
// Full resolution
// ──────────────────────────────────────────────

/**
 * Build the full configuration by applying the precedence chain:
 *   1. Start with defaults
 *   2. Overlay user config file
 *   3. Overlay project config file
 *   4. Overlay environment variables
 *   5. Overlay CLI flags
 *
 * Returns a ResolvedConfig with source tracking and warnings.
 */
export function getConfig(cliFlags?: CliFlagOverrides): ResolvedConfig {
  const warnings: string[] = [];
  const sources: Record<string, ConfigSource> = {};

  // Track the source of each config key as we go
  const track = (key: keyof GitLabCIConfig, source: ConfigSource) => {
    sources[key] = source;
  };

  // 1. Start with defaults
  const config: GitLabCIConfig = { ...DEFAULT_CONFIG };
  for (const key of Object.keys(DEFAULT_CONFIG) as Array<keyof GitLabCIConfig>) {
    track(key, 'default');
  }

  // 2. Load config files
  const files = loadConfigFiles();

  // Process user config
  const userResult = parseFileResult(files.user);
  if (userResult.warning) {
    warnings.push(userResult.warning.replace('ERROR:', 'Warning:'));
  }
  if (userResult.config) {
    for (const [key, value] of Object.entries(userResult.config)) {
      if (value !== undefined && CONFIG_KEYS.includes(key as keyof GitLabCIConfig)) {
        (config as unknown as Record<string, unknown>)[key] = value;
        track(key as keyof GitLabCIConfig, 'user-file');
      }
    }
  }

  // Process project config
  const projectResult = parseFileResult(files.project);
  if (projectResult.warning) {
    warnings.push(projectResult.warning.replace('ERROR:', 'Warning:'));
  }
  if (projectResult.config) {
    for (const [key, value] of Object.entries(projectResult.config)) {
      if (value !== undefined && CONFIG_KEYS.includes(key as keyof GitLabCIConfig)) {
        (config as unknown as Record<string, unknown>)[key] = value;
        track(key as keyof GitLabCIConfig, 'project-file');
      }
    }
  }

  // 3. Environment variables
  const { overrides: envOverrides, warnings: envWarnings } = readEnvOverrides();
  warnings.push(...envWarnings);
  for (const [key, value] of Object.entries(envOverrides)) {
    if (value !== undefined && CONFIG_KEYS.includes(key as keyof GitLabCIConfig)) {
      (config as unknown as Record<string, unknown>)[key] = value;
      track(key as keyof GitLabCIConfig, 'env-var');
    }
  }

  // Fallback token discovery: only used when no token was configured through
  // normal channels (file, GITLAB_CI_CLI_TOKEN, or --token).
  // This allows auto-detection from common GitLab env vars without
  // overriding explicit user configuration.
  if (!config.token) {
    const fallbackTokenVars = ['GITLAB_TOKEN', 'CI_JOB_TOKEN'];
    for (const envVar of fallbackTokenVars) {
      const raw = process.env[envVar];
      if (raw && raw !== '') {
        config.token = raw;
        track('token', 'env-var');
        break;
      }
    }
  }

  // 4. CLI flags
  if (cliFlags) {
    for (const [key, value] of Object.entries(cliFlags)) {
      if (value !== undefined && CONFIG_KEYS.includes(key as keyof GitLabCIConfig)) {
        (config as unknown as Record<string, unknown>)[key] = value;
        track(key as keyof GitLabCIConfig, 'cli-flag');
      }
    }
  }

  return {
    config: config as GitLabCIConfig,
    sources: sources as Record<keyof GitLabCIConfig, ConfigSource>,
    warnings,
  };
}

// ──────────────────────────────────────────────
// Convenience: load and get a specific config value
// ──────────────────────────────────────────────

/**
 * Quick access to the resolved config for cases where
 * full ResolvedConfig tracking is not needed.
 * Wraps getConfig() and returns just the config object.
 */
export function loadConfig(cliFlags?: CliFlagOverrides): GitLabCIConfig {
  return getConfig(cliFlags).config;
}
