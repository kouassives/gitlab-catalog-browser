/**
 * Agent Skill Integration command handlers.
 *
 * Implements `skills list`, `skills get`, and `skills path` commands
 * for serving AI agent workflow content.
 */

import { readFileSync, existsSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GitLabCIConfig } from '../config/types.js';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface ListOptions {
  json?: boolean;
}

export interface GetOptions {
  full?: boolean;
  all?: boolean;
}

export interface PathOptions {
  name?: string;
}

interface SkillManifest {
  skills: Array<{ name: string; description: string }>;
}

// ──────────────────────────────────────────────
// Path resolution
// ──────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Resolve the skills data directory path.
 * Priority: GITLAB_CI_CLI_SKILLS_DIR env var > default relative to package
 */
function getSkillsDir(): string {
  const envDir = process.env.GITLAB_CI_CLI_SKILLS_DIR;
  if (envDir) {
    return resolve(envDir);
  }
  // Default: ../../skill-data/ relative to this file's directory
  return resolve(__dirname, '..', '..', 'skill-data');
}

/**
 * Read and parse the manifest file.
 */
function readManifest(): SkillManifest {
  const manifestPath = join(getSkillsDir(), 'manifest.json');
  if (!existsSync(manifestPath)) {
    return { skills: [] };
  }
  const content = readFileSync(manifestPath, 'utf-8');
  return JSON.parse(content) as SkillManifest;
}

/**
 * Get the path to a skill's content directory.
 */
function getSkillPath(name: string): string {
  return join(getSkillsDir(), name);
}

/**
 * Check if a skill exists.
 */
function skillExists(name: string): boolean {
  const skillPath = getSkillPath(name);
  return existsSync(skillPath);
}

/**
 * Read all content files for a skill, returning filename -> content mapping.
 */
function readSkillContent(name: string): Map<string, string> {
  const skillPath = getSkillPath(name);
  const files = new Map<string, string>();

  if (!existsSync(skillPath)) return files;

  const entries = readdirSync(skillPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile()) {
      const filePath = join(skillPath, entry.name);
      const content = readFileSync(filePath, 'utf-8');
      files.set(entry.name, content);
    }
  }

  return files;
}

/**
 * List all available skills sorted alphabetically.
 */
function listSkills(): Array<{ name: string; description: string; path: string }> {
  const manifest = readManifest();
  return manifest.skills
    .map((s) => ({
      name: s.name,
      description: s.description,
      path: getSkillPath(s.name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ──────────────────────────────────────────────
// Formatters
// ──────────────────────────────────────────────

function formatSkillList(
  skills: Array<{ name: string; description: string; path: string }>
): string {
  if (skills.length === 0) {
    return 'No skills installed.';
  }

  const maxNameLen = Math.max(...skills.map((s) => s.name.length));
  const lines: string[] = ['Available skills:'];
  for (const skill of skills) {
    const paddedName = skill.name.padEnd(maxNameLen + 2);
    lines.push(`  ${paddedName}${skill.description}`);
  }
  return lines.join('\n');
}

// ──────────────────────────────────────────────
// Handlers
// ──────────────────────────────────────────────

/**
 * Handle `skills list [--json]`.
 */
export async function handleSkillsList(
  _config: Partial<GitLabCIConfig>,
  options: ListOptions = {}
): Promise<{ exitCode: number; output: string }> {
  const skills = listSkills();

  if (options.json) {
    return {
      exitCode: 0,
      output: JSON.stringify(skills, null, 2),
    };
  }

  return {
    exitCode: 0,
    output: formatSkillList(skills),
  };
}

/**
 * Handle `skills get <name> [--full]` or `skills get --all`.
 */
export async function handleSkillsGet(
  name: string | undefined,
  _config: Partial<GitLabCIConfig>,
  options: GetOptions = {}
): Promise<{ exitCode: number; output: string }> {
  // --all mode: dump all skills
  if (options.all) {
    const skills = listSkills();
    if (skills.length === 0) {
      return { exitCode: 0, output: 'No skills installed.' };
    }

    const parts: string[] = [];
    for (const skill of skills) {
      const content = readSkillContent(skill.name);
      const contentStr = formatSkillContent(skill.name, content, options.full ?? false);
      parts.push(contentStr);
    }

    return {
      exitCode: 0,
      output: parts.join('\n\n---\n\n'),
    };
  }

  // Named skill
  if (!name) {
    return { exitCode: 1, output: 'No skill name specified. Use `skills get <name>` or `skills get --all`.' };
  }

  if (!skillExists(name)) {
    const available = listSkills()
      .map((s) => s.name)
      .join(', ');
    return {
      exitCode: 1,
      output: `Skill '${name}' not found. Available skills: ${available}`,
    };
  }

  const content = readSkillContent(name);
  return {
    exitCode: 0,
    output: formatSkillContent(name, content, options.full ?? false),
  };
}

/**
 * Handle `skills path [name]`.
 */
export async function handleSkillsPath(
  name: string | undefined,
  _config: Partial<GitLabCIConfig>,
  _options: PathOptions = {}
): Promise<{ exitCode: number; output: string }> {
  if (name) {
    if (!skillExists(name)) {
      return {
        exitCode: 1,
        output: `Skill '${name}' not found.`,
      };
    }
    return {
      exitCode: 0,
      output: getSkillPath(name),
    };
  }

  return {
    exitCode: 0,
    output: getSkillsDir(),
  };
}

// ──────────────────────────────────────────────
// Internal helpers
// ──────────────────────────────────────────────

/**
 * Format skill content for display.
 */
function formatSkillContent(
  name: string,
  files: Map<string, string>,
  full: boolean
): string {
  if (files.size === 0) {
    return `Skill '${name}' has no content files.`;
  }

  const parts: string[] = [];

  // In full mode, include all files
  // In normal mode, skip reference/template files that are supplementary
  for (const [filename, content] of files) {
    // Skip supplementary files in non-full mode
    if (!full && (filename === 'reference.md' || filename === 'templates.md')) {
      continue;
    }
    parts.push(`--- ${filename} ---`);
    parts.push(content.trimEnd());
  }

  // If nothing was included (all files skipped), fall back to including everything
  if (parts.length === 0) {
    for (const [filename, content] of files) {
      parts.push(`--- ${filename} ---`);
      parts.push(content.trimEnd());
    }
  }

  return parts.join('\n\n');
}
