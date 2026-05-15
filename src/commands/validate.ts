/**
 * Pipeline validation command handlers.
 *
 * Implements `validate` command with hybrid validation flow:
 *   1. Local YAML syntax + basic structure check (always, no token needed)
 *   2. Full API validation (if token + project available)
 *
 * Hybrid flow ensures users always get useful feedback, even without
 * GitLab credentials.
 */

import { readFileSync } from 'node:fs';
import { LintApi } from '../api/lint.js';
import { GitLabApiClient } from '../api/gitlab.js';
import type { GitLabCIConfig } from '../config/types.js';
import { AuthenticationError, PermissionError, ConfigurationError } from '../types/api.js';
import { validateLocal } from '../validate/local.js';
import type { LocalValidationResult } from '../validate/local.js';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface ValidateOptions {
  /** Read pipeline content from stdin instead of a file */
  stdin?: boolean;
  /** Enable dry-run mode for rules evaluation */
  dryRun?: boolean;
  /** Project path for context-aware validation */
  project?: string;
  /** Simulated CI/CD variables (KEY=VALUE strings) */
  vars?: string[];
  /** Output results as JSON */
  json?: boolean;
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function createLintApi(config: Partial<GitLabCIConfig>): LintApi {
  const client = new GitLabApiClient(config);
  return new LintApi(client);
}

/**
 * Read content from stdin asynchronously.
 */
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

/**
 * Parse an array of "KEY=VALUE" strings into a record.
 */
function parseVars(vars: string[] | undefined): Record<string, string> | undefined {
  if (!vars || vars.length === 0) return undefined;

  const result: Record<string, string> = {};
  for (const v of vars) {
    const eqIdx = v.indexOf('=');
    if (eqIdx === -1) continue; // skip malformed
    const key = v.slice(0, eqIdx);
    const value = v.slice(eqIdx + 1);
    if (key) result[key] = value;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Format multiple validation errors/warnings into a compact summary.
 */
function formatLocalIssues(
  label: string,
  items: Array<{ line?: number; column?: number; message: string }>
): string[] {
  if (items.length === 0) return [];
  const lines: string[] = [`${label}:`];
  for (const item of items) {
    const loc = item.line ? `Line ${item.line}${item.column ? `, col ${item.column}` : ''}` : '';
    lines.push(`  ${loc ? `${loc}: ` : ''}${item.message}`);
  }
  return lines;
}

/**
 * Format a section header for the output.
 */
function section(title: string): string {
  return `\n── ${title} ──`;
}

// ──────────────────────────────────────────────
// Output formatting — Text
// ──────────────────────────────────────────────

interface FormatContext {
  local: LocalValidationResult;
  api?: import('../api/lint.js').LintResult;
  apiError?: string;
  project?: string;
  dryRun?: boolean;
  vars?: Record<string, string>;
}

/**
 * Format hybrid validation results for text display.
 */
function formatTextResult(ctx: FormatContext): string {
  const lines: string[] = [];

  // ── Local validation summary ──
  const localOk = ctx.local.status === 'valid';
  lines.push(`${localOk ? '✓' : '✗'} YAML syntax: ${ctx.local.status}`);
  if (!ctx.local.looksLikeGitLabCI) {
    lines.push('⚠  No GitLab CI/CD keywords detected — this may not be a .gitlab-ci.yml file');
  }

  if (ctx.local.errors.length > 0) {
    lines.push(...formatLocalIssues('  Errors', ctx.local.errors));
  }
  if (ctx.local.warnings.length > 0) {
    lines.push(...formatLocalIssues('  Warnings', ctx.local.warnings));
  }

  // ── API validation section ──
  if (ctx.api) {
    lines.push(section('GitLab CI API validation'));
    const isValid = ctx.api.valid === true;
    lines.push(`${isValid ? '✓' : '✗'} Pipeline configuration is ${isValid ? 'valid' : 'invalid'}`);

    if (ctx.project) {
      lines.push(`  Project context: ${ctx.project}`);
    }
    if (ctx.dryRun) {
      lines.push('  Dry-run mode: rules evaluated');
    }

    if (ctx.api.errors.length > 0) {
      lines.push(...formatLocalIssues('  Errors', ctx.api.errors));
    }
    if (ctx.api.warnings.length > 0) {
      lines.push(...formatLocalIssues('  Warnings', ctx.api.warnings));
    }
    if (ctx.api.jobs && ctx.api.jobs.length > 0) {
      lines.push('  Jobs:');
      for (const job of ctx.api.jobs) {
        const willRun = job.when !== 'never' && job.when !== 'manual';
        const icon = willRun ? '✅' : '❌';
        const reason = job.except_reason ? ` (${job.except_reason})` : '';
        lines.push(`    ${icon} ${job.name}  stage: ${job.stage}${reason}`);
      }
    }
  } else if (ctx.apiError) {
    lines.push(section('GitLab CI API validation — failed'));
    lines.push(`  ${ctx.apiError}`);
  } else {
    // No API credentials — show setup instructions
    lines.push(section('API validation not configured'));
    lines.push('  For full validation (includes, rules, variables):');
    if (!ctx.project) {
      lines.push('    1. Specify a project: --project <namespace/project>');
    }
    if (!ctx.project || true) { // always show token info
      lines.push('    2. Provide a GitLab API token:');
      lines.push('       export GITLAB_CI_CLI_TOKEN=glpat-xxxx');
      lines.push('       # Or set GITLAB_TOKEN if you already have it');
      lines.push('    3. Create a token at:');
      lines.push('       https://gitlab.com/-/profile/personal_access_tokens');
    }
  }

  return lines.join('\n');
}

// ──────────────────────────────────────────────
// Output formatting — JSON
// ──────────────────────────────────────────────

/**
 * Format hybrid validation results as JSON.
 */
function formatJsonResult(ctx: FormatContext): string {
  const payload: Record<string, unknown> = {
    local: {
      status: ctx.local.status,
      errors: ctx.local.errors,
      warnings: ctx.local.warnings,
      looksLikeGitLabCI: ctx.local.looksLikeGitLabCI,
    },
  };

  if (ctx.api) {
    payload.api = {
      success: ctx.api.valid === true,
      status: ctx.api.valid ? 'valid' : 'invalid',
      errors: ctx.api.errors,
      warnings: ctx.api.warnings,
      jobs: ctx.api.jobs,
      context: {
        project: ctx.project ?? null,
        dryRun: ctx.dryRun ?? false,
      },
    };
  } else if (ctx.apiError) {
    payload.api = { error: ctx.apiError };
  } else {
    const hints: string[] = [];
    if (!ctx.project) hints.push('--project <namespace/project>');
    hints.push('GITLAB_CI_CLI_TOKEN or GITLAB_TOKEN');
    payload.api = {
      message: 'API validation requires a token and project',
      hints,
    };
  }

  payload.success =
    ctx.local.status === 'valid' &&
    (ctx.api ? ctx.api.valid === true : true);

  return JSON.stringify(payload, null, 2);
}

// ──────────────────────────────────────────────
// Handlers
// ──────────────────────────────────────────────

/**
 * Handle `validate <file>` or `validate --stdin`.
 *
 * Hybrid flow:
 *   1. Always performs local YAML syntax + structure check
 *   2. If token + project available, calls GitLab CI Lint API for full validation
 *   3. If API not available, shows local results with setup instructions
 */
export async function handleValidate(
  filePath: string | undefined,
  config: Partial<GitLabCIConfig>,
  options: ValidateOptions = {}
): Promise<{ exitCode: number; output: string }> {
  // ── Read pipeline content ──────────────────
  let content: string;
  if (options.stdin) {
    content = await readStdin();
  } else if (filePath) {
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch {
      return {
        exitCode: 1,
        output: options.json
          ? JSON.stringify({ success: false, error: { message: `File '${filePath}' not found` } })
          : `File '${filePath}' not found`,
      };
    }
  } else {
    return {
      exitCode: 1,
      output: options.json
        ? JSON.stringify({ success: false, error: { message: 'No input provided. Specify a file or use --stdin.' } })
        : 'No input provided. Specify a file or use --stdin.',
    };
  }

  // ── Step 1: Always validate locally ────────
  const localResult = validateLocal(content);

  // ── Step 2: API validation (if possible) ───
  const variables = parseVars(options.vars);
  let apiResult: import('../api/lint.js').LintResult | undefined;
  let apiError: string | undefined;

  if (config.token && options.project) {
    try {
      const api = createLintApi(config);
      apiResult = await api.validate(content, {
        project: options.project,
        dryRun: options.dryRun,
        variables,
        includeJobs: options.dryRun,
      });
    } catch (err) {
      if (err instanceof AuthenticationError || err instanceof PermissionError) {
        apiError = `Authentication failed: ${err.message}`;
      } else if (err instanceof ConfigurationError) {
        apiError = err.message;
      } else {
        apiError = err instanceof Error ? err.message : String(err);
      }
    }
  }

  // ── Step 3: Format output ──────────────────
  const ctx: FormatContext = {
    local: localResult,
    api: apiResult,
    apiError,
    project: options.project,
    dryRun: options.dryRun,
    vars: variables,
  };

  const output = options.json ? formatJsonResult(ctx) : formatTextResult(ctx);

  // Determine exit code:
  // - If API was called: use its verdict
  // - If only local check: valid only if local check passes
  const exitCode =
    apiResult
      ? (apiResult.valid === true ? 0 : 1)
      : (localResult.status === 'valid' ? 0 : 1);

  return { exitCode, output };
}
