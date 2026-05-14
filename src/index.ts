#!/usr/bin/env node

/**
 * gitlab-catalog-browser — CLI entry point
 *
 * Main entry point for the `gitlab-ci-cli` command.
 * Registers all commands using Commander.js.
 * Loads configuration at startup and makes it available to all commands.
 */

import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  handleInit,
  handleUpgrade,
  handleDoctor,
  detectShell,
  type InitOptions,
  type UpgradeOptions,
  type DoctorOptions,
} from './commands/setup.js';
import { loadConfig } from './config/loader.js';
import type { GitLabCIConfig } from './config/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadPackageVersion(): string {
  try {
    const pkgPath = join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

// Load configuration at startup — this reads config files, env vars, etc.
// CLI flags will override these values later in individual command handlers.
const cliConfig: GitLabCIConfig = loadConfig();

// Utility: merge CLI flag overrides into the loaded config
function overrideConfig(overrides: Partial<GitLabCIConfig>): GitLabCIConfig {
  return { ...cliConfig, ...overrides };
}

const program = new Command();

program
  .name('gitlab-ci-cli')
  .description('CLI tool for browsing the GitLab CI/CD Catalog and managing pipelines')
  .version(loadPackageVersion());

// ── Global options ───────────────────────────
// These can be used with any command
program
  .option('--gitlab-url <url>', 'GitLab instance URL')
  .option('--token <token>', 'GitLab personal access token');

// ── init ──────────────────────────────────────
program
  .command('init')
  .description('Initialize project configuration and verify environment')
  .option('--force', 'Overwrite existing configuration file')
  .option('--completion <shell>', 'Generate shell completion script (bash|zsh)')
  .action(async (options: { force?: boolean; completion?: string }) => {
    const initOptions: InitOptions = { force: options.force };

    if (options.completion) {
      const shell = options.completion.toLowerCase();
      if (shell !== 'bash' && shell !== 'zsh') {
        console.error(`Unsupported shell: ${options.completion}. Use 'bash' or 'zsh'.`);
        process.exit(1);
      }
      initOptions.completion = shell as 'bash' | 'zsh';
    }

    const result = handleInit(initOptions);
    for (const msg of result.messages) {
      console.log(msg);
    }
    process.exit(result.exitCode);
  });

// ── upgrade ───────────────────────────────────
program
  .command('upgrade')
  .description('Check for and apply CLI upgrades from the npm registry')
  .option('--dry-run', 'Check for upgrades without applying them')
  .action(async (options: { dryRun?: boolean }) => {
    const upgradeOptions: UpgradeOptions = { dryRun: options.dryRun ?? false };
    const result = await handleUpgrade(upgradeOptions);
    for (const msg of result.messages) {
      console.log(msg);
    }
    process.exit(result.exitCode);
  });

// ── doctor ────────────────────────────────────
program
  .command('doctor')
  .description('Run comprehensive environment diagnostics')
  .option('--json', 'Output results in JSON format')
  .action(async (options: { json?: boolean }) => {
    // Use loaded config, allowing CLI flags to override
    const mergedConfig = overrideConfig({
      gitlabUrl: program.opts().gitlabUrl || undefined,
      token: program.opts().token || undefined,
    });

    const doctorOptions: DoctorOptions = {
      json: options.json ?? false,
      gitlabUrl: mergedConfig.gitlabUrl,
      token: mergedConfig.token,
    };

    const result = await handleDoctor(doctorOptions);

    if (doctorOptions.json) {
      console.log(JSON.stringify(result.report, null, 2));
    } else {
      for (const check of result.report.checks) {
        const icon = check.status === 'pass' ? '✓' : '✗';
        console.log(`${icon} ${check.name}: ${check.message}`);
      }
      console.log('');
      console.log(
        result.report.summary.failed === 0
          ? 'All checks passed'
          : `${result.report.summary.failed} check(s) failed`
      );
    }

    process.exit(result.exitCode);
  });

// ── Parse ─────────────────────────────────────
program.parse(process.argv);
