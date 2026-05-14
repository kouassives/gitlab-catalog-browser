# Implementation Tasks: Batch Command

## Phase 1: Handler
- Create `src/commands/batch.ts`
- Use `child_process.execSync` to execute each command
- Support `--bail` flag to stop on first failure
- Support `--json` stdin mode
- Return combined results

## Phase 2: CLI Registration
- Register `batch` command in `src/index.ts`

## Phase 3: Tests
- 3 scenario tests: basic batch, bail on error, stdin JSON

## Phase 4: Finalize
- Typecheck + all tests pass
