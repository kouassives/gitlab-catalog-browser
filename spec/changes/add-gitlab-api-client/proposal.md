# Proposal: GitLab API Client & Configuration Loading

## Why

All CLI commands (catalog, component, validate, pipeline) need to communicate with GitLab APIs. Currently there is no shared API client — each command would have to duplicate auth, error handling, pagination, and timeout logic.

**Context**:
- The CLI architecture (`spec/specs/cli/spec.md`) defines `src/api/gitlab.ts`, `src/api/catalog.ts`, `src/api/lint.ts` and `src/config/loader.ts`, `src/config/types.ts` as base infrastructure
- Config requirements (4 requirements, 9 scenarios) are fully specified in `spec/specs/config/spec.md` but not implemented
- Catalog, component, and validate specs all reference GitLab API endpoints but offer no shared HTTP layer

**Current state**: No API client exists. No config loader exists. The `init` command writes a `.gitlab-ci-cli.json` but nothing reads it yet.

**Desired state**: A config-aware, authenticated GitLab API client with proper error handling, pagination support, and typed response models — ready for all downstream commands to consume.

## What Changes

- **NEW** `spec/specs/api/spec.md` — Living specification for the GitLab API client capability
- **NEW** `src/api/gitlab.ts` — Base GitLab API client (auth, HTTP methods, error handling, pagination)
- **NEW** `src/api/catalog.ts` — Catalog API methods (list, search, info)
- **NEW** `src/api/lint.ts` — CI Lint API methods (validate, dry-run)
- **NEW** `src/config/types.ts` — TypeScript config interface and default values
- **NEW** `src/config/loader.ts` — Config loader (file reading, env var override, merging, precedence)
- **NEW** `src/types/api.ts` — Shared API response types
- **NEW** `src/types/catalog.ts` — Catalog-specific types
- **NEW** Unit tests for all modules

## Impact

### Affected Specifications
- `spec/specs/api/spec.md` — **NEW** capability (3 requirements: Base Client, Catalog API, CI Lint API)
- `spec/specs/config/spec.md` — Already specified, implementation only (no delta)

### Affected Code
- `src/api/gitlab.ts` — Base HTTP client (native fetch wrapper)
- `src/api/catalog.ts` — Catalog endpoint methods
- `src/api/lint.ts` — CI Lint endpoint methods
- `src/config/types.ts` — Config interface definition
- `src/config/loader.ts` — Config loading, merging, env override logic
- `src/types/api.ts` — API response/error types
- `src/types/catalog.ts` — Catalog component types

### User Impact
- **None directly** — this is pure infrastructure. No new user-facing commands are added.
- Indirect: all future commands will have consistent API behaviour, error messages, and config support.

### API Changes
- None (no user-facing API changes)

### Migration Required
- [ ] User communication needed — N/A (internal infrastructure)

## Dependencies

| Capability | Depends On |
|-----------|------------|
| catalog commands | This proposal (API client) |
| component commands | This proposal (API client) |
| validate commands | This proposal (API client + lint API) |
| pipeline PKI commands | This proposal (API client for includes resolution) |

## Timeline Estimate

**Medium** (3-5 days for spec + implementation + tests)

## Risks

- **Native fetch differs subtly from Node.js 18 vs 20+**: Mitigated by running tests in CI matrix
- **GitLab API versioning**: The Catalog REST API is still evolving — design the client with header-based version negotiation
