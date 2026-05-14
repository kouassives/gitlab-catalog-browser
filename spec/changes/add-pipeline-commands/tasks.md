# Implementation Tasks: Pipeline PKI Commands

## Phase 0: Setup
- Add `js-yaml` dependency

## Phase 1: Handler — `pipeline explain`
- Parse YAML, extract jobs, needs, stage, when, artifacts
- Build dependency graph
- Output Mermaid flowchart
- Detect bottleneck jobs (most dependents)
- Group parallel jobs visually
- Handle nonexistent job error

## Phase 2: Handler — `pipeline trace`
- Parse YAML, find variable definitions (global + per-job)
- Find variable usages (`$VAR`, `${VAR}` patterns)
- Track override chain
- Handle predefined vars, undefined vars with suggestions
- Handle includes references

## Phase 3: Handler — `pipeline stages`
- Parse YAML, extract stages or use defaults
- Map jobs to stages
- Show parallel/sequential info
- `--mermaid` for Mermaid Gantt/flowchart

## Phase 4: Handler — `pipeline includes`
- Parse YAML, extract include directives
- Build tree visualization
- Detect circular dependencies
- Handle local/project/remote/template/component types
- Handle unresolvable remotes

## Phase 5: Handler — `pipeline summary`
- Parse YAML, count stages/jobs
- List all variables (global + per-job)
- List include sources
- Detect patterns (cache, artifacts, services, etc.)
- Output structured text

## Phase 6: CLI Registration
- Register `pipeline explain`, `pipeline trace`, `pipeline stages`, `pipeline includes`, `pipeline summary` in `src/index.ts`

## Phase 7: Tests
- 16 scenario tests covering all requirements

## Phase 8: Finalization
- Typecheck + all tests pass
