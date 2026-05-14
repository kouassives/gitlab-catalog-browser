# Proposal: Pipeline Validation Commands

## Why

The validate spec (`spec/specs/validate/spec.md`) defines 4 requirements and 12 scenarios for validating `.gitlab-ci.yml` files. The `LintApi` client is already built. We need the CLI command layer.

**Context**:
- `LintApi.validate()` with project context and dry-run — ✅ done
- CLI framework with global flags, JSON output — ✅ done

**Current state**: `validate` command is listed in help but has no implementation.

**Desired state**: Users can validate files, use dry-run with simulated variables, validate with project context, and pipe content via stdin.

## What Changes

- **NEW** `src/commands/validate.ts` — Command handlers for validate
- **MODIFIED** `src/index.ts` — Register `validate` command
- **NEW** Tests for all 12 validate scenarios

## Timeline Estimate

**Small** (1 day)
