---
name: gitlab-catalog-browser
description: Browse GitLab CI/CD Catalog, inspect component schemas, validate pipelines, and analyze CI/CD configurations via CLI. For AI agents managing GitLab CI/CD workflows.
---

# gitlab-catalog-browser

CLI tool for AI agents to browse the GitLab CI/CD Catalog, inspect component schemas, validate pipeline configurations, and analyze pipeline structure. Inspired by agent-browser architecture.

## Installation

```bash
npm install -g gitlab-catalog-browser
gitlab-ci-cli init                # Verify environment and create config
```

## Quick Start

Before running any command, load the current workflow content:

```bash
gitlab-ci-cli skills get core             # Workflows, patterns, troubleshooting
gitlab-ci-cli skills get core --full      # Include full command reference
```

## Basic workflow

1. **Initialize**: `gitlab-ci-cli init` — verify Node.js, create config
2. **Browse catalog**: `gitlab-ci-cli catalog list --org <namespace>`
3. **Inspect component**: `gitlab-ci-cli component schema <full-path>`
4. **Validate pipeline**: `gitlab-ci-cli validate .gitlab-ci.yml`
5. **Analyze**: `gitlab-ci-cli pipeline explain --jobs build,test`

## Configuration

Create `.gitlab-ci-cli.json` (automatically via `init` or manually):

```json
{
  "gitlabUrl": "https://gitlab.com",
  "token": "glpat-xxxx",
  "timeout": 30000,
  "output": "json"
}
```

Environment variables override file values:
- `GITLAB_CI_CLI_URL` — GitLab instance URL
- `GITLAB_CI_CLI_TOKEN` — Personal access token
