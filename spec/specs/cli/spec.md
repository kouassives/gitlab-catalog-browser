# CLI Overview & Architecture Specification

## Overview

This spec defines the global CLI architecture, project structure, and foundational commands that apply across all capabilities. The `gitlab-catalog-browser` tool provides a unified command-line interface for AI agents to interact with the GitLab CI/CD Catalog ecosystem.

---

## Architecture

### Client-Daemon Architecture (Planned)

The CLI SHALL follow a client-command pattern (each invocation is a standalone process) in its initial implementation, with an optional daemon mode for performance in later versions.

```
┌─────────────────────────────────────────────────────────────┐
│  CLI (TypeScript/Node.js)                                    │
│  ├── Commands: catalog, component, validate, pipeline        │
│  │              skills, config                               │
│  ├── Config: .gitlab-catalog-browser.json (project + user level)      │
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

GIVEN the CLI is installed via npm and `gitlab-catalog-browser init` has completed successfully
WHEN the user executes `gitlab-catalog-browser --help` or `gitlab-catalog-browser`
THEN the CLI displays usage information
AND lists all top-level commands: `catalog`, `component`, `validate`, `pipeline`, `skills`, `init`, `upgrade`, `doctor`
AND shows global flags
AND shows examples of common usage
AND exits with code 0

#### Scenario: Display command-specific help

GIVEN the CLI is installed via npm and `gitlab-catalog-browser init` has completed successfully
WHEN the user executes `gitlab-catalog-browser catalog --help`
THEN the CLI displays detailed usage for the `catalog` command
AND lists all subcommands: `list`, `search`, `info`
AND shows command-specific flags
AND exits with code 0

---

### Requirement: Version Information

WHEN a user requests the CLI version,
the system SHALL display the current version number.

#### Scenario: Display version

GIVEN `gitlab-catalog-browser init` has completed successfully
WHEN the user executes `gitlab-catalog-browser --version`
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
WHEN the user executes `gitlab-catalog-browser batch "catalog list --org to-be-continuous --json" "component inputs to-be-continuous/docker-build --json"`
THEN the CLI executes each command in sequence
AND returns results for all commands
AND if any command fails, continues with remaining commands (unless `--bail` is set)
AND exits with code 0 if all succeed, non-zero if any fail

#### Scenario: Batch with bail on first error

GIVEN multiple commands where order matters
WHEN the user executes `gitlab-catalog-browser batch --bail "command1" "command2"`
THEN the CLI executes commands in sequence
AND stops at the first command that fails
AND returns partial results
AND exits with non-zero code

#### Scenario: Batch from stdin JSON

GIVEN commands formatted as JSON
WHEN the user pipes JSON to `gitlab-catalog-browser batch --json`
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
WHEN the user executes `gitlab-catalog-browser component schema to-be-continuous/docker-build` again within the cache TTL
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
WHEN the user executes `gitlab-catalog-browser component schema to-be-continuous/docker-build --no-cache`
THEN the CLI bypasses the cache
AND fetches fresh data from the API
AND exits with code 0

---

### Requirement: Init CLI Tool

WHEN a user runs the init command,
the CLI SHALL verify the environment meets minimum requirements, create a default configuration file, and optionally set up shell completion.

#### Scenario: Fresh project initialization with all prerequisites met

GIVEN Node.js version 18.0.0 or later is installed
AND no `.gitlab-catalog-browser.json` exists in the current directory
WHEN the user executes `gitlab-catalog-browser init`
THEN the CLI checks the Node.js version meets the minimum requirement (>= 18.0.0)
AND creates a `.gitlab-catalog-browser.json` with default values and a `$schema` reference
AND displays a success message with the config file path
AND exits with code 0

#### Scenario: Init with Node.js version too old

GIVEN Node.js version 16.x is installed
WHEN the user executes `gitlab-catalog-browser init`
THEN the CLI detects the Node.js version is below the minimum (>= 18.0.0)
AND displays an error message "Node.js 18.0.0 or later is required (found: 16.x)"
AND does not create a config file
AND exits with non-zero code

#### Scenario: Init with existing config file

GIVEN a `.gitlab-catalog-browser.json` already exists in the current directory
WHEN the user executes `gitlab-catalog-browser init`
THEN the CLI detects the existing config file
AND displays a message "Configuration file already exists at .gitlab-catalog-browser.json"
AND does not overwrite the file
AND exits with code 0

#### Scenario: Init with --force to overwrite config

GIVEN a `.gitlab-catalog-browser.json` already exists
WHEN the user executes `gitlab-catalog-browser init --force`
THEN the CLI overwrites the existing config file with fresh defaults
AND creates a backup of the previous file as `.gitlab-catalog-browser.json.bak`
AND displays a message confirming the overwrite
AND exits with code 0

#### Scenario: Init with shell completion setup

GIVEN the user's shell is detected as bash or zsh
WHEN the user executes `gitlab-catalog-browser init --completion bash`
THEN the CLI generates shell completion scripts for bash
AND displays instructions for sourcing the completion script
AND exits with code 0

---

### Requirement: Upgrade CLI Tool

WHEN a user runs the upgrade command,
the CLI SHALL check the npm registry for a newer version and apply the upgrade if available.

#### Scenario: Upgrade available via npm

GIVEN the CLI is installed via npm (global or local)
AND the current version is 1.0.0
AND version 1.2.0 exists on the npm registry
WHEN the user executes `gitlab-catalog-browser upgrade`
THEN the CLI queries the npm registry for the latest version
AND detects that 1.2.0 is newer than the installed 1.0.0
AND displays the current and latest versions
AND runs `npm install -g gitlab-catalog-browser@latest` (or the appropriate install command)
AND displays a success message after completion
AND exits with code 0

#### Scenario: Already on latest version

GIVEN the CLI is installed via npm
AND the current version matches the latest on the npm registry
WHEN the user executes `gitlab-catalog-browser upgrade`
THEN the CLI queries the npm registry
AND displays a message "Already up-to-date (v1.0.0)"
AND does not attempt to install anything
AND exits with code 0

#### Scenario: Upgrade when offline

GIVEN the machine has no network connectivity
WHEN the user executes `gitlab-catalog-browser upgrade`
THEN the CLI detects the network is unreachable
AND displays a message "Unable to check for updates — no network connectivity"
AND shows the current installed version
AND exits with non-zero code

#### Scenario: Upgrade detection fails with continue

GIVEN the npm registry is unreachable (timeout, DNS failure)
WHEN the user executes `gitlab-catalog-browser upgrade`
THEN the CLI attempts to reach the npm registry with a timeout of 5 seconds
AND on failure, displays a warning "Could not check for latest version"
AND shows the current installed version
AND suggests trying again later
AND exits with non-zero code

#### Scenario: Upgrade with --dry-run flag

GIVEN a newer version is available on the npm registry
WHEN the user executes `gitlab-catalog-browser upgrade --dry-run`
THEN the CLI queries the npm registry
AND displays the current and latest versions
AND displays the upgrade command that would be run
AND does NOT execute the upgrade
AND exits with code 0

---

### Requirement: Doctor Diagnostic

WHEN a user runs the doctor command,
the CLI SHALL perform comprehensive environment diagnostics and report the health status of each component.

#### Scenario: All checks pass

GIVEN a healthy installation with Node.js 20.x, valid config, and working API connectivity
WHEN the user executes `gitlab-catalog-browser doctor`
THEN the CLI checks the Node.js version (✓)
AND checks the config file validity (✓)
AND checks GitLab API connectivity (✓)
AND checks the token validity (✓)
AND displays a green "PASS" or "✓" for each check
AND displays an overall "All checks passed" summary
AND exits with code 0

#### Scenario: Node.js version too old

GIVEN Node.js version 16.x is installed
WHEN the user executes `gitlab-catalog-browser doctor`
THEN the CLI checks the Node.js version
AND displays a red "FAIL" or "✗" for the Node.js check
AND displays the message "Node.js 18.0.0 or later required (found: 16.x)"
AND continues to run remaining checks
AND exits with non-zero code

#### Scenario: Config file invalid

GIVEN a `.gitlab-catalog-browser.json` that contains invalid JSON
WHEN the user executes `gitlab-catalog-browser doctor`
THEN the CLI attempts to parse the config file
AND displays a red "FAIL" or "✗" for the config check
AND displays the parse error with file path and line number
AND continues to run remaining checks
AND exits with non-zero code

#### Scenario: GitLab API unreachable

GIVEN a GitLab URL that is unreachable (wrong host, DNS failure, timeout)
WHEN the user executes `gitlab-catalog-browser doctor`
THEN the CLI attempts to reach the GitLab API health endpoint
AND displays a red "FAIL" or "✗" for the API connectivity check
AND displays the error details (host unreachable, timeout, etc.)
AND suggests verifying the `gitlabUrl` configuration
AND continues to run remaining checks
AND exits with non-zero code

#### Scenario: Token invalid or expired

GIVEN a GitLab token that is expired or invalid
WHEN the user executes `gitlab-catalog-browser doctor`
THEN the CLI attempts to authenticate with the GitLab API
AND receives an HTTP 401 or 403 response
AND displays a red "FAIL" or "✗" for the token check
AND displays "Authentication failed — token may be expired or invalid"
AND suggests generating a new token with the required scopes
AND continues to run remaining checks
AND exits with non-zero code

#### Scenario: Doctor with --json output

GIVEN a mixed health state (some passes, some failures)
WHEN the user executes `gitlab-catalog-browser doctor --json`
THEN the CLI outputs a JSON object with:
  - A `success` boolean (true only if ALL checks pass)
  - A `checks` array where each entry has `name`, `status` (pass/fail), and `message`
  - A `summary` object with total checks, passed, and failed counts
AND exits with non-zero code (since not all checks passed)

---

## Project Structure

```
gitlab-catalog-browser/
├── bin/
│   └── gitlab-catalog-browser.js              # Node.js entry point (shebang)
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
└── .gitlab-catalog-browser.json.example
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
