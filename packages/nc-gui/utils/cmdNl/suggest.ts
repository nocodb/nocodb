import { phraseAt, tokenizeCmdNl } from './extract'
import type { CmdNlKind } from './ir'
import { buildCmdNlLexicon, cmdNlLexAt } from './lexicon'
import type { CmdNlParseOptions } from './parse'
import { cmdNlExpected } from './parse'
import type { CmdNlField, CmdNlSchema } from './schema'
import { CMP_PHRASES } from './vocab/comparators'
import { plural, singular } from './vocab/inflect'

/**
 * Typeahead for the Cmd+K parser: the grammar says what can come next (a field, a comparator, a value),
 * the schema and loaded rows say which ones. "industry is manu" → Industry's values starting "manu".
 */

export interface CmdNlSuggestion {
  kind: 'field' | 'cmp' | 'value'
  label: string
  /** Text that replaces the partial word (query.slice(from)). */
  insert: string
  fieldId?: string
  /** Where this item's replacement starts, when earlier than the list's `from` ("company size" → "Company Size"). */
  from?: number
}

export interface CmdNlSuggestions {
  /** Where the partial word starts; suggestions replace query.slice(from). */
  from: number
  partial: string
  /** The field the suggestions are about, when there is one. */
  fieldId?: string
  items: CmdNlSuggestion[]
}

/** Comparator phrasings the grammar reads, per field kind. */
export const CMD_NL_CMP_BY_KIND: Record<CmdNlKind, string[]> = {
  text: ['is', 'is not', 'contains', 'is empty', 'is not empty'],
  number: ['>', '<', '>=', '<=', 'between', 'is empty'],
  date: ['is', 'before', 'after', 'in the last', 'in the next', 'is empty'],
  datetime: ['is', 'before', 'after', 'in the last', 'in the next', 'is empty'],
  select: ['is', 'is not', 'in', 'is empty'],
  multiselect: ['has', 'does not have', 'is empty'],
  user: ['is', 'is not', 'is me', 'is empty'],
  checkbox: ['is checked', 'is not checked'],
  other: ['is', 'is empty'],
}

const VALUE_CATS = ['OPT', 'MEMBER', 'ME', 'TEXTW', 'QUOTED', 'BOOL', 'TAGOPT', 'STATE', 'NUM', 'DATE']
const MAX_ITEMS = 8
/** Distinct text values taken from loaded rows per field. */
const MAX_TEXT_VALUES = 50

function valuesOf(field: CmdNlField, rows: Record<string, unknown>[] | undefined): string[] {
  if (field.kind === 'select' || field.kind === 'multiselect') return field.options ?? []
  if (field.kind === 'user') return ['me', ...(field.members ?? []).map((m) => m.name || m.email || '').filter(Boolean)]
  if (field.kind !== 'text' || !rows) return []
  const seen = new Set<string>()
  for (const row of rows) {
    const v = row[field.title]
    if (typeof v === 'string' && v.trim()) seen.add(v.trim())
    if (seen.size >= MAX_TEXT_VALUES) break
  }
  return [...seen]
}

/** Starts-with matches first (of the whole label or a word in it), then contains; case-insensitive. */
function rank(labels: string[], partial: string): string[] {
  const p = partial.toLowerCase()
  if (!p) return labels
  const starts: string[] = []
  const contains: string[] = []
  for (const label of labels) {
    const low = label.toLowerCase()
    if (low === p) continue
    if (low.startsWith(p) || low.split(/[\s_-]+/).some((w) => w.startsWith(p))) starts.push(label)
    else if (low.includes(p)) contains.push(label)
  }
  return [...starts, ...contains]
}

/** The field the end of `context` is talking about: the last field mentioned, if it is still in play. */
function lastField(context: string, schema: CmdNlSchema, opts: CmdNlParseOptions) {
  const tokens = tokenizeCmdNl(context)
  if (!tokens.length) return
  const lex = buildCmdNlLexicon(schema, opts.rows)
  const words = tokens.map((t) => t.word)
  let best: { fieldId: string; end: number } | undefined
  for (let i = 0; i < words.length; i++) {
    const match = cmdNlLexAt(lex, words, i, ['field'])[0]
    if (match && (!best || match.start >= best.end)) best = { fieldId: match.entry.fieldId, end: match.end }
  }
  if (!best) return
  // A conjunction or clause word after the field starts something new.
  const after = words.slice(best.end)
  if (after.some((w) => ['and', 'or', 'where', 'by', 'sort', 'group', ','].includes(w))) return
  return { field: schema.fields.find((f) => f.id === best!.fieldId), atEnd: best.end === words.length, after }
}

/**
 * Start of the title words already typed before the partial word: "where company siz" completing
 * "Company Size" replaces "company siz", not just "siz". Undefined when no leading title word was typed.
 */
function titleStart(context: string, title: string, from: number): number | undefined {
  const titleWords = title.toLowerCase().split(/\s+/)
  const typed = context.trimEnd().split(/\s+/)
  for (let n = Math.min(titleWords.length - 1, typed.length); n > 0; n--) {
    if (typed.slice(-n).join(' ').toLowerCase() !== titleWords.slice(0, n).join(' ')) continue
    const start = context.trimEnd().length - typed.slice(-n).join(' ').length
    return start < from ? start : undefined
  }
}

