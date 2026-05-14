# Proposal: Batch Command Execution

## Why

The CLI spec requires the ability to execute multiple commands in a single invocation. This is useful for AI agents that need to gather information from multiple commands without multiple round-trips.

**Current state**: No batch execution capability.

**Desired state**: Users can run `gitlab-ci-cli batch "cmd1" "cmd2"` to execute multiple commands sequentially.

## What Changes

- **NEW** `src/commands/batch.ts` — Batch command handler using child process
- **NEW** Command registration in `src/index.ts`
- **NEW** Tests for 3 batch scenarios

## Timeline Estimate

**Small** (< 1 day)
