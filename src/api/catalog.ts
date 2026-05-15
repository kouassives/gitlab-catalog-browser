/**
 * Catalog API methods for GitLab CI/CD Catalog.
 *
 * Provides typed methods for listing, searching, and fetching component details
 * using GitLab's GraphQL API. Does NOT require authentication for public resources.
 *
 * Pagination uses GitLab's cursor-based pagination internally, but exposes
 * a page/perPage interface. When no pagination params are given, ALL matching
 * resources are fetched (multi-page) and returned.
 */

import { GraphQLApiClient } from './graphql.js';
import { NotFoundError } from '../types/api.js';
import type { PaginationParams } from '../types/api.js';
import type {
  CatalogComponent,
  CatalogComponentDetail,
  ComponentInput,
  ComponentJob,
  ComponentWorkflow,
} from '../types/catalog.js';

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

/** Max items per GraphQL page — prevents overly large payloads. */
const GRAPHQL_PAGE_SIZE = 100;

/** Max pages to fetch (5 pages × 100 = 500 resources). Covers the largest orgs
 *  without unbounded requests that could timeout. */
const MAX_PAGES = 5;

/** Default items per logical page when user does not specify --per-page. */
const DEFAULT_PER_PAGE = 50;

// ──────────────────────────────────────────────
// GraphQL Queries
// ──────────────────────────────────────────────

const RESOURCES_PAGE_QUERY = `
query catalogResourcesPage($first: Int, $after: String, $search: String) {
  ciCatalogResources(first: $first, after: $after, search: $search) {
    nodes {
      id
      name
      fullPath
      description
      webPath
      latestReleasedAt
      versions(first: 1) {
        nodes {
          name
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
`;

const GROUP_RESOURCES_QUERY = `
query groupCatalogResources($groupPath: ID!, $first: Int, $after: String) {
  group(fullPath: $groupPath) {
    name
    fullPath
    projects(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        name
        path
        description
        starCount
        isCatalogResource
      }
    }
  }
}
`;

const RESOURCE_DETAIL_QUERY = `
query catalogResource($fullPath: ID!) {
  ciCatalogResource(fullPath: $fullPath) {
    id
    name
    fullPath
    description
    webPath
    starCount
    topics
    verificationLevel
    latestReleasedAt
    versions(first: 1) {
      nodes {
        name
        path
        semver {
          major
          minor
          patch
        }
        components {
          nodes {
            id
            name
            includePath
            description
            inputs {
              name
              type
              required
              default
              description
              options
              regex
            }
          }
        }
      }
    }
  }
}
`;

// ──────────────────────────────────────────────
// GraphQL response types (internal)
// ──────────────────────────────────────────────

interface GqlResourceNode {
  id: string;
  name: string;
  fullPath: string;
  description: string | null;
  webPath: string;
  latestReleasedAt: string | null;
  versions?: {
    nodes: Array<{
      name: string;
    }>;
  };
}

interface GqlPageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

interface GqlResourcePageResponse {
  ciCatalogResources: {
    nodes: GqlResourceNode[];
    pageInfo: GqlPageInfo;
  };
}

/** A project returned via group(fullPath:) { projects { nodes } } */
interface GqlGroupProject {
  id: string;
  name: string;
  path: string;
  description: string | null;
  starCount: number;
  isCatalogResource: boolean;
}

interface GqlGroupResponse {
  group: {
    name: string;
    fullPath: string;
    projects: {
      pageInfo: GqlPageInfo;
      nodes: GqlGroupProject[];
    };
  } | null;
}

interface GqlResourceDetailNode extends GqlResourceNode {
  starCount: number;
  topics: string[];
  verificationLevel: string;
  versions?: {
    nodes: Array<{
      name: string;
      path: string;
      semver: { major: number; minor: number; patch: number } | null;
      components: {
        nodes: Array<{
          id: string;
          name: string;
          includePath: string;
          description: string | null;
          inputs: Array<{
            name: string;
            type: string;
            required: boolean;
            default: unknown;
            description: string | null;
            options: string[] | null;
            regex: string | null;
          }>;
        }>;
      };
    }>;
  };
}

interface ResourceDetailResponse {
  ciCatalogResource: GqlResourceDetailNode | null;
}

