---
name: to-be-continuous-catalog
description: Workflows for browsing and using to-be-continuous GitLab CI/CD components
---

# to-be-continuous workflows

This skill provides workflows for using the [to-be-continuous](https://gitlab.com/to-be-continuous)
GitLab CI/CD component catalog. All commands use `gitlab-catalog-browser`
with the `--org to-be-continuous` scope.

## Prerequisites

```bash
npm install -g gitlab-catalog-browser
```

## Browse the catalog

```bash
# List all to-be-continuous components
gitlab-catalog-browser catalog list --org to-be-continuous

# Search across to-be-continuous components
gitlab-catalog-browser catalog search <query>
```

## Inspect a component

```bash
# Full description, inputs, jobs, workflows
gitlab-catalog-browser catalog info to-be-continuous/<component>

# Input parameters and their defaults
gitlab-catalog-browser component inputs to-be-continuous/<component>

# List jobs provided by the component
gitlab-catalog-browser component jobs to-be-continuous/<component>

# List workflow variants
gitlab-catalog-browser component workflows to-be-continuous/<component>

# Full YAML specification
gitlab-catalog-browser component schema to-be-continuous/<component>
```

## Validate a pipeline using to-be-continuous components

```bash
# Validate local .gitlab-ci.yml using a project context
gitlab-catalog-browser validate .gitlab-ci.yml --project <project-id>
```

## Common patterns

### Basic component usage

```yaml
# .gitlab-ci.yml
include:
  # Fetch the latest version of a to-be-continuous component
  - component: to-be-continuous/<component>
    inputs:
      <input-name>: <value>
```

### Multi-component pipeline

```yaml
# .gitlab-ci.yml
include:
  - component: to-be-continuous/docker
    inputs:
      image: my-app
  - component: to-be-continuous/sonar
    inputs:
      sonar-project-key: my-project
```

### Override a component job

```yaml
# .gitlab-ci.yml
include:
  - component: to-be-continuous/docker

# Override to extend the docker-build job
docker-build:
  before_script:
    - echo "Custom setup before Docker build"
```

## Release process

Find the latest to-be-continuous component releases on their
[releases page](https://gitlab.com/to-be-continuous).
