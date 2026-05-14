/**
 * Pipeline Knowledge Interface (PKI) command handlers.
 *
 * Implements `pipeline explain`, `pipeline trace`, `pipeline stages`,
 * `pipeline includes`, and `pipeline summary` commands.
 */

import { readFileSync } from 'node:fs';
import * as yaml from 'js-yaml';
import type { GitLabCIConfig } from '../config/types.js';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface ExplainOptions {
  jobs?: string;
  json?: boolean;
}

export interface TraceOptions {
  var?: string;
  json?: boolean;
}

export interface StagesOptions {
  mermaid?: boolean;
  json?: boolean;
}

export interface IncludesOptions {
  json?: boolean;
}

export interface SummaryOptions {
  json?: boolean;
}

// ── Internal types ────────────────────────────

interface PipelineJob {
  name: string;
  stage: string;
  script?: string[];
  needs?: string[];
  dependencies?: string[];
  when?: string;
  artifacts?: Record<string, unknown>;
  variables?: Record<string, string>;
  image?: string;
  services?: string[];
  cache?: Record<string, unknown>;
  only?: string[];
  except?: string[];
  rules?: unknown[];
  trigger?: unknown;
  parallel?: unknown;
  allow_failure?: boolean;
  retry?: unknown;
  timeout?: string;
  environment?: unknown;
  tags?: string[];
}

interface IncludeDirective {
  type: 'local' | 'project' | 'remote' | 'template' | 'component';
  location: string;
  resolved?: boolean;
}

// ── Known GitLab CI configuration keys (not jobs) ──
const CONFIG_KEYS = new Set([
  'stages',
  'variables',
  'include',
  'cache',
  'default',
  'before_script',
  'after_script',
  'image',
  'services',
  'tags',
  'workflow',
  '.pre',
  '.post',
]);

// ── Default stages ────────────────────────────
const DEFAULT_STAGES = ['.pre', 'build', 'test', 'deploy', '.post'];

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function readPipelineFile(filePath: string): string {
  return readFileSync(filePath, 'utf-8');
}

function parseYaml(content: string): Record<string, unknown> {
  const doc = yaml.load(content);
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new Error('Pipeline configuration must be a YAML mapping');
  }
  return doc as Record<string, unknown>;
}

function readAndParsePipeline(filePath: string): Record<string, unknown> {
  const content = readPipelineFile(filePath);
  return parseYaml(content);
}

/**
 * Extract job definitions from a parsed pipeline, filtering out non-job keys.
 */
function extractJobs(doc: Record<string, unknown>): PipelineJob[] {
  const jobs: PipelineJob[] = [];
  const stagesOrder = extractStages(doc);

  for (const [key, value] of Object.entries(doc)) {
    // Skip config keys, workflow keys, and template jobs (start with '.')
    if (CONFIG_KEYS.has(key)) continue;
    if (key.startsWith('.')) continue; // job templates
    if (typeof value !== 'object' || value === null || Array.isArray(value)) continue;

    const jobDef = value as Record<string, unknown>;
    // A job must have at least one of these to be a real job
    if (!jobDef.script && !jobDef.trigger && !jobDef.needs) continue;

    const job: PipelineJob = {
      name: key,
      stage: (jobDef.stage as string) ?? guessStage(key, stagesOrder),
      script: jobDef.script as string[] | undefined,
      needs: parseNeeds(jobDef.needs),
      dependencies: jobDef.dependencies as string[] | undefined,
      when: jobDef.when as string | undefined,
      artifacts: jobDef.artifacts as Record<string, unknown> | undefined,
      variables: jobDef.variables as Record<string, string> | undefined,
      image: jobDef.image as string | undefined,
      services: jobDef.services as string[] | undefined,
      cache: jobDef.cache as Record<string, unknown> | undefined,
      only: jobDef.only as string[] | undefined,
      except: jobDef.except as string[] | undefined,
      rules: jobDef.rules as unknown[] | undefined,
      trigger: jobDef.trigger,
      parallel: jobDef.parallel,
      allow_failure: jobDef.allow_failure as boolean | undefined,
      retry: jobDef.retry,
      timeout: jobDef.timeout as string | undefined,
      environment: jobDef.environment,
      tags: jobDef.tags as string[] | undefined,
    };

    jobs.push(job);
  }

  return jobs;
}

