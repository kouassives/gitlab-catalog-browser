# Implementation Tasks: Component Schema Inspection Commands

## Phase 1: Command Handlers

1. Create `src/commands/component.ts` with 4 handlers:
   - `handleComponentSchema(fullPath, options)` — fetches component detail, displays raw YAML `spec`, supports `--version` (via params) and `--output-file` (write to disk)
   - `handleComponentInputs(fullPath, options)` — fetches component, displays inputs table with name/type/default/required/description, handles no-inputs case
   - `handleComponentWorkflows(fullPath, options)` — fetches component, displays workflow definitions with triggers and jobs, handles no-workflows case
   - `handleComponentJobs(fullPath, options)` — fetches component, displays jobs with stage/image/script/variables/rules/needs, handles `--with-artifacts`

## Phase 2: CLI Registration

2. Register component subcommands in `src/index.ts`:
   - `gitlab-ci-cli component schema <full-path> [--version <ver>] [--output-file <path>]`
   - `gitlab-ci-cli component inputs <full-path> [--json]`
   - `gitlab-ci-cli component workflows <full-path>`
   - `gitlab-ci-cli component jobs <full-path> [--with-artifacts]`

## Phase 3: Tests

3. Write tests for component command handlers — mock `CatalogApi`, test all 14 scenarios:
   - Schema: latest version, specific version, output-file, nonexistent component, nonexistent version
   - Inputs: with details, constrained options, regex validation, no inputs
   - Workflows: with triggers, no workflows
   - Jobs: with configuration, with dependencies (--with-artifacts)

## Phase 4: Finalization

4. Verify build and all tests pass

---

**Notes**:
- All handlers use `CatalogApi.getComponentInfo()` as data source
- The schema YAML is returned as a string from the API — no YAML parsing needed
- `--output-file` uses `node:fs.writeFileSync` for simplicity
- Reuses `renderTable()` and `renderDetail()` from `src/output/table.ts`
