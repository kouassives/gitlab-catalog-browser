# CLI Overview & Architecture Specification

## Overview

This spec defines the global CLI architecture, project structure, and foundational commands that apply across all capabilities. The `gitlab-ci-cli` tool provides a unified command-line interface for AI agents to interact with the GitLab CI/CD Catalog ecosystem.

---

## Architecture

### Client-Daemon Architecture (Planned)

The CLI SHALL follow a client-command pattern (each invocation is a standalone process) in its initial implementation, with an optional daemon mode for performance in later versions.

```
┌─────────────────────────────────────────────────────────────┐
│  CLI (TypeScript/Node.js)                                    │
│  ├── Commands: catalog, component, validate, pipeline        │
│  │              skills, config                               │
│  ├── Config: .gitlab-ci-cli.json (project + user level)      │
│  └── skill-data/ for agent skill instructions                │
├─────────────────────────────────────────────────────────────┤
│  GitLab CI/CD API Layer                                      │
│  ├── /api/v4/projects/:id/ci/catalog/components             │
│  ├── /api/v4/ci/catalog/components/:full_path               │
│  └── /api/v4/validate                                        │
├─────────────────────────────────────────────────────────────┤
│  Output Formatting                                           │
│  ├── Table output (default for humans)                       │
│  ├── JSON output (--json for AI agents)                     │
│  └── Mermaid diagrams (for pipeline visualization)           │
└─────────────────────────────────────────────────────────────┘
```

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language | TypeScript/Node.js | Cross-platform, no compilation step, wide ecosystem |
| CLI Framework | Commander or yargs | Standard Node.js CLI argument parsing |
| API Client | Native fetch (Node 18+) | Zero dependencies for HTTP |
| Output Format | Table + JSON | Human-readable default, machine-readable option |
| Package Format | npm package | Easy distribution via npm registry, global `-g` install |

---

## Requirements

### Requirement: Command Parsing and Help

WHEN a user invokes the CLI without arguments or with `--help`,
the system SHALL display usage information and available commands.

#### Scenario: Display top-level help

GIVEN the CLI is installed via npm and `gitlab-ci-cli init` has completed successfully
WHEN the user executes `gitlab-ci-cli --help` or `gitlab-ci-cli`
THEN the CLI displays usage information
AND lists all top-level commands: `catalog`, `component`, `validate`, `pipeline`, `skills`, `init`, `upgrade`, `doctor`
AND shows global flags
AND shows examples of common usage
AND exits with code 0

#### Scenario: Display command-specific help

GIVEN the CLI is installed via npm and `gitlab-ci-cli init` has completed successfully
WHEN the user executes `gitlab-ci-cli catalog --help`
THEN the CLI displays detailed usage for the `catalog` command
AND lists all subcommands: `list`, `search`, `info`
AND shows command-specific flags
AND exits with code 0

---

### Requirement: Version Information

WHEN a user requests the CLI version,
the system SHALL display the current version number.

#### Scenario: Display version

GIVEN `gitlab-ci-cli init` has completed successfully
WHEN the user executes `gitlab-ci-cli --version`
THEN the CLI displays the current version in semver format (e.g., `1.2.3`)
AND exits with code 0

---

### Requirement: Output Format Selection

WHEN a user includes the `--json` flag,
the system SHALL output machine-readable JSON instead of human-readable tables.

#### Scenario: JSON output for any command

GIVEN a command that normally outputs table format
WHEN the user appends `--json` to any command
THEN the CLI outputs the result as a JSON object or array
AND the JSON includes a `success` boolean field
AND includes a `data` field with the payload
AND includes an `error` field on failure
AND exits with code 0 for success, non-zero for errors

#### Scenario: Error response format

GIVEN a command that fails
WHEN the user uses `--json`
THEN the CLI outputs:
```json
{"success": false, "error": {"message": "...", "code": "..."}}
```
AND exits with non-zero code

---

### Requirement: Batch Command Execution

WHEN a user or agent provides multiple commands in a single invocation,
the system SHALL execute them sequentially and return combined results.

#### Scenario: Execute multiple commands in batch

GIVEN multiple CLI commands to execute
WHEN the user executes `gitlab-ci-cli batch "catalog list --org to-be-continuous --json" "component inputs to-be-continuous/docker-build --json"`
THEN the CLI executes each command in sequence
AND returns results for all commands
AND if any command fails, continues with remaining commands (unless `--bail` is set)
AND exits with code 0 if all succeed, non-zero if any fail