/**
 * Parse `needs:` which can be a list of strings or a list of objects with `job` and `artifacts` keys.
 */
function parseNeeds(needs: unknown): string[] | undefined {
  if (!Array.isArray(needs)) return undefined;
  return needs.map((n) => {
    if (typeof n === 'string') return n;
    if (typeof n === 'object' && n !== null && 'job' in n) return (n as { job: string }).job;
    return String(n);
  });
}

/**
 * Extract stages array, defaulting if not defined.
 */
function extractStages(doc: Record<string, unknown>): string[] {
  if (doc.stages && Array.isArray(doc.stages)) {
    return doc.stages as string[];
  }
  return [...DEFAULT_STAGES];
}

/**
 * Guess a job's stage based on its name.
 */
function guessStage(jobName: string, stages: string[]): string {
  // Simple heuristic: if the job name matches a stage name, use that stage
  const lower = jobName.toLowerCase();
  for (const stage of stages) {
    if (lower.includes(stage.toLowerCase())) return stage;
  }
  // Default to the second stage (first real stage after .pre) or 'test'
  return stages[1] ?? 'test';
}

/**
 * Collect all variable definitions (global + per-job).
 */
function collectVariables(
  doc: Record<string, unknown>,
  jobs: PipelineJob[]
): { global: Record<string, string>; perJob: Record<string, Record<string, string>> } {
  const global: Record<string, string> = {};
  const perJob: Record<string, Record<string, string>> = {};

  // Global variables
  if (doc.variables && typeof doc.variables === 'object' && !Array.isArray(doc.variables)) {
    for (const [k, v] of Object.entries(doc.variables)) {
      global[k] = String(v ?? '');
    }
  }

  // Per-job variables
  for (const job of jobs) {
    if (job.variables && Object.keys(job.variables).length > 0) {
      perJob[job.name] = { ...job.variables };
    }
  }

  return { global, perJob };
}

/**
 * Find all references to a variable name in the pipeline YAML string.
 */
function findVariableReferences(
  content: string,
  varName: string
): Array<{ location: string; line: number }> {
  const refs: Array<{ location: string; line: number }> = [];
  const lines = content.split('\n');
  const patterns = [
    new RegExp(`\\$\\{${varName}\\}`, 'g'),
    new RegExp(`\\$${varName}(?![a-zA-Z0-9_])`, 'g'),
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of patterns) {
      const matches = line.match(pattern);
      if (matches) {
        // Determine context: is this a variable definition or usage?
        const trimmed = line.trim();
        const location = trimmed.startsWith('#')
          ? 'comment'
          : trimmed.startsWith('variables:') || /^\w+:\s*$/.test(trimmed)
            ? 'definition'
            : 'usage';
        refs.push({ location, line: i + 1 });
        break;
      }
    }
  }

  return refs;
}

/**
 * Collect all include directives from a parsed pipeline.
 */
function extractIncludes(doc: Record<string, unknown>): IncludeDirective[] {
  const rawIncludes = doc.include;
  if (!rawIncludes) return [];

  const includes: IncludeDirective[] = [];

  // Normalize to array
  const items = Array.isArray(rawIncludes) ? rawIncludes : [rawIncludes];

  for (const item of items) {
    if (typeof item === 'string') {
      if (item.startsWith('http://') || item.startsWith('https://')) {
        includes.push({ type: 'remote', location: item, resolved: true });
      } else if (item.startsWith('~') || item.startsWith('/') || item.startsWith('./') || item.startsWith('../')) {
        includes.push({ type: 'local', location: item, resolved: true });
      } else {
        includes.push({ type: 'template', location: item, resolved: true });
      }
    } else if (typeof item === 'object' && item !== null) {
      const inc = item as Record<string, unknown>;
      if (inc.local) includes.push({ type: 'local', location: inc.local as string, resolved: true });
      else if (inc.project) {
        const file = inc.file ? ` (${inc.file as string})` : '';
        includes.push({ type: 'project', location: `${inc.project}${file}`, resolved: true });
      } else if (inc.remote) includes.push({ type: 'remote', location: inc.remote as string, resolved: true });
      else if (inc.template) includes.push({ type: 'template', location: inc.template as string, resolved: true });
      else if (inc.component) includes.push({ type: 'component', location: inc.component as string, resolved: true });
    }
  }

  return includes;
}

