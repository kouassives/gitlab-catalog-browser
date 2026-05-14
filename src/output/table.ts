/**
 * Simple table formatter for CLI output.
 *
 * Renders aligned, human-readable tables without external dependencies.
 */

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface TableColumn {
  /** Column header text */
  header: string;
  /** Alignment */
  align?: 'left' | 'right';
}

export type TableRow = Record<string, string | number | boolean | undefined | null>;

// ──────────────────────────────────────────────
// Render
// ──────────────────────────────────────────────

/**
 * Render an array of objects as a formatted table string.
 *
 * @param columns - Column definitions (header + alignment)
 * @param rows - Array of row objects (keys match column headers)
 * @returns Formatted table string
 */
export function renderTable(columns: TableColumn[], rows: TableRow[]): string {
  if (columns.length === 0) return '';

  const headers = columns.map((c) => c.header);

  // Calculate column widths
  const colWidths = columns.map((col) => {
    const headerLen = col.header.length;
    const maxDataLen = rows.reduce((max, row) => {
      const val = String(row[col.header] ?? '');
      return Math.max(max, val.length);
    }, 0);
    return Math.max(headerLen, maxDataLen);
  });

  const lines: string[] = [];

  // Header row
  const headerLine = headers
    .map((h, i) => {
      const width = colWidths[i];
      const align = columns[i]?.align ?? 'left';
      return align === 'right' ? h.padStart(width) : h.padEnd(width);
    })
    .join('  ');
  lines.push(headerLine);

  // Separator
  const sepLine = colWidths.map((w) => '─'.repeat(w)).join('──');
  lines.push(sepLine);

  // Data rows
  for (const row of rows) {
    const dataLine = columns
      .map((col, i) => {
        const val = String(row[col.header] ?? '');
        const width = colWidths[i];
        const align = col.align ?? 'left';
        return align === 'right' ? val.padStart(width) : val.padEnd(width);
      })
      .join('  ');
    lines.push(dataLine);
  }

  return lines.join('\n');
}

/**
 * Render a single row as key-value pairs (for detail views like `catalog info`).
 */
export function renderDetail(items: Array<{ label: string; value: string }>): string {
  if (items.length === 0) return '';
  const maxLabelLen = items.reduce((max, item) => Math.max(max, item.label.length), 0);
  return items
    .map((item) => `${item.label.padEnd(maxLabelLen)}  ${item.value}`)
    .join('\n');
}
