# Implementation Tasks: Pipeline Validation Commands

## Phase 1: Command Handler

1. Create `src/commands/validate.ts`:
   - `handleValidate(filePath, options)` — reads file, calls `LintApi.validate()`, displays result/errors/warnings
   - Supports `--dry-run` (pass `dryRun: true`), `--project <path>`, `--var <key=value>` (simulated vars)
   - `--stdin` mode: reads from `process.stdin`, validates content
   - Handles: file not found, invalid YAML, valid pipeline, warnings, insufficient permissions
   - JSON output with `--json`

## Phase 2: CLI Registration

2. Register validate command in `src/index.ts`

## Phase 3: Tests

3. Write tests for all 12 scenarios: valid file, invalid file, warnings, file not found, dry-run, dry-run with vars, project context variables, project includes, insufficient permissions, stdin, stdin invalid, json output

## Phase 4: Finalization

4. Typecheck + all tests pass
