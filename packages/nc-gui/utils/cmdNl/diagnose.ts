import dayjs from 'dayjs'
import { cmdEditDistance } from '../commandPaletteRelativeEdit'
import { CMD_NL_AGG_TEXT } from './compile'
import { cmdNlWordList, tokenizeCmdNl } from './extract'
import type { ChartEdge } from './chart'
import { buildCmdNlLattice } from './grammar'
import { CMD_NL_VAGUE_NEEDS } from './grammarExtra'
import type { CmdNlCmp } from './ir'
import { buildCmdNlLexicon, cmdNlLiteralGuard } from './lexicon'
import type { CmdNlCtx } from './procedural'
import { aggFor } from './procedural'
import type { CmdNlField, CmdNlSchema } from './schema'
import { cmdNlField } from './schema'
import { CMD_NL_CMPS } from './validate'
import type { StatAgg } from './vocab/aggregations'

/**
 * Why a query has no reading, as rows the palette can show disabled: an unknown field word, a value
 * that isn't an option, a comparison the field's type can't take, a summary it doesn't offer, a word
 * that fits several fields, or a query that stops mid-condition. Call it when parseCmdNl returned nothing.
 */

export type CmdNlDiagnosisReason =
  | 'no-field'
  | 'no-value'
  | 'bad-op-for-type'
  | 'unsupported-agg'
  | 'ambiguous'
  | 'incomplete'
  | 'unknown'

export interface CmdNlDiagnosis {
  reason: CmdNlDiagnosisReason
  /** One line for a disabled row: “No field called “sauce”; did you mean Source?”. */
  text: string
  /** The field the problem is about, when there is one (id). */
  field?: string
  /** What would work instead: field titles, option names, aggregation names. */
  suggestion?: string[]
  /** UTF-16 range of the words at fault. */
  span?: [number, number]
}

export interface CmdNlDiagnoseOptions {
  rows?: Record<string, unknown>[]
  now?: dayjs.Dayjs
}

const INCOMPLETE_END = /(?:^|\s)(where|with|whose|and|or|of|by|than|is|is not|isn't|in|not in|=|!=|<|>|<=|>=)$/i
const NUMERIC_CMPS = new Set<CmdNlCmp>(['gt', 'gte', 'lt', 'lte', 'between'])
const LISTED_KINDS = new Set(['select', 'multiselect', 'user'])
const MAX_DIAGNOSES = 3
const MAX_SUGGESTIONS = 5

/** Candidates nearest `typed` (prefix, then edit distance on any word), best first. */
function closest(typed: string, names: string[]): string[] {
  const t = typed.toLowerCase()
  const scored = names.map((name) => {
    const words = name.toLowerCase().split(/\s+/)
    const prefix = words.some((w) => w.startsWith(t) || t.startsWith(w)) ? 0 : 1
    const distance = Math.min(...words.map((w) => cmdEditDistance(t, w)), cmdEditDistance(t, name.toLowerCase()))
    return { name, rank: prefix * 10 + distance }
  })
  return scored
    .filter((s) => s.rank < 10 + Math.max(2, Math.ceil(t.length / 2)))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, MAX_SUGGESTIONS)
    .map((s) => s.name)
}

/** Whether `cmp` makes sense on `field` as the grammar reads it (contains on a select is "any of"). */
function cmpFits(field: CmdNlField, cmp: CmdNlCmp): boolean {
  if (cmp === 'like' || cmp === 'nlike') return LISTED_KINDS.has(field.kind) || field.kind === 'text' || field.kind === 'other'
  if (NUMERIC_CMPS.has(cmp)) return field.kind === 'number' || field.kind === 'date' || field.kind === 'datetime'
  if (field.kind === 'checkbox') return cmp === 'eq' || cmp === 'neq' || cmp === 'checked' || cmp === 'notchecked'
  return CMD_NL_CMPS[field.kind].includes(cmp)
}

/** Lattice categories that carry meaning even on a glue word. */
const MEANINGFUL = new Set(['FIELD', 'CMP', 'OPT', 'MEMBER', 'NUM', 'NUMF', 'ME', 'AGG', 'DATE', 'QUOTED'])

const CMP_WORD: Partial<Record<CmdNlCmp, string>> = {
  eq: 'is',
  neq: 'is not',
  anyof: 'is any of',
  allof: 'has all of',
  nanyof: 'is none of',
  blank: 'is empty',
  notblank: 'is not empty',
  checked: 'is checked',
  notchecked: 'is not checked',
  within: 'within',
  gt: 'greater than',
  gte: 'at least',
  lt: 'less than',
  lte: 'at most',
  between: 'between',
  like: 'contains',
  nlike: "doesn't contain",
}

