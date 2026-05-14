/**
 * Pipeline validation command handlers.
 *
 * Implements `validate` command with support for dry-run, project context,
 * simulated variables, stdin input, and JSON output.
 */

import { readFileSync } from 'node:fs';
import { LintApi } from '../api/lint.js';
import { GitLabApiClient } from '../api/gitlab.js';
import type { GitLabCIConfig } from '../config/types.js';
import { AuthenticationError, PermissionError } from '../types/api.js';

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

// ──────────────────────────────────────────────
// Output formatting
// ──────────────────────────────────────────────

interface FormatOptions {
  dryRun?: boolean;
  vars?: Record<string, string>;
  project?: string;
}

/**
 * Format a validation result for text display.
 */
function formatTextResult(
  result: import('../api/lint.js').LintResult,
  options: FormatOptions
): string {
  const lines: string[] = [];

  // Title
  const isValid = result.status === 'valid' && (result.valid ?? true);
  if (isValid) {
    lines.push('Pipeline configuration is valid');
  } else {
    lines.push('Pipeline configuration is invalid');
  }

  // Show context
  if (options.project) {
    lines.push(`Project context: ${options.project}`);
  }
  if (options.dryRun) {
    lines.push('Dry-run mode: rules evaluated');
  }
  if (options.vars && Object.keys(options.vars).length > 0) {
    lines.push(
      `Simulated variables: ${Object.entries(options.vars)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')}`
    );
  }

  // Errors
  if (result.errors.length > 0) {
    lines.push('');
    lines.push('Errors:');
    for (const err of result.errors) {
      const loc = err.line ? `Line ${err.line}${err.column ? `, col ${err.column}` : ''}` : '';
      lines.push(`  ${loc ? `${loc}: ` : ''}${err.message}`);
    }
  }

  // Warnings
  if (result.warnings.length > 0) {
    lines.push('');
    lines.push('Warnings:');
    for (const warn of result.warnings) {
      const loc = warn.line ? `Line ${warn.line}${warn.column ? `, col ${warn.column}` : ''}` : '';
      lines.push(`  ${loc ? `${loc}: ` : ''}${warn.message}`);
    }
  }

  // Jobs (dry-run or includeJobs)
  if (result.jobs && result.jobs.length > 0) {
    lines.push('');
    lines.push('Jobs:');
    for (const job of result.jobs) {
      const willRun = job.when !== 'never' && job.when !== 'manual';
      const icon = willRun ? '✅' : '❌';
      const reason = job.except_reason ? ` (${job.except_reason})` : '';
      lines.push(`  ${icon} ${job.name}  stage: ${job.stage}${reason}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format a validation result as JSON.
 */
function formatJsonResult(
  result: import('../api/lint.js').LintResult,
  options: FormatOptions
): string {
  return JSON.stringify(
    {
      success: result.status === 'valid',
      status: result.status,
      errors: result.errors,
      warnings: result.warnings,
      jobs: result.jobs,
      context: {
        project: options.project ?? null,
        dryRun: options.dryRun ?? false,
        vars: options.vars ?? null,
      },
    },
    null,
    2
  );
}

// ──────────────────────────────────────────────
// Handlers
// ──────────────────────────────────────────────

/**
 * Handle `validate <file>` or `validate --stdin`.
 */
export async function handleValidate(
  filePath: string | undefined,
  config: Partial<GitLabCIConfig>,
  options: ValidateOptions = {}
): Promise<{ exitCode: number; output: string }> {
  try {
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

    // ── Build API options ──────────────────────
    const variables = parseVars(options.vars);

    const api = createLintApi(config);
    const result = await api.validate(content, {
      project: options.project,
      dryRun: options.dryRun,
      variables,
      includeJobs: options.dryRun, // include jobs when dry-run
    });

    // ── Format output ──────────────────────────
    const formatOptions: FormatOptions = {
      dryRun: options.dryRun,
      vars: variables,
      project: options.project,
    };

    const output = options.json
      ? formatJsonResult(result, formatOptions)
      : formatTextResult(result, formatOptions);

    // Exit code: 0 if valid, non-zero if invalid
    const exitCode =
      result.status === 'valid' && (result.valid ?? true) ? 0 : 1;

    return { exitCode, output };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Handle permission errors gracefully
    if (err instanceof AuthenticationError || err instanceof PermissionError) {
      const userMessage = options.project
        ? `Insufficient permissions to access project '${options.project}'`
        : `Authentication failed: ${message}`;

      if (options.json) {
        return {
          exitCode: 1,
          output: JSON.stringify({ success: false, error: { message: userMessage } }),
        };
      }
      return { exitCode: 1, output: userMessage };
    }

    // Generic error
    const userMessage = `Error: ${message}`;
    if (options.json) {
      return {
        exitCode: 1,
        output: JSON.stringify({ success: false, error: { message: userMessage } }),
      };
    }
    return { exitCode: 1, output: userMessage };
  }
}
