---
name: to-be-continuous-catalog
description: Full reference for to-be-continuous GitLab CI/CD components
---

# to-be-continuous Component Reference

The [to-be-continuous](https://gitlab.com/to-be-continuous) organization
publishes GitLab CI/CD components. To discover available components,
use the catalog API:

```bash
gitlab-catalog-browser catalog list --org to-be-continuous
```

Components are organized by category (build, testing, deployment, SAST, etc.)
in the catalog listing. Use `catalog info to-be-continuous/<name>` to inspect
a specific component's inputs, jobs, and workflows.

## Versioning

Components are versioned independently. Default latest version is `~latest`.
Use `--version <tag>` with schema/inputs commands for a specific version:

```bash
gitlab-catalog-browser component inputs to-be-continuous/docker --version 8.3.0
```

## Naming convention

- Component names use kebab-case in URLs: `to-be-continuous/docker`, `to-be-continuous/helmfile`
- Jobs follow the pattern: `<org>-<component>-<suffix>` (e.g. `to-be-continuous-docker-build`)
- Inputs follow the pattern: `<component>-<name>` (e.g. `docker-image`, `sonar-project-key`)
