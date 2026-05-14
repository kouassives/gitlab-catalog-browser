# Proposal: Agent Skill Integration Commands

## Why

The skills spec (`spec/specs/skills/spec.md`) defines 5 requirements and 9 scenarios for serving AI agent skill content. These commands enable AI agents to discover and consume workflow instructions for using gitlab-ci-cli.

**Current state**: No skills commands or skill data exist.

**Desired state**: Agents can `skills list`, `skills get <name>`, and `skills path [name]` to access bundled skill content.

## What Changes

- **NEW** `skill-data/` — Bundled skill content (core workflows, templates)
- **NEW** `src/commands/skills.ts` — Handlers for list, get, path
- **MODIFIED** `src/index.ts` — Register `skills` command group
- **NEW** Tests for all 9 skills scenarios

## Timeline Estimate

**Small** (1 day)
