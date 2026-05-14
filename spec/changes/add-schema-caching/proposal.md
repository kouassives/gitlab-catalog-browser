# Proposal: Schema Caching

## Why

The CLI spec requires caching component schema results to improve performance on repeated requests. Currently every `component schema` call makes an API request.

**Current state**: No caching — every call hits the API.

**Desired state**: Component schema results are cached with 5-minute TTL. Invalidation and bypass supported.

## What Changes

- **NEW** `src/cache/schema-cache.ts` — File-based JSON cache with TTL
- **MODIFIED** `src/commands/component.ts` — Use cache in schema handler
- **MODIFIED** `src/index.ts` — Add `--no-cache` to `component schema`
- **NEW** Tests for 3 caching scenarios

## Timeline Estimate

**Small** (< 1 day)
