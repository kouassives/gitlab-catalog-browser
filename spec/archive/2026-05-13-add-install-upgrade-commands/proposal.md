# Proposal: Add Init, Upgrade, and Doctor Commands

## Why

The CLI currently has no mechanism for users to initialize, verify, upgrade, or diagnose the tool. Every spec scenario starts with "GIVEN the CLI is installed" but there is no command to *achieve* that state. Users installing from npm, building from source, or deploying in CI need:

1. **`init`** — Initialize the project: verify environment prerequisites (Node.js version), create default configuration, set up shell completion
2. **`upgrade`** — Check npm registry for newer versions and self-update
3. **`doctor`** — Diagnose installation health (config validity, API connectivity, token validity)

These commands follow common CLI conventions (`git init`, `npm init`, `vue init`) and mirror proven patterns from [agent-browser](https://github.com/vercel-labs/agent-browser) for `upgrade` and `doctor`.

**Current state**: No init/upgrade/doctor commands exist. Users must manually verify Node.js version, create config files, and check API connectivity.

**Desired state**: Users can run `gitlab-ci-cli init` to set up, `gitlab-ci-cli doctor` to diagnose, and `gitlab-ci-cli upgrade` to stay current — exactly as they would with any mature CLI tool.

## What Changes

- Add `gitlab-ci-cli init` command — verify environment, create default `.gitlab-ci-cli.json`, optional shell completion setup
- Add `gitlab-ci-cli upgrade` command — check npm registry for latest version, apply upgrade
- Add `gitlab-ci-cli doctor` command — comprehensive diagnostics (Node.js, config, API connectivity, token)
- Create `src/commands/setup.ts` — handlers for all three commands
- Update `src/index.ts` — register new commands in the CLI router
- No new npm dependencies (uses native `fetch` for API checks, `child_process` for upgrade)

## Impact

### Affected Specifications
- `spec/specs/cli/spec.md` — **3 new ADDED requirements**: Init CLI Tool, Upgrade CLI Tool, Doctor Diagnostic

### Affected Code
- `src/commands/setup.ts` — new file (~200 lines): init, upgrade, doctor handlers
- `src/index.ts` — register 3 new commands in router (minor change)
- `package.json` — no new dependencies; `bin` entry already exists

### User Impact
- **Positive**: New `--help` output lists `init`, `upgrade`, `doctor` alongside existing commands
- **Positive**: `doctor` gives users a clear troubleshooting entry point
- **None**: No breaking changes; all existing commands continue working

### API Changes
- None (these are CLI self-management commands, not API consumers)

### Migration Required
- [ ] Documentation updates (README, man page, skill-data reference)
- [ ] `--help` output updates

## Timeline Estimate

**Small** — 3-5 days for a single developer. Pure additive work with no external API dependencies.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `npm` not installed globally | Low | `doctor` detects this gracefully; `upgrade` falls back to instructions |
| Network unavailability during upgrade | Medium | `upgrade` works offline showing current version, skips network checks |
| Wrong Node.js version | Low | `init` and `doctor` check and report clearly, exit with actionable message |
