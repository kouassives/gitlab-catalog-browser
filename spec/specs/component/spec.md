# Component Schema Inspection Specification

## Overview

This capability enables AI agents to inspect GitLab CI/CD component schemas in detail. It provides commands to retrieve complete component specifications including inputs, jobs, and workflow definitions via the GitLab GraphQL API without requiring authentication.

---

## Requirements

### Requirement: Get Component Full Schema

WHEN a user provides a component full path and optional version,
the CLI SHALL retrieve and display the complete specification of that component
using the GitLab GraphQL API.

#### Scenario: Get schema for latest version

GIVEN a component with full path "to-be-continuous/docker"
WHEN the user executes `gitlab-catalog-browser component schema to-be-continuous/docker`
THEN the CLI fetches the component specification via `ciCatalogResource(fullPath:)` GraphQL query
AND displays component inputs, jobs, and workflows
AND exits with code 0

#### Scenario: Get schema for nonexistent component

GIVEN a component path that does not exist
WHEN the user executes `gitlab-catalog-browser component schema nonexistent/component`
THEN the CLI displays an error message "Component 'nonexistent/component' not found"
AND exits with non-zero code

#### Scenario: Get schema with output file

GIVEN a component path
WHEN the user executes `gitlab-catalog-browser component schema to-be-continuous/docker --output-file ./docker.yml`
THEN the CLI saves the component specification to `./docker.yml`
AND displays a confirmation message with the file path
AND exits with code 0

---

### Requirement: Inspect Component Inputs

WHEN a user provides a component full path,
the CLI SHALL display a formatted list of all input parameters with their details
via the GitLab GraphQL API.

#### Scenario: List all inputs with details

GIVEN a component with full path "to-be-continuous/docker"
WHEN the user executes `gitlab-catalog-browser component inputs to-be-continuous/docker`
THEN the CLI displays each input parameter with:
  - Input name
  - Type (string, number, boolean)
  - Default value (if present)
  - Description/help text
  - Required or optional indicator
AND exits with code 0

#### Scenario: Show constrained inputs with options

GIVEN a component with inputs that have constrained options
WHEN the user executes `gitlab-catalog-browser component inputs to-be-continuous/docker`
THEN the CLI displays the available options for each constrained input
AND shows the default selection
AND exits with code 0

#### Scenario: Component with no inputs

GIVEN a component that defines no inputs
WHEN the user executes `gitlab-catalog-browser component inputs simple-component`
THEN the CLI displays a message "Component 'simple-component' defines no inputs"
AND exits with code 0

---

### Requirement: List Workflow Definitions

WHEN a user provides a component path,
the CLI SHALL return workflow definitions including trigger conditions and job dependencies
via the GitLab GraphQL API.

#### Scenario: List workflows with triggers

GIVEN a component with defined workflows
WHEN the user executes `gitlab-catalog-browser component workflows to-be-continuous/docker`
THEN the CLI displays each workflow definition from the component's GraphQL data
AND exits with code 0

#### Scenario: Component with no workflows

GIVEN a component with no workflow definitions
WHEN the user executes `gitlab-catalog-browser component workflows simple-component`
THEN the CLI displays a message "Component 'simple-component' defines no workflows"
AND exits with code 0

---

### Requirement: List Job Definitions

WHEN a user provides a component path,
the CLI SHALL list all job definitions with their stage, image, script, and configuration
via the GitLab GraphQL API.

#### Scenario: List all jobs with configuration

GIVEN a component with multiple job definitions
WHEN the user executes `gitlab-catalog-browser component jobs to-be-continuous/docker`
THEN the CLI displays each job with its name derived from the component's GraphQL data
AND exits with code 0

---

## Command Reference

| Command | Description |
|---------|-------------|
| `gitlab-catalog-browser component schema <full-path>` | Get complete component specification |
| `gitlab-catalog-browser component schema <full-path> --output-file <path>` | Save specification to file |
| `gitlab-catalog-browser component inputs <full-path>` | List all inputs with details |
| `gitlab-catalog-browser component inputs <full-path> --json` | List inputs as JSON |
| `gitlab-catalog-browser component workflows <full-path>` | List workflow definitions |
| `gitlab-catalog-browser component jobs <full-path>` | List job definitions |

## Global Flags

| Flag | Description |
|------|-------------|
| `--gitlab-url <url>` | GitLab instance URL (default: https://gitlab.com) |
| `--token <token>` | GitLab personal access token (optional for Component) |
