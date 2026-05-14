# Proposal: npm Package Publishing via GitHub Actions

## Why

The `gitlab-catalog-browser` CLI tool is currently only usable from source (requires `git clone`, `npm install`, `npm run build`). To enable frictionless installation for AI agents and developers, the package must be published to the npm registry with an automated CI/CD pipeline.

**Context**:
- The CLI is feature-complete with 9 command groups, 186 passing tests, and zero TypeScript errors
- The `upgrade` command already checks the npm registry for newer versions — but nothing is published
- The `package.json` already has `bin`, `files`, `engines`, and `prepublishOnly` configured
- The project currently has zero CI/CD automation (no `.github/` workflows)

**Current state**: No npm package published. No CI pipeline. Manual build/test only.

**Desired state**: Every push runs automated CI (build + test + typecheck). Publishing to npm happens automatically when a maintainer pushes a version tag. Developers can install via `npm install -g gitlab-catalog-browser`.

## What Changes

- Add a GitHub Actions CI workflow (`.github/workflows/ci.yml`) that runs on every push and PR to `main`
- Add a GitHub Actions publish workflow (`.github/workflows/publish.yml`) that publishes to npm on version tags
- Update `spec/specs/publish/spec.md` with the new publish capability specification
- Configure npm provenance for package security
- Update `package.json` if needed for publish readiness
- Update `README.md` install instructions if needed

## Impact

### Affected Specifications
- `spec/specs/publish/spec.md` — NEW capability: GitHub Actions CI pipeline and npm publishing

### Affected Code
- `.github/workflows/ci.yml` — NEW: CI workflow (build, test, typecheck)
- `.github/workflows/publish.yml` — NEW: npm publish workflow
- `package.json` — possible minor adjustments for publish readiness

### User Impact
- **Positive**: Users can install with `npm install -g gitlab-catalog-browser`
- **Positive**: Automated quality gates prevent broken packages from being published
- **None**: No CLI interface changes; all existing commands remain identical

### Migration Required
- [ ] Set `NPM_TOKEN` secret in GitHub repository
- [x] No database migration
- [x] No API version bump
- [ ] User communication: update README install instructions

## Timeline Estimate

Small — 1 implementation session. This is a devops change with no complex logic.

## Risks

- **npm token expiry**: If the `NPM_TOKEN` secret expires, publish workflow will fail. Mitigation: add monitoring/notification on workflow failure.
- **Package name conflict**: The name `gitlab-catalog-browser` must be available on npm. Mitigation: verify name availability before first publish.
- **Provenance setup**: npm provenance requires specific OIDC configuration on GitHub. Mitigation: configure `id-token: write` permission and npm provenance flag.
