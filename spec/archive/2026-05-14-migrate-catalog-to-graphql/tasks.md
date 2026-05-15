# Implementation Tasks

## Phase 1: GraphQL Client Foundation

1. **Create `GraphQLApiClient` class**
   - Implement `GraphQLApiClient` in `src/api/graphql.ts`
   - Support configurable `gitlabUrl` (default: `https://gitlab.com`)
   - Accept optional token (no `ConfigurationError` if absent)
   - Implement `query<T>(query: string, variables?: Record<string, unknown>)` method
   - POST to `/api/graphql` with JSON body `{ query, variables }`
   - Handle standard GraphQL errors (return `errors` array in response)
   - Map HTTP errors to existing error types (`NetworkError`, `ServerError`, etc.)
   - Add unit tests for `GraphQLApiClient`

2. **Update `GitLabApiClient` to make token optional (or create a relaxed variant)**
   - Decide: keep token check for LintApi, or remove it and handle 401 gracefully
   - Ensure `ConfigurationError` only triggers when a command truly needs a token
   - Update tests accordingly

## Phase 2: Catalog API Rewrite

3. **Implement GraphQL queries for `CatalogApi.listComponents()`**
   - Build query using `ciCatalogResources` with `search` and pagination arguments
   - Map cursor-based pagination to page-based interface
   - Parse `CiCatalogResourceConnection` response into `CatalogComponent[]`
   - Handle empty results
   - Add unit tests

4. **Implement GraphQL queries for `CatalogApi.searchComponents()`**
   - Same as task 3 but with `search` keyword parameter
   - Add unit tests with search results and no-results cases

5. **Implement GraphQL queries for `CatalogApi.getComponentInfo()`**
   - Build query using `ciCatalogResource(fullPath:)` with `versions`, `components`, `inputs` fields
   - Parse `CiCatalogResource` response into `CatalogComponentDetail`
   - Handle component not found (null response)
   - Add unit tests

## Phase 3: Command Wiring

6. **Update `commands/catalog.ts`**
   - Change `createCatalogApi()` to use `GraphQLApiClient`
   - Verify all three handlers (`list`, `search`, `info`) work without token
   - Run existing catalog tests, update if needed

7. **Update `commands/component.ts`**
   - Change `createCatalogApi()` to use `GraphQLApiClient`
   - Verify all four handlers (`schema`, `inputs`, `workflows`, `jobs`) work without token
   - Run existing component tests, update if needed

## Phase 4: Type Alignment

8. **Review and update catalog types**
   - Compare `CatalogComponent` / `CatalogComponentDetail` against GraphQL response shape
   - Adjust fields if GraphQL returns different field names or nesting
   - Remove `resolveNamespace()` — GraphQL uses `fullPath` directly

## Phase 5: Spec & Documentation Updates

9. **Update `spec/specs/api/spec.md`**
   - Add `GraphQLApiClient` requirements and scenarios
   - Update Catalog API Methods section for GraphQL
   - Add scenario: GraphQL query without authentication succeeds for public resources
   - Keep GitLabApiClient / LintApi sections unchanged

10. **Update `spec/specs/catalog/spec.md`**
    - Remove token preconditions from all scenarios
    - Reference GraphQL queries instead of REST endpoints
    - Add pagination scenarios aligned with cursor-based pagination

11. **Update `spec/specs/component/spec.md`**
    - Remove token preconditions from all scenarios
    - Reference GraphQL queries instead of REST endpoints

## Phase 6: Validation

12. **End-to-end validation**
    - Run full test suite: `npm test`
    - Verify `catalog list` works without any token configured
    - Verify `catalog search` works without token
    - Verify `catalog info` works without token
    - Verify `component schema/inputs/workflows/jobs` work without token
    - Verify `validate` still requires a token (graceful error message)
    - Verify all commands still work WITH a token (regression)

---

**Notes**:
- Each task is independently completable and testable
- Tasks 3-5 can be parallelized
- Tasks 6-7 depend on tasks 1-5
- Task 12 is the final validation gate
