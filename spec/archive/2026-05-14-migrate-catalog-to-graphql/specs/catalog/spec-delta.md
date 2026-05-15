# Spec Delta: Catalog Browsing

This file contains specification changes for `spec/specs/catalog/spec.md`.

## MODIFIED Requirements

### Requirement: List Catalog Components
**Previous**: Token-based REST GET to `/projects/:id/ci/catalog/components`.

WHEN a user provides a GitLab namespace or organization name,
the CLI SHALL fetch and display all published CI/CD catalog components from that namespace
using the GitLab GraphQL API without requiring authentication.

#### Scenario: List all components in a namespace
GIVEN a GitLab instance URL configured via `--gitlab-url` or config file
AND no token is required
WHEN the user executes `gitlab-catalog-browser catalog list --org to-be-continuous`
THEN the CLI sends a GraphQL query `ciCatalogResources(search: "to-be-continuous")`
AND displays each component with its name, version, and description in a formatted table
AND exits with code 0

#### Scenario: List with JSON output
GIVEN the same preconditions as a standard list
WHEN the user executes `gitlab-catalog-browser catalog list --org to-be-continuous --json`
THEN the CLI outputs the component list as a JSON array
AND each entry contains `name`, `full_path`, `version`, `description`
AND exits with code 0

#### Scenario: List with empty namespace
GIVEN no components exist in the specified namespace
WHEN the user executes `gitlab-catalog-browser catalog list --org empty-org`
THEN the CLI displays a message "No components found in namespace 'empty-org'"
AND exits with code 0

#### Scenario: List with pagination
GIVEN a namespace with many components
WHEN the user executes `gitlab-catalog-browser catalog list --org large-org --page 2 --per-page 10`
THEN the CLI maps page/per-page to GraphQL cursor-based pagination (first/skip)
AND displays the second page with 10 results
AND exits with code 0

---

### Requirement: Search Catalog Components
**Previous**: Token-based REST GET with search parameter.

WHEN a user provides a keyword search query,
the CLI SHALL return catalog components matching the keyword across namespaces
using the GitLab GraphQL API without requiring authentication.

#### Scenario: Search by keyword
GIVEN a search query string "docker build"
WHEN the user executes `gitlab-catalog-browser catalog search "docker build"`
THEN the CLI queries using `ciCatalogResources(search: "docker build")`
AND displays matching components with name, version, and description
AND exits with code 0

#### Scenario: Search with pagination
GIVEN a search that returns many results
WHEN the user executes `gitlab-catalog-browser catalog search "test" --page 2 --per-page 10`
THEN the CLI returns the second page with 10 results per page
AND exits with code 0

#### Scenario: Search with no results
GIVEN a search query that matches no components
WHEN the user executes `gitlab-catalog-browser catalog search "zzzznonexistent"`
THEN the CLI displays a message "No components matching 'zzzznonexistent'"
AND exits with code 0

---

### Requirement: Display Catalog Component Summary
**Previous**: Token-based REST GET to `/ci/catalog/components/:full_path`.

WHEN a user provides a full component path,
the CLI SHALL display a summary of that component including version, description, and input count
using the GitLab GraphQL API without requiring authentication.

#### Scenario: Show component info
GIVEN a component with full path "to-be-continuous/docker-build"
WHEN the user executes `gitlab-catalog-browser catalog info to-be-continuous/docker-build`
THEN the CLI queries using `ciCatalogResource(fullPath: "to-be-continuous/docker-build")`
AND displays the component name, latest version, description, number of inputs, and number of jobs
AND exits with code 0

#### Scenario: Show info for nonexistent component
GIVEN a component path that does not exist
WHEN the user executes `gitlab-catalog-browser catalog info nonexistent/component`
THEN the CLI displays an error message "Component 'nonexistent/component' not found"
AND exits with non-zero code

---

## REMOVED Requirements

### Requirement: Token preconditions for Catalog commands
**Reason for removal**: Catalog commands no longer require a GitLab token. The GraphQL API accepts unauthenticated queries for public catalog resources.

**Migration path**: Users can remove `GITLAB_CI_CLI_TOKEN` from their environment if they only use Catalog commands. No action required for existing token-based workflows (tokens are silently ignored by GraphQL queries but still accepted).

---

## REMOVED Requirements

### Requirement: REST endpoint references
**Reason for removal**: All Catalog API methods now use GraphQL queries. REST endpoints (`/projects/:id/ci/catalog/components`, `/ci/catalog/components`, `/ci/catalog/components/:full_path`) are no longer called.

**Migration path**: Internal implementation change only — no user-facing impact.

---

## Notes

- The `--token` flag is still accepted but silently ignored for Catalog operations (backward compatibility)
- Token is still required for the `validate` command (CI Lint API)
- GraphQL queries are isolated to the `CatalogApi` class — changing schema or migrating back to REST only requires modifying that class
