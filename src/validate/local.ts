/**
 * Local GitLab CI YAML validator.
 *
 * Performs basic syntax and structure validation of .gitlab-ci.yml content
 * without requiring network access or API credentials. Catches common issues
 * like invalid YAML, empty configs, jobs without scripts, etc.
 *
 * This is NOT a full GitLab CI validation — it cannot resolve includes,
 * evaluate rules, or check job interdependencies. For complete validation,
 * use LintApi.validate() which calls the GitLab CI Lint API.
 */

import { load } from 'js-yaml';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface LocalValidationError {
  line?: number;
  column?: number;
  message: string;
}

export interface LocalValidationWarning {
  line?: number;
  column?: number;
  message: string;
}

export interface LocalValidationResult {
  /** Overall status: valid if YAML parses and has basic structure */
  status: 'valid' | 'invalid';
  /** Syntax and structure errors found */
  errors: LocalValidationError[];
  /** Warnings about suspicious patterns */
  warnings: LocalValidationWarning[];
  /** Whether the content appears to be a GitLab CI config */
  looksLikeGitLabCI: boolean;
}

// ──────────────────────────────────────────────
// Known GitLab CI top-level keywords
// ──────────────────────────────────────────────

const KNOWN_TOP_LEVEL_KEYS = new Set([
  'stages',
  'variables',
  'include',
  'image',
  'services',
  'before_script',
  'after_script',
  'default',
  'workflow',
  'cache',
  'pages',
  'types',       // deprecated but still used
  'tags',        // runner tags at top level (some versions)
]);

/**
 * Regex to check if a string looks like a job name (not a known GitLab keyword).
 * Job names are user-defined identifiers.
 */
function isJobName(key: string): boolean {
  return !KNOWN_TOP_LEVEL_KEYS.has(key) && !key.startsWith('.');
}

/**
 * Attempt to extract line/column from a YAML exception.
 * js-yaml YAMLException provides `mark` with line/column info.
 */
function extractPosition(err: unknown): { line?: number; column?: number } {
  if (
    err &&
    typeof err === 'object' &&
    'mark' in err &&
    err.mark &&
    typeof err.mark === 'object'
  ) {
    const mark = err.mark as { line?: number; column?: number };
    return {
      line: mark.line !== undefined ? mark.line + 1 : undefined,
      column: mark.column !== undefined ? mark.column + 1 : undefined,
    };
  }
  return {};
}

// ──────────────────────────────────────────────
// Core validation logic
// ──────────────────────────────────────────────

/**
 * Validate .gitlab-ci.yml content locally.
 *
 * Performs these checks in order:
 *   1. YAML parsing — valid syntax?
 *   2. Top-level is a mapping (not array or scalar)?
 *   3. Known top-level keys are recognized
 *   4. Each job has required fields (script, trigger, or is a template)
 *
 * @param content - Raw YAML string to validate
 * @returns LocalValidationResult with errors and warnings
 */
export function validateLocal(content: string): LocalValidationResult {
  const errors: LocalValidationError[] = [];
  const warnings: LocalValidationWarning[] = [];
  let looksLikeGitLabCI = false;

  // ── Step 1: Parse YAML ──────────────────────
  let doc: unknown;
  try {
    doc = load(content);
  } catch (err) {
    const pos = extractPosition(err);
    errors.push({
      line: pos.line,
      column: pos.column,
      message: err instanceof Error ? err.message : String(err),
    });
    return { status: 'invalid', errors, warnings, looksLikeGitLabCI: false };
  }

  // ── Step 2: Must be a mapping ────────────────
  if (doc === null || doc === undefined) {
    errors.push({ message: 'Pipeline configuration is empty' });
    return { status: 'invalid', errors, warnings, looksLikeGitLabCI: false };
  }

  if (typeof doc !== 'object' || Array.isArray(doc)) {
    errors.push({ message: 'Pipeline configuration must be a YAML mapping (key-value pairs), not an array or scalar' });
    return { status: 'invalid', errors, warnings, looksLikeGitLabCI: false };
  }

  const config = doc as Record<string, unknown>;
  const keys = Object.keys(config);

  if (keys.length === 0) {
    errors.push({ message: 'Pipeline configuration is empty (no keys defined)' });
    return { status: 'invalid', errors, warnings, looksLikeGitLabCI: false };
  }

  // ── Step 3: Analyze keys ─────────────────────
  let hasKnownKeyword = false;
  let hasJob = false;

  for (const key of keys) {
    if (KNOWN_TOP_LEVEL_KEYS.has(key)) {
      hasKnownKeyword = true;
      continue;
    }

    const value = config[key];
    const isMapping = typeof value === 'object' && value !== null && !Array.isArray(value);

    // Only mapping values can be job definitions; scalars and arrays
    // at the top level mean this is probably not a CI config
    if (!isMapping) continue;

    if (key.startsWith('.')) {
      // Dot-prefixed keys are job templates/hidden jobs — recognize as
      // GitLab CI constructs but skip structural checks (can be partial)
      hasJob = true;
      continue;
    }

    if (isJobName(key)) {
      hasJob = true;
      const job = value as Record<string, unknown>;

      // A job must have at least one of: script, trigger, or extends
      const hasScript = 'script' in job;
      const hasTrigger = 'trigger' in job;
      const hasExtends = 'extends' in job;

      if (!hasScript && !hasTrigger && !hasExtends) {
        warnings.push({
          message: `Job '${key}' has no 'script', 'trigger', or 'extends' — it will never execute`,
        });
      }

      // Check for common typos: 'scripts' instead of 'script'
      if ('scripts' in job && !('script' in job)) {
        warnings.push({
          message: `Job '${key}' uses 'scripts' (plural) — did you mean 'script'?`,
        });
      }

      // Check for 'stages' at job level (should be 'stage')
      if ('stages' in job) {
        warnings.push({
          message: `Job '${key}' uses 'stages' (plural) — did you mean 'stage'?`,
        });
      }
    }
  }

  if (!hasJob && !hasKnownKeyword) {
    // No job definitions and no known GitLab keywords — probably not a CI config
    warnings.push({
      message: 'No job definitions found or known GitLab CI/CD keywords detected. This may not be a valid .gitlab-ci.yml file',
    });
  } else if (!hasJob && hasKnownKeyword) {
    // Has keywords but no actual jobs
    warnings.push({
      message: 'No job definitions found. GitLab CI/CD configuration must define at least one job',
    });
  }

  looksLikeGitLabCI = hasJob || hasKnownKeyword;

  return {
    status: errors.length > 0 ? 'invalid' : 'valid',
    errors,
    warnings,
    looksLikeGitLabCI,
  };
}
