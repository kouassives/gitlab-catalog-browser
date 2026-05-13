# Spec Delta: CLI

This file contains specification changes for `spec/specs/cli/spec.md`.

## ADDED Requirements

### Requirement: Init CLI Tool

WHEN a user runs the init command,
the CLI SHALL verify the environment meets minimum requirements, create a default configuration file, and optionally set up shell completion.

#### Scenario: Fresh project initialization with all prerequisites met

GIVEN Node.js version 18.0.0 or later is installed
AND no `.gitlab-ci-cli.json` exists in the current directory
WHEN the user executes `gitlab-ci-cli init`
THEN the CLI checks the Node.js version meets the minimum requirement (>= 18.0.0)
AND creates a `.gitlab-ci-cli.json` with default values and a `$schema` reference
AND displays a success message with the config file path
AND exits with code 0

#### Scenario: Init with Node.js version too old

GIVEN Node.js version 16.x is installed
WHEN the user executes `gitlab-ci-cli init`
THEN the CLI detects the Node.js version is below the minimum (>= 18.0.0)
AND displays an error message "Node.js 18.0.0 or later is required (found: 16.x)"
AND does not create a config file
AND exits with non-zero code

#### Scenario: Init with existing config file

GIVEN a `.gitlab-ci-cli.json` already exists in the current directory
WHEN the user executes `gitlab-ci-cli init`
THEN the CLI detects the existing config file
AND displays a message "Configuration file already exists at .gitlab-ci-cli.json"
AND does not overwrite the file
AND exits with code 0

#### Scenario: Init with --force to overwrite config

GIVEN a `.gitlab-ci-cli.json` already exists
WHEN the user executes `gitlab-ci-cli init --force`
THEN the CLI overwrites the existing config file with fresh defaults
AND creates a backup of the previous file as `.gitlab-ci-cli.json.bak`
AND displays a message confirming the overwrite
AND exits with code 0

#### Scenario: Init with shell completion setup

GIVEN the user's shell is detected as bash or zsh
WHEN the user executes `gitlab-ci-cli init --completion bash`
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
WHEN the user executes `gitlab-ci-cli upgrade`
THEN the CLI queries the npm registry for the latest version
AND detects that 1.2.0 is newer than the installed 1.0.0
AND displays the current and latest versions
AND runs `npm install -g gitlab-catalog-browser@latest` (or the appropriate install command)
AND displays a success message after completion
AND exits with code 0

#### Scenario: Already on latest version

GIVEN the CLI is installed via npm
AND the current version matches the latest on the npm registry
WHEN the user executes `gitlab-ci-cli upgrade`
THEN the CLI queries the npm registry
AND displays a message "Already up-to-date (v1.0.0)"
AND does not attempt to install anything
AND exits with code 0

#### Scenario: Upgrade when offline

GIVEN the machine has no network connectivity
WHEN the user executes `gitlab-ci-cli upgrade`
THEN the CLI detects the network is unreachable
AND displays a message "Unable to check for updates — no network connectivity"
AND shows the current installed version
AND exits with non-zero code

#### Scenario: Upgrade detection fails with continue

GIVEN the npm registry is unreachable (timeout, DNS failure)
WHEN the user executes `gitlab-ci-cli upgrade`
THEN the CLI attempts to reach the npm registry with a timeout of 5 seconds
AND on failure, displays a warning "Could not check for latest version"
AND shows the current installed version
AND suggests trying again later
AND exits with non-zero code

#### Scenario: Upgrade with --dry-run flag

GIVEN a newer version is available on the npm registry
WHEN the user executes `gitlab-ci-cli upgrade --dry-run`
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
WHEN the user executes `gitlab-ci-cli doctor`
THEN the CLI checks the Node.js version (✓)
AND checks the config file validity (✓)
AND checks GitLab API connectivity (✓)
AND checks the token validity (✓)
AND displays a green "PASS" or "✓" for each check
AND displays an overall "All checks passed" summary
AND exits with code 0

#### Scenario: Node.js version too old

GIVEN Node.js version 16.x is installed
WHEN the user executes `gitlab-ci-cli doctor`
THEN the CLI checks the Node.js version
AND displays a red "FAIL" or "✗" for the Node.js check
AND displays the message "Node.js 18.0.0 or later required (found: 16.x)"
AND continues to run remaining checks
AND exits with non-zero code

#### Scenario: Config file invalid

GIVEN a `.gitlab-ci-cli.json` that contains invalid JSON
WHEN the user executes `gitlab-ci-cli doctor`
THEN the CLI attempts to parse the config file
AND displays a red "FAIL" or "✗" for the config check
AND displays the parse error with file path and line number
AND continues to run remaining checks
AND exits with non-zero code

#### Scenario: GitLab API unreachable

GIVEN a GitLab URL that is unreachable (wrong host, DNS failure, timeout)
WHEN the user executes `gitlab-ci-cli doctor`
THEN the CLI attempts to reach the GitLab API health endpoint
AND displays a red "FAIL" or "✗" for the API connectivity check
AND displays the error details (host unreachable, timeout, etc.)
AND suggests verifying the `gitlabUrl` configuration
AND continues to run remaining checks
AND exits with non-zero code

#### Scenario: Token invalid or expired

GIVEN a GitLab token that is expired or invalid
WHEN the user executes `gitlab-ci-cli doctor`
THEN the CLI attempts to authenticate with the GitLab API
AND receives an HTTP 401 or 403 response
AND displays a red "FAIL" or "✗" for the token check
AND displays "Authentication failed — token may be expired or invalid"
AND suggests generating a new token with the required scopes
AND continues to run remaining checks
AND exits with non-zero code

#### Scenario: Doctor with --json output

GIVEN a mixed health state (some passes, some failures)
WHEN the user executes `gitlab-ci-cli doctor --json`
THEN the CLI outputs a JSON object with:
  - A `success` boolean (true only if ALL checks pass)
  - A `checks` array where each entry has `name`, `status` (pass/fail), and `message`
  - A `summary` object with total checks, passed, and failed counts
AND exits with non-zero code (since not all checks passed)

---

## Notes

- All three commands are purely additive — no existing behavior is modified
- The Node.js version check applies to `init`, `doctor`, and at CLI startup (as a non-blocking warning)
- The `upgrade` command detects installation method by checking how the package was installed (npm global, npx, local, or from source)
- The `doctor` command outputs a machine-readable JSON format for CI/CD integration
