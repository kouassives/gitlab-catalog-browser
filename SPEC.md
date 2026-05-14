# gitlab-catalog-browser Specification

## Overview

CLI tool for AI agents to browse GitLab CI/CD Catalog, inspect component schemas, and validate pipeline configurations. Inspired by [agent-browser](https://github.com/vercel-labs/agent-browser) architecture.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  CLI (TypeScript/Node.js)                                   │
│  ├── Commands: catalog, component, validate, lint          │
│  ├── Config: gitlab-ci-cli.json (project/user level)       │
│  └── Skills: skill-data/ for agent instructions           │
├─────────────────────────────────────────────────────────────┤
│  GitLab CI/CD Catalog API                                   │
│  ├── /projects/:id/ci/catalog/components (list)            │
│  ├── /ci/catalog/components/:full_path (schema)           │
│  └── /api/v4/validate (lint .gitlab-ci.yml)                │
├─────────────────────────────────────────────────────────────┤
│  Skill Integration                                          │
│  ├── SKILL.md: Agent Skills format for AI routing          │
│  └── skill-data/: Core workflows, templates, references    │
└─────────────────────────────────────────────────────────────┘
```

---

## Global Keywords

| Keyword | Description |
|---------|-------------|
| `default` | Custom default values for job keywords |
| `include` | Import configuration from other YAML files |
| `stages` | The names and order of the pipeline stages |
| `variables` | Define default CI/CD variables |
| `workflow` | Control what types of pipeline run |

---

## Requirements

### Requirement: Catalog Browsing

The CLI SHALL provide commands to browse GitLab CI/CD Catalog components from any organization.

#### Scenario: List components for an organization

- **GIVEN** A GitLab instance URL and optional access token
- **WHEN** User executes `gitlab-ci-cli catalog list --org to-be-continuous`
- **THEN** The CLI fetches all catalog components from `to-be-continuous` namespace
- **AND** Displays component name, version, description in table format
- **AND** Supports `--json` flag for machine-readable output

#### Scenario: Search components by keyword

- **GIVEN** A search query string
- **WHEN** User executes `gitlab-ci-cli catalog search "docker build"`
- **THEN** The CLI returns components matching the keyword
- **AND** Supports pagination with `--page` and `--per-page` flags

---

### Requirement: Component Schema Inspection

The CLI SHALL retrieve and display complete schema information for CI/CD components.

#### Scenario: Get component full schema

- **GIVEN** A component full path (e.g., `to-be-continuous/docker-build`)
- **WHEN** User executes `gitlab-ci-cli component schema to-be-continuous/docker-build`
- **THEN** The CLI returns the component's YAML specification including:
  - `spec:inputs` with all input parameters (name, type, default, description)
  - `spec:inputs:options` for constrained inputs
  - Job definitions with their `script`, `image`, `stage`
  - Workflow definitions if present
- **AND** Supports `--version` flag to specify version (default: latest)
- **AND** Supports `--output-file` to save schema to disk

#### Scenario: Inspect component inputs in detail

- **GIVEN** A component full path
- **WHEN** User executes `gitlab-ci-cli component inputs to-be-continuous/docker-build`
- **THEN** The CLI displays a formatted list of inputs with:
  - Name and type (string, number, boolean, array)
  - Default value if present
  - Available options if constrained
  - Description/help text
  - Regex validation pattern if defined

#### Scenario: List workflows defined in component

- **GIVEN** A component path
- **WHEN** User executes `gitlab-ci-cli component workflows to-be-continuous/docker-build`
- **THEN** The CLI returns workflow definitions including trigger conditions and job dependencies

---

### Requirement: Pipeline Validation

The CLI SHALL validate `.gitlab-ci.yml` files using GitLab CI Lint API.

#### Scenario: Validate local file

- **GIVEN** A `.gitlab-ci.yml` file path
- **WHEN** User executes `gitlab-ci-cli validate .gitlab-ci.yml`
- **THEN** The CLI reads the file content
- **AND** Sends to GitLab CI Lint API (`/api/v4/validate`)
- **AND** Returns validation result with errors/warnings locations
- **AND** Exit code 0 for valid, non-zero for invalid

#### Scenario: Validate with dry-run (respects rules)

- **GIVEN** A `.gitlab-ci.yml` file
- **WHEN** User executes `gitlab-ci-cli validate --dry-run .gitlab-ci.yml`
- **THEN** The CLI evaluates `rules:` conditions
- **AND** Shows which jobs would execute based on current context

#### Scenario: Validate with project context

- **GIVEN** A GitLab project path (e.g., `my-group/my-project`)
- **WHEN** User executes `gitlab-ci-cli validate --project my-group/my-project .gitlab-ci.yml`
- **THEN** The CLI uses project-specific CI variables and includes
- **AND** Provides more accurate validation results

---

### Requirement: Pipeline PKI (Pipeline Knowledge Interface)

The CLI SHALL provide commands to help agents understand and troubleshoot pipeline configurations.

#### Scenario: Explain job dependencies

- **GIVEN** A `.gitlab-ci.yml` file
- **WHEN** User executes `gitlab-ci-cli pipeline explain --jobs build,test,deploy`
- **THEN** The CLI displays the dependency graph in Mermaid format
- **AND** Shows which artifacts are passed between jobs
- **AND** Identifies potential bottlenecks

#### Scenario: Trace variable usage

- **GIVEN** A `.gitlab-ci.yml` file and a variable name
- **WHEN** User executes `gitlab-ci-cli pipeline trace --var CI_COMMIT_REF_NAME`
- **THEN** The CLI shows where the variable is defined, used, and overridden
- **AND** Indicates if it's a predefined variable or custom

#### Scenario: Identify pipeline stages

- **GIVEN** A `.gitlab-ci.yml` file
- **WHEN** User executes `gitlab-ci-cli pipeline stages`
- **THEN** The CLI lists all stages in execution order
- **AND** Shows jobs in each stage
- **AND** Shows parallel vs sequential execution

#### Scenario: Show include chain

- **GIVEN** A `.gitlab-ci.yml` file with multiple `include:` statements
- **WHEN** User executes `gitlab-ci-cli pipeline includes`
- **THEN** The CLI visualizes the include hierarchy
- **AND** Shows resolved configurations from each include

---

### Requirement: Configuration Management

The CLI SHALL support configuration files for GitLab instance and authentication.

#### Scenario: Load configuration from files

- **GIVEN** Configuration files at project (`.gitlab-ci-cli.json`) and user (`~/.gitlab-ci-cli.json`) level
- **WHEN** CLI executes any command
- **THEN** Configuration is merged: user config < project config < CLI flags < env vars
- **AND** Supported config keys: `gitlabUrl`, `token`, `project`, `timeout`

#### Scenario: Environment variable overrides

- **GIVEN** Environment variables `GITLAB_CI_CLI_URL`, `GITLAB_CI_CLI_TOKEN`
- **WHEN** CLI executes commands
- **THEN** Environment variables override file configuration

---

### Requirement: Agent Skill Integration

The CLI SHALL serve skill content for AI agent workflows following Agent Skills standard.

#### Scenario: Serve core skill content

- **GIVEN** The CLI is installed
- **WHEN** Agent executes `gitlab-ci-cli skills get core`
- **THEN** The CLI outputs core workflow instructions including:
  - How to browse catalog components
  - How to generate pipeline from templates
  - Common patterns and troubleshooting

#### Scenario: Serve specialized skill content

- **GIVEN** Specialized skills exist (e.g., `gitlab-ci-cli skills get templates`)
- **WHEN** Agent requests a specialized skill
- **THEN** The CLI outputs skill-specific content from `skill-data/` directory

---

## Command Reference

### `gitlab-ci-cli catalog`

| Command | Description |
|---------|-------------|
| `gitlab-ci-cli catalog list --org <namespace>` | List all components in namespace |
| `gitlab-ci-cli catalog search <query>` | Search components by keyword |
| `gitlab-ci-cli catalog info <full-path>` | Show component summary |

### `gitlab-ci-cli component`

| Command | Description |
|---------|-------------|
| `gitlab-ci-cli component schema <full-path>` | Get complete component schema |
| `gitlab-ci-cli component inputs <full-path>` | List all inputs with details |
| `gitlab-ci-cli component workflows <full-path>` | List workflow definitions |
| `gitlab-ci-cli component jobs <full-path>` | List job definitions |

### `gitlab-ci-cli validate`

| Command | Description |
|---------|-------------|
| `gitlab-ci-cli validate <file>` | Validate .gitlab-ci.yml |
| `gitlab-ci-cli validate --dry-run <file>` | Validate with rules evaluation |
| `gitlab-ci-cli validate --project <path> <file>` | Validate with project context |

### `gitlab-ci-cli pipeline`

| Command | Description |
|---------|-------------|
| `gitlab-ci-cli pipeline explain --jobs <jobs>` | Show job dependency graph |
| `gitlab-ci-cli pipeline trace --var <name>` | Trace variable usage |
| `gitlab-ci-cli pipeline stages` | List stages and jobs |
| `gitlab-ci-cli pipeline includes` | Show include hierarchy |

### `gitlab-ci-cli skills`

| Command | Description |
|---------|-------------|
| `gitlab-ci-cli skills list` | List available skills |
| `gitlab-ci-cli skills get <name>` | Get skill content |
| `gitlab-ci-cli skills get <name> --full` | Include full reference |

---

## Package Structure

```
gitlab-catalog-browser/
├── bin/
│   └── gitlab-ci-cli.js           # Node.js wrapper (cross-platform)
├── cli/
│   ├── Cargo.toml                  # Rust CLI (optional native module)
│   └── src/
│       └── main.rs                # Rust entry (if native)
├── src/
│   ├── index.ts                   # CLI entry point
│   ├── commands/
│   │   ├── catalog.ts            # catalog commands
│   │   ├── component.ts          # component commands
│   │   ├── validate.ts          # validate commands
│   │   ├── pipeline.ts          # pipeline commands
│   │   └── skills.ts           # skills commands
│   ├── api/
│   │   ├── gitlab.ts            # GitLab API client
│   │   ├── catalog.ts          # Catalog API methods
│   │   └── lint.ts             # Lint API methods
│   ├── config/
│   │   └── config.ts           # Configuration loading
│   ├── output/
│   │   └── format.ts           # Output formatting
│   └── types/
│       └── index.ts            # TypeScript types
├── skill-data/
│   ├── core/
│   │   ├── workflows.md        # Core workflow instructions
│   │   ├── reference.md       # Full command reference
│   │   └── templates.md       # Pipeline templates
│   └── templates/
│       └── basic-pipeline.yml # Basic pipeline template
├── skills/
│   └── gitlab-catalog-browser/
│       └── SKILL.md           # Agent Skills entry point
├── package.json
├── tsconfig.json
└── .gitlab-ci-cli.json.example
```

---

## Implementation Phases

### Phase 1: Core CLI Infrastructure
- [ ] Project setup (TypeScript, package.json, tsconfig)
- [ ] Node.js wrapper script (`bin/gitlab-ci-cli.js`)
- [ ] Basic command parsing with `--help`
- [ ] Configuration loading (project + user level)
- [ ] GitLab API client base

### Phase 2: Catalog Browsing
- [ ] `catalog list` command with pagination
- [ ] `catalog search` command
- [ ] Table output with `--json` flag support
- [ ] Authentication handling (token from config/env)

### Phase 3: Component Schema
- [ ] `component schema` command
- [ ] `component inputs` command (formatted output)
- [ ] `component workflows` command
- [ ] `component jobs` command
- [ ] Schema caching for performance

### Phase 4: Validation
- [ ] `validate` command using CI Lint API
- [ ] Error/warning location reporting
- [ ] `--dry-run` flag for rules evaluation
- [ ] `--project` flag for project context

### Phase 5: Pipeline PKI
- [ ] `pipeline explain` with dependency graph
- [ ] `pipeline trace` for variable usage
- [ ] `pipeline stages` visualization
- [ ] `pipeline includes` hierarchy

### Phase 6: Skill Integration
- [ ] `skills` commands implementation
- [ ] `SKILL.md` for Agent Skills standard
- [ ] Core workflow content in `skill-data/`
- [ ] Progressive disclosure support

---

## OpenSpec Compliance

This specification follows OpenSpec conventions:

- `### Requirement:` headers for unique requirement identification
- `#### Scenario:` sections with **GIVEN**/**WHEN**/**THEN** keywords
- Case-sensitive header matching after normalization
- Structured change proposal format for modifications

---

## References

- [GitLab CI/CD YAML syntax](https://docs.gitlab.com/ee/ci/yaml/)
- [GitLab CI/CD Catalog](https://docs.gitlab.com/ee/ci/components/)
- [GitLab CI Lint API](https://docs.gitlab.com/ee/api/lint.html)
- [Agent Skills Specification](https://agentskills.io/specification)
- [agent-browser architecture](https://github.com/vercel-labs/agent-browser)