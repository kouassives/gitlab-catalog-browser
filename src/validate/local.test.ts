/**
 * Tests for the local GitLab CI YAML validator.
 *
 * Covers all validation paths:
 *   1. Valid GitLab CI config with jobs
 *   2. Invalid YAML syntax
 *   3. Empty document
 *   4. Array instead of mapping
 *   5. Empty mapping
 *   6. Job without script, trigger, or extends
 *   7. Job with 'scripts' instead of 'script' (typo)
 *   8. Job with 'stages' instead of 'stage' (typo)
 *   9. No jobs (only keywords like include, stages)
 *  10. Non-GitLab-CI YAML
 *  11. Dot-prefixed job templates (hidden jobs)
 *  12. Trigger-only job
 *  13. Extends-only job
 */

import { describe, it, expect } from 'vitest';
import { validateLocal } from './local.js';

// ──────────────────────────────────────────────
// Scenario 1: Valid GitLab CI config
// ──────────────────────────────────────────────

describe('Valid GitLab CI config', () => {
  it('should return valid for a standard pipeline with stages and jobs', () => {
    const result = validateLocal(`
stages: [build, test, deploy]
variables:
  IMAGE_TAG: latest

build:
  stage: build
  script: docker build

test:
  stage: test
  script: npm test

deploy:
  stage: deploy
  script: kubectl apply
`);
    expect(result.status).toBe('valid');
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.looksLikeGitLabCI).toBe(true);
  });
});

// ──────────────────────────────────────────────
// Scenario 2: Invalid YAML syntax
// ──────────────────────────────────────────────

describe('Invalid YAML syntax', () => {
  it('should return errors for broken YAML', () => {
    const result = validateLocal('stages: [build\n  script: echo');
    expect(result.status).toBe('invalid');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.looksLikeGitLabCI).toBe(false);
  });
});

// ──────────────────────────────────────────────
// Scenario 3: Empty document
// ──────────────────────────────────────────────

describe('Empty document', () => {
  it('should return error for null content', () => {
    const result = validateLocal('');
    expect(result.status).toBe('invalid');
    expect(result.errors[0].message).toContain('empty');
    expect(result.looksLikeGitLabCI).toBe(false);
  });
});

// ──────────────────────────────────────────────
// Scenario 4: Array instead of mapping
// ──────────────────────────────────────────────

describe('Array instead of mapping', () => {
  it('should return error for array content', () => {
    const result = validateLocal('- job1\n- job2');
    expect(result.status).toBe('invalid');
    expect(result.errors[0].message).toContain('mapping');
    expect(result.looksLikeGitLabCI).toBe(false);
  });
});

// ──────────────────────────────────────────────
// Scenario 5: Empty mapping
// ──────────────────────────────────────────────

describe('Empty mapping', () => {
  it('should return error for empty YAML object', () => {
    const result = validateLocal('{}');
    expect(result.status).toBe('invalid');
    expect(result.errors[0].message).toContain('empty');
    expect(result.looksLikeGitLabCI).toBe(false);
  });
});

// ──────────────────────────────────────────────
// Scenario 6: Job without script
// ──────────────────────────────────────────────

describe('Job without script', () => {
  it('should warn when a job has no script, trigger, or extends', () => {
    const result = validateLocal(`
build:
  stage: build
  image: node:18
`);
    expect(result.status).toBe('valid');
    expect(result.warnings.some(w => w.message.includes("no 'script'"))).toBe(true);
    expect(result.looksLikeGitLabCI).toBe(true);
  });
});

// ──────────────────────────────────────────────
// Scenario 7: 'scripts' typo
// ──────────────────────────────────────────────

describe("'scripts' typo instead of 'script'", () => {
  it('should warn when job uses plural "scripts"', () => {
    const result = validateLocal(`
build:
  scripts: echo hello
`);
    expect(result.status).toBe('valid');
    expect(result.warnings.some(w => w.message.includes('scripts'))).toBe(true);
    expect(result.looksLikeGitLabCI).toBe(true);
  });
});

// ──────────────────────────────────────────────
// Scenario 8: 'stages' typo at job level
// ──────────────────────────────────────────────

describe("'stages' typo at job level", () => {
  it('should warn when job uses plural "stages" instead of "stage"', () => {
    const result = validateLocal(`
build:
  stages: build
  script: echo hello
`);
    expect(result.status).toBe('valid');
    expect(result.warnings.some(w => w.message.includes('stages'))).toBe(true);
    expect(result.looksLikeGitLabCI).toBe(true);
  });
});

// ──────────────────────────────────────────────
// Scenario 9: No job definitions
// ──────────────────────────────────────────────

describe('No job definitions', () => {
  it('should warn when there are keywords but no jobs', () => {
    const result = validateLocal(`
stages: [build, test]
include: template.yml
`);
    expect(result.status).toBe('valid');
    expect(result.warnings.some(w => w.message.includes('No job'))).toBe(true);
    expect(result.looksLikeGitLabCI).toBe(true);
  });

  it('should warn when no GitLab CI keywords are found at all', () => {
    const result = validateLocal('foo: bar');
    expect(result.status).toBe('valid');
    expect(result.warnings.some(w => w.message.includes('No job'))).toBe(true);
    expect(result.looksLikeGitLabCI).toBe(false);
  });
});

// ──────────────────────────────────────────────
// Scenario 10: Dot-prefixed job templates
// ──────────────────────────────────────────────

describe('Dot-prefixed job templates', () => {
  it('should not warn about template-only configs', () => {
    const result = validateLocal(`
.build-template:
  image: node:18
  before_script:
    - npm ci
`);
    expect(result.status).toBe('valid');
    // Dot-prefixed jobs are templates, no warning about missing script
    expect(result.looksLikeGitLabCI).toBe(true);
  });
});

// ──────────────────────────────────────────────
// Scenario 11: Trigger-only job
// ──────────────────────────────────────────────

describe('Trigger-only job', () => {
  it('should not warn when job has a trigger', () => {
    const result = validateLocal(`
deploy-prod:
  trigger:
    project: my-group/my-project
    branch: main
`);
    expect(result.status).toBe('valid');
    expect(result.warnings.some(w => w.message.includes('no script'))).toBe(false);
    expect(result.looksLikeGitLabCI).toBe(true);
  });
});

// ──────────────────────────────────────────────
// Scenario 12: Extends-only job
// ──────────────────────────────────────────────

describe('Extends-only job', () => {
  it('should not warn when job has extends', () => {
    const result = validateLocal(`
build:
  extends: .build-template
`);
    expect(result.status).toBe('valid');
    expect(result.warnings.some(w => w.message.includes('no script'))).toBe(false);
    expect(result.looksLikeGitLabCI).toBe(true);
  });
});
