# GitLab API Client Specification

## Overview

This capability provides HTTP clients for communicating with GitLab instances:
- **GraphQL API Client** for CI/CD Catalog queries (no token needed for public resources)
- **REST API Client** for CI Lint validation (token required)
- **Catalog API** for browsing CI/CD components via GraphQL
- **CI Lint API** for validating pipeline configurations via REST

---

## Requirements

### Requirement: GraphQL API Client

WHEN a command needs to query GitLab CI/CD Catalog resources via GraphQL,
the GraphQL API client SHALL provide a query method that sends POST requests
to the GitLab GraphQL endpoint without requiring authentication for public resources.

#### Scenario: Query public catalog resource without token

GIVEN no GitLab token is configured
WHEN a command performs a `query()` call to fetch public catalog data
THEN the client sends a POST request to `/api/graphql`
AND does NOT include an `Authorization` header
AND returns the parsed `data` field from the GraphQL response
AND does NOT throw a `ConfigurationError`

#### Scenario: Query with authentication (optional token)

GIVEN a valid GitLab token is configured via config file or `GITLAB_CI_CLI_TOKEN` env var
WHEN a command performs a `query()` call
THEN the client includes `Authorization: Bearer <token>` in the request headers
AND returns the parsed `data` field

#### Scenario: GraphQL HTTP error handling

GIVEN the GitLab GraphQL endpoint returns an HTTP error (4xx or 5xx)
WHEN a command performs a `query()` call
THEN the client throws the appropriate error type
AND does not retry the request

#### Scenario: GraphQL resource not found

GIVEN a `ciCatalogResource(fullPath:)` query for a nonexistent path
WHEN the client receives a GraphQL error indicating the resource does not exist
THEN the client throws a `NotFoundError`
AND includes the resource path in the error message

#### Scenario: GraphQL network error

GIVEN the GitLab instance is unreachable
WHEN a command performs a `query()` call
THEN the client catches the network error
AND throws a `NetworkError`

---

### Requirement: GitLab API Base Client (REST)

WHEN a command needs to communicate with a GitLab instance using REST API endpoints,
the base REST client SHALL provide authenticated HTTP request methods
with configurable base URL, timeout, and structured error handling.

NOTE: This client requires a token and is used only by the CI Lint API.

#### Scenario: Authenticated GET request

GIVEN a valid GitLab token configured via config file or `GITLAB_CI_CLI_TOKEN` env var
AND a GitLab instance URL configured via config file or `GITLAB_CI_CLI_URL` env var
WHEN a command sends a GET request to an API endpoint
THEN the client constructs the full URL from `gitlabUrl` + endpoint path
AND adds the `Authorization: Bearer <token>` header
AND sends the request with a default timeout of 30 seconds
AND returns the JSON-parsed response
AND exits with code 0

#### Scenario: Authenticated POST request with JSON body

GIVEN a valid GitLab token and instance URL
WHEN a command sends a POST request with a JSON body
THEN the client sets `Content-Type: application/json`
AND serializes the body object to JSON
AND sends the authenticated request
AND returns the JSON-parsed response

#### Scenario: Request with custom timeout

GIVEN a configuration with `timeout: 10000` (10 seconds)
WHEN a command sends an API request
THEN the client uses the configured timeout value
AND aborts the request if the server does not respond within 10 seconds
AND throws a timeout error

#### Scenario: 401 Unauthorized response

GIVEN an expired or invalid GitLab token
WHEN the client sends an authenticated request
AND the API returns HTTP 401
THEN the client throws an `AuthenticationError`
AND includes the message "Authentication failed — token may be expired or invalid"
AND does NOT retry the request

#### Scenario: 403 Forbidden response

GIVEN a token that lacks permissions for the requested resource
WHEN the client sends a request
AND the API returns HTTP 403
THEN the client throws a `PermissionError`
AND includes a message indicating insufficient permissions
AND suggests checking token scopes

#### Scenario: 404 Not Found response

GIVEN a request to a nonexistent resource
WHEN the client sends a request
AND the API returns HTTP 404
THEN the client throws a `NotFoundError`
AND includes the resource path in the error message

#### Scenario: 429 Rate Limited response

GIVEN the client has exceeded the GitLab API rate limit
WHEN the client sends a request
AND the API returns HTTP 429
THEN the client reads the `Retry-After` header if present
AND throws a `RateLimitError`
AND includes the retry-after duration in the error message

#### Scenario: 500+ Server Error response

GIVEN the GitLab instance is experiencing internal errors
WHEN the client sends a request
AND the API returns HTTP 500 or higher
THEN the client throws a `ServerError`
AND includes the HTTP status code and status text

#### Scenario: Network connectivity error

GIVEN the machine has no network connectivity
OR the GitLab host is unreachable
WHEN the client attempts to send a request
THEN the client catches the network error
AND throws a `NetworkError`
AND includes a message "Unable to reach GitLab instance at <url>"

#### Scenario: No token configured

GIVEN no token is provided via config file, env var, or CLI flag
WHEN a command sends an API request through the REST client
THEN the client detects that no token is configured
AND throws a `ConfigurationError`
AND suggests setting `GITLAB_CI_CLI_TOKEN` or adding `token` to the config file

---

### Requirement: Catalog API Methods

WHEN a command needs to query GitLab CI/CD Catalog components,
the catalog API SHALL provide typed methods for listing, searching,
and fetching component details using the GraphQL API.

