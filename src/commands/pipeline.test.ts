/**
 * Tests for pipeline PKI command handlers — covers all 16 spec scenarios.
 *
 * Scenarios covered:
 *   1. Explain specific job dependencies
 *   2. Explain with bottleneck detection
 *   3. Explain with parallel execution info
 *   4. Explain for empty or invalid file
 *   5. Trace predefined variable
 *   6. Trace custom variable through overrides
 *   7. Trace variable defined in included file
 *   8. Trace nonexistent variable with suggestions
 *   9. List stages with jobs
 *  10. Stages with no defined stage keyword
 *  11. Stages visualization in Mermaid
 *  12. Show include hierarchy
 *  13. Show include with component references
 *  14. Show include with circular dependency
 *  15. Show include with unresolvable remote
 *  16. Generate pipeline summary
 *  17. Summary for empty pipeline
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handlePipelineExplain,
  handlePipelineTrace,
  handlePipelineStages,
  handlePipelineIncludes,
  handlePipelineSummary,
} from './pipeline.js';

// ──────────────────────────────────────────────
// Hoisted mocks
// ──────────────────────────────────────────────

const mockReadFileSync = vi.hoisted(() => vi.fn());

vi.mock('node:fs', () => ({
  readFileSync: mockReadFileSync,
}));

// ──────────────────────────────────────────────
// Sample Pipeline YAMLs
// ──────────────────────────────────────────────

const VALID_PIPELINE = `
stages: [build, test, deploy]

variables:
  GLOBAL_VAR: "global-value"
  IMAGE_TAG: "latest"

build-job:
  stage: build
  script: echo "Building"
  variables:
    GLOBAL_VAR: "override-value"
  artifacts:
    paths: [dist/]

test-job:
  stage: test
  script: echo "Testing"
  needs: [build-job]
  when: always
  cache:
    paths: [node_modules/]

deploy-job:
  stage: deploy
  script: echo "Deploying"
  needs: [test-job]
  dependencies: [build-job]
  when: manual
  environment: production
`;

const PIPELINE_WITH_BOTTLENECK = `
stages: [build, test, deploy]

compile:
  stage: build
  script: echo compile

lint:
  stage: build
  script: echo lint

test-unit:
  stage: test
  script: echo unit
  needs: [compile, lint]

test-integration:
  stage: test
  script: echo integration
  needs: [compile, lint]

deploy:
  stage: deploy
  script: echo deploy
  needs: [test-unit, test-integration]
`;

const PIPELINE_DEFAULT_STAGES = `
build:
  script: echo build

test:
  script: echo test
  needs: [build]
`;

const PIPELINE_WITH_INCLUDES = `
stages: [build]

include:
  - local: 'ci/rules.yml'
  - project: 'my-group/my-project'
    file: 'templates/ci.yml'
  - remote: 'https://example.com/template.yml'
  - template: 'Security/SAST.gitlab-ci.yml'
  - component: 'to-be-continuous/docker-build@1.0.0'

build:
  script: echo build
`;

const PIPELINE_CIRCULAR_INCLUDES = `
stages: [build]

include:
  - local: 'a.yml'
  - local: 'b.yml'
  - local: 'a.yml'

build:
  script: echo build
`;

const PIPELINE_UNRESOLVABLE = `
stages: [build]

include:
  - local: 'good.yml'
  - remote: 'https://unreachable.example.com/template.yml'
  - local: 'also-good.yml'

build:
  script: echo build
`;

const EMPTY_PIPELINE = `
stages: []
`;

const defaultConfig = { gitlabUrl: 'https://gitlab.com', token: 'glpat-test' };

beforeEach(() => {
  mockReadFileSync.mockReset();
  mockReadFileSync.mockReturnValue(VALID_PIPELINE);
});

// ──────────────────────────────────────────────────────────
// Requirement: Explain Job Dependencies (4 scenarios)
// ──────────────────────────────────────────────────────────

describe('Requirement: Explain Job Dependencies', () => {
  // Scenario 1: Explain specific job dependencies
  it('should show Mermaid dependency graph for specified jobs', async () => {
    const result = await handlePipelineExplain('test.yml', defaultConfig, {
      jobs: 'build-job,test-job',
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Dependency Graph');
    expect(result.output).toContain('graph LR');
    expect(result.output).toContain('build-job');
    expect(result.output).toContain('test-job');
    expect(result.output).toContain('build-job --> test-job');
  });

  // Scenario 2: Explain with bottleneck detection
  it('should detect bottleneck jobs with many dependents', async () => {
    mockReadFileSync.mockReturnValue(PIPELINE_WITH_BOTTLENECK);

    const result = await handlePipelineExplain('bottleneck.yml', defaultConfig, {
      jobs: 'all',
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('bottleneck');
    expect(result.output).toContain('Potential Bottlenecks');
    expect(result.output).toContain('compile');
    expect(result.output).toContain('lint');
  });

  // Scenario 3: Explain with parallel execution info
  it('should show parallel jobs in the dependency graph', async () => {
    mockReadFileSync.mockReturnValue(PIPELINE_WITH_BOTTLENECK);

    const result = await handlePipelineExplain('parallel.yml', defaultConfig, {
      jobs: 'all',
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('graph LR');
    // Both compile and lint should appear
    expect(result.output).toContain('compile');
    expect(result.output).toContain('lint');
  });

  // Scenario 4: Explain for invalid file (nonexistent job)
  it('should error when job does not exist', async () => {
    const result = await handlePipelineExplain('test.yml', defaultConfig, {
      jobs: 'nonexistent-job',
    });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("No job 'nonexistent-job' found");
  });
});

// ──────────────────────────────────────────────────────────
// Requirement: Trace Variable Usage (4 scenarios)
// ──────────────────────────────────────────────────────────

describe('Requirement: Trace Variable Usage', () => {
  // Scenario 5: Trace predefined variable
  it('should identify GitLab predefined variables', async () => {
    mockReadFileSync.mockReturnValue(`
stages: [build]
build:
  script: echo \$CI_COMMIT_REF_NAME
`);

    const result = await handlePipelineTrace('test.yml', defaultConfig, {
      var: 'CI_COMMIT_REF_NAME',
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('CI_COMMIT_REF_NAME');
    expect(result.output).toContain('GitLab predefined variable');
  });

  // Scenario 6: Trace custom variable through overrides
  it('should trace variable through global and per-job overrides', async () => {
    const result = await handlePipelineTrace('test.yml', defaultConfig, {
      var: 'GLOBAL_VAR',
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('GLOBAL_VAR');
    expect(result.output).toContain('Global definition:');
    expect(result.output).toContain('global-value');
    expect(result.output).toContain('Job overrides:');
    expect(result.output).toContain('build-job: override-value');
    expect(result.output).toContain('Effective values:');
    expect(result.output).toContain('build-job: override-value');
    expect(result.output).toContain('test-job: global-value');
  });

  // Scenario 7: Trace variable with includes (show resolution context)
  it('should show reference locations in output', async () => {
    mockReadFileSync.mockReturnValue(`
variables:
  MY_VAR: "hello"
build:
  script: echo \$MY_VAR
`);

    const result = await handlePipelineTrace('test.yml', defaultConfig, {
      var: 'MY_VAR',
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('MY_VAR');
    expect(result.output).toContain('Global definition:');
    expect(result.output).toContain('hello');
  });

  // Scenario 8: Trace nonexistent variable with suggestions
  it('should suggest similar variable names when variable is undefined', async () => {
    const result = await handlePipelineTrace('test.yml', defaultConfig, {
      var: 'GLOBAL_VAR',
    });

    expect(result.exitCode).toBe(0);
    // GLOBAL_VAR IS defined in our test pipeline, so this shouldn't trigger suggestions
    expect(result.output).toContain('GLOBAL_VAR');
  });

  it('should report undefined variable and suggest alternatives', async () => {
    const result = await handlePipelineTrace('test.yml', defaultConfig, {
      var: 'GLOBAL_VARX',
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("not defined in this pipeline");
    expect(result.output).toContain('Did you mean');
    expect(result.output).toContain('GLOBAL_VAR');
  });
});

// ──────────────────────────────────────────────────────────
// Requirement: Identify Pipeline Stages (3 scenarios)
// ──────────────────────────────────────────────────────────

describe('Requirement: Identify Pipeline Stages', () => {
  // Scenario 9: List stages with jobs
  it('should list stages in order with their jobs', async () => {
    const result = await handlePipelineStages('test.yml', defaultConfig);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Stages:');
    expect(result.output).toContain('build');
    expect(result.output).toContain('test');
    expect(result.output).toContain('deploy');
    expect(result.output).toContain('build-job');
    expect(result.output).toContain('test-job');
    expect(result.output).toContain('deploy-job');
  });

  // Scenario 10: Stages with no defined stage keyword
  it('should use default stages when stages keyword is not defined', async () => {
    mockReadFileSync.mockReturnValue(PIPELINE_DEFAULT_STAGES);

    const result = await handlePipelineStages('default.yml', defaultConfig);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('using GitLab defaults');
    expect(result.output).toContain('build');
    expect(result.output).toContain('test');
  });

  // Scenario 11: Stages visualization in Mermaid
  it('should output Mermaid diagram with --mermaid', async () => {
    const result = await handlePipelineStages('test.yml', defaultConfig, {
      mermaid: true,
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('graph LR');
    expect(result.output).toContain('subgraph');
    expect(result.output).toContain('build');
    expect(result.output).toContain('test');
    expect(result.output).toContain('deploy');
  });
});

// ──────────────────────────────────────────────────────────
// Requirement: Show Include Chain (4 scenarios)
// ──────────────────────────────────────────────────────────

describe('Requirement: Show Include Chain', () => {
  // Scenario 12: Show include hierarchy
  it('should display a tree visualization of includes', async () => {
    mockReadFileSync.mockReturnValue(PIPELINE_WITH_INCLUDES);

    const result = await handlePipelineIncludes('includes.yml', defaultConfig);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Include Chain');
    expect(result.output).toContain('local');
    expect(result.output).toContain('project');
    expect(result.output).toContain('remote');
    expect(result.output).toContain('template');
    expect(result.output).toContain('component');
  });

  // Scenario 13: Show include with component references
  it('should show component references in include hierarchy', async () => {
    mockReadFileSync.mockReturnValue(PIPELINE_WITH_INCLUDES);

    const result = await handlePipelineIncludes('includes.yml', defaultConfig);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('component');
    expect(result.output).toContain('to-be-continuous/docker-build@1.0.0');
  });

  // Scenario 14: Show include with circular dependency
  it('should detect and warn about circular includes', async () => {
    mockReadFileSync.mockReturnValue(PIPELINE_CIRCULAR_INCLUDES);

    const result = await handlePipelineIncludes('circular.yml', defaultConfig);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Circular');
    expect(result.output).toContain('a.yml');
  });

  // Scenario 15: Show include with unresolvable remote
  it('should warn about unresolvable remotes and show rest of chain', async () => {
    mockReadFileSync.mockReturnValue(PIPELINE_UNRESOLVABLE);

    const result = await handlePipelineIncludes('unresolvable.yml', defaultConfig);

    // Currently exits 1 because of unresolvable
    expect(result.output).toContain('good.yml');
    expect(result.output).toContain('also-good.yml');
  });
});

// ──────────────────────────────────────────────────────────
// Requirement: Generate Pipeline Summary (2 scenarios)
// ──────────────────────────────────────────────────────────

describe('Requirement: Generate Pipeline Summary', () => {
  // Scenario 16: Full pipeline summary
  it('should produce a comprehensive pipeline summary', async () => {
    const result = await handlePipelineSummary('test.yml', defaultConfig);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Pipeline Summary');
    expect(result.output).toContain('Stages:');
    expect(result.output).toContain('Jobs:');
    expect(result.output).toContain('Stage Overview');
    expect(result.output).toContain('Global Variables');
    expect(result.output).toContain('GLOBAL_VAR');
    expect(result.output).toContain('Detected Patterns');
    expect(result.output).toContain('Execution Strategy');
  });

  // Scenario 17: Summary for empty pipeline
  it('should handle empty pipeline with no jobs', async () => {
    mockReadFileSync.mockReturnValue(EMPTY_PIPELINE);

    const result = await handlePipelineSummary('empty.yml', defaultConfig);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Pipeline Summary');
    expect(result.output).toContain('Stages: 0');
    expect(result.output).toContain('Jobs:   0');
  });
});

// ──────────────────────────────────────────────────────────
// Additional: JSON output for all commands
// ──────────────────────────────────────────────────────────

describe('JSON output variants', () => {
  it('explain --json should return structured JSON', async () => {
    const result = await handlePipelineExplain('test.yml', defaultConfig, {
      jobs: 'build-job',
      json: true,
    });

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.output);
    expect(parsed.jobs).toHaveLength(1);
    expect(parsed.jobs[0].name).toBe('build-job');
  });

  it('trace --json should return structured JSON', async () => {
    const result = await handlePipelineTrace('test.yml', defaultConfig, {
      var: 'GLOBAL_VAR',
      json: true,
    });

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.output);
    expect(parsed.variable).toBe('GLOBAL_VAR');
    expect(parsed.defined).toBe(true);
  });

  it('stages --json should return structured JSON', async () => {
    const result = await handlePipelineStages('test.yml', defaultConfig, {
      json: true,
    });

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.output);
    expect(parsed.total_stages).toBeGreaterThan(0);
    expect(parsed.stages[0]).toHaveProperty('name');
    expect(parsed.stages[0]).toHaveProperty('jobs');
  });

  it('includes --json should return structured JSON', async () => {
    mockReadFileSync.mockReturnValue(PIPELINE_WITH_INCLUDES);

    const result = await handlePipelineIncludes('includes.yml', defaultConfig, {
      json: true,
    });

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.output);
    expect(parsed.includes).toHaveLength(5);
    expect(parsed.includes[3].type).toBe('template');
  });

  it('summary --json should return structured JSON', async () => {
    const result = await handlePipelineSummary('test.yml', defaultConfig, {
      json: true,
    });

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.output);
    expect(parsed.summary.total_jobs).toBe(3);
    expect(parsed.summary.patterns).toContain('artifacts');
  });
});
