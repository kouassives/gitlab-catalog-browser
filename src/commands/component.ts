/**
 * Component schema inspection command handlers.
 *
 * Implements `component schema`, `component inputs`, `component workflows`,
 * and `component jobs` commands.
 */

import { writeFileSync } from 'node:fs';
import { CatalogApi } from '../api/catalog.js';
import { GitLabApiClient } from '../api/gitlab.js';
import { renderTable, renderDetail, type TableRow } from '../output/table.js';
import type { GitLabCIConfig } from '../config/types.js';
import { NotFoundError } from '../types/api.js';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface ComponentSchemaOptions {
  version?: string;
  outputFile?: string;
}

export interface ComponentInputsOptions {
  json?: boolean;
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function createCatalogApi(config: Partial<GitLabCIConfig>): CatalogApi {
  const client = new GitLabApiClient(config);
  return new CatalogApi(client);
}

// ──────────────────────────────────────────────
// Handlers
// ──────────────────────────────────────────────

/**
 * Handle `component schema <full-path>`.
 */
export async function handleComponentSchema(
  fullPath: string,
  config: Partial<GitLabCIConfig>,
  options: ComponentSchemaOptions = {}
): Promise<{ exitCode: number; output: string }> {
  try {
    const api = createCatalogApi(config);
    const component = await api.getComponentInfo(fullPath);

    const yamlContent = component.spec ?? '# No schema available';

    if (options.outputFile) {
      writeFileSync(options.outputFile, yamlContent, 'utf-8');
      return {
        exitCode: 0,
        output: `Schema saved to ${options.outputFile}`,
      };
    }

    return { exitCode: 0, output: yamlContent };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const userMessage = err instanceof NotFoundError
      ? `Component '${fullPath}' not found`
      : `Error: ${message}`;
    return { exitCode: 1, output: userMessage };
  }
}

/**
 * Handle `component inputs <full-path>`.
 */
export async function handleComponentInputs(
  fullPath: string,
  config: Partial<GitLabCIConfig>,
  options: ComponentInputsOptions = {}
): Promise<{ exitCode: number; output: string }> {
  try {
    const api = createCatalogApi(config);
    const component = await api.getComponentInfo(fullPath);

    const inputs = component.inputs ?? [];

    if (inputs.length === 0) {
      return {
        exitCode: 0,
        output: options.json
          ? JSON.stringify({ success: true, data: [], message: `Component '${fullPath}' defines no inputs` })
          : `Component '${fullPath}' defines no inputs`,
      };
    }

    if (options.json) {
      return {
        exitCode: 0,
        output: JSON.stringify({ success: true, data: inputs }, null, 2),
      };
    }

    const rows: TableRow[] = inputs.map((input) => ({
      Name: input.name,
      Type: input.type,
      Required: input.required ? 'Yes' : 'No',
      Default: input.default !== undefined ? String(input.default) : '-',
      Description: input.description ?? '',
      Options: input.options?.join(', ') ?? '',
      Regex: input.regex ?? '',
    }));

    const table = renderTable(
      [
        { header: 'Name' },
        { header: 'Type' },
        { header: 'Required' },
        { header: 'Default' },
        { header: 'Description' },
        { header: 'Options' },
        { header: 'Regex' },
      ],
      rows
    );

    return { exitCode: 0, output: table };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const userMessage = err instanceof NotFoundError
      ? `Component '${fullPath}' not found`
      : `Error: ${message}`;
    if (options.json) {
      return {
        exitCode: 1,
        output: JSON.stringify({ success: false, error: { message: userMessage } }),
      };
    }
    return { exitCode: 1, output: userMessage };
  }
}

/**
 * Handle `component workflows <full-path>`.
 */
export async function handleComponentWorkflows(
  fullPath: string,
  config: Partial<GitLabCIConfig>
): Promise<{ exitCode: number; output: string }> {
  try {
    const api = createCatalogApi(config);
    const component = await api.getComponentInfo(fullPath);

    const workflows = component.workflows ?? [];

    if (workflows.length === 0) {
      return {
        exitCode: 0,
        output: `Component '${fullPath}' defines no workflows`,
      };
    }

    const lines: string[] = [];
    for (const wf of workflows) {
      lines.push(`Workflow: ${wf.name}`);
      lines.push(`  Triggers: ${wf.triggers.join(', ')}`);
      lines.push(`  Jobs:     ${wf.jobs.join(', ')}`);
      if (wf.rules && wf.rules.length > 0) {
        lines.push(`  Rules:    ${wf.rules.join(', ')}`);
      }
      lines.push('');
    }

    return { exitCode: 0, output: lines.join('\n').trimEnd() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const userMessage = err instanceof NotFoundError
      ? `Component '${fullPath}' not found`
      : `Error: ${message}`;
    return { exitCode: 1, output: userMessage };
  }
}

/**
 * Handle `component jobs <full-path>`.
 */
export async function handleComponentJobs(
  fullPath: string,
  config: Partial<GitLabCIConfig>,
  options: { withArtifacts?: boolean } = {}
): Promise<{ exitCode: number; output: string }> {
  try {
    const api = createCatalogApi(config);
    const component = await api.getComponentInfo(fullPath);

    const jobs = component.jobs ?? [];

    if (jobs.length === 0) {
      return {
        exitCode: 0,
        output: `Component '${fullPath}' defines no jobs`,
      };
    }

    const lines: string[] = [];
    for (const job of jobs) {
      lines.push(`Job: ${job.name}`);
      lines.push(`  Stage:  ${job.stage}`);
      if (job.image) lines.push(`  Image:  ${job.image}`);
      lines.push(`  Script: ${job.script.join(' && ')}`);
      if (job.variables && Object.keys(job.variables).length > 0) {
        const varsStr = Object.entries(job.variables)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ');
        lines.push(`  Variables: ${varsStr}`);
      }
      if (job.rules && job.rules.length > 0) {
        lines.push(`  Rules:  ${job.rules.join(', ')}`);
      }
      if (job.needs && job.needs.length > 0) {
        lines.push(`  Needs:  ${job.needs.join(', ')}`);
        if (options.withArtifacts) {
          lines.push(`  (artifact dependencies shown)`);
        }
      }
      if (job.when) {
        lines.push(`  When:   ${job.when}`);
      }
      lines.push('');
    }

    return { exitCode: 0, output: lines.join('\n').trimEnd() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const userMessage = err instanceof NotFoundError
      ? `Component '${fullPath}' not found`
      : `Error: ${message}`;
    return { exitCode: 1, output: userMessage };
  }
}