// ──────────────────────────────────────────────
// CatalogApi
// ──────────────────────────────────────────────

export class CatalogApi {
  constructor(private readonly client: GraphQLApiClient) {}

  /**
   * List all catalog components for a given namespace/org.
   *
   * Uses group(fullPath:) { projects { nodes } } to fetch ONLY the projects
   * under the given namespace, then filters by isCatalogResource.
   * Much faster than fetching the global catalog and filtering by prefix.
   *
   * @param namespace - GitLab namespace (e.g. "to-be-continuous")
   * @param pagination - Optional page/perPage parameters (omit for all results)
   */
  async listComponents(
    namespace: string,
    pagination?: PaginationParams
  ): Promise<CatalogComponent[]> {
    const allNodes = await this.fetchGroupResources(namespace);
    return this.applyOffsetPagination(allNodes, pagination);
  }

  /**
   * Search catalog components by keyword across namespaces.
   *
   * Fetches ALL matching pages from GraphQL (cursor-based with search),
   * then applies offset-based pagination if requested.
   *
   * @param query - Search keyword
   * @param pagination - Optional page/perPage parameters (omit for all results)
   */
  async searchComponents(
    query: string,
    pagination?: PaginationParams
  ): Promise<CatalogComponent[]> {
    const allNodes = await this.fetchAllResources(query);

    return this.applyOffsetPagination(allNodes, pagination);
  }

  /**
   * Get detailed info for a specific component.
   *
   * Uses GraphQL ciCatalogResource with versions and components.
   *
   * @param fullPath - Full component path, e.g. "to-be-continuous/docker"
   */
  async getComponentInfo(fullPath: string): Promise<CatalogComponentDetail> {
    const data = await this.client.query<ResourceDetailResponse>(
      RESOURCE_DETAIL_QUERY,
      { fullPath }
    );

    const resource = data.ciCatalogResource;
    if (!resource) {
      throw new NotFoundError(fullPath);
    }

    return this.mapToCatalogComponentDetail(resource);
  }

  // ────────────────────────────────────────────
  // Pagination helpers
  // ────────────────────────────────────────────

  /**
   * Fetch ALL pages of ciCatalogResources using cursor-based pagination.
   * Keeps requesting the next page while hasNextPage is true.
   *
   * @param search - Optional search term passed to GraphQL
   * @returns Flat array of all resource nodes from all pages
   */
  private async fetchAllResources(
    search?: string
  ): Promise<GqlResourceNode[]> {
    const allNodes: GqlResourceNode[] = [];
    let after: string | undefined | null = null;
    let hasMore = true;
    let pageCount = 0;

    while (hasMore && pageCount < MAX_PAGES) {
      pageCount++;

      const vars: Record<string, unknown> = {
        first: GRAPHQL_PAGE_SIZE,
      };
      if (after) {
        vars.after = after;
      }
      if (search) {
        vars.search = search;
      }

      const data = await this.client.query<GqlResourcePageResponse>(
        RESOURCES_PAGE_QUERY,
        vars
      );

      const page = data.ciCatalogResources;
      if (!page) break;

      allNodes.push(...(page.nodes ?? []));

      hasMore = page.pageInfo?.hasNextPage ?? false;
      after = page.pageInfo?.endCursor ?? null;
    }

    return allNodes;
  }