#### Scenario: List components for a namespace

GIVEN a GitLab namespace "to-be-continuous"
WHEN `listComponents("to-be-continuous", { page: 1, perPage: 20 })` is called
THEN the client sends a GraphQL query `group(fullPath:)` to `/api/graphql`
AND filters results by `isCatalogResource: true`
AND returns an array of `CatalogComponent` objects
AND each object contains `name`, `full_path`, `description`

#### Scenario: Search components by keyword

GIVEN a search query "docker build"
WHEN `searchComponents("docker build", { page: 1, perPage: 20 })` is called
THEN the client sends a GraphQL query with the search parameter
AND returns matching `CatalogComponent` objects

#### Scenario: Get component info

GIVEN a component with full path "to-be-continuous/docker"
WHEN `getComponentInfo("to-be-continuous/docker")` is called
THEN the client sends a GraphQL query `ciCatalogResource(fullPath:)` with versions and components
AND returns a `CatalogComponentDetail` object with inputs, jobs, and workflows

#### Scenario: List components with empty namespace

GIVEN a namespace with no published components
WHEN `listComponents("empty-org")` is called
THEN the client returns an empty array
AND does not throw an error

#### Scenario: Get info for nonexistent component

GIVEN a component path that does not exist
WHEN `getComponentInfo("nonexistent/component")` is called
THEN the GraphQL client throws a `NotFoundError`
AND the catalog method propagates it to the caller

---

### Requirement: CI Lint API Methods

WHEN a command needs to validate GitLab CI pipeline YAML,
the lint API SHALL provide methods to submit YAML to the GitLab CI Lint endpoint
via the authenticated REST client.

*Note: GitLab 14.0+ removed the global `/api/v4/ci/lint` endpoint.
A `project` is always required — it provides the context for include resolution,
rules evaluation, and project variables. Endpoints use the `/api/v4/` prefix.*

The `content` passed to `validate()` is the **local file content** being tested,
not a file fetched from the project. The `project` option is only a context
qualifier for the API endpoint.

#### Scenario: Validate YAML content

GIVEN a valid `.gitlab-ci.yml` content string (from a local file)
AND a project path "my-group/my-project"
WHEN `validate(content, { project: "my-group/my-project" })` is called
THEN the client sends a POST request to `/api/v4/projects/my-group%2Fmy-project/ci/lint`
WITH JSON body `{ "content": "<yaml content>" }`
AND returns a validation result with `valid: true`, empty `errors` array, and empty `warnings` array

#### Scenario: Validate invalid YAML

GIVEN a `.gitlab-ci.yml` with syntax errors (from a local file)
AND a project path "my-group/my-project"
WHEN `validate(invalidContent, { project: "my-group/my-project" })` is called
THEN the client sends the POST request
AND returns a validation result with `valid: false`, `errors` array of strings, and `warnings` array of strings

#### Scenario: Validate with project context

GIVEN a project path "my-group/my-project"
WHEN `validate(content, { project: "my-group/my-project" })` is called
THEN the client uses the project-specific lint endpoint `/api/v4/projects/:id/ci/lint`
AND the API validates the **submitted content** against the **project's** CI variables, includes, and settings
AND does NOT fetch a file from the project — the content argument is the local file content

#### Scenario: Validate with dry-run rules evaluation

GIVEN a pipeline with conditional `rules:` clauses
AND a project path "my-group/my-project"
WHEN `validate(content, { project: "my-group/my-project", dryRun: true })` is called
THEN the client sends a POST request with `dry_run: true` in the body
AND the API returns which jobs would execute and which would be excluded

#### Scenario: Missing project throws ConfigurationError

GIVEN no project path is specified
WHEN `validate(content, {})` is called
THEN the client throws a `ConfigurationError`
AND the error message instructs the user to provide `--project`
AND explains that the project is needed as API validation context (not as file source)

---

### Requirement: Local YAML Validation

WHEN no GitLab credentials are available,
the CLI SHALL perform local YAML syntax and structure validation
as a free first-pass check.

#### Scenario: Valid local YAML syntax

GIVEN a valid `.gitlab-ci.yml` content string with jobs
WHEN `validateLocal(content)` is called
THEN the function returns `status: "valid"`
AND `errors` is an empty array
AND `looksLikeGitLabCI` is `true`

#### Scenario: Invalid YAML syntax

GIVEN a `.gitlab-ci.yml` with invalid YAML syntax
WHEN `validateLocal(brokenContent)` is called
THEN the function returns `status: "invalid"`
AND errors contain the YAML parse error with line and column

#### Scenario: Job without script

GIVEN a `.gitlab-ci.yml` where a job has no `script`, `trigger`, or `extends`
WHEN `validateLocal(content)` is called
THEN the function returns `status: "valid"`
AND a warning is emitted indicating the job has no script or trigger

#### Scenario: Common typos detected

GIVEN a `.gitlab-ci.yml` where a job uses `scripts` (plural) instead of `script`
WHEN `validateLocal(content)` is called
THEN a warning is emitted suggesting the correct key name

#### Scenario: Dot-prefixed job templates

GIVEN a `.gitlab-ci.yml` with only dot-prefixed (hidden) job templates
WHEN `validateLocal(content)` is called
THEN the function returns `status: "valid"`
AND `looksLikeGitLabCI` is `true`
AND no warning about missing script is emitted
