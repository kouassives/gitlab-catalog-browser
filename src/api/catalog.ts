/**
 * Catalog API methods for GitLab CI/CD Catalog.
 *
 * Provides typed methods for listing, searching, and fetching component details.
 */

import { GitLabApiClient } from './gitlab.js';
import type { PaginationParams } from '../types/api.js';
import type {
  CatalogComponent,
  CatalogComponentDetail,
} from '../types/catalog.js';

// ──────────────────────────────────────────────
// CatalogApi
// ──────────────────────────────────────────────

export class CatalogApi {
  constructor(private readonly client: GitLabApiClient) {}

  /**
   * List all catalog components for a given namespace/org.
   * Uses a namespace search to find the group, then fetches its catalog components.
   *
   * @param namespace - GitLab namespace (e.g. "to-be-continuous")
   * @param pagination - Optional page/perPage parameters
   */
  async listComponents(
    namespace: string,
    pagination?: PaginationParams
  ): Promise<CatalogComponent[]> {
    // GitLab Catalog API: GET /projects/:id/ci/catalog/components
    // First, find the namespace's project/group ID via search
    const groupId = await this.resolveNamespace(namespace);

    return this.client.get<CatalogComponent[]>(
      `/projects/${groupId}/ci/catalog/components`,
      {
        params: {
          page: pagination?.page ?? 1,
          per_page: pagination?.perPage ?? 20,
        },
      }
    );
  }

  /**
   * Search catalog components by keyword across namespaces.
   *
   * @param query - Search keyword
   * @param pagination - Optional page/perPage parameters
   */
  async searchComponents(
    query: string,
    pagination?: PaginationParams
  ): Promise<CatalogComponent[]> {
    // GitLab Catalog API: GET /ci/catalog/components with search param
    return this.client.get<CatalogComponent[]>('/ci/catalog/components', {
      params: {
        search: query,
        page: pagination?.page ?? 1,
        per_page: pagination?.perPage ?? 20,
      },
    });
  }

  /**
   * Get detailed info for a specific component.
   *
   * @param fullPath - Full component path, e.g. "to-be-continuous/docker-build"
   */
  async getComponentInfo(fullPath: string): Promise<CatalogComponentDetail> {
    return this.client.get<CatalogComponentDetail>(
      `/ci/catalog/components/${fullPath}`
    );
  }

  // ────────────────────────────────────────────
  // Private helpers
  // ────────────────────────────────────────────

  /**
   * Resolve a namespace string to a GitLab group/project ID.
   */
  private async resolveNamespace(namespace: string): Promise<number> {
    // GitLab API: GET /groups?search=<namespace>
    const groups = await this.client.get<Array<{ id: number; path: string }>>(
      '/groups',
      { params: { search: namespace } }
    );

    const group = groups.find(
      (g) => g.path === namespace || g.path === namespace.replace(/^\//, '')
    );
    if (!group) {
      throw new Error(`Namespace not found: ${namespace}`);
    }

    return group.id;
  }
}
