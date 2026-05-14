# gitlab-catalog-browser

CLI tool for AI agents to browse GitLab CI/CD Catalog, inspect component schemas, validate pipeline configurations, and analyze pipeline structure. Inspired by [agent-browser](https://github.com/vercel-labs/agent-browser).

## Status

Pre-product — specification phase.

## Spec-Driven Development

This project follows the [OpenSpec](https://github.com/forztf/open-skilled-sdd) framework for Spec-Driven Development.

### Specification Structure

```
spec/
├── specs/                              # Living specifications (capabilities)
│   ├── catalog/spec.md                 # Catalog browsing capability
│   ├── component/spec.md               # Component schema inspection
│   ├── validate/spec.md                # Pipeline validation
│   ├── pipeline/spec.md                # Pipeline Knowledge Interface
│   ├── config/spec.md                  # Configuration management
│   ├── skills/spec.md                  # Agent skill integration
│   └── cli/spec.md                     # CLI overview & architecture
├── changes/                            # Active change proposals (future)
└── archive/                            # Archived changes (future)
```

### Capabilities

| Capability | Description | Spec |
|------------|-------------|------|
| **Catalog** | Browse and search GitLab CI/CD Catalog components | [spec](spec/specs/catalog/spec.md) |
| **Component** | Inspect component schemas, inputs, jobs, workflows | [spec](spec/specs/component/spec.md) |
| **Validate** | Validate `.gitlab-ci.yml` files via CI Lint API | [spec](spec/specs/validate/spec.md) |
| **Pipeline PKI** | Analyze pipeline dependencies, variables, stages, includes | [spec](spec/specs/pipeline/spec.md) |
| **Config** | Configuration loading, merging, and environment overrides | [spec](spec/specs/config/spec.md) |
| **Skills** | Serve skill content for AI agent workflows | [spec](spec/specs/skills/spec.md) |
| **CLI** | Global architecture, command parsing, output formatting | [spec](spec/specs/cli/spec.md) |

## Quick Start

```bash
# Install globally
npm install -g gitlab-catalog-browser

# Initialize project configuration
gitlab-ci-cli init

# Browse catalog components
gitlab-ci-cli catalog list --org to-be-continuous

# Inspect a component
gitlab-ci-cli component schema to-be-continuous/docker-build

# Validate a pipeline
gitlab-ci-cli validate .gitlab-ci.yml

# Analyze pipeline structure
gitlab-ci-cli pipeline explain --jobs build,test,deploy

# Run diagnostics
gitlab-ci-cli doctor

# Check for updates
gitlab-ci-cli upgrade
```

## Related

- [GitLab CI/CD YAML syntax](https://docs.gitlab.com/ee/ci/yaml/)
- [GitLab CI/CD Catalog](https://docs.gitlab.com/ee/ci/components/)
- [GitLab CI Lint API](https://docs.gitlab.com/ee/api/lint.html)
- [Agent Skills Specification](https://agentskills.io/specification)
- [agent-browser](https://github.com/vercel-labs/agent-browser)
