/**
 * Setup commands: init, upgrade, doctor
 *
 * Shared utilities and handlers for CLI environment management.
 */

import { readFileSync, existsSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

export const MIN_NODE_VERSION = '18.0.0';
export const PACKAGE_NAME = 'gitlab-catalog-browser';
export const NPM_REGISTRY_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/latest`;
const CONFIG_FILENAME = '.gitlab-ci-cli.json';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface DoctorCheck {
  name: string;
  status: 'pass' | 'fail';
  message: string;
}

export interface DoctorReport {
  success: boolean;
  checks: DoctorCheck[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

export interface UpgradeInfo {
  currentVersion: string;
  latestVersion: string | null;
  upgradeAvailable: boolean;
  error?: string;
}

// ──────────────────────────────────────────────
// Node.js version utilities
// ──────────────────────────────────────────────

/**
 * Parse a semver version string into its components.
 */
export function parseVersion(version: string): { major: number; minor: number; patch: number } {
  const cleaned = version.replace(/^v/, '').split('-')[0]; // strip 'v' prefix and pre-release
  const parts = cleaned.split('.').map(Number);
  return {
    major: parts[0] ?? 0,
    minor: parts[1] ?? 0,
    patch: parts[2] ?? 0,
  };
}

/**
 * Compare two semver version strings.
 * Returns -1 if v1 < v2, 0 if equal, 1 if v1 > v2.
 */
export function compareVersions(v1: string, v2: string): -1 | 0 | 1 {
  const a = parseVersion(v1);
  const b = parseVersion(v2);

  if (a.major !== b.major) return a.major > b.major ? 1 : -1;
  if (a.minor !== b.minor) return a.minor > b.minor ? 1 : -1;
  if (a.patch !== b.patch) return a.patch > b.patch ? 1 : -1;
  return 0;
}

/**
 * Check if the current Node.js version meets the minimum requirement.
 */
export function checkNodeVersion(
  current: string = process.version,
  minimum: string = MIN_NODE_VERSION
): { ok: boolean; current: string; minimum: string } {
  return {
    ok: compareVersions(current, minimum) >= 0,
    current,
    minimum,
  };
}

// ──────────────────────────────────────────────
// npm registry utilities
// ──────────────────────────────────────────────

/**
 * Fetch the latest version of the package from the npm registry.
 * Returns null if the registry is unreachable.
 */
export async function fetchLatestVersion(
  registryUrl: string = NPM_REGISTRY_URL
): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(registryUrl, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { version?: string };
    return data.version ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Get the current installed version from package.json.
 */
export function getCurrentVersion(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const packagePath = join(dirname(__filename), '..', '..', 'package.json');
    const pkg = JSON.parse(readFileSync(packagePath, 'utf-8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

// ──────────────────────────────────────────────
// Shell detection
// ──────────────────────────────────────────────

export type ShellType = 'bash' | 'zsh' | 'unknown';

/**
 * Detect the user's shell from the SHELL environment variable.
 */
export function detectShell(): ShellType {
  const shell = process.env.SHELL ?? '';
  if (shell.includes('zsh')) return 'zsh';
  if (shell.includes('bash')) return 'bash';
  return 'unknown';
}

// ──────────────────────────────────────────────
// Configuration file utilities
// ──────────────────────────────────────────────

const DEFAULT_CONFIG = {
  $schema: 'https://gitlab-catalog-browser.dev/schema.json',
  gitlabUrl: 'https://gitlab.com',
  timeout: 30000,
  output: 'table',
} as const;

/**
 * Find the project config file path (searches from CWD upward).
 */
export function findConfigPath(startDir: string = process.cwd()): string | null {
  const candidates = [
    join(startDir, CONFIG_FILENAME),
    join(homedir(), CONFIG_FILENAME),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  return null;
}

/**
 * Generate default config content.
 */
export function generateDefaultConfig(): string {
  return JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n';
}

/**
 * Create a default config file at the given path.
 * Returns the path if created, or null if it already exists (unless force).
 */
export function createDefaultConfig(
  targetPath: string = join(process.cwd(), CONFIG_FILENAME),
  force: boolean = false
): { created: boolean; path: string; error?: string } {
  if (existsSync(targetPath)) {
    if (!force) {
      return { created: false, path: targetPath, error: 'already exists' };
    }
    // Backup existing
    const backupPath = targetPath + '.bak';
    copyFileSync(targetPath, backupPath);
  }

  writeFileSync(targetPath, generateDefaultConfig(), 'utf-8');
  return { created: true, path: targetPath };
}

// ──────────────────────────────────────────────
// Shell completion
// ──────────────────────────────────────────────

/**
 * Generate shell completion script for the given shell type.
 */
export function generateCompletionScript(shell: ShellType): string {
  if (shell === 'bash') {
    return `# gitlab-ci-cli bash completion
_gitlab_ci_cli_completions() {
  local cur prev words cword
  COMPREPLY=()
  cur="$\{COMP_WORDS[COMP_CWORD]}"
  prev="$\{COMP_WORDS[COMP_CWORD-1]}"
  commands="catalog component validate pipeline skills init upgrade doctor"
  COMPREPLY=($(compgen -W "$commands" -- "$cur"))
}
complete -F _gitlab_ci_cli_completions gitlab-ci-cli
`;
  }

  if (shell === 'zsh') {
    return `#compdef gitlab-ci-cli
_gitlab_ci_cli() {
  local -a commands
  commands=(
    'catalog:Browse GitLab CI/CD Catalog'
    'component:Inspect component schemas'
    'validate:Validate .gitlab-ci.yml files'
    'pipeline:Analyze pipeline structure'
    'skills:Manage agent skill content'
    'init:Initialize project configuration'
    'upgrade:Upgrade the CLI tool'
    'doctor:Diagnose installation health'
  )
  _describe 'command' commands
}
compdef _gitlab_ci_cli gitlab-ci-cli
`;
  }

  return `# Shell completion not available for ${shell}`;
}

