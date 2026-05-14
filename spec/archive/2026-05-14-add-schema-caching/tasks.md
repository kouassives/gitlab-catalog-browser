# Implementation Tasks: Schema Caching

## Phase 1: Cache Layer
- Create `src/cache/schema-cache.ts` with `SchemaCache` class
- File-based JSON persistence in project directory
- 5-minute default TTL
- Automatic load/save on get/set

## Phase 2: Component Schema Handler
- Add cache check before API call in `handleComponentSchema`
- Add `(from cache)` note to cached responses
- Support `--no-cache` bypass

## Phase 3: CLI Registration
- Add `--no-cache` flag to `component schema` command

## Phase 4: Tests
- 3 scenario tests: cached result, invalidation, bypass

## Phase 5: Finalize
- Typecheck + all tests pass
