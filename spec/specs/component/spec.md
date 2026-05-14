# Component Schema Inspection Specification

## Overview

This capability enables AI agents to inspect GitLab CI/CD component schemas in detail. It provides commands to retrieve complete component specifications including inputs, outputs, jobs, and workflow definitions.

---

## Requirements

### Requirement: Get Component Full Schema

WHEN a user provides a component full path and optional version,
the CLI SHALL retrieve and display the complete YAML specification of that component.

#### Scenario: Get schema for latest version

GIVEN a component with full path "to-be-continuous/docker-build"
WHEN the user executes `gitlab-ci-cli component schema to-be-continuous/docker-build`
THEN the CLI fetches the component specification from `/ci/catalog/components/:full_path`
AND displays the full YAML including `spec:inputs`, job definitions, `image`, `stage`, and `script` sections
AND exits with code 0

#### Scenario: Get schema for specific version

GIVEN a component with multiple published versions
WHEN the user executes `gitlab-ci-cli component schema to-be-continuous/docker-build --version 1.2.0`
THEN the CLI fetches the specification for version 1.2.0 specifically
AND displays the complete schema for that version
AND exits with code 0

#### Scenario: Get schema with output file

GIVEN a component path
WHEN the user executes `gitlab-ci-cli component schema to-be-continuous/docker-build --output-file ./docker-build.yml`
THEN the CLI saves the component YAML schema to `./docker-build.yml`
AND displays a confirmation message with the file path
AND exits with code 0

#### Scenario: Get schema for nonexistent component

GIVEN a component path that does not exist
WHEN the user executes `gitlab-ci-cli component schema nonexistent/component`
THEN the CLI displays an error message "Component 'nonexistent/component' not found"
AND exits with non-zero code

#### Scenario: Get schema for nonexistent version

GIVEN a valid component path but an invalid version
WHEN the user executes `gitlab-ci-cli component schema to-be-continuous/docker-build --version 99.99.99`
THEN the CLI displays an error indicating the version does not exist
AND lists available versions for that component
AND exits with non-zero code

---

### Requirement: Inspect Component Inputs

WHEN a user provides a component full path,
the CLI SHALL display a formatted list of all input parameters with their details.

#### Scenario: List all inputs with details

GIVEN a component with full path "to-be-continuous/docker-build"
WHEN the user executes `gitlab-ci-cli component inputs to-be-continuous/docker-build`
THEN the CLI displays each input parameter with:
  - Input name
  - Type (string, number, boolean, array)
  - Default value (if present)
  - Description/help text
  - Required or optional indicator
AND exits with code 0

#### Scenario: Show constrained inputs with options

GIVEN a component with inputs that have constrained options
WHEN the user executes `gitlab-ci-cli component inputs to-be-continuous/docker-build`
THEN the CLI displays the available options for each constrained input
AND shows the default selection
AND exits with code 0

#### Scenario: Show inputs with regex validation

GIVEN a component with inputs that have regex validation patterns
WHEN the user executes `gitlab-ci-cli component inputs to-be-continuous/docker-build`
THEN the CLI displays the regex pattern for each validated input
AND shows an example of a valid value if available
AND exits with code 0

#### Scenario: Component with no inputs

GIVEN a component that defines no inputs
WHEN the user executes `gitlab-ci-cli component inputs simple-component`
THEN the CLI displays a message "Component 'simple-component' defines no inputs"
AND exits with code 0

---

### Requirement: List Workflow Definitions

WHEN a user provides a component path,
the CLI SHALL return workflow definitions including trigger conditions and job dependencies.

#### Scenario: List workflows with triggers

GIVEN a component with defined workflows
WHEN the user executes `gitlab-ci-cli component workflows to-be-continuous/docker-build`
THEN the CLI displays each workflow definition
AND shows trigger conditions (branch, tag, merge request, schedule)
AND shows which jobs are included in each workflow
AND exits with code 0

#### Scenario: Component with no workflows

GIVEN a component with no workflow definitions
WHEN the user executes `gitlab-ci-cli component workflows simple-job-component`
THEN the CLI displays a message "Component 'simple-job-component' defines no workflows"
AND exits with code 0

---

### Requirement: List Job Definitions

WHEN a user provides a component path,
the CLI SHALL list all job definitions with their stage, image, script, and configuration.

#### Scenario: List all jobs with configuration

GIVEN a component with multiple job definitions
WHEN the user executes `gitlab-ci-cli component jobs to-be-continuous/docker-build`
THEN the CLI displays each job with its name, stage, image, and script summary
AND shows job-level variables if defined
AND shows job-level rules/conditions if defined
AND exits with code 0

#### Scenario: Show job dependencies

GIVEN a component with jobs that use `needs` keyword
WHEN the user executes `gitlab-ci-cli component jobs to-be-continuous/docker-build`
THEN the CLI displays the dependency chain for each job
AND indicates which artifacts are passed between jobs
AND exits with code 0

---

## Command Reference

| Command | Description |
|---------|-------------|
| `gitlab-ci-cli component schema <full-path>` | Get complete component schema |
| `gitlab-ci-cli component schema <full-path> --version <version>` | Get schema for specific version |
| `gitlab-ci-cli component schema <full-path> --output-file <path>` | Save schema to file |
| `gitlab-ci-cli component inputs <full-path>` | List all inputs with details |
| `gitlab-ci-cli component inputs <full-path> --json` | List inputs as JSON |
| `gitlab-ci-cli component workflows <full-path>` | List workflow definitions |
| `gitlab-ci-cli component jobs <full-path>` | List job definitions |
| `gitlab-ci-cli component jobs <full-path> --with-artifacts` | Show artifact dependencies |

## Global Flags

| Flag | Description |
|------|-------------|
| `--gitlab-url <url>` | GitLab instance URL (default: https://gitlab.com) |
| `--token <token>` | GitLab personal access token |
