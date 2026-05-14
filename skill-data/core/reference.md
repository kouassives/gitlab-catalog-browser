---
name: core
description: Full command reference for gitlab-ci-cli
---

# Command Reference

## Global Flags

| Flag | Description |
|------|-------------|
| `--gitlab-url <url>` | GitLab instance URL (default: https://gitlab.com) |
| `--token <token>` | GitLab personal access token |

## Commands

### init
Initialize project configuration and verify environment.

```bash
gitlab-ci-cli init [--force] [--completion bash|zsh]
```

### upgrade
Check for and apply CLI upgrades.

```bash
gitlab-ci-cli upgrade [--dry-run]
```

### doctor
Run comprehensive environment diagnostics.

```bash
gitlab-ci-cli doctor [--json]
```

### catalog list
List all catalog components in a namespace.

```bash
gitlab-ci-cli catalog list --org <namespace> [--json] [--page <n>] [--per-page <n>]
```

### catalog search
Search catalog components by keyword.

```bash
gitlab-ci-cli catalog search <query> [--json] [--page <n>] [--per-page <n>]
```

### catalog info
Show detailed information about a specific component.

```bash
gitlab-ci-cli catalog info <full-path> [--json]
```

### component schema
Get the complete YAML specification of a component.

```bash
gitlab-ci-cli component schema <full-path> [--version <version>] [--output-file <path>]
```

### component inputs
List all input parameters for a component.

```bash
gitlab-ci-cli component inputs <full-path> [--json]
```

### component workflows
List workflow definitions for a component.

```bash
gitlab-ci-cli component workflows <full-path>
```

### component jobs
List job definitions for a component.

```bash
gitlab-ci-cli component jobs <full-path> [--with-artifacts]
```

### validate
Validate a .gitlab-ci.yml pipeline configuration.

```bash
gitlab-ci-cli validate <file> [--stdin] [--dry-run] [--project <path>] [--var <key=value>] [--json]
```

### pipeline explain
Show job dependency graph for specified jobs.

```bash
gitlab-ci-cli pipeline explain <file> --jobs <list> [--json]
```

### pipeline trace
Trace variable usage across the pipeline.

```bash
gitlab-ci-cli pipeline trace <file> --var <name> [--json]
```

### pipeline stages
List pipeline stages and their jobs.

```bash
gitlab-ci-cli pipeline stages <file> [--mermaid] [--json]
```

### pipeline includes
Show include hierarchy of the pipeline.

```bash
gitlab-ci-cli pipeline includes <file> [--json]
```

### pipeline summary
Generate a structured pipeline summary.

```bash
gitlab-ci-cli pipeline summary <file> [--json]
```
