# Proposal: Pipeline Knowledge Interface (PKI) Commands

## Why

The pipeline spec (`spec/specs/pipeline/spec.md`) defines 5 requirements and 16 scenarios for analyzing GitLab CI pipeline configurations. These commands give AI agents deep visibility into pipeline structure: dependencies, variables, stages, includes, and summaries.

**Current state**: No pipeline analysis commands exist.

**Desired state**: Users can run 5 subcommands (`explain`, `trace`, `stages`, `includes`, `summary`) to fully introspect any `.gitlab-ci.yml` file.

## What Changes

- **NEW** `src/commands/pipeline.ts` — 5 handlers: explain, trace, stages, includes, summary
- **MODIFIED** `src/index.ts` — Register `pipeline` command group
- **NEW** Tests for all 16 pipeline scenarios
- **NEW** Dependency: `js-yaml` for YAML parsing

## Timeline Estimate

**Medium** (2-3 days)
