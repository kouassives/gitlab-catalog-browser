/**
 * Tests for skills command handlers — covers all 9 spec scenarios.
 *
 * Scenarios covered:
 *   1. List all skills
 *   2. List skills in JSON format
 *   3. No skills installed (empty dir)
 *   4. Get core skill content
 *   5. Get core skill with --full
 *   6. Get specialized skill content (templates)
 *   7. Request nonexistent skill
 *   8. Get skill path (with name)
 *   9. Get base skills path (without name)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  handleSkillsList,
  handleSkillsGet,
  handleSkillsPath,
} from './skills.js';

const defaultConfig = { gitlabUrl: 'https://gitlab.com', token: 'glpat-test' };

// Preserve original env
const ORIGINAL_SKILLS_DIR = process.env.GITLAB_CI_CLI_SKILLS_DIR;

afterEach(() => {
  // Restore env
  if (ORIGINAL_SKILLS_DIR) {
    process.env.GITLAB_CI_CLI_SKILLS_DIR = ORIGINAL_SKILLS_DIR;
  } else {
    delete process.env.GITLAB_CI_CLI_SKILLS_DIR;
  }
});

// ──────────────────────────────────────────────────────────
// Requirement: List Available Skills (3 scenarios)
// ──────────────────────────────────────────────────────────

describe('Requirement: List Available Skills', () => {
  // Scenario 1: List all skills
  it('should list available skills with name and description', async () => {
    const result = await handleSkillsList(defaultConfig);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Available skills:');
    expect(result.output).toContain('core');
    expect(result.output).toContain('templates');
    expect(result.output).toContain('Core workflow instructions');
    expect(result.output).toContain('Pipeline template patterns');
  });

  // Scenario 2: List skills in JSON format
  it('should output JSON when --json is specified', async () => {
    const result = await handleSkillsList(defaultConfig, { json: true });

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThanOrEqual(2);

    const core = parsed.find((s: { name: string }) => s.name === 'core');
    expect(core).toBeDefined();
    expect(core).toHaveProperty('description');
    expect(core).toHaveProperty('path');
  });

  // Scenario 3: No skills installed
  it('should return empty list when skills directory is empty', async () => {
    // Point to a nonexistent directory
    process.env.GITLAB_CI_CLI_SKILLS_DIR = '/tmp/nonexistent-skills-dir-12345';

    const result = await handleSkillsList(defaultConfig);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('No skills installed');
  });
});

// ──────────────────────────────────────────────────────────
// Requirement: Serve Core Skill Content (2 scenarios)
// ──────────────────────────────────────────────────────────

describe('Requirement: Serve Core Skill Content', () => {
  // Scenario 4: Get core skill content
  it('should output core workflow instructions', async () => {
    const result = await handleSkillsGet('core', defaultConfig);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('workflows.md');
    expect(result.output).toContain('Core Workflows');
    expect(result.output).toContain('Browsing the Catalog');
    expect(result.output).toContain('Validating Pipelines');
    expect(result.output).toContain('Analyzing Pipelines');
  });

  // Scenario 5: Get core skill with --full
  it('should include reference content when --full is specified', async () => {
    const result = await handleSkillsGet('core', defaultConfig, { full: true });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('workflows.md');
    expect(result.output).toContain('reference.md');
    expect(result.output).toContain('templates.md');
    expect(result.output).toContain('Command Reference');
    expect(result.output).toContain('Pipeline Template Patterns');
  });
});

// ──────────────────────────────────────────────────────────
// Requirement: Serve Specialized Skill Content (2 scenarios)
// ──────────────────────────────────────────────────────────

describe('Requirement: Serve Specialized Skill Content', () => {
  // Scenario 6: Get specialized skill content
  it('should output templates skill content', async () => {
    const result = await handleSkillsGet('templates', defaultConfig);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('basic-pipeline.yml');
    expect(result.output).toContain('multi-stage.yml');
    expect(result.output).toContain('docker-build.yml');
    expect(result.output).toContain('stages: [build, test, deploy]');
    expect(result.output).toContain('DOCKER_DRIVER');
  });

  // Scenario 7: Request nonexistent skill
  it('should error with suggestion when skill does not exist', async () => {
    const result = await handleSkillsGet('nonexistent', defaultConfig);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("Skill 'nonexistent' not found");
    expect(result.output).toContain('Available skills');
    expect(result.output).toContain('core');
    expect(result.output).toContain('templates');
  });
});

// ──────────────────────────────────────────────────────────
// Requirement: Get Skill Directory Path (2 scenarios)
// ──────────────────────────────────────────────────────────

describe('Requirement: Get Skill Directory Path', () => {
  // Scenario 8: Get skill path with name
  it('should return absolute path for a specific skill', async () => {
    const result = await handleSkillsPath('core', defaultConfig);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('skill-data');
    expect(result.output).toContain('core');
    // Should be an absolute path
    expect(result.output.startsWith('/')).toBe(true);
  });

  // Scenario 9: Get base skills path without name
  it('should return root skills directory path', async () => {
    const result = await handleSkillsPath(undefined, defaultConfig);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('skill-data');
    // Should be an absolute path
    expect(result.output.startsWith('/')).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────
// Additional: Get all skills (--all)
// ──────────────────────────────────────────────────────────

describe('Additional: Get all skills', () => {
  it('should output every skill separated by delimiter', async () => {
    const result = await handleSkillsGet(undefined, defaultConfig, { all: true });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('workflows.md');
    expect(result.output).toContain('basic-pipeline.yml');
    expect(result.output).toContain('---');
  });
});
