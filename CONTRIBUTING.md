# Contributing to gitlab-catalog-browser

Thank you for your interest in `gitlab-catalog-browser`! 🎉

This project provides AI agents with a CLI tool to browse the **GitLab CI/CD Catalog**, inspect components, validate pipelines, and analyze CI/CD configurations.

Whether you are an **occasional contributor** or a **regular collaborator**, this guide explains how to get involved.

---

## Table of Contents

1. [How to Contribute](#how-to-contribute)
2. [Getting Started](#getting-started)
3. [Project Structure](#project-structure)
4. [Development Workflow](#development-workflow)
5. [Code Conventions](#code-conventions)
6. [Testing](#testing)
7. [Spec-Driven Development](#spec-driven-development)
8. [Contributing Skills](#contributing-skills)
9. [Commit Conventions](#commit-conventions)
10. [Pull Request Process](#pull-request-process)
11. [Reporting a Bug](#reporting-a-bug)
12. [Code of Conduct](#code-of-conduct)

---

## How to Contribute

### 🔍 Report a Bug or Suggest an Idea
- Open an [issue](https://github.com/kouassives/gitlab-catalog-browser/issues) with the appropriate label (`bug`, `enhancement`, `feature`)
- Clearly describe the problem or idea, including reproduction steps if possible

### 🧪 Submit Code
- Check existing [issues](https://github.com/kouassives/gitlab-catalog-browser/issues) labeled `help wanted` or `good first issue`
- For significant changes, **open an issue first** to discuss the approach before writing code

### 📖 Improve Documentation
- Fixes in `README.md`, `CONTRIBUTING.md`, or spec files
- Improvements to skills (`skills/`)

### 🤝 Collaborate on AI Skills
- Contributions to existing skills (core, to-be-continuous-catalog)
- Proposals for new skills for other GitLab Catalog organizations

---

## Getting Started

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9
- **Git**

### Project Setup

```bash
# Clone the repository
git clone https://github.com/kouassives/gitlab-catalog-browser.git
cd gitlab-catalog-browser

# Install dependencies
npm install

# Verify everything compiles
npx tsc --noEmit

# Build
npm run build

# Run tests
npm test
```

### Useful Development Commands

```bash
npm run dev          # TypeScript watch mode
npm run build        # Full compilation
npm test             # Run all tests (vitest)
npm run test:watch   # Tests in watch mode
npm run typecheck    # Type checking only
npm start            # Run the CLI locally
```

---

## Project Structure

```
gitlab-catalog-browser/
├── bin/
│   └── gitlab-catalog-browser.js   # CLI entry point (wrapper)
├── src/
│   ├── index.ts                    # Main entry point (Commander)
│   ├── commands/
│   │   ├── catalog.ts              # Catalog commands (list, search, info)
│   │   ├── component.ts            # Component commands (schema, inputs, jobs)
│   │   ├── validate.ts             # Pipeline validation
│   │   ├── pipeline.ts             # Pipeline analysis (explain, trace, etc.)
│   │   ├── skills.ts               # AI skills management
│   │   ├── setup.ts                # Setup commands (init, upgrade, doctor)
│   │   └── batch.ts                # Batch processing
│   ├── api/
│   │   ├── catalog.ts              # GitLab Catalog API
│   │   ├── gitlab.ts               # GitLab REST client
│   │   ├── graphql.ts              # GitLab GraphQL client
│   │   └── lint.ts                 # CI Lint API
│   ├── config/
│   │   ├── loader.ts               # Configuration loading
│   │   └── types.ts                # Configuration types
│   ├── cache/
│   │   └── schema-cache.ts         # Schema caching
│   ├── validate/
│   │   └── local.ts                # Local YAML validation
│   └── output/
│       └── table.ts                # Table formatter
├── skills/
│   ├── gitlab-catalog-browser/
│   │   └── SKILL.md                # Generic GitLab Catalog skill
│   └── to-be-continuous-catalog/
│       └── SKILL.md                # Specialized to-be-continuous skill
├── skill-data/
│   └── manifest.json               # Embedded skills manifest
├── spec/
│   ├── specs/                      # Living specifications (OpenSpec)
│   └── archive/                    # Archived change proposals
├── dist/                           # Compiled output (generated)
├── package.json
├── tsconfig.json
└── README.md
```

---

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feat/my-feature          # new feature
git checkout -b fix/bug-fix              # bug fix
git checkout -b docs/doc-improvement     # documentation
```

### 2. Develop

- Write code in `src/`
- Add or update tests in the corresponding `*.test.ts` files
- Update specs if necessary (see [Spec-Driven Development](#spec-driven-development))

### 3. Check Quality

```bash
npm run typecheck    # Type checks
npm run build        # Compilation
npm test             # Unit tests
```

### 4. Commit

Follow the [commit conventions](#commit-conventions).

### 5. Open a Pull Request

See the [detailed process](#pull-request-process).

---

## Code Conventions

### Language

- Code (variables, functions, comments) is written in **English**
- User-facing documentation (`README.md`) is in English
- This `CONTRIBUTING.md` is in English

### TypeScript

- The project uses **TypeScript strict** (`strict: true` in `tsconfig.json`)
- **All files** must have explicit types (no implicit `any`)
- Use `type` vs `interface` as follows:
  - `interface` for public contracts (APIs, configurations)
  - `type` for unions, intersections, and derived types
- Avoid `null` — prefer `undefined` when relevant
- Use `as const` for constants, `satisfies` to validate structures

### ES Modules

The project uses `"type": "module"`. All `import`/`export` must use ES modules syntax:

```typescript
import { foo } from './bar.js';  // Note the .js extension
import type { Baz } from './types.js';
```

Even in TypeScript, the `.js` extension is used in imports (ESM convention).

### Style

- **2 spaces** for indentation
- `;` at the end of statements
- Single quotes (`'`) preferred
- Files follow TypeScript's default formatting
- No Prettier/ESLint dependency for now — use good judgment

### Naming

| Element | Convention | Example |
|---------|-----------|---------|
| Files | kebab-case | `catalog-list.ts` |
| Classes | PascalCase | `ConfigLoader` |
| Functions | camelCase | `handleCatalogList()` |
| Variables | camelCase | `componentName` |
| Constants | UPPER_SNAKE_CASE | `MIN_NODE_VERSION` |
| Types | PascalCase | `GitLabCIConfig` |
| Interfaces | PascalCase | `CatalogEntry` |

### Error Handling

- Use typed errors (custom classes if needed)
- CLI commands should handle errors and display clear messages via `process.exitCode`
- Avoid uncaught `throw` in command handlers

---

## Testing

The project uses [Vitest](https://vitest.dev/) for testing.

### Running Tests

```bash
npm test                # All tests (once)
npm run test:watch      # Watch mode
```

### Writing Tests

- Tests are in `*.test.ts` files at the same level as the code being tested
- Example: `src/commands/catalog.test.ts` tests `src/commands/catalog.ts`

Recommended structure:

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('functionName', () => {
  it('should do something specific', () => {
    // Arrange
    // Act
    // Assert
  });

  it('should handle edge case', () => {
    // ...
  });
});
```

### Coverage

- New features must include tests
- Bug fixes must include a regression test
- Use `vi.mock()` to mock external API calls
- Use `vi.spyOn()` to verify interactions

---

## Spec-Driven Development

This project follows the [OpenSpec](https://github.com/forztf/open-skilled-sdd) framework for **Spec-Driven Development**.

### Principles

1. **Specs are living** — they reflect the current state of the system
2. **Every significant change** starts with a spec proposal
3. **Specs live in `spec/specs/`**, organized by capability

### Workflow for Changes

#### Minor Changes (bug fixes, docs)

No spec changes needed. Submit your PR directly.

#### Major Changes (new feature, API change)

1. Create a **change proposal** in `spec/changes/`
2. Follow the OpenSpec format (proposal → tasks → implementation → archive)
3. Once implemented, archive in `spec/archive/` and update the living specs

Proposal structure:

```
spec/changes/2026-05-15-my-feature/
├── proposal.md           # Decision and justification
├── tasks.md              # Implementation plan
└── specs/                # Spec deltas
    └── <capability>/spec-delta.md
```

---

## Contributing Skills

Skills in `skills/` are instructions for AI agents (Claude Code, etc.) that use `gitlab-catalog-browser`.

### Generic Skill (`skills/gitlab-catalog-browser/`)

The main skill covering the entire GitLab CI/CD Catalog. All general CLI commands should be documented here.

### Specialized Skill (`skills/to-be-continuous-catalog/`)

Dedicated skill for the [to-be-continuous](https://gitlab.com/to-be-continuous) organization. Contains workflows specific to their components.

### Skill Rules

- Skills follow the [Agent Skills Specification](https://agentskills.io/specification) format (Markdown with YAML frontmatter)
- Frontmatter must include `name`, `description`, and `allowed-tools`
- Document commands with concrete examples
- Update `skill-data/manifest.json` when adding a new skill
- **Security**: never include tokens or secrets in skills

### Proposing a New Skill

For a new GitLab Catalog organization:

1. Create `skills/<organization-name>/SKILL.md`
2. Register it in `skill-data/manifest.json`
3. Document the specific components and use cases

---

## Commit Conventions

No strict format is enforced, but prefer clear messages:

```
feat: add catalog search command
fix: fix timeout on API requests
docs: update README with new examples
refactor: extract cache logic into dedicated module
test: add tests for table formatter
chore: update dependencies
```

**Guidelines:**
- One commit = one logical change
- Messages in **English**
- Start with an action verb: `fix:`, `feat:`, `docs:`, `refactor:`, `test:`, `chore:`

---

## Pull Request Process

### Before Opening a PR

1. **Discuss first** — for significant changes, open an issue first
2. **Sync your branch** with `main`

```bash
git fetch origin
git rebase origin/main
```

3. **Check quality**

```bash
npm run typecheck
npm run build
npm test
```

### Opening the PR

- Clear title describing the change
- Reference the related issue (`Closes #123`)
- Description template:

```markdown
## Objective

[Description of the change]

## Changes

- [ ] New feature / Bug fix / Documentation
- [ ] Tests added or updated
- [ ] Specs updated
- [ ] Skills updated (if applicable)

## Checklist

- [ ] Code compiles (`npm run build`)
- [ ] Types pass (`npm run typecheck`)
- [ ] Tests pass (`npm test`)
- [ ] New functions have tests
- [ ] Documentation is up to date

## Additional Notes

[Optional]
```

### Code Review

- A maintainer will review your PR
- Comments are meant to improve the code — not a personal attack
- Iterate if needed

### After Merge

- 🎉 Congratulations! Your contribution is live
- If you added a skill, it will be available in the next npm release

---

## Reporting a Bug

1. Check if the bug has already been reported in the [issues](https://github.com/kouassives/gitlab-catalog-browser/issues)
2. Open a new issue with:
   - CLI version (`gitlab-catalog-browser --version`)
   - Your OS and Node.js version
   - Steps to reproduce
   - Expected vs actual behavior
   - If possible, debug output (`gitlab-catalog-browser doctor`)

---

## Code of Conduct

### Our Pledge

In the spirit of open source, we pledge to provide a welcoming experience for all contributors, regardless of experience level.

### Expected Behavior

- Show empathy and respect
- Welcome constructive criticism
- Focus on what is best for the community
- Credit others' work

### Unacceptable Behavior

- Any form of harassment or discrimination
- Insulting or demeaning comments
- Publishing private information without consent

### Reporting

To report inappropriate behavior, contact the maintainer via a private GitHub issue.

---

## Questions?

- Open a [discussion](https://github.com/kouassives/gitlab-catalog-browser/discussions)
- Join the conversation on existing issues

Thank you for helping make `gitlab-catalog-browser` a useful tool for the GitLab CI/CD community! 🚀
