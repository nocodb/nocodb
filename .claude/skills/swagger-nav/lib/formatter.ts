import type { PathEntry, SchemaEntry, SearchHit, RefEntry } from './parser.js';

type Format = 'json' | 'compact' | 'text';

export function formatOutput(data: unknown, format: Format, command?: string): string {
  if (format === 'compact') return JSON.stringify(data);
  if (format === 'json') return JSON.stringify(data, null, 2);

  // Text mode — command-specific formatting
  switch (command) {
    case 'list-paths':
      return formatPathsTable(data as PathEntry[]);
    case 'list-schemas':
      return formatSchemasTable(data as SchemaEntry[]);
    case 'summary':
      return formatSummary(data as Record<string, any>);
    case 'search':
      return formatSearchHits(data as SearchHit[]);
    case 'get-refs':
      return formatRefs(data as { schema: string; references: RefEntry[]; count: number });
    case 'validate-refs':
      return formatValidation(data as { broken: RefEntry[]; count: number });
    default:
      return JSON.stringify(data, null, 2);
  }
}

function formatPathsTable(entries: PathEntry[]): string {
  if (entries.length === 0) return 'No paths found.';

  const lines: string[] = [];
  for (const entry of entries) {
    const methods = entry.methods.map((m) => {
      const parts = [m.method.toUpperCase()];
      if (m.operationId) parts.push(`(${m.operationId})`);
      if (m.summary) parts.push(`— ${m.summary}`);
      return `  ${parts.join(' ')}`;
    });
    lines.push(entry.path);
    lines.push(...methods);
  }
  return lines.join('\n');
}

function formatSchemasTable(entries: SchemaEntry[]): string {
  if (entries.length === 0) return 'No schemas found.';

  const lines: string[] = [];
  for (const entry of entries) {
    const parts = [entry.name];
    if (entry.type) parts.push(`(${entry.type})`);
    if (entry.propertyCount > 0) parts.push(`${entry.propertyCount} props`);
    lines.push(parts.join('  '));
  }
  return `${entries.length} schemas:\n${lines.join('\n')}`;
}

function formatSummary(data: Record<string, any>): string {
  const lines: string[] = [
    `OpenAPI: ${data.openapi}`,
    `Title:   ${data.title}`,
    `Paths:   ${data.pathCount}`,
    `Schemas: ${data.schemaCount}`,
    `Ops:     ${data.operationCount}`,
    '',
    'Methods:',
  ];
  for (const [method, count] of Object.entries(data.methodCounts ?? {})) {
    lines.push(`  ${method.toUpperCase()}: ${count}`);
  }
  if (data.tags?.length) {
    lines.push('', `Tags: ${data.tags.join(', ')}`);
  }
  return lines.join('\n');
}

function formatSearchHits(hits: SearchHit[]): string {
  if (hits.length === 0) return 'No matches found.';

  const lines: string[] = [`${hits.length} match(es):`];
  for (const hit of hits) {
    const val = hit.value.length > 100 ? hit.value.slice(0, 100) + '...' : hit.value;
    lines.push(`  ${hit.jsonPath}`);
    lines.push(`    ${val}`);
  }
  return lines.join('\n');
}

function formatRefs(data: { schema: string; references: RefEntry[]; count: number }): string {
  if (data.count === 0) return `No references to "${data.schema}" found.`;

  const lines: string[] = [`${data.count} reference(s) to "${data.schema}":`];
  for (const ref of data.references) {
    lines.push(`  ${ref.location}`);
  }
  return lines.join('\n');
}

function formatValidation(data: { broken: RefEntry[]; count: number }): string {
  if (data.count === 0) return 'All $ref references are valid.';

  const lines: string[] = [`${data.count} broken reference(s):`];
  for (const ref of data.broken) {
    lines.push(`  ${ref.refValue}  at  ${ref.location}`);
  }
  return lines.join('\n');
}
