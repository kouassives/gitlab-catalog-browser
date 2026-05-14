/**
 * CI Lint API methods for GitLab CI/CD pipeline validation.
 *
 * Provides typed methods for validating .gitlab-ci.yml content via the
 * GitLab CI Lint API endpoint.
 */

import { GitLabApiClient } from './gitlab.js';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface LintValidateOptions {
  /** Project path for context-aware validation */
  project?: string;
  /** Whether to include job details in response */
  includeJobs?: boolean;
  /** Enable dry-run mode for rules evaluation */
  dryRun?: boolean;
  /** Simulated CI/CD variables (key-value pairs) for dry-run evaluation */
  variables?: Record<string, string>;
}

export interface LintError {
  line?: number;
  column?: number;
  message: string;
}

export interface LintWarning {
  line?: number;
  column?: number;
  message: string;
}

export interface LintJob {
  name: string;
  stage: string;
  /** Whether this job would execute (in dry-run mode) */
  when?: string;
  /** Why the job was excluded (in dry-run mode) */
  except_reason?: string | null;
}

export interface LintResult {
  /** Validation status */
  status: 'valid' | 'invalid';
  /** List of errors (empty if valid) */
  errors: LintError[];
  /** List of warnings */
  warnings: LintWarning[];
  /** List of jobs (when include_jobs or dry_run is true) */
  jobs?: LintJob[];
  /** Whether the pipeline is valid (for dry-run mode) */
  valid?: boolean;
  /** Merged YAML configuration */
  merged_yaml?: string;
}

// ──────────────────────────────────────────────
// LintApi
// ──────────────────────────────────────────────

export class LintApi {
  constructor(private readonly client: GitLabApiClient) {}

  /**
   * Validate a .gitlab-ci.yml content string using the GitLab CI Lint API.
   *
   * @param content - The YAML content to validate
   * @param options - Validation options (project context, dry-run, etc.)
   */
  async validate(content: string, options: LintValidateOptions = {}): Promise<LintResult> {
    const body: Record<string, unknown> = {
      content,
    };

    if (options.includeJobs) {
      body.include_jobs = true;
    }

    if (options.dryRun) {
      body.dry = true;
    }

    if (options.variables && Object.keys(options.variables).length > 0) {
      body.variables = options.variables;
    }

    // If a project is specified, use the project-specific lint endpoint
    const endpoint = options.project
      ? `/projects/${encodeURIComponent(options.project)}/ci/lint`
      : '/ci/lint';

    return this.client.post<LintResult>(endpoint, { body });
  }
}
