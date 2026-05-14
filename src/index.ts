#!/usr/bin/env node

/**
 * gitlab-catalog-browser — CLI entry point
 *
 * Main entry point for the `gitlab-catalog-browser` command.
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
import { handleValidate } from './commands/validate.js';
import {
  handlePipelineExplain,
  handlePipelineTrace,
  handlePipelineStages,
  handlePipelineIncludes,
  handlePipelineSummary,
} from './commands/pipeline.js';
import {
  handleSkillsList,
  handleSkillsGet,
  handleSkillsPath,
} from './commands/skills.js';
import { handleBatch } from './commands/batch.js';
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
// Filters out undefined values so they don't overwrite env-var/config-file values
function overrideConfig(overrides: Partial<GitLabCIConfig>): GitLabCIConfig {
  const defined = Object.fromEntries(
    Object.entries(overrides).filter(([_, v]) => v !== undefined)
  ) as Partial<GitLabCIConfig>;
  return { ...cliConfig, ...defined };
}

const program = new Command();

program
  .name('gitlab-catalog-browser')
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
  .option('--no-cache', 'Bypass cache and fetch fresh data')
  .action(async (fullPath: string, options: { version?: string; outputFile?: string; noCache?: boolean }) => {
    const mergedConfig = overrideConfig({
      gitlabUrl: program.opts().gitlabUrl || undefined,
      token: program.opts().token || undefined,
    });

    const result = await handleComponentSchema(fullPath, mergedConfig, {
      version: options.version,
      outputFile: options.outputFile,
      noCache: options.noCache ?? false,
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

// ── pipeline ─────────────────────────────────
const pipelineCmd = program
  .command('pipeline')
  .description('Analyze GitLab CI pipeline configurations');

pipelineCmd
  .command('explain')
  .description('Show job dependency graph for specified jobs')
  .argument('<file>', 'Path to .gitlab-ci.yml file')
  .requiredOption('--jobs <list>', 'Comma-separated job names (or "all")')
  .option('--json', 'Output as JSON')
  .action(async (file: string, opts: { jobs: string; json?: boolean }) => {
    const mergedConfig = overrideConfig({
      gitlabUrl: program.opts().gitlabUrl || undefined,
      token: program.opts().token || undefined,
    });

    const result = await handlePipelineExplain(file, mergedConfig, {
      jobs: opts.jobs,
      json: opts.json ?? false,
    });

    console.log(result.output);
    process.exit(result.exitCode);
  });

pipelineCmd
  .command('trace')
  .description('Trace variable usage across the pipeline')
  .argument('<file>', 'Path to .gitlab-ci.yml file')
  .requiredOption('--var <name>', 'Variable name to trace')
  .option('--json', 'Output as JSON')
  .action(async (file: string, opts: { var: string; json?: boolean }) => {
    const mergedConfig = overrideConfig({
      gitlabUrl: program.opts().gitlabUrl || undefined,
      token: program.opts().token || undefined,
    });

    const result = await handlePipelineTrace(file, mergedConfig, {
      var: opts.var,
      json: opts.json ?? false,
    });

    console.log(result.output);
    process.exit(result.exitCode);
  });

pipelineCmd
  .command('stages')
  .description('List pipeline stages and their jobs')
  .argument('<file>', 'Path to .gitlab-ci.yml file')
  .option('--mermaid', 'Output as Mermaid diagram')
  .option('--json', 'Output as JSON')
  .action(async (file: string, opts: { mermaid?: boolean; json?: boolean }) => {
    const mergedConfig = overrideConfig({
      gitlabUrl: program.opts().gitlabUrl || undefined,
      token: program.opts().token || undefined,
    });

    const result = await handlePipelineStages(file, mergedConfig, {
      mermaid: opts.mermaid ?? false,
      json: opts.json ?? false,
    });

    console.log(result.output);
    process.exit(result.exitCode);
  });

pipelineCmd
  .command('includes')
  .description('Show include hierarchy of the pipeline')
  .argument('<file>', 'Path to .gitlab-ci.yml file')
  .option('--json', 'Output as JSON')
  .action(async (file: string, opts: { json?: boolean }) => {
    const mergedConfig = overrideConfig({
      gitlabUrl: program.opts().gitlabUrl || undefined,
      token: program.opts().token || undefined,
    });

    const result = await handlePipelineIncludes(file, mergedConfig, {
      json: opts.json ?? false,
    });

    console.log(result.output);
    process.exit(result.exitCode);
  });

pipelineCmd
  .command('summary')
  .description('Generate a structured pipeline summary')
  .argument('<file>', 'Path to .gitlab-ci.yml file')
  .option('--json', 'Output as JSON')
  .action(async (file: string, opts: { json?: boolean }) => {
    const mergedConfig = overrideConfig({
      gitlabUrl: program.opts().gitlabUrl || undefined,
      token: program.opts().token || undefined,
    });

    const result = await handlePipelineSummary(file, mergedConfig, {
      json: opts.json ?? false,
    });

    console.log(result.output);
    process.exit(result.exitCode);
  });

// ── validate ─────────────────────────────────
program
  .command('validate')
  .description('Validate a .gitlab-ci.yml pipeline configuration')
  .argument('[file]', 'Path to .gitlab-ci.yml file')
  .option('--stdin', 'Read pipeline content from stdin')
  .option('--dry-run', 'Evaluate rules and show which jobs would execute')
  .option('--project <path>', 'GitLab project path for context-aware validation')
  .option('--var <key=value>', 'Simulate CI/CD variables (repeatable)', collectVar, [] as string[])
  .option('--json', 'Output results as JSON')
  .action(async (file: string | undefined, opts: Record<string, unknown>) => {
    const mergedConfig = overrideConfig({
      gitlabUrl: program.opts().gitlabUrl || undefined,
      token: program.opts().token || undefined,
    });

    const options = {
      stdin: (opts.stdin as boolean) ?? false,
      dryRun: (opts.dryRun as boolean) ?? false,
      project: opts.project as string | undefined,
      vars: opts.Var as string[] | undefined,
      json: (opts.json as boolean) ?? false,
    };

    const result = await handleValidate(file, mergedConfig, options);
    console.log(result.output);
    process.exit(result.exitCode);
  });

// ── skills ────────────────────────────────────
const skillsCmd = program
  .command('skills')
  .description('Manage AI agent skill content');

skillsCmd
  .command('list')
  .description('List available skills')
  .option('--json', 'Output as JSON')
  .action(async (opts: { json?: boolean }) => {
    const mergedConfig = overrideConfig({
      gitlabUrl: program.opts().gitlabUrl || undefined,
      token: program.opts().token || undefined,
    });

    const result = await handleSkillsList(mergedConfig, {
      json: opts.json ?? false,
    });

    console.log(result.output);
    process.exit(result.exitCode);
  });

skillsCmd
  .command('get')
  .description('Get skill content')
  .argument('[name]', 'Skill name')
  .option('--full', 'Include full reference and supplementary content')
  .option('--all', 'Output every available skill')
  .action(async (name: string | undefined, opts: { full?: boolean; all?: boolean }) => {
    const mergedConfig = overrideConfig({
      gitlabUrl: program.opts().gitlabUrl || undefined,
      token: program.opts().token || undefined,
    });

    const result = await handleSkillsGet(name, mergedConfig, {
      full: opts.full ?? false,
      all: opts.all ?? false,
    });

    console.log(result.output);
    process.exit(result.exitCode);
  });

skillsCmd
  .command('path')
  .description('Print skill directory path')
  .argument('[name]', 'Skill name')
  .action(async (name: string | undefined) => {
    const mergedConfig = overrideConfig({
      gitlabUrl: program.opts().gitlabUrl || undefined,
      token: program.opts().token || undefined,
    });

    const result = await handleSkillsPath(name, mergedConfig);

    console.log(result.output);
    process.exit(result.exitCode);
  });

// ── batch ─────────────────────────────────────
program
  .command('batch')
  .description('Execute multiple commands in sequence')
  .argument('[commands...]', 'Commands to execute')
  .option('--bail', 'Stop on first failure')
  .option('--json', 'Read commands from stdin as JSON array')
  .action(async (commands: string[] | undefined, opts: { bail?: boolean; json?: boolean }) => {
    const mergedConfig = overrideConfig({
      gitlabUrl: program.opts().gitlabUrl || undefined,
      token: program.opts().token || undefined,
    });

    const result = await handleBatch(commands, mergedConfig, {
      bail: opts.bail ?? false,
      json: opts.json ?? false,
    });

    console.log(result.output);
    process.exit(result.exitCode);
  });

// ── Parse ─────────────────────────────────────
program.parse(process.argv);

// Helper: collect repeated --var values
function collectVar(value: string, previous: string[]): string[] {
  return [...previous, value];
}
