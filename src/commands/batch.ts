/**
 * Batch command execution handler.
 *
 * Implements `batch` command for executing multiple CLI commands
 * in a single invocation, sequentially.
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GitLabCIConfig } from '../config/types.js';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface BatchOptions {
  bail?: boolean;
  json?: boolean;
}

interface CommandResult {
  command: string;
  index: number;
  exitCode: number;
  stdout: string;
  stderr: string;
}

// ──────────────────────────────────────────────
// Path resolution
// ──────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);

/**
 * Find the CLI binary path. Tries several strategies:
 * 1. GITLAB_CI_CLI_BIN env var (explicit override)
 * 2. resolve __filename relative to current script (for source runs)
 * 3. Check common locations
 */
function findCliPath(): string {
  // 1. Env var override
  const envBin = process.env.GITLAB_CI_CLI_BIN;
  if (envBin && existsSync(envBin)) return resolve(envBin);

  // 2. Try the bin/gitlab-ci-cli.js relative to this file
  const binPath = resolve(dirname(__filename), '..', '..', 'bin', 'gitlab-ci-cli.js');
  if (existsSync(binPath)) return binPath;

  // 3. Try process.argv[1] (the script that started this process)
  if (process.argv[1] && existsSync(process.argv[1])) return resolve(process.argv[1]);

  // 4. Fallback: use the same node executable with a known relative path
  return 'gitlab-ci-cli';
}

/**
 * Read JSON commands from stdin.
 */
async function readStdinCommands(): Promise<string[]> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  const content = Buffer.concat(chunks).toString('utf-8');
  const parsed = JSON.parse(content);
  if (!Array.isArray(parsed)) {
    throw new Error('Stdin JSON must be an array of command strings');
  }
  return parsed.map((c) => String(c));
}

// ──────────────────────────────────────────────
// Handlers
// ──────────────────────────────────────────────

/**
 * Handle `batch <commands...> [--bail]` or `batch --json` (stdin).
 */
export async function handleBatch(
  commands: string[] | undefined,
  _config: Partial<GitLabCIConfig>,
  options: BatchOptions = {}
): Promise<{ exitCode: number; output: string }> {
  try {
    // ── Collect commands ─────────────────────
    let cmdList: string[];

    if (options.json) {
      // Read from stdin
      cmdList = await readStdinCommands();
    } else if (commands && commands.length > 0) {
      cmdList = commands;
    } else {
      return {
        exitCode: 1,
        output: options.json
          ? JSON.stringify({ success: false, error: 'No commands provided. Pipe JSON to --json or pass commands as arguments.' })
          : 'No commands provided. Pipe JSON to --json or pass commands as arguments.',
      };
    }

    if (cmdList.length === 0) {
      return {
        exitCode: 0,
        output: options.json ? JSON.stringify({ results: [], summary: { total: 0, succeeded: 0, failed: 0 } }) : 'No commands to execute.',
      };
    }

    // ── Execute commands ─────────────────────
    const cliPath = findCliPath();
    const results: CommandResult[] = [];
    let hasFailure = false;

    for (let i = 0; i < cmdList.length; i++) {
      const cmd = cmdList[i];

      try {
        const fullCmd = `${process.execPath} ${cliPath} ${cmd}`;
        const stdout = execSync(fullCmd, {
          encoding: 'utf-8',
          timeout: 60000,
          maxBuffer: 10 * 1024 * 1024, // 10MB
        });

        results.push({
          command: cmd,
          index: i,
          exitCode: 0,
          stdout: stdout.trimEnd(),
          stderr: '',
        });
      } catch (err: unknown) {
        const execErr = err as (Error & { status?: number; stdout?: string; stderr?: string });
        const exitCode = execErr.status ?? 1;
        const stderr = execErr.stderr?.trimEnd() ?? execErr.message;

        results.push({
          command: cmd,
          index: i,
          exitCode,
          stdout: (execErr.stdout as string)?.trimEnd() ?? '',
          stderr,
        });

        hasFailure = true;

        if (options.bail) {
          // Stop at first failure
          break;
        }
      }
    }

    // ── Format results ────────────────────────
    const succeeded = results.filter((r) => r.exitCode === 0).length;
    const failed = results.filter((r) => r.exitCode !== 0).length;

    if (options.json) {
      return {
        exitCode: hasFailure ? 1 : 0,
        output: JSON.stringify(
          {
            results: results.map((r) => ({
              command: r.command,
              exit_code: r.exitCode,
              stdout: r.stdout,
              stderr: r.stderr,
            })),
            summary: {
              total: results.length,
              succeeded,
              failed,
              bailed: options.bail && hasFailure,
            },
          },
          null,
          2
        ),
      };
    }

    // Text output
    const lines: string[] = [];
    for (const result of results) {
      const status = result.exitCode === 0 ? '✓' : '✗';
      lines.push(`${status} [${result.index + 1}/${cmdList.length}] ${result.command}`);
      if (result.stdout) {
        lines.push(result.stdout);
      }
      if (result.stderr) {
        lines.push(`  Error: ${result.stderr}`);
      }
      lines.push('');
    }

    lines.push(`--- Summary ---`);
    lines.push(`Total: ${results.length}, Succeeded: ${succeeded}, Failed: ${failed}`);
    if (options.bail && hasFailure) {
      lines.push('Batch stopped early due to --bail flag.');
    }

    return {
      exitCode: hasFailure ? 1 : 0,
      output: lines.join('\n'),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (options.json) {
      return { exitCode: 1, output: JSON.stringify({ success: false, error: message }) };
    }
    return { exitCode: 1, output: `Error: ${message}` };
  }
}
