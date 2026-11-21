import * as Diff from 'diff'

export type AuditDiffOp = 'unchanged' | 'added' | 'removed'

export interface AuditDiffSegment {
  text: string
  op: AuditDiffOp
}

export type AuditLineKind = 'p' | 'h' | 'li' | 'ol' | 'task' | 'quote' | 'code'

export interface AuditDiffLine {
  op: AuditDiffOp | 'changed'
  kind: AuditLineKind
  checked?: boolean
  segments: AuditDiffSegment[]
}

export type AuditDiffRow = AuditDiffLine | { op: 'gap'; hidden: number }

/** Share of the shorter value that survived unchanged, 0–1; an append keeps all of it. */
function unchangedShare(parts: Diff.Change[], a: string, b: string) {
  const kept = parts.filter((p) => !p.added && !p.removed).reduce((n, p) => n + p.value.trim().length, 0)
  const shortest = Math.min(a.trim().length, b.trim().length)
  return shortest ? kept / shortest : 1
}

/**
 * Word diff for short text, or `null` when a word diff would be noise: one side
 * is empty or less than half the text survived, so old → new reads better.
 */
export function auditWordDiff(oldVal: unknown, newVal: unknown): AuditDiffSegment[] | null {
  const a = oldVal == null ? '' : String(oldVal)
  const b = newVal == null ? '' : String(newVal)
  if (!a.trim() || !b.trim()) return null

  const parts = Diff.diffWords(a, b)
  if (unchangedShare(parts, a, b) < 0.5) return null

  return parts.map((p) => ({ text: p.value, op: p.added ? 'added' : p.removed ? 'removed' : 'unchanged' }))
}

function decodeEntities(text: string) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

/** Rich text may be stored as HTML; turn its blocks into markdown-style lines. */
function htmlToMarkdownLines(html: string) {
  return decodeEntities(
    html
      .replace(/<li[^>]*>\s*(<p[^>]*>)?/gi, '\n- ')
      .replace(/<h([1-6])[^>]*>/gi, (_m, level) => `\n${'#'.repeat(Number(level))} `)
      .replace(/<blockquote[^>]*>\s*(<p[^>]*>)?/gi, '\n> ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|li|h[1-6]|div|blockquote|ul|ol)>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
}

const stripInlineMarkdown = (text: string) =>
  text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(\*|_)(.+?)\1/g, '$2')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')

interface ParsedLine {
  kind: AuditLineKind
  checked?: boolean
  text: string
}

function parseLine(line: string, formatted: boolean): ParsedLine {
  if (!formatted) return { kind: 'p', text: line }

  let m = line.match(/^\s*[-*+]\s+\[( |x|X)\]\s+(.*)$/)
  if (m) return { kind: 'task', checked: m[1].toLowerCase() === 'x', text: stripInlineMarkdown(m[2]) }
  m = line.match(/^#{1,6}\s+(.*)$/)
  if (m) return { kind: 'h', text: stripInlineMarkdown(m[1]) }
  m = line.match(/^\s*[-*+]\s+(.*)$/)
  if (m) return { kind: 'li', text: stripInlineMarkdown(m[1]) }
  m = line.match(/^\s*\d+[.)]\s+(.*)$/)
  if (m) return { kind: 'ol', text: stripInlineMarkdown(m[1]) }
  m = line.match(/^>\s?(.*)$/)
  if (m) return { kind: 'quote', text: stripInlineMarkdown(m[1]) }
  return { kind: 'p', text: stripInlineMarkdown(line) }
}

function toLines(value: unknown, mode: 'plain' | 'formatted' | 'code'): ParsedLine[] {
  if (value == null || value === '') return []
  let text: string
  if (mode === 'code') {
    text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  } else {
    text = String(value)
    if (mode === 'formatted' && /^\s*</.test(text)) text = htmlToMarkdownLines(text)
  }

  const lines = text.split('\n')
  const parsed = lines.map((l) => (mode === 'code' ? { kind: 'code' as const, text: l } : parseLine(l, mode === 'formatted')))
  // Blank lines carry no content in a formatted value; in plain text keep them.
  return mode === 'formatted' ? parsed.filter((l) => l.text.trim() || l.kind === 'task') : parsed
}

const sameShape = (a: ParsedLine, b: ParsedLine) => a.kind === b.kind && a.checked === b.checked

/**
 * Line diff for long text, formatted text and JSON. An edited line is paired
 * with its replacement and diffed by word; whole lines added or removed stay
 * whole.
 */
export function auditLineDiff(oldVal: unknown, newVal: unknown, mode: 'plain' | 'formatted' | 'code' = 'plain') {
  const a = toLines(oldVal, mode)
  const b = toLines(newVal, mode)

  const chunks = Diff.diffArrays(a, b, { comparator: (x, y) => x.text === y.text && sameShape(x, y) })
  const out: AuditDiffLine[] = []

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const next = chunks[i + 1]

    if (chunk.removed && next?.added) {
      const removed = chunk.value
      const added = next.value
      const pairs = Math.min(removed.length, added.length)
      for (let j = 0; j < pairs; j++) {
        const words = auditWordDiff(removed[j].text, added[j].text)
        if (words && sameShape(removed[j], added[j])) {
          out.push({ op: 'changed', kind: added[j].kind, checked: added[j].checked, segments: words })
        } else {
          out.push({
            op: 'removed',
            kind: removed[j].kind,
            checked: removed[j].checked,
            segments: [{ text: removed[j].text, op: 'removed' }],
          })
          out.push({
            op: 'added',
            kind: added[j].kind,
            checked: added[j].checked,
            segments: [{ text: added[j].text, op: 'added' }],
          })
        }
      }
      for (const l of removed.slice(pairs))
        out.push({ op: 'removed', kind: l.kind, checked: l.checked, segments: [{ text: l.text, op: 'removed' }] })
      for (const l of added.slice(pairs))
        out.push({ op: 'added', kind: l.kind, checked: l.checked, segments: [{ text: l.text, op: 'added' }] })
      i++
      continue
    }

    const op: AuditDiffOp = chunk.added ? 'added' : chunk.removed ? 'removed' : 'unchanged'
    for (const l of chunk.value) out.push({ op, kind: l.kind, checked: l.checked, segments: [{ text: l.text, op }] })
  }

  return out
}

/**
 * Keep changed lines plus `context` unchanged lines around them; runs of hidden
 * lines become one gap row.
 */
export function collapseAuditLines(lines: AuditDiffLine[], context = 1): AuditDiffRow[] {
  const keep = lines.map(() => false)
  lines.forEach((l, i) => {
    if (l.op === 'unchanged') return
    for (let j = Math.max(0, i - context); j <= Math.min(lines.length - 1, i + context); j++) keep[j] = true
  })

  const rows: AuditDiffRow[] = []
  let hidden = 0
  lines.forEach((l, i) => {
    if (keep[i]) {
      if (hidden) rows.push({ op: 'gap', hidden })
      hidden = 0
      rows.push(l)
    } else {
      hidden++
    }
  })
  if (hidden) rows.push({ op: 'gap', hidden })
  return rows
}

/** Items added to and removed from a list-valued field. */
export function auditSetDiff<T>(oldVal: T[] | null | undefined, newVal: T[] | null | undefined, key: (item: T) => unknown) {
  const a = Array.isArray(oldVal) ? oldVal : []
  const b = Array.isArray(newVal) ? newVal : []
  const aKeys = new Set(a.map(key))
  const bKeys = new Set(b.map(key))
  return {
    added: b.filter((it) => !aKeys.has(key(it))),
    removed: a.filter((it) => !bKeys.has(key(it))),
  }
}
