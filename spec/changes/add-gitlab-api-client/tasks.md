# Implementation Tasks: GitLab API Client & Configuration Loading

## Phase 1: Configuration Layer

1. Create `src/config/types.ts` — TypeScript interface `GitLabCIConfig` with all supported keys (`gitlabUrl`, `token`, `project`, `timeout`, `output`), default values, and a `resolveConfig()` helper that applies precedence (user config → project config → env vars → CLI flags)

2. Create `src/config/loader.ts` — Config loading implementation:
   - `loadConfigFiles()` — reads `~/.gitlab-ci-cli.json` and `./.gitlab-ci-cli.json`, handles missing files gracefully
   - `mergeConfigs()` — merges user → project config, project keys override user keys
   - `applyEnvOverrides()` — reads `GITLAB_CI_CLI_URL`, `GITLAB_CI_CLI_TOKEN`, `GITLAB_CI_CLI_PROJECT`, `GITLAB_CI_CLI_TIMEOUT`, `GITLAB_CI_CLI_OUTPUT`
   - `getConfig()` — full chain: load files → merge → env override → CLI flag override
   - Invalid JSON handling: warning + continue with defaults

3. Write tests for config layer — 9 scenarios covering all config spec scenarios (load project, load user, merge, no files, invalid JSON, env override, precedence chain, all supported keys, unrecognized keys silently ignored)

## Phase 2: API Client Base

4. Create `src/types/api.ts` — Shared API types:
   - `GitLabApiError` — error response shape (`message`, `code`, `status`)
   - `PaginationParams` — `page`, `perPage`
   - `ApiResult<T>` — success/error discriminated union

5. Create `src/api/gitlab.ts` — Base GitLab API client class/function:
   - Constructor accepts `GitLabCIConfig` (or subsets)
   - `request<T>(method, path, options?)` — core HTTP method using native `fetch`
   - Bearer token auth from config
   - Configurable base URL (`gitlabUrl`)
   - Configurable timeout
   - JSON response parsing with type safety
   - Error handling: 401 → `AuthenticationError`, 403 → `PermissionError`, 404 → `NotFoundError`, 429 → `RateLimitError` (with `Retry-After`), 500+ → `ServerError`, network → `NetworkError`
   - `get paginated<T>(path, params?)` — returns `AsyncGenerator<T>` for automatic pagination (`Link` header or `page`/`perPage`)
   - Optional debug logging of requests/responses

6. Write tests for base API client — 11 scenarios (authenticated GET, POST, timeout, all HTTP error codes, network error, paginated request, no token warning)

## Phase 3: Catalog API Methods

7. Create `src/types/catalog.ts` — Catalog-specific types:
   - `CatalogComponent` — name, full_path, version, description, latest_tag
   - `CatalogComponentDetail` — extended with inputs, jobs, workflows

8. Create `src/api/catalog.ts` — Catalog API methods:
   - `listComponents(namespace, pagination?)` → GET `/projects/:id/ci/catalog/components`
   - `searchComponents(query, pagination?)` → GET with search parameter
   - `getComponentInfo(fullPath)` → GET `/ci/catalog/components/:full_path`
   - All methods use the base client from `gitlab.ts`

9. Write tests for catalog API methods — 5 scenarios (list, search, info, empty results, 404 component)

## Phase 4: CI Lint API Methods

10. Create `src/api/lint.ts` — CI Lint API methods:
    - `validate(content, options?)` → POST `/api/v4/validate` with YAML content
    - Optional `include_jobs` param for detailed validation
    - Returns validation result with status, errors, warnings

11. Write tests for lint API methods — 4 scenarios (valid, invalid, warnings, server error)

## Phase 5: Documentation & Finalization

12. Touch `src/index.ts` — wire config loading into CLI startup flow so commands can access config

13. Verify build and all tests pass:
    ```bash
    npx tsc --noEmit
    npx vitest run
    ```

---

**Notes**:
- Total: 13 tasks across 5 phases
- Zero new npm dependencies (uses native `fetch`)
- Config layer must complete before API client (Phase 1 before Phase 2)
- Catalog and Lint APIs can be implemented in parallel once Phase 2 is done
- No user-facing command changes — all work is internal infrastructure
