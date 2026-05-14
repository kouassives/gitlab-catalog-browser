# Spec Delta: GitLab API Client

This file defines the new `spec/specs/api/spec.md` living specification for the GitLab API client capability.

## ADDED Requirements

### Requirement: GitLab API Base Client

WHEN any command needs to communicate with a GitLab instance,
the base API client SHALL provide authenticated HTTP request methods with configurable base URL, timeout, and structured error handling.

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
WHEN a command sends an API request
THEN the client detects that no token is configured
AND throws a `ConfigurationError`
AND suggests setting `GITLAB_CI_CLI_TOKEN` or adding `token` to the config file

#### Scenario: Paginated GET request

GIVEN an endpoint that supports pagination via `page` and `per_page` query parameters
WHEN a command requests a paginated resource
THEN the client accepts optional `page` and `perPage` parameters
AND passes them as query parameters to the API
AND returns the response with metadata (current page, total pages if available)

---

### Requirement: Catalog API Methods

WHEN a command needs to query GitLab CI/CD Catalog components,
the catalog API SHALL provide typed methods for listing, searching, and fetching component details.

#### Scenario: List components for a namespace

GIVEN a GitLab namespace "to-be-continuous"
WHEN `listComponents("to-be-continuous", { page: 1, perPage: 20 })` is called
THEN the client sends a GET request to `/projects/:id/ci/catalog/components` (resolving the namespace to a project ID)
AND returns an array of `CatalogComponent` objects
AND each object contains `name`, `full_path`, `version`, `description`, `latest_tag`

#### Scenario: Search components by keyword

GIVEN a search query "docker build"
WHEN `searchComponents("docker build", { page: 1, perPage: 20 })` is called
THEN the client sends a GET request with the search parameter
AND returns matching `CatalogComponent` objects

#### Scenario: Get component info

GIVEN a component with full path "to-be-continuous/docker-build"
WHEN `getComponentInfo("to-be-continuous/docker-build")` is called
THEN the client sends a GET request to `/ci/catalog/components/to-be-continuous/docker-build`
AND returns a `CatalogComponentDetail` object with full specification

#### Scenario: List components with empty namespace

GIVEN a namespace with no published components
WHEN `listComponents("empty-org")` is called
THEN the client returns an empty array
AND does not throw an error

#### Scenario: Get info for nonexistent component

GIVEN a component path that does not exist
WHEN `getComponentInfo("nonexistent/component")` is called
THEN the base client throws a `NotFoundError`
AND the catalog method does not catch it (propagates to the caller)

---

### Requirement: CI Lint API Methods

WHEN a command needs to validate GitLab CI pipeline YAML,
the lint API SHALL provide methods to submit YAML to the GitLab CI Lint endpoint.

#### Scenario: Validate YAML content

GIVEN a valid `.gitlab-ci.yml` content string
WHEN `validate(content)` is called
THEN the client sends a POST request to `/api/v4/validate`
WITH JSON body `{ "content": "<yaml content>" }`
AND returns a validation result with `status: "valid"`, empty `errors` array, and optional `warnings`

#### Scenario: Validate invalid YAML

GIVEN a `.gitlab-ci.yml` with syntax errors
WHEN `validate(invalidContent)` is called
THEN the client sends the POST request
AND returns a validation result with `status: "invalid"`, `errors` array (each with `line`, `column`, `message`), and optional `warnings`

#### Scenario: Validate with project context

GIVEN a project path "my-group/my-project"
WHEN `validate(content, { project: "my-group/my-project" })` is called
THEN the client includes `include_jobs: true` in the request body
AND the API validates with the project's CI variables and includes context

#### Scenario: Validate with dry-run rules evaluation

GIVEN a pipeline with conditional `rules:` clauses
WHEN `validate(content, { dryRun: true })` is called
THEN the client sends a POST request with `dry: true` in the body
AND the API returns which jobs would execute and which would be excluded

---

## Notes

- All three requirements are purely additive — no existing behavior is modified
- The base client (Requirement 1) is used by catalog (Requirement 2) and lint (Requirement 3) methods
- Error types inherit from a common `GitLabApiError` base class for consistent handling
- All HTTP methods use Node.js native `fetch` (available in Node.js 18+)
- Pagination follows GitLab's standard `page`/`per_page` query parameter convention
