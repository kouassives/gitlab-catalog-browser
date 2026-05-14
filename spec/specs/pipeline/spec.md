# Pipeline Knowledge Interface (PKI) Specification

## Overview

This capability enables AI agents to understand, analyze, and troubleshoot GitLab CI pipeline configurations. It provides commands to explain job dependencies, trace variable usage, identify stages, and visualize include chains.

---

## Requirements

### Requirement: Explain Job Dependencies

WHEN a user provides a `.gitlab-ci.yml` file and specifies jobs,
the CLI SHALL display a dependency graph for the specified jobs in Mermaid format.

#### Scenario: Explain specific job dependencies

GIVEN a `.gitlab-ci.yml` file with multiple jobs
WHEN the user executes `gitlab-catalog-browser pipeline explain --jobs build,test,deploy`
THEN the CLI parses the pipeline file
AND identifies the dependency chain for each specified job using `needs`, `dependencies`, and `stage` ordering
AND displays a Mermaid flowchart showing job dependencies
AND indicates which artifacts are passed between jobs
AND shows `when` conditions (always, on_success, on_failure, manual)
AND exits with code 0

#### Scenario: Explain with bottleneck detection

GIVEN a pipeline with potential bottlenecks (jobs with many dependents)
WHEN the user executes `gitlab-catalog-browser pipeline explain --jobs build,test,deploy`
THEN the CLI identifies jobs that are critical path bottlenecks
AND highlights them in the dependency graph
AND includes a note about potential optimizations
AND exits with code 0

#### Scenario: Explain with parallel execution info

GIVEN a pipeline with parallel jobs
WHEN the user executes `gitlab-catalog-browser pipeline explain --jobs all`
THEN the CLI groups parallel jobs visually in the Mermaid graph
AND shows which stages run sequentially vs concurrently
AND exits with code 0

#### Scenario: Explain for empty or invalid file

GIVEN a `.gitlab-ci.yml` file with no jobs defined
WHEN the user executes `gitlab-catalog-browser pipeline explain --jobs build`
THEN the CLI displays an error message "No job 'build' found in pipeline configuration"
AND exits with non-zero code

---

### Requirement: Trace Variable Usage

WHEN a user provides a `.gitlab-ci.yml` file and a variable name,
the CLI SHALL trace where the variable is defined, used, and overridden throughout the pipeline.

#### Scenario: Trace predefined variable

GIVEN a `.gitlab-ci.yml` file using `CI_COMMIT_REF_NAME`
WHEN the user executes `gitlab-catalog-browser pipeline trace --var CI_COMMIT_REF_NAME`
THEN the CLI identifies the variable as a GitLab predefined variable
AND shows all jobs and sections where it is referenced
AND exits with code 0

#### Scenario: Trace custom variable through overrides

GIVEN a pipeline where `MY_VAR` is defined globally and overridden in specific jobs
WHEN the user executes `gitlab-catalog-browser pipeline trace --var MY_VAR`
THEN the CLI shows:
  - The global definition at the top level
  - Each job where MY_VAR is overridden
  - Each job where MY_VAR is used with its effective value
  - The inheritance chain
AND exits with code 0

#### Scenario: Trace variable defined in included file

GIVEN a variable defined in an included YAML file
WHEN the user executes `gitlab-catalog-browser pipeline trace --var INCLUDED_VAR`
THEN the CLI identifies the include file where the variable is defined
AND shows the resolution chain across includes
AND exits with code 0

#### Scenario: Trace nonexistent variable

GIVEN a variable name that is not defined anywhere in the pipeline
WHEN the user executes `gitlab-catalog-browser pipeline trace --var UNDEFINED_VAR`
THEN the CLI displays a message "Variable 'UNDEFINED_VAR' is not defined in this pipeline"
AND suggests similar variable names if found
AND exits with code 0

---

### Requirement: Identify Pipeline Stages

WHEN a user provides a `.gitlab-ci.yml` file,
the CLI SHALL list all stages in execution order with their associated jobs.

#### Scenario: List stages with jobs

GIVEN a valid `.gitlab-ci.yml` file
WHEN the user executes `gitlab-catalog-browser pipeline stages`
THEN the CLI parses the pipeline configuration
AND lists each stage in order with:
  - Stage name and position
  - Jobs assigned to that stage
  - Whether jobs run in parallel or sequentially within the stage
  - An estimate of the stage execution plan
