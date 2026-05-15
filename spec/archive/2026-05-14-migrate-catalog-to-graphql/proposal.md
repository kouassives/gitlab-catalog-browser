# Proposal: Migrate Catalog API from REST to GraphQL

## Why

The GitLab CI/CD Catalog API is currently accessed via REST endpoints (`/projects/:id/ci/catalog/components`, `/ci/catalog/components/:path`, etc.) through the `GitLabApiClient`, which **requires a GitLab personal access token** (`GITLAB_CI_CLI_TOKEN`) for every request.

However, the Catalog data is **public** — published components are meant to be browsable by anyone. The REST endpoints unnecessarily require authentication, while the GraphQL queries (`ciCatalogResource`, `ciCatalogResources`) work **without a token** for public resources.

**Context**:
- Users and AI agents should be able to browse the CI/CD Catalog without configuring a token
- The current `ConfigurationError` ("No GitLab token configured") blocks Catalog operations even for public data
- GitLab's documentation explicitly states: *"You can access some queries without authentication"*
- The CI Lint API (`validate` command) legitimately requires authentication — this is unchanged

**Current state**: All API calls (Catalog + Lint) go through `GitLabApiClient` which requires a token. Catalog commands fail with `ConfigurationError` when no token is set.

**Desired state**: Catalog commands (`catalog list`, `catalog search`, `catalog info`, `component schema`, `component inputs`, `component workflows`, `component jobs`) use GraphQL without requiring a token. The `validate` command still uses the REST client with a token.

## What Changes

- **Create `GraphQLApiClient`** — a lightweight GraphQL HTTP client that does NOT require authentication (token is optional, for queries that need it)
- **Rewrite `CatalogApi`** — replace REST endpoints with GraphQL queries (`ciCatalogResource`, `ciCatalogResources`)
- **Separate API concerns** — `CatalogApi` uses `GraphQLApiClient` (no token needed); `LintApi` continues using `GitLabApiClient` (token still needed)
- **Update `GitLabApiClient`** — remove `ConfigurationError` for missing token if desired, OR keep it strict for LintApi only
- **Update specs** — remove token preconditions from Catalog/Component scenarios, add GraphQL-specific scenarios
- **Update types** — align `CatalogComponent` / `CatalogComponentDetail` types with GraphQL response shapes

## Impact

### Affected Specifications
- `spec/specs/catalog/spec.md` — Remove token preconditions; reference GraphQL instead of REST
- `spec/specs/component/spec.md` — Remove token preconditions; reference GraphQL instead of REST
- `spec/specs/api/spec.md` — Add GraphQL client spec; update Catalog API methods to use GraphQL

### Affected Code
- `src/api/` — New `graphql.ts` (GraphQL client); rewrite `catalog.ts` (GraphQL queries); update `gitlab.ts` (remove/relax token requirement if needed)
- `src/commands/catalog.ts` — Update `createCatalogApi` to use `GraphQLApiClient`
- `src/commands/component.ts` — Same as above
- `src/types/` — Adjust catalog types to match GraphQL response structure

### User Impact
- **Positive**: Catalog commands work without a token — zero-config setup for browsing
- **None breaking**: Token-based workflows continue working; `validate` still requires a token

### API Changes
- **Internal**: Catalog API switches from REST to GraphQL (transparent to CLI users)
- **Removed**: `resolveNamespace()` method is no longer needed (GraphQL uses path-based lookup directly)

### Migration Required
- [ ] No database migration
- [ ] No API version bump
- [ ] No user communication needed (behavior improves silently)
- [x] Documentation updates (specs, README)

## Timeline Estimate

Medium — approximately 2-3 sessions:
- Session 1: `GraphQLApiClient` + update `GitLabApiClient`
- Session 2: Rewrite `CatalogApi` with GraphQL queries
- Session 3: Tests, spec updates, validation

## Risks

- **GraphQL schema stability**: `ciCatalogResource`/`ciCatalogResources` are marked as "Experiment" status in GitLab docs — field names could change. **Mitigation**: Isolate GraphQL queries in the `CatalogApi` class so schema changes are localized.
- **Rate limiting**: Unauthenticated GraphQL requests may have stricter rate limits. **Mitigation**: Document rate limit expectations; keep token support as an option for higher limits.
- **Pagination differences**: GraphQL uses cursor-based pagination (`before`/`after`/`first`/`last`) vs REST's page-based (`page`/`per_page`). **Mitigation**: Map pagination params in `CatalogApi` layer to keep CLI interface stable.