// ──────────────────────────────────────────────
// Init command
// ──────────────────────────────────────────────

export interface InitOptions {
  force?: boolean;
  completion?: ShellType;
}

/**
 * Handle the `init` command.
 */
export function handleInit(options: InitOptions = {}): {
  exitCode: number;
  messages: string[];
} {
  const messages: string[] = [];

  // 1. Check Node.js version
  const nodeCheck = checkNodeVersion();
  if (!nodeCheck.ok) {
    messages.push(
      `✗ Node.js ${nodeCheck.minimum} or later is required (found: ${nodeCheck.current})`
    );
    return { exitCode: 1, messages };
  }
  messages.push(`✓ Node.js ${nodeCheck.current}`);

  // 2. Create default config
  const configPath = join(process.cwd(), CONFIG_FILENAME);
  const configResult = createDefaultConfig(configPath, options.force ?? false);

  if (configResult.created) {
    messages.push(`✓ Created configuration file: ${configResult.path}`);
  } else if (configResult.error === 'already exists') {
    messages.push(`→ Configuration file already exists: ${configResult.path}`);
    messages.push('  Use --force to overwrite');
  }

  // 3. Shell completion
  if (options.completion) {
    const script = generateCompletionScript(options.completion);
    const completionTarget = join(homedir(), `.gitlab-ci-cli-completion.${options.completion}`);
    writeFileSync(completionTarget, script, 'utf-8');
    messages.push(`✓ Shell completion script generated for ${options.completion}`);
    messages.push(`  Source it with: source ${completionTarget}`);
    if (options.completion === 'bash') {
      messages.push('  Or add to ~/.bashrc: source ' + completionTarget);
    } else if (options.completion === 'zsh') {
      messages.push('  Or add to ~/.zshrc: source ' + completionTarget);
    }
  }

  return { exitCode: 0, messages };
}

// ──────────────────────────────────────────────
// Upgrade command
// ──────────────────────────────────────────────

export interface UpgradeOptions {
  dryRun?: boolean;
}

/**
 * Handle the `upgrade` command.
 */
