# Proposal: Catalog Browsing Commands

## Why

The catalog spec (`spec/specs/catalog/spec.md`) defines 3 requirements and 10 scenarios for browsing GitLab CI/CD Catalog components. The `CatalogApi` client has been built in `src/api/catalog.ts`. What's missing is the CLI command layer that wires the API to user-facing commands.

**Context**:
- `CatalogApi` provides `listComponents()`, `searchComponents()`, `getComponentInfo()` — ✅ done
- Global `--gitlab-url` and `--token` flags, config loading — ✅ done
- CLI help already lists `catalog` in available commands — ✅ done
- Actual command handlers and output formatting — ❌ missing

**Current state**: `gitlab-ci-cli catalog` is listed in help but has no subcommands implemented.

**Desired state**: Users can run `catalog list`, `catalog search`, and `catalog info` with proper table/JSON output and error handling.

## What Changes

- **NEW** `src/commands/catalog.ts` — Command handlers for `catalog list`, `catalog search`, `catalog info`
- **MODIFIED** `src/index.ts` — Register `catalog` command with subcommands, wire to handlers
- **NEW** `src/output/table.ts` — Table formatter utility (reusable by all commands)
- **NEW** Tests for all 10 catalog command scenarios

## Impact

### Affected Specifications
- `spec/specs/catalog/spec.md` — Already specified, implementation only (no delta)

### Affected Code
- `src/commands/catalog.ts` — NEW: command handlers
- `src/index.ts` — MODIFIED: register catalog subcommands
- `src/output/table.ts` — NEW: simple table formatter

### User Impact
- **Positive**: 3 new commands available (`catalog list`, `catalog search`, `catalog info`)
- **Breaking**: None (new functionality)

### API Changes
- None

## Timeline Estimate

**Small** (1-2 days)

## Risks

- **Namespace resolution**: `CatalogApi.resolveNamespace()` uses `/groups` search — may need fallback for usernames. Mitigated by clear error messages.
