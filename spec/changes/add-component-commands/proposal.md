# Proposal: Component Schema Inspection Commands

## Why

The component spec (`spec/specs/component/spec.md`) defines 4 requirements and 14 scenarios for inspecting GitLab CI/CD component schemas. The `CatalogApi.getComponentInfo()` method already returns full component details including inputs, jobs, and workflows. We need the CLI command layer.

**Context**:
- `CatalogApi.getComponentInfo()` provides component detail — ✅ done
- `renderDetail()` and `renderTable()` formatters — ✅ done (from catalog)
- CLI framework with global flags — ✅ done

**Current state**: `component` command exists in help text but has no implementation.

**Desired state**: Users can run `component schema`, `component inputs`, `component workflows`, and `component jobs` with proper output and error handling.

## What Changes

- **NEW** `src/commands/component.ts` — Command handlers for all 4 component subcommands
- **MODIFIED** `src/index.ts` — Register `component` command with 4 subcommands
- **NEW** Tests for all 14 component command scenarios

## Impact

### Affected Specifications
- `spec/specs/component/spec.md` — Already specified, implementation only (no delta)

### Affected Code
- `src/commands/component.ts` — NEW: command handlers
- `src/index.ts` — MODIFIED: register component subcommands

### User Impact
- **Positive**: 4 new commands for component schema inspection
- **Breaking**: None

## Timeline Estimate

**Small** (1-2 days)

## Risks

- **YAML display**: Component schemas are YAML — display as raw YAML string rather than trying to parse/render
- **Version parameter**: The `--version` flag needs query parameter support; the current API client supports `params` so this is straightforward