export async function handleUpgrade(
  options: UpgradeOptions = {}
): Promise<{ exitCode: number; messages: string[]; info: UpgradeInfo }> {
  const messages: string[] = [];
  const currentVersion = getCurrentVersion();

  messages.push(`Current version: v${currentVersion}`);

  const latestVersion = await fetchLatestVersion();

  if (!latestVersion) {
    messages.push('⚠ Could not check for latest version (network issue)');
    return {
      exitCode: 1,
      messages,
      info: { currentVersion, latestVersion: null, upgradeAvailable: false, error: 'Network error' },
    };
  }

  const upgradeAvailable = compareVersions(latestVersion, currentVersion) > 0;

  if (!upgradeAvailable) {
    messages.push(`✓ Already up-to-date (v${currentVersion})`);
    return {
      exitCode: 0,
      messages,
      info: { currentVersion, latestVersion, upgradeAvailable: false },
    };
  }

  messages.push(`→ Latest version: v${latestVersion}`);
  messages.push(`→ Upgrade available: v${currentVersion} → v${latestVersion}`);

  if (options.dryRun) {
    messages.push(`(dry-run) Run: npm install -g ${PACKAGE_NAME}@latest`);
    return {
      exitCode: 0,
      messages,
      info: { currentVersion, latestVersion, upgradeAvailable },
    };
  }

  // Execute upgrade
  try {
    execSync(`npm install -g ${PACKAGE_NAME}@latest`, {
      stdio: 'pipe',
      timeout: 60000,
    });
    messages.push(`✓ Successfully upgraded to v${latestVersion}`);
    return {
      exitCode: 0,
      messages,
      info: { currentVersion, latestVersion, upgradeAvailable },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    messages.push(`✗ Upgrade failed: ${errorMessage}`);
    return {
      exitCode: 1,
      messages,
      info: { currentVersion, latestVersion, upgradeAvailable, error: errorMessage },
    };
  }
}

// ──────────────────────────────────────────────
// Doctor command
// ──────────────────────────────────────────────

export interface DoctorOptions {
  json?: boolean;
  gitlabUrl?: string;
  token?: string;
}

/**
 * Perform a single doctor check.
 */
function check(name: string, ok: boolean, message: string): DoctorCheck {
  return { name, status: ok ? 'pass' : 'fail', message };
}

/**
 * Handle the `doctor` command.
 */
export async function handleDoctor(
  options: DoctorOptions = {}
): Promise<{ exitCode: number; report: DoctorReport }> {
  const checks: DoctorCheck[] = [];

  // 1. Node.js version check
  const nodeCheck = checkNodeVersion();
  checks.push(
    check(
      'Node.js Version',
      nodeCheck.ok,
      nodeCheck.ok
        ? `Node.js ${nodeCheck.current}`
        : `Node.js ${nodeCheck.minimum} or later required (found: ${nodeCheck.current})`
    )
  );

  // 2. Config file check
  const configPath = findConfigPath();
  if (configPath) {
    try {
      const content = readFileSync(configPath, 'utf-8');
      JSON.parse(content);
      checks.push(check('Configuration File', true, `Valid config at ${configPath}`));
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : 'Invalid JSON';
      checks.push(check('Configuration File', false, `Invalid config at ${configPath}: ${msg}`));
    }
  } else {
    checks.push(check('Configuration File', true, 'No config file found (defaults will be used)'));
  }

  // 3. GitLab API connectivity
  const gitlabUrl = options.gitlabUrl ?? 'https://gitlab.com';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${gitlabUrl}/api/v4/version`, {
      signal: controller.signal,
      headers: options.token ? { Authorization: `Bearer ${options.token}` } : {},
    });
    if (response.ok) {
      checks.push(check('GitLab API Connectivity', true, `Connected to ${gitlabUrl}`));
    } else if (response.status === 401 || response.status === 403) {
      checks.push(
        check('GitLab API Connectivity', true, `Reached ${gitlabUrl} (but token may need checking)`)
      );
    } else {
      checks.push(
        check(
          'GitLab API Connectivity',
          false,
          `HTTP ${response.status} from ${gitlabUrl}`
        )
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    checks.push(
      check('GitLab API Connectivity', false, `Cannot reach ${gitlabUrl}: ${msg}`)
    );
  } finally {
    clearTimeout(timeout);
  }

  // 4. Token validity
  if (options.token) {
    const tokenController = new AbortController();
    const tokenTimeout = setTimeout(() => tokenController.abort(), 10000);

    try {
      const tokenResponse = await fetch(`${gitlabUrl}/api/v4/user`, {
        signal: tokenController.signal,
        headers: { Authorization: `Bearer ${options.token}` },
      });
      if (tokenResponse.ok) {
        const userData = (await tokenResponse.json()) as { name?: string; username?: string };
        checks.push(
          check(
            'GitLab Token',
            true,
            `Authenticated as ${userData.name ?? userData.username ?? 'unknown'}`
          )
        );
      } else if (tokenResponse.status === 401) {
        checks.push(
          check('GitLab Token', false, 'Token rejected (HTTP 401) — may be expired or invalid')
        );
      } else {
        checks.push(
          check(
            'GitLab Token',
            false,
            `Token check returned HTTP ${tokenResponse.status}`
          )
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      checks.push(
        check('GitLab Token', false, `Cannot validate token: ${msg}`)
      );
    } finally {
      clearTimeout(tokenTimeout);
    }
  } else {
    checks.push(
      check('GitLab Token', true, 'No token configured (public operations only)')
    );
  }

  // Compile report
  const passed = checks.filter((c) => c.status === 'pass').length;
  const failed = checks.filter((c) => c.status === 'fail').length;

  const report: DoctorReport = {
    success: failed === 0,
    checks,
    summary: { total: checks.length, passed, failed },
  };

  return { exitCode: report.success ? 0 : 1, report };
}
