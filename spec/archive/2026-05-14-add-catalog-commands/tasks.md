# Implementation Tasks: Catalog Browsing Commands

## Phase 1: Output Formatting

1. Create `src/output/table.ts` — Simple table formatter utility:
   - `renderTable(headers, rows)` — renders aligned columns with headers
   - Support for string, number, and optional fields
   - Minimal dependencies (pure string manipulation, no external libs)
   - Used by `catalog list`, `catalog search`, `catalog info` for human-readable output

## Phase 2: Command Handlers

2. Create `src/commands/catalog.ts` — Command handlers:
   - `handleCatalogList(namespace, options)` — uses `CatalogApi.listComponents()`, renders table or JSON, handles empty namespace, nonexistent namespace
   - `handleCatalogSearch(query, options)` — uses `CatalogApi.searchComponents()`, renders table or JSON, handles no results
   - `handleCatalogInfo(fullPath, options)` — uses `CatalogApi.getComponentInfo()`, renders summary or JSON, handles not found

3. Register catalog subcommands in `src/index.ts`:
   - `gitlab-ci-cli catalog list --org <namespace> [--json] [--page <n>] [--per-page <n>]`
   - `gitlab-ci-cli catalog search <query> [--json] [--page <n>] [--per-page <n>]`
   - `gitlab-ci-cli catalog info <full-path> [--json]`

## Phase 3: Tests

4. Write tests for table formatter — column alignment, empty rows, single column, mixed types

5. Write tests for catalog command handlers — mock `CatalogApi`, verify output format, test all 10 scenarios:
   - List: namespace with components, JSON output, empty namespace, invalid namespace, pagination flag output
   - Search: keyword results, pagination, no results
   - Info: component summary, nonexistent component error

## Phase 4: Finalization

6. Verify build and all tests pass:
   ```bash
   npx tsc --noEmit
   npx vitest run
   ```

---

**Notes**:
- Total: 6 tasks across 4 phases
- Reuses `CatalogApi` from `src/api/catalog.ts` — no API changes needed
- Reuses global config loading from `src/index.ts`
- Output format matches CLI spec (`--json` flag behavior)