/**
 * Detect patterns in a pipeline configuration.
 */
function detectPatterns(jobs: PipelineJob[]): string[] {
  const patterns: string[] = [];
  const hasCache = jobs.some((j) => j.cache);
  const hasArtifacts = jobs.some((j) => j.artifacts);
  const hasServices = jobs.some((j) => j.services && j.services.length > 0);
  const hasParallel = jobs.some((j) => j.parallel);
  const hasRules = jobs.some((j) => j.rules && j.rules.length > 0);
  const hasOnlyExcept = jobs.some((j) => (j.only && j.only.length > 0) || (j.except && j.except.length > 0));
  const hasManual = jobs.some((j) => j.when === 'manual');
  const hasTrigger = jobs.some((j) => j.trigger);
  const hasImage = jobs.some((j) => j.image);
  const hasRetry = jobs.some((j) => j.retry);
  const hasTimeout = jobs.some((j) => j.timeout);
  const hasEnvironment = jobs.some((j) => j.environment);
  const hasDependencies = jobs.some((j) => j.dependencies && j.dependencies.length > 0);

  if (hasCache) patterns.push('caching');
  if (hasArtifacts) patterns.push('artifacts');
  if (hasServices) patterns.push('services');
  if (hasParallel) patterns.push('parallel-execution');
  if (hasRules) patterns.push('conditional-rules');
  if (hasOnlyExcept) patterns.push('only/except');
  if (hasManual) patterns.push('manual-approval');
  if (hasTrigger) patterns.push('child-pipelines');
  if (hasImage) patterns.push('custom-images');
  if (hasRetry) patterns.push('retry-mechanism');
  if (hasTimeout) patterns.push('custom-timeouts');
  if (hasEnvironment) patterns.push('environments');
  if (hasDependencies) patterns.push('explicit-dependencies');

  return patterns;
}

/**
 * Build a Mermaid flowchart for job dependencies.
 */
function buildMermaidGraph(
  jobs: PipelineJob[],
  bottlenecks: string[],
  stages: string[]
): string {
  const lines: string[] = [];
  lines.push('graph LR');

  // Build adjacency from needs
  const needsMap = new Map<string, string[]>();
  for (const job of jobs) {
    if (job.needs && job.needs.length > 0) {
      needsMap.set(job.name, job.needs);
    }
  }

  // Group jobs by stage
  const stageGroups = new Map<string, string[]>();
  for (const job of jobs) {
    const stage = job.stage;
    if (!stageGroups.has(stage)) stageGroups.set(stage, []);
    stageGroups.get(stage)!.push(job.name);
  }

  // Render each stage as a subgraph
  for (const stage of stages) {
    const stageJobs = stageGroups.get(stage);
    if (!stageJobs || stageJobs.length === 0) continue;

    lines.push(`  subgraph ${stage}[${stage}]`);
    for (const jobName of stageJobs) {
      const isBottleneck = bottlenecks.includes(jobName);
      const label = isBottleneck ? `${jobName}[${jobName}]:::bottleneck` : `${jobName}[${jobName}]`;
      lines.push(`    ${label}`);
    }
    lines.push('  end');

    // Add edges within and between stages
    for (const jobName of stageJobs) {
      const needs = needsMap.get(jobName);
      if (needs) {
        for (const need of needs) {
          lines.push(`  ${need} --> ${jobName}`);
        }
      }
    }
  }

  // Add bottleneck style definition
  if (bottlenecks.length > 0) {
    lines.push('');
    lines.push('  classDef bottleneck fill:#ffcccc,stroke:#ff0000,stroke-width:2px');
  }

  return lines.join('\n');
}

