# gitlab-ci-cli Command Reference

## Global Options

| Option | Env Variable | Description |
|--------|-------------|-------------|
| `-V, --version` | | Show version number |
| `-h, --help` | | Show help |

## Commands

### `init`

Initialize project configuration and verify the environment.

```
gitlab-ci-cli init                      # Create config, check Node.js
gitlab-ci-cli init --force              # Overwrite existing config
gitlab-ci-cli init --completion bash    # Generate bash completion
gitlab-ci-cli init --completion zsh     # Generate zsh completion
```

**Checks performed:**
- Node.js version >= 18.0.0
- Creates `.gitlab-ci-cli.json` with default values
- Generates shell completion script (optional)

### `upgrade`

Check for and apply CLI upgrades from the npm registry.

```
gitlab-ci-cli upgrade                   # Check and upgrade
gitlab-ci-cli upgrade --dry-run         # Check only, no upgrade
```

**Behavior:**
- Queries `https://registry.npmjs.org/gitlab-catalog-browser/latest`
- Compares with installed version
- Runs `npm install -g gitlab-catalog-browser@latest` on upgrade
- Handles offline/unreachable registry gracefully
- `--dry-run` shows what would be done without executing

### `doctor`

Run comprehensive environment diagnostics.

```
gitlab-ci-cli doctor                    # Human-readable output
gitlab-ci-cli doctor --json             # Machine-readable JSON
```

**Checks performed:**
| Check | What it validates |
|-------|-------------------|
| Node.js Version | >= 18.0.0 |
| Configuration File | `.gitlab-ci-cli.json` exists and is valid JSON |
| GitLab API Connectivity | Can reach the GitLab instance API |
| GitLab Token | Token is valid (if configured) |

**JSON output format:**
```json
{
  "success": true,
  "checks": [
    { "name": "Node.js Version", "status": "pass", "message": "Node.js v22.22.2" }
  ],
  "summary": { "total": 4, "passed": 4, "failed": 0 }
}
```

### `catalog`

Browse GitLab CI/CD Catalog components.

```
gitlab-ci-cli catalog list --org <namespace>
gitlab-ci-cli catalog list --org <namespace> --json
gitlab-ci-cli catalog search <query>
gitlab-ci-cli catalog info <full-path>
```

### `component`

Inspect CI/CD component schemas.

```
gitlab-ci-cli component schema <full-path>
gitlab-ci-cli component schema <full-path> --version <version>
gitlab-ci-cli component inputs <full-path>
gitlab-ci-cli component workflows <full-path>
gitlab-ci-cli component jobs <full-path>
```

### `validate`

Validate `.gitlab-ci.yml` files.

```
gitlab-ci-cli validate <file>
gitlab-ci-cli validate --dry-run <file>
gitlab-ci-cli validate --project <path> <file>
gitlab-ci-cli validate --stdin
```

### `pipeline`

Analyze pipeline structure and dependencies.

```
gitlab-ci-cli pipeline explain --jobs <list>
gitlab-ci-cli pipeline trace --var <name>
gitlab-ci-cli pipeline stages
gitlab-ci-cli pipeline includes
gitlab-ci-cli pipeline summary
```

### `skills`

Manage agent skill content.

```
gitlab-ci-cli skills list
gitlab-ci-cli skills get <name>
gitlab-ci-cli skills path [name]
```
