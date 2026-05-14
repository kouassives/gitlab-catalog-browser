# Configuration Management Specification

## Overview

This capability provides configuration management for the gitlab-catalog-browser tool. It supports loading configuration from multiple sources, merging them with proper precedence, and using environment variables for sensitive values.

---

## Requirements

### Requirement: Load Configuration from Files

WHEN the CLI starts or executes any command,
the system SHALL load configuration from project-level and user-level configuration files with proper precedence.

#### Scenario: Load project configuration

GIVEN a file named `.gitlab-catalog-browser.json` in the current working directory
WHEN any gitlab-catalog-browser command is executed
THEN the CLI reads the project-level configuration file
AND makes the settings available to all commands
AND exits with code 0

#### Scenario: Load user configuration

GIVEN a file named `~/.gitlab-catalog-browser.json` in the user's home directory
WHEN any gitlab-catalog-browser command is executed
AND no project-level config file exists
THEN the CLI reads the user-level configuration file as fallback
AND makes the settings available to all commands
AND exits with code 0

#### Scenario: Merge user and project configuration

GIVEN both `~/.gitlab-catalog-browser.json` and `./.gitlab-catalog-browser.json` exist
WHEN any gitlab-catalog-browser command is executed
THEN the CLI loads the user config first
AND merges project config on top, overriding any conflicting keys
AND CLI flags override both config levels
AND environment variables override file-based configuration
AND exits with code 0

#### Scenario: No configuration files exist

GIVEN no configuration files exist at project or user level
WHEN any gitlab-catalog-browser command is executed
THEN the CLI uses all default values
AND operates without error
AND may prompt for required values (like GitLab URL) if not provided via flags or env vars

#### Scenario: Config file with invalid JSON

GIVEN a `.gitlab-catalog-browser.json` file with invalid JSON syntax
WHEN any gitlab-catalog-browser command is executed
THEN the CLI displays a warning with the file path and parse error
AND continues with defaults and other config sources
AND exits with code 0 (warning only, not fatal)

---

### Requirement: Support Configuration Keys

WHEN the CLI reads configuration,
the system SHALL support the defined set of configuration keys.

#### Scenario: All supported keys

GIVEN a configuration file with all supported keys
WHEN the CLI loads the configuration
THEN the following keys SHALL be recognized:
  - `gitlabUrl`: GitLab instance URL (default: `https://gitlab.com`)
  - `token`: GitLab personal access token
  - `project`: Default project path for validation context
  - `timeout`: API request timeout in milliseconds (default: 30000)
  - `output`: Default output format (`table` or `json`, default: `table`)
AND any unrecognized keys are silently ignored
AND exits with code 0

---

### Requirement: Environment Variable Overrides

WHEN the CLI executes commands,
the system SHALL allow environment variables to override file-based configuration values.

#### Scenario: Override GitLab URL via env

GIVEN a self-hosted GitLab instance
WHEN the user sets `GITLAB_CI_CLI_URL=https://gitlab.example.com`
AND executes any gitlab-catalog-browser command
THEN the CLI uses the environment variable value
AND overrides any URL from configuration files
AND exits with code 0

#### Scenario: Override token via env

GIVEN a need to keep the token out of config files
WHEN the user sets `GITLAB_CI_CLI_TOKEN=glpat-xxxx`
AND executes any gitlab-catalog-browser command
THEN the CLI uses the token from the environment variable
AND does not log or display the token value
AND exits with code 0

#### Scenario: Environment precedence over config

GIVEN both a config file with `gitlabUrl: https://old.instance.com`
AND `GITLAB_CI_CLI_URL=https://new.instance.com`
WHEN any command is executed
THEN the CLI uses the environment variable value
AND ignores the config file value for that key

---

### Requirement: Configuration Precedence

WHEN the CLI resolves a configuration value,
the system SHALL apply the following precedence order (lowest to highest):

1. User config file (`~/.gitlab-catalog-browser.json`)
2. Project config file (`./.gitlab-catalog-browser.json`)
3. Environment variables (`GITLAB_CI_CLI_*`)
4. CLI flags (`--gitlab-url`, `--token`, etc.)

#### Scenario: Full precedence chain

GIVEN all configuration sources are set with different values for the same key
WHEN any command is executed
THEN the CLI resolves the value using the precedence chain
AND CLI flags win over all other sources
AND exits with code 0

---

## Configuration File Format

### Example `.gitlab-catalog-browser.json`

```json
{
  "gitlabUrl": "https://gitlab.com",
  "token": "glpat-xxxxxxxxxxxx",
  "project": "my-group/my-project",
  "timeout": 30000,
  "output": "table"
}
```

### Supported Environment Variables

| Variable | Description |
|----------|-------------|
| `GITLAB_CI_CLI_URL` | GitLab instance URL |
| `GITLAB_CI_CLI_TOKEN` | GitLab personal access token |
| `GITLAB_CI_CLI_PROJECT` | Default project path |
| `GITLAB_CI_CLI_TIMEOUT` | API timeout in milliseconds |
| `GITLAB_CI_CLI_OUTPUT` | Default output format |
