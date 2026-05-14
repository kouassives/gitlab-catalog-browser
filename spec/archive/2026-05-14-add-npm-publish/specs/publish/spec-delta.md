# Spec Delta: npm Package Publishing

This file defines the new `spec/specs/publish/spec.md` living specification for the publish capability.

## ADDED Requirements

### Requirement: GitHub Actions CI Pipeline

WHEN code is pushed to `main` or a pull request is opened against `main`,
the CI pipeline SHALL run automated quality checks and report results.

#### Scenario: CI passes on push

GIVEN a commit pushed to the `main` branch
WHEN the CI workflow triggers
THEN the workflow checks out the repository
AND sets up Node.js (matrix: 18.x, 20.x, 22.x)
AND runs `npm ci` to install dependencies
AND runs `npx tsc --noEmit` to type check
AND runs `npm run build` (tsc)
AND runs `npm test` (vitest run)
AND all steps complete successfully
AND the workflow exits with status "success"

#### Scenario: CI fails on type error

GIVEN a commit with TypeScript type errors
WHEN the CI workflow triggers
AND the `typecheck` step runs
THEN `tsc --noEmit` reports compilation errors
AND the workflow exits with status "failure"
AND the package is NOT published

#### Scenario: CI fails on test failure

GIVEN a commit with failing tests
WHEN the CI workflow triggers
AND the `test` step runs
THEN `vitest run` reports failing tests
AND the workflow exits with status "failure"
AND the package is NOT published

#### Scenario: CI triggers on pull request

GIVEN a pull request opened against `main`
WHEN the CI workflow triggers
THEN it runs the same checks as on push
AND reports results as a PR status check

---

### Requirement: npm Package Publishing

WHEN a maintainer pushes a version tag matching `v*.*.*`,
the publish workflow SHALL build, test, and publish the package to the npm registry.

#### Scenario: Successful publish on version tag

GIVEN a version tag `v0.2.0` pushed to the repository
AND the `NPM_TOKEN` secret is configured in GitHub
WHEN the publish workflow triggers
THEN the workflow checks out the repository at the tag
AND sets up Node.js 20.x
AND runs `npm ci`
AND runs `npm run build`
AND runs `npm test`
AND runs `npm publish --provenance` to publish to npm
AND the published package includes all files listed in `package.json` `files` array
AND the published version matches the tag version (without the `v` prefix)

#### Scenario: Publish fails without npm token

GIVEN the `NPM_TOKEN` secret is NOT configured in GitHub
WHEN the publish workflow triggers
THEN the workflow detects the missing token
AND exits with status "failure" before attempting to publish
AND displays a clear error message indicating the missing secret

#### Scenario: Publish fails on build error

GIVEN a tag pushed on a commit that fails to compile
WHEN the publish workflow triggers
AND the `build` step fails
THEN the workflow stops
AND does NOT attempt to publish
AND exits with status "failure"

#### Scenario: Publish fails on test failure

GIVEN a tag pushed on a commit with failing tests
WHEN the publish workflow triggers
AND the `test` step fails
THEN the workflow stops
AND does NOT attempt to publish
AND exits with status "failure"

#### Scenario: Non-version tag does not trigger publish

GIVEN a tag `integration-test` pushed (not matching `v*.*.*`)
WHEN the push event triggers
THEN the publish workflow does NOT run
AND only the CI workflow runs

---

### Requirement: Version Management via Git Tags

WHEN a maintainer wants to release a new version,
versions SHALL follow Semantic Versioning via git tags, and the package.json version SHALL be updated to match.

#### Scenario: Create new patch version

GIVEN the current version is `0.1.0`
WHEN a maintainer updates `package.json` version to `0.1.1`
AND commits the change
AND pushes the commit
AND creates and pushes tag `v0.1.1`
THEN the publish workflow publishes version `0.1.1` to npm
AND the previous version `0.1.0` remains available on npm

#### Scenario: Create new minor version

GIVEN the current version is `0.1.0`
WHEN a maintainer updates `package.json` version to `0.2.0`
AND commits the change
AND pushes the commit
AND creates and pushes tag `v0.2.0`
THEN the publish workflow publishes version `0.2.0` to npm
AND the previous version `0.1.0` remains available on npm

#### Scenario: Create new major version

GIVEN the current version is `0.2.0`
WHEN a maintainer updates `package.json` version to `1.0.0`
AND commits the change
AND pushes the commit
AND creates and pushes tag `v1.0.0`
THEN the publish workflow publishes version `1.0.0` to npm
AND the previous version `0.2.0` remains available on npm

---

### Requirement: Package Distribution Integrity

WHEN the package is published to npm,
the distribution SHALL be verified for completeness and integrity.

#### Scenario: Published package contains all required files

GIVEN a successful publish to npm
WHEN a user runs `npm install -g gitlab-catalog-browser`
THEN the installed package includes:
  - The `bin/gitlab-ci-cli.js` entry point
  - The compiled `dist/` directory with all JavaScript files
  - The `skill-data/` directory with agent skill instructions
  - The `skills/` directory with agent skill entry point
  - The `package.json` with correct `bin` reference
AND running `gitlab-ci-cli --help` displays usage information

#### Scenario: Published package excludes development files

GIVEN a successful publish to npm
WHEN inspecting the published package contents
THEN it does NOT include:
  - TypeScript source files (`src/`)
  - Test files (`*.test.ts`)
  - `node_modules/`
  - `.git/`

#### Scenario: Package is installable globally

GIVEN the package is published on npm
WHEN a user runs `npm install -g gitlab-catalog-browser`
THEN the `gitlab-ci-cli` command is available in the PATH
AND `gitlab-ci-cli --version` displays the correct version
AND `gitlab-ci-cli --help` displays usage information

---

## Notes

- This is a purely additive change — no existing behavior is modified
- The CI workflow uses a Node.js version matrix (18, 20, 22) to ensure compatibility
- The publish workflow targets Node.js 20 (LTS) for the publish step
- npm provenance (`--provenance`) provides transparency about the build and publish process
- Version tags follow the `v` prefix convention (e.g., `v0.1.0`, `v1.2.3`)
- The `NPM_TOKEN` secret must be configured in the GitHub repository settings before the first publish