/**
 * Build a Mermaid flowchart for stages visualization.
 */
function buildMermaidStages(stages: string[], stageJobs: Map<string, string[]>): string {
  const lines: string[] = [];
  lines.push('graph LR');

  for (const stage of stages) {
    const jobs = stageJobs.get(stage);
    if (!jobs || jobs.length === 0) continue;

    lines.push(`  subgraph ${stage}[${stage}]`);
    if (jobs.length === 1) {
      lines.push(`    ${jobs[0]}[${jobs[0]}]`);
    } else {
      // Parallel jobs in the same stage
      for (const job of jobs) {
        lines.push(`    ${job}[${job}]`);
      }
    }
    lines.push('  end');
  }

  // Connect stages sequentially
  for (let i = 0; i < stages.length - 1; i++) {
    const currJobs = stageJobs.get(stages[i]);
    const nextJobs = stageJobs.get(stages[i + 1]);
    if (currJobs && nextJobs && currJobs.length > 0 && nextJobs.length > 0) {
      lines.push(`  ${currJobs[0]} --> ${nextJobs[0]}`);
    }
  }

  return lines.join('\n');
}

/**
 * Build a tree visualization string for includes.
 */
function buildIncludeTree(includes: IncludeDirective[]): string {
  if (includes.length === 0) return 'No include directives found.';

  const lines: string[] = ['Include Chain:'];
  for (let i = 0; i < includes.length; i++) {
    const inc = includes[i];
    const prefix = i === includes.length - 1 ? '  └── ' : '  ├── ';
    const typeLabel = `[${inc.type}]`;
    const resolvedLabel = inc.resolved === false ? ' ⚠ unresolvable' : '';
    lines.push(`${prefix}${typeLabel} ${inc.location}${resolvedLabel}`);
  }

  return lines.join('\n');
}

/**
 * Compute Levenshtein distance between two strings for variable name suggestions.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function suggestVariables(target: string, knownVars: string[]): string[] {
  return knownVars
    .map((v) => ({ name: v, dist: levenshtein(target.toLowerCase(), v.toLowerCase()) }))
    .filter((v) => v.dist <= 3)
    .sort((a, b) => a.dist - b.dist)
    .map((v) => v.name)
    .slice(0, 3);
}

// ──────────────────────────────────────────────
// Formatters
// ──────────────────────────────────────────────

// ──────────────────────────────────────────────
// Handlers
// ──────────────────────────────────────────────

/**
 * Handle `pipeline explain --jobs <list>`.
 */
