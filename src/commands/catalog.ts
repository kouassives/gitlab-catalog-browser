/**
 * Catalog browsing command handlers.
 *
 * Implements `catalog list`, `catalog search`, and `catalog info` commands.
 * Uses the CatalogApi client for GitLab API interactions.
 */

import { CatalogApi } from '../api/catalog.js';
import { GraphQLApiClient } from '../api/graphql.js';
import { renderTable, renderDetail, type TableRow } from '../output/table.js';
import type { GitLabCIConfig } from '../config/types.js';
import { NotFoundError } from '../types/api.js';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface CatalogListOptions {
  json?: boolean;
  page?: number;
  perPage?: number;
}

export interface CatalogSearchOptions {
  json?: boolean;
  page?: number;
  perPage?: number;
}

export interface CatalogInfoOptions {
  json?: boolean;
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function createCatalogApi(config: Partial<GitLabCIConfig>): CatalogApi {
  // Do NOT pass config.token — Catalog API is public via GraphQL.
  // An expired/invalid token would cause 401 errors even for public resources.
  // Keep gitlabUrl and timeout for self-managed GitLab instances.
  const client = new GraphQLApiClient({
    gitlabUrl: config.gitlabUrl,
    timeout: config.timeout,
  });
  return new CatalogApi(client);
}

// ──────────────────────────────────────────────
// Handlers
// ──────────────────────────────────────────────

/**
 * Handle `catalog list --org <namespace>`.
 */
export async function handleCatalogList(
  namespace: string,
  config: Partial<GitLabCIConfig>,
  options: CatalogListOptions = {}
): Promise<{ exitCode: number; output: string }> {
  try {
    const api = createCatalogApi(config);
    const components = await api.listComponents(namespace, {
      page: options.page,
      perPage: options.perPage,
    });

    if (components.length === 0) {
      return {
        exitCode: 0,
        output: options.json
          ? JSON.stringify({ success: true, data: [], message: `No components found in namespace '${namespace}'` })
          : `No components found in namespace '${namespace}'`,
      };
    }

    if (options.json) {
      return {
        exitCode: 0,
        output: JSON.stringify({ success: true, data: components }, null, 2),
      };
    }

    const rows: TableRow[] = components.map((c) => ({
      Name: c.name,
      Version: c.version,
      Description: c.description ?? '',
      Path: c.full_path,
    }));

    const table = renderTable(
      [
        { header: 'Name' },
        { header: 'Version' },
        { header: 'Description' },
        { header: 'Path' },
      ],
      rows
    );

    return { exitCode: 0, output: table };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (options.json) {
      return {
        exitCode: 1,
        output: JSON.stringify({ success: false, error: { message } }),
      };
    }
    return { exitCode: 1, output: `Error: ${message}` };
  }
}

/**
 * Handle `catalog search <query>`.
 */
export async function handleCatalogSearch(
  query: string,
  config: Partial<GitLabCIConfig>,
  options: CatalogSearchOptions = {}
): Promise<{ exitCode: number; output: string }> {
  try {
    const api = createCatalogApi(config);
    const components = await api.searchComponents(query, {
      page: options.page,
      perPage: options.perPage,
    });

    if (components.length === 0) {
      return {
        exitCode: 0,
        output: options.json
          ? JSON.stringify({ success: true, data: [], message: `No components matching '${query}'` })
          : `No components matching '${query}'`,
      };
    }

    if (options.json) {
      return {
        exitCode: 0,
        output: JSON.stringify({ success: true, data: components }, null, 2),
      };
    }

    const rows: TableRow[] = components.map((c) => ({
      Name: c.name,
      Version: c.version,
      Description: c.description ?? '',
      Path: c.full_path,
    }));

    const table = renderTable(
      [
        { header: 'Name' },
        { header: 'Version' },
        { header: 'Description' },
        { header: 'Path' },
      ],
      rows
    );

    return { exitCode: 0, output: table };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (options.json) {
      return {
        exitCode: 1,
        output: JSON.stringify({ success: false, error: { message } }),
      };
    }
    return { exitCode: 1, output: `Error: ${message}` };
  }
}

/**
 * Handle `catalog info <full-path>`.
 */
export async function handleCatalogInfo(
  fullPath: string,
  config: Partial<GitLabCIConfig>,
  options: CatalogInfoOptions = {}
): Promise<{ exitCode: number; output: string }> {
  try {
    const api = createCatalogApi(config);
    const component = await api.getComponentInfo(fullPath);

    if (options.json) {
      return {
        exitCode: 0,
        output: JSON.stringify({ success: true, data: component }, null, 2),
      };
    }

    const detail = renderDetail([
      { label: 'Name', value: component.name },
      { label: 'Path', value: component.full_path },
      { label: 'Version', value: component.version },
      { label: 'Description', value: component.description ?? '' },
      { label: 'Inputs', value: String(component.inputs?.length ?? 0) },
      { label: 'Jobs', value: String(component.jobs?.length ?? 0) },
      { label: 'Workflows', value: String(component.workflows?.length ?? 0) },
    ]);

    return { exitCode: 0, output: detail };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Give a friendlier message for not-found
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
