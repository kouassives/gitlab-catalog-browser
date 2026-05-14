/**
 * Catalog-specific type definitions for GitLab CI/CD Catalog components.
 */

// ──────────────────────────────────────────────
// Core types
// ──────────────────────────────────────────────

/**
 * Summary info for a catalog component (as returned by list/search).
 */
export interface CatalogComponent {
  id: number;
  name: string;
  /** Full path including namespace, e.g. "to-be-continuous/docker-build" */
  full_path: string;
  /** Latest version string, e.g. "1.2.0" */
  version: string;
  /** Human-readable description */
  description: string;
  /** Latest tag, e.g. "v1.2.0" */
  latest_tag?: string;
  /** When the component was last updated */
  updated_at?: string;
}

/**
 * Detailed component info including specification.
 */
export interface CatalogComponentDetail extends CatalogComponent {
  /** Full YAML specification content */
  spec?: string;
  /** Input parameter definitions */
  inputs?: ComponentInput[];
  /** Job definitions */
  jobs?: ComponentJob[];
  /** Workflow definitions */
  workflows?: ComponentWorkflow[];
}

// ──────────────────────────────────────────────
// Input types
// ──────────────────────────────────────────────

export interface ComponentInput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  required: boolean;
  default?: unknown;
  description?: string;
  /** Regex validation pattern */
  regex?: string;
  /** Constrained options */
  options?: string[];
}

// ──────────────────────────────────────────────
// Job types
// ──────────────────────────────────────────────

export interface ComponentJob {
  name: string;
  stage: string;
  image?: string;
  script: string[];
  /** Variables defined at job level */
  variables?: Record<string, string>;
  /** Job dependencies (needs) */
  needs?: string[];
  /** Rules/conditions */
  rules?: string[];
  /** When condition */
  when?: string;
}

// ──────────────────────────────────────────────
// Workflow types
// ──────────────────────────────────────────────

export interface ComponentWorkflow {
  name: string;
  /** Trigger conditions */
  triggers: string[];
  /** Jobs included in this workflow */
  jobs: string[];
  /** Rules for this workflow */
  rules?: string[];
}

// ──────────────────────────────────────────────
// Namespace helpers
// ──────────────────────────────────────────────

/**
 * GitLab namespace/project info for API calls.
 * Used to resolve a namespace to a project ID for catalog API calls.
 */
export interface NamespaceInfo {
  id: number;
  name: string;
  full_path: string;
}