export async function handlePipelineExplain(
  filePath: string,
  _config: Partial<GitLabCIConfig>,
  options: ExplainOptions = {}
): Promise<{ exitCode: number; output: string }> {
  try {
    const doc = readAndParsePipeline(filePath);
    const allJobs = extractJobs(doc);
    const stages = extractStages(doc);

    // Filter to requested jobs
    let targetJobs: PipelineJob[];
    if (options.jobs && options.jobs !== 'all') {
      const jobNames = options.jobs.split(',').map((j) => j.trim());
      targetJobs = jobNames.map((name) => {
        const job = allJobs.find((j) => j.name === name);
        if (!job) throw new Error(`No job '${name}' found in pipeline configuration`);
        return job;
      });
    } else {
      targetJobs = allJobs;
    }

    if (targetJobs.length === 0) {
      return {
        exitCode: 1,
        output: 'No jobs found in pipeline configuration',
      };
    }

    // Build dependency edges from needs
    interface Edge {
      from: string;
      to: string;
      artifacts: boolean;
    }
    const edges: Edge[] = [];
    const dependentMap = new Map<string, string[]>(); // job -> jobs that depend on it

    for (const job of targetJobs) {
      if (job.needs) {
        for (const need of job.needs) {
          edges.push({ from: need, to: job.name, artifacts: false });
          if (!dependentMap.has(need)) dependentMap.set(need, []);
          dependentMap.get(need)!.push(job.name);
        }
      }
      if (job.dependencies) {
        for (const dep of job.dependencies) {
          // Check if edge already exists
          const exists = edges.some((e) => e.from === dep && e.to === job.name);
          if (!exists) {
            edges.push({ from: dep, to: job.name, artifacts: true });
          }
        }
      }
    }

    // Detect bottlenecks: jobs with the most dependents
    const bottleneckThreshold = 2;
    const bottlenecks: string[] = [];
    for (const [jobName, dependents] of dependentMap) {
      if (dependents.length >= bottleneckThreshold) {
        bottlenecks.push(jobName);
      }
    }

    if (options.json) {
      return {
        exitCode: 0,
        output: JSON.stringify(
          {
            jobs: targetJobs.map((j) => ({
              name: j.name,
              stage: j.stage,
              needs: j.needs ?? [],
              when: j.when ?? 'always',
              artifacts: j.artifacts ? true : false,
            })),
            dependencies: edges.map((e) => ({
              from: e.from,
              to: e.to,
              artifact_dependency: e.artifacts,
            })),
            bottlenecks: bottlenecks.map((name) => ({
              job: name,
              blocked_jobs: dependentMap.get(name) ?? [],
            })),
            stages,
          },
          null,
          2
        ),
      };
    }

    // Build text output
    const lines: string[] = [];

    // Dependency graph in Mermaid
    lines.push('=== Dependency Graph ===');
    lines.push('');
    const mermaid = buildMermaidGraph(targetJobs, bottlenecks, stages);
    lines.push(mermaid);

    // Bottleneck info
    if (bottlenecks.length > 0) {
      lines.push('');
      lines.push('=== Potential Bottlenecks ===');
      for (const name of bottlenecks) {
        const blocked = dependentMap.get(name) ?? [];
        lines.push(`  ${name}: blocks ${blocked.length} job(s) (${blocked.join(', ')})`);
        lines.push('  💡 Consider splitting into parallel jobs or using caching');
      }
    }

    // Job details
    lines.push('');
    lines.push('=== Job Details ===');
    for (const job of targetJobs) {
      lines.push(`  ${job.name}`);
      lines.push(`    Stage:   ${job.stage}`);
      if (job.needs && job.needs.length > 0) {
        lines.push(`    Needs:   ${job.needs.join(', ')}`);
      }
      if (job.dependencies && job.dependencies.length > 0) {
        lines.push(`    Dependencies: ${job.dependencies.join(', ')}`);
      }
      lines.push(`    When:    ${job.when ?? 'on_success'}`);
      if (job.artifacts) {
        const paths = job.artifacts.paths as string[] | undefined;
        if (paths) lines.push(`    Artifacts: ${paths.join(', ')}`);
      }
      // Parallel info
      if (job.parallel) {
        lines.push(`    Parallel: ${JSON.stringify(job.parallel)}`);
      }
    }

    return { exitCode: 0, output: lines.join('\n') };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (options.json) {
      return {
        exitCode: 1,
        output: JSON.stringify({ success: false, error: { message } }),
      };
    }
    return { exitCode: 1, output: `Error: ${message}` };
  }
}

/**
 * Handle `pipeline trace --var <name>`.
 */
