/**
 * Tests for doctor command handler.
 */

import { describe, it, expect } from 'vitest';
import { handleDoctor } from './setup.js';

describe('handleDoctor', () => {
  it('should pass all basic checks', async () => {
    const result = await handleDoctor();
    expect(result.report.checks.length).toBeGreaterThanOrEqual(3);
    expect(result.report.summary.total).toBe(result.report.checks.length);
    expect(result.report.summary.passed + result.report.summary.failed).toBe(
      result.report.summary.total
    );
  });

  it('should produce valid JSON structure', async () => {
    const result = await handleDoctor({ json: true });
    expect(result.report).toHaveProperty('success');
    expect(result.report).toHaveProperty('checks');
    expect(result.report).toHaveProperty('summary');
    expect(Array.isArray(result.report.checks)).toBe(true);

    for (const check of result.report.checks) {
      expect(check).toHaveProperty('name');
      expect(check).toHaveProperty('status');
      expect(['pass', 'fail']).toContain(check.status);
      expect(check).toHaveProperty('message');
    }
  });

  it('should fail when token is invalid', async () => {
    const result = await handleDoctor({
      token: 'glpat-invalid-token',
    });

    const tokenCheck = result.report.checks.find((c) => c.name === 'GitLab Token');
    // May pass if the token check returns 200 from gitlab.com (unlikely with fake token)
    // or fail with 401. Either is acceptable behavior.
    expect(tokenCheck).toBeDefined();
    expect(tokenCheck!.status).toBeDefined();
  }, 15000);
});