export function cmdNlDiagnose(query: string, schema: CmdNlSchema, opts: CmdNlDiagnoseOptions = {}): CmdNlDiagnosis[] {
  const text = query.trim()
  if (!text) return []

  const dangling = INCOMPLETE_END.exec(text)
  if (dangling) {
    const word = dangling[1]!
    return [
      {
        reason: 'incomplete',
        text: `Finish the query after “${word}”`,
        span: [text.length - word.length, text.length],
      },
    ]
  }

  const lex = buildCmdNlLexicon(schema, opts.rows)
  const tokens = tokenizeCmdNl(text, cmdNlLiteralGuard(lex))
  if (!tokens.length) return []
  const ctx: CmdNlCtx = { tokens, lex, schema, now: opts.now ?? dayjs(), rows: opts.rows }
  const words = cmdNlWordList(tokens)
  const { edges, skippable } = buildCmdNlLattice(ctx)
  const at = (i: number, cat: string) => edges.filter((e) => e.start === i && e.cat === cat)
  const span = (from: number, to: number): [number, number] => [tokens[from]!.start, tokens[to - 1]!.end]
  /** The next index at or after `i` that isn't glue ("of", "the"); a glue word that is itself a comparison stays. */
  const nextWord = (i: number) => {
    let j = i
    while (j < tokens.length && skippable(j) && !edges.some((e) => e.start === j && MEANINGFUL.has(e.cat))) j++
    return j
  }
  const out: CmdNlDiagnosis[] = []
  const push = (d: CmdNlDiagnosis) => {
    if (!out.some((o) => o.reason === d.reason && o.text === d.text)) out.push(d)
  }

  for (let i = 0; i < tokens.length; i++) {
    // A word that names several fields equally well.
    const fieldEdges = at(i, 'FIELD')
    const longest = Math.max(0, ...fieldEdges.map((e) => e.end))
    const atLongest = fieldEdges.filter((e) => e.end === longest)
    const best = Math.max(0, ...atLongest.map((e) => e.score))
    const tied = [...new Set(atLongest.filter((e) => e.score === best).map((e) => (e.value as { fieldId: string }).fieldId))]
    // The typed words are also whole words of other titles: "ship" for Ship date and Ship method.
    if (tied.length === 1 && longest > i) {
      const typedWords = words.slice(i, longest)
      for (const f of schema.fields) {
        const titleWords = f.title.toLowerCase().split(/\s+/)
        if (!tied.includes(f.id) && typedWords.every((w) => titleWords.includes(w))) tied.push(f.id)
      }
    }
    if (tied.length > 1) {
      const titles = tied.map((id) => cmdNlField(schema, id)?.title ?? id)
      push({
        reason: 'ambiguous',
        text: `“${tokens
          .slice(i, longest)
          .map((t) => t.text)
          .join(' ')}” could be ${titles.join(' or ')}`,
        suggestion: titles,
        span: span(i, longest),
      })
    }

    for (const fe of atLongest.slice(0, 1)) {
      const field = cmdNlField(schema, (fe.value as { fieldId: string }).fieldId)
      if (!field) continue
      const c = nextWord(fe.end)
      const cmpEdge = at(c, 'CMP').sort((a, b) => b.end - a.end)[0]
      if (!cmpEdge) continue
      const cmp = cmpEdge.value as CmdNlCmp
      // A comparison the field's type can't take: "name > 5".
      if (!cmpFits(field, cmp)) {
        push({
          reason: 'bad-op-for-type',
          text: `${field.title} can't be compared with “${CMP_WORD[cmp] ?? cmp}”`,
          field: field.id,
          suggestion: CMD_NL_CMPS[field.kind].map((x) => CMP_WORD[x] ?? x).filter((x, k, all) => all.indexOf(x) === k),
          span: span(i, cmpEdge.end),
        })
        continue
      }
      // A value that isn't one of the field's: "stage is maybe".
      const v = nextWord(cmpEdge.end)
      if (v >= tokens.length || ['blank', 'notblank', 'checked', 'notchecked'].includes(cmp)) continue
      if (LISTED_KINDS.has(field.kind)) {
        const known = edges.some(
          (e) =>
            e.start === v &&
            (e.cat === 'ME' ||
              ((e.cat === 'OPT' || e.cat === 'MEMBER') && (e.value as { fieldId?: string }).fieldId === field.id)),
        )
        if (!known) {
          const typed = tokens[v]!.text
          const names = field.kind === 'user' ? (field.members ?? []).map((m) => m.name) : field.options ?? []
          push({
            reason: 'no-value',
            text: `“${typed}” isn't ${field.kind === 'user' ? 'a member in' : 'an option of'} ${field.title}`,
            field: field.id,
            suggestion: closest(typed, names).length ? closest(typed, names) : names.slice(0, MAX_SUGGESTIONS),
            span: span(v, v + 1),
          })
        }
      } else if (field.kind === 'number' && !at(v, 'NUM').length && !at(v, 'NUMF').length) {
        push({
          reason: 'no-value',
          text: `${field.title} needs a number, not “${tokens[v]!.text}”`,
          field: field.id,
          span: span(v, v + 1),
        })
      }
    }

    // A summary the field doesn't offer: "max of industry".
    for (const ae of at(i, 'AGG')) {
      const agg = ae.value as StatAgg
      const fEdge = at(nextWord(ae.end), 'FIELD').sort((a, b) => b.score - a.score)[0]
      const field = fEdge ? cmdNlField(schema, (fEdge.value as { fieldId: string }).fieldId) : undefined
      if (!field || agg === 'count' || aggFor(agg, field)) continue
      const label = agg === 'mode' ? 'Most common' : CMD_NL_AGG_TEXT[agg] ?? agg
      const offered = ['count_unique', 'count_filled', 'count_empty', 'sum', 'avg', 'min', 'max']
        .filter((fn) => field.aggregations.includes(fn))
        .map((fn) => CMD_NL_AGG_TEXT[fn] ?? fn)
      push({
        reason: 'unsupported-agg',
        text: `${label} isn't available for ${field.title}${offered.length ? `; try ${offered.slice(0, 3).join(', ')}` : ''}`,
        field: field.id,
        suggestion: offered,
        span: span(ae.start, fEdge!.end),
      })
    }
  }

  // A vague word the table has nothing to measure with ("stale" with no last-updated date).
  words.forEach((w, i) => {
    const need = CMD_NL_VAGUE_NEEDS[w]
    if (need && !at(i, 'VAGUE').length) {
      push({ reason: 'no-field', text: `“${tokens[i]!.text}” needs ${need}, and this table has none`, span: span(i, i + 1) })
    }
  })

  // Words the grammar has no reading for: a field it doesn't know, or just an unknown word.
  const covered = new Array<boolean>(tokens.length).fill(false)
  const known = edges.filter((e: ChartEdge) => e.cat !== 'TEXTW')
  for (const e of known) for (let k = e.start; k < e.end; k++) covered[k] = true
  // Words a diagnosis above already explains ("maybe" in "stage is maybe").
  tokens.forEach((t, k) => {
    if (out.some((d) => d.span && t.start >= d.span[0] && t.end <= d.span[1])) covered[k] = true
  })
  const titles = schema.fields.map((f) => f.title)
  for (let i = 0; i < tokens.length; i++) {
    if (covered[i] || skippable(i) || tokens[i]!.quoted) continue
    let end = i + 1
    while (end < tokens.length && !covered[end] && !skippable(end)) end++
    const typed = tokens
      .slice(i, end)
      .map((t) => t.text)
      .join(' ')
    // A word several titles share ("ship": Ship date, Ship method) names none of them alone.
    const sharing = schema.fields.filter((f) => f.title.toLowerCase().split(/\s+/).includes(typed.toLowerCase()))
    if (sharing.length > 1) {
      const names = sharing.map((f) => f.title)
      push({ reason: 'ambiguous', text: `“${typed}” could be ${names.join(' or ')}`, suggestion: names, span: span(i, end) })
      i = end - 1
      continue
    }
    // In a field's place: after a clause word or the opening, or right before a comparison.
    const before = words[i - 1] ?? ''
    const fieldSlot =
      i === 0 || ['where', 'with', 'whose', 'by', 'of', 'per', 'and', 'or'].includes(before) || at(end, 'CMP').length > 0
    const near = closest(typed, titles)
    if (fieldSlot && at(end, 'CMP').length) {
      push({
        reason: 'no-field',
        text: `No field called “${typed}”${near.length ? `; did you mean ${near.slice(0, 2).join(' or ')}?` : ''}`,
        suggestion: near.length ? near : titles.slice(0, MAX_SUGGESTIONS),
        span: span(i, end),
      })
    } else if (near.length && cmdEditDistance(typed.toLowerCase(), near[0]!.toLowerCase()) <= 3) {
      push({
        reason: 'no-field',
        text: `No field called “${typed}”; did you mean ${near[0]}?`,
        suggestion: near,
        span: span(i, end),
      })
    } else {
      push({ reason: 'unknown', text: `Don't know “${typed}” here`, span: span(i, end) })
    }
    i = end - 1
  }

  if (!out.length) push({ reason: 'unknown', text: "Couldn't read this as a command" })
  const order: CmdNlDiagnosisReason[] = ['bad-op-for-type', 'no-value', 'unsupported-agg', 'ambiguous', 'no-field', 'unknown']
  return out.sort((a, b) => order.indexOf(a.reason) - order.indexOf(b.reason)).slice(0, MAX_DIAGNOSES)
}
