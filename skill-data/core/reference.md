---
name: core
description: Full command reference for gitlab-catalog-browser
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
gitlab-catalog-browser init [--force] [--completion bash|zsh]
```

### upgrade
Check for and apply CLI upgrades.

```bash
gitlab-catalog-browser upgrade [--dry-run]
```

### doctor
Run comprehensive environment diagnostics.

```bash
gitlab-catalog-browser doctor [--json]
```

### catalog list
List all catalog components in a namespace.

```bash
gitlab-catalog-browser catalog list --org <namespace> [--json] [--page <n>] [--per-page <n>]
```

### catalog search
Search catalog components by keyword.

```bash
gitlab-catalog-browser catalog search <query> [--json] [--page <n>] [--per-page <n>]
```

### catalog info
Show detailed information about a specific component.

```bash
gitlab-catalog-browser catalog info <full-path> [--json]
```

### component schema
Get the complete YAML specification of a component.

```bash
gitlab-catalog-browser component schema <full-path> [--version <version>] [--output-file <path>]
```

### component inputs
List all input parameters for a component.

```bash
gitlab-catalog-browser component inputs <full-path> [--json]
```

### component workflows
List workflow definitions for a component.

```bash
gitlab-catalog-browser component workflows <full-path>
```

### component jobs
List job definitions for a component.

```bash
gitlab-catalog-browser component jobs <full-path> [--with-artifacts]
```

### validate
Validate a .gitlab-ci.yml pipeline configuration.

The `<file>` is the **local file** being tested (not fetched from GitLab).
The `--project` flag provides **API context only** (resolves includes,
evaluates rules, applies project variables).

```bash
gitlab-catalog-browser validate <file> [--stdin] [--dry-run] [--project <id-or-path>] [--var <key=value>] [--json]
```

| Flag | Description |
|------|-------------|
| `--stdin` | Read pipeline content from stdin instead of a file |
| `--dry-run` | Evaluate rules and show which jobs would execute |
| `--project <id-or-path>` | Project ID (numeric) or namespace/project — API context for resolving includes and evaluating rules. Does NOT fetch the file from GitLab. |
| `--var <key=value>` | Simulate CI/CD variables for dry-run evaluation (repeatable) |
| `--json` | Output results as structured JSON |

### pipeline explain
Show job dependency graph for specified jobs.

```bash
gitlab-catalog-browser pipeline explain <file> --jobs <list> [--json]
```

### pipeline trace
Trace variable usage across the pipeline.

```bash
gitlab-catalog-browser pipeline trace <file> --var <name> [--json]
```

### pipeline stages
List pipeline stages and their jobs.

```bash
gitlab-catalog-browser pipeline stages <file> [--mermaid] [--json]
```

### pipeline includes
Show include hierarchy of the pipeline.

```bash
gitlab-catalog-browser pipeline includes <file> [--json]
```

### pipeline summary
Generate a structured pipeline summary.

```bash
gitlab-catalog-browser pipeline summary <file> [--json]
```
