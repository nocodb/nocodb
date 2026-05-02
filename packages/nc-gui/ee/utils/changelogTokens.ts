/**
 * Parser for sandbox changelog description strings.
 *
 * Backend emits descriptions with two kinds of inline tokens:
 *   - Plain markdown bold:   `**Title**`
 *   - Entity sentinel:       `[[kind:Title]]`
 *
 * The sentinel format is defined in
 * `packages/nocodb/src/ee/decorators/trace-command-descriptions.ts`.
 *
 * `parseChangelogTokens` splits the description into an ordered list of
 * tokens so the changelog row can render each entity with its own icon.
 */

export type ChangelogToken =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'entity'; kind: string; value: string }

const TOKEN_RE = /\[\[(\w+):(.+?)\]\]|\*\*(.+?)\*\*/g

export function parseChangelogTokens(input: string): ChangelogToken[] {
  const out: ChangelogToken[] = []
  if (!input) return out

  let last = 0
  const re = new RegExp(TOKEN_RE.source, 'g')

  for (const m of input.matchAll(re)) {
    const index = m.index ?? 0
    if (index > last) {
      out.push({ type: 'text', value: input.slice(last, index) })
    }
    if (m[1] !== undefined) {
      out.push({ type: 'entity', kind: m[1], value: m[2] })
    } else if (m[3] !== undefined) {
      out.push({ type: 'bold', value: m[3] })
    }
    last = index + m[0].length
  }
  if (last < input.length) {
    out.push({ type: 'text', value: input.slice(last) })
  }
  return out
}

const KIND_ICON_MAP: Record<string, string> = {
  table: 'ncTable',
  view: 'ncEye',
  field: 'ncColumns',
  dashboard: 'ncLayout',
  widget: 'ncGaugeWidget',
  hook: 'ncWebhook',
  script: 'ncScript',
  workflow: 'ncAutomation',
  baseVariable: 'ncKey',
  sync: 'ncRefreshCw',
  rlsPolicy: 'ncShield',
  extension: 'ncPuzzleOutline',
  viewSection: 'ncBookOpen',
  recordTemplate: 'ncFileText',
  dateDependency: 'ncCalendar',
}

export function iconForChangelogKind(kind: string): string | null {
  return KIND_ICON_MAP[kind] ?? null
}