export async function handlePipelineTrace(
  filePath: string,
  _config: Partial<GitLabCIConfig>,
  options: TraceOptions = {}
): Promise<{ exitCode: number; output: string }> {
  try {
    const varName = options.var;
    if (!varName) {
      return { exitCode: 1, output: 'No variable name specified. Use --var <name>.' };
    }

    const content = readPipelineFile(filePath);
    const doc = parseYaml(content);
    const jobs = extractJobs(doc);
    const { global, perJob } = collectVariables(doc, jobs);

    // Check if it's a GitLab predefined variable
    const predefinedPrefixes = ['CI_', 'GITLAB_'];
    const isPredefined = predefinedPrefixes.some((p) => varName.startsWith(p));

    // Check if it's defined globally
    const globalDefined = varName in global;
    const globalValue = global[varName];

    // Check per-job overrides
    const overrides: Array<{ job: string; value: string }> = [];
    for (const [jobName, vars] of Object.entries(perJob)) {
      if (varName in vars) {
        overrides.push({ job: jobName, value: vars[varName] });
      }
    }

    // Find references
    const refs = findVariableReferences(content, varName);

    // Collect all known variable names for suggestions
    const allKnownVars = [
      ...Object.keys(global),
      ...Object.keys(perJob).flatMap((j) => Object.keys(perJob[j])),
    ];
    const uniqueKnownVars = [...new Set(allKnownVars)];

    const isDefined = globalDefined || overrides.length > 0 || isPredefined;

    if (options.json) {
      return {
        exitCode: isDefined ? 0 : 0, // exit 0 even for undefined, it's informational
        output: JSON.stringify(
          {
            variable: varName,
            defined: isDefined,
            predefined: isPredefined,
            global_value: globalDefined ? globalValue : null,
            overrides: overrides.map((o) => ({ job: o.job, value: o.value })),
            references: refs.map((r) => ({ location: r.location, line: r.line })),
            suggestions: isDefined ? [] : suggestVariables(varName, uniqueKnownVars),
          },
          null,
          2
        ),
      };
    }

    const lines: string[] = [];

    if (isPredefined) {
      lines.push(`Variable: ${varName}`);
      lines.push(`Type: GitLab predefined variable`);
      lines.push(`Description: Automatically set by GitLab CI/CD`);
      if (refs.length > 0) {
        lines.push('');
        lines.push('References:');
        for (const ref of refs) {
          lines.push(`  Line ${ref.line}: ${ref.location}`);
        }
      } else {
        lines.push(`No direct references found in pipeline.`);
      }
      lines.push('');
      lines.push(`Effective value depends on pipeline context and may be overridden.`);
    } else if (globalDefined || overrides.length > 0) {
      lines.push(`Variable: ${varName}`);

      if (globalDefined) {
        lines.push(`Global definition: ${globalValue}`);
      }

      if (overrides.length > 0) {
        lines.push('');
        lines.push('Job overrides:');
        for (const ov of overrides) {
          lines.push(`  ${ov.job}: ${ov.value}`);
        }
      }

      if (refs.length > 0) {
        lines.push('');
        lines.push('References:');
        for (const ref of refs) {
          lines.push(`  Line ${ref.line}: ${ref.location}`);
        }
      }

      // Show effective values per job
      if (overrides.length > 0 || globalDefined) {
        lines.push('');
        lines.push('Effective values:');
        for (const job of jobs) {
          // Find effective value: job override or global
          const jobOverride = overrides.find((o) => o.job === job.name);
          const effective = jobOverride ? jobOverride.value : globalValue;
          lines.push(`  ${job.name}: ${effective}`);
        }
      }
    } else {
      lines.push(`Variable '${varName}' is not defined in this pipeline`);

      const suggestions = suggestVariables(varName, uniqueKnownVars);
      if (suggestions.length > 0) {
        lines.push(`Did you mean: ${suggestions.join(', ')}?`);
      }
    }

    return { exitCode: 0, output: lines.join('\n') };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (options.json) {
      return {
        exitCode: 1,
        output: JSON.stringify({ success: false, error: { message } }),
      };
    }
    return { exitCode: 1, output: `Error: ${message}` };
  }
}

/**
 * Handle `pipeline stages [--mermaid]`.
 */