AND exits with code 0

#### Scenario: Stages with no defined stage keyword

GIVEN a pipeline that does not explicitly define `stages:`
WHEN the user executes `gitlab-catalog-browser pipeline stages`
THEN the CLI uses the default stages (`.pre`, `build`, `test`, `deploy`, `.post`)
AND displays them with the associated jobs
AND notes that stages use GitLab defaults
AND exits with code 0

#### Scenario: Stages visualization in Mermaid

GIVEN a pipeline with multiple stages
WHEN the user executes `gitlab-catalog-browser pipeline stages --mermaid`
THEN the CLI displays a Mermaid Gantt chart or flowchart showing
  - Stage execution order
  - Job parallelism within stages
  - Estimated execution flow
AND exits with code 0

---

### Requirement: Show Include Chain

WHEN a user provides a `.gitlab-ci.yml` file with `include:` statements,
the CLI SHALL visualize the include hierarchy and show resolved configurations.

#### Scenario: Show include hierarchy

GIVEN a `.gitlab-ci.yml` file with multiple `include:` statements
WHEN the user executes `gitlab-catalog-browser pipeline includes`
THEN the CLI parses all `include:` directives
AND displays a tree visualization of the include chain
AND shows the source type for each include (local, project, remote, template, component)
AND resolves and displays the effective configuration contributed by each include
AND exits with code 0

#### Scenario: Show include with component references

GIVEN a pipeline that includes CI/CD components via `include:component`
WHEN the user executes `gitlab-catalog-browser pipeline includes`
THEN the CLI resolves each component reference to its full specification
AND shows the components in the include hierarchy
AND exits with code 0

#### Scenario: Show include with circular dependency

GIVEN a pipeline where includes form a circular reference
WHEN the user executes `gitlab-catalog-browser pipeline includes`
THEN the CLI detects the circular dependency
AND displays a warning with the cycle path
AND still displays the resolved chain up to the cycle point
AND exits with non-zero code

#### Scenario: Show include with unresolvable remote

GIVEN an include directive pointing to an unreachable remote URL
WHEN the user executes `gitlab-catalog-browser pipeline includes`
THEN the CLI displays a warning for the unresolvable include
AND shows the rest of the resolved include chain
AND exits with non-zero code

---

### Requirement: Generate Pipeline Summary

WHEN a user provides a `.gitlab-ci.yml` file,
the CLI SHALL generate a natural language summary of the pipeline structure suitable for AI agent consumption.

#### Scenario: Full pipeline summary

GIVEN a valid `.gitlab-ci.yml` file
WHEN the user executes `gitlab-catalog-browser pipeline summary`
THEN the CLI produces a structured summary including:
  - Total number of stages
  - Total number of jobs
  - List of all variables (global and per-job)
  - Include sources
  - Estimated execution strategy (parallel vs sequential)
  - Identified patterns (caching, artifacts, services, etc.)
AND outputs the summary in a format suitable for AI agent consumption
AND exits with code 0

#### Scenario: Summary for empty pipeline

GIVEN an empty or minimal `.gitlab-ci.yml` file
WHEN the user executes `gitlab-catalog-browser pipeline summary`
THEN the CLI displays a minimal summary indicating the pipeline has no jobs or stages defined
AND exits with code 0

---

## Command Reference

| Command | Description |
|---------|-------------|
| `gitlab-catalog-browser pipeline explain --jobs <list>` | Show job dependency graph in Mermaid |
| `gitlab-catalog-browser pipeline explain --jobs <list> --json` | Dependency graph as JSON |
| `gitlab-catalog-browser pipeline trace --var <name>` | Trace variable usage across pipeline |
| `gitlab-catalog-browser pipeline trace --var <name> --json` | Variable trace as JSON |
| `gitlab-catalog-browser pipeline stages` | List stages and their jobs |
| `gitlab-catalog-browser pipeline stages --mermaid` | Stages as Mermaid diagram |
| `gitlab-catalog-browser pipeline includes` | Show include hierarchy |
| `gitlab-catalog-browser pipeline includes --json` | Include hierarchy as JSON |
| `gitlab-catalog-browser pipeline summary` | Generate pipeline summary |

## Global Flags

| Flag | Description |
|------|-------------|
| `--gitlab-url <url>` | GitLab instance URL |
| `--token <token>` | GitLab personal access token |
