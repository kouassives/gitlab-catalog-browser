# Implementation Tasks

## Phase 1: Specification

1. Create `spec/specs/publish/spec.md` living spec with publish capability requirements

## Phase 2: CI Pipeline

2. Create `.github/workflows/ci.yml` — runs on push/PR to main:
   - Set up Node.js 18, 20, 22 (matrix)
   - `npm ci`
   - `npm run typecheck`
   - `npm run build`
   - `npm test`

## Phase 3: npm Publish Workflow

3. Create `.github/workflows/publish.yml` — runs on tag push `v*`:
   - Set up Node.js 20
   - `npm ci`
   - `npm run build`
   - `npm test`
   - `npm publish` with provenance

## Phase 4: Configuration & Security

4. Configure npm provenance in `package.json` (`publishConfig.provenance: true`)
5. Verify `package.json` publish readiness (`files` array, `license`, `repository` field)

## Phase 5: Documentation

6. Update `README.md` install instructions to reference npm registry
7. Update `spec/specs/cli/spec.md` if needed to reference publish capability

## Phase 6: First Publish

8. Run `npm pack` locally to verify package contents
9. Dry-run publish to npm (`npm publish --dry-run`)
10. First real publish: `git tag v0.1.0 && git push --tags`

---

**Notes**:
- npm provenance requires GitHub OIDC (`id-token: write`) — only available on `main` branch
- The npm package name `gitlab-catalog-browser` must be checked for availability before first publish
- Token-based auth (`NPM_TOKEN`) is preferred over interactive login for GitHub Actions
