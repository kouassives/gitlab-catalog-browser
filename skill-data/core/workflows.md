---
name: core
description: Core workflow instructions for using gitlab-catalog-browser
---

# Core Workflows

## Overview

gitlab-catalog-browser is a CLI tool for AI agents to browse the GitLab CI/CD Catalog, inspect component schemas, validate pipeline configurations, and analyze pipeline structures.

## Browsing the Catalog

```bash
# List components in a namespace
gitlab-catalog-browser catalog list --org to-be-continuous

# Search for components
gitlab-catalog-browser catalog search docker

# Get component details
gitlab-catalog-browser catalog info to-be-continuous/docker-build
```

## Inspecting Component Schemas

```bash
# Get full YAML spec
gitlab-catalog-browser component schema to-be-continuous/docker-build

# List input parameters
gitlab-catalog-browser component inputs to-be-continuous/docker-build

# List workflows
gitlab-catalog-browser component workflows to-be-continuous/docker-build

# List jobs
gitlab-catalog-browser component jobs to-be-continuous/docker-build
```

## Validating Pipelines

```bash
# Validate a .gitlab-ci.yml file
gitlab-catalog-browser validate .gitlab-ci.yml

# Validate with dry-run rules evaluation
gitlab-catalog-browser validate .gitlab-ci.yml --dry-run

# Validate with simulated variables
gitlab-catalog-browser validate .gitlab-ci.yml --dry-run --var CI_PIPELINE_SOURCE=merge_request_event

# Validate with project context
gitlab-catalog-browser validate .gitlab-ci.yml --project my-group/my-project

# Validate piped content
echo "stages: [build]" | gitlab-catalog-browser validate --stdin
```

## Analyzing Pipelines

```bash
# Show job dependency graph
gitlab-catalog-browser pipeline explain .gitlab-ci.yml --jobs build,test,deploy

# Trace variable usage
gitlab-catalog-browser pipeline trace .gitlab-ci.yml --var MY_VAR

# List stages
gitlab-catalog-browser pipeline stages .gitlab-ci.yml

# Show include hierarchy
gitlab-catalog-browser pipeline includes .gitlab-ci.yml

# Generate pipeline summary
gitlab-catalog-browser pipeline summary .gitlab-ci.yml
```

## Troubleshooting

1. **Authentication errors**: Ensure GITLAB_TOKEN is set or pass `--token`
2. **Component not found**: Verify the full path (e.g., `namespace/component-name`)
3. **Pipeline validation failures**: Check the error details for line/column information
4. **Dry-run unexpected results**: Verify branch conditions and variables match your context