  /**
   * Fetch all catalog resources under a specific group/namespace.
   *
   * Uses group(fullPath:) { projects { nodes } } which returns ONLY the
   * projects within that namespace — far more efficient than fetching the
   * entire global catalog and filtering client-side.
   *
   * Filters projects by isCatalogResource === true.
   *
   * @param namespace - GitLab group/namespace path (e.g. "to-be-continuous")
   * @returns Flat array of all catalog resource nodes in the group
   */
  private async fetchGroupResources(
    namespace: string
  ): Promise<GqlResourceNode[]> {
    const allNodes: GqlResourceNode[] = [];
    let after: string | undefined | null = null;
    let hasMore = true;
    let pageCount = 0;

    while (hasMore && pageCount < MAX_PAGES) {
      pageCount++;

      const vars: Record<string, unknown> = {
        groupPath: namespace,
        first: GRAPHQL_PAGE_SIZE,
      };
      if (after) {
        vars.after = after;
      }

      const data = await this.client.query<GqlGroupResponse>(
        GROUP_RESOURCES_QUERY,
        vars
      );

      // Group not found or inaccessible
      if (!data.group) break;

      const projects = data.group.projects;
      if (!projects) break;

      for (const project of projects.nodes ?? []) {
        if (project.isCatalogResource) {
          // Build fullPath from group path + project path
          const fullPath = `${data.group.fullPath}/${project.path}`;
          allNodes.push({
            id: project.id,
            name: project.name,
            fullPath,
            description: project.description,
            webPath: `/${fullPath}`,
            latestReleasedAt: null,
            versions: undefined,
          });
        }
      }

      hasMore = projects.pageInfo?.hasNextPage ?? false;
      after = projects.pageInfo?.endCursor ?? null;
    }

    return allNodes;
  }

  /**
   * Apply offset-based pagination to a complete result set.
   * When no pagination params are given, returns all items.
   */
  private applyOffsetPagination(
    nodes: GqlResourceNode[],
    pagination?: PaginationParams
  ): CatalogComponent[] {
    if (!pagination || pagination.page === undefined) {
      // No pagination requested — return ALL results
      return nodes.map((n) => this.mapToCatalogComponent(n));
    }

    const perPage = pagination.perPage ?? DEFAULT_PER_PAGE;
    const page = pagination.page;
    const offset = (page - 1) * perPage;
    const paged = nodes.slice(offset, offset + perPage);

    return paged.map((n) => this.mapToCatalogComponent(n));
  }

  // ────────────────────────────────────────────
  // Mapping helpers
  // ────────────────────────────────────────────

  private mapToCatalogComponent(node: GqlResourceNode): CatalogComponent {
    const latestVersion = node.versions?.nodes?.[0]?.name ?? '';

    return {
      id: this.extractNumericId(node.id),
      name: node.name,
      full_path: node.fullPath,
      version: latestVersion,
      description: node.description ?? '',
      updated_at: node.latestReleasedAt ?? undefined,
    };
  }

  private mapToCatalogComponentDetail(
    node: GqlResourceDetailNode
  ): CatalogComponentDetail {
    const summary = this.mapToCatalogComponent(node);

    const latestVersion = node.versions?.nodes?.[0];
    const components = latestVersion?.components?.nodes ?? [];

    // Collect all inputs from all components
    const inputs: ComponentInput[] = [];
    const jobs: ComponentJob[] = [];
    const workflows: ComponentWorkflow[] = [];

    for (const comp of components) {
      // Map inputs
      for (const input of comp.inputs ?? []) {
        inputs.push({
          name: input.name,
          type: this.mapInputType(input.type),
          required: input.required,
          default: input.default,
          description: input.description ?? undefined,
          regex: input.regex ?? undefined,
          options: input.options ?? undefined,
        });
      }

      // Each component maps to a "job" (simplified)
      jobs.push({
        name: comp.name,
        stage: 'deploy', // GraphQL doesn't expose stage directly
        script: [], // Not available via GraphQL
      });

      // Each component forms a simple workflow
      workflows.push({
        name: comp.name,
        triggers: [],
        jobs: [comp.name],
      });
    }

    return {
      ...summary,
      inputs: inputs.length > 0 ? inputs : undefined,
      jobs: jobs.length > 0 ? jobs : undefined,
      workflows: workflows.length > 0 ? workflows : undefined,
      spec: undefined, // Full YAML spec not available via GraphQL
    };
  }

  /**
   * Map GraphQL input type string to our normalized type.
   */
  private mapInputType(type: string): 'string' | 'number' | 'boolean' | 'array' {
    switch (type) {
      case 'BOOLEAN':
        return 'boolean';
      case 'NUMBER':
        return 'number';
      default:
        return 'string';
    }
  }

  /**
   * Extract numeric ID from global GraphQL ID.
   * e.g. "gid://gitlab/Ci::Catalog::Resource/1001971" → 1001971
   */
  private extractNumericId(gid: string): number {
    const parts = gid.split('/');
    const last = parts[parts.length - 1];
    return parseInt(last, 10) || 0;
  }
}