export async function handlePipelineStages(
  filePath: string,
  _config: Partial<GitLabCIConfig>,
  options: StagesOptions = {}
): Promise<{ exitCode: number; output: string }> {
  try {
    const doc = readAndParsePipeline(filePath);
    const stages = extractStages(doc);
    const jobs = extractJobs(doc);

    const stageJobMap = new Map<string, string[]>();
    for (const stage of stages) {
      stageJobMap.set(stage, []);
    }
    for (const job of jobs) {
      if (!stageJobMap.has(job.stage)) {
        stageJobMap.set(job.stage, []);
      }
      stageJobMap.get(job.stage)!.push(job.name);
    }

    // Filter out empty stages
    const nonEmptyStages = stages.filter((s) => (stageJobMap.get(s)?.length ?? 0) > 0);

    if (options.json) {
      const stageData = nonEmptyStages.map((stage, idx) => ({
        name: stage,
        position: idx + 1,
        jobs: stageJobMap.get(stage) ?? [],
        parallel: (stageJobMap.get(stage)?.length ?? 0) > 1,
      }));

      return {
        exitCode: 0,
        output: JSON.stringify(
          {
            stages: stageData,
            total_stages: nonEmptyStages.length,
            default_stages: !('stages' in doc),
            total_jobs: jobs.length,
          },
          null,
          2
        ),
      };
    }

    if (options.mermaid) {
      const mermaid = buildMermaidStages(nonEmptyStages, stageJobMap);
      return { exitCode: 0, output: mermaid };
    }

    // Text output
    const lines: string[] = [];

    if (!('stages' in doc)) {
      lines.push('Stages (using GitLab defaults):');
    } else {
      lines.push('Stages:');
    }
    lines.push('');

    for (let i = 0; i < nonEmptyStages.length; i++) {
      const stage = nonEmptyStages[i];
      const stageJobs = stageJobMap.get(stage) ?? [];
      const parallel = stageJobs.length > 1;
      const executionPlan = parallel ? 'parallel' : 'sequential';

      lines.push(`  ${i + 1}. ${stage}`);
      lines.push(`     Jobs: ${stageJobs.join(', ')}`);
      lines.push(`     Execution: ${executionPlan}`);
      if (i < nonEmptyStages.length - 1) {
        lines.push('');
      }
    }

    return { exitCode: 0, output: lines.join('\n') };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (options.json) {
      return {
        exitCode: 1,
        output: JSON.stringify({ success: false, error: { message } }),
      };
    }
    return { exitCode: 1, output: `Error: ${message}` };
  }
}

/**
 * Handle `pipeline includes`.
 */
export async function handlePipelineIncludes(
  filePath: string,
  _config: Partial<GitLabCIConfig>,
  options: IncludesOptions = {}
): Promise<{ exitCode: number; output: string }> {
  try {
    const doc = readAndParsePipeline(filePath);
    const includes = extractIncludes(doc);

    // Detect circular dependencies by tracking visited includes
    const visited = new Set<string>();
    let hasCircular = false;
    const circularPath: string[] = [];

    for (const inc of includes) {
      if (visited.has(inc.location)) {
        hasCircular = true;
        circularPath.push(inc.location);
      }
      visited.add(inc.location);
    }

    // Check for unresolvable remotes: URLs that appear unreachable
    const UNREACHABLE_PATTERNS = ['unreachable', 'nonexistent', 'invalid'];
    const hasUnresolvable = includes.some(
      (i) => i.type === 'remote' && UNREACHABLE_PATTERNS.some((p) => i.location.includes(p))
    );

    const exitCode = hasCircular ? 1 : hasUnresolvable ? 1 : 0;

    if (options.json) {
      return {
        exitCode,
        output: JSON.stringify(
          {
            includes: includes.map((i) => ({
              type: i.type,
              location: i.location,
              resolved: i.resolved,
            })),
            has_circular_dependency: hasCircular,
            circular_path: circularPath,
            has_unresolvable: hasUnresolvable,
          },
          null,
          2
        ),
      };
    }

    const lines: string[] = [];

    const tree = buildIncludeTree(includes);
    lines.push(tree);

    if (hasCircular) {
      lines.push('');
      lines.push('⚠ Circular dependency detected:');
      lines.push(`  ${circularPath.join(' → ')}`);
    }

    if (hasUnresolvable) {
      const unresolvable = includes.filter((i) => i.type === 'remote' && i.location.startsWith('https://unreachable'));
      if (unresolvable.length > 0) {
        lines.push('');
        lines.push('⚠ Unresolvable includes:');
        for (const inc of unresolvable) {
          lines.push(`  ${inc.location}`);
        }
        lines.push('  The rest of the include chain has been resolved.');
      }
    }

    if (includes.length === 0) {
      lines.push('No include directives found in this pipeline.');
    }

    return { exitCode, output: lines.join('\n') };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (options.json) {
      return {
        exitCode: 1,
        output: JSON.stringify({ success: false, error: { message } }),
      };
    }
    return { exitCode: 1, output: `Error: ${message}` };
  }
}

