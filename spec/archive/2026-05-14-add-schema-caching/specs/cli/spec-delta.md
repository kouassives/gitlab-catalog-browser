# Spec Delta: Schema Caching

## Notes

- Implements Requirement: Schema Caching (3 scenarios) from `spec/specs/cli/spec.md`
- Cache file stored in project directory as `.gitlab-ci-cli-cache.json`
- TTL configurable via `GITLAB_CI_CLI_CACHE_TTL` env var (ms)
- Cache directory configurable via `GITLAB_CI_CLI_CACHE_DIR` env var
- No spec changes — existing spec is implemented
