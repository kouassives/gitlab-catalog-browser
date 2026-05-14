# Pipeline Validation Specification

## Overview

This capability enables AI agents to validate `.gitlab-ci.yml` pipeline configurations using the GitLab CI Lint API. It provides syntax validation, rules evaluation via dry-run, and project-context-aware validation.

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

WHEN a user provides a project path with the `--project` flag,
the CLI SHALL use project-specific CI variables, includes, and settings for more accurate validation.

#### Scenario: Validate with project variables

GIVEN a GitLab project path "my-group/my-project"
AND a `.gitlab-ci.yml` file that references project-level CI variables
WHEN the user executes `gitlab-catalog-browser validate --project my-group/my-project .gitlab-ci.yml`
THEN the CLI fetches the project's CI variables from the GitLab API
AND includes them during validation
AND returns results that reflect the project-specific context
AND exits with code 0

#### Scenario: Validate with project includes

GIVEN a `.gitlab-ci.yml` file with `include:project` references
WHEN the user executes `gitlab-catalog-browser validate --project my-group/my-project .gitlab-ci.yml`
THEN the CLI resolves project includes against the specified project
AND validates the fully resolved configuration
AND exits with code 0

#### Scenario: Validate with insufficient permissions

GIVEN a project path for which the token lacks access
WHEN the user executes `gitlab-catalog-browser validate --project private-group/private-project .gitlab-ci.yml`
THEN the CLI displays an error "Insufficient permissions to access project 'private-group/private-project'"
AND falls back to standard validation without project context
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
| `gitlab-catalog-browser validate --project <path> <file>` | Validate with project context |
| `gitlab-catalog-browser validate --stdin` | Validate piped content |
| `gitlab-catalog-browser validate <file> --json` | Output results as JSON |

## Global Flags

| Flag | Description |
|------|-------------|
| `--gitlab-url <url>` | GitLab instance URL (default: https://gitlab.com) |
| `--token <token>` | GitLab personal access token |
