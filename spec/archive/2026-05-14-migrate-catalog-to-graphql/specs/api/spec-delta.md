# Spec Delta: API Client

This file contains specification changes for `spec/specs/api/spec.md`.

## ADDED Requirements

### Requirement: GraphQL API Client

WHEN a command needs to query GitLab CI/CD Catalog resources via GraphQL,
the GraphQL API client SHALL provide a query method that sends POST requests to the GitLab GraphQL endpoint without requiring authentication for public resources.

#### Scenario: Query public catalog resource without token

GIVEN no GitLab token is configured
WHEN a command calls `graphqlQuery("query { ciCatalogResource(fullPath: \"org/component\") { id name } }")`
THEN the client sends a POST request to `/api/graphql`
AND does NOT include an `Authorization` header
AND returns the parsed `data` field from the GraphQL response
AND does NOT throw a `ConfigurationError`

#### Scenario: Query with authentication (optional token)

GIVEN a valid GitLab token is configured
WHEN a command calls `graphqlQuery(query, variables, { token })`
THEN the client includes `Authorization: Bearer <token>` in the request headers
AND returns the parsed `data` field

#### Scenario: GraphQL response with errors

GIVEN a GraphQL query that returns errors in the response (e.g., invalid query syntax)
WHEN the client receives a response with both `data` and `errors` fields
THEN the client logs the errors for debugging
AND returns the partial `data` field
AND does not throw (caller handles partial data)

#### Scenario: GraphQL resource not found (null data)

GIVEN a `ciCatalogResource(fullPath:)` query for a nonexistent path
WHEN the client receives `{ "data": { "ciCatalogResource": null } }`
THEN the client returns `null` for the resource field
AND the calling CatalogApi method SHALL throw a `NotFoundError`

#### Scenario: GraphQL network error

GIVEN the GitLab instance is unreachable
WHEN the client attempts to send a GraphQL query
THEN the client throws a `NetworkError` with a descriptive message

---

## MODIFIED Requirements

### Requirement: GitLab API Base Client
**Previous**: The base API client required a token for all requests and threw `ConfigurationError` when no token was configured.

WHEN a command needs to communicate with a GitLab instance using REST API endpoints,
the base API client SHALL provide authenticated HTTP request methods with configurable base URL, timeout, and structured error handling.

**No change to:**
- Authenticated GET/POST requests with valid token
- Request with custom timeout
- 401/403/404/429/500 error handling
- Network connectivity error handling
- Pagination

#### Scenario: No token configured (MODIFIED)

GIVEN no token is provided via config file, env var, or CLI flag
WHEN a command sends an API request through `GitLabApiClient`
THEN the client throws a `ConfigurationError`
AND suggests setting `GITLAB_CI_CLI_TOKEN` or adding `token` to the config file

**Change**: This scenario now only applies to endpoints that require authentication (CI Lint API). The new `GraphQLApiClient` handles Catalog queries without a token.

---

## REMOVED Requirements

### Requirement: Token required for Catalog API Methods
**Reason for removal**: Catalog API now uses GraphQL which does not require authentication for public resources.

**Migration path**: `CatalogApi` implementations should use `GraphQLApiClient` instead of `GitLabApiClient`. The `CatalogApi` methods for listing, searching, and fetching component details no longer need a token.

---

## Notes

- The `GitLabApiClient` class is retained exclusively for the CI Lint API (`LintApi`) which requires authentication
- The new `GraphQLApiClient` handles all Catalog queries
- Token is OPTIONAL for GraphQL queries — authenticated tokens can be passed for higher rate limits or private resources
