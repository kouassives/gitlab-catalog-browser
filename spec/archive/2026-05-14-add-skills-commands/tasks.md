# Implementation Tasks: Agent Skill Integration Commands

## Phase 1: Skill Data
- Create `skill-data/manifest.json` with skill metadata
- Create `skill-data/core/workflows.md`, `reference.md`, `templates.md`
- Create `skill-data/templates/basic-pipeline.yml`, `multi-stage.yml`, `docker-build.yml`

## Phase 2: Handler
- `handleSkillsList(options)` — list skills from manifest
- `handleSkillsGet(name, options)` — get skill content, support --full, --all
- `handleSkillsPath(name)` — print filesystem path
- Resolve `GITLAB_CI_CLI_SKILLS_DIR` env var

## Phase 3: CLI Registration
- Register `skills list`, `skills get`, `skills path`

## Phase 4: Tests
- 9 scenario tests

## Phase 5: Finalize
- Typecheck + all tests pass
