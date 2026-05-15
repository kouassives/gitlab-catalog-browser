/**
 * Tests for the table formatter utility.
 */

import { describe, it, expect } from 'vitest';
import { renderTable, renderDetail } from './table.js';

describe('renderTable', () => {
  it('should return empty string for no columns', () => {
    expect(renderTable([], [])).toBe('');
  });

  it('should render header-only table when no rows', () => {
    const result = renderTable(
      [{ header: 'Name' }, { header: 'Version' }],
      []
    );
    expect(result).toContain('Name');
    expect(result).toContain('Version');
    expect(result).toContain('─');
  });

  it('should render columns aligned correctly', () => {
    const result = renderTable(
      [{ header: 'Name' }, { header: 'Version' }],
      [
        { Name: 'docker-build', Version: '1.2.0' },
        { Name: 'deploy-aws', Version: '2.0.0' },
      ]
    );

    const lines = result.split('\n');
    expect(lines.length).toBe(4); // header + sep + 2 rows
    expect(lines[0]).toContain('Name');
    expect(lines[0]).toContain('Version');
    expect(lines[2]).toContain('docker-build');
    expect(lines[3]).toContain('deploy-aws');
  });

  it('should handle optional/missing fields as empty string', () => {
    const result = renderTable(
      [{ header: 'Name' }, { header: 'Description' }],
      [{ Name: 'test', Description: undefined }]
    );

    expect(result).toContain('test');
  });

  it('should right-align specified columns', () => {
    const result = renderTable(
      [{ header: 'Name' }, { header: 'Count', align: 'right' }],
      [{ Name: 'item', Count: 42 }]
    );

    const lines = result.split('\n');
    // Count column should be right-aligned
    expect(lines[2]).toMatch(/item\s+\d+/);
  });

  it('should strip newlines from cell values', () => {
    const result = renderTable(
      [{ header: 'Name' }, { header: 'Description' }],
      [{ Name: 'flux-cd', Description: 'line1\r\nline2 still same line' }]
    );

    const lines = result.split('\n');
    // Table has 3 lines: header + separator + 1 data row
    expect(lines).toHaveLength(3);
    // Description should be on the same line as Name (no line break from \r\n)
    expect(lines[2]).toContain('flux-cd');
    expect(lines[2]).toContain('line1');
    expect(lines[2]).toContain('line2 still same line');
    // Should NOT contain the raw newline
    expect(lines[2]).not.toContain('\r\n');
    expect(lines[2]).not.toContain('\n');
  });
});

describe('renderDetail', () => {
  it('should return empty string for no items', () => {
    expect(renderDetail([])).toBe('');
  });

  it('should render aligned label-value pairs', () => {
    const result = renderDetail([
      { label: 'Name', value: 'docker-build' },
      { label: 'Version', value: '1.2.0' },
    ]);

    expect(result).toContain('Name');
    expect(result).toContain('docker-build');
    expect(result).toContain('Version');
    expect(result).toContain('1.2.0');
  });
});
