# Pipeline Validation Specification

## Overview

This capability enables AI agents to validate `.gitlab-ci.yml` pipeline configurations using the GitLab CI Lint API. It provides syntax validation, rules evaluation via dry-run, and project-context-aware validation.

## Key Concepts

### Local file vs Project context

The `validate` command takes two distinct inputs that serve different purposes:

| Input | Role | Example |
|-------|------|---------|
| `<file>` argument | The **local file** being edited — the pipeline config you want to test | `validate .gitlab-ci.yml` |
| `--project <id-or-path>` | The **GitLab project context** used by the CI Lint API to resolve includes, evaluate rules, and access project variables | `--project 80468771` |

The `<file>` is **your working copy**, not yet committed or pushed. The `--project` is **not** the source of the file — the API does NOT fetch `.gitlab-ci.yml` from the project. It only uses the project as context to give an accurate validation verdict.

### Why `--project` is required

GitLab 14.0+ removed the global `/api/v4/ci/lint` endpoint. Every CI Lint request must now target a specific project:
`/api/v4/projects/:id/ci/lint`. The project provides runners configuration, CI variables, and a scope for `include:` resolution.

### Validation levels

| Level | Requires | Catches |
|-------|----------|---------|
| **Local** (always runs) | Nothing — pure YAML parsing | Syntax errors, empty config, common typos (`scripts` → `script`) |
| **API** (adds to local) | Token + `--project` | Include resolution, rules evaluation, variable expansion |

---

## Requirements

### Requirement: Validate Local Pipeline File

WHEN a user provides a `.gitlab-ci.yml` file path,
the CLI SHALL validate the file content using the GitLab CI Lint API and report results.

#### Scenario: Valid pipeline file

GIVEN a syntactically correct `.gitlab-ci.yml` file at path `./.gitlab-ci.yml`
WHEN the user executes `gitlab-catalog-browser validate .gitlab-ci.yml`
THEN the CLI reads the file content
AND sends it to the GitLab CI Lint API endpoint `/api/v4/validate`
AND displays a success message "Pipeline configuration is valid"
AND exits with code 0

#### Scenario: Invalid pipeline file

GIVEN a `.gitlab-ci.yml` file with syntax errors
WHEN the user executes `gitlab-catalog-browser validate .gitlab-ci.yml`
THEN the CLI sends the file content to the Lint API
AND displays each error with its location (line number, column)
AND displays the error message from the API
AND exits with non-zero code

#### Scenario: Pipeline with warnings

GIVEN a `.gitlab-ci.yml` file that is valid but has warnings
WHEN the user executes `gitlab-catalog-browser validate .gitlab-ci.yml`
THEN the CLI displays the validation result as valid
AND separately lists each warning with location and description
AND exits with code 0

#### Scenario: File not found

GIVEN a file path that does not exist
WHEN the user executes `gitlab-catalog-browser validate nonexistent.yml`
THEN the CLI displays an error message "File 'nonexistent.yml' not found"
AND exits with non-zero code

---

### Requirement: Validate with Dry-Run (Rules Evaluation)

WHEN a user provides a `.gitlab-ci.yml` file with the `--dry-run` flag,
the CLI SHALL evaluate `rules:` conditions and show which jobs would execute.

#### Scenario: Dry-run with rules evaluation

GIVEN a `.gitlab-ci.yml` file with conditional `rules:` clauses
WHEN the user executes `gitlab-catalog-browser validate --dry-run .gitlab-ci.yml`
THEN the CLI evaluates each job's rules against the current GitLab context
AND displays which jobs would execute
AND displays which jobs would be excluded and why
AND shows the effective pipeline structure
AND exits with code 0

#### Scenario: Dry-run with simulated variables

GIVEN a pipeline with variable-dependent rules
WHEN the user executes `gitlab-catalog-browser validate --dry-run .gitlab-ci.yml --var CI_PIPELINE_SOURCE=merge_request_event`
THEN the CLI simulates the pipeline as if triggered by a merge request event
AND shows which jobs would execute in that context
AND exits with code 0

---

### Requirement: Validate with Project Context

WHEN a user provides a project ID or path with the `--project` flag,
the CLI SHALL send the local file content to the project-specific CI Lint endpoint
for more accurate validation that includes project variables, includes resolution, and rules evaluation.

The `--project` value is **not** used to fetch a file from GitLab — it is only
a context qualifier for the API. The file being validated is always the local
`<file>` argument (or stdin with `--stdin`).

#### Scenario: Validate with project variables

GIVEN a local `.gitlab-ci.yml` file that references project-level CI variables
AND a GitLab project path "my-group/my-project"
WHEN the user executes `gitlab-catalog-browser validate .gitlab-ci.yml --project my-group/my-project`
THEN the CLI sends the **local** file content to the project-specific CI Lint endpoint
AND the API evaluates project variables against the local content
AND returns results that reflect the project-specific context
AND exits with code 0

#### Scenario: Validate with project includes

GIVEN a local `.gitlab-ci.yml` file with `include:project` references
WHEN the user executes `gitlab-catalog-browser validate .gitlab-ci.yml --project my-group/my-project`
THEN the CLI sends the **local** file content to the project-specific CI Lint endpoint
AND the API resolves project includes against the specified project
AND validates the fully resolved configuration
AND exits with code 0

#### Scenario: Validate with insufficient permissions

GIVEN a local `.gitlab-ci.yml` file
AND a project path for which the token lacks access
WHEN the user executes `gitlab-catalog-browser validate .gitlab-ci.yml --project private-group/private-project`
THEN the CLI displays an error "Insufficient permissions to access project 'private-group/private-project'"
AND falls back to local-only validation (still validates the local file)
AND exits with non-zero code

---

### Requirement: Validate from Stdin

WHEN a user pipes pipeline content via stdin,
the CLI SHALL validate the piped content directly.

#### Scenario: Validate piped content

GIVEN pipeline YAML content piped to the CLI
WHEN the user executes `echo "stages: [build]" | gitlab-catalog-browser validate --stdin`
THEN the CLI reads the pipeline content from stdin
AND validates it using the GitLab CI Lint API
AND displays the validation result
AND exits with code 0 or non-zero based on validity

---

## Command Reference

| Command | Description |
|---------|-------------|
| `gitlab-catalog-browser validate <file>` | Validate .gitlab-ci.yml file |
| `gitlab-catalog-browser validate --dry-run <file>` | Validate with rules evaluation |
| `gitlab-catalog-browser validate --dry-run <file> --var <key=value>` | Dry-run with simulated variables |
| `gitlab-catalog-browser validate <file> --project <id-or-path>` | Validate local file against project context (resolves includes, evaluates rules) |
| `gitlab-catalog-browser validate --stdin` | Validate piped content |
| `gitlab-catalog-browser validate <file> --json` | Output results as JSON |

## Global Flags

| Flag | Description |
|------|-------------|
| `--gitlab-url <url>` | GitLab instance URL (default: https://gitlab.com) |
| `--token <token>` | GitLab personal access token |
