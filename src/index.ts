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
import {
  handleCatalogList,
  handleCatalogSearch,
  handleCatalogInfo,
} from './commands/catalog.js';
import {
  handleComponentSchema,
  handleComponentInputs,
  handleComponentWorkflows,
  handleComponentJobs,
} from './commands/component.js';
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

// ── catalog ──────────────────────────────────
const catalogCmd = program
  .command('catalog')
  .description('Browse GitLab CI/CD Catalog components');

catalogCmd
  .command('list')
  .description('List all catalog components in a namespace')
  .requiredOption('--org <namespace>', 'GitLab namespace or organization')
  .option('--json', 'Output as JSON')
  .option('--page <n>', 'Page number', parseInt)
  .option('--per-page <n>', 'Results per page', parseInt)
  .action(async (options: { org: string; json?: boolean; page?: number; perPage?: number }) => {
    const mergedConfig = overrideConfig({
      gitlabUrl: program.opts().gitlabUrl || undefined,
      token: program.opts().token || undefined,
    });

    const result = await handleCatalogList(options.org, mergedConfig, {
      json: options.json ?? false,
      page: options.page,
      perPage: options.perPage,
    });

    console.log(result.output);
    process.exit(result.exitCode);
  });

catalogCmd
  .command('search')
  .description('Search catalog components by keyword')
  .argument('<query>', 'Search keyword')
  .option('--json', 'Output as JSON')
  .option('--page <n>', 'Page number', parseInt)
  .option('--per-page <n>', 'Results per page', parseInt)
  .action(async (query: string, options: { json?: boolean; page?: number; perPage?: number }) => {
    const mergedConfig = overrideConfig({
      gitlabUrl: program.opts().gitlabUrl || undefined,
      token: program.opts().token || undefined,
    });

    const result = await handleCatalogSearch(query, mergedConfig, {
      json: options.json ?? false,
      page: options.page,
      perPage: options.perPage,
    });

    console.log(result.output);
    process.exit(result.exitCode);
  });

catalogCmd
  .command('info')
  .description('Show detailed information about a specific component')
  .argument('<full-path>', 'Full component path (e.g. to-be-continuous/docker-build)')
  .option('--json', 'Output as JSON')
  .action(async (fullPath: string, options: { json?: boolean }) => {
    const mergedConfig = overrideConfig({
      gitlabUrl: program.opts().gitlabUrl || undefined,
      token: program.opts().token || undefined,
    });

    const result = await handleCatalogInfo(fullPath, mergedConfig, {
      json: options.json ?? false,
    });

    console.log(result.output);
    process.exit(result.exitCode);
  });

// ── component ────────────────────────────────
const componentCmd = program
  .command('component')
  .description('Inspect GitLab CI/CD component schemas');

componentCmd
  .command('schema')
  .description('Get the complete YAML specification of a component')
  .argument('<full-path>', 'Full component path (e.g. to-be-continuous/docker-build)')
  .option('--version <version>', 'Specific version to fetch')
  .option('--output-file <path>', 'Save schema to file')
  .action(async (fullPath: string, options: { version?: string; outputFile?: string }) => {
    const mergedConfig = overrideConfig({
      gitlabUrl: program.opts().gitlabUrl || undefined,
      token: program.opts().token || undefined,
    });

    const result = await handleComponentSchema(fullPath, mergedConfig, {
      version: options.version,
      outputFile: options.outputFile,
    });

    console.log(result.output);
    process.exit(result.exitCode);
  });

componentCmd
  .command('inputs')
  .description('List all input parameters for a component')
  .argument('<full-path>', 'Full component path')
  .option('--json', 'Output as JSON')
  .action(async (fullPath: string, options: { json?: boolean }) => {
    const mergedConfig = overrideConfig({
      gitlabUrl: program.opts().gitlabUrl || undefined,
      token: program.opts().token || undefined,
    });

    const result = await handleComponentInputs(fullPath, mergedConfig, {
      json: options.json ?? false,
    });

    console.log(result.output);
    process.exit(result.exitCode);
  });

componentCmd
  .command('workflows')
  .description('List workflow definitions for a component')
  .argument('<full-path>', 'Full component path')
  .action(async (fullPath: string) => {
    const mergedConfig = overrideConfig({
      gitlabUrl: program.opts().gitlabUrl || undefined,
      token: program.opts().token || undefined,
    });

    const result = await handleComponentWorkflows(fullPath, mergedConfig);

    console.log(result.output);
    process.exit(result.exitCode);
  });

componentCmd
  .command('jobs')
  .description('List job definitions for a component')
  .argument('<full-path>', 'Full component path')
  .option('--with-artifacts', 'Show artifact dependency information')
  .action(async (fullPath: string, options: { withArtifacts?: boolean }) => {
    const mergedConfig = overrideConfig({
      gitlabUrl: program.opts().gitlabUrl || undefined,
      token: program.opts().token || undefined,
    });

    const result = await handleComponentJobs(fullPath, mergedConfig, {
      withArtifacts: options.withArtifacts ?? false,
    });

    console.log(result.output);
    process.exit(result.exitCode);
  });

// ── Parse ─────────────────────────────────────
program.parse(process.argv);