/** Words that start a clause: a field completion never reaches back past one. */
const CLAUSE_WORDS = new Set(['where', 'with', 'whose', 'and', 'or', 'by', 'of', 'if', 'that', 'which', 'sort', 'group', 'for'])

/**
 * Typed words between the last clause word and the partial one that only restate the table or part of the
 * title ("where company ind" → Industry: "company" is the table's noun), replaced along with the partial word.
 */
function strayStart(context: string, title: string, schema: CmdNlSchema, from: number): number | undefined {
  const tableWord = schema.table.title.toLowerCase().split(/\s+/).pop() ?? ''
  const nouns = new Set([tableWord, singular(tableWord), plural(singular(tableWord))].filter(Boolean))
  const titleWords = title.toLowerCase().split(/\s+/)
  const words = [...context.trimEnd().matchAll(/\S+/g)]
  let start: number | undefined
  for (let i = words.length - 1; i >= 0; i--) {
    const word = words[i]![0].toLowerCase()
    if (CLAUSE_WORDS.has(word)) break
    if (!nouns.has(word) && !titleWords.some((t) => t.startsWith(word))) break
    start = words[i]!.index
  }
  // Only words right before the partial one, and only when a clause word (or the start) precedes them.
  return start !== undefined && start < from ? start : undefined
}

const VALUELESS_CMPS = new Set(['blank', 'notblank', 'checked', 'notchecked'])

/** "is", "is not", "=", "in": a whole comparator that still wants its value. */
function isValueCmp(words: string[]): boolean {
  if (!words.length) return false
  const cmp = phraseAt(words, 0, CMP_PHRASES)
  return cmp?.end === words.length && !VALUELESS_CMPS.has(cmp.value)
}

/**
 * Whether the end of `query` already is the value `label` ("…is Northstar Analytics" → exact) or is still
 * typing it ("…is Northst" → prefix); case- and space-insensitive.
 */
export function cmdNlValueTyped(query: string, label: string): 'exact' | 'prefix' | undefined {
  return cmdNlValueTail(query, label)?.kind
}

/**
 * Where the typed part of `label` starts in `query`: "…is Northstar Anal" completing "Northstar Analytics"
 * replaces "Northstar Anal", not just "Anal". Undefined when the query doesn't end on (a start of) it.
 */
export function cmdNlValueTail(query: string, label: string): { kind: 'exact' | 'prefix'; from: number } | undefined {
  const want = label.toLowerCase().replace(/\s+/g, ' ')
  const words = [...query.trimEnd().matchAll(/\S+/g)]
  const n = want.split(' ').length
  // Longest tail first, so a multi-word value covers every word of it already typed.
  for (let k = Math.min(n + 1, words.length); k > 0; k--) {
    const from = words[words.length - k]!.index!
    const tail = query.slice(from).toLowerCase().replace(/\s+/g, ' ').trimEnd()
    if (tail === want) return { kind: 'exact', from }
    if (k <= n && want.startsWith(tail) && (k > 1 || words.length > 1)) return { kind: 'prefix', from }
  }
}

export function cmdNlSuggest(query: string, schema: CmdNlSchema, opts: CmdNlParseOptions = {}): CmdNlSuggestions {
  const partialMatch = /[^\s,()]+$/.exec(query)
  const from = partialMatch ? partialMatch.index : query.length
  const partial = partialMatch?.[0] ?? ''
  const context = query.slice(0, from)
  const expected = cmdNlExpected(context, schema, opts)
  const target = lastField(context, schema, opts)
  const field = target?.field
  const items: CmdNlSuggestion[] = []

  // "sector is" (no space yet): the comparator is complete, so the next slot is a value, not more comparators.
  if (field && partial && isValueCmp([...(target?.after ?? []), partial.toLowerCase()])) {
    const values = valuesOf(field, opts.rows)
    if (values.length) {
      return {
        from: query.length,
        partial: '',
        fieldId: field.id,
        items: values.slice(0, MAX_ITEMS).map((label) => ({ kind: 'value', label, insert: ` ${label}`, fieldId: field.id })),
      }
    }
  }

  if (field && VALUE_CATS.some((cat) => expected.has(cat))) {
    for (const label of rank(valuesOf(field, opts.rows), partial))
      items.push({ kind: 'value', label, insert: label, fieldId: field.id })
  }
  if (field && target?.atEnd && expected.has('CMP')) {
    for (const label of rank(CMD_NL_CMP_BY_KIND[field.kind], partial))
      items.push({ kind: 'cmp', label, insert: label, fieldId: field.id })
  }
  if (expected.has('FIELD') && !field) {
    // Hidden audit fields ("Created time") only once a couple of letters point at them.
    const fields = schema.fields.filter((f) => !f.system || partial.length >= 2)
    for (const label of rank(
      fields.map((f) => f.title),
      partial,
    ))
      items.push({
        kind: 'field',
        label,
        insert: label,
        fieldId: schema.fields.find((f) => f.title === label)?.id,
        from: titleStart(context, label, from) ?? strayStart(context, label, schema, from),
      })
  }

  return { from, partial, fieldId: field?.id, items: items.slice(0, MAX_ITEMS) }
}
