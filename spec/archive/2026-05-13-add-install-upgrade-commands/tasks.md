# Implementation Tasks: Init, Upgrade, Doctor Commands

## Phase 1: Core Infrastructure

1. Create `src/commands/setup.ts` — shared utilities for Node.js version detection, npm registry query, shell detection, and helper functions used by all three commands
2. Create `src/commands/setup.test.ts` — unit tests for shared utilities (version parsing, npm registry URL building, shell detection)

## Phase 2: Init Command

3. Implement `gitlab-ci-cli init` handler — Node.js version check, default config file generation (`.gitlab-ci-cli.json` with `$schema`), `--force` flag for overwrite
4. Implement `gitlab-ci-cli init --completion <shell>` — shell completion script generation for bash and zsh
5. Write tests for init command — fresh setup, old Node.js, existing config, force overwrite, shell completion

## Phase 3: Upgrade Command

6. Implement `gitlab-ci-cli upgrade` handler — npm registry query (`https://registry.npmjs.org/gitlab-catalog-browser/latest`), version comparison, npm update execution
7. Implement `gitlab-ci-cli upgrade --dry-run` — preview mode without executing the upgrade
8. Write tests for upgrade command — upgrade available, already latest, offline, dry-run

## Phase 4: Doctor Command

9. Implement `gitlab-ci-cli doctor` handler — Node.js check, config validation, API connectivity test, token validity test
10. Implement `--json` output format for doctor command — structured JSON response with per-check results
11. Write tests for doctor command — all pass, Node.js fail, config fail, API fail, token fail, JSON output

## Phase 5: Integration & Documentation

12. Register all three commands in `src/index.ts` — add to CLI router with help text and examples
13. Update CLI command reference in `skill-data/core/reference.md` — add `init`, `upgrade`, `doctor` to the command table
14. Update `README.md` — add init/upgrade/doctor to quick start and command reference sections
15. Update existing cli spec scenarios that use "GIVEN the CLI is installed" to reference `gitlab-ci-cli init`

---
**Notes**:
- Total: 15 tasks across 5 phases
- No new npm dependencies required (uses native `fetch`, `fs`, `child_process`)
- Each command is independently testable
- Phase 1 must complete before phases 2-4
- Phases 2-4 can proceed in parallel once Phase 1 is done
- Phase 5 requires all previous phases complete
