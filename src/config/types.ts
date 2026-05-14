/**
 * Configuration type definitions for gitlab-ci-cli.
 *
 * Defines the config shape, defaults, and type-safe accessors.
 */

// ──────────────────────────────────────────────
// Supported Configuration Keys
// ──────────────────────────────────────────────

export interface GitLabCIConfig {
  /** GitLab instance URL (default: https://gitlab.com) */
  gitlabUrl: string;

  /** GitLab personal access token */
  token?: string;

  /** Default project path for validation context */
  project?: string;

  /** API request timeout in milliseconds (default: 30000) */
  timeout: number;

  /** Default output format (default: 'table') */
  output: 'table' | 'json';
}

// ──────────────────────────────────────────────
// Defaults
// ──────────────────────────────────────────────

export const DEFAULT_CONFIG: GitLabCIConfig = {
  gitlabUrl: 'https://gitlab.com',
  timeout: 30000,
  output: 'table',
} as const;

// ──────────────────────────────────────────────
// Config Source Tracking
// ──────────────────────────────────────────────

export type ConfigSource = 'default' | 'user-file' | 'project-file' | 'env-var' | 'cli-flag';

export interface ConfigEntry<T> {
  value: T;
  source: ConfigSource;
}

export interface ResolvedConfig {
  config: GitLabCIConfig;
  /** Per-key source tracking for debugging */
  sources: Record<keyof GitLabCIConfig, ConfigSource>;
  /** List of warnings generated during loading (e.g. invalid JSON) */
  warnings: string[];
}

// ──────────────────────────────────────────────
// Environment Variable Mapping
// ──────────────────────────────────────────────

/**
 * Maps environment variable names to config keys.
 * Each tuple is [envVarName, configKey, parser?].
 */
export const ENV_VAR_MAP: Array<{
  envVar: string;
  key: keyof GitLabCIConfig;
  parse?: (raw: string) => unknown;
}> = [
  { envVar: 'GITLAB_CI_CLI_URL', key: 'gitlabUrl' },
  { envVar: 'GITLAB_CI_CLI_TOKEN', key: 'token' },
  { envVar: 'GITLAB_CI_CLI_PROJECT', key: 'project' },
  {
    envVar: 'GITLAB_CI_CLI_TIMEOUT',
    key: 'timeout',
    parse: (raw: string): number => {
      const n = parseInt(raw, 10);
      if (isNaN(n) || n <= 0) throw new Error(`Invalid timeout value: ${raw}`);
      return n;
    },
  },
  {
    envVar: 'GITLAB_CI_CLI_OUTPUT',
    key: 'output',
    parse: (raw: string): 'table' | 'json' => {
      if (raw !== 'table' && raw !== 'json') throw new Error(`Invalid output format: ${raw}. Must be 'table' or 'json'`);
      return raw;
    },
  },
];

// ──────────────────────────────────────────────
// Config file schema
// ──────────────────────────────────────────────

/**
 * Shape of the raw config file (with optional $schema field).
 */
export interface RawConfigFile extends Partial<GitLabCIConfig> {
  $schema?: string;
}