#### Scenario: Batch with bail on first error

GIVEN multiple commands where order matters
WHEN the user executes `gitlab-ci-cli batch --bail "command1" "command2"`
THEN the CLI executes commands in sequence
AND stops at the first command that fails
AND returns partial results
AND exits with non-zero code

#### Scenario: Batch from stdin JSON

GIVEN commands formatted as JSON
WHEN the user pipes JSON to `gitlab-ci-cli batch --json`
THEN the CLI reads commands from stdin
AND executes each command in sequence
AND returns combined results
AND exits with code 0

---

### Requirement: Schema Caching

WHEN the CLI fetches component schemas,
the system SHALL cache results to improve performance on repeated requests.

#### Scenario: Cache schema results

GIVEN a previously fetched component schema
WHEN the user executes `gitlab-ci-cli component schema to-be-continuous/docker-build` again within the cache TTL
THEN the CLI returns the cached result instead of making a new API request
AND displays a note indicating the result is from cache
AND exits with code 0

#### Scenario: Cache invalidation

GIVEN a cached schema that has exceeded the TTL (default: 5 minutes)
WHEN the user requests the component schema
THEN the CLI fetches fresh data from the API
AND updates the cache
AND exits with code 0

#### Scenario: Bypass cache

GIVEN the CLI has a cached schema
WHEN the user executes `gitlab-ci-cli component schema to-be-continuous/docker-build --no-cache`
THEN the CLI bypasses the cache
AND fetches fresh data from the API
AND exits with code 0

---

## Project Structure

```
gitlab-catalog-browser/
├── bin/
│   └── gitlab-ci-cli.js              # Node.js entry point (shebang)
├── src/
│   ├── index.ts                      # CLI entry point (command registration)
│   ├── commands/
│   │   ├── catalog.ts                # catalog command handlers
│   │   ├── component.ts              # component command handlers
│   │   ├── validate.ts               # validate command handlers
│   │   ├── pipeline.ts               # pipeline command handlers
│   │   ├── skills.ts                 # skills command handlers
│   │   └── batch.ts                  # batch execution handler
│   ├── api/
│   │   ├── gitlab.ts                 # GitLab API client (base)
│   │   ├── catalog.ts                # Catalog API methods
│   │   └── lint.ts                   # CI Lint API methods
│   ├── config/
│   │   ├── loader.ts                 # Configuration loading & merging
│   │   └── types.ts                  # Config type definitions
│   ├── output/
│   │   ├── table.ts                  # Table formatter
│   │   ├── json.ts                   # JSON formatter
│   │   └── mermaid.ts                # Mermaid diagram formatter
│   ├── cache/
│   │   └── schema-cache.ts           # Schema caching layer
│   └── types/
│       ├── catalog.ts                # Catalog type definitions
│       ├── component.ts              # Component type definitions
│       ├── pipeline.ts               # Pipeline type definitions
│       └── api.ts                    # API response types
├── skill-data/
│   ├── core/
│   │   ├── workflows.md              # Core workflow instructions
│   │   ├── reference.md              # Full command reference
│   │   └── templates.md              # Pipeline templates
│   └── templates/
│       ├── basic-pipeline.yml        # Basic pipeline template
│       ├── multi-stage.yml           # Multi-stage with approvals
│       └── docker-build.yml          # Docker build and push
├── skills/
│   └── gitlab-catalog-browser/
│       └── SKILL.md                  # Agent Skills entry point stub
├── package.json
├── tsconfig.json
└── .gitlab-ci-cli.json.example
```

---

## Error Handling

### Standard Error Response Format

WHEN a command encounters an error,
the system SHALL return a consistent error structure.

#### Scenario: CLI displays structured error

GIVEN a command that fails
WHEN the error is returned
THEN the CLI outputs:
  - Error message describing what went wrong
  - Error code for programmatic handling
  - Suggestion for resolution (if available)
AND exits with non-zero code

**Error codes:**
| Code | Meaning |
|------|---------|
| 1 | General error |
| 2 | Invalid arguments |
| 3 | API error (authentication, rate limit, etc.) |
| 4 | Configuration error |
| 5 | File not found or unreadable |
| 6 | Network error |

---
