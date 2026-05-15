# Catalog Browsing Specification

## Overview

This capability enables AI agents to browse GitLab CI/CD Catalog components from any organization or namespace. It provides commands to list, search, and inspect catalog components through the GitLab GraphQL API without requiring authentication for public resources.

---

## Requirements

### Requirement: List Catalog Components

WHEN a user provides a GitLab namespace or organization name,
the CLI SHALL fetch and display all published CI/CD catalog components from that namespace
using the GitLab GraphQL API without requiring authentication.

#### Scenario: List all components in a namespace

GIVEN a GitLab instance URL configured via `--gitlab-url` or config file
AND no token is required
WHEN the user executes `gitlab-catalog-browser catalog list --org to-be-continuous`
THEN the CLI sends a GraphQL query `group(fullPath:)` to `/api/graphql`
AND filters results by `isCatalogResource: true`
AND displays each component with its name and description in a formatted table
AND exits with code 0

#### Scenario: List with JSON output

GIVEN the same preconditions as a standard list
WHEN the user executes `gitlab-catalog-browser catalog list --org to-be-continuous --json`
THEN the CLI outputs the component list as a JSON array
AND each entry contains `name`, `full_path`, `version`, `description`
AND exits with code 0

#### Scenario: List with empty namespace

GIVEN no components exist in the specified namespace
WHEN the user executes `gitlab-catalog-browser catalog list --org empty-org`
THEN the CLI displays a message "No components found in namespace 'empty-org'"
AND exits with code 0

#### Scenario: List with invalid namespace

GIVEN a namespace that does not exist on the GitLab instance
WHEN the user executes `gitlab-catalog-browser catalog list --org nonexistent-org`
THEN the CLI returns an empty result
AND displays a message indicating no components were found
AND exits with code 0

#### Scenario: List with pagination

GIVEN a namespace with more components than the page size
WHEN the user executes `gitlab-catalog-browser catalog list --org large-org --page 2 --per-page 10`
THEN the CLI applies offset-based pagination to the filtered results
AND displays the requested page of components
AND exits with code 0

---

### Requirement: Search Catalog Components

WHEN a user provides a keyword search query,
the CLI SHALL return catalog components matching the keyword across namespaces
using the GitLab GraphQL API without requiring authentication.

#### Scenario: Search by keyword

GIVEN a search query string "docker"
WHEN the user executes `gitlab-catalog-browser catalog search "docker"`
THEN the CLI queries using `ciCatalogResources(search: "docker")`
AND displays matching components with name, version, and description
AND exits with code 0

#### Scenario: Search with no results

GIVEN a search query that matches no components
WHEN the user executes `gitlab-catalog-browser catalog search "zzzznonexistent"`
THEN the CLI displays a message "No components matching 'zzzznonexistent'"
AND exits with code 0

---

### Requirement: Display Catalog Component Summary

WHEN a user provides a full component path,
the CLI SHALL display a summary of that component including version, description, and input count
using the GitLab GraphQL API without requiring authentication.

#### Scenario: Show component info

GIVEN a component with full path "to-be-continuous/docker"
WHEN the user executes `gitlab-catalog-browser catalog info to-be-continuous/docker`
THEN the CLI queries using `ciCatalogResource(fullPath: "to-be-continuous/docker")`
AND displays the component name, latest version, description, number of inputs, and star count
AND exits with code 0

#### Scenario: Show info for nonexistent component

GIVEN a component path that does not exist
WHEN the user executes `gitlab-catalog-browser catalog info nonexistent/component`
THEN the CLI displays an error message "Component 'nonexistent/component' not found"
AND exits with non-zero code

---

## Command Reference

| Command | Description |
|---------|-------------|
| `gitlab-catalog-browser catalog list --org <namespace>` | List all components in namespace |
| `gitlab-catalog-browser catalog list --org <namespace> --json` | List components as JSON |
| `gitlab-catalog-browser catalog search <query>` | Search components by keyword |
| `gitlab-catalog-browser catalog info <full-path>` | Show component summary |

## Global Flags

| Flag | Description |
|------|-------------|
| `--gitlab-url <url>` | GitLab instance URL (default: https://gitlab.com) |
| `--token <token>` | GitLab personal access token (optional for Catalog) |
