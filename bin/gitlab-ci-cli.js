#!/usr/bin/env node

/**
 * gitlab-catalog-browser CLI entry point
 * Wrapper that imports the compiled TypeScript or runs via tsx in development.
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try compiled output first, then fall back to source (for tsx / ts-node)
const distPath = resolve(__dirname, '..', 'dist', 'index.js');
const srcPath = resolve(__dirname, '..', 'src', 'index.ts');

if (existsSync(distPath)) {
  import(distPath).catch((err) => {
    console.error('Failed to load CLI:', err.message);
    process.exit(1);
  });
} else {
  console.warn(
    '⚠ No compiled CLI found. Run `npm run build` first, or use `npx tsx src/index.ts`.'
  );
  process.exit(1);
}
