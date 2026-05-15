/**
 * CI Lint API methods for GitLab CI/CD pipeline validation.
 *
 * Provides typed methods for validating .gitlab-ci.yml content via the
 * GitLab CI Lint API endpoint.
 */

import { GitLabApiClient } from './gitlab.js';
import { ConfigurationError } from '../types/api.js';

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

export interface LintJob {
  name: string;
  stage: string;
  /** Whether this job would execute (in dry-run mode) */
  when?: string;
  /** Why the job was excluded (in dry-run mode) */
  except_reason?: string | null;
}

export interface LintResult {
  /** Whether the pipeline is valid (GitLab API returns boolean `valid`) */
  valid: boolean;
  /** List of error messages (empty if valid) */
  errors: string[];
  /** List of warning messages */
  warnings: string[];
  /** List of jobs (when include_jobs or dry_run is true) */
  jobs?: LintJob[];
  /** List of included files */
  includes?: Array<{ type: string; location: string; blob?: string; raw?: string }>;
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
   * Note: GitLab 14.0+ requires authentication and a project context for CI lint.
   * The global `/api/v4/ci/lint` endpoint has been removed on modern GitLab.
   * A `project` option is always required.
   *
   * @param content - The YAML content to validate
   * @param options - Validation options (project context required, dry-run, etc.)
   */
  async validate(content: string, options: LintValidateOptions = {}): Promise<LintResult> {
    if (!options.project) {
      throw new ConfigurationError(
        'A project path is required for CI lint validation. ' +
        'Use --project <namespace/project> or set it in your config file.'
      );
    }

    const body: Record<string, unknown> = {
      content,
    };

    if (options.includeJobs) {
      body.include_jobs = true;
    }

    if (options.dryRun) {
      body.dry_run = true;
    }

    if (options.variables && Object.keys(options.variables).length > 0) {
      body.variables = options.variables;
    }

    const endpoint = `/api/v4/projects/${encodeURIComponent(options.project)}/ci/lint`;

    return this.client.post<LintResult>(endpoint, { body });
  }
}