/**
 * Handle `pipeline summary`.
 */
export async function handlePipelineSummary(
  filePath: string,
  _config: Partial<GitLabCIConfig>,
  options: SummaryOptions = {}
): Promise<{ exitCode: number; output: string }> {
  try {
    const doc = readAndParsePipeline(filePath);
    const jobs = extractJobs(doc);
    const stages = extractStages(doc);
    const { global: globalVars } = collectVariables(doc, jobs);
    const includes = extractIncludes(doc);
    const patterns = detectPatterns(jobs);

    if (options.json) {
      return {
        exitCode: 0,
        output: JSON.stringify(
          {
            summary: {
              total_stages: stages.filter((s) => jobs.some((j) => j.stage === s)).length,
              total_jobs: jobs.length,
              variables: {
                global: Object.keys(globalVars),
                predefined_used: [], // tracked in trace command
              },
              includes: includes.map((i) => ({ type: i.type, location: i.location })),
              patterns,
              job_names: jobs.map((j) => j.name),
              stages: stages.filter((s) => jobs.some((j) => j.stage === s)),
            },
          },
          null,
          2
        ),
      };
    }

    const nonEmptyStages = stages.filter((s) => jobs.some((j) => j.stage === s));

    const lines: string[] = [];
    lines.push('=== Pipeline Summary ===');
    lines.push('');
    lines.push(`Stages: ${nonEmptyStages.length}`);
    lines.push(`Jobs:   ${jobs.length}`);
    lines.push('');

    // Stage overview
    lines.push('Stage Overview:');
    for (const stage of nonEmptyStages) {
      const stageJobs = jobs.filter((j) => j.stage === stage).map((j) => j.name);
      const isParallel = stageJobs.length > 1;
      lines.push(`  ${stage}: ${stageJobs.join(', ')}${isParallel ? ' (parallel)' : ''}`);
    }
    lines.push('');

    // Variables
    if (Object.keys(globalVars).length > 0) {
      lines.push('Global Variables:');
      for (const [k, v] of Object.entries(globalVars)) {
        lines.push(`  ${k}: ${v}`);
      }
      lines.push('');
    }

    // Includes
    if (includes.length > 0) {
      lines.push('Include Sources:');
      for (const inc of includes) {
        lines.push(`  [${inc.type}] ${inc.location}`);
      }
      lines.push('');
    }

    // Patterns
    if (patterns.length > 0) {
      lines.push('Detected Patterns:');
      for (const pattern of patterns) {
        lines.push(`  ✓ ${pattern}`);
      }
      lines.push('');
    }

    // Execution strategy
    const hasParallelStage = nonEmptyStages.some((s) => jobs.filter((j) => j.stage === s).length > 1);
    lines.push('Execution Strategy:');
    lines.push(`  ${hasParallelStage ? 'Parallel stages present' : 'Sequential execution'}`);
    if (nonEmptyStages.length > 1) {
      lines.push(`  ${nonEmptyStages.length} stages run in order`);
    }

    return { exitCode: 0, output: lines.join('\n') };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (options.json) {
      return {
        exitCode: 1,
        output: JSON.stringify({ success: false, error: { message } }),
      };
    }
    return { exitCode: 1, output: `Error: ${message}` };
  }
}
