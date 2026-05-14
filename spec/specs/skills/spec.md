# Agent Skill Integration Specification

## Overview

This capability enables the CLI to serve skill content for AI agent workflows following the Agent Skills standard. It provides commands to list, retrieve, and manage skill content that AI agents use to understand how to work with GitLab CI/CD pipelines.

---

## Requirements

### Requirement: List Available Skills

WHEN an AI agent requests the list of available skills,
the CLI SHALL return a list of all bundled skill names and descriptions.

#### Scenario: List all skills

GIVEN the CLI is installed and has bundled skill content
WHEN the agent executes `gitlab-catalog-browser skills list`
THEN the CLI outputs a list of available skills with each skill's name and one-line description
AND exits with code 0

#### Scenario: List skills in JSON format

GIVEN an agent that consumes machine-readable output
WHEN the agent executes `gitlab-catalog-browser skills list --json`
THEN the CLI outputs the skill list as a JSON array
AND each entry contains `name`, `description`, and `path`
AND exits with code 0

#### Scenario: No skills installed

GIVEN the CLI is installed without bundled skill content
WHEN the agent executes `gitlab-catalog-browser skills list`
THEN the CLI outputs an empty list
AND exits with code 0

---

### Requirement: Serve Core Skill Content

WHEN an AI agent requests the core skill,
the CLI SHALL output complete workflow instructions for using gitlab-catalog-browser to browse, validate, and generate GitLab CI pipelines.

#### Scenario: Get core skill content

GIVEN the CLI is installed with skill data
WHEN the agent executes `gitlab-catalog-browser skills get core`
THEN the CLI outputs the core workflow instructions including:
  - How to browse and search the GitLab CI/CD Catalog
  - How to inspect component schemas and inputs
  - How to validate `.gitlab-ci.yml` files
  - How to analyze pipeline structure and dependencies
  - Common pipeline patterns and troubleshooting guidance
AND exits with code 0

#### Scenario: Get core skill with full reference

GIVEN the CLI is installed with skill data
WHEN the agent executes `gitlab-catalog-browser skills get core --full`
THEN the CLI outputs the core workflow instructions
AND includes the full command reference with all options
AND includes template examples
AND includes reference materials
AND exits with code 0

---

### Requirement: Serve Specialized Skill Content

WHEN an AI agent requests a specialized skill,
the CLI SHALL output skill-specific content for that domain.

#### Scenario: Get specialized skill content

GIVEN the CLI has a specialized skill "templates"
WHEN the agent executes `gitlab-catalog-browser skills get templates`
THEN the CLI outputs the templates skill content including:
  - Pipeline template patterns (basic, multi-stage, with services, etc.)
  - Component usage templates
  - Best practices for pipeline structure
AND exits with code 0

#### Scenario: Request nonexistent skill

GIVEN a skill name that does not exist
WHEN the agent executes `gitlab-catalog-browser skills get nonexistent`
THEN the CLI displays an error message "Skill 'nonexistent' not found"
AND suggests available skills via `gitlab-catalog-browser skills list`
AND exits with non-zero code

---

### Requirement: Get Skill Directory Path

WHEN an AI agent needs filesystem access to skill content,
the CLI SHALL return the filesystem path to the skill directory.

#### Scenario: Get skill path

GIVEN the CLI is installed
WHEN the agent executes `gitlab-catalog-browser skills path core`
THEN the CLI outputs the absolute filesystem path to the core skill content directory
AND exits with code 0

#### Scenario: Get base skills path

GIVEN the CLI is installed
WHEN the agent executes `gitlab-catalog-browser skills path`
THEN the CLI outputs the absolute filesystem path to the root skills directory
AND exits with code 0

---

### Requirement: Get All Skills at Once

WHEN an AI agent needs all skill content in a single invocation,
the CLI SHALL output every available skill's content sequentially.

#### Scenario: Dump all skills

GIVEN the CLI has multiple bundled skills
WHEN the agent executes `gitlab-catalog-browser skills get --all`
THEN the CLI outputs the content of every available skill
AND separates each skill with a clear delimiter
AND exits with code 0

---

## Skill Data Structure

### Directory Layout

```
skill-data/
├── core/
│   ├── workflows.md        # Core workflow instructions
│   ├── reference.md        # Full command reference
│   └── templates.md        # Pipeline template patterns
└── templates/
    ├── basic-pipeline.yml  # Basic three-stage pipeline
    ├── multi-stage.yml     # Multi-stage with approvals
    └── docker-build.yml    # Docker build and push pipeline
```

### Skill Content Format

Each skill content file SHALL be valid Markdown following the Agent Skills standard format:

- `---` frontmatter with `name` and `description` fields
- Human-readable workflow instructions
- Code examples with syntax highlighting
- Reference tables where applicable

---

## Command Reference

| Command | Description |
|---------|-------------|
| `gitlab-catalog-browser skills list` | List available skills |
| `gitlab-catalog-browser skills list --json` | List skills as JSON |
| `gitlab-catalog-browser skills get <name>` | Get skill content |
| `gitlab-catalog-browser skills get <name> --full` | Include full reference |
| `gitlab-catalog-browser skills get --all` | Output every skill |
| `gitlab-catalog-browser skills path [name]` | Print skill directory path |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GITLAB_CI_CLI_SKILLS_DIR` | Override the skills directory path |
